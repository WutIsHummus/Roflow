import { app, shell, BrowserWindow, ipcMain, dialog, session, clipboard, net } from 'electron'
import { basename, dirname, extname, join } from 'path'
import { spawn } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  cpSync,
  readdirSync,
  statSync
} from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  buildRobloxVfxSystemPrompt,
  buildRobloxVfxUserMessage,
  normalizeParticleLogicPayload
} from './vfxRobloxPrompt.js'
import { buildBundleReadme, writeStudioBundle } from '../shared/vfxStudioBundle.js'

let mainWindow = null
const TRIPO_WEB_PARTITION = 'persist:tripo-web'
const DEFAULT_TRIPO_WEB_BASE_URL = 'https://studio.tripo3d.ai/'
const DEFAULT_TRIPO_WEB_GENERATE_URL = 'https://studio.tripo3d.ai/workspace/generate'
const TRIPO_STUDIO_ASSETS_URL = 'https://studio.tripo3d.ai/assets'
const LEGACY_TRIPO_WEB_HOST = 'www.tripo3d.ai'
const MANUS_WEB_PARTITION = 'persist:manus-web'
const DEFAULT_MANUS_WEB_LOGIN_URL = 'https://manus.im/'
const DEFAULT_MANUS_WEB_WORKSPACE_URL = 'https://manus.im/'
const CHATGPT_WEB_PARTITION = 'persist:chatgpt-web'
const DEFAULT_CHATGPT_WEB_LOGIN_URL = 'https://chatgpt.com/auth/login'
const DEFAULT_CHATGPT_WEB_WORKSPACE_URL = 'https://chatgpt.com/'
const ELEVENLABS_WEB_PARTITION = 'persist:elevenlabs-web'
const DEFAULT_ELEVENLABS_WEB_LOGIN_URL = 'https://elevenlabs.io/'
const DEFAULT_ELEVENLABS_WEB_IMAGE_URL = 'https://elevenlabs.io/image'

function getPythonDir() {
  if (is.dev) return join(process.cwd(), 'python')
  return join(process.resourcesPath, 'python')
}

function spawnPython(scriptName, args, onData, onError) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(getPythonDir(), scriptName)
    const proc = spawn('python', [scriptPath, ...args])
    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (data) => {
      stdout += data.toString()
      if (onData) onData(data.toString())
    })
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
      if (onError) onError(data.toString())
    })
    proc.on('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(stderr || `Python exited with code ${code}`))
    })
  })
}

function parsePythonJsonLines(buffer, onMessage) {
  const lines = buffer.split('\n')
  const remainder = lines.pop() || ''
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      onMessage(JSON.parse(trimmed))
    } catch {
      // ignore non-JSON stdout
    }
  }
  return remainder
}

function spawnPythonJsonProtocol(scriptName, args, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = join(getPythonDir(), scriptName)
    const proc = spawn('python', [scriptPath, ...args])
    let stdoutBuffer = ''
    let stderr = ''
    let finalResult = null

    proc.stdout.on('data', (data) => {
      stdoutBuffer += data.toString()
      stdoutBuffer = parsePythonJsonLines(stdoutBuffer, (msg) => {
        if (msg.type === 'progress' && onProgress) {
          onProgress({ step: msg.step, pct: msg.pct })
        } else if (msg.type === 'result') {
          finalResult = msg
        }
      })
    })
    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })
    proc.on('close', (code) => {
      if (stdoutBuffer.trim()) {
        parsePythonJsonLines(`${stdoutBuffer}\n`, (msg) => {
          if (msg.type === 'progress' && onProgress) {
            onProgress({ step: msg.step, pct: msg.pct })
          } else if (msg.type === 'result') {
            finalResult = msg
          }
        })
      }

      if (finalResult?.success) {
        resolve(finalResult)
        return
      }
      if (finalResult && finalResult.success === false) {
        reject(new Error(finalResult.error || 'Python script failed.'))
        return
      }
      if (code === 0) {
        resolve({ success: true })
        return
      }
      reject(new Error(stderr.trim() || `Python exited with code ${code}`))
    })
  })
}

function getWorkspaceModelDir() {
  return join(app.getPath('temp'), 'ai-game-dev-hub')
}

function getPersistentModelLibraryDir() {
  return join(app.getPath('userData'), 'generated-models')
}

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true })
}

function getRoflowVfxPluginSourceDir() {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'roblox-plugin', 'RoflowVFX')
  }
  return join(app.getAppPath(), 'plugins', 'roblox', 'RoflowVFX')
}

function getRobloxPluginsDir() {
  const localAppData = process.env.LOCALAPPDATA || join(app.getPath('home'), 'AppData', 'Local')
  return join(localAppData, 'Roblox', 'Plugins')
}

function installRoflowVfxPlugin() {
  const sourceDir = getRoflowVfxPluginSourceDir()
  if (!existsSync(sourceDir)) {
    throw new Error(`RoFlow VFX plugin source not found at ${sourceDir}`)
  }

  const pluginEntry = join(sourceDir, 'RoflowVFX.plugin.lua')
  if (!existsSync(pluginEntry)) {
    throw new Error(`Missing plugin entry script: ${pluginEntry}`)
  }

  const destDir = join(getRobloxPluginsDir(), 'RoflowVFX')
  ensureDir(destDir)
  cpSync(sourceDir, destDir, { recursive: true, force: true })

  return {
    sourceDir,
    destDir,
    pluginEntry: join(destDir, 'RoflowVFX.plugin.lua')
  }
}

function sanitizeFileStem(value) {
  const cleaned = Array.from(String(value || 'generated-model').trim())
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code < 32 || '<>:"/\\|?*'.includes(char)) return '_'
      return char
    })
    .join('')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return cleaned || 'generated-model'
}

function getMimeTypeFromExt(filePath) {
  const ext = extname(String(filePath || '')).toLowerCase()
  if (ext === '.png') return 'image/png'
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.webp') return 'image/webp'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.mp4') return 'video/mp4'
  if (ext === '.mov') return 'video/quicktime'
  if (ext === '.webm') return 'video/webm'
  if (ext === '.glb') return 'model/gltf-binary'
  if (ext === '.gltf') return 'model/gltf+json'
  if (ext === '.json') return 'application/json'
  if (ext === '.txt' || ext === '.ini' || ext === '.csv') return 'text/plain'
  if (ext === '.mp3') return 'audio/mpeg'
  if (ext === '.wav') return 'audio/wav'
  if (ext === '.ogg') return 'audio/ogg'
  return 'application/octet-stream'
}

function inferModelProvider(name, fallback = 'workspace') {
  const lower = String(name || '').toLowerCase()
  if (lower.startsWith('tripo_')) return 'tripo-web'
  if (lower.includes('tripo')) return 'tripo'
  return fallback
}

function getModelMetadataPath(filePath) {
  return `${filePath}.json`
}

function readModelMetadata(filePath) {
  try {
    const metaPath = getModelMetadataPath(filePath)
    if (!existsSync(metaPath)) return null
    return JSON.parse(readFileSync(metaPath, 'utf8'))
  } catch {
    return null
  }
}

function buildGeneratedModelItem(filePath, metadata = null) {
  const stats = statSync(filePath)
  const fileName = basename(filePath)
  const meta = metadata || readModelMetadata(filePath) || {}
  return {
    id: filePath,
    name: meta.name || fileName,
    prompt: meta.prompt || '',
    filePath,
    outputPath: filePath,
    provider: meta.provider || inferModelProvider(fileName),
    sourceTab: meta.sourceTab || null,
    modifiedAt: stats.mtimeMs
  }
}

function listGeneratedModelItemsInDir(dirPath) {
  if (!existsSync(dirPath)) return []
  return readdirSync(dirPath)
    .map((name) => join(dirPath, name))
    .filter((filePath) => {
      const lower = filePath.toLowerCase()
      return (
        (lower.endsWith('.glb') || lower.endsWith('.gltf')) &&
        statSync(filePath).isFile()
      )
    })
    .map((filePath) => buildGeneratedModelItem(filePath))
}

function normalizeTripoAssetId(urlOrId) {
  if (!urlOrId) return ''
  const value = String(urlOrId).trim()
  if (!value) return ''

  if (!/[/:?#]/.test(value) && value.length < 128) {
    return value
  }

  try {
    const parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`)
    const threeDModelUuid = parsed.pathname.match(
      /\/3d-model\/[^/]*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
    )
    if (threeDModelUuid?.[1]) return threeDModelUuid[1]

    const pathMatch = parsed.pathname.match(
      /\/(?:asset|assets|model|project|task|create|3d-model)s?\/([^/?#]+)/i
    )
    if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1])

    for (const key of ['id', 'task', 'asset', 'project', 'model']) {
      const param = parsed.searchParams.get(key)
      if (param) return param
    }
  } catch {
    // fall through to loose matching
  }

  const looseThreeDModelUuid = value.match(
    /\/3d-model\/[^/]*?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i
  )
  if (looseThreeDModelUuid?.[1]) return looseThreeDModelUuid[1]

  const loosePathMatch = value.match(/\/(?:asset|assets|model|project|task|create|3d-model)s?\/([^/?#]+)/i)
  if (loosePathMatch?.[1]) return decodeURIComponent(loosePathMatch[1])

  const queryMatch = value.match(/[?&](?:id|task|asset|project|model)=([^&#]+)/i)
  if (queryMatch?.[1]) return decodeURIComponent(queryMatch[1])

  return value
}

function isTripoGalleryNoiseName(name) {
  if (!name || name.length < 2) return true
  const trimmed = String(name).trim()
  if (/^Number\.\d+$/i.test(trimmed)) return true
  if (/^\d{1,4}$/.test(trimmed)) return true
  if (/^\+?\d+$/.test(trimmed)) return true
  if (/^@[\w.-]+$/.test(trimmed)) return true
  if (/^anonymous\d*$/i.test(trimmed)) return true
  if (
    /view model|feature my model|invite code|gallery|featured|explore|discover|trending|popular|filter|generate hd model|generate smart mesh/i.test(
      trimmed
    )
  ) {
    return true
  }
  if (
    /^(all|character|vehicle|animal|architecture|furniture|props|weapon|clothing|machine|food|nature|abstract|smart mesh|untextured|textured|rigged)$/i.test(
      trimmed
    )
  ) {
    return true
  }
  return false
}

function isTripoPublicOrGalleryUrl(url) {
  if (!url) return false
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    if (!parsed.hostname.endsWith('tripo3d.ai')) return true
    const path = parsed.pathname.replace(/\/$/, '').toLowerCase()
    if (!path || path === '/workspace' || path === '/home' || path === '/assets') return true
    if (/^\/(explore|gallery|community|discover|trending|featured|workspace\/generate)(\/|$)/.test(path)) {
      return true
    }
    if (/^\/model\//.test(path)) return true
    return false
  } catch {
    return true
  }
}

function matchesTripoUserAssetPath(path, url = '') {
  return (
    /\/(project|asset|task|create)\/[^/?#]+/i.test(path) ||
    /\/3d-model\/[^/?#]+/i.test(path) ||
    /\/workspace\/(project|create|texture-edit|generate)\/[^/?#]+/i.test(path) ||
    /\/assets\/[^/?#]+/i.test(path) ||
    /[?&](task|project|id|model)=/i.test(url)
  )
}

function isTripoUserAssetUrl(url) {
  if (!url || isTripoPublicOrGalleryUrl(url)) return false
  if (/\.(glb|gltf)(\?|$)/i.test(url)) {
    try {
      return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.endsWith('tripo3d.ai')
    } catch {
      return false
    }
  }
  try {
    const parsed = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
    if (!parsed.hostname.endsWith('tripo3d.ai')) return false
    return matchesTripoUserAssetPath(parsed.pathname, url)
  } catch {
    return false
  }
}

function isValidTripoHistoryItem(item = {}) {
  const detailUrl = item.detailUrl || ''
  const downloadUrl = item.downloadUrl || ''
  const name = item.name || ''
  const validDetail = isTripoUserAssetUrl(detailUrl)
  const validDownload = /\.(glb|gltf)(\?|$)/i.test(downloadUrl)

  if (detailUrl && isTripoPublicOrGalleryUrl(detailUrl) && !validDownload) return false
  if (!validDetail && !validDownload) return false
  if (isTripoGalleryNoiseName(name) && !validDownload) return false
  return true
}

function isValidTripoSyncedAssetEntry(entry = {}) {
  return isValidTripoHistoryItem({
    detailUrl: entry.detailUrl || '',
    downloadUrl: entry.downloadUrl || '',
    name: entry.name || ''
  })
}

function sanitizeTripoSyncedAssets(assets = []) {
  const cleaned = assets.filter(isValidTripoSyncedAssetEntry)
  if (cleaned.length !== assets.length) {
    saveTripoSyncedAssets(cleaned)
  }
  return cleaned
}

function getTripoSyncedAssets() {
  const cfg = loadConfig()
  const assets = Array.isArray(cfg.tripoSyncedAssets) ? cfg.tripoSyncedAssets : []
  return sanitizeTripoSyncedAssets(assets)
}

function saveTripoSyncedAssets(assets) {
  saveConfig({ ...loadConfig(), tripoSyncedAssets: assets })
}

function syncedAssetToHistoryItem(entry) {
  return {
    id: entry.id,
    name: entry.name,
    prompt: '',
    previewUrl: entry.previewUrl || '',
    detailUrl: entry.detailUrl || '',
    downloadUrl: entry.downloadUrl || '',
    outputPath: entry.localPath || null,
    filePath: entry.localPath || null,
    provider: 'tripo-history',
    syncedAt: entry.syncedAt || null
  }
}

function updateTripoSyncedAssetLocalPath(tripoAssetId, localPath) {
  if (!tripoAssetId || !localPath) return
  const id = normalizeTripoAssetId(tripoAssetId)
  const assets = getTripoSyncedAssets()
  const index = assets.findIndex((entry) => entry.id === id)
  if (index === -1) return
  assets[index] = { ...assets[index], localPath }
  saveTripoSyncedAssets(assets)
}

function mergeTripoSyncedAssets(scrapedItems = []) {
  const previous = getTripoSyncedAssets()
  const validScraped = scrapedItems.filter(isValidTripoHistoryItem)

  if (!validScraped.length) {
    if (previous.length) {
      console.log(`[tripo-sync] Empty scrape — keeping ${previous.length} cached asset(s)`)
      return previous
    }
    saveTripoSyncedAssets([])
    return []
  }

  const prevById = new Map(previous.map((entry) => [entry.id, entry]))
  const now = Date.now()
  const byId = new Map()

  for (const item of validScraped) {
    const detailUrl = item.detailUrl || ''
    const downloadUrl = item.downloadUrl || ''
    const id = normalizeTripoAssetId(detailUrl || downloadUrl || item.id)
    if (!id) continue

    const prev = prevById.get(id) || {}
    byId.set(id, {
      id,
      name: item.name || prev.name || 'Untitled Tripo Asset',
      detailUrl: detailUrl || prev.detailUrl || '',
      downloadUrl: downloadUrl || prev.downloadUrl || '',
      previewUrl: item.previewUrl || prev.previewUrl || '',
      syncedAt: now,
      localPath: prev.localPath || null
    })
  }

  const merged = Array.from(byId.values())
    .filter(isValidTripoSyncedAssetEntry)
    .sort((a, b) => (b.syncedAt || 0) - (a.syncedAt || 0))
  saveTripoSyncedAssets(merged)
  console.log(`[tripo-sync] Saved ${merged.length} asset(s) from scrape`)
  return merged
}

function listTripoSyncedAssets() {
  return getTripoSyncedAssets()
    .sort((a, b) => (b.syncedAt || 0) - (a.syncedAt || 0))
    .map(syncedAssetToHistoryItem)
}

function getTripoSyncedAssetById(assetId) {
  const id = normalizeTripoAssetId(assetId)
  const entry = getTripoSyncedAssets().find((item) => item.id === id)
  return entry ? syncedAssetToHistoryItem(entry) : null
}

function persistGeneratedModel({
  sourcePath,
  name = '',
  prompt = '',
  provider = 'workspace',
  sourceTab = null,
  tripoAssetId = null,
  detailUrl = null,
  previewUrl = null
}) {
  if (!sourcePath || !existsSync(sourcePath)) {
    throw new Error('Generated model file was not found.')
  }

  const libraryDir = getPersistentModelLibraryDir()
  ensureDir(libraryDir)

  const ext = extname(sourcePath) || '.glb'
  const stem = sanitizeFileStem(name) || sanitizeFileStem(basename(sourcePath, ext)) || 'generated-model'
  const destPath = join(libraryDir, `${Date.now()}_${stem}${ext}`)

  copyFileSync(sourcePath, destPath)
  writeFileSync(
    getModelMetadataPath(destPath),
    JSON.stringify(
      {
        name: name || basename(destPath, ext),
        prompt,
        provider,
        sourceTab,
        savedAt: Date.now(),
        ...(tripoAssetId ? { tripoAssetId } : {}),
        ...(detailUrl ? { detailUrl } : {}),
        ...(previewUrl ? { previewUrl } : {})
      },
      null,
      2
    ),
    'utf8'
  )

  if (tripoAssetId) {
    updateTripoSyncedAssetLocalPath(tripoAssetId, destPath)
  }

  return buildGeneratedModelItem(destPath, {
    name: name || basename(destPath, ext),
    prompt,
    provider,
    sourceTab
  })
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'RoFlow',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeExternalUrl(value, fallback) {
  if (!value) return fallback
  const trimmed = String(value).trim()
  if (!trimmed) return fallback
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

function isLegacyTripoWebUrl(url) {
  if (!url) return true
  try {
    const { hostname } = new URL(normalizeExternalUrl(url, DEFAULT_TRIPO_WEB_BASE_URL))
    return hostname === LEGACY_TRIPO_WEB_HOST
  } catch {
    return false
  }
}

function shouldNavigateTripoInternally(targetUrl, baseUrl) {
  try {
    const openHost = new URL(targetUrl).hostname
    const baseHost = new URL(baseUrl).hostname
    if (openHost === baseHost || openHost.endsWith(`.${baseHost}`)) return true
    return openHost.endsWith('tripo3d.ai') && baseHost.endsWith('tripo3d.ai')
  } catch {
    return false
  }
}

function isTripoGalleryUrl(url) {
  try {
    const path = new URL(normalizeExternalUrl(url, DEFAULT_TRIPO_WEB_BASE_URL))
      .pathname.replace(/\/$/, '')
      .toLowerCase()
    if (!path || path === '/workspace' || path === '/home') return true
    if (/^\/(explore|gallery|community|discover|trending|featured)(\/|$)/.test(path)) return true
    if (/^\/model\//.test(path)) return true
    return false
  } catch {
    return false
  }
}

function migrateTripoWebConfig(cfg) {
  const next = { ...cfg }
  let changed = false

  if (isLegacyTripoWebUrl(next.tripoWebBaseUrl)) {
    next.tripoWebBaseUrl = DEFAULT_TRIPO_WEB_BASE_URL
    changed = true
  }

  const baseUrl = normalizeExternalUrl(next.tripoWebBaseUrl, DEFAULT_TRIPO_WEB_BASE_URL)
  const generateUrl = next.tripoWebGenerateUrl
  if (
    !generateUrl ||
    isLegacyTripoWebUrl(generateUrl) ||
    isTripoGalleryUrl(generateUrl) ||
    generateUrl.trim().replace(/\/$/, '') === baseUrl.trim().replace(/\/$/, '')
  ) {
    next.tripoWebGenerateUrl = DEFAULT_TRIPO_WEB_GENERATE_URL
    changed = true
  }

  if (
    !next.tripoWebLastHistoryUrl ||
    isLegacyTripoWebUrl(next.tripoWebLastHistoryUrl) ||
    isTripoGalleryUrl(next.tripoWebLastHistoryUrl)
  ) {
    next.tripoWebLastHistoryUrl = TRIPO_STUDIO_ASSETS_URL
    changed = true
  }

  if (Array.isArray(next.tripoSyncedAssets) && next.tripoSyncedAssets.length) {
    const cleaned = next.tripoSyncedAssets.filter(isValidTripoSyncedAssetEntry)
    if (cleaned.length !== next.tripoSyncedAssets.length) {
      next.tripoSyncedAssets = cleaned
      changed = true
    }
  }

  if (!next.tripoDownloadFormat || !['glb', 'fbx', 'obj', 'stl'].includes(next.tripoDownloadFormat)) {
    next.tripoDownloadFormat = 'glb'
    changed = true
  }

  return { cfg: next, changed }
}

function getProviderWebSession(partition) {
  return session.fromPartition(partition)
}

function tripoInpageHelpers() {
  return `
      const queryAllDeep = (selector, root = document) => {
        const results = []
        const seen = new Set()
        const walk = (node) => {
          if (!node?.querySelectorAll) return
          for (const el of node.querySelectorAll(selector)) {
            if (!seen.has(el)) {
              seen.add(el)
              results.push(el)
            }
          }
          for (const el of node.querySelectorAll('*')) {
            if (el.shadowRoot) walk(el.shadowRoot)
          }
        }
        walk(root)
        return results
      }
      const queryDeep = (selector, root = document) => queryAllDeep(selector, root)[0] || null
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 4 && rect.height > 4
      }
      const textOf = (el) =>
        (el?.innerText || el?.textContent || el?.getAttribute?.('aria-label') || el?.placeholder || '')
          .replace(/\\s+/g, ' ')
          .trim()
      const dismissTripoOverlays = () => {
        let dismissed = 0
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }))
        for (const btn of queryAllDeep('button,[role="button"],a')) {
          if (!visible(btn)) continue
          const label = textOf(btn)
          if (/^(close|dismiss|not now|skip|maybe later|×|✕)$/i.test(label)) {
            btn.click()
            dismissed++
          }
        }
        return dismissed
      }
  `
}

async function openTripoLoginWindow(baseUrl) {
  const loginLandingUrl = normalizeExternalUrl(
    DEFAULT_TRIPO_WEB_GENERATE_URL,
    normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL)
  )
  const win = await createTripoWebWindow({
    url: loginLandingUrl,
    show: true,
    title: 'Connect Tripo Account'
  })
  await wait(2500)
  await win.webContents.executeJavaScript(`
    (() => {
      ${tripoInpageHelpers()}
      dismissTripoOverlays()
      const loginButton = queryAllDeep('button,a,[role="button"]')
        .filter(visible)
        .find((el) => /sign up\\/log in|^log in$|^sign in$/i.test(textOf(el)))
      if (loginButton) {
        loginButton.click()
        return { clicked: true, label: textOf(loginButton) }
      }
      return { clicked: false }
    })()
  `)
  return win
}

async function createProviderWebWindow({
  partition,
  url,
  show = true,
  title = 'Browser Session'
}) {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show,
    autoHideMenuBar: true,
    title,
    backgroundColor: '#0a0a0a',
    webPreferences: {
      partition,
      sandbox: true
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    try {
      if (shouldNavigateTripoInternally(details.url, url)) {
        win.loadURL(details.url)
      } else {
        shell.openExternal(details.url)
      }
    } catch {
      // malformed URL — ignore
    }
    return { action: 'deny' }
  })

  await win.loadURL(url)
  return win
}

async function createTripoWebWindow({ url, show = true, title = 'Tripo Browser Session' }) {
  return createProviderWebWindow({
    partition: TRIPO_WEB_PARTITION,
    url,
    show,
    title
  })
}

async function inspectProviderWebSession({
  partition,
  loginUrl,
  workspaceUrl,
  title,
  readyPattern
}) {
  const sessionCookies = await getProviderWebSession(partition).cookies.get({})
  const win = await createProviderWebWindow({
    partition,
    url: workspaceUrl || loginUrl,
    show: false,
    title
  })

  try {
    await wait(3500)
    const snapshot = await win.webContents.executeJavaScript(`
      (() => {
        ${tripoInpageHelpers()}
        dismissTripoOverlays()
        const promptCandidates = queryAllDeep('textarea,[contenteditable="true"],input[type="text"],input:not([type])')
          .filter(visible)
          .filter((el) => {
            const hint = [el.placeholder, el.getAttribute('aria-label'), el.name, textOf(el.parentElement)]
              .filter(Boolean)
              .join(' ')
            return /ask anything|prompt|describe|what|3d|model|text|image|upload|type/i.test(hint) || el.tagName === 'TEXTAREA'
          })
        const buttonTexts = queryAllDeep('button,a,[role="button"]')
          .filter(visible)
          .map((el) => textOf(el))
          .filter(Boolean)
          .slice(0, 60)
        const bodyText = (document.body?.innerText || '').slice(0, 3000)
        const passwordInputs = queryAllDeep('input[type="password"]').length
        const path = location.pathname.replace(/\\/$/, '').toLowerCase()
        const onWorkspacePage = /^\\/workspace(\\/|$)/.test(path) || path === '/home'
        return {
          href: location.href,
          title: document.title,
          promptCandidates: promptCandidates.length,
          passwordInputs,
          buttonTexts,
          bodyText,
          onWorkspacePage
        }
      })()
    `)

    const loginDetected =
      snapshot.passwordInputs > 0 ||
      /sign up\/log in|log in|login|sign in|continue with google|continue with microsoft|continue with apple/i.test(
        snapshot.bodyText
      )

    const connected =
      !loginDetected &&
      (snapshot.onWorkspacePage ||
        snapshot.promptCandidates > 0 ||
        snapshot.buttonTexts.some((text) => readyPattern.test(text)))

    return {
      success: true,
      connected,
      loginDetected,
      cookieCount: sessionCookies.length,
      url: snapshot.href,
      title: snapshot.title,
      promptCandidates: snapshot.promptCandidates
    }
  } finally {
    win.destroy()
  }
}

async function inspectTripoWebSession(baseUrl, generateUrl) {
  return inspectProviderWebSession({
    partition: TRIPO_WEB_PARTITION,
    loginUrl: baseUrl,
    workspaceUrl: generateUrl || DEFAULT_TRIPO_WEB_GENERATE_URL,
    title: 'Tripo Session Check',
    readyPattern:
      /generate model|ask anything|workspace|hd model|smart mesh|text to 3d|image to 3d|best quality|create|multiview|upload image|new model/i
  })
}

async function inspectTripoAssetsSession(baseUrl) {
  const assetsUrl = getTripoHistoryUrlCandidates(baseUrl)[0]
  const sessionCookies = await getProviderWebSession(TRIPO_WEB_PARTITION).cookies.get({})
  const win = await createTripoWebWindow({
    url: assetsUrl,
    show: false,
    title: 'Tripo Assets Session Check'
  })

  try {
    await wait(4000)
    const snapshot = await win.webContents.executeJavaScript(`
      (() => {
        ${tripoInpageHelpers()}
        dismissTripoOverlays()
        const bodyText = (document.body?.innerText || '').slice(0, 4000)
        const passwordInputs = queryAllDeep('input[type="password"]').length
        const assetPath = location.pathname.replace(/\\/$/, '').toLowerCase()
        const onAssetsPage = assetPath === '/assets' || assetPath.endsWith('/assets')
        const myAssetsTab = queryAllDeep('button,[role="tab"],a,[role="link"]')
          .filter(visible)
          .some((el) => /^My Assets$/i.test(textOf(el)))
        const assetCards = queryAllDeep('a[href*="/3d-model/"], a[href*="/project/"], a[href*="/asset/"], a[href*="/model/"], img[src*="tripo"], [class*="asset"], [class*="model-card"]')
          .length
        return {
          href: location.href,
          title: document.title,
          passwordInputs,
          bodyText,
          onAssetsPage,
          myAssetsTab,
          assetCards
        }
      })()
    `)

    const loginDetected =
      snapshot.passwordInputs > 0 ||
      /sign up\/log in|log in|login|sign in|continue with google|continue with microsoft|continue with apple/i.test(
        snapshot.bodyText
      )

    const connected =
      !loginDetected &&
      snapshot.onAssetsPage &&
      (snapshot.myAssetsTab || snapshot.assetCards > 0 || /you have no assets at the moment/i.test(snapshot.bodyText))

    return {
      success: true,
      connected,
      loginDetected,
      cookieCount: sessionCookies.length,
      url: snapshot.href,
      title: snapshot.title,
      assetCards: snapshot.assetCards
    }
  } finally {
    win.destroy()
  }
}

async function inspectTripoWebSessionForSync(baseUrl, generateUrl) {
  const generateStatus = await inspectTripoWebSession(baseUrl, generateUrl)
  if (generateStatus.connected) return generateStatus
  const assetsStatus = await inspectTripoAssetsSession(baseUrl)
  if (assetsStatus.connected) {
    return {
      ...generateStatus,
      connected: true,
      loginDetected: false,
      url: assetsStatus.url || generateStatus.url,
      title: assetsStatus.title || generateStatus.title
    }
  }
  return {
    ...generateStatus,
    connected: false,
    loginDetected: generateStatus.loginDetected || assetsStatus.loginDetected
  }
}

async function openTripoStudioGenerationPanel(win) {
  const state = await win.webContents.executeJavaScript(`
    (() => {
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
      }
      const textOf = (el) => (el?.innerText || el?.textContent || el?.getAttribute('aria-label') || '').trim()

      if (/\\/workspace\\/generate/i.test(location.pathname)) {
        return { success: true, alreadyOpen: true, url: location.href }
      }

      const entry = Array.from(document.querySelectorAll('button,a,[role="button"],[role="link"]'))
        .filter(visible)
        .find((el) =>
          /^(generate model|generate hd model|generate smart mesh)$/i.test(textOf(el))
        )

      if (!entry) {
        return { success: false, error: 'Could not find a Tripo Studio generate entry button.' }
      }

      entry.click()
      return { success: true, button: textOf(entry), url: location.href }
    })()
  `)

  if (!state.success) return state
  await wait(state.alreadyOpen ? 250 : 2000)
  return state
}

async function navigateToTripoGenerateSurface(win, baseUrl, generateUrl) {
  const normalizedBaseUrl = normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL).replace(/\/$/, '')
  const candidates = Array.from(
    new Set([
      normalizeExternalUrl(generateUrl, DEFAULT_TRIPO_WEB_GENERATE_URL),
      `${normalizedBaseUrl}/workspace/generate`,
      `${normalizedBaseUrl}/assets`,
      `${normalizedBaseUrl}/workspace`
    ])
  )

  for (const url of candidates) {
    await win.loadURL(url)
    await wait(2500)

    await openTripoStudioGenerationPanel(win)
    await wait(1500)

    const found = await win.webContents.executeJavaScript(`
      (() => {
        ${tripoInpageHelpers()}
        dismissTripoOverlays()

        const promptCandidates = queryAllDeep('textarea,input[type="text"],[contenteditable="true"],input:not([type])')
          .filter(visible)
          .filter((el) => {
            const hint = [el.placeholder, el.getAttribute('aria-label'), el.name, textOf(el.parentElement)]
              .filter(Boolean)
              .join(' ')
            return /ask anything|prompt|describe|what|3d|model|text/i.test(hint) || el.tagName === 'TEXTAREA'
          })

        const submitButton = queryAllDeep('button,[role="button"]')
          .filter(visible)
          .find((el) => /^Generate Model(\\b|\\s|$|\\d)/i.test(textOf(el)))

        const onGeneratePage =
          /\\/workspace\\/generate/i.test(location.pathname) ||
          !!queryDeep('h1,h2,h3')?.innerText?.match(/generate model/i)

        if ((promptCandidates.length > 0 || submitButton) && (onGeneratePage || submitButton)) {
          return { found: true, url: location.href, title: document.title, promptCandidates: promptCandidates.length }
        }

        return { found: false, url: location.href, title: document.title, promptCandidates: promptCandidates.length }
      })()
    `)

    if (found.found) return { success: true, ...found }
  }

  return {
    success: false,
    error:
      'Could not open Tripo Studio generation. Connect your account, then try opening https://studio.tripo3d.ai/workspace/generate once in the browser session.'
  }
}

function isTripoMyAssetsListUrl(url) {
  try {
    const path = new URL(url).pathname.replace(/\/$/, '').toLowerCase()
    return path === '/assets' || path.endsWith('/assets')
  } catch {
    return false
  }
}

function getTripoHistoryUrlCandidates(baseUrl) {
  const normalizedBaseUrl = normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL).replace(/\/$/, '')
  const lastHistoryUrl = normalizeExternalUrl(
    loadConfig().tripoWebLastHistoryUrl,
    TRIPO_STUDIO_ASSETS_URL
  ).replace(/\/$/, '')

  return Array.from(
    new Set([
      TRIPO_STUDIO_ASSETS_URL,
      `${normalizedBaseUrl}/assets`,
      isTripoMyAssetsListUrl(lastHistoryUrl) && !isTripoGalleryUrl(lastHistoryUrl) ? lastHistoryUrl : null,
      `${normalizedBaseUrl}/app/assets`
    ].filter(Boolean))
  )
}

async function ensureTripoMyAssetsTab(win) {
  return win.webContents.executeJavaScript(`
    (() => {
      ${tripoInpageHelpers()}
      const myAssets = queryAllDeep('button,[role="tab"]')
        .filter(visible)
        .find((el) => /^My Assets$/i.test(textOf(el)))
      if (myAssets) {
        myAssets.click()
        return { clicked: true }
      }
      return { clicked: false }
    })()
  `)
}

function buildTripoDetailUrlFromId(id) {
  const value = String(id || '').trim()
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  if (/^[0-9a-f-]{36}$/i.test(value)) {
    return `https://studio.tripo3d.ai/3d-model/${value}`
  }
  return ''
}

function findTripoModelDownloadUrlsInPayload(data, results = [], seen = new Set()) {
  if (data == null) return results

  if (typeof data === 'string') {
    const value = data.trim()
    if (
      value &&
      /\.(glb|gltf|fbx|obj|stl)(\?|$)/i.test(value) &&
      /https?:\/\//i.test(value) &&
      !seen.has(value)
    ) {
      seen.add(value)
      results.push(value)
    }
    return results
  }

  if (Array.isArray(data)) {
    for (const item of data) findTripoModelDownloadUrlsInPayload(item, results, seen)
    return results
  }

  if (typeof data === 'object') {
    for (const value of Object.values(data)) findTripoModelDownloadUrlsInPayload(value, results, seen)
  }

  return results
}

function parseTripoModelUrlsFromNetworkPayloads(payloads = []) {
  const urls = []
  const seen = new Set()
  for (const entry of payloads) {
    for (const url of findTripoModelDownloadUrlsInPayload(entry.data)) {
      if (!seen.has(url)) {
        seen.add(url)
        urls.push(url)
      }
    }
  }
  return urls
}

function resolveTripoImportUrls({ tripoAssetId = null, detailUrl = '', downloadUrl = '' } = {}) {
  const normalizedId = normalizeTripoAssetId(tripoAssetId || detailUrl || downloadUrl)
  const resolvedDetail =
    detailUrl ||
    buildTripoDetailUrlFromId(normalizedId) ||
    buildTripoDetailUrlFromId(tripoAssetId) ||
    ''
  const resolvedDownload = downloadUrl || ''
  return {
    tripoAssetId: normalizedId || normalizeTripoAssetId(resolvedDetail || resolvedDownload),
    detailUrl: resolvedDetail,
    downloadUrl: resolvedDownload
  }
}

async function downloadTripoFileViaSession(url, destPath) {
  const normalizedUrl = normalizeExternalUrl(url)
  const ses = getProviderWebSession(TRIPO_WEB_PARTITION)
  const response = await net.fetch(normalizedUrl, { session: ses })
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }
  ensureDir(dirname(destPath))
  const buffer = Buffer.from(await response.arrayBuffer())
  writeFileSync(destPath, buffer)
  return destPath
}

async function tryDirectTripoDownloads(urls, outDir, preferredExt = 'glb') {
  const candidates = (urls || []).filter((url) => url && /\.(glb|gltf|fbx|obj|stl)(\?|$)/i.test(url))
  for (const url of candidates) {
    try {
      const ext = extname(String(url).split('?')[0]) || `.${preferredExt}`
      const destPath = join(outDir, `${Date.now()}_tripo${ext}`)
      await downloadTripoFileViaSession(url, destPath)
      return destPath
    } catch (err) {
      console.warn('[tripo-import] Direct download failed:', url, err.message)
    }
  }
  return null
}

async function waitForTripoGenerationComplete(win, timeoutMs = 300000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const state = await win.webContents.executeJavaScript(`
      (() => {
        ${tripoInpageHelpers()}
        dismissTripoOverlays()
        const bodyText = (document.body?.innerText || '').slice(0, 5000)
        const generating = /generating|processing|queued|in progress|creating your model|please wait/i.test(bodyText)
        const failed = /generation failed|task failed|something went wrong|error occurred/i.test(bodyText)
        const downloadBtn = queryAllDeep('button,a,[role="button"]')
          .filter(visible)
          .find((el) => /download|export|save model|get model|\\bglb\\b/i.test(textOf(el)))
        const complete =
          !!downloadBtn ||
          (/generation complete|model ready|your model is ready|view model|regenerate/i.test(bodyText) &&
            !generating)
        return {
          generating,
          complete,
          failed,
          downloadBtn: downloadBtn ? textOf(downloadBtn) : '',
          url: location.href
        }
      })()
    `)

    if (state.failed) {
      return { ready: false, failed: true, ...state }
    }
    if (state.complete && !state.generating) {
      return { ready: true, ...state }
    }

    await wait(3000)
  }

  return { ready: false, timedOut: true }
}

async function importTripoModelViaBrowser(win, outDir, { downloadUrl = '', preferredFormat = 'glb', timeoutMs = 120000 } = {}) {
  const downloadPromise = captureTripoWebDownload(win, outDir, timeoutMs)

  if (downloadUrl && /\.(glb|gltf|fbx|obj|stl)(\?|$)/i.test(downloadUrl)) {
    win.webContents.downloadURL(downloadUrl)
  } else {
    for (let attempt = 0; attempt < 60; attempt++) {
      const action = await triggerTripoWebDownload(win, preferredFormat)
      if (action.action === 'downloadURL' && action.url) {
        win.webContents.downloadURL(action.url)
        break
      }
      if (action.action === 'clicked' || action.action === 'format') {
        await wait(1500)
      } else {
        await wait(2000)
      }
    }
  }

  return downloadPromise
}

function extractTripoAssetsFromApiPayload(data, results = [], seen = new Set()) {
  if (!data || typeof data !== 'object') return results

  if (Array.isArray(data)) {
    for (const item of data) extractTripoAssetsFromApiPayload(item, results, seen)
    return results
  }

  const id = data.id || data.task_id || data.project_id || data.model_id || data.asset_id || data.uuid
  const name =
    data.name ||
    data.title ||
    data.model_name ||
    (typeof data.prompt === 'string' ? data.prompt.slice(0, 120) : '')
  const previewUrl =
    data.thumbnail ||
    data.thumbnail_url ||
    data.cover ||
    data.cover_url ||
    data.preview ||
    data.preview_url ||
    data.image ||
    data.image_url ||
    ''
  const detailUrl =
    data.detail_url ||
    data.detailUrl ||
    data.share_url ||
    data.shareUrl ||
    data.url ||
    data.model_url_page ||
    buildTripoDetailUrlFromId(id)
  const downloadUrl =
    data.download_url ||
    data.downloadUrl ||
    data.model_url ||
    data.modelUrl ||
    data.glb_url ||
    data.glbUrl ||
    data.file_url ||
    data.fileUrl ||
    ''

  if (id && (name || previewUrl || detailUrl || downloadUrl)) {
    const key = String(id)
    if (!seen.has(key)) {
      seen.add(key)
      const nestedDownloads = findTripoModelDownloadUrlsInPayload(data)
      results.push({
        id: key,
        name: name || 'Untitled Tripo Asset',
        prompt: typeof data.prompt === 'string' ? data.prompt : '',
        previewUrl: typeof previewUrl === 'string' ? previewUrl : '',
        detailUrl: typeof detailUrl === 'string' ? detailUrl : buildTripoDetailUrlFromId(id),
        downloadUrl:
          (typeof downloadUrl === 'string' && downloadUrl) || nestedDownloads[0] || '',
        actionTexts: []
      })
    }
  }

  for (const value of Object.values(data)) {
    if (value && typeof value === 'object') extractTripoAssetsFromApiPayload(value, results, seen)
  }
  return results
}

function attachTripoAssetsNetworkCapture(win) {
  const payloads = []
  const wc = win.webContents

  const onMessage = async (_event, method, params) => {
    if (method !== 'Network.responseReceived') return
    const responseUrl = params.response?.url || ''
    if (!/tripo3d\.ai/i.test(responseUrl)) return

    const mimeType = params.response.mimeType || ''
    const isTripoApiHost = /api\.tripo3d\.ai/i.test(responseUrl)
    const looksLikeJson = mimeType.includes('json') || mimeType.includes('text/plain') || isTripoApiHost
    if (!looksLikeJson) return

    const isStudioApiPath = /studio\.tripo3d\.ai.*\/api\//i.test(responseUrl)
    const hasAssetKeyword =
      /assets|projects|models|tasks|history|library|workspace|generation|studio|creation|collect|user|gallery|mine|owned/i.test(
        responseUrl
      )
    if (!isTripoApiHost && !isStudioApiPath && !hasAssetKeyword) return

    try {
      const body = await wc.debugger.sendCommand('Network.getResponseBody', {
        requestId: params.requestId
      })
      const text = body.base64Encoded ? Buffer.from(body.body, 'base64').toString('utf8') : body.body
      payloads.push({ url: responseUrl, data: JSON.parse(text) })
    } catch {
      // response body may be unavailable or not JSON
    }
  }

  try {
    if (!wc.debugger.isAttached()) wc.debugger.attach('1.3')
    wc.debugger.sendCommand('Network.enable')
    wc.debugger.on('message', onMessage)
  } catch (err) {
    console.warn('[tripo-sync] Network capture unavailable:', err.message)
    return { payloads, detach: () => {} }
  }

  return {
    payloads,
    detach: () => {
      try {
        wc.debugger.removeListener('message', onMessage)
        if (wc.debugger.isAttached()) wc.debugger.detach()
      } catch {
        // ignore detach errors
      }
    }
  }
}

function parseTripoAssetsFromNetworkPayloads(payloads = []) {
  const results = []
  const seen = new Set()
  for (const entry of payloads) {
    extractTripoAssetsFromApiPayload(entry.data, results, seen)
  }
  return results.filter(isValidTripoHistoryItem)
}

async function scrollTripoAssetsPage(win) {
  return win.webContents.executeJavaScript(`
    (() => {
      const scrollTarget = document.querySelector('main') || document.scrollingElement || document.body
      const maxScroll = Math.max(0, (scrollTarget?.scrollHeight || 0) - (scrollTarget?.clientHeight || 0))
      if (scrollTarget && maxScroll > 0) {
        scrollTarget.scrollTop = maxScroll
      }
      window.scrollTo(0, document.body.scrollHeight)
      return { maxScroll }
    })()
  `)
}

async function waitForTripoHistoryItems(win, timeoutMs = 8000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const scraped = await scrapeTripoHistoryItems(win)
    if (scraped.items?.length) return scraped
    await wait(400)
  }

  return scrapeTripoHistoryItems(win)
}

async function scrapeTripoHistoryItems(win) {
  return win.webContents.executeJavaScript(`
    (() => {
      ${tripoInpageHelpers()}
      dismissTripoOverlays()

      const absolute = (value) => {
        if (!value) return ''
        try {
          return new URL(value, location.href).href
        } catch {
          return ''
        }
      }

      const assetPath = location.pathname.replace(/\\/$/, '').toLowerCase()
      const onMyAssetsPage = assetPath === '/assets' || assetPath.endsWith('/assets')
      if (!onMyAssetsPage) {
        return {
          url: location.href,
          title: document.title,
          items: [],
          skipped: 'not-my-assets-page'
        }
      }

      const bodyText = (document.body?.innerText || '').replace(/\\s+/g, ' ')
      if (/you have no assets at the moment/i.test(bodyText)) {
        return { url: location.href, title: document.title, items: [], empty: true }
      }

      const isGalleryNoise = (title) => {
        if (!title || title.length < 2) return true
        const trimmed = title.trim()
        if (/^Number\\.\\d+$/i.test(trimmed)) return true
        if (/^\\d{1,4}$/.test(trimmed)) return true
        if (/^\\+?\\d+$/.test(trimmed)) return true
        if (/^@[\\w.-]+$/.test(trimmed)) return true
        if (/^anonymous\\d*$/i.test(trimmed)) return true
        if (/view model|feature my model|invite code|gallery|featured|explore|discover|trending|popular|filter|generate hd model|generate smart mesh/i.test(trimmed)) {
          return true
        }
        if (/^(all|character|vehicle|animal|architecture|furniture|props|weapon|clothing|machine|food|nature|abstract|smart mesh|untextured|textured|rigged)$/i.test(trimmed)) {
          return true
        }
        return false
      }

      const isPublicOrGalleryUrl = (href) => {
        if (!href || !/tripo3d\\.ai/i.test(href)) return true
        try {
          const assetPath = new URL(href).pathname.replace(/\\/$/, '').toLowerCase()
          if (!assetPath || assetPath === '/workspace' || assetPath === '/home' || assetPath === '/assets') return true
          if (/^\\/(explore|gallery|community|discover|trending|featured|workspace\\/generate)(\\/|$)/.test(assetPath)) {
            return true
          }
          if (/^\\/model\\//.test(assetPath)) return true
        } catch {}
        return false
      }

      const isLikelyAssetDetailUrl = (href) => {
        if (!href || !/tripo3d\\.ai/i.test(href) || isPublicOrGalleryUrl(href)) return false
        if (/\\.(glb|gltf|png|jpe?g|webp|svg)(\\?|$)/i.test(href)) return false
        try {
          const assetPath = new URL(href).pathname
          return (
            /\\/(project|asset|task|create)\\/[^/?#]+/i.test(assetPath) ||
            /\\/3d-model\\/[^/?#]+/i.test(assetPath) ||
            /\\/workspace\\/(project|create|texture-edit|generate)\\/[^/?#]+/i.test(assetPath) ||
            /\\/assets\\/[^/?#]+/i.test(assetPath) ||
            /[?&](task|project|id|model)=/i.test(href)
          )
        } catch {
          return false
        }
      }

      const hrefFromElement = (el) => {
        if (!el) return ''
        if (el.matches?.('a[href]')) return absolute(el.href)
        const anchor = el.querySelector?.('a[href]')
        if (anchor?.href) return absolute(anchor.href)
        for (const attr of ['data-href', 'data-url', 'data-link', 'data-model-id', 'data-project-id', 'data-id', 'href']) {
          const value = el.getAttribute?.(attr)
          if (!value) continue
          if (/^[0-9a-f-]{36}$/i.test(value)) return absolute('/3d-model/' + value)
          return absolute(value)
        }
        let node = el
        while (node && node !== document.body) {
          for (const attr of ['data-href', 'data-url', 'data-link', 'data-model-id', 'data-project-id', 'data-id']) {
            const value = node.getAttribute?.(attr)
            if (!value) continue
            if (/^[0-9a-f-]{36}$/i.test(value)) return absolute('/3d-model/' + value)
            return absolute(value)
          }
          node = node.parentElement
        }
        const onclick = el.getAttribute?.('onclick') || ''
        const onclickMatch = onclick.match(/https?:\\/\\/[^'\"\\s]+/i)
        if (onclickMatch?.[0]) return absolute(onclickMatch[0])
        return ''
      }

      const isLikelyPreviewImage = (img) => {
        if (!img?.src) return false
        const src = img.src.toLowerCase()
        if (src.startsWith('data:') || src.endsWith('.svg') || /logo|icon|avatar|favicon|sprite|badge|emoji/i.test(src)) {
          return false
        }
        const rect = img.getBoundingClientRect()
        return rect.width >= 72 && rect.height >= 72
      }

      const isInsideExcludedSection = (el) => {
        let node = el
        while (node && node !== document.body) {
          const heading = node.querySelector(':scope > h1,:scope > h2,:scope > h3,:scope > h4')
          const headingText = textOf(heading)
          if (
            headingText &&
            /^(featured|explore|gallery|community|discover|trending|popular|inspiration|spotlight|related models)/i.test(
              headingText.trim()
            )
          ) {
            return true
          }
          const sectionLabel = node.getAttribute?.('data-section') || node.getAttribute?.('data-testid') || ''
          if (/^(featured|explore|gallery|community|discover|trending|popular|spotlight|related)$/i.test(sectionLabel)) {
            return true
          }
          node = node.parentElement
        }
        return false
      }

      const getMyAssetsScope = () => {
        const myAssetsTab = queryAllDeep('button,[role="tab"]')
          .filter(visible)
          .find((el) => /^My Assets$/i.test(textOf(el)))
        if (myAssetsTab) {
          const panelId = myAssetsTab.getAttribute('aria-controls')
          if (panelId) {
            const panel = document.getElementById(panelId)
            if (panel) return panel
          }
        }
        return queryDeep('main') || document.body
      }

      const scopeRoot = getMyAssetsScope()
      const items = []
      const seen = new Set()

      const pushItem = (item) => {
        const key = item.detailUrl || item.downloadUrl || item.id
        if (!key || seen.has(key)) return
        if (isGalleryNoise(item.name) && !item.downloadUrl) return
        seen.add(key)
        items.push(item)
      }

      const buildFromCard = (card) => {
        if (!card || !visible(card) || isInsideExcludedSection(card)) return null

        const previewImage = Array.from(card.querySelectorAll('img')).find(isLikelyPreviewImage)
        const anchor = card.matches('a[href]') ? card : card.querySelector('a[href]')
        const titleNode = card.querySelector('h1,h2,h3,h4,[class*="title"],[data-testid*="title"],[data-title]')
        const cardText = textOf(card)
        const lines = cardText.split(/\\n+/).map((line) => line.trim()).filter(Boolean)
        const title =
          textOf(titleNode) ||
          previewImage?.alt ||
          lines.find((line) => line.length > 2 && line.length < 120 && !isGalleryNoise(line)) ||
          ''
        const prompt =
          lines.find((line) => line !== title && line.length > 8 && line.length < 240 && !isGalleryNoise(line)) ||
          ''
        const detailUrl = hrefFromElement(card) || hrefFromElement(anchor)
        const downloadUrl =
          Array.from(card.querySelectorAll('a[href]'))
            .map((link) => absolute(link.href))
            .find((href) => /\\.(glb|gltf)(\\?|$)/i.test(href)) || ''

        const validDetail = isLikelyAssetDetailUrl(detailUrl)
        const validDownload = /\\.(glb|gltf)(\\?|$)/i.test(downloadUrl)
        if (!validDetail && !validDownload) return null
        if (!previewImage && !validDownload && isGalleryNoise(title)) return null

        return {
          id: detailUrl || downloadUrl || [title, prompt, previewImage?.src || ''].join('|'),
          name: title || 'Untitled Tripo Asset',
          prompt,
          previewUrl: previewImage?.src || '',
          detailUrl: validDetail ? detailUrl : '',
          downloadUrl,
          actionTexts: []
        }
      }

      queryAllDeep('a[href]', scopeRoot)
        .filter(visible)
        .filter((link) => !isInsideExcludedSection(link))
        .filter((link) => isLikelyAssetDetailUrl(absolute(link.href)))
        .forEach((link) => {
          const card = link.closest('article,li,[role="listitem"],div,section') || link
          const item = buildFromCard(card)
          if (item) pushItem(item)
        })

      queryAllDeep('img', scopeRoot)
        .filter(visible)
        .filter(isLikelyPreviewImage)
        .filter((img) => !isInsideExcludedSection(img))
        .forEach((img) => {
          const card =
            img.closest('article,li,[role="listitem"],a,[class*="card"],[data-testid*="asset"]') ||
            img.parentElement
          const item = buildFromCard(card)
          if (item) pushItem(item)
        })

      queryAllDeep('[class*="card"],[data-testid*="asset"],article,li,[role="listitem"]', scopeRoot)
        .filter(visible)
        .filter((el) => !isInsideExcludedSection(el))
        .forEach((card) => {
          const item = buildFromCard(card)
          if (item) pushItem(item)
        })

      const bodyTextForIds = (document.body?.innerHTML || '').slice(0, 500000)
      const embeddedModelIds = Array.from(
        bodyTextForIds.matchAll(/\\/3d-model\\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi)
      ).map((match) => match[1])
      embeddedModelIds.forEach((modelId) => {
        pushItem({
          id: modelId,
          name: 'Tripo Asset',
          prompt: '',
          previewUrl: '',
          detailUrl: absolute('/3d-model/' + modelId),
          downloadUrl: '',
          actionTexts: []
        })
      })

      return {
        url: location.href,
        title: document.title,
        items: items.slice(0, 40),
        debug: {
          scopeTag: scopeRoot?.tagName || '',
          linkCount: scopeRoot.querySelectorAll('a[href]').length,
          modelLinks: Array.from(scopeRoot.querySelectorAll('a[href]'))
            .map((link) => absolute(link.href))
            .filter((href) => /\\/3d-model\\//i.test(href)).length
        }
      }
    })()
  `)
}

async function clickTripoHistoryNavigation(win) {
  return win.webContents.executeJavaScript(`
    (() => {
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
      }

      const textOf = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim()
      const target = Array.from(document.querySelectorAll('a[href],button,[role="button"]'))
        .filter(visible)
        .find((el) => {
          const text = textOf(el)
          return /history|my creations?|creations?|assets?|library|models?/i.test(text) &&
            !/download|export|import/i.test(text)
        })

      if (!target) return { clicked: false }
      target.click()
      return { clicked: true, text: textOf(target) }
    })()
  `)
}

async function listTripoHistoryItems(baseUrl, generateUrl) {
  const status = await inspectTripoWebSessionForSync(baseUrl, generateUrl)
  if (!status.connected) {
    return {
      success: false,
      error: status.loginDetected
        ? 'Tripo login required. Open Connect Account in Settings or Modeling, sign in, then try Sync My Assets again.'
        : 'No active Tripo website session was detected. Connect your account and make sure the session is ready first.'
    }
  }

  let win = null
  let networkCapture = null
  try {
    const candidates = getTripoHistoryUrlCandidates(baseUrl)
    win = await createTripoWebWindow({
      url: 'about:blank',
      show: false,
      title: 'Tripo My Assets Sync'
    })
    networkCapture = attachTripoAssetsNetworkCapture(win)

    let scraped = { items: [], url: '', title: '', skipped: null }
    for (const assetsUrl of candidates) {
      await win.loadURL(assetsUrl)
      await wait(3000)
      const tabResult = await ensureTripoMyAssetsTab(win)
      console.log('[tripo-sync] My Assets tab:', tabResult, 'url:', assetsUrl)
      await wait(1200)
      await scrollTripoAssetsPage(win)
      await wait(1000)
      await scrollTripoAssetsPage(win)
      await wait(750)

      scraped = await waitForTripoHistoryItems(win, 8000)
      if (scraped.skipped === 'not-my-assets-page') continue
      if (scraped.items?.length || scraped.empty) break

      const nav = await clickTripoHistoryNavigation(win)
      if (nav.clicked) {
        await wait(1500)
        scraped = await waitForTripoHistoryItems(win, 5000)
        if (scraped.items?.length || scraped.empty) break
      }
    }

    const networkItems = parseTripoAssetsFromNetworkPayloads(networkCapture.payloads)
    const combinedByKey = new Map()

    for (const item of [...(scraped.items || []), ...networkItems]) {
      const key = item.detailUrl || item.downloadUrl || item.id
      if (!key) continue
      combinedByKey.set(key, { ...combinedByKey.get(key), ...item })
    }

    const filteredItems = Array.from(combinedByKey.values()).filter(isValidTripoHistoryItem)

    console.log('[tripo-sync] Scrape result:', {
      url: scraped.url,
      skipped: scraped.skipped,
      empty: scraped.empty,
      domItems: scraped.items?.length || 0,
      networkPayloads: networkCapture.payloads.length,
      networkUrls: networkCapture.payloads.slice(0, 12).map((entry) => entry.url),
      networkItems: networkItems.length,
      validItems: filteredItems.length,
      debug: scraped.debug
    })

    if (scraped.skipped === 'not-my-assets-page' && !networkItems.length) {
      return {
        success: false,
        error:
          'Tripo History sync must use My Assets (studio.tripo3d.ai/assets), not the public workspace gallery.'
      }
    }

    saveConfig({ ...loadConfig(), tripoWebLastHistoryUrl: scraped.url || TRIPO_STUDIO_ASSETS_URL })

    const cachedBeforeMerge = getTripoSyncedAssets().length
    const merged = mergeTripoSyncedAssets(filteredItems)

    if (!filteredItems.length) {
      const keptCache = cachedBeforeMerge > 0 && merged.length > 0
      return {
        success: true,
        items: merged.map(syncedAssetToHistoryItem),
        sourceUrl: scraped.url || TRIPO_STUDIO_ASSETS_URL,
        title: scraped.title,
        message: keptCache
          ? `Sync found no new assets; showing ${merged.length} cached asset${merged.length === 1 ? '' : 's'}.`
          : 'No models found in your Tripo My Assets library.'
      }
    }

    return {
      success: true,
      items: merged.map(syncedAssetToHistoryItem),
      sourceUrl: scraped.url,
      title: scraped.title
    }
  } finally {
    networkCapture?.detach()
    if (win) win.destroy()
  }
}

async function importTripoHistoryItem({
  detailUrl,
  downloadUrl,
  name = '',
  prompt = '',
  sourceTab = null,
  tripoAssetId = null,
  previewUrl = null
}) {
  const outDir = getWorkspaceModelDir()
  ensureDir(outDir)

  const resolved = resolveTripoImportUrls({ tripoAssetId, detailUrl, downloadUrl })
  detailUrl = resolved.detailUrl
  downloadUrl = resolved.downloadUrl
  tripoAssetId = resolved.tripoAssetId

  let win = null
  let networkCapture = null

  try {
    if (!detailUrl && !downloadUrl) {
      return { success: false, error: 'History item is missing a Tripo URL to import from.' }
    }

    if (
      (detailUrl && !isTripoUserAssetUrl(detailUrl) && !/\.(glb|gltf)(\?|$)/i.test(downloadUrl)) ||
      (downloadUrl && isTripoPublicOrGalleryUrl(downloadUrl) && !/\.(glb|gltf)(\?|$)/i.test(downloadUrl))
    ) {
      return {
        success: false,
        error: 'This item looks like a public gallery asset, not one of your Tripo My Assets.'
      }
    }

    const directPath = await tryDirectTripoDownloads([downloadUrl], outDir)
    if (directPath) {
      const item = persistGeneratedModel({
        sourcePath: directPath,
        name,
        prompt,
        provider: 'tripo-history',
        sourceTab,
        tripoAssetId,
        detailUrl: detailUrl || null,
        previewUrl: previewUrl || null
      })
      return { success: true, item }
    }

    const targetUrl = downloadUrl || detailUrl
    win = await createTripoWebWindow({
      url: 'about:blank',
      show: false,
      title: 'Tripo History Import'
    })
    networkCapture = attachTripoAssetsNetworkCapture(win)
    await win.loadURL(targetUrl)
    await wait(3500)

    const networkUrls = parseTripoModelUrlsFromNetworkPayloads(networkCapture.payloads)
    const networkDirectPath = await tryDirectTripoDownloads([downloadUrl, ...networkUrls], outDir)
    if (networkDirectPath) {
      const item = persistGeneratedModel({
        sourcePath: networkDirectPath,
        name,
        prompt,
        provider: 'tripo-history',
        sourceTab,
        tripoAssetId,
        detailUrl: detailUrl || null,
        previewUrl: previewUrl || null
      })
      return { success: true, item }
    }

    const tempOutputPath = await importTripoModelViaBrowser(win, outDir, { downloadUrl })
    const item = persistGeneratedModel({
      sourcePath: tempOutputPath,
      name,
      prompt,
      provider: 'tripo-history',
      sourceTab,
      tripoAssetId,
      detailUrl: detailUrl || null,
      previewUrl: previewUrl || null
    })
    return { success: true, item }
  } catch (err) {
    return { success: false, error: err.message || 'Could not import the selected Tripo history asset.' }
  } finally {
    networkCapture?.detach()
    if (win) win.destroy()
  }
}

async function importTripoSyncedAssetById(
  assetId,
  { name = '', prompt = '', sourceTab = null, detailUrl = '', downloadUrl = '' } = {}
) {
  const id = normalizeTripoAssetId(assetId)
  let entry = getTripoSyncedAssets().find((item) => item.id === id)

  if (!entry && id) {
    const builtDetail = buildTripoDetailUrlFromId(id)
    if (builtDetail || detailUrl || downloadUrl) {
      entry = {
        id,
        name: name || 'Tripo Asset',
        detailUrl: detailUrl || builtDetail || '',
        downloadUrl: downloadUrl || '',
        previewUrl: '',
        localPath: null
      }
    }
  }

  if (!entry) {
    return importTripoHistoryItem({
      detailUrl: detailUrl || buildTripoDetailUrlFromId(assetId),
      downloadUrl,
      name,
      prompt,
      sourceTab,
      tripoAssetId: id || normalizeTripoAssetId(detailUrl || downloadUrl)
    })
  }

  if (!isValidTripoSyncedAssetEntry(entry)) {
    return {
      success: false,
      error: 'This cached Tripo asset looks like a public gallery entry. Sync My Assets again.'
    }
  }

  if (entry.localPath && existsSync(entry.localPath)) {
    return {
      success: true,
      cached: true,
      item: buildGeneratedModelItem(entry.localPath, {
        name: name || entry.name,
        prompt,
        provider: 'tripo-history',
        sourceTab
      })
    }
  }

  return importTripoHistoryItem({
    detailUrl: entry.detailUrl,
    downloadUrl: entry.downloadUrl,
    name: name || entry.name,
    prompt,
    sourceTab,
    tripoAssetId: entry.id,
    previewUrl: entry.previewUrl
  })
}

async function configureTripoWebGenerationOptions(
  win,
  { modelVersion = 'v3.1-20260211', style = null, texture = true, pbr = true, smartLowPoly = false } = {}
) {
  return win.webContents.executeJavaScript(`
    ((opts) => {
      ${tripoInpageHelpers()}
      dismissTripoOverlays()
      const results = { applied: [], skipped: [] }

      const versionPatterns = {
        'v3.1-20260211': /v?3\\.1|best quality|latest/i,
        'v3.0-20250421': /v?3\\.0|quality/i,
        'v2.5-20250123': /v?2\\.5/i,
        'v2.0-20240919': /v?2\\.0|\\bfast\\b/i
      }
      const versionPattern = versionPatterns[opts.modelVersion] || new RegExp(opts.modelVersion, 'i')

      const clickMatch = (elements, pattern) => {
        const match = elements.find((el) => pattern.test(textOf(el)))
        if (match) {
          match.click()
          return true
        }
        return false
      }

      const meshMode = opts.smartLowPoly ? /^Smart Mesh$/i : /^HD Model$/i
      const meshTargets = queryAllDeep('button,[role="button"],[role="tab"],label,span,div').filter(visible)
      if (clickMatch(meshTargets, meshMode)) results.applied.push('smartLowPoly')
      else results.skipped.push('smartLowPoly')

      const selects = queryAllDeep('select').filter(visible)
      let versionSet = false
      for (const select of selects) {
        const options = Array.from(select.options || [])
        const match = options.find((option) => versionPattern.test(option.text || option.value || ''))
        if (match) {
          select.value = match.value
          select.dispatchEvent(new Event('change', { bubbles: true }))
          versionSet = true
          break
        }
      }
      if (!versionSet) {
        const versionButton = queryAllDeep('button,[role="combobox"],[role="option"],[role="menuitem"],[role="tab"],label,span,div')
          .filter(visible)
          .find((el) => versionPattern.test(textOf(el)))
        if (versionButton) {
          versionButton.click()
          versionSet = true
        }
      }
      if (versionSet) results.applied.push('modelVersion')
      else results.skipped.push('modelVersion')

      if (opts.style) {
        const stylePattern = new RegExp(opts.style.replace(/-/g, '[\\\\s-]?'), 'i')
        const styleTargets = queryAllDeep('button,[role="option"],[role="menuitem"],option,label,span,div').filter(visible)
        if (clickMatch(styleTargets, stylePattern)) results.applied.push('style')
        else results.skipped.push('style')
      }

      const setToggle = (labelPattern, desired) => {
        const candidates = queryAllDeep('button,[role="switch"],input[type="checkbox"],label,span,div')
          .filter(visible)
          .filter((el) => labelPattern.test(textOf(el) + ' ' + (el.getAttribute('aria-label') || '')))

        for (const el of candidates) {
          const checkbox = el.matches('input[type="checkbox"]')
            ? el
            : el.querySelector('input[type="checkbox"]')
          const pressed = el.getAttribute('aria-checked') ?? el.getAttribute('aria-pressed')
          let isOn = false
          if (checkbox) isOn = checkbox.checked
          else if (pressed != null) isOn = pressed === 'true'
          else if (/active|selected|enabled|checked|on/i.test(el.className || '')) isOn = true

          if (isOn !== desired) {
            el.click()
            if (checkbox) checkbox.click()
          }
          return true
        }
        return false
      }

      if (setToggle(/texture/i, !!opts.texture)) results.applied.push('texture')
      else results.skipped.push('texture')

      if (setToggle(/\\bpbr\\b|physically[- ]based/i, !!opts.pbr)) results.applied.push('pbr')
      else results.skipped.push('pbr')

      return { success: true, results }
    })(${JSON.stringify({ modelVersion, style, texture, pbr, smartLowPoly })})
  `)
}

function imagePathToUploadPayload(imagePath) {
  const ext = extname(imagePath).toLowerCase()
  const mime =
    { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }[
      ext
    ] || 'image/png'
  const data = readFileSync(imagePath)
  return {
    dataUrl: `data:${mime};base64,${data.toString('base64')}`,
    fileName: basename(imagePath)
  }
}

async function openTripoImageUploadMode(win, multiview = false) {
  await win.webContents.executeJavaScript(`
    ((multiview) => {
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
      }
      const textOf = (el) => (el?.innerText || el?.textContent || el?.getAttribute('aria-label') || '').trim()

      const imageTab = Array.from(document.querySelectorAll('a,button,[role="tab"],[role="link"]'))
        .filter(visible)
        .find((el) => /^Image$/i.test(textOf(el)))

      if (imageTab) {
        imageTab.click()
        return
      }

      const multiviewTab = Array.from(document.querySelectorAll('button,a,[role="tab"],label,span,div'))
        .filter(visible)
        .find((el) =>
          multiview
            ? /multi[\\s-]?view|4[\\s-]?view|four[\\s-]?view|multiview|multiple views/i.test(textOf(el))
            : /image[\\s-]?to[\\s-]?3d|from image|upload image|image upload|single image/i.test(textOf(el))
        )
      if (multiviewTab) multiviewTab.click()
    })(${multiview ? 'true' : 'false'})
  `)
  await wait(750)
}

async function uploadTripoImageToSlot(win, imagePath, slot = null) {
  const { dataUrl, fileName } = imagePathToUploadPayload(imagePath)
  const slotPatterns = {
    front: /front|face|forward/i,
    back: /back|rear|behind/i,
    left: /left/i,
    right: /right/i
  }
  const slotPattern = slot ? slotPatterns[slot] : null

  return win.webContents.executeJavaScript(`
    (async (dataUrl, fileName, slotPatternSource) => {
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
      }
      const textOf = (el) =>
        (el?.innerText || el?.textContent || el?.getAttribute('aria-label') || el?.title || '').trim()
      const slotPattern = slotPatternSource ? new RegExp(slotPatternSource, 'i') : null

      const findInputForSlot = () => {
        if (slotPattern) {
          const candidates = Array.from(
            document.querySelectorAll('div,section,article,li,label,button,fieldset')
          ).filter(visible)

          for (const container of candidates) {
            const labelText = textOf(container) + ' ' + (container.getAttribute('aria-label') || '')
            if (!slotPattern.test(labelText)) continue
            const input =
              container.querySelector('input[type="file"]') ||
              container.parentElement?.querySelector('input[type="file"]')
            if (input) return input
          }
        }

        const inputs = Array.from(document.querySelectorAll('input[type="file"]')).filter(visible)
        return inputs[0] || null
      }

      let input = findInputForSlot()
      if (!input) {
        const uploadTrigger = Array.from(document.querySelectorAll('button,label,[role="button"],div'))
          .filter(visible)
          .find((el) => {
            const text = textOf(el)
            if (slotPattern && !slotPattern.test(text + ' ' + (el.getAttribute('aria-label') || ''))) {
              return false
            }
            return /upload|choose file|select image|drop image|browse|add image/i.test(text)
          })
        if (uploadTrigger) uploadTrigger.click()
        await new Promise((resolve) => setTimeout(resolve, 400))
        input = findInputForSlot()
      }

      if (!input) {
        return {
          success: false,
          error: slotPatternSource
            ? \`Could not find an upload slot for the \${slotPatternSource} view on the Tripo page.\`
            : 'Could not find an image upload control on the Tripo page.'
        }
      }

      const response = await fetch(dataUrl)
      const blob = await response.blob()
      const file = new File([blob], fileName, { type: blob.type || 'image/png' })
      const transfer = new DataTransfer()
      transfer.items.add(file)
      input.files = transfer.files
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return { success: true, slot: slotPatternSource || 'default' }
    })(${JSON.stringify(dataUrl)}, ${JSON.stringify(fileName)}, ${JSON.stringify(slotPattern?.source || null)})
  `)
}

async function uploadTripoReferenceImage(win, imagePath) {
  await openTripoImageUploadMode(win, false)
  return uploadTripoImageToSlot(win, imagePath, 'front')
}

async function uploadTripoMultiviewReferenceImages(win, imagePaths = {}) {
  await openTripoImageUploadMode(win, true)

  const slotOrder = ['front', 'back', 'left', 'right']
  const uploaded = []

  for (const slot of slotOrder) {
    const imagePath = String(imagePaths[slot] || '').trim()
    if (!imagePath) continue

    const upload = await uploadTripoImageToSlot(win, imagePath, slot)
    if (!upload.success) return upload
    uploaded.push(slot)
    await wait(600)
  }

  if (!uploaded.length) {
    return { success: false, error: 'No reference images were provided for multiview upload.' }
  }

  return { success: true, uploaded }
}

async function submitTripoWebPrompt(win, prompt) {
  return win.webContents.executeJavaScript(`
    ((promptText) => {
      ${tripoInpageHelpers()}
      dismissTripoOverlays()

      const promptTargets = queryAllDeep('textarea,input[type="text"],[contenteditable="true"],input:not([type])')
        .filter(visible)
        .filter((el) => {
          const hint = [el.placeholder, el.getAttribute('aria-label'), el.name, textOf(el.parentElement)]
            .filter(Boolean)
            .join(' ')
          return /ask anything|prompt|describe|what|3d|model|text/i.test(hint) || el.tagName === 'TEXTAREA'
        })
        .sort((a, b) => {
          const aScore = /ask anything/i.test(a.placeholder || a.getAttribute('aria-label') || '') ? 1 : 0
          const bScore = /ask anything/i.test(b.placeholder || b.getAttribute('aria-label') || '') ? 1 : 0
          return bScore - aScore || (b.tagName === 'TEXTAREA') - (a.tagName === 'TEXTAREA')
        })

      const target = promptTargets[0]
      if (target && promptText) {
        if (target.isContentEditable) {
          target.focus()
          document.execCommand('selectAll', false, null)
          document.execCommand('insertText', false, promptText)
        } else {
          const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value') ||
            Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')
          if (proto?.set) proto.set.call(target, promptText)
          else target.value = promptText
          target.focus()
          target.dispatchEvent(new InputEvent('input', { bubbles: true, data: promptText, inputType: 'insertText' }))
          target.dispatchEvent(new Event('change', { bubbles: true }))
        }
      } else if (promptText) {
        return { success: false, error: 'No visible prompt input was found on the Tripo Studio generate page.' }
      }

      const buttons = queryAllDeep('button,a,[role="button"]').filter(visible)
      const action = buttons.find((el) => {
        const text = textOf(el)
        return /^Generate Model(\\b|\\s|$|\\d)/i.test(text)
      }) || buttons.find((el) => {
        const text = textOf(el)
        return /generate|create|start|run/i.test(text) &&
          !/generate hd model|generate smart mesh|log in|sign in|download|export|gallery|feature my model|start free/i.test(text)
      })

      if (!action) {
        return {
          success: false,
          error: target
            ? 'Filled the prompt, but could not find the Tripo Studio Generate Model button.'
            : 'Could not find the Tripo Studio Generate Model button.'
        }
      }

      action.click()
      return { success: true, button: textOf(action) }
    })(${JSON.stringify(prompt)})
  `)
}

function captureTripoWebDownload(win, outDir, timeoutMs = 300000) {
  const ses = win.webContents.session
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ses.removeListener('will-download', onDownload)
      reject(new Error('Timed out waiting for Tripo to offer a downloadable model file.'))
    }, timeoutMs)

    function onDownload(event, item) {
      const rawName = item.getFilename() || 'tripo_web_model.glb'
      const safeName = rawName.replace(/[<>:"/\\\\|?*]+/g, '_')
      const outputPath = join(outDir, `${Date.now()}_${safeName}`)
      item.setSavePath(outputPath)
      item.once('done', (_e, state) => {
        clearTimeout(timer)
        ses.removeListener('will-download', onDownload)
        if (state === 'completed') resolve(outputPath)
        else reject(new Error(`Download failed: ${state}`))
      })
    }

    ses.on('will-download', onDownload)
  })
}

async function inspectElevenLabsWebSession(loginUrl, imageUrl) {
  return inspectProviderWebSession({
    partition: ELEVENLABS_WEB_PARTITION,
    loginUrl,
    workspaceUrl: imageUrl || DEFAULT_ELEVENLABS_WEB_IMAGE_URL,
    title: 'ElevenLabs Session Check',
    readyPattern: /generate|image|video|create|prompt|eleven creative|text to/i
  })
}

async function submitElevenLabsWebPrompt(win, prompt) {
  const encodedPrompt = JSON.stringify(prompt)
  return win.webContents.executeJavaScript(`
    (() => {
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
      }
      const textOf = (el) => (el?.innerText || el?.textContent || el?.getAttribute('aria-label') || '').trim()

      const promptField = Array.from(
        document.querySelectorAll('textarea,[contenteditable="true"],input[type="text"],input:not([type])')
      )
        .filter(visible)
        .find((el) => {
          if (el.readOnly || el.disabled) return false
          const hint = [el.placeholder, el.getAttribute('aria-label'), el.name, textOf(el.parentElement)]
            .filter(Boolean)
            .join(' ')
          return /prompt|describe|what|image|create|generate|idea|vision/i.test(hint) || el.tagName === 'TEXTAREA'
        })

      if (!promptField) {
        return { success: false, error: 'Could not find an ElevenLabs image prompt field.' }
      }

      promptField.focus()
      if (promptField.isContentEditable) {
        promptField.textContent = ${encodedPrompt}
        promptField.dispatchEvent(new InputEvent('input', { bubbles: true }))
      } else {
        const setter =
          Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ||
          Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
        if (setter) setter.call(promptField, ${encodedPrompt})
        else promptField.value = ${encodedPrompt}
        promptField.dispatchEvent(new Event('input', { bubbles: true }))
        promptField.dispatchEvent(new Event('change', { bubbles: true }))
      }

      const generateButton = Array.from(document.querySelectorAll('button,[role="button"]'))
        .filter(visible)
        .find((el) =>
          /^(generate|create|make|run)(\\b|\\s|$)/i.test(textOf(el)) ||
          /generate image|create image|generate video|create video/i.test(textOf(el))
        )

      if (generateButton) {
        generateButton.click()
        return { success: true, submitted: true, button: textOf(generateButton) }
      }

      return {
        success: true,
        submitted: false,
        warning: 'Prompt filled, but no generate button was found. Click Generate manually in the browser.'
      }
    })()
  `)
}

function captureElevenLabsWebDownload(win, outDir, timeoutMs = 180000) {
  const ses = win.webContents.session
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ses.removeListener('will-download', onDownload)
      reject(new Error('Timed out waiting for ElevenLabs to offer a downloadable image.'))
    }, timeoutMs)

    function onDownload(_event, item) {
      const rawName = item.getFilename() || 'elevenlabs_image.png'
      const safeName = rawName.replace(/[<>:"/\\\\|?*]+/g, '_')
      const outputPath = join(outDir, `${Date.now()}_${safeName}`)
      item.setSavePath(outputPath)
      item.once('done', (_e, state) => {
        clearTimeout(timer)
        ses.removeListener('will-download', onDownload)
        if (state === 'completed') resolve(outputPath)
        else reject(new Error(`Download failed: ${state}`))
      })
    }

    ses.on('will-download', onDownload)
  })
}

async function scrapeElevenLabsGeneratedImage(win, outDir) {
  const result = await win.webContents.executeJavaScript(`
    (async () => {
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
      }

      const imgs = Array.from(document.querySelectorAll('img'))
        .filter(visible)
        .filter((img) => {
          const src = img.currentSrc || img.src || ''
          return src && !/logo|avatar|icon|favicon|placeholder/i.test(src) && img.naturalWidth >= 128
        })
        .sort(
          (a, b) =>
            b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight ||
            b.naturalWidth - a.naturalWidth
        )

      const img = imgs[0]
      if (!img?.src) return { success: false, error: 'No generated image found on the page yet.' }

      try {
        const response = await fetch(img.currentSrc || img.src)
        const blob = await response.blob()
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })
        return { success: true, dataUrl, width: img.naturalWidth, height: img.naturalHeight }
      } catch (err) {
        return { success: false, error: err?.message || 'Could not read generated image from page.' }
      }
    })()
  `)

  if (!result?.success || !result.dataUrl) {
    return { success: false, error: result?.error || 'Could not scrape generated image from ElevenLabs.' }
  }

  const base64 = String(result.dataUrl).split(',')[1]
  if (!base64) {
    return { success: false, error: 'Generated image data was empty.' }
  }

  const outputPath = join(outDir, `elevenlabs_${Date.now()}.png`)
  writeFileSync(outputPath, Buffer.from(base64, 'base64'))
  return { success: true, outputPath }
}

async function triggerTripoWebDownload(win, preferredFormat = 'glb') {
  return win.webContents.executeJavaScript(`
    ((fmt) => {
      ${tripoInpageHelpers()}
      dismissTripoOverlays()

      const directLink = queryAllDeep('a[href]')
        .filter(visible)
        .find((el) => new RegExp('\\\\.' + fmt + '(\\\\?|$)', 'i').test(el.href) || /\\.(glb|gltf)(\\?|$)/i.test(el.href))

      if (directLink?.href) {
        return { action: 'downloadURL', url: directLink.href, label: textOf(directLink) }
      }

      if (fmt !== 'glb') {
        const fmtRe = new RegExp('^' + fmt + '$', 'i')
        const fmtBtn = queryAllDeep('button,a,[role="button"],li,[role="option"],[role="menuitem"]')
          .filter(visible)
          .find((el) => fmtRe.test(textOf(el).split(/[\\s/|,]/)[0]))
        if (fmtBtn) {
          fmtBtn.click()
          return { action: 'format', format: textOf(fmtBtn) }
        }
      }

      const exportButton = queryAllDeep('button,a,[role="button"],[role="menuitem"]')
        .filter(visible)
        .find((el) => /^(export|download|save)(\\b|\\s|$)/i.test(textOf(el)) || /download model|export model|save model/i.test(textOf(el)))

      if (exportButton) {
        exportButton.click()
        return { action: 'clicked', label: textOf(exportButton) }
      }

      const buttons = queryAllDeep('button,a,[role="button"]').filter(visible)
      const clickTarget = buttons.find((el) => /download|export|\\bglb\\b/i.test(textOf(el)))
      if (clickTarget) {
        clickTarget.click()
        return { action: 'clicked', label: textOf(clickTarget) }
      }

      return { action: 'none' }
    })(${JSON.stringify(preferredFormat)})
  `)
}

// ── Tripo image-to-3D: attach a reference image via CDP ──────────────────

async function uploadImageToTripoWebPage(win, imagePath) {
  // Step 1: try to reveal the file input by clicking any upload-related area
  const preClick = await win.webContents.executeJavaScript(`
    (() => {
      const visible = (el) => {
        if (!el) return false
        const s = window.getComputedStyle(el)
        const r = el.getBoundingClientRect()
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 4 && r.height > 4
      }
      // Direct visible file input
      const direct = Array.from(document.querySelectorAll('input[type="file"]')).find(el =>
        !el.accept || el.accept.includes('image') || el.accept === '*' || el.accept === 'image/*'
      )
      if (direct) { window.__tripoImgInput = direct; return 'found' }
      // Upload trigger button
      const trigger = Array.from(document.querySelectorAll('button,[role="button"],[class*="upload"],[class*="Upload"]'))
        .filter(visible)
        .find(el => /upload|image|photo|picture/i.test((el.innerText || el.textContent || el.className || '')))
      if (trigger) { trigger.click(); return 'clicked' }
      return 'none'
    })()
  `)

  if (preClick === 'clicked') await wait(1200)

  // Step 2: grab first available file input (may now be visible after click)
  await win.webContents.executeJavaScript(`
    (() => {
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'))
      const pick = inputs.find(el => !el.accept || el.accept.includes('image') || el.accept === '*' || el.accept === 'image/*') || inputs[0]
      if (pick) window.__tripoImgInput = pick
    })()
  `)

  // Step 3: use CDP DOM.setFileInputFiles to inject the local file path
  let dbg = null
  try {
    dbg = win.webContents.debugger
    if (!dbg.isAttached()) dbg.attach('1.3')

    const evalRes = await dbg.sendCommand('Runtime.evaluate', {
      expression: 'window.__tripoImgInput',
      returnByValue: false
    })
    if (!evalRes.result?.objectId) {
      return { success: false, error: 'No image file input found on the Tripo page. Switch to the Image-to-3D tab manually and retry.' }
    }

    const nodeRes = await dbg.sendCommand('DOM.requestNode', { objectId: evalRes.result.objectId })
    await dbg.sendCommand('DOM.setFileInputFiles', { files: [imagePath], nodeId: nodeRes.nodeId })

    // Dispatch events so the framework reacts
    await win.webContents.executeJavaScript(`
      (() => {
        const inp = window.__tripoImgInput
        if (!inp) return
        inp.dispatchEvent(new Event('change', { bubbles: true }))
        inp.dispatchEvent(new Event('input', { bubbles: true }))
      })()
    `)

    return { success: true }
  } catch (err) {
    return { success: false, error: `Image injection failed: ${err.message}` }
  } finally {
    if (dbg?.isAttached()) {
      try { dbg.detach() } catch { /* ignore */ }
    }
  }
}

// ── Tripo multiview: upload 2–4 angle images via CDP ─────────────────────

async function uploadMultiviewImagesToTripoWebPage(win, imagePaths) {
  const validPaths = (imagePaths || []).filter(Boolean)
  if (!validPaths.length) return { success: false, error: 'No images provided for multiview.' }

  // Try to click the multiview tab on the Tripo page
  await win.webContents.executeJavaScript(`
    (() => {
      const visible = (el) => {
        if (!el) return false
        const s = window.getComputedStyle(el)
        const r = el.getBoundingClientRect()
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 4 && r.height > 4
      }
      const el = Array.from(document.querySelectorAll('button,[role="tab"],[role="button"],li'))
        .filter(visible)
        .find(e => /multi.?view|multiple images?|多视角|multi view/i.test((e.innerText || e.textContent || e.className || '')))
      if (el) { el.click(); return 'clicked' }
      return 'none'
    })()
  `)
  await wait(1500)

  // Collect all image file inputs on the page
  await win.webContents.executeJavaScript(`
    (() => {
      const inputs = Array.from(document.querySelectorAll('input[type="file"]'))
        .filter(el => !el.accept || el.accept.includes('image') || el.accept === '*' || el.accept === 'image/*')
      window.__tripoMultiviewInputs = inputs
    })()
  `)

  let dbg = null
  try {
    dbg = win.webContents.debugger
    if (!dbg.isAttached()) dbg.attach('1.3')

    const inputCountRes = await dbg.sendCommand('Runtime.evaluate', {
      expression: '(window.__tripoMultiviewInputs || []).length',
      returnByValue: true
    })
    const inputCount = inputCountRes.result?.value || 0
    const slotsAvailable = Math.max(inputCount, 1)
    const uploads = Math.min(validPaths.length, slotsAvailable)

    for (let i = 0; i < uploads; i++) {
      const imagePath = validPaths[i]
      const evalRes = await dbg.sendCommand('Runtime.evaluate', {
        expression: `window.__tripoMultiviewInputs[${i}]`,
        returnByValue: false
      })
      if (!evalRes.result?.objectId) continue

      const nodeRes = await dbg.sendCommand('DOM.requestNode', { objectId: evalRes.result.objectId })
      await dbg.sendCommand('DOM.setFileInputFiles', { files: [imagePath], nodeId: nodeRes.nodeId })

      await win.webContents.executeJavaScript(`
        (() => {
          const inp = window.__tripoMultiviewInputs[${i}]
          if (!inp) return
          inp.dispatchEvent(new Event('change', { bubbles: true }))
          inp.dispatchEvent(new Event('input', { bubbles: true }))
        })()
      `)
      await wait(400)
    }

    return { success: true, uploaded: uploads }
  } catch (err) {
    return { success: false, error: `Multiview image injection failed: ${err.message}` }
  } finally {
    if (dbg?.isAttached()) {
      try { dbg.detach() } catch { /* ignore */ }
    }
  }
}


ipcMain.handle('dialog:openVideo', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Video File',
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }],
    properties: ['openFile']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openVfxAssetFiles', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select VFX Reference Files',
    filters: [
      {
        name: 'VFX References',
        extensions: [
          'png',
          'jpg',
          'jpeg',
          'webp',
          'gif',
          'tga',
          'mp4',
          'mov',
          'avi',
          'mkv',
          'webm',
          'json',
          'txt',
          'csv',
          'ini',
          'uasset',
          'uexp',
          'ubulk'
        ]
      },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile', 'multiSelections']
  })
  return result.canceled ? [] : result.filePaths
})

ipcMain.handle('dialog:saveFile', async (_, opts) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: opts.title || 'Save File',
    defaultPath: opts.defaultPath || 'animation',
    filters: opts.filters || [{ name: 'All Files', extensions: ['*'] }]
  })
  return result.canceled ? null : result.filePath
})

// ── IPC: FS — Read text file ──────────────────────────────────────────────

ipcMain.handle('fs:readTextFile', async (_, { filePath }) => {
  try {
    const text = readFileSync(filePath, 'utf8')
    return { success: true, text }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: Animation — Text to Motion ──────────────────────────────────────
// Uses Tencent's HY-Motion hosted Gradio app and expects a BVH result.

async function downloadFile(url, destPath, headers = {}) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`)
  }
  const data = Buffer.from(await response.arrayBuffer())
  writeFileSync(destPath, data)
}

function getMimeTypeForPath(filePath) {
  const ext = String(filePath || '')
    .split('.')
    .pop()
    ?.toLowerCase()
  return (
    {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      ogg: 'audio/ogg'
    }[ext] || 'application/octet-stream'
  )
}

function filePathToDataUrl(filePath) {
  const data = readFileSync(filePath)
  return `data:${getMimeTypeForPath(filePath)};base64,${data.toString('base64')}`
}

const DEEPSEEK_BASE = 'https://api.deepseek.com'
const DEFAULT_DEEPSEEK_VFX_MODEL = 'deepseek-v4-flash'

async function deepseekChatCompletion({ apiKey, model, messages }) {
  const response = await fetch(`${DEEPSEEK_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: model || DEFAULT_DEEPSEEK_VFX_MODEL,
      messages,
      response_format: { type: 'json_object' },
      stream: false
    })
  })

  const raw = await response.text()
  let parsed = null
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { error: raw }
    }
  }

  if (!response.ok) {
    const message =
      parsed?.error?.message ||
      parsed?.error ||
      (typeof parsed?.detail === 'string' ? parsed.detail : null) ||
      `DeepSeek request failed (${response.status})`
    throw new Error(message)
  }

  return parsed
}

function extractJsonObject(text) {
  const raw = String(text || '').trim()
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced?.[1]) {
      try {
        return JSON.parse(fenced[1].trim())
      } catch {
        return null
      }
    }

    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1))
      } catch {
        return null
      }
    }
  }

  return null
}

const REPLICATE_BASE = 'https://api.replicate.com/v1'

async function replicateRequest(path, { apiToken, method = 'GET', body, wait } = {}) {
  const response = await fetch(`${REPLICATE_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(wait ? { Prefer: `wait=${wait}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  })

  const raw = await response.text()
  let parsed = null
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { detail: raw }
    }
  }

  if (!response.ok) {
    throw new Error(parsed?.detail || parsed?.error || `Replicate request failed (${response.status})`)
  }

  return parsed
}

function extractReplicateOutputUrl(output) {
  if (!output) return null
  if (typeof output === 'string') return output
  if (Array.isArray(output)) {
    for (const item of output) {
      if (typeof item === 'string') return item
      if (item?.url) return item.url
    }
  }
  if (output?.url) return output.url
  return null
}

function listMotionFormats(data) {
  const outputs = Array.isArray(data) ? data : []
  const exts = ['.bvh', '.glb', '.fbx', '.npz']
  const found = new Set()
  for (const item of outputs) {
    if (!item) continue
    const url = typeof item === 'string' ? item : item.url || item.path || ''
    const name = typeof item === 'string' ? item : item.orig_name || item.name || url
    for (const ext of exts) {
      if (
        (typeof name === 'string' && name.toLowerCase().endsWith(ext)) ||
        (typeof url === 'string' && url.toLowerCase().includes(ext))
      ) {
        found.add(ext.slice(1))
      }
    }
  }
  return [...found]
}

// Parse Gradio result data looking for a motion file URL
function extractMotionFile(data, exts = ['.bvh', '.glb', '.fbx', '.npz']) {
  const outputs = Array.isArray(data) ? data : []
  for (const ext of exts) {
    for (const item of outputs) {
      if (!item) continue
      const url = typeof item === 'string' ? item : item.url || item.path || ''
      const name = typeof item === 'string' ? item : item.orig_name || item.name || url
      if (typeof name === 'string' && name.toLowerCase().endsWith(ext)) return { url, ext }
      if (typeof url === 'string' && url.toLowerCase().includes(ext)) return { url, ext }
    }
  }
  return null
}

function normalizeTextToMotionError(err) {
  const message = err?.message || 'Unknown text-to-motion error.'
  if (/Could not resolve app config/i.test(message)) {
    return 'Could not connect to HY-Motion right now. The hosted motion service did not return a valid app config.'
  }
  return message
}

function getHyMotionTarget(model) {
  if (model === 'hymotion-lite') {
    return {
      spaceId: 'tencent/HY-Motion-1.0',
      progressLabel: 'HY-Motion 1.0 Lite',
      useLiteVariant: true
    }
  }
  if (model === 'hymotion-zerogpu') {
    return {
      spaceId: 'tencent/HY-Motion-1.0',
      progressLabel: 'HY-Motion 1.0 ZeroGPU',
      useLiteVariant: true
    }
  }
  return {
    spaceId: 'tencent/HY-Motion-1.0',
    progressLabel: 'HY-Motion 1.0',
    useLiteVariant: false
  }
}

ipcMain.removeHandler('animation:textToMotion')
ipcMain.handle('animation:textToMotion', async (event, payload = {}) => {
  const sender = event?.sender
  const send = (step, pct) => {
    try {
      if (!sender || sender.isDestroyed()) return
      sender.send('animation:progress', { step, pct })
    } catch {
      // Sender can be destroyed while long-running work is in flight.
    }
  }

  const prompt =
    typeof payload.prompt === 'string' ? payload.prompt.trim() : ''
  const model =
    payload.model === 'hymotion-lite'
      ? 'hymotion-lite'
      : payload.model === 'hymotion-zerogpu'
        ? 'hymotion-zerogpu'
        : 'hymotion'
  const duration = Number(payload.duration)
  const safeDuration = [2, 4, 6, 8].includes(duration) ? duration : 4

  if (!prompt) {
    return { success: false, error: 'Please enter an animation prompt.' }
  }

  const run = async () => {
    try {
      const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

      const { Client } = await import('@gradio/client')
      const motionTarget = getHyMotionTarget(model)

      send(`Connecting to ${motionTarget.progressLabel}...`, 10)
      const client = await Client.connect(motionTarget.spaceId, { hf_token: undefined })

      send(`Generating motion with ${motionTarget.progressLabel}...`, 30)
      const result = await client.predict('/generate', {
        text: prompt,
        motion_length: safeDuration,
        num_seeds: 1,
        ...(motionTarget.useLiteVariant ? { model_variant: 'lite' } : {})
      })

      send('Downloading motion file...', 80)
      const found = extractMotionFile(result?.data, ['.bvh'])
      if (!found) {
        const formats = listMotionFormats(result?.data)
        const formatLabel = formats.length
          ? formats.map((f) => f.toUpperCase()).join(', ')
          : 'no downloadable motion file'
        return {
          success: false,
          error: `HY-Motion did not return a BVH file required for Roblox retargeting. Received ${formatLabel}.`
        }
      }

      const outPath = join(outDir, `motion_${Date.now()}${found.ext}`)
      if (found.url.startsWith('http')) await downloadFile(found.url, outPath)
      else writeFileSync(outPath, readFileSync(found.url))

      send('Done!', 100)
      return { success: true, bvhPath: outPath, format: found.ext.slice(1) }
    } catch (err) {
      return { success: false, error: normalizeTextToMotionError(err) }
    }
  }

  const TIMEOUT_MS = 180000
  return Promise.race([
    run(),
    wait(TIMEOUT_MS).then(() => ({
      success: false,
      error: 'HY-Motion request timed out. Please try again.'
    }))
  ])
})

// ── IPC: Animation — Video to Motion (MediaPipe / WHAM) ──────────────────

ipcMain.handle('animation:videoToMotion', async (event, { videoPath, quality }) => {
  const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
  const outBVH = join(outDir, `pose_${Date.now()}.bvh`)

  event.sender.send('animation:progress', { step: 'Extracting pose from video...', pct: 10 })

  const script = quality === 'wham' ? 'wham_extractor.py' : 'pose_extractor.py'
  const args = quality === 'wham' ? [videoPath, outBVH, 'wham'] : [videoPath, outBVH]

  try {
    await spawnPython(script, args, (msg) => {
      const m = msg.match(/PROGRESS:(\d+)/)
      if (m)
        event.sender.send('animation:progress', { step: 'Extracting pose...', pct: parseInt(m[1]) })
    })
    event.sender.send('animation:progress', { step: 'Pose extraction complete', pct: 100 })
    return { success: true, bvhPath: outBVH }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: Animation — Export FBX (Python retargeter) ──────────────────────

ipcMain.handle('animation:exportFBX', async (event, { bvhPath, outputPath }) => {
  if (!bvhPath || !existsSync(bvhPath)) {
    return { success: false, error: 'Source BVH file was not found.' }
  }
  if (!bvhPath.toLowerCase().endsWith('.bvh')) {
    return { success: false, error: 'Roblox retargeting currently requires a BVH source file.' }
  }
  event.sender.send('animation:progress', { step: 'Retargeting to Roblox R15...', pct: 20 })
  try {
    await spawnPython('retargeter.py', [bvhPath, outputPath], (msg) => {
      const m = msg.match(/PROGRESS:(\d+)/)
      if (m)
        event.sender.send('animation:progress', { step: 'Retargeting...', pct: parseInt(m[1]) })
    })
    if (!existsSync(outputPath)) {
      return { success: false, error: 'Retargeter finished without creating an FBX file.' }
    }
    event.sender.send('animation:progress', { step: 'Export complete!', pct: 100 })
    return { success: true, outputPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('animation:exportBVH', async (_, { sourcePath, outputPath }) => {
  const { copyFileSync } = await import('fs')
  try {
    if (!sourcePath || !existsSync(sourcePath)) {
      return { success: false, error: 'Source BVH file was not found.' }
    }
    if (!sourcePath.toLowerCase().endsWith('.bvh')) {
      return { success: false, error: 'Only BVH motion files can be exported as BVH.' }
    }
    copyFileSync(sourcePath, outputPath)
    return { success: true, outputPath }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('shell:openPath', async (_, filePath) => {
  shell.showItemInFolder(filePath)
})

ipcMain.handle('shell:openExternalUrl', async (_, url) => {
  try {
    if (!url || !/^https?:\/\//i.test(String(url))) {
      return { success: false, error: 'A valid external URL is required.' }
    }
    await shell.openExternal(String(url))
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('clipboard:writeText', async (_, text) => {
  try {
    clipboard.writeText(String(text ?? ''))
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:copyFile', async (_, { src, dest }) => {
  try {
    const { copyFileSync } = await import('fs')
    copyFileSync(src, dest)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: FS — Read file as base64 data URL ───────────────────────────────

ipcMain.handle('fs:readFileAsDataURL', async (_, { filePath }) => {
  try {
    const { readFileSync } = await import('fs')
    const buf = readFileSync(filePath)
    const mime = getMimeTypeFromExt(filePath)
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
    return { success: true, dataUrl }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('fs:writeTextFile', async (_, { filePath, text }) => {
  try {
    writeFileSync(filePath, String(text ?? ''), 'utf8')
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('vfx:exportPackage', async (_, payload) => {
  try {
    const folderPath = payload?.folderPath
    if (!folderPath) {
      throw new Error('A destination folder is required to export the VFX package.')
    }

    ensureDir(folderPath)

    const effectName = payload?.effectName || payload?.preset?.meta?.effectName || 'particle-vfx'
    const stem = sanitizeFileStem(effectName)
    const bundle = writeStudioBundle({
      folderPath,
      effectName,
      preset: payload?.preset ?? {},
      workflowText: payload?.workflowText ?? '',
      stem
    })

    writeFileSync(bundle.presetPath, JSON.stringify(payload?.preset ?? {}, null, 2), 'utf8')
    writeFileSync(bundle.workflowPath, String(payload?.workflowText ?? ''), 'utf8')
    writeFileSync(bundle.manifestPath, JSON.stringify(bundle.manifest, null, 2), 'utf8')
    writeFileSync(bundle.readmePath, buildBundleReadme({ effectName, manifest: bundle.manifest }), 'utf8')

    let pluginInstall = null
    if (payload?.installPlugin) {
      pluginInstall = installRoflowVfxPlugin()
    }

    return {
      success: true,
      folderPath,
      files: {
        presetPath: bundle.presetPath,
        workflowPath: bundle.workflowPath,
        manifestPath: bundle.manifestPath,
        readmePath: bundle.readmePath,
        textures: bundle.copiedTextures.map((entry) => entry.destPath)
      },
      pluginInstall
    }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('vfx:installStudioPlugin', async () => {
  try {
    const pluginInstall = installRoflowVfxPlugin()
    return { success: true, ...pluginInstall }
  } catch (err) {
    return { success: false, error: err.message }
  }
})


// ── IPC: VFX — AI Recipe Generation (DeepSeek) ───────────────────────────

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'
const DEEPSEEK_MODEL = 'deepseek-v4'

ipcMain.handle('vfx:generateRecipe', async (_, payload) => {
  try {
    const { niagaraText, effectDescription, systemType, materialNotes, timingNotes, apiKey } = payload || {}

    if (!apiKey) {
      return { success: false, error: 'A DeepSeek API key is required. Add it in the VFX panel.' }
    }

    const userLines = [
      effectDescription ? `Effect description: ${effectDescription}` : null,
      `Niagara system type: ${systemType || 'Niagara'}`,
      '',
      'Niagara values / exported parameters:',
      niagaraText || '(none provided)',
      '',
      materialNotes ? `Material / texture notes: ${materialNotes}` : null,
      timingNotes ? `Timing notes: ${timingNotes}` : null
    ]
      .filter((line) => line !== null)
      .join('\n')

    const systemPrompt = `You are a Roblox VFX expert specialising in converting Unreal Engine Niagara systems into Roblox ParticleEmitter / Beam / Trail / BillboardGui setups. You always respond with valid JSON only — no markdown, no extra text.`

    const userPrompt = `Analyse this Niagara VFX system and return a complete Roblox VFX recipe as a JSON object.

${userLines}

Return exactly this JSON structure (all fields required):
{
  "effectName": "short display name",
  "effectType": "impact" | "projectile" | "aura" | "explosion" | "environment",
  "sourceMode": "hybrid" | "unreal-rebuild" | "image-driven",
  "targetPlatform": "roblox-desktop" | "roblox-mobile" | "cross-platform",
  "performanceTarget": "low" | "medium" | "high",
  "outputMode": "attachment" | "part" | "module-script",
  "gameplayPurpose": "one sentence — what player action triggers this effect",
  "visualDirection": "art direction and visual style notes",
  "implementationNotes": "Roblox-specific constraints and approximation notes",
  "layers": [
    {
      "name": "descriptive layer name",
      "role": "what this layer contributes visually",
      "layerType": "particle" | "beam" | "trail" | "billboard" | "ring",
      "shape": "orb" | "spark" | "smoke" | "ring" | "slash" | "flare",
      "textureHint": "sprite or flipbook description",
      "color": "#rrggbb",
      "secondaryColor": "#rrggbb",
      "opacity": 0.8,
      "lightEmission": 1.0,
      "lightInfluence": 0.0,
      "sizeMin": 0.3,
      "sizeMax": 1.2,
      "lifetimeMin": 0.1,
      "lifetimeMax": 0.5,
      "rate": 25,
      "speedMin": 8.0,
      "speedMax": 20.0,
      "spread": 25,
      "drag": 0.1,
      "flipbookLayout": "None",
      "flipbookMode": "None",
      "notes": ""
    }
  ]
}

Include 2 to 4 layers. Choose values that are practical for Roblox and mobile-friendly where possible.`

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      return { success: false, error: `DeepSeek API error ${response.status}: ${errText.slice(0, 240)}` }
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      return { success: false, error: 'DeepSeek returned an empty response.' }
    }

    let recipe
    try {
      recipe = JSON.parse(content)
    } catch {
      return { success: false, error: 'DeepSeek response was not valid JSON.' }
    }

    return { success: true, recipe }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: SFX — AI Recipe Generation (DeepSeek) ───────────────────────────

ipcMain.handle('sfx:generateRecipe', async (_, payload) => {
  try {
    const { description, category, gameContext, apiKey } = payload || {}

    if (!apiKey) {
      return { success: false, error: 'A DeepSeek API key is required. Add it in the SFX panel.' }
    }
    if (!description?.trim()) {
      return { success: false, error: 'A sound description is required.' }
    }

    const systemPrompt = `You are a Roblox audio designer specialising in SoundService configuration and Lua scripting. You always respond with valid JSON only — no markdown, no extra text.`

    const userPrompt = `Design a Roblox SoundService setup for the following:

Sound description: ${description.trim()}
Category: ${category || 'general'}
Game context: ${gameContext || '(not specified)'}

Return exactly this JSON structure (all fields required):
{
  "soundName": "short descriptive name",
  "category": "hit" | "ambient" | "ui" | "music" | "ability" | "environment",
  "description": "one sentence design brief",
  "looped": false,
  "volume": 0.85,
  "rollOffMaxDistance": 80,
  "rollOffMinDistance": 10,
  "playbackSpeed": 1.0,
  "soundEffects": [
    {
      "type": "EqualizerSoundEffect" | "ReverbSoundEffect" | "DistortionSoundEffect" | "CompressorSoundEffect" | "PitchShiftSoundEffect" | "TremoloSoundEffect",
      "params": { }
    }
  ],
  "layerBreakdown": [
    {
      "name": "layer name",
      "role": "what it contributes",
      "frequency": "low" | "mid" | "high",
      "notes": ""
    }
  ],
  "audioSearchTerms": [
    { "source": "Roblox Audio Marketplace", "query": "search keywords" },
    { "source": "Freesound.org", "query": "search keywords" }
  ],
  "luaScript": "-- Roblox SoundService Lua (use double backslash n for newlines, not actual newlines)",
  "designNotes": "implementation guidance"
}

For soundEffects, use only 1–3 effects with realistic Roblox parameter values.
For layerBreakdown, include 2–3 layers.
The luaScript must be a single JSON string — escape all newlines as \\n and quotes as \\".`

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      return { success: false, error: `DeepSeek API error ${response.status}: ${errText.slice(0, 240)}` }
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) return { success: false, error: 'DeepSeek returned an empty response.' }

    let recipe
    try { recipe = JSON.parse(content) } catch {
      return { success: false, error: 'DeepSeek response was not valid JSON.' }
    }

    return { success: true, recipe }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: Building — AI Recipe Generation (DeepSeek) ──────────────────────

ipcMain.handle('building:generateRecipe', async (_, payload) => {
  try {
    const { description, style, gameType, apiKey } = payload || {}

    if (!apiKey) {
      return { success: false, error: 'A DeepSeek API key is required. Add it in the Building panel.' }
    }
    if (!description?.trim()) {
      return { success: false, error: 'A building description is required.' }
    }

    const systemPrompt = `You are a Roblox 3D environment designer and Lua scripter. You decompose building descriptions into 3D components ready for Tripo3D generation and Roblox Studio assembly. You always respond with valid JSON only — no markdown, no extra text.`

    const userPrompt = `Design a Roblox building for the following:

Building description: ${description.trim()}
Architectural style: ${style || 'generic'}
Game type / genre: ${gameType || '(not specified)'}

Return exactly this JSON structure:
{
  "buildingName": "descriptive building name",
  "style": "architectural style label",
  "description": "one sentence brief",
  "theme": "game theme",
  "components": [
    {
      "name": "component name",
      "tripoPrompt": "optimised text-to-3D prompt for Tripo3D (80 words max, no commas, descriptive)",
      "robloxSize": "WxHxD in studs, e.g. 20x8x20",
      "robloxMaterial": "SmoothPlastic" | "Brick" | "Wood" | "WoodPlanks" | "Concrete" | "Metal" | "Slate" | "Marble",
      "robloxColor": "#rrggbb",
      "assemblyHint": "brief Roblox Studio placement note",
      "priority": 1
    }
  ],
  "luaScript": "-- Roblox Studio script (escape newlines as \\n)",
  "designNotes": "style guidance and material recommendations"
}

Include 3–6 components covering the most important structural parts (foundation, walls, roof, door, etc.). Order components by build priority (1 = first). The tripoPrompt must be phrased for a text-to-3D model generator — focus on shape, style, material.`

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      return { success: false, error: `DeepSeek API error ${response.status}: ${errText.slice(0, 240)}` }
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content
    if (!content) return { success: false, error: 'DeepSeek returned an empty response.' }

    let recipe
    try { recipe = JSON.parse(content) } catch {
      return { success: false, error: 'DeepSeek response was not valid JSON.' }
    }

    return { success: true, recipe }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle(
  'vfx:generateParticleLogic',
  async (
    event,
    {
      apiKey,
      model = DEFAULT_DEEPSEEK_VFX_MODEL,
      sourceMode = 'ground-up',
      effectName,
      effectType,
      performanceTarget,
      gameplayPurpose,
      visualDirection,
      prompt,
      unrealSystemType,
      unrealValuesText,
      unrealMaterialNotes,
      unrealTimingNotes,
      existingLayers = [],
      references = []
    } = {}
  ) => {
    try {
      const resolvedApiKey = apiKey?.trim() || loadConfig().deepseekApiKey?.trim()
      if (!resolvedApiKey) {
        return { success: false, error: 'DeepSeek API key required. Add it in Settings.' }
      }

      const userPrompt = String(prompt || visualDirection || gameplayPurpose || '').trim()
      const niagaraValues = String(unrealValuesText || '').trim()
      const isNiagaraRebuild = sourceMode === 'niagara-rebuild'

      if (isNiagaraRebuild) {
        if (!niagaraValues && !userPrompt) {
          return {
            success: false,
            error: 'Paste Niagara values or describe the Unreal reference to rebuild.'
          }
        }
      } else if (!userPrompt && !effectName?.trim()) {
        return { success: false, error: 'Describe the effect or provide a visual direction first.' }
      }

      event.sender.send('vfx:progress', { step: 'Sending prompt to DeepSeek…', pct: 12 })

      const referenceSummary = (references || [])
        .map((reference, index) => {
          const label = reference?.label || reference?.filePath || `Reference ${index + 1}`
          const kind = reference?.kind || 'image'
          const snippet = reference?.textSnippet ? `\nNotes: ${String(reference.textSnippet).slice(0, 240)}` : ''
          return `${index + 1}. ${kind.toUpperCase()} — ${label}${snippet}`
        })
        .join('\n')

      const existingSummary = (existingLayers || [])
        .filter((layer) => layer?.enabled !== false)
        .map(
          (layer, index) =>
            `${index + 1}. ${layer.name} (${layer.textureSource || 'shape'}:${layer.shape}, ${layer.robloxClass || 'ParticleEmitter'}) — rate ${layer.rate}, lifetime ${layer.lifetimeMin}-${layer.lifetimeMax}, texture: ${layer.textureHint || layer.shape}`
        )
        .join('\n')

      const systemPrompt = buildRobloxVfxSystemPrompt({ sourceMode })
      const userMessage = buildRobloxVfxUserMessage({
        sourceMode,
        effectName,
        effectType,
        performanceTarget,
        gameplayPurpose,
        visualDirection,
        prompt: userPrompt,
        unrealSystemType,
        unrealValuesText: niagaraValues,
        unrealMaterialNotes,
        unrealTimingNotes,
        referenceSummary,
        existingSummary
      })

      event.sender.send('vfx:progress', { step: 'DeepSeek is designing particle layers…', pct: 42 })

      const completion = await deepseekChatCompletion({
        apiKey: resolvedApiKey,
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage }
        ]
      })

      const content = completion?.choices?.[0]?.message?.content
      const parsed = extractJsonObject(content)
      if (!parsed) {
        return { success: false, error: 'DeepSeek returned a response that could not be parsed as JSON.' }
      }

      event.sender.send('vfx:progress', { step: 'Applying generated particle logic…', pct: 88 })

      const normalized = normalizeParticleLogicPayload(parsed)

      event.sender.send('vfx:progress', { step: 'Done', pct: 100 })

      return {
        success: true,
        model: completion?.model || model,
        usage: completion?.usage || null,
        logic: normalized,
        raw: content
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
)

ipcMain.handle('modeling:listGeneratedModels', async () => {
  try {
    const items = listGeneratedModelItemsInDir(getPersistentModelLibraryDir()).sort(
      (a, b) => b.modifiedAt - a.modifiedAt
    )

    return { success: true, items }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('modeling:saveGeneratedModel', async (_, payload) => {
  try {
    return { success: true, item: persistGeneratedModel(payload || {}) }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── IPC: File Dialogs — GLTF/GLB ────────────────────────────────────────

ipcMain.handle('dialog:openGLTF', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select R15 Rig File',
    filters: [{ name: '3D Model', extensions: ['glb', 'gltf'] }],
    properties: ['openFile']
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── IPC: File Dialogs — Mesh import (accessories / environment) ──────────

ipcMain.handle('dialog:openMesh', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import 3D Mesh',
    filters: [{ name: '3D Mesh', extensions: ['glb', 'gltf', 'fbx', 'obj'] }],
    properties: ['openFile']
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── IPC: File Dialogs — Save Folder ─────────────────────────────────────

ipcMain.handle('dialog:saveFolder', async (_, { title }) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: title || 'Select Export Folder',
    properties: ['openDirectory', 'createDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Reference Image',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
    properties: ['openFile']
  })
  return result.canceled ? null : result.filePaths[0]
})

// ── IPC: Config (API keys stored in userData) ─────────────────────────────

function getConfigPath() {
  return join(app.getPath('userData'), 'config.json')
}
function loadConfig() {
  try {
    const raw = JSON.parse(readFileSync(getConfigPath(), 'utf8'))
    const { cfg, changed } = migrateTripoWebConfig(raw)
    if (changed) saveConfig(cfg)
    return cfg
  } catch {
    return {}
  }
}
function saveConfig(cfg) {
  writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2))
}

function broadcastConfigUpdated(key, value) {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('config:updated', { key, value })
  }
}

ipcMain.handle('config:get', (_, key) => loadConfig()[key] ?? null)
ipcMain.handle('config:set', (_, key, value) => {
  const cfg = loadConfig()
  cfg[key] = value
  saveConfig(cfg)
  broadcastConfigUpdated(key, value)
  return true
})

ipcMain.handle(
  'replicate:generateClothing',
  async (
    event,
    {
      apiToken,
      prompt,
      inputImagePath,
      inputImageDataUrl,
      model = 'black-forest-labs/flux-kontext-pro',
      seed = null
    } = {}
  ) => {
    try {
      const resolvedToken = apiToken?.trim() || loadConfig().replicateApiToken?.trim()
      if (!resolvedToken) {
        return { success: false, error: 'Replicate API token required.' }
      }
      if (!prompt?.trim()) {
        return { success: false, error: 'A clothing prompt is required.' }
      }
      const resolvedInputImage =
        inputImageDataUrl?.trim() || (inputImagePath?.trim() ? filePathToDataUrl(inputImagePath) : '')
      if (!resolvedInputImage) {
        return { success: false, error: 'Attach a Roblox clothing template image first.' }
      }

      const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

      event.sender.send('clothing:progress', { step: 'Uploading template to Replicate…', pct: 10 })

      const input = {
        prompt: prompt.trim(),
        input_image: resolvedInputImage,
        output_format: 'png',
        prompt_upsampling: true,
        safety_tolerance: 2
      }

      if (Number.isInteger(seed)) input.seed = seed

      event.sender.send('clothing:progress', { step: 'Starting FLUX clothing edit…', pct: 20 })
      let prediction = await replicateRequest(`/models/${model}/predictions`, {
        apiToken: resolvedToken,
        method: 'POST',
        wait: 1,
        body: {
          input
        }
      })

      if (!prediction?.id) {
        return { success: false, error: 'Replicate did not return a prediction id.' }
      }

      let attempts = 0
      while (attempts < 90) {
        const status = prediction?.status
        if (status === 'succeeded') {
          const outputUrl = extractReplicateOutputUrl(prediction.output)
          if (!outputUrl) {
            return { success: false, error: 'Replicate finished without an image URL.' }
          }

          event.sender.send('clothing:progress', { step: 'Downloading generated texture…', pct: 94 })
          const outputPath = join(outDir, `classic_clothing_${Date.now()}.png`)
          await downloadFile(outputUrl, outputPath, {
            Authorization: `Bearer ${resolvedToken}`
          })
          event.sender.send('clothing:progress', { step: 'Classic clothing texture ready!', pct: 100 })
          return {
            success: true,
            outputPath,
            provider: 'replicate',
            predictionId: prediction.id,
            model
          }
        }

        if (status === 'failed' || status === 'canceled') {
          return {
            success: false,
            error: prediction?.error || `Replicate prediction ${status}.`
          }
        }

        attempts += 1
        const pct = Math.min(90, 24 + attempts)
        event.sender.send('clothing:progress', {
          step: `Generating clothing texture… (${status || 'starting'})`,
          pct
        })
        await wait(2000)
        prediction = await replicateRequest(`/predictions/${prediction.id}`, {
          apiToken: resolvedToken
        })
      }

      return { success: false, error: 'Timed out waiting for Replicate output.' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
)


// ── IPC: GPT Image 2 clothing generation (Azure / GitHub Models) ──────────

ipcMain.handle(
  'clothing:generateGptImage',
  async (event, { apiToken, prompt, inputImagePath, inputImageDataUrl } = {}) => {
    try {
      if (!apiToken?.trim()) {
        return { success: false, error: 'GitHub / Azure API token required.' }
      }
      if (!prompt?.trim()) {
        return { success: false, error: 'A clothing prompt is required.' }
      }

      // Resolve image bytes from either a data URL or a file path
      let imageBuffer
      if (inputImageDataUrl?.trim()) {
        const base64Data = inputImageDataUrl.trim().replace(/^data:[^;]+;base64,/, '')
        imageBuffer = Buffer.from(base64Data, 'base64')
      } else if (inputImagePath?.trim() && existsSync(inputImagePath)) {
        imageBuffer = readFileSync(inputImagePath)
      } else {
        return { success: false, error: 'Attach a Roblox clothing template image first.' }
      }

      event.sender.send('clothing:progress', { step: 'Sending template to GPT Image…', pct: 15 })

      const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

      // Build multipart/form-data body using FormData + Blob (Node 18+)
      const form = new FormData()
      form.append('model', 'gpt-image-1')
      form.append('prompt', prompt.trim())
      form.append('n', '1')
      form.append('size', '1024x1024')
      // Append image as a Blob so fetch sends it with the correct content-type
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' })
      form.append('image', imageBlob, 'template.png')

      event.sender.send('clothing:progress', { step: 'Generating clothing texture…', pct: 30 })

      const response = await fetch('https://models.inference.ai.azure.com/images/edits', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken.trim()}`
          // Do NOT set Content-Type; fetch sets it automatically for FormData
        },
        body: form
      })

      if (!response.ok) {
        const errText = await response.text().catch(() => '')
        let errMsg
        try {
          const parsed = JSON.parse(errText)
          errMsg = parsed?.error?.message || parsed?.message || errText
        } catch {
          errMsg = errText
        }
        return {
          success: false,
          error: `GPT Image API error ${response.status}: ${errMsg.slice(0, 280)}`
        }
      }

      event.sender.send('clothing:progress', { step: 'Downloading generated texture…', pct: 88 })

      const json = await response.json()
      const b64 = json?.data?.[0]?.b64_json
      if (!b64) {
        return { success: false, error: 'GPT Image returned no image data.' }
      }

      const outputPath = join(outDir, `classic_clothing_gpt_${Date.now()}.png`)
      writeFileSync(outputPath, Buffer.from(b64, 'base64'))

      event.sender.send('clothing:progress', { step: 'Classic clothing texture ready!', pct: 100 })
      return { success: true, outputPath, provider: 'gpt-image' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
)

// ── IPC: SFX — ElevenLabs + Stable Audio 3 ─────────────────────────────────

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1'
const DEFAULT_ELEVENLABS_TTS_MODEL = 'eleven_multilingual_v2'
const DEFAULT_ELEVENLABS_SFX_MODEL = 'eleven_text_to_sound_v2'
const DEFAULT_ELEVENLABS_OUTPUT_FORMAT = 'mp3_44100_128'

function parseElevenLabsError(raw, status) {
  if (!raw) return `ElevenLabs request failed (${status})`
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed?.detail === 'string') return parsed.detail
    if (parsed?.detail?.message) return parsed.detail.message
    if (parsed?.detail?.status) return `${parsed.detail.status}: ${parsed.detail.message || 'Request failed'}`
    if (parsed?.message) return parsed.message
    return raw
  } catch {
    return raw
  }
}

async function elevenLabsRequest(path, { apiKey, method = 'GET', body, query, binary = false } = {}) {
  const url = new URL(`${ELEVENLABS_BASE}${path}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value != null && value !== '') url.searchParams.set(key, String(value))
    }
  }

  const response = await fetch(url, {
    method,
    headers: {
      'xi-api-key': apiKey,
      ...(body && !binary ? { 'Content-Type': 'application/json' } : {}),
      ...(binary ? {} : { Accept: 'application/json' })
    },
    ...(body ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
  })

  if (binary) {
    if (!response.ok) {
      const raw = await response.text()
      throw new Error(parseElevenLabsError(raw, response.status))
    }
    return Buffer.from(await response.arrayBuffer())
  }

  const raw = await response.text()
  let parsed = null
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = { detail: raw }
    }
  }

  if (!response.ok) {
    throw new Error(parseElevenLabsError(raw, response.status))
  }

  return parsed
}

ipcMain.handle('elevenlabs:validateKey', async (_, { apiKey } = {}) => {
  try {
    const key = apiKey?.trim() || loadConfig().elevenLabsApiKey?.trim()
    if (!key) {
      return { success: false, error: 'ElevenLabs API key required. Add it in Settings.' }
    }
    const user = await elevenLabsRequest('/user', { apiKey: key })
    return {
      success: true,
      subscription: user?.subscription?.tier || user?.subscription?.status || null
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle('elevenlabs:listVoices', async (_, { apiKey } = {}) => {
  try {
    const key = apiKey?.trim() || loadConfig().elevenLabsApiKey?.trim()
    if (!key) {
      return { success: false, error: 'ElevenLabs API key required. Add it in Settings.' }
    }
    const data = await elevenLabsRequest('/voices', { apiKey: key })
    const voices = (data?.voices || []).map((voice) => ({
      id: voice.voice_id,
      name: voice.name,
      category: voice.category || null,
      previewUrl: voice.preview_url || null
    }))
    return { success: true, voices }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle(
  'sfx:generateElevenLabs',
  async (
    event,
    {
      apiKey,
      mode = 'sfx',
      text,
      voiceId,
      durationSeconds = 5,
      promptInfluence = 0.3,
      loop = false,
      modelId,
      outputFormat = DEFAULT_ELEVENLABS_OUTPUT_FORMAT
    } = {}
  ) => {
    try {
      const key = apiKey?.trim() || loadConfig().elevenLabsApiKey?.trim()
      if (!key) {
        return { success: false, error: 'ElevenLabs API key required. Add it in Settings.' }
      }
      if (!text?.trim()) {
        return { success: false, error: 'Enter a prompt or script to generate audio.' }
      }

      const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
      ensureDir(outDir)
      const ext = String(outputFormat || DEFAULT_ELEVENLABS_OUTPUT_FORMAT).startsWith('mp3') ? 'mp3' : 'wav'
      const outputPath = join(outDir, `elevenlabs_${mode}_${Date.now()}.${ext}`)

      event.sender.send('sfx:progress', { step: 'Sending request to ElevenLabs…', pct: 12 })

      let audioBuffer
      if (mode === 'speech') {
        const resolvedVoiceId = voiceId?.trim() || loadConfig().elevenLabsVoiceId?.trim()
        if (!resolvedVoiceId) {
          return { success: false, error: 'Select a voice for speech generation.' }
        }
        event.sender.send('sfx:progress', { step: 'Generating speech…', pct: 35 })
        audioBuffer = await elevenLabsRequest(`/text-to-speech/${resolvedVoiceId}`, {
          apiKey: key,
          method: 'POST',
          binary: true,
          query: { output_format: outputFormat },
          body: {
            text: text.trim(),
            model_id: modelId || loadConfig().elevenLabsModelId || DEFAULT_ELEVENLABS_TTS_MODEL,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75
            }
          }
        })
      } else {
        event.sender.send('sfx:progress', { step: 'Generating sound effect…', pct: 35 })
        audioBuffer = await elevenLabsRequest('/sound-generation', {
          apiKey: key,
          method: 'POST',
          binary: true,
          query: { output_format: outputFormat },
          body: {
            text: text.trim(),
            model_id: modelId || DEFAULT_ELEVENLABS_SFX_MODEL,
            duration_seconds: Number(durationSeconds) || 5,
            prompt_influence: Number(promptInfluence) ?? 0.3,
            loop: Boolean(loop)
          }
        })
      }

      event.sender.send('sfx:progress', { step: 'Saving audio…', pct: 92 })
      writeFileSync(outputPath, audioBuffer)
      event.sender.send('sfx:progress', { step: 'Audio ready!', pct: 100 })
      return {
        success: true,
        outputPath,
        provider: 'elevenlabs',
        mode
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
)

ipcMain.handle('sfx:checkStableAudio', async () => {
  try {
    const result = await spawnPythonJsonProtocol('stable_audio_gen.py', ['--mode', 'check'])
    return {
      success: true,
      message: result.message || 'Stable Audio 3 is ready.'
    }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle(
  'sfx:generateStableAudio',
  async (
    event,
    {
      prompt,
      duration = 5,
      model = 'small-sfx',
      negativePrompt = '',
      steps = null,
      seed = -1
    } = {}
  ) => {
    try {
      if (!prompt?.trim()) {
        return { success: false, error: 'Enter a prompt to generate audio.' }
      }

      const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
      ensureDir(outDir)
      const outputPath = join(outDir, `stable_audio_${Date.now()}.wav`)

      const args = [
        '--mode',
        'generate',
        '--prompt',
        prompt.trim(),
        '--output',
        outputPath,
        '--model',
        model || 'small-sfx',
        '--duration',
        String(Number(duration) || 5)
      ]
      if (negativePrompt?.trim()) {
        args.push('--negative-prompt', negativePrompt.trim())
      }
      if (Number.isInteger(steps) && steps > 0) {
        args.push('--steps', String(steps))
      }
      if (Number.isInteger(seed) && seed >= 0) {
        args.push('--seed', String(seed))
      }

      event.sender.send('sfx:progress', { step: 'Starting Stable Audio 3…', pct: 5 })

      const result = await spawnPythonJsonProtocol('stable_audio_gen.py', args, {
        onProgress: ({ step, pct }) => {
          event.sender.send('sfx:progress', { step, pct })
        }
      })

      if (!result?.outputPath || !existsSync(result.outputPath)) {
        return { success: false, error: 'Stable Audio finished without creating an output file.' }
      }

      return {
        success: true,
        outputPath: result.outputPath,
        provider: 'stable-audio-3',
        model: result.model || model
      }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
)

// ── IPC: Tripo Website Session Wrapper ──────────────────────────────────────

ipcMain.handle('tripo:webOpenLogin', async (_, { baseUrl } = {}) => {
  try {
    await openTripoLoginWindow(baseUrl)
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('tripo:webOpenGenerate', async (_, { generateUrl, baseUrl } = {}) => {
  try {
    const url = normalizeExternalUrl(generateUrl, normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_GENERATE_URL))
    await createTripoWebWindow({ url, show: true, title: 'Tripo Generate' })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('tripo:webSessionStatus', async (_, { baseUrl, generateUrl } = {}) => {
  try {
    return await inspectTripoWebSessionForSync(
      normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL),
      normalizeExternalUrl(generateUrl, DEFAULT_TRIPO_WEB_GENERATE_URL)
    )
  } catch (err) {
    return { success: false, connected: false, error: err.message }
  }
})

ipcMain.handle('tripo:webListHistory', async (_, { baseUrl, generateUrl } = {}) => {
  try {
    return await listTripoHistoryItems(
      normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL),
      normalizeExternalUrl(generateUrl, DEFAULT_TRIPO_WEB_GENERATE_URL)
    )
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('tripo:webImportHistoryItem', async (_, payload = {}) => {
  try {
    return await importTripoHistoryItem(payload)
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('tripo:listSyncedAssets', async () => {
  try {
    return { success: true, items: listTripoSyncedAssets() }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('tripo:getAssetById', async (_, { id } = {}) => {
  try {
    const item = getTripoSyncedAssetById(id)
    if (!item) return { success: false, error: 'Tripo asset not found.' }
    return { success: true, item }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('tripo:importSyncedAssetById', async (_, payload = {}) => {
  try {
    return await importTripoSyncedAssetById(payload.id, payload)
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('manus:webOpenLogin', async (_, { loginUrl } = {}) => {
  try {
    const url = normalizeExternalUrl(loginUrl, DEFAULT_MANUS_WEB_LOGIN_URL)
    await createProviderWebWindow({
      partition: MANUS_WEB_PARTITION,
      url,
      show: true,
      title: 'Connect Manus Account'
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('manus:webOpenWorkspace', async (_, { workspaceUrl, loginUrl } = {}) => {
  try {
    const url = normalizeExternalUrl(
      workspaceUrl,
      normalizeExternalUrl(loginUrl, DEFAULT_MANUS_WEB_WORKSPACE_URL)
    )
    await createProviderWebWindow({
      partition: MANUS_WEB_PARTITION,
      url,
      show: true,
      title: 'Manus Workspace'
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('manus:webSessionStatus', async (_, { loginUrl, workspaceUrl } = {}) => {
  try {
    return await inspectProviderWebSession({
      partition: MANUS_WEB_PARTITION,
      loginUrl: normalizeExternalUrl(loginUrl, DEFAULT_MANUS_WEB_LOGIN_URL),
      workspaceUrl: normalizeExternalUrl(workspaceUrl, DEFAULT_MANUS_WEB_WORKSPACE_URL),
      title: 'Manus Session Check',
      readyPattern: /new task|workspace|agent|chat|project|create/i
    })
  } catch (err) {
    return { success: false, connected: false, error: err.message }
  }
})

ipcMain.handle('chatgpt:webOpenLogin', async (_, { loginUrl } = {}) => {
  try {
    const url = normalizeExternalUrl(loginUrl, DEFAULT_CHATGPT_WEB_LOGIN_URL)
    await createProviderWebWindow({
      partition: CHATGPT_WEB_PARTITION,
      url,
      show: true,
      title: 'Connect ChatGPT Account'
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('chatgpt:webOpenWorkspace', async (_, { workspaceUrl, loginUrl } = {}) => {
  try {
    const url = normalizeExternalUrl(
      workspaceUrl,
      normalizeExternalUrl(loginUrl, DEFAULT_CHATGPT_WEB_WORKSPACE_URL)
    )
    await createProviderWebWindow({
      partition: CHATGPT_WEB_PARTITION,
      url,
      show: true,
      title: 'ChatGPT Workspace'
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('chatgpt:webSessionStatus', async (_, { loginUrl, workspaceUrl } = {}) => {
  try {
    return await inspectProviderWebSession({
      partition: CHATGPT_WEB_PARTITION,
      loginUrl: normalizeExternalUrl(loginUrl, DEFAULT_CHATGPT_WEB_LOGIN_URL),
      workspaceUrl: normalizeExternalUrl(workspaceUrl, DEFAULT_CHATGPT_WEB_WORKSPACE_URL),
      title: 'ChatGPT Session Check',
      readyPattern: /new chat|message|create image|image|temporary chat|explore gpts/i
    })
  } catch (err) {
    return { success: false, connected: false, error: err.message }
  }
})

ipcMain.handle('elevenlabs:webOpenLogin', async (_, { loginUrl } = {}) => {
  try {
    const url = normalizeExternalUrl(loginUrl, DEFAULT_ELEVENLABS_WEB_LOGIN_URL)
    await createProviderWebWindow({
      partition: ELEVENLABS_WEB_PARTITION,
      url,
      show: true,
      title: 'Connect ElevenLabs Account'
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('elevenlabs:webOpenImageStudio', async (_, { imageUrl, loginUrl } = {}) => {
  try {
    const url = normalizeExternalUrl(
      imageUrl,
      normalizeExternalUrl(loginUrl, DEFAULT_ELEVENLABS_WEB_IMAGE_URL)
    )
    await createProviderWebWindow({
      partition: ELEVENLABS_WEB_PARTITION,
      url,
      show: true,
      title: 'ElevenLabs Image Studio'
    })
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

ipcMain.handle('elevenlabs:webSessionStatus', async (_, { loginUrl, imageUrl } = {}) => {
  try {
    return await inspectElevenLabsWebSession(
      normalizeExternalUrl(loginUrl, DEFAULT_ELEVENLABS_WEB_LOGIN_URL),
      normalizeExternalUrl(imageUrl, DEFAULT_ELEVENLABS_WEB_IMAGE_URL)
    )
  } catch (err) {
    return { success: false, connected: false, error: err.message }
  }
})

ipcMain.handle(
  'elevenlabs:webGenerateImage',
  async (
    event,
    {
      prompt = '',
      loginUrl,
      imageUrl,
      showBrowser = true,
      keepWindowOpen = false,
      timeoutMs = 180000
    } = {}
  ) => {
    let win = null
    try {
      const trimmedPrompt = prompt.trim()
      if (!trimmedPrompt) {
        return { success: false, error: 'A prompt is required for ElevenLabs image generation.' }
      }

      const normalizedLoginUrl = normalizeExternalUrl(loginUrl, DEFAULT_ELEVENLABS_WEB_LOGIN_URL)
      const normalizedImageUrl = normalizeExternalUrl(imageUrl, DEFAULT_ELEVENLABS_WEB_IMAGE_URL)

      const status = await inspectElevenLabsWebSession(normalizedLoginUrl, normalizedImageUrl)
      if (!status.connected) {
        return {
          success: false,
          error:
            'No active ElevenLabs website session was detected. Connect your account in Settings, then open Image Studio once.'
        }
      }

      const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

      event.sender.send('vfx:progress', { step: 'Opening ElevenLabs Image Studio…', pct: 10 })
      win = await createProviderWebWindow({
        partition: ELEVENLABS_WEB_PARTITION,
        url: normalizedImageUrl,
        show: showBrowser,
        title: 'ElevenLabs Image Automation'
      })

      await wait(3000)
      event.sender.send('vfx:progress', { step: 'Submitting prompt in browser session…', pct: 24 })

      let downloadedPath = null
      captureElevenLabsWebDownload(win, outDir, timeoutMs)
        .then((outputPath) => {
          downloadedPath = outputPath
        })
        .catch(() => {})

      const submit = await submitElevenLabsWebPrompt(win, trimmedPrompt)
      if (!submit.success) return { success: false, error: submit.error }

      if (!submit.submitted) {
        clipboard.writeText(trimmedPrompt)
        return {
          success: false,
          handoff: true,
          error:
            submit.warning ||
            'Prompt copied to clipboard. Click Generate manually in the ElevenLabs browser window.'
        }
      }

      for (let attempt = 0; attempt < Math.ceil(timeoutMs / 4000); attempt++) {
        await wait(4000)
        const pct = Math.min(92, 30 + attempt * 3)
        event.sender.send('vfx:progress', { step: 'Waiting for ElevenLabs image…', pct })

        if (downloadedPath) {
          event.sender.send('vfx:progress', { step: 'Image ready!', pct: 100 })
          return { success: true, outputPath: downloadedPath, provider: 'elevenlabs-web' }
        }

        const scraped = await scrapeElevenLabsGeneratedImage(win, outDir)
        if (scraped.success) {
          event.sender.send('vfx:progress', { step: 'Image ready!', pct: 100 })
          return { success: true, outputPath: scraped.outputPath, provider: 'elevenlabs-web' }
        }
      }

      clipboard.writeText(trimmedPrompt)
      return {
        success: false,
        handoff: true,
        error:
          'Automation timed out waiting for the image. Prompt copied — finish generation manually in the browser, then pick the saved image.'
      }
    } catch (err) {
      return {
        success: false,
        error:
          err.message ||
          'ElevenLabs website automation failed. Connect in Settings and try opening Image Studio manually.'
      }
    } finally {
      if (win && !keepWindowOpen) win.destroy()
    }
  }
)

ipcMain.handle(
  'tripo:webGenerate',
  async (
    event,
    {
      prompt = '',
      imagePath = '',
      referenceImages = {},
      multiviewImages = [],
      baseUrl,
      generateUrl,
      showBrowser = true,
      keepWindowOpen = false,
      downloadFormat = 'glb',
      modelVersion = 'v3.1-20260211',
      style = null,
      texture = true,
      pbr = true,
      smartLowPoly = false
    } = {}
  ) => {
    let win = null
    let networkCapture = null

    try {
      const trimmedPrompt = prompt.trim()
      const multiviewFromArray = Array.isArray(multiviewImages) ? multiviewImages.filter(Boolean) : []
      const imageSlots = {
        front: String(referenceImages?.front || imagePath || multiviewFromArray[0] || '').trim(),
        back: String(referenceImages?.back || multiviewFromArray[1] || '').trim(),
        left: String(referenceImages?.left || multiviewFromArray[2] || '').trim(),
        right: String(referenceImages?.right || multiviewFromArray[3] || '').trim()
      }
      const filledImageSlots = Object.entries(imageSlots).filter(([, path]) => path)
      const hasReferenceImages = filledImageSlots.length > 0
      const isMultiview = filledImageSlots.some(([slot]) => slot !== 'front')
      const isImageMode = hasReferenceImages && !isMultiview

      if (!trimmedPrompt && !hasReferenceImages) {
        return {
          success: false,
          error: 'A text prompt, a reference image, or multiview images are required.'
        }
      }

      for (const [, path] of filledImageSlots) {
        if (!existsSync(path)) {
          return { success: false, error: `Reference image file was not found: ${basename(path)}` }
        }
      }

      const status = await inspectTripoWebSessionForSync(
        normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL),
        normalizeExternalUrl(generateUrl, DEFAULT_TRIPO_WEB_GENERATE_URL)
      )
      if (!status.connected) {
        return {
          success: false,
          error:
            'No active Tripo website session was detected. Use Connect Account in Tripo settings and log in first.'
        }
      }

      const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

      event.sender.send('modeling:progress', { step: 'Opening Tripo website session…', pct: 8 })
      win = await createTripoWebWindow({
        url: normalizeExternalUrl(generateUrl, DEFAULT_TRIPO_WEB_GENERATE_URL),
        show: showBrowser,
        title: 'Tripo Automation'
      })
      networkCapture = attachTripoAssetsNetworkCapture(win)

      event.sender.send('modeling:progress', { step: 'Finding Tripo generation page…', pct: 16 })
      const targetSurface = await navigateToTripoGenerateSurface(
        win,
        normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL),
        normalizeExternalUrl(generateUrl, DEFAULT_TRIPO_WEB_GENERATE_URL)
      )
      if (!targetSurface.success) return { success: false, error: targetSurface.error }

      event.sender.send('modeling:progress', { step: 'Applying generation settings…', pct: 20 })
      await configureTripoWebGenerationOptions(win, {
        modelVersion,
        style: style || null,
        texture: texture !== false,
        pbr: pbr !== false,
        smartLowPoly: !!smartLowPoly
      })
      await wait(500)

      if (hasReferenceImages) {
        if (isMultiview) {
          event.sender.send('modeling:progress', {
            step: 'Uploading multiview reference images…',
            pct: 22
          })
          const upload = await uploadTripoMultiviewReferenceImages(win, imageSlots)
          if (!upload.success) {
            const legacyUpload = await uploadMultiviewImagesToTripoWebPage(
              win,
              filledImageSlots.map(([, path]) => path)
            )
            if (!legacyUpload.success) return { success: false, error: upload.error || legacyUpload.error }
          }
        } else {
          event.sender.send('modeling:progress', { step: 'Uploading reference image…', pct: 22 })
          const upload = await uploadTripoReferenceImage(win, imageSlots.front)
          if (!upload.success) {
            const legacyUpload = await uploadImageToTripoWebPage(win, imageSlots.front)
            if (!legacyUpload.success) return { success: false, error: upload.error || legacyUpload.error }
          }
        }
        await wait(750)
      }

      if (trimmedPrompt) {
        event.sender.send('modeling:progress', {
          step: 'Submitting prompt in browser session…',
          pct: isImageMode || isMultiview ? 30 : 24
        })
        const submit = await submitTripoWebPrompt(win, trimmedPrompt)
        if (!submit.success) return { success: false, error: submit.error }
      } else if (hasReferenceImages) {
        event.sender.send('modeling:progress', {
          step: isMultiview ? 'Triggering multiview-to-3D generation…' : 'Starting image-to-3D generation…',
          pct: 24
        })
        const started = await submitTripoWebPrompt(win, '')
        if (!started.success) {
          const triggered = await win.webContents.executeJavaScript(`
            (() => {
              const visible = (el) => {
                if (!el) return false
                const s = window.getComputedStyle(el)
                const r = el.getBoundingClientRect()
                return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 4 && r.height > 4
              }
              const textOf = (el) => (el?.innerText || el?.textContent || '').trim()
              const buttons = Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(visible)
              const btn = buttons.find(el => /generate|create|start|run/i.test(textOf(el)) && !/log in|sign in|download|export/i.test(textOf(el)))
              if (btn) { btn.click(); return { success: true, button: textOf(btn) } }
              return { success: false, error: 'Could not find a Generate/Create button.' }
            })()
          `)
          if (!triggered?.success) {
            return { success: false, error: started.error || triggered?.error || 'Could not trigger generation.' }
          }
        }
      }

      event.sender.send('modeling:progress', { step: 'Waiting for Tripo to finish generating…', pct: 35 })
      const generationState = await waitForTripoGenerationComplete(win, 300000)
      if (generationState.failed) {
        return {
          success: false,
          error: 'Tripo reported that generation failed. Check the browser session and try again.'
        }
      }

      const networkUrls = parseTripoModelUrlsFromNetworkPayloads(networkCapture?.payloads || [])
      const directOutputPath = await tryDirectTripoDownloads(networkUrls, outDir, downloadFormat)
      if (directOutputPath) {
        event.sender.send('modeling:progress', { step: 'Model ready!', pct: 100 })
        const provider = isMultiview ? 'tripo-web-multiview' : isImageMode ? 'tripo-web-image' : 'tripo-web'
        return { success: true, outputPath: directOutputPath, provider }
      }

      event.sender.send('modeling:progress', { step: 'Downloading model from Tripo…', pct: 82 })
      const tempOutputPath = await importTripoModelViaBrowser(win, outDir, {
        preferredFormat: downloadFormat,
        timeoutMs: 180000
      })
      event.sender.send('modeling:progress', { step: 'Model ready!', pct: 100 })
      const provider = isMultiview ? 'tripo-web-multiview' : isImageMode ? 'tripo-web-image' : 'tripo-web'
      return { success: true, outputPath: tempOutputPath, provider }
    } catch (err) {
      return {
        success: false,
        error:
          err.message ||
          'Tripo website automation failed. Keep the browser session connected and update the generation URL if the site layout changed.'
      }
    } finally {
      networkCapture?.detach()
      if (win && !keepWindowOpen) win.destroy()
    }
  }
)

// ── Blender path detection ────────────────────────────────────────────────

function findBlenderExecutable(customPath) {
  if (customPath && existsSync(customPath)) return customPath

  const candidates =
    process.platform === 'win32'
      ? [
          ...['4.4', '4.3', '4.2', '4.1', '4.0', '3.6'].map(
            (v) => `C:\\Program Files\\Blender Foundation\\Blender ${v}\\blender.exe`
          ),
          'blender.exe'
        ]
      : process.platform === 'darwin'
        ? ['/Applications/Blender.app/Contents/MacOS/Blender', '/usr/local/bin/blender', 'blender']
        : ['/usr/bin/blender', '/usr/local/bin/blender', 'blender']

  return candidates.find((p) => existsSync(p)) || candidates[candidates.length - 1]
}

// ── Mesh retopology (Blender QuadriFlow) ─────────────────────────────────

ipcMain.handle('mesh:retopologyBlender', async (event, { inputPath, targetFaces = 2000, blenderPath } = {}) => {
  if (!inputPath || !existsSync(inputPath)) {
    return { success: false, error: 'Input file not found.' }
  }

  const blender = findBlenderExecutable(blenderPath || loadConfig().blenderPath)
  const scriptPath = join(getPythonDir(), 'retopo_blender.py')
  const outputPath = inputPath.replace(/(\.[^.]+)$/, '_retopo.glb')

  event.sender.send('mesh:retopologyProgress', { step: 'Starting Blender QuadriFlow retopology…', pct: 5 })

  return new Promise((resolve) => {
    let proc
    try {
      proc = spawn(blender, ['--background', '--python', scriptPath, '--', inputPath, outputPath, String(targetFaces)])
    } catch (spawnErr) {
      resolve({ success: false, error: `Could not start Blender: ${spawnErr.message}. Make sure Blender is installed.` })
      return
    }

    let stderr = ''

    proc.stdout.on('data', (data) => {
      const msg = data.toString()
      const progressMatch = msg.match(/PROGRESS:(\d+)/)
      if (progressMatch) {
        event.sender.send('mesh:retopologyProgress', { step: 'Remeshing with QuadriFlow…', pct: parseInt(progressMatch[1]) })
      }
      const errorMatch = msg.match(/ERROR:(.+)/)
      if (errorMatch) {
        event.sender.send('mesh:retopologyProgress', { step: `Blender: ${errorMatch[1].trim()}`, pct: 0 })
      }
    })

    proc.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    proc.on('close', (code) => {
      if (code === 0 && existsSync(outputPath)) {
        event.sender.send('mesh:retopologyProgress', { step: 'Retopology complete!', pct: 100 })
        resolve({ success: true, outputPath })
      } else {
        const msg =
          stderr.slice(0, 400) ||
          `Blender exited with code ${code}. Ensure Blender (3.6+) is installed and accessible.`
        resolve({ success: false, error: msg })
      }
    })

    proc.on('error', (err) => {
      resolve({
        success: false,
        error: `Could not start Blender: ${err.message}. Ensure Blender is installed and the path is correct.`
      })
    })
  })
})

// ── Mesh optimization (polygon simplification + dedup/prune) ─────────────

ipcMain.handle('mesh:optimize', async (_, { inputPath, ratio = 0.5 } = {}) => {
  if (!inputPath || !existsSync(inputPath)) {
    return { success: false, error: 'Input file not found.' }
  }

  try {
    const { NodeIO } = await import('@gltf-transform/core')
    const { simplify, dedup, prune, reorder, quantize } = await import('@gltf-transform/functions')
    const { MeshoptSimplifier, MeshoptEncoder } = await import('meshoptimizer')

    await MeshoptSimplifier.ready
    await MeshoptEncoder.ready

    const io = new NodeIO()
    const document = await io.read(inputPath)

    const transforms = [
      dedup(),
      prune(),
      ...(ratio < 1.0 ? [simplify({ simplifier: MeshoptSimplifier, ratio: Math.max(0.01, Math.min(1.0, ratio)), error: 0.001 })] : []),
      reorder({ encoder: MeshoptEncoder }),
      quantize()
    ]

    await document.transform(...transforms)

    const ext = inputPath.match(/\.[^.]+$/)?.[0] || '.glb'
    const outputPath = inputPath.replace(/(\.[^.]+)$/, `_optimized${ext}`)
    await io.write(outputPath, document)

    const inputSize = statSync(inputPath).size
    const outputSize = statSync(outputPath).size
    const saved = Math.max(0, Math.round((1 - outputSize / inputSize) * 100))

    return { success: true, outputPath, inputSize, outputSize, saved }
  } catch (err) {
    return { success: false, error: err.message }
  }
})

// ── App lifecycle ─────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.ai-game-dev-hub')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

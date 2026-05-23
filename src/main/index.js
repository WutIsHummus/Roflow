import { app, shell, BrowserWindow, ipcMain, dialog, session, clipboard } from 'electron'
import { basename, extname, join } from 'path'
import { spawn } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  readdirSync,
  statSync
} from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let mainWindow = null
const TRIPO_WEB_PARTITION = 'persist:tripo-web'
const DEFAULT_TRIPO_WEB_BASE_URL = 'https://www.tripo3d.ai/'
const DEFAULT_TRIPO_WEB_GENERATE_URL = 'https://www.tripo3d.ai/'
const MANUS_WEB_PARTITION = 'persist:manus-web'
const DEFAULT_MANUS_WEB_LOGIN_URL = 'https://manus.im/'
const DEFAULT_MANUS_WEB_WORKSPACE_URL = 'https://manus.im/'
const CHATGPT_WEB_PARTITION = 'persist:chatgpt-web'
const DEFAULT_CHATGPT_WEB_LOGIN_URL = 'https://chatgpt.com/auth/login'
const DEFAULT_CHATGPT_WEB_WORKSPACE_URL = 'https://chatgpt.com/'

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

function getWorkspaceModelDir() {
  return join(app.getPath('temp'), 'ai-game-dev-hub')
}

function getPersistentModelLibraryDir() {
  return join(app.getPath('userData'), 'generated-models')
}

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true })
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

function persistGeneratedModel({
  sourcePath,
  name = '',
  prompt = '',
  provider = 'workspace',
  sourceTab = null
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
        savedAt: Date.now()
      },
      null,
      2
    ),
    'utf8'
  )

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

function getProviderWebSession(partition) {
  return session.fromPartition(partition)
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
      const openHost = new URL(details.url).hostname
      const baseHost = new URL(url).hostname
      if (openHost === baseHost || openHost.endsWith(`.${baseHost}`)) {
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
    await wait(2500)
    const snapshot = await win.webContents.executeJavaScript(`
      (() => {
        const visible = (el) => {
          if (!el) return false
          const style = window.getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
        }
        const promptCandidates = Array.from(
          document.querySelectorAll('textarea,[contenteditable="true"],input[type="text"],input:not([type])')
        ).filter(visible)
        const buttonTexts = Array.from(document.querySelectorAll('button,a,[role="button"]'))
          .filter(visible)
          .map((el) => (el.innerText || el.textContent || '').trim())
          .filter(Boolean)
          .slice(0, 40)
        const bodyText = (document.body?.innerText || '').slice(0, 2000)
        const passwordInputs = document.querySelectorAll('input[type="password"]').length
        return {
          href: location.href,
          title: document.title,
          promptCandidates: promptCandidates.length,
          passwordInputs,
          buttonTexts,
          bodyText
        }
      })()
    `)

    const loginDetected =
      snapshot.passwordInputs > 0 ||
      /log in|login|sign in|continue with google|continue with microsoft|continue with apple/i.test(
        snapshot.bodyText
      )

    const connected =
      !loginDetected &&
      (snapshot.promptCandidates > 0 ||
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
    workspaceUrl: generateUrl || baseUrl,
    title: 'Tripo Session Check',
    readyPattern: /generate|create|text to 3d|new project/i
  })
}

async function navigateToTripoGenerateSurface(win, baseUrl, generateUrl) {
  const normalizedBaseUrl = normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL).replace(/\/$/, '')
  const candidates = Array.from(
    new Set([
      normalizeExternalUrl(generateUrl, DEFAULT_TRIPO_WEB_GENERATE_URL),
      normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL),
      `${normalizedBaseUrl}/app`,
      `${normalizedBaseUrl}/generate`,
      `${normalizedBaseUrl}/text-to-3d`
    ])
  )

  for (const url of candidates) {
    await win.loadURL(url)
    await wait(2500)
    const found = await win.webContents.executeJavaScript(`
      (() => {
        const visible = (el) => {
          if (!el) return false
          const style = window.getComputedStyle(el)
          const rect = el.getBoundingClientRect()
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
        }

        const getText = (el) => (el?.innerText || el?.textContent || '').trim()
        const promptCandidates = Array.from(document.querySelectorAll('textarea,[contenteditable="true"],input[type="text"],input:not([type])'))
          .filter(visible)
          .filter((el) => {
            const text = [el.placeholder, el.getAttribute('aria-label'), el.getAttribute('name'), getText(el.parentElement)]
              .filter(Boolean)
              .join(' ')
            return /prompt|describe|create|generate|model|3d|what/i.test(text) || el.tagName === 'TEXTAREA'
          })

        if (promptCandidates.length > 0) {
          return { found: true, url: location.href, title: document.title }
        }

        const navTarget = Array.from(document.querySelectorAll('button,a,[role="button"]'))
          .filter(visible)
          .find((el) => /text to 3d|generate|create model|new project|new model|try now/i.test(getText(el)))

        if (navTarget) {
          navTarget.click()
          return { found: false, navigated: true }
        }

        return { found: false, navigated: false }
      })()
    `)

    if (found.found) return { success: true, ...found }
    if (found.navigated) {
      await wait(2500)
      const secondPass = await win.webContents.executeJavaScript(`
        (() => {
          const visible = (el) => {
            if (!el) return false
            const style = window.getComputedStyle(el)
            const rect = el.getBoundingClientRect()
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
          }
          const promptCandidates = Array.from(document.querySelectorAll('textarea,[contenteditable="true"],input[type="text"],input:not([type])')).filter(visible)
          return { found: promptCandidates.length > 0, url: location.href, title: document.title }
        })()
      `)
      if (secondPass.found) return { success: true, ...secondPass }
    }
  }

  return { success: false, error: 'Could not find Tripo generation UI. Update the generation URL in settings and reconnect your browser session.' }
}

function getTripoHistoryUrlCandidates(baseUrl, generateUrl) {
  const normalizedBaseUrl = normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL).replace(/\/$/, '')
  const lastHistoryUrl = normalizeExternalUrl(
    loadConfig().tripoWebLastHistoryUrl,
    DEFAULT_TRIPO_WEB_BASE_URL
  ).replace(/\/$/, '')
  return Array.from(
    new Set([
      lastHistoryUrl,
      `${normalizedBaseUrl}/history`,
      `${normalizedBaseUrl}/app/history`,
      `${normalizedBaseUrl}/my-creations`,
      `${normalizedBaseUrl}/my-creation`,
      `${normalizedBaseUrl}/assets`,
      `${normalizedBaseUrl}/models`,
      `${normalizedBaseUrl}/library`,
      `${normalizedBaseUrl}/app/assets`,
      `${normalizedBaseUrl}/app/models`,
      normalizeExternalUrl(generateUrl, DEFAULT_TRIPO_WEB_GENERATE_URL),
      `${normalizedBaseUrl}/app`,
      normalizedBaseUrl
    ].filter(Boolean))
  )
}

async function waitForTripoHistoryItems(win, timeoutMs = 2500) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const scraped = await scrapeTripoHistoryItems(win)
    if (scraped.items?.length) return scraped
    await wait(250)
  }

  return scrapeTripoHistoryItems(win)
}

async function scrapeTripoHistoryItems(win) {
  return win.webContents.executeJavaScript(`
    (() => {
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
      }

      const textOf = (el) => (el?.innerText || el?.textContent || '').replace(/\\s+/g, ' ').trim()
      const absolute = (value) => {
        if (!value) return ''
        try {
          return new URL(value, location.href).href
        } catch {
          return ''
        }
      }

      const items = []
      const seen = new Set()

      const collect = (sourceEl) => {
        if (!sourceEl) return
        const card =
          sourceEl.closest('article,li,[role="listitem"],a[href],button,[role="button"],div,section') ||
          sourceEl
        if (!card || !visible(card)) return

        const previewImage = Array.from(card.querySelectorAll('img')).find(visible)
        const anchor = card.matches('a[href]') ? card : card.querySelector('a[href]')
        const buttons = Array.from(card.querySelectorAll('button,a,[role="button"]')).filter(visible)
        const actionTexts = buttons.map(textOf).filter(Boolean).slice(0, 8)
        const titleNode = card.querySelector(
          'h1,h2,h3,h4,[class*="title"],[data-testid*="title"],[data-title]'
        )
        const cardText = textOf(card)
        const lines = cardText
          .split(/\\n+/)
          .map((line) => line.trim())
          .filter(Boolean)
        const title =
          textOf(titleNode) ||
          previewImage?.alt ||
          lines.find((line) => line.length > 2 && line.length < 120) ||
          ''
        const prompt =
          lines.find((line) => line !== title && line.length > 8 && line.length < 240) || ''
        const detailUrl = absolute(anchor?.href || card.getAttribute('data-href') || '')
        const downloadUrl =
          Array.from(card.querySelectorAll('a[href]'))
            .map((link) => absolute(link.href))
            .find((href) => /\\.(glb|gltf)(\\?|$)/i.test(href)) || ''
        const key = detailUrl || downloadUrl || [title, prompt, previewImage?.src || ''].join('|')

        if (!key || seen.has(key)) return
        if (!title && !previewImage) return
        if (
          !detailUrl &&
          !downloadUrl &&
          !actionTexts.some((text) => /open|view|detail|download|export|history|model/i.test(text))
        ) {
          return
        }

        seen.add(key)
        items.push({
          id: key,
          name: title || 'Untitled Tripo Asset',
          prompt,
          previewUrl: previewImage?.src || '',
          detailUrl,
          downloadUrl,
          actionTexts
        })
      }

      Array.from(document.querySelectorAll('img')).filter(visible).forEach(collect)

      Array.from(document.querySelectorAll('a[href],button,[role="button"]'))
        .filter(visible)
        .forEach((el) => {
          if (/history|asset|model|creation|open|view|detail|download|export/i.test(textOf(el))) {
            collect(el)
          }
        })

      return {
        url: location.href,
        title: document.title,
        items: items.slice(0, 80)
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
  const status = await inspectTripoWebSession(baseUrl, generateUrl)
  if (!status.connected) {
    return {
      success: false,
      error:
        'No active Tripo website session was detected. Connect your account and make sure the session is ready first.'
    }
  }

  let win = null
  try {
    const candidates = getTripoHistoryUrlCandidates(baseUrl, generateUrl)
    win = await createTripoWebWindow({
      url: candidates[0],
      show: false,
      title: 'Tripo History Sync'
    })

    for (const url of candidates) {
      await win.loadURL(url)

      for (let pass = 0; pass < 2; pass++) {
        const scraped = await waitForTripoHistoryItems(win, pass === 0 ? 2000 : 1500)
        if (scraped.items?.length) {
          saveConfig({ ...loadConfig(), tripoWebLastHistoryUrl: scraped.url })
          return { success: true, items: scraped.items, sourceUrl: scraped.url, title: scraped.title }
        }

        const nav = await clickTripoHistoryNavigation(win)
        if (!nav.clicked) break
      }
    }

    return {
      success: false,
      error:
        'Could not find any assets in Tripo History. Open your history/library page once in the browser session and try syncing again.'
    }
  } finally {
    if (win) win.destroy()
  }
}

async function importTripoHistoryItem({ detailUrl, downloadUrl, name = '', prompt = '', sourceTab = null }) {
  const outDir = getWorkspaceModelDir()
  ensureDir(outDir)

  let win = null
  try {
    const targetUrl = downloadUrl || detailUrl
    if (!targetUrl) {
      return { success: false, error: 'History item is missing a Tripo URL to import from.' }
    }

    win = await createTripoWebWindow({
      url: targetUrl,
      show: false,
      title: 'Tripo History Import'
    })

    const downloadPromise = captureTripoWebDownload(win, outDir)

    if (downloadUrl && /\.(glb|gltf)(\?|$)/i.test(downloadUrl)) {
      win.webContents.downloadURL(downloadUrl)
    } else {
      for (let attempt = 0; attempt < 60; attempt++) {
        const action = await triggerTripoWebDownload(win)
        if (action.action === 'downloadURL' && action.url) {
          win.webContents.downloadURL(action.url)
          break
        }
        if (action.action === 'clicked') {
          await wait(1500)
        } else {
          await wait(2000)
        }
      }
    }

    const tempOutputPath = await downloadPromise
    const item = persistGeneratedModel({
      sourcePath: tempOutputPath,
      name,
      prompt,
      provider: 'tripo-history',
      sourceTab
    })
    return { success: true, item }
  } catch (err) {
    return { success: false, error: err.message || 'Could not import the selected Tripo history asset.' }
  } finally {
    if (win) win.destroy()
  }
}

async function submitTripoWebPrompt(win, prompt) {
  return win.webContents.executeJavaScript(`
    ((promptText) => {
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
      }

      const textOf = (el) => (el?.innerText || el?.textContent || '').trim()
      const promptTargets = Array.from(document.querySelectorAll('textarea,[contenteditable="true"],input[type="text"],input:not([type])'))
        .filter(visible)
        .sort((a, b) => (b.tagName === 'TEXTAREA') - (a.tagName === 'TEXTAREA'))

      const target = promptTargets[0]
      if (!target) return { success: false, error: 'No visible prompt input was found on the page.' }

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

      const buttons = Array.from(document.querySelectorAll('button,a,[role="button"]'))
        .filter(visible)
      const action = buttons.find((el) => {
        const text = textOf(el)
        return /generate|create|start|run/i.test(text) && !/log in|sign in|download|export/i.test(text)
      })

      if (!action) {
        return { success: false, error: 'Filled the prompt, but could not find a Generate/Create button.' }
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

async function triggerTripoWebDownload(win, preferredFormat = 'glb') {
  return win.webContents.executeJavaScript(`
    ((fmt) => {
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
      }
      const textOf = (el) => (el?.innerText || el?.textContent || '').trim()

      // If a non-GLB format is requested, try to find and click a format selector first
      if (fmt !== 'glb') {
        const fmtRe = new RegExp('^' + fmt + '$', 'i')
        const fmtBtn = Array.from(document.querySelectorAll('button,a,[role="button"],li,[role="option"]'))
          .filter(visible)
          .find(el => fmtRe.test(textOf(el).split(/[\\s/|,]/)[0]))
        if (fmtBtn) { fmtBtn.click(); return { action: 'format', format: textOf(fmtBtn) } }
      }

      const directLink = Array.from(document.querySelectorAll('a[href]'))
        .filter(visible)
        .find((el) => /\\.glb(\\?|$)/i.test(el.href) || /download|export|glb/i.test(textOf(el)))

      if (directLink?.href) {
        return { action: 'downloadURL', url: directLink.href, label: textOf(directLink) }
      }

      const buttons = Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(visible)
      const clickTarget = buttons.find((el) => /download|export|glb/i.test(textOf(el)))
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
      webp: 'image/webp'
    }[ext] || 'application/octet-stream'
  )
}

function filePathToDataUrl(filePath) {
  const data = readFileSync(filePath)
  return `data:${getMimeTypeForPath(filePath)};base64,${data.toString('base64')}`
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

ipcMain.handle('animation:textToMotion', async (event, { prompt, model, duration }) => {
  const send = (step, pct) => event.sender.send('animation:progress', { step, pct })
  try {
    const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

    const { Client } = await import('@gradio/client')

    send('Connecting to HY-Motion...', 10)
    const client = await Client.connect('tencent/HY-Motion-1.0', { hf_token: undefined })

    send('Generating motion with HY-Motion 1.0...', 30)
    const result = await client.predict('/generate', {
      text: prompt,
      motion_length: duration,
      num_seeds: 1,
      // Lite mode uses a lighter checkpoint if the space supports it
      ...(model === 'hymotion-lite' ? { model_variant: 'lite' } : {})
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

    const stem = sanitizeFileStem(payload?.effectName || 'roblox-vfx')
    const presetPath = join(folderPath, `${stem}.preset.json`)
    const luaPath = join(folderPath, `${stem}.module.lua`)
    const workflowPath = join(folderPath, `${stem}.workflow.txt`)

    writeFileSync(presetPath, JSON.stringify(payload?.preset ?? {}, null, 2), 'utf8')
    writeFileSync(luaPath, String(payload?.luaScript ?? ''), 'utf8')
    writeFileSync(workflowPath, String(payload?.workflowText ?? ''), 'utf8')

    return {
      success: true,
      folderPath,
      files: { presetPath, luaPath, workflowPath }
    }
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

ipcMain.handle('modeling:listGeneratedModels', async () => {
  try {
    const items = [
      ...listGeneratedModelItemsInDir(getPersistentModelLibraryDir()),
      ...listGeneratedModelItemsInDir(getWorkspaceModelDir())
    ]
      .sort((a, b) => b.modifiedAt - a.modifiedAt)

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
    return JSON.parse(readFileSync(getConfigPath(), 'utf8'))
  } catch {
    return {}
  }
}
function saveConfig(cfg) {
  writeFileSync(getConfigPath(), JSON.stringify(cfg, null, 2))
}

ipcMain.handle('config:get', (_, key) => loadConfig()[key] ?? null)
ipcMain.handle('config:set', (_, key, value) => {
  const cfg = loadConfig()
  cfg[key] = value
  saveConfig(cfg)
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
      if (!apiToken?.trim()) {
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
        apiToken: apiToken.trim(),
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
            Authorization: `Bearer ${apiToken.trim()}`
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
          apiToken: apiToken.trim()
        })
      }

      return { success: false, error: 'Timed out waiting for Replicate output.' }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }
)

// ── IPC: Tripo Website Session Wrapper ──────────────────────────────────────

ipcMain.handle('tripo:webOpenLogin', async (_, { baseUrl } = {}) => {
  try {
    const url = normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL)
    await createTripoWebWindow({ url, show: true, title: 'Connect Tripo Account' })
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
    return await inspectTripoWebSession(
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

ipcMain.handle(
  'tripo:webGenerate',
  async (
    event,
    {
      prompt = '',
      imagePath = '',
      multiviewImages = [],
      baseUrl,
      generateUrl,
      showBrowser = true,
      keepWindowOpen = false,
      downloadFormat = 'glb'
    } = {}
  ) => {
    let win = null
    const isMultiview = Array.isArray(multiviewImages) && multiviewImages.some(Boolean)
    const isImageMode = Boolean(imagePath && imagePath.trim())

    try {
      if (!prompt.trim() && !isImageMode && !isMultiview) {
        return { success: false, error: 'A text prompt, a reference image, or multiview images are required.' }
      }

      const status = await inspectTripoWebSession(
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

      event.sender.send('modeling:progress', { step: 'Finding Tripo generation page…', pct: 16 })
      const targetSurface = await navigateToTripoGenerateSurface(
        win,
        normalizeExternalUrl(baseUrl, DEFAULT_TRIPO_WEB_BASE_URL),
        normalizeExternalUrl(generateUrl, DEFAULT_TRIPO_WEB_GENERATE_URL)
      )
      if (!targetSurface.success) return { success: false, error: targetSurface.error }

      if (isMultiview) {
        event.sender.send('modeling:progress', { step: 'Uploading multiview images to Tripo…', pct: 20 })
        const upload = await uploadMultiviewImagesToTripoWebPage(win, multiviewImages.filter(Boolean))
        if (!upload.success) return { success: false, error: upload.error }
        await wait(1500)
      } else if (isImageMode) {
        event.sender.send('modeling:progress', { step: 'Uploading reference image to Tripo…', pct: 22 })
        const upload = await uploadImageToTripoWebPage(win, imagePath.trim())
        if (!upload.success) return { success: false, error: upload.error }
        await wait(1500)
      }

      if (prompt.trim()) {
        event.sender.send('modeling:progress', { step: 'Submitting prompt in browser session…', pct: isImageMode || isMultiview ? 30 : 24 })
        const submit = await submitTripoWebPrompt(win, prompt.trim())
        if (!submit.success) return { success: false, error: submit.error }
      } else {
        // Image/multiview-only: click generate/create button without typing a prompt
        event.sender.send('modeling:progress', { step: isMultiview ? 'Triggering multiview-to-3D generation…' : 'Triggering image-to-3D generation…', pct: 30 })
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
        if (!triggered?.success) return { success: false, error: triggered?.error || 'Could not trigger generation.' }
      }

      const downloadPromise = captureTripoWebDownload(win, outDir)

      for (let attempt = 0; attempt < 80; attempt++) {
        await wait(4000)
        const pct = Math.min(92, 30 + attempt)
        event.sender.send('modeling:progress', { step: 'Waiting for Tripo result…', pct })
        const action = await triggerTripoWebDownload(win, downloadFormat)
        if (action.action === 'downloadURL' && action.url) {
          win.webContents.downloadURL(action.url)
          break
        }
        if (action.action === 'clicked' || action.action === 'format') {
          // Allow the page to open export menus or trigger a native download event.
          await wait(1500)
        }
      }

      const outputPath = await downloadPromise
      event.sender.send('modeling:progress', { step: 'Model ready!', pct: 100 })
      const provider = isMultiview ? 'tripo-web-multiview' : isImageMode ? 'tripo-web-image' : 'tripo-web'
      return { success: true, outputPath, provider }
    } catch (err) {
      return {
        success: false,
        error:
          err.message ||
          'Tripo website automation failed. Keep the browser session connected and update the generation URL if the site layout changed.'
      }
    } finally {
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

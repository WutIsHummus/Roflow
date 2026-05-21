import { app, shell, BrowserWindow, ipcMain, dialog, session } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

let mainWindow = null
const TRIPO_WEB_PARTITION = 'persist:tripo-web'
const DEFAULT_TRIPO_WEB_BASE_URL = 'https://www.tripo3d.ai/'
const DEFAULT_TRIPO_WEB_GENERATE_URL = 'https://www.tripo3d.ai/'

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

function getTripoWebSession() {
  return session.fromPartition(TRIPO_WEB_PARTITION)
}

async function createTripoWebWindow({ url, show = true, title = 'Tripo Browser Session' }) {
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
      partition: TRIPO_WEB_PARTITION,
      sandbox: true
    }
  })

  win.webContents.setWindowOpenHandler((details) => {
    win.loadURL(details.url)
    return { action: 'deny' }
  })

  await win.loadURL(url)
  return win
}

async function inspectTripoWebSession(baseUrl, generateUrl) {
  const sessionCookies = await getTripoWebSession().cookies.get({})
  const win = await createTripoWebWindow({ url: generateUrl || baseUrl, show: false, title: 'Tripo Session Check' })

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
        const candidates = Array.from(document.querySelectorAll('textarea,[contenteditable="true"],input[type="text"],input:not([type])'))
          .filter(visible)
        const buttonTexts = Array.from(document.querySelectorAll('button,a,[role="button"]'))
          .filter(visible)
          .map((el) => (el.innerText || el.textContent || '').trim())
          .filter(Boolean)
          .slice(0, 20)
        const bodyText = (document.body?.innerText || '').slice(0, 1500)
        const passwordInputs = document.querySelectorAll('input[type="password"]').length
        return {
          href: location.href,
          title: document.title,
          promptCandidates: candidates.length,
          passwordInputs,
          buttonTexts,
          bodyText
        }
      })()
    `)

    const loginDetected =
      snapshot.passwordInputs > 0 ||
      /log in|sign in|continue with google|continue with discord/i.test(snapshot.bodyText)
    const connected =
      !loginDetected &&
      (snapshot.promptCandidates > 0 ||
        snapshot.buttonTexts.some((text) => /generate|create|text to 3d|new project/i.test(text)))

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

async function triggerTripoWebDownload(win) {
  return win.webContents.executeJavaScript(`
    (() => {
      const visible = (el) => {
        if (!el) return false
        const style = window.getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 4 && rect.height > 4
      }
      const textOf = (el) => (el?.innerText || el?.textContent || '').trim()

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
    })()
  `)
}

// ── IPC: File Dialogs ──────────────────────────────────────────────────────

ipcMain.handle('dialog:openVideo', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Video File',
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm'] }],
    properties: ['openFile']
  })
  return result.canceled ? null : result.filePaths[0]
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
// Backends (in priority order):
//   1. hymotion-local  → user's local HY-Motion Gradio app (localhost:7860)
//   2. hymotion-comfy  → ComfyUI-HY-Motion1 plugin (localhost:8188)
//   3. hymotion-hf     → tencent/HY-Motion-1.0 HuggingFace Space (cloud)
//   4. momask          → MeYourHint/MoMask HF Space (fallback)
//   5. mdm             → EricGuo5513/MDM-Text-to-Motion HF Space (fallback)

async function downloadFile(url, destPath) {
  const https = await import('https')
  const http = await import('http')
  const { createWriteStream } = await import('fs')
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https.default || https : http.default || http
    const file = createWriteStream(destPath)
    protocol
      .get(url, (res) => {
        res.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      })
      .on('error', (e) => {
        file.close()
        reject(e)
      })
  })
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

ipcMain.handle('animation:textToMotion', async (event, { prompt, model, duration }) => {
  const send = (step, pct) => event.sender.send('animation:progress', { step, pct })
  try {
    const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

    const { Client } = await import('@gradio/client')

    send('Connecting to HY-Motion HuggingFace Space...', 10)
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
    return { success: false, error: err.message }
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
    const ext = filePath.split('.').pop().toLowerCase()
    const mime =
      ext === 'glb'
        ? 'model/gltf-binary'
        : ext === 'gltf'
          ? 'model/gltf+json'
          : 'application/octet-stream'
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
    return { success: true, dataUrl }
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

// ── IPC: Modeling — Generate 3D Model (Gradio HF Space) ───────────────────

ipcMain.handle('modeling:generate', async (event, { prompt, imagePath, mode }) => {
  try {
    event.sender.send('modeling:progress', { step: 'Connecting to HuggingFace Space...', pct: 10 })

    const { Client } = await import('@gradio/client')

    let client, result

    if (mode === 'image' && imagePath) {
      // TripoSR: image → 3D
      event.sender.send('modeling:progress', { step: 'Running TripoSR (image → 3D)...', pct: 25 })
      client = await Client.connect('stabilityai/TripoSR')
      const imageBlob = await (await import('fs')).promises.readFile(imagePath)
      result = await client.predict('/generate', { image: new Blob([imageBlob]) })
    } else {
      // Shap-E: text → 3D
      event.sender.send('modeling:progress', { step: 'Running Shap-E (text → 3D)...', pct: 25 })
      client = await Client.connect('hysts/Shap-E')
      result = await client.predict('/generate-3d', { prompt })
    }

    event.sender.send('modeling:progress', { step: 'Processing 3D output...', pct: 80 })

    const outputData = result?.data
    // Save output file to temp dir
    const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

    let outputPath = null
    // HF Spaces typically return a file URL or blob
    if (outputData && outputData[0]) {
      const item = outputData[0]
      if (item?.url) {
        // Download file from URL
        const https = await import('https')
        const http = await import('http')
        const { createWriteStream } = await import('fs')
        const ext = item.url.includes('.glb') ? 'glb' : item.url.includes('.obj') ? 'obj' : 'glb'
        outputPath = join(outDir, `model_${Date.now()}.${ext}`)
        await new Promise((resolve, reject) => {
          const protocol = item.url.startsWith('https') ? https : http
          const file = createWriteStream(outputPath)
          protocol
            .get(item.url, (res) => {
              res.pipe(file)
              file.on('finish', resolve)
            })
            .on('error', reject)
        })
      } else if (item?.path) {
        outputPath = item.path
      }
    }

    event.sender.send('modeling:progress', { step: 'Model ready!', pct: 100 })
    return { success: true, outputPath, type: mode === 'image' ? 'triposr' : 'shape' }
  } catch (err) {
    return { success: false, error: err.message }
  }
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

ipcMain.handle(
  'tripo:webGenerate',
  async (
    event,
    {
      prompt = '',
      imagePath = '',
      baseUrl,
      generateUrl,
      showBrowser = true,
      keepWindowOpen = false
    } = {}
  ) => {
    let win = null
    try {
      if (!prompt.trim()) {
        return { success: false, error: 'Prompt is required for Tripo website automation.' }
      }
      if (imagePath) {
        return { success: false, error: 'Website automation currently supports text-to-3D prompts only.' }
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

      event.sender.send('modeling:progress', { step: 'Submitting prompt in browser session…', pct: 24 })
      const submit = await submitTripoWebPrompt(win, prompt.trim())
      if (!submit.success) return { success: false, error: submit.error }

      const downloadPromise = captureTripoWebDownload(win, outDir)

      for (let attempt = 0; attempt < 80; attempt++) {
        await wait(4000)
        const pct = Math.min(92, 30 + attempt)
        event.sender.send('modeling:progress', { step: 'Waiting for Tripo result…', pct })
        const action = await triggerTripoWebDownload(win)
        if (action.action === 'downloadURL' && action.url) {
          win.webContents.downloadURL(action.url)
          break
        }
        if (action.action === 'clicked') {
          // Allow the page to open export menus or trigger a native download event.
          await wait(1500)
        }
      }

      const outputPath = await downloadPromise
      event.sender.send('modeling:progress', { step: 'Model ready!', pct: 100 })
      return { success: true, outputPath, provider: 'tripo-web' }
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

// ── IPC: Tripo3D API ─────────────────────────────────────────────────────

const TRIPO_BASE = 'https://api.tripo3d.ai/v2/openapi'

async function tripoRequest(method, path, body, apiKey) {
  const https = await import('https')
  const url = new URL(TRIPO_BASE + path)
  const data = body ? JSON.stringify(body) : null
  return new Promise((resolve, reject) => {
    const req = https.default.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let raw = ''
        res.on('data', (d) => (raw += d))
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw))
          } catch {
            reject(new Error('Invalid JSON: ' + raw.slice(0, 200)))
          }
        })
      }
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

async function tripoUploadImage(imagePath, apiKey) {
  const https = await import('https')
  const path_ = await import('path')
  const filename = path_.basename(imagePath)
  const ext = filename.split('.').pop().toLowerCase()
  const mime =
    { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] ||
    'image/jpeg'

  const boundary = `boundary${Date.now()}`
  const fileData = readFileSync(imagePath)
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
  )
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`)
  const bodyBuf = Buffer.concat([prefix, fileData, suffix])

  return new Promise((resolve, reject) => {
    const req = https.default.request(
      {
        hostname: 'api.tripo3d.ai',
        path: '/v2/openapi/upload',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuf.length
        }
      },
      (res) => {
        let raw = ''
        res.on('data', (d) => (raw += d))
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw))
          } catch {
            reject(new Error(raw.slice(0, 200)))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(bodyBuf)
    req.end()
  })
}

ipcMain.handle('tripo:getBalance', async (_, { apiKey }) => {
  try {
    const res = await tripoRequest('GET', '/user/balance', null, apiKey)
    if (res.code === 0) return { success: true, balance: res.data.balance, frozen: res.data.frozen }
    return { success: false, error: res.message || 'API error' }
  } catch (e) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle(
  'tripo:generate',
  async (
    event,
    {
      apiKey,
      type,
      prompt,
      imagePath,
      texture = true,
      pbr = true,
      style = null,
      smartLowPoly = false,
      modelVersion = 'v2.5-20250123'
    }
  ) => {
    try {
      const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

      event.sender.send('modeling:progress', { step: 'Connecting to Tripo3D API...', pct: 8 })

      const taskBody = {
        model_version: modelVersion,
        texture,
        pbr,
        smart_low_poly: smartLowPoly
      }
      if (style) taskBody.style = style

      if (type === 'image' && imagePath) {
        event.sender.send('modeling:progress', { step: 'Uploading reference image...', pct: 15 })
        const uploadRes = await tripoUploadImage(imagePath, apiKey)
        if (uploadRes.code !== 0)
          return { success: false, error: uploadRes.message || 'Upload failed' }
        taskBody.type = 'image_to_model'
        taskBody.file = { type: 'jpg', file_token: uploadRes.data.image_token }
      } else {
        taskBody.type = 'text_to_model'
        taskBody.prompt = prompt
      }

      event.sender.send('modeling:progress', { step: 'Creating generation task...', pct: 22 })
      const createRes = await tripoRequest('POST', '/task', taskBody, apiKey)
      if (createRes.code !== 0)
        return { success: false, error: createRes.message || 'Task creation failed' }

      const taskId = createRes.data.task_id
      event.sender.send('modeling:progress', {
        step: `Task queued (${taskId.slice(0, 8)}…)`,
        pct: 28
      })

      // Poll until done
      let attempts = 0
      while (attempts < 150) {
        await new Promise((r) => setTimeout(r, 2000))
        attempts++
        const taskRes = await tripoRequest('GET', `/task/${taskId}`, null, apiKey)
        if (taskRes.code !== 0) continue

        const { status, progress } = taskRes.data
        const pct = 28 + Math.floor((progress || 0) * 0.65)
        event.sender.send('modeling:progress', { step: `Generating 3D model… (${status})`, pct })

        if (status === 'success') {
          const modelUrl = taskRes.data.output?.model || taskRes.data.output?.pbr_model
          if (!modelUrl) return { success: false, error: 'No model URL in response' }

          event.sender.send('modeling:progress', { step: 'Downloading GLB model...', pct: 95 })
          const outputPath = join(outDir, `tripo_${Date.now()}.glb`)
          await downloadFile(modelUrl, outputPath)
          event.sender.send('modeling:progress', { step: 'Model ready!', pct: 100 })
          return { success: true, outputPath, taskId, provider: 'tripo' }
        }

        if (status === 'failed' || status === 'cancelled') {
          return { success: false, error: `Task ${status}: ${taskRes.data.message || ''}` }
        }
      }
      return { success: false, error: 'Timed out waiting for Tripo task' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
)

// ── IPC: Tripo SDK (Python wrapper — mirrors ComfyUI-Tripo) ───────────────
// Spawns python/tripo_gen.py which uses the official tripo3d pip SDK.
// Authentication via TRIPO_API_KEY environment variable (set once, works everywhere).

function spawnTripoScript(args, env = {}) {
  return new Promise((resolve) => {
    const scriptPath = join(getPythonDir(), 'tripo_gen.py')
    const proc = spawn('python', [scriptPath, ...args], {
      env: { ...process.env, ...env },
      cwd: getPythonDir()
    })
    let lastResult = null
    const progressEvents = []
    proc.stderr.on('data', (d) => console.error('[tripo_gen]', d.toString().trim()))
    proc.on('close', (code) => {
      if (lastResult) resolve(lastResult)
      else resolve({ success: false, error: `Script exited with code ${code}` })
    })
    proc.on('error', (e) => resolve({ success: false, error: e.message }))
    return { proc, progressEvents }
  })
}

// Streaming version — emits progress IPC events while running
async function spawnTripoScriptStreaming(event, args, env = {}) {
  return new Promise((resolve) => {
    const scriptPath = join(getPythonDir(), 'tripo_gen.py')
    const proc = spawn('python', [scriptPath, ...args], {
      env: { ...process.env, ...env },
      cwd: getPythonDir()
    })

    let lastResult = null

    proc.stdout.on('data', (data) => {
      const lines = data
        .toString()
        .split('\n')
        .filter((l) => l.trim())
      for (const line of lines) {
        try {
          const msg = JSON.parse(line)
          if (msg.type === 'progress') {
            event.sender.send('modeling:progress', { step: msg.step, pct: msg.pct })
          } else if (msg.type === 'result') {
            lastResult = msg
          }
        } catch {
          // Ignore non-JSON log lines from the Python wrapper.
        }
      }
    })
    proc.stderr.on('data', (d) => console.error('[tripo_gen]', d.toString().trim()))
    proc.on('close', (code) => {
      if (lastResult) resolve(lastResult)
      else resolve({ success: false, error: `tripo_gen.py exited ${code} — is TRIPO_API_KEY set?` })
    })
    proc.on('error', (e) => resolve({ success: false, error: 'Cannot start Python: ' + e.message }))
  })
}

ipcMain.handle('tripo:sdkCheck', async (_, { apiKey } = {}) => {
  const env = apiKey ? { TRIPO_API_KEY: apiKey } : {}
  return spawnTripoScript(['--mode', 'check'], env)
})

ipcMain.handle('tripo:sdkBalance', async (_, { apiKey } = {}) => {
  const env = apiKey ? { TRIPO_API_KEY: apiKey } : {}
  return spawnTripoScript(['--mode', 'balance'], env)
})

ipcMain.handle(
  'tripo:sdkGenerate',
  async (
    event,
    {
      mode = 'text',
      prompt = '',
      imagePath = '',
      modelVersion = 'v2.5-20250123',
      style = 'None',
      texture = true,
      pbr = true,
      smartLowPoly = false,
      faceLimit = -1,
      apiKey = ''
    }
  ) => {
    const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
    if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
    const outPath = join(outDir, `tripo_sdk_${Date.now()}.glb`)

    const args = [
      '--mode',
      mode,
      '--output',
      outPath,
      '--model-version',
      modelVersion,
      '--style',
      style || 'None',
      ...(prompt ? ['--prompt', prompt] : []),
      ...(imagePath ? ['--image', imagePath] : []),
      ...(texture ? ['--texture'] : ['--no-texture']),
      ...(pbr ? ['--pbr'] : ['--no-pbr']),
      ...(smartLowPoly ? ['--smart-low-poly'] : []),
      ...(faceLimit > 0 ? ['--face-limit', String(faceLimit)] : [])
    ]
    const env = apiKey ? { TRIPO_API_KEY: apiKey } : {}
    return spawnTripoScriptStreaming(event, args, env)
  }
)

// ── IPC: ComfyUI Wrapper ──────────────────────────────────────────────────
// Connects to a locally-running ComfyUI instance with ComfyUI-Tripo nodes.
// Node classes: TripoAPIDraft, TripoTextureModel, TripoAnimateRigNode, TripoAnimateRetargetNode

async function comfyFetch(serverUrl, path, method = 'GET', body = null) {
  const http = serverUrl.startsWith('https') ? await import('https') : await import('http')
  const url = new URL(serverUrl + path)
  const data = body ? JSON.stringify(body) : null
  return new Promise((resolve, reject) => {
    const req = http.default.request(
      {
        hostname: url.hostname,
        port: url.port || (serverUrl.startsWith('https') ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
        }
      },
      (res) => {
        let raw = ''
        res.on('data', (d) => (raw += d))
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) })
          } catch {
            resolve({ status: res.statusCode, body: raw })
          }
        })
      }
    )
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

// Workflow builders — produce ComfyUI API-format prompt JSON
function buildTripoTextWorkflow({
  prompt,
  apiKey,
  modelVersion,
  texture,
  pbr,
  smartLowPoly,
  style,
  seed
}) {
  return {
    1: {
      class_type: 'TripoAPIDraft',
      inputs: {
        mode: 'text_to_model',
        apikey: apiKey || '',
        prompt,
        negative_prompt: '',
        model_version: modelVersion || 'v2.5-20250123',
        texture,
        pbr,
        smart_low_poly: smartLowPoly || false,
        generate_parts: false,
        auto_size: false,
        face_limit: -1,
        quad: false,
        compress: false,
        orientation: 'default',
        ...(style && style !== 'None' ? { style } : {}),
        image_seed: seed || 42,
        model_seed: seed || 42,
        texture_seed: seed || 42,
        texture_quality: 'standard',
        file_prefix: 'aigamedev_',
        output_directory: ''
      }
    }
  }
}

function buildTripoImageWorkflow({
  imageName,
  apiKey,
  modelVersion,
  texture,
  pbr,
  smartLowPoly,
  style,
  seed
}) {
  return {
    1: {
      class_type: 'LoadImage',
      inputs: { image: imageName, upload: 'image' }
    },
    2: {
      class_type: 'TripoAPIDraft',
      inputs: {
        mode: 'image_to_model',
        apikey: apiKey || '',
        image: ['1', 0], // linked from LoadImage output 0
        negative_prompt: '',
        model_version: modelVersion || 'v2.5-20250123',
        texture,
        pbr,
        smart_low_poly: smartLowPoly || false,
        generate_parts: false,
        auto_size: false,
        face_limit: -1,
        quad: false,
        compress: false,
        orientation: 'default',
        ...(style && style !== 'None' ? { style } : {}),
        model_seed: seed || 42,
        texture_seed: seed || 42,
        texture_quality: 'standard',
        texture_alignment: 'original_image',
        file_prefix: 'aigamedev_',
        output_directory: ''
      }
    }
  }
}

// Upload image to ComfyUI's /upload/image endpoint
async function comfyUploadImage(serverUrl, imagePath) {
  const http = serverUrl.startsWith('https') ? await import('https') : await import('http')
  const path_ = await import('path')
  const filename = path_.basename(imagePath)
  const ext = filename.split('.').pop().toLowerCase()
  const mime =
    { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }[ext] ||
    'image/jpeg'
  const url = new URL(serverUrl + '/upload/image')
  const boundary = `boundary${Date.now()}`
  const fileData = readFileSync(imagePath)
  const prefix = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
  )
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`)
  const bodyBuf = Buffer.concat([prefix, fileData, suffix])
  return new Promise((resolve, reject) => {
    const req = http.default.request(
      {
        hostname: url.hostname,
        port: url.port || 8188,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuf.length
        }
      },
      (res) => {
        let raw = ''
        res.on('data', (d) => (raw += d))
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw))
          } catch {
            reject(new Error(raw))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(bodyBuf)
    req.end()
  })
}

ipcMain.handle('comfyui:ping', async (_, { serverUrl }) => {
  try {
    const res = await comfyFetch(serverUrl, '/system_stats')
    if (res.status === 200) return { online: true, stats: res.body }
    return { online: false }
  } catch {
    return { online: false }
  }
})

ipcMain.handle('comfyui:checkNodes', async (_, { serverUrl }) => {
  try {
    const res = await comfyFetch(serverUrl, '/object_info/TripoAPIDraft')
    if (res.status === 200 && res.body?.TripoAPIDraft) return { installed: true }
    return {
      installed: false,
      error: 'TripoAPIDraft node not found. Install ComfyUI-Tripo custom nodes.'
    }
  } catch (e) {
    return { installed: false, error: e.message }
  }
})

ipcMain.handle(
  'comfyui:generate',
  async (
    event,
    {
      serverUrl,
      mode,
      prompt,
      imagePath,
      apiKey,
      modelVersion,
      texture,
      pbr,
      smartLowPoly,
      style,
      seed
    }
  ) => {
    try {
      const outDir = join(app.getPath('temp'), 'ai-game-dev-hub')
      if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })

      event.sender.send('modeling:progress', { step: 'Connecting to ComfyUI…', pct: 5 })

      // Check ComfyUI is running
      const ping = await comfyFetch(serverUrl, '/system_stats')
      if (ping.status !== 200)
        return { success: false, error: `ComfyUI server not reachable at ${serverUrl}` }

      let workflow
      let outputNodeId = '1'

      if (mode === 'image' && imagePath) {
        event.sender.send('modeling:progress', { step: 'Uploading image to ComfyUI…', pct: 12 })
        const uploadRes = await comfyUploadImage(serverUrl, imagePath)
        if (!uploadRes.name)
          return { success: false, error: 'Image upload failed: ' + JSON.stringify(uploadRes) }
        workflow = buildTripoImageWorkflow({
          imageName: uploadRes.name,
          apiKey,
          modelVersion,
          texture,
          pbr,
          smartLowPoly,
          style,
          seed
        })
        outputNodeId = '2'
      } else {
        workflow = buildTripoTextWorkflow({
          prompt,
          apiKey,
          modelVersion,
          texture,
          pbr,
          smartLowPoly,
          style,
          seed
        })
        outputNodeId = '1'
      }

      event.sender.send('modeling:progress', { step: 'Queuing workflow in ComfyUI…', pct: 18 })
      const clientId = `aigamedev-${Date.now()}`
      const queueRes = await comfyFetch(serverUrl, '/prompt', 'POST', {
        prompt: workflow,
        client_id: clientId
      })
      if (queueRes.status !== 200)
        return { success: false, error: 'Queue failed: ' + JSON.stringify(queueRes.body) }

      const promptId = queueRes.body.prompt_id
      event.sender.send('modeling:progress', {
        step: `Queued (${promptId.slice(0, 8)}…) — waiting for Tripo…`,
        pct: 25
      })

      // Poll /history/{prompt_id} until complete (Tripo takes ~15-30s)
      let attempts = 0
      while (attempts < 180) {
        await new Promise((r) => setTimeout(r, 2000))
        attempts++

        const histRes = await comfyFetch(serverUrl, `/history/${promptId}`)
        if (histRes.status !== 200 || !histRes.body[promptId]) continue

        const entry = histRes.body[promptId]
        const status = entry.status

        if (status?.status_str === 'error') {
          const msgs =
            status.messages?.map((m) => m[1]?.exception_message || m[1]).join(' | ') ||
            'Unknown error'
          return { success: false, error: 'ComfyUI error: ' + msgs }
        }

        // Estimate progress from queue position
        const pct = Math.min(90, 25 + attempts * 1.5)
        event.sender.send('modeling:progress', {
          step: `Generating 3D model (${Math.round(pct)}%)…`,
          pct
        })

        if (status?.completed) {
          // Get the output model file from the node output
          const outputs = entry.outputs || {}
          const nodeOut = outputs[outputNodeId]
          let modelFilePath = null

          if (nodeOut?.model_file) {
            // TripoAPIDraft returns a STRING with full file path
            modelFilePath = Array.isArray(nodeOut.model_file)
              ? nodeOut.model_file[0]
              : nodeOut.model_file
          }

          if (!modelFilePath) {
            // Scan all outputs for a .glb file path
            for (const out of Object.values(outputs)) {
              if (out?.model_file) {
                modelFilePath = Array.isArray(out.model_file) ? out.model_file[0] : out.model_file
                break
              }
            }
          }

          if (!modelFilePath)
            return { success: false, error: 'Workflow complete but no model file in output' }

          // Copy to our temp dir
          event.sender.send('modeling:progress', { step: 'Copying model to workspace…', pct: 95 })
          const outputPath = join(outDir, `comfyui_${Date.now()}.glb`)
          copyFileSync(modelFilePath, outputPath)

          event.sender.send('modeling:progress', { step: 'Model ready!', pct: 100 })
          return { success: true, outputPath, provider: 'comfyui-tripo', promptId }
        }
      }
      return { success: false, error: 'Timed out waiting for ComfyUI (>6 min)' }
    } catch (e) {
      return { success: false, error: e.message }
    }
  }
)

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

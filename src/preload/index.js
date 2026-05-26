import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // File dialogs
  openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
  openVfxAssetFiles: () => ipcRenderer.invoke('dialog:openVfxAssetFiles'),
  saveFile: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  openExternalUrl: (url) => ipcRenderer.invoke('shell:openExternalUrl', url),
  copyFile: (opts) => ipcRenderer.invoke('fs:copyFile', opts),
  copyText: (text) => ipcRenderer.invoke('clipboard:writeText', text),

  // Animation pipeline
  textToMotion: (opts) => ipcRenderer.invoke('animation:textToMotion', opts),
  videoToMotion: (opts) => ipcRenderer.invoke('animation:videoToMotion', opts),
  exportFBX: (opts) => ipcRenderer.invoke('animation:exportFBX', opts),
  exportBVH: (opts) => ipcRenderer.invoke('animation:exportBVH', opts),

  // File system
  readTextFile: (opts) => ipcRenderer.invoke('fs:readTextFile', opts),
  writeTextFile: (opts) => ipcRenderer.invoke('fs:writeTextFile', opts),
  exportVfxPackage: (opts) => ipcRenderer.invoke('vfx:exportPackage', opts),
  vfxInstallStudioPlugin: () => ipcRenderer.invoke('vfx:installStudioPlugin'),
  vfxGenerateRecipe: (opts) => ipcRenderer.invoke('vfx:generateRecipe', opts),
  vfxGenerateParticleLogic: (opts) => ipcRenderer.invoke('vfx:generateParticleLogic', opts),
  sfxGenerateRecipe: (opts) => ipcRenderer.invoke('sfx:generateRecipe', opts),
  buildingGenerateRecipe: (opts) => ipcRenderer.invoke('building:generateRecipe', opts),

  // Config
  configGet: (key) => ipcRenderer.invoke('config:get', key),
  configSet: (key, value) => ipcRenderer.invoke('config:set', key, value),
  onConfigUpdated: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('config:updated', handler)
    return () => ipcRenderer.removeListener('config:updated', handler)
  },

  tripoWebOpenLogin: (opts) => ipcRenderer.invoke('tripo:webOpenLogin', opts),
  tripoWebOpenGenerate: (opts) => ipcRenderer.invoke('tripo:webOpenGenerate', opts),
  tripoWebSessionStatus: (opts) => ipcRenderer.invoke('tripo:webSessionStatus', opts),
  tripoWebGenerate: (opts) => ipcRenderer.invoke('tripo:webGenerate', opts),
  tripoWebListHistory: (opts) => ipcRenderer.invoke('tripo:webListHistory', opts),
  tripoWebImportHistoryItem: (opts) => ipcRenderer.invoke('tripo:webImportHistoryItem', opts),
  tripoListSyncedAssets: () => ipcRenderer.invoke('tripo:listSyncedAssets'),
  tripoGetAssetById: (opts) => ipcRenderer.invoke('tripo:getAssetById', opts),
  tripoImportSyncedAssetById: (opts) => ipcRenderer.invoke('tripo:importSyncedAssetById', opts),
  manusWebOpenLogin: (opts) => ipcRenderer.invoke('manus:webOpenLogin', opts),
  manusWebOpenWorkspace: (opts) => ipcRenderer.invoke('manus:webOpenWorkspace', opts),
  manusWebSessionStatus: (opts) => ipcRenderer.invoke('manus:webSessionStatus', opts),
  chatgptWebOpenLogin: (opts) => ipcRenderer.invoke('chatgpt:webOpenLogin', opts),
  chatgptWebOpenWorkspace: (opts) => ipcRenderer.invoke('chatgpt:webOpenWorkspace', opts),
  chatgptWebSessionStatus: (opts) => ipcRenderer.invoke('chatgpt:webSessionStatus', opts),
  elevenLabsWebOpenLogin: (opts) => ipcRenderer.invoke('elevenlabs:webOpenLogin', opts),
  elevenLabsWebOpenImageStudio: (opts) => ipcRenderer.invoke('elevenlabs:webOpenImageStudio', opts),
  elevenLabsWebSessionStatus: (opts) => ipcRenderer.invoke('elevenlabs:webSessionStatus', opts),
  elevenLabsWebGenerateImage: (opts) => ipcRenderer.invoke('elevenlabs:webGenerateImage', opts),

  // Hosted image generation
  replicateGenerateClothing: (opts) => ipcRenderer.invoke('replicate:generateClothing', opts),
  clothingGenerateGptImage: (opts) => ipcRenderer.invoke('clothing:generateGptImage', opts),

  // SFX / audio generation
  elevenLabsValidateKey: (opts) => ipcRenderer.invoke('elevenlabs:validateKey', opts),
  elevenLabsListVoices: (opts) => ipcRenderer.invoke('elevenlabs:listVoices', opts),
  sfxGenerateElevenLabs: (opts) => ipcRenderer.invoke('sfx:generateElevenLabs', opts),
  sfxCheckStableAudio: () => ipcRenderer.invoke('sfx:checkStableAudio'),
  sfxGenerateStableAudio: (opts) => ipcRenderer.invoke('sfx:generateStableAudio', opts),

  // Modeling pipeline
  openImage: () => ipcRenderer.invoke('dialog:openImage'),
  openMesh: () => ipcRenderer.invoke('dialog:openMesh'),
  openGLTF: () => ipcRenderer.invoke('dialog:openGLTF'),
  saveFolder: (opts) => ipcRenderer.invoke('dialog:saveFolder', opts),
  listGeneratedModels: () => ipcRenderer.invoke('modeling:listGeneratedModels'),
  saveGeneratedModel: (opts) => ipcRenderer.invoke('modeling:saveGeneratedModel', opts),
  readFileAsDataURL: (opts) => ipcRenderer.invoke('fs:readFileAsDataURL', opts),
  optimizeMesh: (opts) => ipcRenderer.invoke('mesh:optimize', opts),
  retopologyMesh: (opts) => ipcRenderer.invoke('mesh:retopologyBlender', opts),
  onModelingProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('modeling:progress', handler)
    return () => ipcRenderer.removeListener('modeling:progress', handler)
  },
  onClothingProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('clothing:progress', handler)
    return () => ipcRenderer.removeListener('clothing:progress', handler)
  },
  onRetopologyProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('mesh:retopologyProgress', handler)
    return () => ipcRenderer.removeListener('mesh:retopologyProgress', handler)
  },
  onVfxProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('vfx:progress', handler)
    return () => ipcRenderer.removeListener('vfx:progress', handler)
  },
  onSfxProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('sfx:progress', handler)
    return () => ipcRenderer.removeListener('sfx:progress', handler)
  },

  // Progress events
  onProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('animation:progress', handler)
    return () => ipcRenderer.removeListener('animation:progress', handler)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

const api = {
  // File dialogs
  openVideo: () => ipcRenderer.invoke('dialog:openVideo'),
  saveFile: (opts) => ipcRenderer.invoke('dialog:saveFile', opts),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),
  copyFile: (opts) => ipcRenderer.invoke('fs:copyFile', opts),

  // Animation pipeline
  textToMotion: (opts) => ipcRenderer.invoke('animation:textToMotion', opts),
  videoToMotion: (opts) => ipcRenderer.invoke('animation:videoToMotion', opts),
  exportFBX: (opts) => ipcRenderer.invoke('animation:exportFBX', opts),
  exportBVH: (opts) => ipcRenderer.invoke('animation:exportBVH', opts),

  // File system
  readTextFile: (opts) => ipcRenderer.invoke('fs:readTextFile', opts),

  // Config
  configGet: (key) => ipcRenderer.invoke('config:get', key),
  configSet: (key, value) => ipcRenderer.invoke('config:set', key, value),

  // Tripo3D REST API (direct HTTP, requires API key)
  tripoGenerate: (opts) => ipcRenderer.invoke('tripo:generate', opts),
  tripoGetBalance: (opts) => ipcRenderer.invoke('tripo:getBalance', opts),
  tripoWebOpenLogin: (opts) => ipcRenderer.invoke('tripo:webOpenLogin', opts),
  tripoWebOpenGenerate: (opts) => ipcRenderer.invoke('tripo:webOpenGenerate', opts),
  tripoWebSessionStatus: (opts) => ipcRenderer.invoke('tripo:webSessionStatus', opts),
  tripoWebGenerate: (opts) => ipcRenderer.invoke('tripo:webGenerate', opts),

  // Tripo3D SDK wrapper (Python subprocess, mirrors ComfyUI-Tripo)
  // Auth via TRIPO_API_KEY env var — no key needed in app
  tripoSdkGenerate: (opts) => ipcRenderer.invoke('tripo:sdkGenerate', opts),
  tripoSdkCheck:    (opts) => ipcRenderer.invoke('tripo:sdkCheck', opts),
  tripoSdkBalance:  (opts) => ipcRenderer.invoke('tripo:sdkBalance', opts),

  // ComfyUI wrapper
  comfyuiPing: (opts) => ipcRenderer.invoke('comfyui:ping', opts),
  comfyuiCheckNodes: (opts) => ipcRenderer.invoke('comfyui:checkNodes', opts),
  comfyuiGenerate: (opts) => ipcRenderer.invoke('comfyui:generate', opts),

  // Modeling pipeline
  openImage: () => ipcRenderer.invoke('dialog:openImage'),
  openGLTF: () => ipcRenderer.invoke('dialog:openGLTF'),
  saveFolder: (opts) => ipcRenderer.invoke('dialog:saveFolder', opts),
  generateModel: (opts) => ipcRenderer.invoke('modeling:generate', opts),
  readFileAsDataURL: (opts) => ipcRenderer.invoke('fs:readFileAsDataURL', opts),
  onModelingProgress: (cb) => {
    const handler = (_, data) => cb(data)
    ipcRenderer.on('modeling:progress', handler)
    return () => ipcRenderer.removeListener('modeling:progress', handler)
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

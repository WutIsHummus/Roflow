/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react'
import PartsList from './PartsList'
import R15Viewer from './R15Viewer'
import SceneBuilder from './SceneBuilder'
import TripoPanel from './TripoPanel'
import ComfyUIPanel from './ComfyUIPanel'

let nextId = 1
function mkPart(overrides = {}) {
  return {
    id: `part-${nextId++}`,
    name: '',
    prompt: '',
    status: 'pending',
    outputPath: null,
    dataUrl: null,
    attachPoint: 'HatAttachment',
    error: null,
    provider: null,
    ...overrides
  }
}

const TABS = [
  { id: 'character', label: '🧍 Character Accessories' },
  { id: 'environment', label: '🏙️ Environment Scene' }
]

export default function ModelingModule({ workflowState, setWorkflowState, onChangeModule }) {
  const [tab, setTab] = useState('character')
  const [charParts, setCharParts] = useState(() => workflowState?.charParts || [])
  const [envParts, setEnvParts] = useState(() => workflowState?.envParts || [])
  const [provider, setProvider] = useState('tripo') // 'tripo' | 'huggingface' | 'comfyui'
  const [showSettings, setShowSettings] = useState(false)
  const [tripoOpts, setTripoOpts] = useState({
    apiKey: '',
    authMode: 'web', // 'web' = browser session | 'sdk' = TRIPO_API_KEY env var | 'key' = direct REST
    webBaseUrl: 'https://www.tripo3d.ai/',
    webGenerateUrl: 'https://www.tripo3d.ai/',
    showBrowserAutomation: true,
    modelVersion: 'v2.5-20250123',
    texture: true,
    pbr: true,
    smartLowPoly: false,
    style: null
  })
  const [comfyOpts, setComfyOpts] = useState({
    serverUrl: 'http://localhost:8188',
    apiKey: '',
    modelVersion: 'v2.5-20250123',
    texture: true,
    pbr: true,
    smartLowPoly: false,
    style: 'None'
  })
  const [globalProgress, setGlobalProgress] = useState(null)

  // listen for modeling:progress events
  useEffect(() => {
    if (window.api.onModelingProgress) {
      const unsub = window.api.onModelingProgress((data) => setGlobalProgress(data))
      return unsub
    }
  }, [])

  useEffect(() => {
    if (!setWorkflowState) return
    setWorkflowState((prev) => ({ ...prev, charParts, envParts }))
  }, [charParts, envParts, setWorkflowState])

  const parts = tab === 'character' ? charParts : envParts
  const setParts = tab === 'character' ? setCharParts : setEnvParts

  // ── Part CRUD ──────────────────────────────────────────────────────────

  const addPart = useCallback(() => {
    setParts((prev) => [...prev, mkPart()])
  }, [setParts])

  const removePart = useCallback(
    (id) => {
      setParts((prev) => prev.filter((p) => p.id !== id))
    },
    [setParts]
  )

  const updatePart = useCallback(
    (id, changes) => {
      setParts((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)))
    },
    [setParts]
  )

  // ── Generate a single part ────────────────────────────────────────────

  const generatePart = useCallback(
    async (id) => {
      const setter = tab === 'character' ? setCharParts : setEnvParts
      const getCurrentParts = () => {
        let result
        setter((prev) => {
          result = prev
          return prev
        })
        return result
      }

      setter((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: 'generating', error: null } : p))
      )
      setGlobalProgress({ step: 'Starting…', pct: 0 })

      const allParts = getCurrentParts()
      const part = allParts?.find((p) => p.id === id)
      if (!part) return

      try {
        let res

        if (provider === 'tripo') {
          if (tripoOpts.authMode === 'web') {
            res = await window.api.tripoWebGenerate({
              prompt: part.prompt.trim(),
              imagePath: part.imagePath || '',
              baseUrl: tripoOpts.webBaseUrl,
              generateUrl: tripoOpts.webGenerateUrl,
              showBrowser: tripoOpts.showBrowserAutomation,
              keepWindowOpen: tripoOpts.showBrowserAutomation
            })
          } else if (tripoOpts.authMode === 'sdk') {
            // Python SDK path — auth via TRIPO_API_KEY env var (mirrors ComfyUI-Tripo)
            res = await window.api.tripoSdkGenerate({
              mode: part.imagePath ? 'image' : 'text',
              prompt: part.prompt.trim(),
              imagePath: part.imagePath || '',
              modelVersion: tripoOpts.modelVersion,
              style: tripoOpts.style || 'None',
              texture: tripoOpts.texture,
              pbr: tripoOpts.pbr,
              smartLowPoly: tripoOpts.smartLowPoly
            })
          } else {
            // Direct REST API path — requires API key in app
            if (!tripoOpts.apiKey) {
              setter((prev) =>
                prev.map((p) =>
                  p.id === id
                    ? {
                        ...p,
                        status: 'error',
                        error: 'Tripo API key required. Add it in Tripo Settings.'
                      }
                    : p
                )
              )
              setGlobalProgress(null)
              return
            }
            res = await window.api.tripoGenerate({
              apiKey: tripoOpts.apiKey,
              type: part.imagePath ? 'image' : 'text',
              prompt: part.prompt.trim(),
              imagePath: part.imagePath || null,
              texture: tripoOpts.texture,
              pbr: tripoOpts.pbr,
              smartLowPoly: tripoOpts.smartLowPoly,
              style: tripoOpts.style,
              modelVersion: tripoOpts.modelVersion
            })
          }
        } else if (provider === 'comfyui') {
          res = await window.api.comfyuiGenerate({
            serverUrl: comfyOpts.serverUrl,
            mode: part.imagePath ? 'image' : 'text',
            prompt: part.prompt.trim(),
            imagePath: part.imagePath || null,
            apiKey: comfyOpts.apiKey,
            modelVersion: comfyOpts.modelVersion,
            texture: comfyOpts.texture,
            pbr: comfyOpts.pbr,
            smartLowPoly: comfyOpts.smartLowPoly,
            style: comfyOpts.style
          })
        } else {
          res = await window.api.generateModel({
            prompt: part.prompt.trim(),
            imagePath: part.imagePath || null,
            mode: part.imagePath ? 'image' : 'text',
            type: tab
          })
        }

        setGlobalProgress(null)

        if (!res.success) {
          setter((prev) =>
            prev.map((p) => (p.id === id ? { ...p, status: 'error', error: res.error } : p))
          )
          return
        }

        let dataUrl = null
        if (res.outputPath) {
          const r = await window.api.readFileAsDataURL({ filePath: res.outputPath })
          if (r.success) dataUrl = r.dataUrl
        }

        setter((prev) =>
          prev.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: 'done',
                  outputPath: res.outputPath,
                  dataUrl,
                  provider: res.provider || provider
                }
              : p
          )
        )
      } catch (e) {
        setGlobalProgress(null)
        setter((prev) =>
          prev.map((p) => (p.id === id ? { ...p, status: 'error', error: e.message } : p))
        )
      }
    },
    [tab, provider, tripoOpts, comfyOpts]
  )

  // ── Export scene ────────────────────────────────────────────────────

  const exportScene = useCallback(async () => {
    const doneParts = envParts.filter((p) => p.status === 'done' && p.outputPath)
    if (!doneParts.length) return
    const folder = await window.api.saveFolder({ title: 'Export Scene — Choose Folder' })
    if (!folder) return
    for (const part of doneParts) {
      const ext = part.outputPath.split('.').pop()
      const name = (part.name || part.id).replace(/[^a-z0-9_-]/gi, '_')
      await window.api.copyFile({ src: part.outputPath, dest: `${folder}\\${name}.${ext}` })
    }
    window.api.openPath(folder)
  }, [envParts])

  const accessories = charParts.filter((p) => p.status === 'done' && p.dataUrl)

  // ── Styles ────────────────────────────────────────────────────────────

  const provBtn = (active) => ({
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    borderRadius: 20,
    cursor: 'pointer',
    border: active ? '1px solid rgba(124,58,237,0.5)' : '1px solid #1e2330',
    background: active ? 'rgba(124,58,237,0.15)' : '#1a1d26',
    color: active ? '#c4b5fd' : '#555b6e',
    transition: 'all .15s'
  })

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1116' }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 24px 0', borderBottom: '1px solid #1e2330', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 12
          }}
        >
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#eef0f6', margin: 0 }}>
              3D Modeling Studio
            </h1>
            <p style={{ fontSize: 13, color: '#555b6e', marginTop: 3 }}>
              Build assets part by part ·{' '}
              {provider === 'tripo'
                ? tripoOpts.authMode === 'web'
                  ? 'Tripo browser session automation'
                  : tripoOpts.authMode === 'sdk'
                    ? 'Tripo SDK via TRIPO_API_KEY'
                    : 'Tripo direct API key (legacy)'
                : provider === 'comfyui'
                  ? 'ComfyUI + Tripo Nodes (auth via TRIPO_API_KEY env)'
                  : 'HuggingFace (free)'}
            </p>
          </div>

          {/* Provider selector */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 2 }}>
            <span style={{ fontSize: 11, color: '#3e4455', marginRight: 4 }}>Provider:</span>
            <button style={provBtn(provider === 'tripo')} onClick={() => setProvider('tripo')}>
              ⬡ Tripo3D
            </button>
            <button style={provBtn(provider === 'comfyui')} onClick={() => setProvider('comfyui')}>
              🔧 ComfyUI
            </button>
            <button
              style={provBtn(provider === 'huggingface')}
              onClick={() => setProvider('huggingface')}
            >
              🤗 HuggingFace
            </button>
            {(provider === 'tripo' || provider === 'comfyui') && (
              <button
                onClick={() => setShowSettings((v) => !v)}
                style={{
                  padding: '6px 10px',
                  fontSize: 11,
                  borderRadius: 20,
                  cursor: 'pointer',
                  border: '1px solid #252a36',
                  background: showSettings ? '#252a36' : '#1a1d26',
                  color: '#555b6e'
                }}
              >
                ⚙ Settings
              </button>
            )}
            <button
              onClick={() => onChangeModule?.('playground')}
              style={{
                padding: '6px 10px',
                fontSize: 11,
                borderRadius: 20,
                cursor: 'pointer',
                border: '1px solid rgba(124,58,237,0.28)',
                background: 'rgba(124,58,237,0.08)',
                color: '#c4b5fd'
              }}
            >
              Open Playground
            </button>
          </div>
        </div>

        {/* Settings collapsible — Tripo or ComfyUI */}
        {provider === 'tripo' && showSettings && (
          <div
            style={{
              background: '#111318',
              border: '1px solid #1e2330',
              borderRadius: 10,
              padding: '16px 18px',
              marginBottom: 14
            }}
          >
            <TripoPanel options={tripoOpts} onChange={setTripoOpts} />
          </div>
        )}
        {provider === 'comfyui' && showSettings && (
          <div
            style={{
              background: '#111318',
              border: '1px solid #1e2330',
              borderRadius: 10,
              padding: '16px 18px',
              marginBottom: 14
            }}
          >
            <ComfyUIPanel options={comfyOpts} onChange={setComfyOpts} />
          </div>
        )}

        {/* Global progress bar */}
        {globalProgress && (
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#9499a8',
                marginBottom: 4
              }}
            >
              <span>{globalProgress.step}</span>
              <span>{globalProgress.pct}%</span>
            </div>
            <div style={{ height: 3, background: '#1e2330', borderRadius: 2 }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 2,
                  background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                  width: `${globalProgress.pct}%`,
                  transition: 'width .3s'
                }}
              />
            </div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: tab === t.id ? 600 : 500,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: tab === t.id ? '#c4b5fd' : '#6b7280',
                borderBottom: tab === t.id ? '2px solid #a78bfa' : '2px solid transparent',
                marginBottom: -1
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: parts list */}
        <div
          style={{
            width: 310,
            flexShrink: 0,
            borderRight: '1px solid #1e2330',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <PartsList
            parts={parts}
            onAdd={addPart}
            onRemove={removePart}
            onGenerate={generatePart}
            onPartChange={updatePart}
            showAttachPoint={tab === 'character'}
          />
        </div>

        {/* Right: 3D viewer */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {tab === 'character' ? (
            <R15Viewer accessories={accessories} />
          ) : (
            <SceneBuilder parts={envParts} onExport={exportScene} />
          )}
        </div>
      </div>
    </div>
  )
}

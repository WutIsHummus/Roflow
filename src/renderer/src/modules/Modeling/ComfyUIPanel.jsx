import { useState, useEffect } from 'react'

const MODEL_VERSIONS = [
  { value: 'v2.5-20250123', label: 'v2.5 (Latest)' },
  { value: 'v2.0-20240919', label: 'v2.0' },
]
const STYLES = ['None', 'realistic', 'cartoon', 'anime', 'low-poly', 'voxel', 'isometric', 'flat_shading']

export default function ComfyUIPanel({ options, onChange }) {
  const [serverUrl, setServerUrl]       = useState('http://localhost:8188')
  const [status, setStatus]             = useState('idle') // idle|checking|online|offline|no-nodes
  const [statusMsg, setStatusMsg]       = useState('')
  const [apiKeyOverride, setApiKeyOverride] = useState('')
  const [showKey, setShowKey]           = useState(false)
  const [modelVersion, setModelVersion] = useState('v2.5-20250123')
  const [texture, setTexture]           = useState(true)
  const [pbr, setPbr]                   = useState(true)
  const [lowPoly, setLowPoly]           = useState(false)
  const [style, setStyle]               = useState('None')
  const [savedMsg, setSavedMsg]         = useState('')

  useEffect(() => {
    window.api.configGet('comfyuiServerUrl').then(u => { if (u) setServerUrl(u) })
    window.api.configGet('comfyuiApiKeyOverride').then(k => { if (k) setApiKeyOverride(k) })
  }, [])

  useEffect(() => {
    onChange?.({ serverUrl, apiKey: apiKeyOverride, modelVersion, texture, pbr, smartLowPoly: lowPoly, style })
  }, [serverUrl, apiKeyOverride, modelVersion, texture, pbr, lowPoly, style])

  async function saveSettings() {
    await window.api.configSet('comfyuiServerUrl', serverUrl)
    await window.api.configSet('comfyuiApiKeyOverride', apiKeyOverride)
    setSavedMsg('Saved!')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  async function checkConnection() {
    setStatus('checking')
    setStatusMsg('Pinging ComfyUI…')
    const ping = await window.api.comfyuiPing({ serverUrl })
    if (!ping.online) {
      setStatus('offline')
      setStatusMsg(`Offline — Is ComfyUI running at ${serverUrl}?`)
      return
    }
    setStatusMsg('Checking Tripo nodes…')
    const nodes = await window.api.comfyuiCheckNodes({ serverUrl })
    if (!nodes.installed) {
      setStatus('no-nodes')
      setStatusMsg(nodes.error || 'ComfyUI-Tripo not installed')
      return
    }
    setStatus('online')
    setStatusMsg('✓ ComfyUI + Tripo nodes ready')
  }

  const statusColor = { idle: '#888', checking: '#f59e0b', online: '#22c55e', offline: '#ef4444', 'no-nodes': '#f97316' }[status]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Server URL + connect */}
      <div>
        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>ComfyUI Server URL</label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={serverUrl}
            onChange={e => setServerUrl(e.target.value)}
            placeholder="http://localhost:8188"
            style={{ flex: 1, background: '#1e1e2e', border: '1px solid #333', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
          />
          <button
            onClick={checkConnection}
            disabled={status === 'checking'}
            style={{ background: '#6d28d9', border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, padding: '0 14px', cursor: 'pointer', opacity: status === 'checking' ? 0.6 : 1 }}
          >{status === 'checking' ? '…' : 'Connect'}</button>
        </div>
        {statusMsg && (
          <div style={{ fontSize: 11, marginTop: 4, color: statusColor }}>● {statusMsg}</div>
        )}
      </div>

      {/* Auth info box */}
      <div style={{ background: '#0f1a10', border: '1px solid #1a3a1e', borderRadius: 6, padding: '10px 12px', fontSize: 11, color: '#6b9e72', lineHeight: 1.7 }}>
        <div style={{ color: '#4ade80', fontWeight: 600, marginBottom: 3 }}>🔑 Tripo Authentication via ComfyUI</div>
        <div>Set <code style={{ background: '#152018', color: '#86efac', padding: '1px 4px', borderRadius: 3 }}>TRIPO_API_KEY=your_key</code> as an environment variable when starting ComfyUI.</div>
        <div style={{ marginTop: 4, color: '#4a7a52' }}>
          Get your key at <span style={{ color: '#86efac' }}>tripo3d.ai → Account → API Keys</span>.
          Your Tripo account credits are used; no key needed in this app.
        </div>
      </div>

      {/* Optional key override */}
      <div>
        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 4 }}>
          API Key Override <span style={{ color: '#555' }}>(optional — only if not set in ComfyUI env)</span>
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKeyOverride}
            onChange={e => setApiKeyOverride(e.target.value)}
            placeholder="Leave blank if TRIPO_API_KEY is set in ComfyUI env"
            style={{ flex: 1, background: '#1e1e2e', border: '1px solid #333', borderRadius: 6, padding: '7px 10px', color: '#e2e8f0', fontSize: 12, outline: 'none' }}
          />
          <button onClick={() => setShowKey(v => !v)} style={{ background: '#2d2d3d', border: '1px solid #333', borderRadius: 6, color: '#ccc', fontSize: 11, padding: '0 10px', cursor: 'pointer' }}>
            {showKey ? 'Hide' : 'Show'}
          </button>
          <button onClick={saveSettings} style={{ background: '#22c55e', border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, padding: '0 10px', cursor: 'pointer' }}>
            {savedMsg || 'Save'}
          </button>
        </div>
      </div>

      {/* Generation settings */}
      <div>
        <label style={{ fontSize: 11, color: '#888', display: 'block', marginBottom: 6 }}>Generation Settings</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <label style={{ fontSize: 10, color: '#777', display: 'block', marginBottom: 3 }}>Model Version</label>
            <select value={modelVersion} onChange={e => setModelVersion(e.target.value)}
              style={{ width: '100%', background: '#1e1e2e', border: '1px solid #333', borderRadius: 5, color: '#e2e8f0', fontSize: 11, padding: '5px 8px' }}>
              {MODEL_VERSIONS.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, color: '#777', display: 'block', marginBottom: 3 }}>Style</label>
            <select value={style} onChange={e => setStyle(e.target.value)}
              style={{ width: '100%', background: '#1e1e2e', border: '1px solid #333', borderRadius: 5, color: '#e2e8f0', fontSize: 11, padding: '5px 8px' }}>
              {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Toggles */}
      <div style={{ display: 'flex', gap: 20 }}>
        {[['Texture', texture, setTexture], ['PBR', pbr, setPbr], ['Low-poly', lowPoly, setLowPoly]].map(([label, val, set]) => (
          <label key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} style={{ accentColor: '#a78bfa' }} />
            <span style={{ fontSize: 12, color: '#ccc' }}>{label}</span>
          </label>
        ))}
      </div>

      {/* Setup instructions */}
      <div style={{ background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 6, padding: '10px 12px', fontSize: 11, color: '#888', lineHeight: 1.8 }}>
        <div style={{ color: '#a78bfa', fontWeight: 600, marginBottom: 4 }}>Quick Setup</div>
        <div>1. <code style={{ color: '#ccc' }}>git clone https://github.com/comfyanonymous/ComfyUI</code></div>
        <div>2. Clone <code style={{ color: '#ccc' }}>ComfyUI-Tripo</code> into <code style={{ color: '#ccc' }}>ComfyUI/custom_nodes/</code></div>
        <div>3. <code style={{ color: '#ccc' }}>pip install tripo3d</code> in ComfyUI's venv</div>
        <div>4. Start ComfyUI with: <code style={{ color: '#ccc' }}>TRIPO_API_KEY=tsk_xxx python main.py</code></div>
        <div>5. Click <strong style={{ color: '#c4b5fd' }}>Connect</strong> above — no key needed in this app</div>
      </div>
    </div>
  )
}

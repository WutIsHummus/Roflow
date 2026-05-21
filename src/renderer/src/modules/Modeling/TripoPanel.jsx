import { useState, useEffect } from 'react'

const STYLES = [
  { id: null,         label: 'None (Default)' },
  { id: 'realistic',  label: 'Realistic' },
  { id: 'cartoon',    label: 'Cartoon' },
  { id: 'anime',      label: 'Anime' },
  { id: 'low-poly',   label: 'Low Poly' },
  { id: 'voxel',      label: 'Voxel' },
  { id: 'steampunk',  label: 'Steampunk' },
  { id: 'clay',       label: 'Clay' },
]

const VERSIONS = [
  { id: 'v2.5-20250123', label: 'v2.5 (Best Quality)' },
  { id: 'v2.0-20240919', label: 'v2.0 (Fast)' },
]

// auth modes:
//   'sdk'  — uses TRIPO_API_KEY env var (same as ComfyUI-Tripo); no key in app
//   'key'  — paste key directly (legacy REST mode)
export default function TripoPanel({ options, onChange }) {
  const [authMode, setAuthMode]   = useState('sdk')
  const [apiKey, setApiKey]       = useState('')
  const [showKey, setShowKey]     = useState(false)
  const [sdkStatus, setSdkStatus] = useState('idle')   // idle|checking|ok|error
  const [sdkMsg, setSdkMsg]       = useState('')
  const [balance, setBalance]     = useState(null)
  const [saved, setSaved]         = useState(false)

  useEffect(() => {
    window.api.configGet('tripoApiKey').then(k => {
      if (k) { setApiKey(k); onChange({ ...options, apiKey: k }) }
    })
    window.api.configGet('tripoAuthMode').then(m => {
      if (m) setAuthMode(m)
    })
  }, [])

  async function saveKey() {
    await window.api.configSet('tripoApiKey', apiKey.trim())
    await window.api.configSet('tripoAuthMode', authMode)
    onChange({ ...options, apiKey: authMode === 'key' ? apiKey.trim() : '' })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function checkSdk() {
    setSdkStatus('checking')
    setSdkMsg('Checking Python + tripo3d SDK…')
    const res = await window.api.tripoSdkCheck()
    if (res.success) {
      setSdkStatus('ok')
      setSdkMsg(res.message || '✓ SDK ready')
    } else {
      setSdkStatus('error')
      setSdkMsg(res.error || 'SDK check failed')
    }
  }

  async function checkBalance() {
    setBalance(null)
    const res = authMode === 'sdk'
      ? await window.api.tripoSdkBalance()
      : await window.api.tripoGetBalance({ apiKey: apiKey.trim() })
    if (res.success) setBalance(res.balance)
    else setBalance('error: ' + res.error)
  }

  const sel = {
    width: '100%', background: '#111318', border: '1px solid #1e2330',
    borderRadius: 7, padding: '7px 10px', fontSize: 12, color: '#9499a8',
    cursor: 'pointer', outline: 'none', boxSizing: 'border-box',
  }
  const tog = (active) => ({
    flex: 1, padding: '7px 10px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
    background: active ? 'rgba(124,58,237,0.2)' : '#1a1d26',
    color: active ? '#c4b5fd' : '#555b6e',
    border: `1px solid ${active ? '#7c3aed' : '#252a36'}`,
  })
  const modeBtn = (active) => ({
    flex: 1, padding: '6px 10px', fontSize: 11, fontWeight: active ? 700 : 500,
    borderRadius: 6, cursor: 'pointer',
    background: active ? 'rgba(124,58,237,0.18)' : '#13141a',
    color: active ? '#c4b5fd' : '#555b6e',
    border: `1px solid ${active ? 'rgba(124,58,237,0.4)' : '#1e2330'}`,
  })
  const sdkColor = { idle: '#888', checking: '#f59e0b', ok: '#4ade80', error: '#f87171' }[sdkStatus]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Auth mode switcher */}
      <div>
        <label style={{ fontSize: 11, color: '#555b6e', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Authentication Mode
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={modeBtn(authMode === 'sdk')} onClick={() => setAuthMode('sdk')}>
            🐍 SDK / Env Var
          </button>
          <button style={modeBtn(authMode === 'key')} onClick={() => setAuthMode('key')}>
            🔑 API Key
          </button>
        </div>
      </div>

      {/* SDK mode */}
      {authMode === 'sdk' && (
        <div style={{ background: '#0f1a10', border: '1px solid #1a3a1e', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            🐍 SDK Mode — mirrors ComfyUI-Tripo
          </div>
          <div style={{ fontSize: 11, color: '#6b9e72', lineHeight: 1.7 }}>
            <div>Set <code style={{ background: '#152018', color: '#86efac', padding: '1px 5px', borderRadius: 3 }}>TRIPO_API_KEY=tsk_xxx</code> in your system environment.</div>
            <div style={{ marginTop: 4, color: '#4a7a52' }}>Get key at <span style={{ color: '#86efac' }}>tripo3d.ai → Account → API Keys</span></div>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={checkSdk}
              disabled={sdkStatus === 'checking'}
              style={{ background: '#1a3a1e', border: '1px solid #2a5a2e', borderRadius: 6, color: '#4ade80', fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}
            >{sdkStatus === 'checking' ? '…' : 'Verify SDK'}</button>
            <button onClick={checkBalance} style={{ background: '#131a14', border: '1px solid #1e2a1e', borderRadius: 6, color: '#6b9e72', fontSize: 11, padding: '5px 12px', cursor: 'pointer' }}>
              Check Balance
            </button>
            {sdkMsg && <span style={{ fontSize: 11, color: sdkColor }}>{sdkMsg}</span>}
          </div>
          {balance !== null && (
            <div style={{ marginTop: 6, fontSize: 11, color: typeof balance === 'string' && balance.startsWith('error') ? '#f87171' : '#4ade80' }}>
              💳 {balance}
            </div>
          )}
        </div>
      )}

      {/* API Key mode */}
      {authMode === 'key' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#9499a8' }}>Tripo API Key</label>
            {balance !== null && <span style={{ fontSize: 11, color: '#4ade80' }}>💳 {balance} credits</span>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="tsk-xxxxxxxxxxxxxxxx"
                style={{ width: '100%', background: '#111318', border: '1px solid #1e2330', borderRadius: 7, padding: '8px 11px', fontSize: 13, color: '#eef0f6', outline: 'none', boxSizing: 'border-box' }}
              />
              <button onClick={() => setShowKey(v => !v)} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#555b6e', cursor: 'pointer', fontSize: 11 }}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <button onClick={saveKey} disabled={!apiKey.trim()} style={{ padding: '8px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: saved ? 'rgba(74,222,128,0.15)' : 'rgba(124,58,237,0.2)', border: saved ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(124,58,237,0.4)', color: saved ? '#4ade80' : '#c4b5fd', cursor: 'pointer' }}>
              {saved ? '✓' : 'Save'}
            </button>
            <button onClick={checkBalance} disabled={!apiKey.trim()} style={{ padding: '8px 10px', borderRadius: 7, fontSize: 12, background: '#1a1d26', border: '1px solid #252a36', color: '#6b7280', cursor: 'pointer' }}>
              ↻
            </button>
          </div>
        </div>
      )}

      {/* Model version */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555b6e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Model Version</label>
        <select value={options.modelVersion || 'v2.5-20250123'} onChange={e => onChange({ ...options, modelVersion: e.target.value })} style={sel}>
          {VERSIONS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </div>

      {/* Style */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555b6e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Style</label>
        <select value={options.style || ''} onChange={e => onChange({ ...options, style: e.target.value || null })} style={sel}>
          {STYLES.map(s => <option key={s.id || ''} value={s.id || ''}>{s.label}</option>)}
        </select>
      </div>

      {/* Toggles */}
      <div>
        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#555b6e', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Options</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button style={tog(options.texture !== false)} onClick={() => onChange({ ...options, texture: !options.texture })}>🎨 Texture</button>
          <button style={tog(options.pbr !== false)} onClick={() => onChange({ ...options, pbr: !options.pbr })}>✨ PBR</button>
          <button style={tog(!!options.smartLowPoly)} onClick={() => onChange({ ...options, smartLowPoly: !options.smartLowPoly })}>🎮 Low Poly</button>
        </div>
        <p style={{ fontSize: 10, color: '#3e4455', marginTop: 5 }}>Low Poly = optimized for Roblox · PBR = physically-based materials</p>
      </div>

      {/* Auth mode indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.12)', borderRadius: 8 }}>
        <span style={{ fontSize: 18 }}>⬡</span>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd' }}>Tripo3D — {authMode === 'sdk' ? 'SDK Mode (env var)' : 'API Key Mode'}</p>
          <p style={{ fontSize: 10, color: '#555b6e' }}>
            {authMode === 'sdk' ? 'Uses TRIPO_API_KEY env var — same as ComfyUI-Tripo' : 'Direct REST API with stored key'}
          </p>
        </div>
      </div>
    </div>
  )
}


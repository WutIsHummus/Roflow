/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'

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

const DEFAULT_TRIPO_WEB_BASE_URL = 'https://www.tripo3d.ai/'

export default function TripoPanel({ options, onChange }) {
  const [authMode, setAuthMode] = useState(options.authMode || 'web')
  const [apiKey, setApiKey] = useState(options.apiKey || '')
  const [showKey, setShowKey] = useState(false)
  const [webBaseUrl, setWebBaseUrl] = useState(options.webBaseUrl || DEFAULT_TRIPO_WEB_BASE_URL)
  const [webGenerateUrl, setWebGenerateUrl] = useState(
    options.webGenerateUrl || DEFAULT_TRIPO_WEB_BASE_URL
  )
  const [showBrowserAutomation, setShowBrowserAutomation] = useState(
    options.showBrowserAutomation !== false
  )
  const [sdkStatus, setSdkStatus] = useState('idle') // idle|checking|ok|error
  const [sdkMsg, setSdkMsg] = useState('')
  const [webStatus, setWebStatus] = useState('idle') // idle|checking|connected|login|error
  const [webMsg, setWebMsg] = useState('')
  const [webMeta, setWebMeta] = useState(null)
  const [balance, setBalance] = useState(null)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([
      window.api.configGet('tripoApiKey'),
      window.api.configGet('tripoAuthMode'),
      window.api.configGet('tripoWebBaseUrl'),
      window.api.configGet('tripoWebGenerateUrl'),
      window.api.configGet('tripoShowBrowserAutomation')
    ]).then(([key, mode, baseUrl, generateUrl, showBrowser]) => {
      if (!active) return
      if (key) setApiKey(key)
      if (mode) setAuthMode(mode)
      if (baseUrl) setWebBaseUrl(baseUrl)
      if (generateUrl) setWebGenerateUrl(generateUrl)
      if (typeof showBrowser === 'boolean') setShowBrowserAutomation(showBrowser)
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    onChange({
      authMode,
      apiKey: authMode === 'key' ? apiKey.trim() : '',
      webBaseUrl: webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL,
      webGenerateUrl: webGenerateUrl.trim() || webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL,
      showBrowserAutomation,
      modelVersion: options.modelVersion || 'v2.5-20250123',
      texture: options.texture !== false,
      pbr: options.pbr !== false,
      smartLowPoly: !!options.smartLowPoly,
      style: options.style || null
    })
  }, [
    authMode,
    apiKey,
    onChange,
    options.modelVersion,
    options.pbr,
    options.smartLowPoly,
    options.style,
    options.texture,
    webBaseUrl,
    webGenerateUrl,
    showBrowserAutomation
  ])

  async function saveSettings() {
    await window.api.configSet('tripoAuthMode', authMode)
    await window.api.configSet('tripoApiKey', apiKey.trim())
    await window.api.configSet('tripoWebBaseUrl', webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL)
    await window.api.configSet(
      'tripoWebGenerateUrl',
      webGenerateUrl.trim() || webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL
    )
    await window.api.configSet('tripoShowBrowserAutomation', showBrowserAutomation)
    setSavedMsg('Saved')
    setTimeout(() => setSavedMsg(''), 2000)
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

  async function checkWebSession() {
    setWebStatus('checking')
    setWebMsg('Checking Tripo browser session…')
    setWebMeta(null)
    const res = await window.api.tripoWebSessionStatus({
      baseUrl: webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL,
      generateUrl: webGenerateUrl.trim() || webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL
    })
    if (!res.success) {
      setWebStatus('error')
      setWebMsg(res.error || 'Could not inspect the Tripo website session.')
      return
    }
    if (res.connected) {
      setWebStatus('connected')
      setWebMsg('Connected — website session is ready for browser automation.')
    } else if (res.loginDetected) {
      setWebStatus('login')
      setWebMsg('Login required — open Connect Account and sign in to your Tripo website session.')
    } else {
      setWebStatus('error')
      setWebMsg('Session found, but the generation page was not detected. Check the base and generate URLs.')
    }
    setWebMeta(res)
  }

  async function openLogin() {
    setWebStatus('checking')
    setWebMsg('Opening Tripo login window…')
    const res = await window.api.tripoWebOpenLogin({
      baseUrl: webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL
    })
    if (!res.success) {
      setWebStatus('error')
      setWebMsg(res.error || 'Could not open the Tripo login window.')
      return
    }
    setWebStatus('idle')
    setWebMsg('Browser session opened. Log in there, then run Check Session here.')
  }

  async function openGeneratePage() {
    const res = await window.api.tripoWebOpenGenerate({
      baseUrl: webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL,
      generateUrl: webGenerateUrl.trim() || webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL
    })
    if (!res.success) {
      setWebStatus('error')
      setWebMsg(res.error || 'Could not open the Tripo generation page.')
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
  const setMode = (mode) => {
    setAuthMode(mode)
    setBalance(null)
  }
  const sdkColor = { idle: '#888', checking: '#f59e0b', ok: '#4ade80', error: '#f87171' }[sdkStatus]
  const webColor = {
    idle: '#888',
    checking: '#f59e0b',
    connected: '#4ade80',
    login: '#fbbf24',
    error: '#f87171'
  }[webStatus]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Auth mode switcher */}
      <div>
        <label style={{ fontSize: 11, color: '#555b6e', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          Authentication Mode
        </label>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={modeBtn(authMode === 'web')} onClick={() => setMode('web')}>
            🌐 Browser Session
          </button>
          <button style={modeBtn(authMode === 'sdk')} onClick={() => setMode('sdk')}>
            🐍 SDK
          </button>
          <button style={modeBtn(authMode === 'key')} onClick={() => setMode('key')}>
            🔑 Legacy API
          </button>
        </div>
      </div>

      {authMode === 'web' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div
            style={{
              background: '#12131a',
              border: '1px solid rgba(124,58,237,0.22)',
              borderRadius: 8,
              padding: '12px 14px'
            }}
          >
            <div style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              🌐 Browser Session Mode — recommended
            </div>
            <div style={{ fontSize: 11, color: '#7c8396', lineHeight: 1.7 }}>
              Use your normal Tripo website account in a persistent Electron browser window. This
              matches the product direction better than API-key wiring.
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#555b6e', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Tripo Base URL
            </label>
            <input
              value={webBaseUrl}
              onChange={(e) => setWebBaseUrl(e.target.value)}
              placeholder="https://www.tripo3d.ai/"
              style={{ width: '100%', background: '#111318', border: '1px solid #1e2330', borderRadius: 7, padding: '8px 11px', fontSize: 13, color: '#eef0f6', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#555b6e', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Generation URL
            </label>
            <input
              value={webGenerateUrl}
              onChange={(e) => setWebGenerateUrl(e.target.value)}
              placeholder="https://www.tripo3d.ai/"
              style={{ width: '100%', background: '#111318', border: '1px solid #1e2330', borderRadius: 7, padding: '8px 11px', fontSize: 13, color: '#eef0f6', outline: 'none', boxSizing: 'border-box' }}
            />
            <p style={{ fontSize: 10, color: '#3e4455', marginTop: 5 }}>
              If Tripo changes layouts, point this to the exact create/generate page you use.
            </p>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showBrowserAutomation}
              onChange={(e) => setShowBrowserAutomation(e.target.checked)}
              style={{ accentColor: '#a78bfa' }}
            />
            <span style={{ fontSize: 12, color: '#9499a8' }}>
              Keep the browser visible while Tripo generates
            </span>
          </label>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={openLogin}
              style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.38)', borderRadius: 6, color: '#c4b5fd', fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}
            >
              Connect Account
            </button>
            <button
              onClick={checkWebSession}
              disabled={webStatus === 'checking'}
              style={{ background: '#1a1d26', border: '1px solid #252a36', borderRadius: 6, color: '#9499a8', fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}
            >
              {webStatus === 'checking' ? 'Checking…' : 'Check Session'}
            </button>
            <button
              onClick={openGeneratePage}
              style={{ background: '#1a1d26', border: '1px solid #252a36', borderRadius: 6, color: '#9499a8', fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}
            >
              Open Generate Page
            </button>
            <button
              onClick={saveSettings}
              style={{ background: savedMsg ? 'rgba(74,222,128,0.15)' : '#152018', border: savedMsg ? '1px solid rgba(74,222,128,0.3)' : '1px solid #1a3a1e', borderRadius: 6, color: savedMsg ? '#4ade80' : '#86efac', fontSize: 11, padding: '6px 12px', cursor: 'pointer' }}
            >
              {savedMsg || 'Save'}
            </button>
          </div>

          {(webMsg || webMeta) && (
            <div style={{ background: '#10131a', border: '1px solid #1e2330', borderRadius: 8, padding: '10px 12px' }}>
              {webMsg && <div style={{ fontSize: 11, color: webColor }}>● {webMsg}</div>}
              {webMeta && (
                <div style={{ marginTop: 7, fontSize: 11, color: '#555b6e', lineHeight: 1.7 }}>
                  <div>Title: <span style={{ color: '#9499a8' }}>{webMeta.title || 'Unknown'}</span></div>
                  <div>URL: <span style={{ color: '#9499a8' }}>{webMeta.url || 'Unknown'}</span></div>
                  <div>Cookies: <span style={{ color: '#9499a8' }}>{webMeta.cookieCount ?? 0}</span></div>
                  <div>Prompt inputs found: <span style={{ color: '#9499a8' }}>{webMeta.promptCandidates ?? 0}</span></div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* SDK mode */}
      {authMode === 'sdk' && (
        <div style={{ background: '#0f1a10', border: '1px solid #1a3a1e', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
            🐍 SDK Mode — advanced fallback
          </div>
          <div style={{ fontSize: 11, color: '#6b9e72', lineHeight: 1.7 }}>
            <div>Set <code style={{ background: '#152018', color: '#86efac', padding: '1px 5px', borderRadius: 3 }}>TRIPO_API_KEY=tsk_xxx</code> in your system environment.</div>
            <div style={{ marginTop: 4, color: '#4a7a52' }}>Keep this only if you intentionally want the ComfyUI-style SDK path.</div>
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
          <div style={{ background: '#1a1314', border: '1px solid #3a1a1e', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
            <div style={{ color: '#fda4af', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
              🔑 Legacy API key mode
            </div>
            <div style={{ fontSize: 11, color: '#b07b84', lineHeight: 1.7 }}>
              This stays available as a fallback, but it is not the preferred product flow.
            </div>
          </div>
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
            <button onClick={saveSettings} disabled={!apiKey.trim()} style={{ padding: '8px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: savedMsg ? 'rgba(74,222,128,0.15)' : 'rgba(124,58,237,0.2)', border: savedMsg ? '1px solid rgba(74,222,128,0.3)' : '1px solid rgba(124,58,237,0.4)', color: savedMsg ? '#4ade80' : '#c4b5fd', cursor: 'pointer' }}>
              {savedMsg || 'Save'}
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
          <p style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd' }}>
            Tripo3D — {authMode === 'web' ? 'Browser Session' : authMode === 'sdk' ? 'SDK Mode (advanced)' : 'API Key Mode (legacy)'}
          </p>
          <p style={{ fontSize: 10, color: '#555b6e' }}>
            {authMode === 'web'
              ? 'Uses your logged-in Tripo website session instead of an API key.'
              : authMode === 'sdk'
                ? 'Uses TRIPO_API_KEY env var — same as ComfyUI-Tripo.'
                : 'Direct REST API with a stored key.'}
          </p>
        </div>
      </div>
    </div>
  )
}


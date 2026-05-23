/* eslint-disable react/prop-types */
import { useEffect, useState } from 'react'

const STYLES = [
  { id: null, label: 'None (Default)' },
  { id: 'realistic', label: 'Realistic' },
  { id: 'cartoon', label: 'Cartoon' },
  { id: 'anime', label: 'Anime' },
  { id: 'low-poly', label: 'Low Poly' },
  { id: 'voxel', label: 'Voxel' },
  { id: 'steampunk', label: 'Steampunk' },
  { id: 'clay', label: 'Clay' }
]

const VERSIONS = [
  { id: 'v3.0-20250421', label: 'v3.0 (Latest)' },
  { id: 'v2.5-20250123', label: 'v2.5 (Quality)' },
  { id: 'v2.0-20240919', label: 'v2.0 (Fast)' }
]

const DOWNLOAD_FORMATS = [
  { id: 'glb', label: 'GLB' },
  { id: 'fbx', label: 'FBX' },
  { id: 'obj', label: 'OBJ' },
  { id: 'stl', label: 'STL' }
]

const DEFAULT_TRIPO_WEB_BASE_URL = 'https://www.tripo3d.ai/'

export default function TripoPanel({ options, onChange }) {
  const [webBaseUrl, setWebBaseUrl] = useState(options.webBaseUrl || DEFAULT_TRIPO_WEB_BASE_URL)
  const [webGenerateUrl, setWebGenerateUrl] = useState(
    options.webGenerateUrl || DEFAULT_TRIPO_WEB_BASE_URL
  )
  const [showBrowserAutomation, setShowBrowserAutomation] = useState(
    options.showBrowserAutomation !== false
  )
  const [webStatus, setWebStatus] = useState('idle')
  const [webMsg, setWebMsg] = useState('')
  const [webMeta, setWebMeta] = useState(null)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([
      window.api.configGet('tripoWebBaseUrl'),
      window.api.configGet('tripoWebGenerateUrl'),
      window.api.configGet('tripoShowBrowserAutomation')
    ]).then(([baseUrl, generateUrl, showBrowser]) => {
      if (!active) return
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
      authMode: 'web',
      webBaseUrl: webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL,
      webGenerateUrl: webGenerateUrl.trim() || webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL,
      showBrowserAutomation,
      modelVersion: options.modelVersion || 'v3.0-20250421',
      texture: options.texture !== false,
      pbr: options.pbr !== false,
      smartLowPoly: !!options.smartLowPoly,
      style: options.style || null,
      downloadFormat: options.downloadFormat || 'glb'
    })
  }, [
    onChange,
    options.modelVersion,
    options.pbr,
    options.smartLowPoly,
    options.style,
    options.texture,
    options.downloadFormat,
    showBrowserAutomation,
    webBaseUrl,
    webGenerateUrl
  ])

  async function saveSettings() {
    await window.api.configSet('tripoAuthMode', 'web')
    await window.api.configSet('tripoWebBaseUrl', webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL)
    await window.api.configSet(
      'tripoWebGenerateUrl',
      webGenerateUrl.trim() || webBaseUrl.trim() || DEFAULT_TRIPO_WEB_BASE_URL
    )
    await window.api.configSet('tripoShowBrowserAutomation', showBrowserAutomation)
    setSavedMsg('Saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  async function checkWebSession() {
    setWebStatus('checking')
    setWebMsg('Checking Tripo browser sessionΓÇª')
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
      setWebMsg('Connected ΓÇö website session is ready for browser automation.')
    } else if (res.loginDetected) {
      setWebStatus('login')
      setWebMsg('Login required ΓÇö open Connect Account and sign in to your Tripo website session.')
    } else {
      setWebStatus('error')
      setWebMsg('Session found, but the generation page was not detected. Check the base and generate URLs.')
    }
    setWebMeta(res)
  }

  async function openLogin() {
    setWebStatus('checking')
    setWebMsg('Opening Tripo login windowΓÇª')
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

  const sel = {
    width: '100%',
    background: '#111318',
    border: '1px solid #1e2330',
    borderRadius: 7,
    padding: '7px 10px',
    fontSize: 12,
    color: '#9499a8',
    cursor: 'pointer',
    outline: 'none',
    boxSizing: 'border-box'
  }
  const tog = (active) => ({
    flex: 1,
    padding: '7px 10px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    cursor: 'pointer',
    background: active ? 'rgba(124,58,237,0.2)' : '#1a1d26',
    color: active ? '#c4b5fd' : '#555b6e',
    border: `1px solid ${active ? '#7c3aed' : '#252a36'}`
  })
  const webColor = {
    idle: '#888',
    checking: '#f59e0b',
    connected: '#4ade80',
    login: '#fbbf24',
    error: '#f87171'
  }[webStatus]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          background: '#12131a',
          border: '1px solid rgba(124,58,237,0.22)',
          borderRadius: 8,
          padding: '12px 14px'
        }}
      >
        <div style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
          ≡ƒîÉ Browser Session Only
        </div>
        <div style={{ fontSize: 11, color: '#7c8396', lineHeight: 1.7 }}>
          Modeling runs through your normal Tripo website account in a persistent Electron browser
          window. Alternate provider and API fallback paths have been removed.
        </div>
      </div>

      <div>
        <label
          style={{
            fontSize: 11,
            color: '#555b6e',
            display: 'block',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.07em'
          }}
        >
          Tripo Base URL
        </label>
        <input
          value={webBaseUrl}
          onChange={(e) => setWebBaseUrl(e.target.value)}
          placeholder="https://www.tripo3d.ai/"
          style={{
            width: '100%',
            background: '#111318',
            border: '1px solid #1e2330',
            borderRadius: 7,
            padding: '8px 11px',
            fontSize: 13,
            color: '#eef0f6',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div>
        <label
          style={{
            fontSize: 11,
            color: '#555b6e',
            display: 'block',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.07em'
          }}
        >
          Generation URL
        </label>
        <input
          value={webGenerateUrl}
          onChange={(e) => setWebGenerateUrl(e.target.value)}
          placeholder="https://www.tripo3d.ai/"
          style={{
            width: '100%',
            background: '#111318',
            border: '1px solid #1e2330',
            borderRadius: 7,
            padding: '8px 11px',
            fontSize: 13,
            color: '#eef0f6',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        <p style={{ fontSize: 10, color: '#3e4455', marginTop: 5 }}>
          If Tripo changes layouts, point this to the exact create/generate page you use.
        </p>
      </div>

      <label
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}
      >
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
          style={{
            background: 'rgba(124,58,237,0.2)',
            border: '1px solid rgba(124,58,237,0.38)',
            borderRadius: 6,
            color: '#c4b5fd',
            fontSize: 11,
            padding: '6px 12px',
            cursor: 'pointer'
          }}
        >
          Connect Account
        </button>
        <button
          onClick={checkWebSession}
          disabled={webStatus === 'checking'}
          style={{
            background: '#1a1d26',
            border: '1px solid #252a36',
            borderRadius: 6,
            color: '#9499a8',
            fontSize: 11,
            padding: '6px 12px',
            cursor: 'pointer'
          }}
        >
          {webStatus === 'checking' ? 'CheckingΓÇª' : 'Check Session'}
        </button>
        <button
          onClick={openGeneratePage}
          style={{
            background: '#1a1d26',
            border: '1px solid #252a36',
            borderRadius: 6,
            color: '#9499a8',
            fontSize: 11,
            padding: '6px 12px',
            cursor: 'pointer'
          }}
        >
          Open Generate Page
        </button>
        <button
          onClick={saveSettings}
          style={{
            background: savedMsg ? 'rgba(74,222,128,0.15)' : '#152018',
            border: savedMsg ? '1px solid rgba(74,222,128,0.3)' : '1px solid #1a3a1e',
            borderRadius: 6,
            color: savedMsg ? '#4ade80' : '#86efac',
            fontSize: 11,
            padding: '6px 12px',
            cursor: 'pointer'
          }}
        >
          {savedMsg || 'Save'}
        </button>
      </div>

      {(webMsg || webMeta) && (
        <div
          style={{ background: '#10131a', border: '1px solid #1e2330', borderRadius: 8, padding: '10px 12px' }}
        >
          {webMsg && <div style={{ fontSize: 11, color: webColor }}>ΓùÅ {webMsg}</div>}
          {webMeta && (
            <div style={{ marginTop: 7, fontSize: 11, color: '#555b6e', lineHeight: 1.7 }}>
              <div>
                Title: <span style={{ color: '#9499a8' }}>{webMeta.title || 'Unknown'}</span>
              </div>
              <div>
                URL: <span style={{ color: '#9499a8' }}>{webMeta.url || 'Unknown'}</span>
              </div>
              <div>
                Cookies:{' '}
                <span style={{ color: '#9499a8' }}>{webMeta.cookieCount ?? 0}</span>
              </div>
              <div>
                Prompt inputs found:{' '}
                <span style={{ color: '#9499a8' }}>{webMeta.promptCandidates ?? 0}</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: '#555b6e',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.07em'
          }}
        >
          Model Version
        </label>
        <select
          value={options.modelVersion || 'v3.0-20250421'}
          onChange={(e) => onChange({ ...options, modelVersion: e.target.value, authMode: 'web' })}
          style={sel}
        >
          {VERSIONS.map((version) => (
            <option key={version.id} value={version.id}>
              {version.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: '#555b6e',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.07em'
          }}
        >
          Style
        </label>
        <select
          value={options.style || ''}
          onChange={(e) => onChange({ ...options, style: e.target.value || null, authMode: 'web' })}
          style={sel}
        >
          {STYLES.map((style) => (
            <option key={style.id || ''} value={style.id || ''}>
              {style.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: '#555b6e',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.07em'
          }}
        >
          Download Format
        </label>
        <select
          value={options.downloadFormat || 'glb'}
          onChange={(e) => onChange({ ...options, downloadFormat: e.target.value, authMode: 'web' })}
          style={sel}
        >
          {DOWNLOAD_FORMATS.map((fmt) => (
            <option key={fmt.id} value={fmt.id}>
              {fmt.label}
            </option>
          ))}
        </select>
        <p style={{ fontSize: 10, color: '#3e4455', marginTop: 5 }}>
          GLB recommended for Roblox and Playground preview
        </p>
      </div>

      <div>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: '#555b6e',
            marginBottom: 6,
            textTransform: 'uppercase',
            letterSpacing: '0.07em'
          }}
        >
          Options
        </label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button
            style={tog(options.texture !== false)}
            onClick={() => onChange({ ...options, texture: !options.texture, authMode: 'web' })}
          >
            Texture
          </button>
          <button
            style={tog(options.pbr !== false)}
            onClick={() => onChange({ ...options, pbr: !options.pbr, authMode: 'web' })}
          >
            PBR
          </button>
          <button
            style={tog(!!options.smartLowPoly)}
            onClick={() =>
              onChange({ ...options, smartLowPoly: !options.smartLowPoly, authMode: 'web' })
            }
          >
            Low Poly
          </button>
        </div>
        <p style={{ fontSize: 10, color: '#3e4455', marginTop: 5 }}>
          Low Poly = optimized for Roblox ┬╖ PBR = physically-based materials
        </p>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          background: 'rgba(124,58,237,0.06)',
          border: '1px solid rgba(124,58,237,0.12)',
          borderRadius: 8
        }}
      >
        <span style={{ fontSize: 18 }}>Γ¼í</span>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#c4b5fd' }}>
            Tripo3D ΓÇö Browser Session
          </p>
          <p style={{ fontSize: 10, color: '#555b6e' }}>
            Uses your logged-in Tripo website session instead of alternate providers.
          </p>
        </div>
      </div>
    </div>
  )
}

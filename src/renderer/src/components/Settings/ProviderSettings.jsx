/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from 'react'
import { CONFIG_KEYS } from '../../../../shared/configKeys.js'

const SAVE_DEBOUNCE_MS = 600

const DEFAULT_PROVIDER_WEB_CONFIG = {
  manusLoginUrl: 'https://manus.im/',
  manusWorkspaceUrl: 'https://manus.im/',
  chatgptLoginUrl: 'https://chatgpt.com/auth/login',
  chatgptWorkspaceUrl: 'https://chatgpt.com/',
  elevenlabsWebLoginUrl: 'https://elevenlabs.io/',
  elevenlabsWebImageUrl: 'https://elevenlabs.io/image'
}

const PROVIDERS = [
  {
    id: 'manus',
    label: 'Manus',
    accent: '#60a5fa',
    loginKey: 'manusLoginUrl',
    workspaceKey: 'manusWorkspaceUrl'
  },
  {
    id: 'chatgpt-image',
    label: 'ChatGPT Image',
    accent: '#34d399',
    loginKey: 'chatgptLoginUrl',
    workspaceKey: 'chatgptWorkspaceUrl'
  },
  {
    id: 'elevenlabs-image',
    label: 'ElevenLabs Image',
    accent: '#f97316',
    loginKey: 'elevenlabsWebLoginUrl',
    workspaceKey: 'elevenlabsWebImageUrl'
  }
]

const DEFAULT_SESSION_STATE = {
  checked: false,
  loading: false,
  connected: false,
  loginDetected: false,
  cookieCount: 0,
  promptCandidates: 0,
  error: null
}

const inputStyle = {
  width: '100%',
  background: '#111318',
  border: '1px solid #1e2330',
  borderRadius: 7,
  padding: '8px 11px',
  fontSize: 13,
  color: '#eef0f6',
  outline: 'none',
  boxSizing: 'border-box'
}

const labelStyle = {
  fontSize: 11,
  color: '#555b6e',
  display: 'block',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.07em'
}

const btnStyle = {
  background: '#1a1d26',
  border: '1px solid #252a36',
  borderRadius: 6,
  color: '#9499a8',
  fontSize: 11,
  padding: '6px 12px',
  cursor: 'pointer'
}

const primaryBtnStyle = {
  ...btnStyle,
  background: 'rgba(124,58,237,0.2)',
  border: '1px solid rgba(124,58,237,0.38)',
  color: '#c4b5fd'
}

function ProviderSessionCard({ provider, session, onRefresh, onConnect, onWorkspace }) {
  const statusLabel = session.loading
    ? 'Checking…'
    : session.connected
      ? 'Connected'
      : session.loginDetected
        ? 'Login required'
        : session.checked
          ? 'Not connected'
          : 'Not checked'

  const statusColor = session.connected
    ? '#4ade80'
    : session.loginDetected
      ? '#f59e0b'
      : '#94a3b8'

  return (
    <div
      style={{
        background: '#141821',
        border: '1px solid #202533',
        borderRadius: 12,
        padding: 14
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: provider.accent }}>{provider.label}</div>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: statusColor,
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          {statusLabel}
        </span>
      </div>

      {session.error && (
        <div
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            borderRadius: 8,
            background: 'rgba(248,113,113,0.08)',
            border: '1px solid rgba(248,113,113,0.18)',
            color: '#fca5a5',
            fontSize: 11,
            lineHeight: 1.6
          }}
        >
          {session.error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button style={primaryBtnStyle} onClick={() => onConnect(provider.id)}>
          Connect
        </button>
        <button style={btnStyle} onClick={() => onWorkspace(provider.id)}>
          Workspace
        </button>
        <button style={btnStyle} onClick={() => onRefresh(provider.id)}>
          Refresh
        </button>
      </div>
    </div>
  )
}

function SavedBadge({ visible, label = 'Key saved' }) {
  if (!visible) return null
  return (
    <span
      style={{
        fontSize: 10,
        color: '#4ade80',
        marginLeft: 8,
        fontWeight: 600,
        letterSpacing: '0.04em'
      }}
    >
      {label}
    </span>
  )
}

export default function ProviderSettings() {
  const [replicateToken, setReplicateToken] = useState('')
  const [deepseekApiKey, setDeepseekApiKey] = useState('')
  const [elevenLabsApiKey, setElevenLabsApiKey] = useState('')
  const [providerWebConfig, setProviderWebConfig] = useState(DEFAULT_PROVIDER_WEB_CONFIG)
  const [sessionState, setSessionState] = useState({
    manus: { ...DEFAULT_SESSION_STATE },
    'chatgpt-image': { ...DEFAULT_SESSION_STATE },
    'elevenlabs-image': { ...DEFAULT_SESSION_STATE }
  })
  const [savedMsg, setSavedMsg] = useState('')
  const [savedFields, setSavedFields] = useState({})
  const [loaded, setLoaded] = useState(false)
  const debouncersRef = useRef({})
  const savedTimersRef = useRef({})
  const providerWebConfigRef = useRef(providerWebConfig)

  useEffect(() => {
    providerWebConfigRef.current = providerWebConfig
  }, [providerWebConfig])

  const markFieldSaved = useCallback((field, label = 'Key saved') => {
    setSavedFields((prev) => ({ ...prev, [field]: label }))
    clearTimeout(savedTimersRef.current[field])
    savedTimersRef.current[field] = setTimeout(() => {
      setSavedFields((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }, 2000)
  }, [])

  const persistConfigValue = useCallback(
    async (configKey, value, field, savedLabel = 'Key saved') => {
      await window.api.configSet(configKey, value)
      markFieldSaved(field, savedLabel)
    },
    [markFieldSaved]
  )

  const schedulePersist = useCallback(
    (field, saveFn) => {
      clearTimeout(debouncersRef.current[field])
      debouncersRef.current[field] = setTimeout(() => {
        saveFn()
      }, SAVE_DEBOUNCE_MS)
    },
    []
  )

  const flushPersist = useCallback((field, saveFn) => {
    clearTimeout(debouncersRef.current[field])
    saveFn()
  }, [])

  const persistProviderWebConfig = useCallback(
    async (nextConfig) => {
      await window.api.configSet(CONFIG_KEYS.CLOTHING_PROVIDER_WEB_CONFIG, nextConfig)
      await window.api.configSet(CONFIG_KEYS.UI_PROVIDER_WEB_CONFIG, nextConfig)
      markFieldSaved('providerUrls', 'URLs saved')
    },
    [markFieldSaved]
  )

  useEffect(() => {
    let active = true

    Promise.all([
      window.api.configGet(CONFIG_KEYS.REPLICATE_API_TOKEN),
      window.api.configGet(CONFIG_KEYS.DEEPSEEK_API_KEY),
      window.api.configGet(CONFIG_KEYS.ELEVEN_LABS_API_KEY),
      window.api.configGet(CONFIG_KEYS.CLOTHING_PROVIDER_WEB_CONFIG),
      window.api.configGet(CONFIG_KEYS.UI_PROVIDER_WEB_CONFIG)
    ]).then(([token, deepseekKey, elevenKey, clothingConfig, uiConfig]) => {
      if (!active) return
      if (token) setReplicateToken(token)
      if (deepseekKey) setDeepseekApiKey(deepseekKey)
      if (elevenKey) setElevenLabsApiKey(elevenKey)
      const merged = {
        ...DEFAULT_PROVIDER_WEB_CONFIG,
        ...(clothingConfig && typeof clothingConfig === 'object' ? clothingConfig : {}),
        ...(uiConfig && typeof uiConfig === 'object' ? uiConfig : {})
      }
      setProviderWebConfig(merged)
      setLoaded(true)
    })

    return () => {
      active = false
    }
  }, [])

  const getProviderWebOptions = useCallback(
    (providerId) => {
      if (providerId === 'manus') {
        return {
          loginUrl: providerWebConfig.manusLoginUrl,
          workspaceUrl: providerWebConfig.manusWorkspaceUrl
        }
      }
      if (providerId === 'elevenlabs-image') {
        return {
          loginUrl: providerWebConfig.elevenlabsWebLoginUrl,
          imageUrl: providerWebConfig.elevenlabsWebImageUrl
        }
      }
      return {
        loginUrl: providerWebConfig.chatgptLoginUrl,
        workspaceUrl: providerWebConfig.chatgptWorkspaceUrl
      }
    },
    [providerWebConfig]
  )

  const refreshProviderStatus = useCallback(
    async (providerId) => {
      const options = getProviderWebOptions(providerId)
      setSessionState((prev) => ({
        ...prev,
        [providerId]: { ...prev[providerId], loading: true, error: null }
      }))

      const result =
        providerId === 'manus'
          ? await window.api.manusWebSessionStatus(options)
          : providerId === 'elevenlabs-image'
            ? await window.api.elevenLabsWebSessionStatus(options)
            : await window.api.chatgptWebSessionStatus(options)

      setSessionState((prev) => ({
        ...prev,
        [providerId]: {
          checked: true,
          loading: false,
          connected: Boolean(result?.connected),
          loginDetected: Boolean(result?.loginDetected),
          cookieCount: Number(result?.cookieCount || 0),
          promptCandidates: Number(result?.promptCandidates || 0),
          error: result?.success === false ? result.error || 'Session check failed.' : null
        }
      }))
    },
    [getProviderWebOptions]
  )

  useEffect(() => {
    if (!loaded) return
    const timeout = window.setTimeout(() => {
      refreshProviderStatus('manus')
      refreshProviderStatus('chatgpt-image')
      refreshProviderStatus('elevenlabs-image')
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [loaded, refreshProviderStatus])

  const openProviderLogin = useCallback(
    async (providerId) => {
      const options = getProviderWebOptions(providerId)
      if (providerId === 'manus') {
        await window.api.manusWebOpenLogin(options)
      } else if (providerId === 'elevenlabs-image') {
        await window.api.elevenLabsWebOpenLogin(options)
      } else {
        await window.api.chatgptWebOpenLogin(options)
      }
    },
    [getProviderWebOptions]
  )

  const openProviderWorkspace = useCallback(
    async (providerId) => {
      const options = getProviderWebOptions(providerId)
      if (providerId === 'manus') {
        await window.api.manusWebOpenWorkspace(options)
      } else if (providerId === 'elevenlabs-image') {
        await window.api.elevenLabsWebOpenImageStudio(options)
      } else {
        await window.api.chatgptWebOpenWorkspace(options)
      }
    },
    [getProviderWebOptions]
  )

  async function saveSettings() {
    clearTimeout(debouncersRef.current.deepseekApiKey)
    clearTimeout(debouncersRef.current.elevenLabsApiKey)
    clearTimeout(debouncersRef.current.replicateApiToken)
    clearTimeout(debouncersRef.current.providerUrls)

    await persistConfigValue(
      CONFIG_KEYS.REPLICATE_API_TOKEN,
      replicateToken.trim(),
      'replicateApiToken'
    )
    await persistConfigValue(CONFIG_KEYS.DEEPSEEK_API_KEY, deepseekApiKey.trim(), 'deepseekApiKey')
    await persistConfigValue(
      CONFIG_KEYS.ELEVEN_LABS_API_KEY,
      elevenLabsApiKey.trim(),
      'elevenLabsApiKey'
    )
    await persistProviderWebConfig(providerWebConfig)
    setSavedMsg('All settings saved')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  function handleApiKeyChange(field, configKey, value, setter) {
    setter(value)
    schedulePersist(field, () => {
      persistConfigValue(configKey, value.trim(), field)
    })
  }

  function handleApiKeyBlur(field, configKey, value) {
    flushPersist(field, () => {
      persistConfigValue(configKey, value.trim(), field)
    })
  }

  function updateConfig(key, value) {
    setProviderWebConfig((prev) => {
      const next = { ...prev, [key]: value }
      providerWebConfigRef.current = next
      schedulePersist('providerUrls', () => {
        persistProviderWebConfig(next)
      })
      return next
    })
  }

  function handleProviderUrlBlur() {
    flushPersist('providerUrls', () => {
      persistProviderWebConfig(providerWebConfigRef.current)
    })
  }

  if (!loaded) {
    return <div style={{ fontSize: 12, color: '#555b6e' }}>Loading provider settings…</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          background: '#141821',
          border: '1px solid #202533',
          borderRadius: 12,
          padding: 14
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 4 }}>
          DeepSeek API Key
          <SavedBadge visible={Boolean(savedFields.deepseekApiKey)} label={savedFields.deepseekApiKey} />
        </div>
        <p style={{ fontSize: 11, color: '#555b6e', marginBottom: 12, lineHeight: 1.6 }}>
          Used by the VFX module to generate particle layer logic with DeepSeek V4.
        </p>
        <label style={labelStyle}>API Key</label>
        <input
          value={deepseekApiKey}
          onChange={(e) =>
            handleApiKeyChange(
              'deepseekApiKey',
              CONFIG_KEYS.DEEPSEEK_API_KEY,
              e.target.value,
              setDeepseekApiKey
            )
          }
          onBlur={() => handleApiKeyBlur('deepseekApiKey', CONFIG_KEYS.DEEPSEEK_API_KEY, deepseekApiKey)}
          placeholder="sk-..."
          type="password"
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={() => window.api.openExternalUrl('https://platform.deepseek.com/api_keys')}
            style={btnStyle}
          >
            Get API Key
          </button>
        </div>
      </div>

      <div
        style={{
          background: '#141821',
          border: '1px solid #202533',
          borderRadius: 12,
          padding: 14
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 4 }}>
          ElevenLabs API Key
          <SavedBadge visible={Boolean(savedFields.elevenLabsApiKey)} label={savedFields.elevenLabsApiKey} />
        </div>
        <p style={{ fontSize: 11, color: '#555b6e', marginBottom: 12, lineHeight: 1.6 }}>
          Used by the SFX module for cloud sound effects and speech generation. Image Studio uses a
          separate browser session below — no image API key is required.
        </p>
        <label style={labelStyle}>API Key</label>
        <input
          value={elevenLabsApiKey}
          onChange={(e) =>
            handleApiKeyChange(
              'elevenLabsApiKey',
              CONFIG_KEYS.ELEVEN_LABS_API_KEY,
              e.target.value,
              setElevenLabsApiKey
            )
          }
          onBlur={() =>
            handleApiKeyBlur('elevenLabsApiKey', CONFIG_KEYS.ELEVEN_LABS_API_KEY, elevenLabsApiKey)
          }
          placeholder="sk_..."
          type="password"
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={() => window.api.openExternalUrl('https://elevenlabs.io/app/settings/api-keys')}
            style={btnStyle}
          >
            Get API Key
          </button>
        </div>
      </div>

      <div
        style={{
          background: '#141821',
          border: '1px solid #202533',
          borderRadius: 12,
          padding: 14
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 4 }}>
          Replicate API Token
          <SavedBadge visible={Boolean(savedFields.replicateApiToken)} label={savedFields.replicateApiToken} />
        </div>
        <p style={{ fontSize: 11, color: '#555b6e', marginBottom: 12, lineHeight: 1.6 }}>
          Used by the Clothing module for FLUX image generation.
        </p>
        <label style={labelStyle}>API Token</label>
        <input
          value={replicateToken}
          onChange={(e) =>
            handleApiKeyChange(
              'replicateApiToken',
              CONFIG_KEYS.REPLICATE_API_TOKEN,
              e.target.value,
              setReplicateToken
            )
          }
          onBlur={() =>
            handleApiKeyBlur('replicateApiToken', CONFIG_KEYS.REPLICATE_API_TOKEN, replicateToken)
          }
          placeholder="r8_..."
          type="password"
          style={inputStyle}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button
            onClick={() => window.api.openExternalUrl('https://replicate.com/account/api-tokens')}
            style={btnStyle}
          >
            Get Token
          </button>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 4 }}>
          Provider URLs
          <SavedBadge visible={Boolean(savedFields.providerUrls)} label={savedFields.providerUrls} />
        </div>
        <p style={{ fontSize: 11, color: '#555b6e', marginBottom: 12, lineHeight: 1.6 }}>
          Used by Clothing, UI Studio, and VFX for browser-based generation.
        </p>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={labelStyle}>Manus Login URL</label>
            <input
              value={providerWebConfig.manusLoginUrl}
              onChange={(e) => updateConfig('manusLoginUrl', e.target.value)}
              onBlur={handleProviderUrlBlur}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Manus Workspace URL</label>
            <input
              value={providerWebConfig.manusWorkspaceUrl}
              onChange={(e) => updateConfig('manusWorkspaceUrl', e.target.value)}
              onBlur={handleProviderUrlBlur}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>ChatGPT Login URL</label>
            <input
              value={providerWebConfig.chatgptLoginUrl}
              onChange={(e) => updateConfig('chatgptLoginUrl', e.target.value)}
              onBlur={handleProviderUrlBlur}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>ChatGPT Workspace URL</label>
            <input
              value={providerWebConfig.chatgptWorkspaceUrl}
              onChange={(e) => updateConfig('chatgptWorkspaceUrl', e.target.value)}
              onBlur={handleProviderUrlBlur}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>ElevenLabs Login URL</label>
            <input
              value={providerWebConfig.elevenlabsWebLoginUrl}
              onChange={(e) => updateConfig('elevenlabsWebLoginUrl', e.target.value)}
              onBlur={handleProviderUrlBlur}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>ElevenLabs Image Studio URL</label>
            <input
              value={providerWebConfig.elevenlabsWebImageUrl}
              onChange={(e) => updateConfig('elevenlabsWebImageUrl', e.target.value)}
              onBlur={handleProviderUrlBlur}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 12 }}>
          Browser Sessions
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {PROVIDERS.map((provider) => (
            <ProviderSessionCard
              key={provider.id}
              provider={provider}
              session={sessionState[provider.id] || DEFAULT_SESSION_STATE}
              onRefresh={refreshProviderStatus}
              onConnect={openProviderLogin}
              onWorkspace={openProviderWorkspace}
            />
          ))}
        </div>
      </div>

      <div>
        <button
          onClick={saveSettings}
          style={{
            ...primaryBtnStyle,
            background: savedMsg ? 'rgba(74,222,128,0.15)' : primaryBtnStyle.background,
            border: savedMsg ? '1px solid rgba(74,222,128,0.3)' : primaryBtnStyle.border,
            color: savedMsg ? '#4ade80' : primaryBtnStyle.color
          }}
        >
          {savedMsg || 'Save Provider Settings'}
        </button>
      </div>
    </div>
  )
}

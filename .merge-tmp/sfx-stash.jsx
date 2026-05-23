/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Play, Settings, Sparkles, Volume2, AlertCircle, RefreshCw } from 'lucide-react'
import { CONFIG_KEYS } from '../../../../shared/configKeys.js'
import { useConfigKey } from '../../hooks/useConfigKey.js'

const PROVIDERS = {
  elevenlabs: {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    accent: '#f472b6',
    description: 'Cloud sound effects and speech via ElevenLabs API.'
  },
  'stable-audio': {
    id: 'stable-audio',
    label: 'Stable Audio 3',
    accent: '#34d399',
    description: 'Local text-to-audio with Stable Audio 3 (no cloud API).'
  }
}

const ELEVENLABS_MODES = [
  { id: 'sfx', label: 'Sound Effect' },
  { id: 'speech', label: 'Speech' }
]

const STABLE_AUDIO_MODELS = [
  { id: 'small-sfx', label: 'Small SFX (CPU)' },
  { id: 'small-music', label: 'Small Music (CPU)' },
  { id: 'medium', label: 'Medium (CUDA GPU)' }
]

const styles = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'radial-gradient(circle at top left, rgba(20, 24, 33, 0.4), rgba(10, 11, 15, 0.6))',
    position: 'relative',
    overflow: 'hidden'
  },
  header: {
    padding: '24px 24px 12px',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(0,0,0,0.15)',
    flexShrink: 0
  },
  title: { fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', color: '#f1f5f9', margin: 0 },
  subtitle: { fontSize: 12.5, color: '#94a3b8', marginTop: 6, lineHeight: 1.6, fontWeight: 500 },
  body: { flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr', minHeight: 0 },
  rail: {
    borderRight: '1px solid rgba(255,255,255,0.05)',
    padding: '20px 16px',
    overflowY: 'auto',
    background: 'rgba(0,0,0,0.08)'
  },
  center: { padding: 24, overflowY: 'auto' },
  card: {
    background: 'rgba(16, 19, 28, 0.4)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
  },
  label: {
    display: 'block',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    marginBottom: 8
  },
  input: {
    width: '100%',
    background: 'rgba(9, 10, 15, 0.6)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    color: '#eef0f6',
    outline: 'none',
    boxSizing: 'border-box'
  },
  textarea: {
    width: '100%',
    minHeight: 120,
    resize: 'vertical',
    background: 'rgba(9, 10, 15, 0.6)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13,
    color: '#eef0f6',
    outline: 'none',
    boxSizing: 'border-box',
    lineHeight: 1.6
  },
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: 600,
    padding: '10px 14px',
    cursor: 'pointer'
  },
  primaryBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'linear-gradient(135deg, rgba(167,139,250,0.25) 0%, rgba(109,40,217,0.15) 100%)',
    border: '1px solid rgba(167,139,250,0.35)',
    borderRadius: 10,
    color: '#e9d5ff',
    fontSize: 13,
    fontWeight: 700,
    padding: '12px 16px',
    cursor: 'pointer'
  }
}

function ProviderButton({ provider, active, onClick }) {
  return (
    <button
      onClick={() => onClick(provider.id)}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        borderRadius: 12,
        border: active ? `1px solid ${provider.accent}55` : '1px solid rgba(255,255,255,0.06)',
        background: active ? `${provider.accent}18` : 'rgba(255,255,255,0.02)',
        cursor: 'pointer',
        marginBottom: 8
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, color: active ? provider.accent : '#e2e8f0' }}>
        {provider.label}
      </div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
        {provider.description}
      </div>
    </button>
  )
}

export default function SFXModule({ onChangeModule }) {
  const [provider, setProvider] = useState('elevenlabs')
  const [elevenLabsMode, setElevenLabsMode] = useState('sfx')
  const [prompt, setPrompt] = useState('')
  const [duration, setDuration] = useState(5)
  const [promptInfluence, setPromptInfluence] = useState(0.3)
  const [loop, setLoop] = useState(false)
  const [stableModel, setStableModel] = useState('small-sfx')
  const [voices, setVoices] = useState([])
  const [voiceId, setVoiceId] = useState('')
  const apiKey = useConfigKey(CONFIG_KEYS.ELEVEN_LABS_API_KEY)
  const [stableReady, setStableReady] = useState(null)
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [outputPath, setOutputPath] = useState(null)
  const [previewDataUrl, setPreviewDataUrl] = useState(null)

  const activeProvider = PROVIDERS[provider]

  useEffect(() => {
    const unsub = window.api.onSfxProgress?.((data) => {
      setProgress(data)
    })
    return () => unsub?.()
  }, [])

  const checkStableAudio = useCallback(async () => {
    setStableReady({ loading: true })
    const result = await window.api.sfxCheckStableAudio()
    setStableReady({
      loading: false,
      ok: Boolean(result?.success),
      message: result?.success ? result.message : result?.error
    })
  }, [])

  useEffect(() => {
    if (provider === 'stable-audio') {
      checkStableAudio()
    }
  }, [provider, checkStableAudio])

  const loadVoices = useCallback(async () => {
    if (!apiKey?.trim()) {
      setVoices([])
      return
    }
    setLoadingVoices(true)
    setError('')
    const result = await window.api.elevenLabsListVoices({ apiKey: apiKey.trim() })
    setLoadingVoices(false)
    if (!result?.success) {
      setError(result?.error || 'Failed to load voices.')
      setVoices([])
      return
    }
    const list = result.voices || []
    setVoices(list)
    if (!voiceId && list[0]?.id) {
      setVoiceId(list[0].id)
    }
  }, [apiKey, voiceId])

  useEffect(() => {
    if (provider === 'elevenlabs' && elevenLabsMode === 'speech' && apiKey?.trim()) {
      loadVoices()
    }
  }, [provider, elevenLabsMode, apiKey, loadVoices])

  const canGenerate = useMemo(() => {
    if (!prompt.trim() || generating) return false
    if (provider === 'elevenlabs') {
      if (!apiKey.trim()) return false
      if (elevenLabsMode === 'speech' && !voiceId) return false
      return true
    }
    return stableReady?.ok !== false
  }, [prompt, generating, provider, apiKey, elevenLabsMode, voiceId, stableReady])

  const generateLabel = useMemo(() => {
    if (provider === 'elevenlabs') {
      return elevenLabsMode === 'speech' ? 'Generate Speech' : 'Generate Sound Effect'
    }
    return 'Generate Locally'
  }, [provider, elevenLabsMode])

  async function handleGenerate() {
    if (!canGenerate) return
    setGenerating(true)
    setError('')
    setNotice('')
    setProgress({ step: 'StartingΓÇª', pct: 0 })
    setOutputPath(null)
    setPreviewDataUrl(null)

    try {
      let result
      if (provider === 'elevenlabs') {
        result = await window.api.sfxGenerateElevenLabs({
          apiKey: apiKey.trim(),
          mode: elevenLabsMode,
          text: prompt.trim(),
          voiceId,
          durationSeconds: duration,
          promptInfluence,
          loop
        })
      } else {
        result = await window.api.sfxGenerateStableAudio({
          prompt: prompt.trim(),
          duration,
          model: stableModel
        })
      }

      if (!result?.success) {
        setError(result?.error || 'Generation failed.')
        return
      }

      setOutputPath(result.outputPath)
      const dataRes = await window.api.readFileAsDataURL({ filePath: result.outputPath })
      if (dataRes?.success) {
        setPreviewDataUrl(dataRes.dataUrl)
      }
      setNotice('Audio generated successfully.')
    } catch (err) {
      setError(err.message || 'Generation failed.')
    } finally {
      setGenerating(false)
      setProgress(null)
    }
  }

  async function exportAudio() {
    if (!outputPath) return
    const ext = outputPath.toLowerCase().endsWith('.wav') ? 'wav' : 'mp3'
    const filePath = await window.api.saveFile({
      title: 'Export Audio',
      defaultPath: `roflow-sfx.${ext}`,
      filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
    })
    if (!filePath) return
    const result = await window.api.copyFile({ src: outputPath, dest: filePath })
    if (result?.success === false) {
      setError(result.error || 'Export failed.')
      return
    }
    setNotice('Audio exported.')
  }

  const needsApiKey = provider === 'elevenlabs' && !apiKey.trim()

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <h1 style={styles.title}>SFX Generator</h1>
        <p style={styles.subtitle}>
          Create Roblox-ready sound effects and voice lines from text. Use ElevenLabs in the cloud or
          Stable Audio 3 locally.
        </p>
      </header>

      <div style={styles.body}>
        <aside style={styles.rail}>
          <div style={{ marginBottom: 16 }}>
            <div style={styles.label}>Provider</div>
            {Object.values(PROVIDERS).map((item) => (
              <ProviderButton
                key={item.id}
                provider={item}
                active={provider === item.id}
                onClick={setProvider}
              />
            ))}
          </div>

          {provider === 'elevenlabs' && (
            <div style={{ ...styles.card, marginBottom: 12 }}>
              <div style={styles.label}>ElevenLabs Mode</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {ELEVENLABS_MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setElevenLabsMode(mode.id)}
                    style={{
                      ...styles.btn,
                      flex: 1,
                      justifyContent: 'center',
                      background:
                        elevenLabsMode === mode.id ? `${activeProvider.accent}22` : styles.btn.background,
                      borderColor:
                        elevenLabsMode === mode.id ? `${activeProvider.accent}55` : styles.btn.border
                    }}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {provider === 'stable-audio' && (
            <div style={{ ...styles.card, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={styles.label}>Local Setup</div>
                <button onClick={checkStableAudio} style={{ ...styles.btn, padding: '6px 10px' }}>
                  <RefreshCw size={14} />
                </button>
              </div>
              {stableReady?.loading ? (
                <div style={{ fontSize: 12, color: '#64748b' }}>Checking Stable Audio 3ΓÇª</div>
              ) : stableReady?.ok ? (
                <div style={{ fontSize: 12, color: '#4ade80', lineHeight: 1.6 }}>{stableReady.message}</div>
              ) : (
                <div style={{ fontSize: 11, color: '#fca5a5', lineHeight: 1.6 }}>
                  {stableReady?.message ||
                    'Install stable_audio_3 (see python/stable_audio_gen.py). First run downloads models from Hugging Face.'}
                </div>
              )}
            </div>
          )}

          {needsApiKey && (
            <div
              style={{
                ...styles.card,
                borderColor: 'rgba(248,113,113,0.25)',
                background: 'rgba(248,113,113,0.06)'
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <AlertCircle size={16} color="#fca5a5" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12, color: '#fca5a5', lineHeight: 1.6 }}>
                    Add your ElevenLabs API key in Settings to generate cloud audio.
                  </div>
                  <button
                    onClick={() => onChangeModule?.('settings')}
                    style={{ ...styles.btn, marginTop: 10, padding: '8px 12px' }}
                  >
                    <Settings size={14} />
                    Open Settings
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>

        <section style={styles.center}>
          <div style={{ ...styles.card, marginBottom: 16 }}>
            <label style={styles.label}>
              {provider === 'elevenlabs' && elevenLabsMode === 'speech' ? 'Script' : 'Prompt'}
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={
                provider === 'elevenlabs' && elevenLabsMode === 'speech'
                  ? 'Write the voice line to speakΓÇª'
                  : 'Describe the sound effect, e.g. "sharp metal sword clang with short reverb"'
              }
              style={styles.textarea}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={styles.card}>
              <label style={styles.label}>Duration (seconds)</label>
              <input
                type="number"
                min={0.5}
                max={provider === 'stable-audio' && stableModel.startsWith('small') ? 120 : 30}
                step={0.5}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 5)}
                style={styles.input}
              />
            </div>

            {provider === 'elevenlabs' && elevenLabsMode === 'sfx' && (
              <>
                <div style={styles.card}>
                  <label style={styles.label}>Prompt Influence</label>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={promptInfluence}
                    onChange={(e) => setPromptInfluence(Number(e.target.value) || 0.3)}
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.card, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    id="sfx-loop"
                    type="checkbox"
                    checked={loop}
                    onChange={(e) => setLoop(e.target.checked)}
                  />
                  <label htmlFor="sfx-loop" style={{ ...styles.label, marginBottom: 0 }}>
                    Seamless loop
                  </label>
                </div>
              </>
            )}

            {provider === 'elevenlabs' && elevenLabsMode === 'speech' && (
              <div style={styles.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={styles.label}>Voice</label>
                  <button
                    onClick={loadVoices}
                    disabled={loadingVoices || !apiKey.trim()}
                    style={{ ...styles.btn, padding: '4px 8px', fontSize: 10 }}
                  >
                    Refresh
                  </button>
                </div>
                <select
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  disabled={!voices.length}
                  style={styles.input}
                >
                  {!voices.length ? (
                    <option value="">No voices loaded</option>
                  ) : (
                    voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))
                  )}
                </select>
              </div>
            )}

            {provider === 'stable-audio' && (
              <div style={styles.card}>
                <label style={styles.label}>Model</label>
                <select
                  value={stableModel}
                  onChange={(e) => setStableModel(e.target.value)}
                  style={styles.input}
                >
                  {STABLE_AUDIO_MODELS.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                color: '#fca5a5',
                fontSize: 12,
                lineHeight: 1.6
              }}
            >
              {error}
            </div>
          )}

          {notice && (
            <div
              style={{
                marginBottom: 16,
                padding: '12px 14px',
                borderRadius: 12,
                background: 'rgba(74,222,128,0.08)',
                border: '1px solid rgba(74,222,128,0.2)',
                color: '#86efac',
                fontSize: 12
              }}
            >
              {notice}
            </div>
          )}

          {progress && (
            <div style={{ ...styles.card, marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#cbd5e1', marginBottom: 8 }}>{progress.step}</div>
              <div
                style={{
                  height: 6,
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, progress.pct || 0)}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #a78bfa, #6366f1)',
                    transition: 'width 0.2s ease'
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              style={{
                ...styles.primaryBtn,
                opacity: canGenerate ? 1 : 0.5,
                cursor: canGenerate ? 'pointer' : 'not-allowed'
              }}
            >
              <Sparkles size={16} />
              {generating ? 'GeneratingΓÇª' : generateLabel}
            </button>
            {outputPath && (
              <button onClick={exportAudio} style={styles.btn}>
                <Download size={16} />
                Export
              </button>
            )}
          </div>

          <div style={styles.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <Volume2 size={16} color="#94a3b8" />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>Preview</div>
            </div>
            {previewDataUrl ? (
              <audio controls src={previewDataUrl} style={{ width: '100%' }} />
            ) : (
              <div
                style={{
                  padding: '28px 16px',
                  textAlign: 'center',
                  borderRadius: 12,
                  border: '1px dashed rgba(255,255,255,0.08)',
                  color: '#64748b',
                  fontSize: 12
                }}
              >
                <Play size={20} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                Generated audio will appear here
              </div>
            )}
            {outputPath && (
              <div style={{ fontSize: 10, color: '#475569', marginTop: 10, wordBreak: 'break-all' }}>
                {outputPath}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

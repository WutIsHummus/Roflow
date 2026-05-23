/* eslint-disable react/prop-types */
import { useState } from 'react'

const S = {
  page: { height: '100%', overflowY: 'auto', padding: '24px 28px' },
  wrap: { maxWidth: 640 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#9499a8', marginBottom: 8 },
  textarea: {
    width: '100%',
    background: '#1a1d26',
    border: '1px solid #2e3340',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 14,
    color: '#eef0f6',
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    transition: 'border-color 0.15s'
  },
  hint: { fontSize: 11, color: '#555b6e', marginTop: 6 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  chip: {
    fontSize: 11,
    padding: '5px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    background: '#1a1d26',
    border: '1px solid #2e3340',
    color: '#9499a8',
    transition: 'all 0.12s'
  },
  row: { display: 'flex', gap: 16 },
  section: { flex: 1 },
  secLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#555b6e',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  },
  radioWrap: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    cursor: 'pointer',
    marginBottom: 8
  },
  radioName: { fontSize: 13, color: '#cdd0db', marginBottom: 2 },
  radioDesc: { fontSize: 11, color: '#555b6e' },
  select: {
    width: '100%',
    background: '#1a1d26',
    border: '1px solid #2e3340',
    borderRadius: 8,
    padding: '9px 12px',
    fontSize: 13,
    color: '#eef0f6',
    cursor: 'pointer',
    outline: 'none'
  },
  errBox: {
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#fca5a5'
  },
  btnPrimary: {
    width: '100%',
    padding: '11px 0',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 20px rgba(124,58,237,0.3)',
    transition: 'all 0.15s'
  },
  btnDisabled: {
    width: '100%',
    padding: '11px 0',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    background: '#1a1d26',
    color: '#3e4455',
    border: '1px solid #252a36',
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  resultCard: {
    background: '#1a1d26',
    border: '1px solid #2e3340',
    borderRadius: 12,
    padding: 20
  },
  successRow: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 },
  successIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    background: 'rgba(74,222,128,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  infoBox: {
    background: '#111318',
    borderRadius: 8,
    padding: '10px 14px',
    marginBottom: 14,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#6b7280',
    lineHeight: 1.8
  },
  btnGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  btnExport: {
    padding: '10px 0',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    border: 'none',
    background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  btnSecondary: {
    padding: '10px 0',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 13,
    background: '#1f2330',
    color: '#9499a8',
    border: '1px solid #2e3340',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transition: 'all 0.12s'
  },
  footNote: { fontSize: 11, color: '#3e4455', marginTop: 10 }
}

const MODELS = [
  {
    id: 'hymotion',
    label: '🔥 HY-Motion 1.0',
    desc: 'SOTA — Tencent 1B DiT model via HuggingFace Space.',
    badge: 'RECOMMENDED'
  },
  {
    id: 'hymotion-lite',
    label: '🔥 HY-Motion 1.0 Lite',
    desc: 'Smaller 460M model — faster generation, slightly lower quality.',
    badge: null
  },
  {
    id: 'hymotion-zerogpu',
    label: '🔥 HY-Motion 1.0 ZeroGPU',
    desc: 'Runs on Hugging Face Spaces ZeroGPU queue — slower, no dedicated GPU required.',
    badge: 'ZERO GPU'
  }
]

const DURATIONS = [2, 4, 6, 8]

const EXAMPLES = [
  'a person walks forward slowly',
  'a character jumps and lands',
  'someone waves their hand',
  'a fighter throws a punch',
  'a person runs and stops',
  'someone dances in place'
]

export default function TextToAnimation({ onProgress, onResult, onClear, result }) {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('hymotion')
  const [duration, setDuration] = useState(4)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [focusTA, setFocusTA] = useState(false)
  const isHyMotionModel = model === 'hymotion' || model === 'hymotion-lite' || model === 'hymotion-zerogpu'
  const hyMotionModelLabel =
    model === 'hymotion-lite'
      ? 'HY-Motion 1.0 Lite'
      : model === 'hymotion-zerogpu'
        ? 'HY-Motion 1.0 ZeroGPU'
        : 'HY-Motion 1.0'

  async function generate() {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    onClear()
    onResult(null)
    try {
      const res = await window.api.textToMotion({ prompt: prompt.trim(), model, duration })
      if (res.success) {
        onResult({ bvhPath: res.bvhPath, type: 'text', prompt })
        onProgress({ step: 'Done! Ready to export.', pct: 100 })
      } else {
        setError(res.error)
        onProgress(null)
      }
    } catch (e) {
      setError(e.message)
      onProgress(null)
    } finally {
      setLoading(false)
    }
  }

  async function exportFBX() {
    if (!result?.bvhPath) return
    const outputPath = await window.api.saveFile({
      title: 'Save Roblox FBX',
      defaultPath: 'roblox_animation',
      filters: [{ name: 'FBX', extensions: ['fbx'] }]
    })
    if (!outputPath) return
    const res = await window.api.exportFBX({ bvhPath: result.bvhPath, outputPath })
    if (res.success) window.api.openPath(res.outputPath)
    else setError(res.error || 'FBX export failed.')
  }

  async function exportBVH() {
    if (!result?.bvhPath) return
    const outputPath = await window.api.saveFile({
      title: 'Save BVH',
      defaultPath: 'motion',
      filters: [{ name: 'BVH', extensions: ['bvh'] }]
    })
    if (!outputPath) return
    const res = await window.api.exportBVH({ sourcePath: result.bvhPath, outputPath })
    if (res.success) window.api.openPath(outputPath)
    else setError(res.error || 'BVH export failed.')
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ marginBottom: 20 }}>
          <label style={S.label}>Describe the animation</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && generate()}
            onFocus={() => setFocusTA(true)}
            onBlur={() => setFocusTA(false)}
            placeholder="e.g. a person walks forward then turns around"
            rows={3}
            style={{
              ...S.textarea,
              borderColor: focusTA ? '#7c3aed' : '#2e3340',
              boxShadow: focusTA ? '0 0 0 3px rgba(124,58,237,0.15)' : 'none'
            }}
          />
          <p style={S.hint}>Ctrl+Enter to generate</p>
        </div>

        <div style={{ marginBottom: 20 }}>
          <p style={{ ...S.hint, marginBottom: 8 }}>Quick examples:</p>
          <div style={S.chipRow}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => setPrompt(ex)}
                style={S.chip}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#7c3aed'
                  e.currentTarget.style.color = '#c4b5fd'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#2e3340'
                  e.currentTarget.style.color = '#9499a8'
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...S.row, marginBottom: 20 }}>
          <div style={S.section}>
            <p style={S.secLabel}>AI Model</p>
            {MODELS.map((m) => (
              <label key={m.id} style={S.radioWrap}>
                <input
                  type="radio"
                  name="model"
                  value={m.id}
                  checked={model === m.id}
                  onChange={() => setModel(m.id)}
                  style={{ accentColor: '#a78bfa', marginTop: 2, flexShrink: 0 }}
                />
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <p
                      style={{
                        ...S.radioName,
                        color: model === m.id ? '#c4b5fd' : '#cdd0db',
                        margin: 0
                      }}
                    >
                      {m.label}
                    </p>
                    {m.badge && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          color: '#a78bfa',
                          background: 'rgba(124,58,237,0.15)',
                          border: '1px solid rgba(124,58,237,0.3)',
                          borderRadius: 4,
                          padding: '1px 5px',
                          letterSpacing: '0.06em'
                        }}
                      >
                        {m.badge}
                      </span>
                    )}
                  </div>
                  <p style={S.radioDesc}>{m.desc}</p>
                </div>
              </label>
            ))}
          </div>
          <div style={{ width: 160 }}>
            <p style={S.secLabel}>Duration</p>
            <select
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              style={S.select}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} seconds
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && <div style={{ ...S.errBox, marginBottom: 16 }}>{error}</div>}

        {isHyMotionModel ? (
          <div
            style={{
              background: 'rgba(124,58,237,0.06)',
              border: '1px solid rgba(124,58,237,0.2)',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 12,
              color: '#9499a8',
              lineHeight: 1.7
            }}
          >
            <strong style={{ color: '#c4b5fd' }}>🔥 {hyMotionModelLabel}</strong>{' '}
            text-to-motion
            <br />
            <span style={{ color: '#555b6e' }}>
              {model === 'hymotion-zerogpu'
                ? 'Tencent&apos;s motion model via Hugging Face Spaces ZeroGPU queue for Roblox-ready BVH export'
                : 'Tencent&apos;s motion model for Roblox-ready BVH export'}
            </span>
          </div>
        ) : null}

        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          style={loading || !prompt.trim() ? S.btnDisabled : S.btnPrimary}
        >
          {loading ? (
            <>
              <SpinIcon /> Generating…
            </>
          ) : (
            <>
              <PlayIcon /> Generate Animation
            </>
          )}
        </button>

        {result && (
          <div style={{ ...S.resultCard, marginTop: 20 }}>
            <div style={S.successRow}>
              <div style={S.successIcon}>
                <CheckIcon />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>
                  Animation Generated!
                </p>
                <p style={{ fontSize: 11, color: '#555b6e', marginTop: 2 }}>{result.prompt}</p>
              </div>
            </div>
            <div style={S.infoBox}>
              <p>🦴 BVH ready for Roblox R15 retargeting</p>
              <p>📦 Export FBX to import into Roblox Studio</p>
            </div>
            <div style={S.btnGrid}>
              <button style={S.btnExport} onClick={exportFBX}>
                <DownloadIcon /> Export FBX
              </button>
              <button
                style={S.btnSecondary}
                onClick={exportBVH}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#252a36'
                  e.currentTarget.style.color = '#eef0f6'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#1f2330'
                  e.currentTarget.style.color = '#9499a8'
                }}
              >
                <DownloadIcon /> Export BVH
              </button>
            </div>
            <p style={S.footNote}>FBX → Roblox Studio Animation Editor · BVH → Blender</p>
          </div>
        )}
      </div>
    </div>
  )
}

function SpinIcon() {
  return (
    <svg
      style={{ animation: 'spin 1s linear infinite', width: 16, height: 16 }}
      viewBox="0 0 24 24"
      fill="none"
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeOpacity="0.25" />
      <path
        fill="currentColor"
        fillOpacity="0.75"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M5 3l14 9-14 9V3z" />
    </svg>
  )
}
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

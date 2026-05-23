/* eslint-disable react/prop-types */
import { useState } from 'react'
import { Sparkles, Activity, FolderDown, AlertCircle, Play, CheckCircle2 } from 'lucide-react'

const S = {
  page: { height: '100%', overflowY: 'auto', padding: '24px 28px' },
  wrap: { maxWidth: 640 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 8 },
  textarea: {
    width: '100%',
    background: 'rgba(16, 19, 28, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: '12px 14px',
    fontSize: 14,
    color: '#eef0f6',
    resize: 'none',
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.5,
    backdropFilter: 'blur(10px)',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  hint: { fontSize: 11, fontWeight: 500, color: '#64748b', marginTop: 6 },
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    fontSize: 11,
    fontWeight: 600,
    padding: '6px 12px',
    borderRadius: 8,
    cursor: 'pointer',
    background: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    color: '#94a3b8',
    transition: 'all 0.15s'
  },
  row: { display: 'flex', gap: 16 },
  section: { flex: 1 },
  secLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: '#64748b',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  },
  radioWrap: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    cursor: 'pointer',
    marginBottom: 10,
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid transparent',
    transition: 'all 0.15s'
  },
  radioName: { fontSize: 13, color: '#f1f5f9', marginBottom: 2, fontWeight: 600 },
  radioDesc: { fontSize: 11, color: '#64748b', lineHeight: 1.4 },
  select: {
    width: '100%',
    background: 'rgba(16, 19, 28, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 13,
    color: '#eef0f6',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.15s'
  },
  errBox: {
    background: 'rgba(248,113,113,0.06)',
    border: '1px solid rgba(248,113,113,0.18)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13,
    color: '#fca5a5',
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  btnPrimary: {
    width: '100%',
    padding: '12px 20px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#0c0e17',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 16px rgba(255, 255, 255, 0.05)',
    transition: 'all 0.15s'
  },
  btnDisabled: {
    width: '100%',
    padding: '12px 20px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 14,
    background: 'rgba(255,255,255,0.02)',
    color: '#475569',
    border: '1px solid rgba(255,255,255,0.05)',
    cursor: 'not-allowed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  resultCard: {
    background: 'rgba(16, 19, 28, 0.4)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
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
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 14,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.8
  },
  btnGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  btnExport: {
    padding: '11px 18px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
    border: 'none',
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#0c0e17',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 16px rgba(255, 255, 255, 0.05)',
    transition: 'all 0.15s'
  },
  btnSecondary: {
    padding: '11px 18px',
    borderRadius: 10,
    fontWeight: 700,
    fontSize: 13,
    background: 'rgba(255,255,255,0.03)',
    color: '#94a3b8',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.15s'
  },
  footNote: { fontSize: 11, fontWeight: 500, color: '#475569', marginTop: 10 }
}

const MODELS = [
  {
    id: 'hymotion',
    label: 'HY-Motion 1.0',
    desc: 'SOTA — Tencent 1B DiT model via HuggingFace Space.',
    badge: 'RECOMMENDED'
  },
  {
    id: 'hymotion-lite',
    label: 'HY-Motion 1.0 Lite',
    desc: 'Smaller 460M model — faster generation, slightly lower quality.',
    badge: null
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

export default function TextToAnimation({
  textForm,
  activeJob,
  error,
  result,
  onTextFormChange,
  onPatchWorkflow,
  onClear
}) {
  const { prompt, model, duration } = textForm
  const loading = activeJob?.type === 'text' && activeJob?.status === 'running'
  const [focusTA, setFocusTA] = useState(false)

  async function generate() {
    if (!prompt.trim()) return
    onClear()
    onPatchWorkflow({
      activeJob: { type: 'text', status: 'running' },
      result: null,
      error: null,
      progress: null
    })
    try {
      const res = await window.api.textToMotion({ prompt: prompt.trim(), model, duration })
      if (res.success) {
        onPatchWorkflow({
          result: { bvhPath: res.bvhPath, type: 'text', prompt: prompt.trim() },
          activeJob: null,
          progress: { step: 'Done! Ready to export.', pct: 100 },
          error: null
        })
      } else {
        onPatchWorkflow({
          error: res.error,
          activeJob: null,
          progress: null
        })
      }
    } catch (e) {
      onPatchWorkflow({
        error: e.message,
        activeJob: null,
        progress: null
      })
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
    else onPatchWorkflow({ error: res.error || 'FBX export failed.' })
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
    else onPatchWorkflow({ error: res.error || 'BVH export failed.' })
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={{ marginBottom: 20 }}>
          <label style={S.label}>Describe the animation</label>
          <textarea
            value={prompt}
            onChange={(e) => onTextFormChange({ prompt: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && generate()}
            onFocus={() => setFocusTA(true)}
            onBlur={() => setFocusTA(false)}
            placeholder="e.g. a person walks forward then turns around"
            rows={3}
            style={{
              ...S.textarea,
              borderColor: focusTA ? '#a78bfa' : 'rgba(255,255,255,0.08)',
              boxShadow: focusTA ? '0 0 0 3px rgba(167,139,250,0.15)' : 'none'
            }}
          />
          <p style={S.hint}>Ctrl+Enter to generate</p>
        </div>

        <div style={{ marginBottom: 24 }}>
          <p style={{ ...S.hint, marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Quick examples</p>
          <div style={S.chipRow}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => onTextFormChange({ prompt: ex })}
                style={S.chip}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(167,139,250,0.1)'
                  e.currentTarget.style.borderColor = 'rgba(167,139,250,0.25)'
                  e.currentTarget.style.color = '#c4b5fd'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.02)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.color = '#94a3b8'
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div style={{ ...S.row, marginBottom: 24 }}>
          <div style={S.section}>
            <p style={S.secLabel}>AI Model</p>
            {MODELS.map((m) => {
              const active = model === m.id
              return (
                <label
                  key={m.id}
                  style={{
                    ...S.radioWrap,
                    background: active ? 'rgba(167,139,250,0.06)' : 'rgba(255,255,255,0.01)',
                    borderColor: active ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.04)'
                  }}
                  onMouseEnter={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!active) {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.01)'
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)'
                    }
                  }}
                >
                  <input
                    type="radio"
                    name="model"
                    value={m.id}
                    checked={active}
                    onChange={() => onTextFormChange({ model: m.id })}
                    style={{ accentColor: '#a78bfa', marginTop: 3, flexShrink: 0 }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {active && <Sparkles size={11} className="text-purple-400" />}
                      <p
                        style={{
                          ...S.radioName,
                          color: active ? '#c4b5fd' : '#e2e8f0',
                          margin: 0
                        }}
                      >
                        {m.label}
                      </p>
                      {m.badge && (
                        <span
                          style={{
                            fontSize: 8,
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
              )
            })}
          </div>
          <div style={{ width: 160 }}>
            <p style={S.secLabel}>Duration</p>
            <select
              value={duration}
              onChange={(e) => onTextFormChange({ duration: Number(e.target.value) })}
              style={S.select}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                e.currentTarget.style.background = 'rgba(16,19,28,0.5)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                e.currentTarget.style.background = 'rgba(16,19,28,0.4)'
              }}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d} seconds
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ ...S.errBox, marginBottom: 16 }}>
            <AlertCircle size={14} className="text-red-400" />
            <span>{error}</span>
          </div>
        )}

        {(model === 'hymotion' || model === 'hymotion-lite') && (
          <div
            style={{
              background: 'rgba(124,58,237,0.06)',
              border: '1px solid rgba(124,58,237,0.15)',
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 16,
              fontSize: 12,
              color: '#9499a8',
              lineHeight: 1.7,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <Sparkles size={14} className="text-purple-400 flex-shrink-0" />
            <div>
              <strong style={{ color: '#c4b5fd' }}>
                HY-Motion 1.0{model === 'hymotion-lite' ? ' Lite' : ''}
              </strong>{' '}
              text-to-motion engine ·{' '}
              <span style={{ color: '#64748b' }}>
                Tencent&apos;s motion model optimized for Roblox-ready BVH export
              </span>
            </div>
          </div>
        )}

        <button
          onClick={generate}
          disabled={loading || !prompt.trim()}
          style={loading || !prompt.trim() ? S.btnDisabled : S.btnPrimary}
          onMouseEnter={(e) => {
            if (!loading && prompt.trim()) {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,255,255,0.06)'
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && prompt.trim()) {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,255,255,0.05)'
            }
          }}
        >
          {loading ? (
            <>
              <SpinIcon /> Generating…
            </>
          ) : (
            <>
              <Play size={14} className="text-current fill-current" /> Generate Animation
            </>
          )}
        </button>

        {result && (
          <div style={{ ...S.resultCard, marginTop: 24 }}>
            <div style={S.successRow}>
              <div style={S.successIcon}>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>
                  Animation Generated!
                </p>
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{result.prompt}</p>
              </div>
            </div>
            <div style={S.infoBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                <Activity size={12} className="text-purple-400" />
                <span>BVH bone structure ready for Roblox R15 retargeting</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderDown size={12} className="text-purple-400" />
                <span>Export FBX format to import into Roblox Studio directly</span>
              </div>
            </div>
            <div style={S.btnGrid}>
              <button style={S.btnExport} onClick={exportFBX}>
                <FolderDown size={14} /> Export FBX
              </button>
              <button
                style={S.btnSecondary}
                onClick={exportBVH}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.06)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
                  e.currentTarget.style.color = '#f1f5f9'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)'
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.color = '#94a3b8'
                }}
              >
                <FolderDown size={14} /> Export BVH
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
      style={{ animation: 'spin 1s linear infinite', width: 14, height: 14 }}
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

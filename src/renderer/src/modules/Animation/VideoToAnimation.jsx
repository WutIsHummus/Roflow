/* eslint-disable react/prop-types */
import { useState } from 'react'

const S = {
  page: { height: '100%', overflowY: 'auto', padding: '24px 28px' },
  wrap: { maxWidth: 640 },
  infoCard: {
    background: 'rgba(124,58,237,0.08)',
    border: '1px solid rgba(124,58,237,0.2)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    gap: 12,
    marginBottom: 20
  },
  infoText: { fontSize: 13, color: '#9499a8', lineHeight: 1.6 },
  infoTitle: { fontSize: 13, fontWeight: 600, color: '#c4b5fd', marginBottom: 4 },
  infoNote: { fontSize: 11, color: '#555b6e', marginTop: 6 },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#9499a8', marginBottom: 8 },
  tipGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 },
  tipCard: {
    background: '#1a1d26',
    border: '1px solid #2e3340',
    borderRadius: 10,
    padding: '12px 8px',
    textAlign: 'center'
  },
  tipText: { fontSize: 11, color: '#555b6e', marginTop: 6 },
  errBox: {
    background: 'rgba(248,113,113,0.08)',
    border: '1px solid rgba(248,113,113,0.25)',
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 13,
    color: '#fca5a5',
    marginBottom: 16
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
    boxShadow: '0 4px 20px rgba(124,58,237,0.3)'
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
    padding: 20,
    marginTop: 20
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
    gap: 6
  },
  footNote: { fontSize: 11, color: '#3e4455', marginTop: 10 }
}

export default function VideoToAnimation({ onProgress, onResult, onClear, result }) {
  const [videoPath, setVideoPath] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [hover, setHover] = useState(false)

  async function pickVideo() {
    const p = await window.api.openVideo()
    if (p) setVideoPath(p)
  }

  async function extract() {
    if (!videoPath) return
    setLoading(true)
    setError(null)
    onClear()
    onResult(null)
    try {
      const res = await window.api.videoToMotion({ videoPath })
      if (res.success) {
        onResult({ bvhPath: res.bvhPath, type: 'video', videoPath })
        onProgress({ step: 'Pose extraction complete!', pct: 100 })
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

  const fileName = videoPath ? videoPath.split(/[\\/]/).pop() : null

  const dropStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 12,
    border: `2px dashed ${videoPath ? '#7c3aed' : hover ? '#4b5063' : '#2e3340'}`,
    padding: '40px 20px',
    cursor: 'pointer',
    marginBottom: 20,
    background: videoPath ? 'rgba(124,58,237,0.05)' : hover ? '#1a1d26' : 'transparent',
    transition: 'all 0.15s'
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.infoCard}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a78bfa"
            strokeWidth="1.8"
            width="18"
            height="18"
            style={{ flexShrink: 0, marginTop: 2 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div>
            <p style={S.infoTitle}>How it works</p>
            <p style={S.infoText}>
              Upload any video with a visible person. MediaPipe AI extracts the 3D skeleton
              frame-by-frame, then retargets it to Roblox R15 bones.
            </p>
            <p style={S.infoNote}>Requires Python · pip install mediapipe opencv-python numpy</p>
          </div>
        </div>

        <label style={S.label}>Source Video</label>
        <div
          style={dropStyle}
          onClick={pickVideo}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: videoPath ? 'rgba(124,58,237,0.15)' : '#1a1d26'
            }}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke={videoPath ? '#a78bfa' : '#555b6e'}
              strokeWidth="1.8"
              width="24"
              height="24"
            >
              <rect x="2" y="2" width="20" height="20" rx="2.18" />
              <path d="M10 8l6 4-6 4V8z" />
            </svg>
          </div>
          {videoPath ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#a78bfa' }}>{fileName}</p>
              <p style={{ fontSize: 11, color: '#555b6e', marginTop: 4 }}>Click to change file</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#9499a8' }}>Click to select video</p>
              <p style={{ fontSize: 11, color: '#555b6e', marginTop: 4 }}>
                MP4, MOV, AVI, MKV, WebM
              </p>
            </div>
          )}
        </div>

        <div style={S.tipGrid}>
          {[
            ['💡', 'Single person in frame'],
            ['📐', 'Full body visible'],
            ['🎥', 'Good lighting']
          ].map(([icon, tip]) => (
            <div key={tip} style={S.tipCard}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <p style={S.tipText}>{tip}</p>
            </div>
          ))}
        </div>

        {error && <div style={S.errBox}>{error}</div>}

        <button
          onClick={extract}
          disabled={loading || !videoPath}
          style={loading || !videoPath ? S.btnDisabled : S.btnPrimary}
        >
          {loading ? (
            <>
              <SpinIcon /> Extracting Pose…
            </>
          ) : (
            <>
              <SkeletonIcon /> Extract Skeleton
            </>
          )}
        </button>

        {result && (
          <div style={S.resultCard}>
            <div style={S.successRow}>
              <div style={S.successIcon}>
                <CheckIcon />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>
                  Skeleton Extracted!
                </p>
                <p style={{ fontSize: 11, color: '#555b6e', marginTop: 2 }}>{fileName}</p>
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
function SkeletonIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="7" r="4" />
      <path d="M12 11v10M9 14h6" />
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

/* eslint-disable react/prop-types */
import { useState } from 'react'
import {
  Lightbulb,
  Maximize2,
  Video,
  Activity,
  FolderDown,
  AlertCircle,
  Play,
  CheckCircle2,
  UploadCloud,
  FileVideo
} from 'lucide-react'

const S = {
  page: { height: '100%', overflowY: 'auto', padding: '24px 28px' },
  wrap: { maxWidth: 640 },
  infoCard: {
    background: 'rgba(124,58,237,0.06)',
    border: '1px solid rgba(124,58,237,0.15)',
    borderRadius: 12,
    padding: 16,
    display: 'flex',
    gap: 12,
    marginBottom: 20
  },
  infoText: { fontSize: 13, color: '#9499a8', lineHeight: 1.6 },
  infoTitle: { fontSize: 13, fontWeight: 700, color: '#c4b5fd', marginBottom: 4 },
  infoNote: { fontSize: 11, color: '#64748b', marginTop: 6, fontWeight: 500 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#94a3b8', marginBottom: 8 },
  tipGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 },
  tipCard: {
    background: 'rgba(16, 19, 28, 0.4)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 10,
    padding: '16px 12px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8
  },
  tipText: { fontSize: 11, fontWeight: 500, color: '#94a3b8' },
  errBox: {
    background: 'rgba(248,113,113,0.06)',
    border: '1px solid rgba(248,113,113,0.18)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13,
    color: '#fca5a5',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16
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
    background: 'rgba(0,0,0,0.15)',
    border: '1px solid rgba(255,255,255,0.04)',
    borderRadius: 8,
    padding: '12px 14px',
    marginBottom: 14,
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 1.8,
    display: 'flex',
    flexDirection: 'column',
    gap: 6
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

export default function VideoToAnimation({
  videoForm,
  activeJob,
  error,
  result,
  onVideoFormChange,
  onPatchWorkflow,
  onClear
}) {
  const { videoPath } = videoForm
  const loading = activeJob?.type === 'video' && activeJob?.status === 'running'
  const [hover, setHover] = useState(false)

  async function pickVideo() {
    const p = await window.api.openVideo()
    if (p) onVideoFormChange({ videoPath: p })
  }

  async function extract() {
    if (!videoPath) return
    onClear()
    onPatchWorkflow({
      activeJob: { type: 'video', status: 'running' },
      result: null,
      error: null,
      progress: null
    })
    try {
      const res = await window.api.videoToMotion({ videoPath })
      if (res.success) {
        onPatchWorkflow({
          result: { bvhPath: res.bvhPath, type: 'video', videoPath },
          activeJob: null,
          progress: { step: 'Pose extraction complete!', pct: 100 },
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

  const fileName = videoPath ? videoPath.split(/[\\/]/).pop() : null

  const dropStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderRadius: 14,
    border: `1px ${videoPath ? 'solid' : 'dashed'} ${
      videoPath ? 'rgba(167,139,250,0.4)' : hover ? 'rgba(167,139,250,0.25)' : 'rgba(255,255,255,0.08)'
    }`,
    padding: '40px 20px',
    cursor: 'pointer',
    marginBottom: 20,
    background: videoPath
      ? 'rgba(124,58,237,0.04)'
      : hover
        ? 'rgba(255,255,255,0.02)'
        : 'rgba(16,19,28,0.4)',
    backdropFilter: 'blur(20px)',
    transition: 'all 0.15s'
  }

  return (
    <div style={S.page}>
      <div style={S.wrap}>
        <div style={S.infoCard}>
          <AlertCircle size={16} className="text-purple-400 flex-shrink-0 mt-0.5" />
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
              background: videoPath ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.05)'
            }}
          >
            {videoPath ? (
              <FileVideo size={20} className="text-purple-400" />
            ) : (
              <UploadCloud size={20} className="text-slate-500" />
            )}
          </div>
          {videoPath ? (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#c4b5fd' }}>{fileName}</p>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Click to change file</p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#94a3b8' }}>Click to select video</p>
              <p style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                MP4, MOV, AVI, MKV, WebM
              </p>
            </div>
          )}
        </div>

        <div style={S.tipGrid}>
          {[
            { icon: <Activity size={18} className="text-purple-400" />, tip: 'Single person in frame' },
            { icon: <Maximize2 size={18} className="text-purple-400" />, tip: 'Full body visible' },
            { icon: <Video size={18} className="text-purple-400" />, tip: 'Good lighting' }
          ].map(({ icon, tip }) => (
            <div key={tip} style={S.tipCard}>
              <div style={{ display: 'flex', justifyContent: 'center' }}>{icon}</div>
              <p style={S.tipText}>{tip}</p>
            </div>
          ))}
        </div>

        {error && (
          <div style={S.errBox}>
            <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          onClick={extract}
          disabled={loading || !videoPath}
          style={loading || !videoPath ? S.btnDisabled : S.btnPrimary}
          onMouseEnter={(e) => {
            if (!loading && videoPath) {
              e.currentTarget.style.transform = 'translateY(-1px)'
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,255,255,0.06)'
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && videoPath) {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(255,255,255,0.05)'
            }
          }}
        >
          {loading ? (
            <>
              <SpinIcon /> Extracting Pose…
            </>
          ) : (
            <>
              <Play size={14} className="text-current fill-current" /> Extract Skeleton
            </>
          )}
        </button>

        {result && (
          <div style={S.resultCard}>
            <div style={S.successRow}>
              <div style={S.successIcon}>
                <CheckCircle2 size={16} className="text-emerald-400" />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#4ade80' }}>
                  Skeleton Extracted!
                </p>
                <p style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{fileName}</p>
              </div>
            </div>
            <div style={S.infoBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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

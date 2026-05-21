/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback } from 'react'
import TextToAnimation from './TextToAnimation'
import VideoToAnimation from './VideoToAnimation'
import AnimationPreview from './AnimationPreview'

const TABS = [
  { id: 'text', label: 'Text → Animation' },
  { id: 'video', label: 'Video → Animation' }
]

export default function AnimationModule({ workflowState, setWorkflowState, onChangeModule }) {
  const [tab, setTab] = useState('text')
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(() => workflowState?.animationResult || null)

  useEffect(() => {
    if (!window.api) return
    const unsub = window.api.onProgress((data) => setProgress(data))
    return () => unsub()
  }, [])

  useEffect(() => {
    if (!setWorkflowState) return
    setWorkflowState((prev) => ({ ...prev, animationResult: result }))
  }, [result, setWorkflowState])

  const clearProgress = useCallback(() => setProgress(null), [])

  const hasPreview = Boolean(result?.bvhPath)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '20px 28px 0', borderBottom: '1px solid #252a36', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 16
          }}
        >
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#eef0f6', margin: 0 }}>
              Animation Studio
            </h1>
            <p style={{ fontSize: 13, color: '#555b6e', marginTop: 4 }}>
              Generate Roblox R15 animations from text or video
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11,
              color: '#555b6e',
              paddingTop: 4
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#4ade80',
                display: 'inline-block'
              }}
            />
            HY-Motion + MediaPipe retargeting
            {result?.bvhPath && (
              <button
                onClick={() => onChangeModule?.('playground')}
                style={{
                  marginLeft: 10,
                  padding: '5px 10px',
                  borderRadius: 999,
                  border: '1px solid rgba(124,58,237,0.35)',
                  background: 'rgba(124,58,237,0.12)',
                  color: '#c4b5fd',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Open Playground
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: tab === t.id ? 600 : 500,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: tab === t.id ? '#c4b5fd' : '#6b7280',
                borderBottom: tab === t.id ? '2px solid #a78bfa' : '2px solid transparent',
                transition: 'all 0.15s',
                marginBottom: -1
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Progress bar */}
      {progress && (
        <div
          style={{
            flexShrink: 0,
            background: '#161921',
            borderBottom: '1px solid #252a36',
            padding: '10px 28px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, color: '#a78bfa' }}>{progress.step}</span>
            <span style={{ fontSize: 11, color: '#555b6e' }}>{progress.pct}%</span>
          </div>
          <div style={{ height: 3, background: '#252a36', borderRadius: 2, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                borderRadius: 2,
                width: `${progress.pct}%`,
                transition: 'width 0.3s'
              }}
            />
          </div>
        </div>
      )}

      {/* Split content: generator (left) + preview (right when result exists) */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: generation panel */}
        <div
          style={{
            flex: hasPreview ? '0 0 44%' : '1 1 auto',
            borderRight: hasPreview ? '1px solid #252a36' : 'none',
            overflow: 'hidden'
          }}
        >
          {tab === 'text' ? (
            <TextToAnimation
              onProgress={setProgress}
              onResult={setResult}
              onClear={clearProgress}
              result={result}
            />
          ) : (
            <VideoToAnimation
              onProgress={setProgress}
              onResult={setResult}
              onClear={clearProgress}
              result={result}
            />
          )}
        </div>

        {/* Right: animation preview (shown once result exists) */}
        {hasPreview && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <AnimationPreview bvhPath={result.bvhPath} />
          </div>
        )}
      </div>
    </div>
  )
}

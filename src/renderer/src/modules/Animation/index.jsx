/* eslint-disable react/prop-types */
import { useCallback } from 'react'
import TextToAnimation from './TextToAnimation'
import VideoToAnimation from './VideoToAnimation'
import AnimationPreview from './AnimationPreview'
import {
  normalizeAnimationWorkflow,
  mergeAnimationWorkflow
} from './animationWorkflow'

const TABS = [
  { id: 'text', label: 'Text → Animation' },
  { id: 'video', label: 'Video → Animation' }
]

export default function AnimationModule({ workflowState, setWorkflowState, onChangeModule }) {
  const workflow = normalizeAnimationWorkflow(workflowState)

  const patchWorkflow = useCallback(
    (patch) => {
      if (!setWorkflowState) return
      setWorkflowState((prev) => {
        const current = normalizeAnimationWorkflow(prev)
        const next = mergeAnimationWorkflow(current, patch)
        return {
          ...prev,
          animationWorkflow: next,
          animationResult: next.result ?? null
        }
      })
    },
    [setWorkflowState]
  )

  const clearProgress = useCallback(() => patchWorkflow({ progress: null }), [patchWorkflow])

  const hasPreview = Boolean(workflow.result?.bvhPath)
  const { tab, progress, result } = workflow

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'rgba(10, 11, 15, 0.25)', backdropFilter: 'blur(20px)' }}>
      {/* Header */}
      <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0, background: 'rgba(0,0,0,0.15)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 12
          }}
        >
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: '#f1f5f9', margin: 0, letterSpacing: '-0.02em' }}>
              Animation Studio
            </h1>
            <p style={{ fontSize: 12.5, color: '#94a3b8', marginTop: 6, fontWeight: 500 }}>
              Generate Roblox R15 animations from text or video
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11,
              fontWeight: 600,
              color: '#64748b',
              paddingTop: 4
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: workflow.activeJob ? '#fbbf24' : '#4ade80',
                boxShadow: workflow.activeJob ? '0 0 8px #fbbf24' : '0 0 8px #4ade80',
                display: 'inline-block'
              }}
            />
            {workflow.activeJob ? 'Generation in progress' : 'HY-Motion + MediaPipe retargeting'}
            {result?.bvhPath && (
              <button
                onClick={() => onChangeModule?.('playground')}
                style={{
                  marginLeft: 10,
                  padding: '5px 12px',
                  borderRadius: 999,
                  border: '1px solid rgba(167,139,250,0.3)',
                  background: 'rgba(167,139,250,0.15)',
                  color: '#c4b5fd',
                  fontSize: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(167,139,250,0.1)',
                  transition: 'all 0.15s'
                }}
              >
                Open Playground
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.02)', padding: 4, borderRadius: 10, width: 'fit-content', border: '1px solid rgba(255,255,255,0.05)' }}>
          {TABS.map((t) => {
            const isActive = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => patchWorkflow({ tab: t.id })}
                style={{
                  padding: '8px 16px',
                  fontSize: 12,
                  fontWeight: 700,
                  background: isActive ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                  border: isActive ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                  borderRadius: 7,
                  cursor: 'pointer',
                  color: isActive ? '#c4b5fd' : '#64748b',
                  boxShadow: isActive ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.15s'
                }}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Progress bar */}
      {progress && (
        <div
          style={{
            flexShrink: 0,
            background: 'rgba(0,0,0,0.15)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            padding: '12px 28px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#a78bfa' }}>{progress.step}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{progress.pct}%</span>
          </div>
          <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.02)' }}>
            <div
              style={{
                height: '100%',
                background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                borderRadius: 2,
                width: `${progress.pct}%`,
                boxShadow: '0 0 10px rgba(167,139,250,0.5)',
                transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
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
            borderRight: hasPreview ? '1px solid rgba(255,255,255,0.06)' : 'none',
            overflow: 'hidden'
          }}
        >
          {tab === 'text' ? (
            <TextToAnimation
              textForm={workflow.textForm}
              activeJob={workflow.activeJob}
              error={workflow.error}
              result={result}
              onTextFormChange={(textForm) => patchWorkflow({ textForm })}
              onPatchWorkflow={patchWorkflow}
              onClear={clearProgress}
            />
          ) : (
            <VideoToAnimation
              videoForm={workflow.videoForm}
              activeJob={workflow.activeJob}
              error={workflow.error}
              result={result}
              onVideoFormChange={(videoForm) => patchWorkflow({ videoForm })}
              onPatchWorkflow={patchWorkflow}
              onClear={clearProgress}
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

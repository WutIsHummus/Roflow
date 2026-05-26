/* eslint-disable react/prop-types */
import { useCallback, useEffect, useRef, useState } from 'react'
import { RotateCcw } from 'lucide-react'
import {
  MAX_SEQUENCE_KEYPOINTS,
  MIN_SEQUENCE_KEYPOINTS,
  clamp,
  colorSequenceGradientCss,
  interpolateColorAtTime,
  interpolateNumberAtTime,
  isValidHexColor,
  normalizeColorKeypoints,
  normalizeSizeKeypoints,
  normalizeTransparencyKeypoints,
  numberSequenceGradientCss,
  syncLegacyFieldsFromSequences
} from '../../../../shared/vfxSequenceUtils.js'

const SNAP_STEPS = [0, 0.25, 0.5, 0.75, 1]
const SNAP_THRESHOLD = 0.03

function snapTime(time) {
  const rounded = Number(clamp(time, 0, 1).toFixed(3))
  for (const step of SNAP_STEPS) {
    if (Math.abs(rounded - step) <= SNAP_THRESHOLD) return step
  }
  return rounded
}

function fieldForKind(kind) {
  if (kind === 'color') return 'colorKeypoints'
  if (kind === 'size') return 'sizeKeypoints'
  return 'transparencyKeypoints'
}

function defaultKeypointsForKind(kind, layer) {
  if (kind === 'color') return normalizeColorKeypoints(null, layer)
  if (kind === 'size') return normalizeSizeKeypoints(null, layer)
  return normalizeTransparencyKeypoints(null, layer)
}

export default function SequenceEditor({
  label,
  kind,
  layer,
  keypoints,
  onChange,
  valueMin = 0,
  valueMax = 1,
  valueStep = 0.05,
  valueLabel = 'Value',
  hint = null
}) {
  const trackRef = useRef(null)
  const dragRef = useRef(null)
  const colorInputRef = useRef(null)
  const pointerRef = useRef(null)
  const [draggingIndex, setDraggingIndex] = useState(null)
  const [activeColorIndex, setActiveColorIndex] = useState(null)

  const sorted = [...keypoints].sort((a, b) => a.time - b.time)
  const field = fieldForKind(kind)

  const setKeypoints = useCallback(
    (nextKeypoints) => {
      onChange(syncLegacyFieldsFromSequences({ ...layer, [field]: nextKeypoints }))
    },
    [field, layer, onChange]
  )

  const applyTimeAtIndex = useCallback(
    (index, rawTime) => {
      if (index === 0 || index === sorted.length - 1) return
      const prevTime = sorted[index - 1].time
      const nextTime = sorted[index + 1].time
      const time = snapTime(clamp(rawTime, prevTime + 0.01, nextTime - 0.01))
      const next = sorted.map((kp, i) => (i === index ? { ...kp, time } : kp))
      setKeypoints(next)
    },
    [setKeypoints, sorted]
  )

  const handleTimeChange = (index, time) => {
    applyTimeAtIndex(index, Number(time) || 0)
  }

  const handleValueChange = (index, rawValue) => {
    const next = sorted.map((kp, i) => {
      if (i !== index) return kp
      if (kind === 'color') {
        const color = isValidHexColor(rawValue) ? rawValue : kp.color
        return { ...kp, color }
      }
      return { ...kp, value: clamp(Number(rawValue) || valueMin, valueMin, valueMax) }
    })
    setKeypoints(next)
  }

  const handleRemove = (index) => {
    if (sorted.length <= MIN_SEQUENCE_KEYPOINTS) return
    if (index === 0 || index === sorted.length - 1) return
    setKeypoints(sorted.filter((_, i) => i !== index))
  }

  const handleAddAtTime = (time) => {
    if (sorted.length >= MAX_SEQUENCE_KEYPOINTS) return
    const t = snapTime(time)
    if (sorted.some((kp) => Math.abs(kp.time - t) < 0.02)) return

    let insertIndex = sorted.findIndex((kp) => kp.time > t)
    if (insertIndex === -1) insertIndex = sorted.length

    const newKp =
      kind === 'color'
        ? { time: t, color: interpolateColorAtTime(sorted, t) }
        : { time: t, value: interpolateNumberAtTime(sorted, t) }

    const next = [...sorted]
    next.splice(insertIndex, 0, newKp)
    setKeypoints(next)
  }

  const handleAdd = () => {
    if (sorted.length >= MAX_SEQUENCE_KEYPOINTS) return
    const gaps = []
    for (let i = 0; i < sorted.length - 1; i += 1) {
      gaps.push({ index: i, gap: sorted[i + 1].time - sorted[i].time })
    }
    gaps.sort((a, b) => b.gap - a.gap)
    const insertAfter = gaps[0]?.index ?? sorted.length - 2
    const a = sorted[insertAfter]
    const b = sorted[insertAfter + 1]
    handleAddAtTime((a.time + b.time) / 2)
  }

  const handleReset = () => {
    setActiveColorIndex(null)
    setKeypoints(defaultKeypointsForKind(kind, layer))
  }

  const openColorPicker = useCallback((index) => {
    setActiveColorIndex(index)
    requestAnimationFrame(() => {
      const input = colorInputRef.current
      if (!input) return
      input.value = sorted[index]?.color || '#ffffff'
      input.click()
    })
  }, [sorted])

  const timeFromClientX = useCallback((clientX) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    return snapTime((clientX - rect.left) / rect.width)
  }, [])

  useEffect(() => {
    const onMove = (event) => {
      const pointer = pointerRef.current
      if (!pointer) return

      const dx = event.clientX - pointer.x
      const dy = event.clientY - pointer.y
      if (Math.hypot(dx, dy) > 4) pointer.dragged = true

      if (pointer.dragged && pointer.index !== 0 && pointer.index !== sorted.length - 1) {
        applyTimeAtIndex(pointer.index, timeFromClientX(event.clientX))
      }
    }

    const onUp = () => {
      const pointer = pointerRef.current
      if (pointer && kind === 'color' && !pointer.dragged) {
        openColorPicker(pointer.index)
      }
      pointerRef.current = null
      dragRef.current = null
      setDraggingIndex(null)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [applyTimeAtIndex, kind, openColorPicker, sorted.length, timeFromClientX])

  const gradientStyle =
    kind === 'color'
      ? { background: colorSequenceGradientCss(sorted) }
      : {
          background: numberSequenceGradientCss(
            sorted,
            valueMin,
            valueMax,
            kind === 'transparency' ? '#64748b' : '#a78bfa'
          )
        }

  const accentColor = kind === 'color' ? '#f472b6' : kind === 'size' ? '#a78bfa' : '#64748b'

  return (
    <div
      style={{
        display: 'grid',
        gap: 10,
        padding: 12,
        borderRadius: 14,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.22)',
        position: 'relative'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.02em' }}>
            {label}
          </div>
          {hint && (
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 4, lineHeight: 1.45 }}>{hint}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            title="Reset to start/end defaults"
            onClick={handleReset}
            style={{
              background: 'rgba(255,255,255,0.03)',
              color: '#94a3b8',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8,
              padding: '5px 8px',
              fontSize: 10,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4
            }}
          >
            <RotateCcw size={11} /> Reset
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={sorted.length >= MAX_SEQUENCE_KEYPOINTS}
            style={{
              background: 'rgba(167,139,250,0.12)',
              color: '#c4b5fd',
              border: '1px solid rgba(167,139,250,0.25)',
              borderRadius: 8,
              padding: '5px 10px',
              fontSize: 10,
              fontWeight: 700,
              cursor: sorted.length >= MAX_SEQUENCE_KEYPOINTS ? 'not-allowed' : 'pointer',
              opacity: sorted.length >= MAX_SEQUENCE_KEYPOINTS ? 0.45 : 1
            }}
          >
            + Keypoint
          </button>
        </div>
      </div>

      {kind === 'color' && (
        <input
          ref={colorInputRef}
          type="color"
          tabIndex={-1}
          aria-hidden
          style={{
            position: 'absolute',
            width: 0,
            height: 0,
            opacity: 0,
            pointerEvents: 'none'
          }}
          onChange={(event) => {
            if (activeColorIndex == null) return
            handleValueChange(activeColorIndex, event.target.value)
          }}
        />
      )}

      <div style={{ position: 'relative', paddingTop: 4, paddingBottom: 2 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 9,
            color: '#475569',
            fontWeight: 600,
            marginBottom: 4,
            paddingLeft: 2,
            paddingRight: 2
          }}
        >
          <span>Start (0)</span>
          <span>Lifetime →</span>
          <span>End (1)</span>
        </div>
        <div
          ref={trackRef}
          role="presentation"
          onPointerDown={(event) => {
            if (event.target !== event.currentTarget) return
            handleAddAtTime(timeFromClientX(event.clientX))
          }}
          style={{
            height: 28,
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.1)',
            position: 'relative',
            cursor: 'crosshair',
            boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.35)',
            ...gradientStyle
          }}
        >
          {SNAP_STEPS.map((step) => (
            <div
              key={step}
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${step * 100}%`,
                width: 1,
                marginLeft: -0.5,
                background: 'rgba(255,255,255,0.08)',
                pointerEvents: 'none'
              }}
            />
          ))}
          {sorted.map((kp, index) => {
            const isEndpoint = index === 0 || index === sorted.length - 1
            const isDragging = draggingIndex === index
            const isSelected = kind === 'color' && activeColorIndex === index
            const valueRatio =
              kind === 'color'
                ? 1
                : clamp((kp.value - valueMin) / (valueMax - valueMin || 1), 0.05, 1)

            return (
              <button
                key={`${kind}-handle-${index}`}
                type="button"
                title={
                  kind === 'color'
                    ? `t=${kp.time} · ${kp.color} · click to pick color`
                    : `t=${kp.time} · ${Number(kp.value).toFixed(2)}`
                }
                onPointerDown={(event) => {
                  event.stopPropagation()
                  pointerRef.current = {
                    index,
                    x: event.clientX,
                    y: event.clientY,
                    dragged: false
                  }
                  dragRef.current = { index }
                  setDraggingIndex(index)
                  if (!isEndpoint) event.currentTarget.setPointerCapture(event.pointerId)
                }}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: `${kp.time * 100}%`,
                  transform: `translate(-50%, -50%) scale(${isDragging || isSelected ? 1.18 : 1})`,
                  width: kind === 'color' ? 14 : 10,
                  height: kind === 'color' ? 14 : 10 + valueRatio * 10,
                  borderRadius: kind === 'color' ? '50%' : 4,
                  border: `2px solid ${
                    isSelected || isDragging ? '#fff' : 'rgba(255,255,255,0.85)'
                  }`,
                  background: kind === 'color' ? kp.color : accentColor,
                  boxShadow: isSelected
                    ? `0 0 0 3px rgba(244,114,182,0.55), 0 2px 8px rgba(0,0,0,0.45)`
                    : `0 0 0 2px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.45)`,
                  cursor: kind === 'color' ? 'pointer' : isEndpoint ? 'default' : 'grab',
                  padding: 0,
                  zIndex: isDragging || isSelected ? 3 : 2,
                  opacity: isEndpoint ? 0.95 : 1,
                  transition: isDragging ? 'none' : 'transform 0.12s ease'
                }}
              />
            )
          })}
        </div>
        <div style={{ fontSize: 9, color: '#475569', marginTop: 5 }}>
          {kind === 'color'
            ? 'Click nodes to pick color · drag middle nodes to move · click track to add'
            : 'Drag middle handles · click track to add · snaps to 0, ¼, ½, ¾, 1'}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 6 }}>
        {sorted.map((kp, index) => {
          const isEndpoint = index === 0 || index === sorted.length - 1
          const isSelected = kind === 'color' && activeColorIndex === index
          return (
            <div
              key={`${kind}-row-${index}`}
              style={{
                display: 'grid',
                gridTemplateColumns: kind === 'color' ? '64px 1fr 36px 28px' : '64px 1fr 36px 28px',
                gap: 8,
                alignItems: 'end',
                padding: '8px 10px',
                borderRadius: 10,
                background: isSelected
                  ? 'rgba(244,114,182,0.08)'
                  : isEndpoint
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(255,255,255,0.04)',
                border: isSelected
                  ? '1px solid rgba(244,114,182,0.25)'
                  : '1px solid rgba(255,255,255,0.05)'
              }}
            >
              <div>
                <label style={labelStyle}>Time</label>
                <input
                  style={{
                    ...inputStyle,
                    opacity: isEndpoint ? 0.55 : 1,
                    cursor: isEndpoint ? 'not-allowed' : 'text'
                  }}
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={kp.time}
                  disabled={isEndpoint}
                  onChange={(event) => handleTimeChange(index, event.target.value)}
                />
              </div>
              {kind === 'color' ? (
                <>
                  <div>
                    <label style={labelStyle}>Hex</label>
                    <input
                      style={{ ...inputStyle, fontFamily: 'ui-monospace, monospace', fontSize: 11 }}
                      type="text"
                      value={kp.color}
                      spellCheck={false}
                      onFocus={() => setActiveColorIndex(index)}
                      onChange={(event) => handleValueChange(index, event.target.value)}
                      onBlur={(event) => {
                        if (!isValidHexColor(event.target.value)) {
                          handleValueChange(index, kp.color)
                        }
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    title="Click to pick color"
                    onClick={() => openColorPicker(index)}
                    style={{
                      height: 34,
                      borderRadius: 8,
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: kp.color,
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.25)',
                      cursor: 'pointer',
                      padding: 0
                    }}
                  />
                </>
              ) : (
                <div>
                  <label style={labelStyle}>{valueLabel}</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={valueMin}
                    max={valueMax}
                    step={valueStep}
                    value={Number(kp.value.toFixed(3))}
                    onChange={(event) => handleValueChange(index, event.target.value)}
                  />
                </div>
              )}
              <button
                type="button"
                style={{
                  ...iconButtonStyle,
                  opacity: isEndpoint || sorted.length <= MIN_SEQUENCE_KEYPOINTS ? 0.25 : 1
                }}
                onClick={() => handleRemove(index)}
                disabled={isEndpoint || sorted.length <= MIN_SEQUENCE_KEYPOINTS}
                title={isEndpoint ? 'End keypoints are fixed' : 'Remove keypoint'}
              >
                ×
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const labelStyle = {
  fontSize: 9,
  fontWeight: 700,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  marginBottom: 4,
  display: 'block'
}

const inputStyle = {
  width: '100%',
  background: 'rgba(16, 19, 28, 0.55)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 8,
  padding: '7px 8px',
  fontSize: 12,
  color: '#f8fafc',
  outline: 'none',
  boxSizing: 'border-box'
}

const iconButtonStyle = {
  background: 'rgba(255, 255, 255, 0.03)',
  color: '#e2e8f0',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  borderRadius: 8,
  padding: '6px 0',
  fontSize: 16,
  lineHeight: 1,
  cursor: 'pointer'
}

export const MIN_SEQUENCE_KEYPOINTS = 2
export const MAX_SEQUENCE_KEYPOINTS = 5

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export function isValidHexColor(color) {
  return /^#[0-9a-fA-F]{6}$/.test(color)
}

function sortKeypoints(keypoints) {
  return [...keypoints].sort((a, b) => a.time - b.time)
}

function normalizeTimeKeypoints(raw, minCount = MIN_SEQUENCE_KEYPOINTS) {
  if (!Array.isArray(raw) || raw.length < minCount) return null
  const sorted = sortKeypoints(
    raw.slice(0, MAX_SEQUENCE_KEYPOINTS).map((kp) => ({
      time: Number(Number(kp?.time ?? 0).toFixed(3)),
      ...kp
    }))
  )
  if (sorted.length < minCount) return null
  sorted[0].time = 0
  sorted[sorted.length - 1].time = 1
  return sorted
}

export function normalizeColorKeypoints(raw, fallback = {}) {
  const primary = isValidHexColor(fallback.color) ? fallback.color : '#a78bfa'
  const secondary = isValidHexColor(fallback.secondaryColor) ? fallback.secondaryColor : '#f8fafc'

  const fromArray = normalizeTimeKeypoints(
    Array.isArray(raw)
      ? raw.map((kp) => ({
          time: clamp(Number(kp?.time) || 0, 0, 1),
          color: isValidHexColor(kp?.color) ? kp.color : primary
        }))
      : null
  )
  if (fromArray) return fromArray

  return [
    { time: 0, color: primary },
    { time: 1, color: secondary }
  ]
}

export function normalizeSizeKeypoints(raw, fallback = {}) {
  const sizeMin = clamp(Number(fallback.sizeMin) || 0.35, 0.01, 6)
  const sizeMax = clamp(Number(fallback.sizeMax) || 1.3, 0.01, 6)

  const fromArray = normalizeTimeKeypoints(
    Array.isArray(raw)
      ? raw.map((kp) => ({
          time: clamp(Number(kp?.time) || 0, 0, 1),
          value: clamp(Number(kp?.value) || sizeMin, 0.01, 6)
        }))
      : null
  )
  if (fromArray) return fromArray

  return [
    { time: 0, value: Math.min(sizeMin, sizeMax) },
    { time: 1, value: Math.max(sizeMin, sizeMax) }
  ]
}

export function normalizeTransparencyKeypoints(raw, fallback = {}) {
  const startTransparency = clamp(1 - (Number(fallback.opacity) ?? 0.8), 0, 1)
  const endTransparency = clamp(Number(fallback.transparencyEnd) ?? 1, 0, 1)

  const fromArray = normalizeTimeKeypoints(
    Array.isArray(raw)
      ? raw.map((kp) => ({
          time: clamp(Number(kp?.time) || 0, 0, 1),
          value: clamp(Number(kp?.value) ?? 0, 0, 1)
        }))
      : null
  )
  if (fromArray) return fromArray

  return [
    { time: 0, value: startTransparency },
    { time: 1, value: endTransparency }
  ]
}

export function syncLegacyFieldsFromSequences(layer) {
  const colorKeypoints = normalizeColorKeypoints(layer.colorKeypoints, layer)
  const sizeKeypoints = normalizeSizeKeypoints(layer.sizeKeypoints, layer)
  const transparencyKeypoints = normalizeTransparencyKeypoints(layer.transparencyKeypoints, layer)

  const sizeValues = sizeKeypoints.map((kp) => kp.value)

  return {
    colorKeypoints,
    sizeKeypoints,
    transparencyKeypoints,
    color: colorKeypoints[0].color,
    secondaryColor: colorKeypoints[colorKeypoints.length - 1].color,
    sizeMin: Math.min(...sizeValues),
    sizeMax: Math.max(...sizeValues),
    opacity: clamp(1 - transparencyKeypoints[0].value, 0.05, 1),
    transparencyEnd: transparencyKeypoints[transparencyKeypoints.length - 1].value
  }
}

export function migrateLayerSequences(layer) {
  const synced = syncLegacyFieldsFromSequences(layer)
  return { ...layer, ...synced }
}

export function buildRobloxSequenceExport(keypoints) {
  return { keypoints: sortKeypoints(keypoints) }
}

export function interpolateNumberAtTime(keypoints, t) {
  const sorted = sortKeypoints(keypoints)
  const time = clamp(t, 0, 1)
  if (time <= sorted[0].time) return sorted[0].value
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].value

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time || 1
      const localT = (time - a.time) / span
      return a.value + (b.value - a.value) * localT
    }
  }
  return sorted[sorted.length - 1].value
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '')
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  }
}

function rgbToHex(r, g, b) {
  const toHex = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export function interpolateColorAtTime(keypoints, t) {
  const sorted = sortKeypoints(keypoints)
  const time = clamp(t, 0, 1)
  if (time <= sorted[0].time) return sorted[0].color
  if (time >= sorted[sorted.length - 1].time) return sorted[sorted.length - 1].color

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const a = sorted[i]
    const b = sorted[i + 1]
    if (time >= a.time && time <= b.time) {
      const span = b.time - a.time || 1
      const localT = (time - a.time) / span
      const ca = hexToRgb(a.color)
      const cb = hexToRgb(b.color)
      return rgbToHex(
        ca.r + (cb.r - ca.r) * localT,
        ca.g + (cb.g - ca.g) * localT,
        ca.b + (cb.b - ca.b) * localT
      )
    }
  }
  return sorted[sorted.length - 1].color
}

export function colorSequenceGradientCss(keypoints) {
  const sorted = sortKeypoints(keypoints)
  const stops = sorted.map((kp) => `${kp.color} ${(kp.time * 100).toFixed(1)}%`).join(', ')
  return `linear-gradient(to right, ${stops})`
}

export function numberSequenceGradientCss(keypoints, minValue, maxValue, color = '#64748b') {
  const sorted = sortKeypoints(keypoints)
  const range = maxValue - minValue || 1
  const stops = sorted
    .map((kp) => {
      const alpha = clamp(0.15 + ((kp.value - minValue) / range) * 0.85, 0.1, 1)
      return `rgba(100,116,139,${alpha.toFixed(2)}) ${(kp.time * 100).toFixed(1)}%`
    })
    .join(', ')
  return `linear-gradient(to right, ${stops})`
}

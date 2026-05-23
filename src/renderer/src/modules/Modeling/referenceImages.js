export const REFERENCE_IMAGE_SLOTS = ['front', 'back', 'left', 'right']

export const REFERENCE_IMAGE_LABELS = {
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right'
}

export function emptyReferenceImages() {
  return {
    front: null,
    back: null,
    left: null,
    right: null
  }
}

export function normalizeReferenceImages(part = {}) {
  const normalized = emptyReferenceImages()
  const refs = part.referenceImages || {}

  for (const slot of REFERENCE_IMAGE_SLOTS) {
    const entry = refs[slot]
    if (!entry) continue
    if (typeof entry === 'string') {
      normalized[slot] = { path: entry, preview: null }
    } else if (entry.path) {
      normalized[slot] = { path: entry.path, preview: entry.preview || null }
    }
  }

  if (!normalized.front?.path && part.imagePath) {
    normalized.front = { path: part.imagePath, preview: part.imagePreview || null }
  }

  return normalized
}

export function partHasReferenceImages(part = {}) {
  return REFERENCE_IMAGE_SLOTS.some((slot) => normalizeReferenceImages(part)[slot]?.path)
}

export function hydrateReferenceImages(part = {}) {
  const refs = emptyReferenceImages()
  const saved = part.referenceImages || {}

  for (const slot of REFERENCE_IMAGE_SLOTS) {
    const value = saved[slot]
    if (!value) continue
    refs[slot] = typeof value === 'string' ? { path: value, preview: null } : value
  }

  if (!refs.front?.path && part.imagePath) {
    refs.front = { path: part.imagePath, preview: part.imagePreview || null }
  }

  return refs
}

export function serializeReferenceImagePaths(part = {}) {
  const refs = normalizeReferenceImages(part)
  return {
    front: refs.front?.path || null,
    back: refs.back?.path || null,
    left: refs.left?.path || null,
    right: refs.right?.path || null
  }
}

export function countReferenceImages(part = {}) {
  return REFERENCE_IMAGE_SLOTS.filter((slot) => normalizeReferenceImages(part)[slot]?.path).length
}

export function isMultiviewReferenceInput(part = {}) {
  const refs = normalizeReferenceImages(part)
  return !!(refs.back?.path || refs.left?.path || refs.right?.path)
}

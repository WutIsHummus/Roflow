import { normName } from '../Modeling/r15Utils.js'

/** Roblox classic shirt/pants template canvas size. */
export const CLASSIC_TEMPLATE_SIZE = { width: 585, height: 559 }

const PART_NAMES = [
  'UpperTorso',
  'LowerTorso',
  'LeftUpperArm',
  'LeftLowerArm',
  'LeftHand',
  'RightUpperArm',
  'RightLowerArm',
  'RightHand',
  'LeftUpperLeg',
  'LeftLowerLeg',
  'LeftFoot',
  'RightUpperLeg',
  'RightLowerLeg',
  'RightFoot'
]

function stripMeshSuffix(name) {
  return String(name || '').replace(/\.\d+$/, '')
}

export function resolveClothingPartName(mesh) {
  const candidates = [mesh?.name, mesh?.parent?.name].filter(Boolean)
  for (const candidate of candidates) {
    const normalized = normName(stripMeshSuffix(candidate))
    for (const partName of PART_NAMES) {
      if (normName(partName) === normalized) return partName
    }
  }
  return null
}

/**
 * The bundled rig already has UVs that match its own baked atlas. The clothing
 * overlay reuses those UVs as-is — we repack the Roblox template into the rig
 * atlas layout at texture load time (see `buildRigAtlasFromClassicTemplate`).
 * This function just clones the source geometry so the overlay can own it.
 */
export function prepareClassicClothingGeometry(sourceGeometry /* , assetType, partName */) {
  return sourceGeometry.clone()
}

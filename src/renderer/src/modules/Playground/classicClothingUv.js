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

function pxRect(x, y, width, height) {
  const { width: templateW, height: templateH } = CLASSIC_TEMPLATE_SIZE
  return {
    u0: x / templateW,
    v0: y / templateH,
    u1: (x + width) / templateW,
    v1: (y + height) / templateH
  }
}

/** UV bounds baked into the bundled R15 rig (shirt layout for torso/arms). */
export const RIG_UV_BOUNDS = {
  UpperTorso: pxRect(1, 10, 245, 157),
  LowerTorso: pxRect(1, 167, 245, 94),
  LeftUpperArm: pxRect(249, 2, 163, 125),
  LeftLowerArm: pxRect(249, 128, 164, 83),
  LeftHand: pxRect(249, 215, 166, 63),
  RightUpperArm: pxRect(418, 2, 163, 125),
  RightLowerArm: pxRect(418, 128, 164, 83),
  RightHand: pxRect(418, 215, 166, 63),
  LeftUpperLeg: pxRect(249, 344, 163, 63),
  LeftLowerLeg: pxRect(249, 407, 163, 83),
  LeftFoot: pxRect(249, 494, 166, 63),
  RightUpperLeg: pxRect(418, 344, 163, 63),
  RightLowerLeg: pxRect(418, 407, 163, 83),
  RightFoot: pxRect(418, 494, 166, 63)
}

/**
 * Target regions on the Roblox classic pants template (585×559).
 * Leg crosses sit below the torso (y≈289+). Avatar right leg = template left column,
 * avatar left leg = template right column. Heights match RIG_UV_BOUNDS for 1:1 remap.
 */
export const PANTS_TEMPLATE_BOUNDS = {
  LowerTorso: pxRect(131, 66, 128, 180),
  LeftUpperLeg: pxRect(280, 344, 163, 63),
  LeftLowerLeg: pxRect(280, 407, 163, 83),
  LeftFoot: pxRect(280, 494, 163, 63),
  RightUpperLeg: pxRect(144, 344, 163, 63),
  RightLowerLeg: pxRect(144, 407, 163, 83),
  RightFoot: pxRect(144, 494, 163, 63)
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

export function remapClothingUvs(geometry, sourceBounds, targetBounds) {
  const uv = geometry?.attributes?.uv
  if (!uv || !sourceBounds || !targetBounds) return

  const sourceWidth = sourceBounds.u1 - sourceBounds.u0
  const sourceHeight = sourceBounds.v1 - sourceBounds.v0
  const targetWidth = targetBounds.u1 - targetBounds.u0
  const targetHeight = targetBounds.v1 - targetBounds.v0

  for (let index = 0; index < uv.count; index += 1) {
    const u = uv.getX(index)
    const v = uv.getY(index)
    const normalizedU = sourceWidth > 0 ? (u - sourceBounds.u0) / sourceWidth : 0
    const normalizedV = sourceHeight > 0 ? (v - sourceBounds.v0) / sourceHeight : 0
    uv.setXY(
      index,
      targetBounds.u0 + normalizedU * targetWidth,
      targetBounds.v0 + normalizedV * targetHeight
    )
  }

  uv.needsUpdate = true
}

/** Rig UVs use Roblox top-left convention (v = y / height); Three.js expects v = 0 at bottom. */
export function alignClassicClothingUvsForThreeJs(geometry) {
  const uv = geometry?.attributes?.uv
  if (!uv) return

  for (let index = 0; index < uv.count; index += 1) {
    uv.setY(index, 1 - uv.getY(index))
  }

  uv.needsUpdate = true
}

export function prepareClassicClothingGeometry(sourceGeometry, assetType, partName) {
  const geometry = sourceGeometry.clone()
  // Only remap when the PNG uses the dedicated pants template layout.
  // Shirt textures use the bundled rig UVs (shirt-template coordinates).
  if (assetType === 'pants') {
    const sourceBounds = RIG_UV_BOUNDS[partName]
    const targetBounds = PANTS_TEMPLATE_BOUNDS[partName]
    if (sourceBounds && targetBounds) {
      remapClothingUvs(geometry, sourceBounds, targetBounds)
    }
  }

  alignClassicClothingUvsForThreeJs(geometry)
  return geometry
}

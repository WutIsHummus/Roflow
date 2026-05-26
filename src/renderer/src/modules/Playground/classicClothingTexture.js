import * as THREE from 'three'

/**
 * Cell coordinates of the standard Roblox classic shirt/pants template (585x559).
 *
 * Roblox template anatomy (viewer's perspective of the flat image):
 *  - Torso cross:        upper area, row order R|FRONT|L|BACK
 *  - "RIGHT ARM" cross:  bottom-LEFT of image  → character's RIGHT arm/leg
 *  - "LEFT ARM"  cross:  bottom-RIGHT of image → character's LEFT  arm/leg
 *
 * Note: the template is mirrored relative to the character, so the cross
 * labeled "LEFT ARM" in the template is on the right side of the flat image.
 * Pants and shirt share the same grid; pants content lives in the arm cells.
 */
const ROBLOX_TEMPLATE_CELLS = {
  torso: {
    UP: { x: 231, y: 8, w: 128, h: 64 },
    R: { x: 165, y: 74, w: 64, h: 128 },
    F: { x: 231, y: 74, w: 128, h: 128 },
    L: { x: 361, y: 74, w: 64, h: 128 },
    B: { x: 427, y: 74, w: 128, h: 128 },
    DOWN: { x: 231, y: 204, w: 128, h: 64 }
  },
  // Bottom-RIGHT of template image → character's LEFT arm / LEFT leg
  leftLimb: {
    UP: { x: 308, y: 289, w: 64, h: 64 },
    F: { x: 308, y: 353, w: 64, h: 128 },
    L: { x: 374, y: 353, w: 64, h: 128 },
    B: { x: 440, y: 353, w: 64, h: 128 },
    R: { x: 506, y: 353, w: 64, h: 128 },
    DOWN: { x: 308, y: 485, w: 64, h: 64 }
  },
  // Bottom-LEFT of template image → character's RIGHT arm / RIGHT leg
  rightLimb: {
    UP: { x: 217, y: 289, w: 64, h: 64 },
    L: { x: 19, y: 353, w: 64, h: 128 },
    B: { x: 85, y: 353, w: 64, h: 128 },
    R: { x: 151, y: 353, w: 64, h: 128 },
    F: { x: 217, y: 353, w: 64, h: 128 },
    DOWN: { x: 217, y: 485, w: 64, h: 64 }
  }
}

/**
 * Cell coordinates in the bundled r15_rig.glb baked texture atlas (916x568).
 *
 * Torso face order  (left→right in row): F | L | B | R
 * Arm/leg face order (left→right in row): R | F | L | B
 * UP  is at the top-LEFT  of each arm/leg cross (above the R column).
 * DOWN is at the bottom-RIGHT of each arm/leg cross (below the B column).
 */
const RIG_ATLAS_SIZE = { width: 916, height: 568 }
const RIG_ATLAS_CELLS = {
  torso: {
    UP: { x: 2, y: 10, w: 128, h: 64 },
    F: { x: 2, y: 74, w: 128, h: 128 },
    L: { x: 130, y: 74, w: 64, h: 128 },
    B: { x: 194, y: 74, w: 128, h: 128 },
    R: { x: 322, y: 74, w: 64, h: 128 },
    DOWN: { x: 2, y: 202, w: 128, h: 64 }
  },
  leftArm: {
    UP: { x: 390, y: 2, w: 64, h: 64 },
    R: { x: 390, y: 66, w: 64, h: 128 },
    F: { x: 454, y: 66, w: 64, h: 128 },
    L: { x: 518, y: 66, w: 64, h: 128 },
    B: { x: 582, y: 66, w: 64, h: 128 },
    DOWN: { x: 582, y: 218, w: 64, h: 64 }
  },
  rightArm: {
    UP: { x: 654, y: 2, w: 64, h: 64 },
    R: { x: 654, y: 66, w: 64, h: 128 },
    F: { x: 718, y: 66, w: 64, h: 128 },
    L: { x: 782, y: 66, w: 64, h: 128 },
    B: { x: 846, y: 66, w: 64, h: 128 },
    DOWN: { x: 846, y: 218, w: 64, h: 64 }
  },
  leftLeg: {
    UP: { x: 390, y: 340, w: 64, h: 64 },
    R: { x: 390, y: 404, w: 64, h: 128 },
    F: { x: 454, y: 404, w: 64, h: 128 },
    L: { x: 518, y: 404, w: 64, h: 128 },
    B: { x: 582, y: 404, w: 64, h: 128 },
    DOWN: { x: 582, y: 532, w: 64, h: 64 }
  },
  rightLeg: {
    UP: { x: 654, y: 340, w: 64, h: 64 },
    R: { x: 654, y: 404, w: 64, h: 128 },
    F: { x: 718, y: 404, w: 64, h: 128 },
    L: { x: 782, y: 404, w: 64, h: 128 },
    B: { x: 846, y: 404, w: 64, h: 128 },
    DOWN: { x: 846, y: 532, w: 64, h: 64 }
  }
}

const FACE_ORDER = ['UP', 'DOWN', 'F', 'B', 'L', 'R']

function drawCross(ctx, image, srcCross, dstCross) {
  if (!srcCross || !dstCross) return
  for (const face of FACE_ORDER) {
    const src = srcCross[face]
    const dst = dstCross[face]
    if (!src || !dst) continue
    ctx.drawImage(image, src.x, src.y, src.w, src.h, dst.x, dst.y, dst.w, dst.h)
  }
}

/**
 * Repack a Roblox classic shirt/pants template (585x559) into the rig's
 * baked-atlas layout (916x568). The returned canvas can be used directly as a
 * CanvasTexture so the rig's original UVs render the right faces in the right
 * cells with no UV manipulation.
 */
export function buildRigAtlasFromClassicTemplate(image, assetType) {
  if (typeof document === 'undefined') return null
  const canvas = document.createElement('canvas')
  canvas.width = RIG_ATLAS_SIZE.width
  canvas.height = RIG_ATLAS_SIZE.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Transparent background so the rig's own baked skin shows through anywhere
  // the template did not cover.
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  if (assetType === 'pants') {
    drawCross(ctx, image, ROBLOX_TEMPLATE_CELLS.torso, RIG_ATLAS_CELLS.torso)
    // Template bottom-RIGHT cross ("LEFT ARM" = character's left leg) → rig left leg
    drawCross(ctx, image, ROBLOX_TEMPLATE_CELLS.leftLimb, RIG_ATLAS_CELLS.leftLeg)
    // Template bottom-LEFT cross ("RIGHT ARM" = character's right leg) → rig right leg
    drawCross(ctx, image, ROBLOX_TEMPLATE_CELLS.rightLimb, RIG_ATLAS_CELLS.rightLeg)
  } else {
    drawCross(ctx, image, ROBLOX_TEMPLATE_CELLS.torso, RIG_ATLAS_CELLS.torso)
    // Template bottom-RIGHT cross ("LEFT ARM" = character's left arm) → rig left arm
    drawCross(ctx, image, ROBLOX_TEMPLATE_CELLS.leftLimb, RIG_ATLAS_CELLS.leftArm)
    // Template bottom-LEFT cross ("RIGHT ARM" = character's right arm) → rig right arm
    drawCross(ctx, image, ROBLOX_TEMPLATE_CELLS.rightLimb, RIG_ATLAS_CELLS.rightArm)
  }

  return canvas
}

/**
 * Loads a Roblox template from a URL/data URL, repacks it into the rig's
 * atlas layout, and returns a configured CanvasTexture ready to drop on the
 * clothing overlay material.
 */
export function loadClassicClothingTexture(source, assetType) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = buildRigAtlasFromClassicTemplate(image, assetType)
      if (!canvas) {
        reject(new Error('Failed to build clothing atlas canvas'))
        return
      }
      const texture = new THREE.CanvasTexture(canvas)
      configureClassicClothingTexture(texture)
      resolve(texture)
    }
    image.onerror = () => reject(new Error('Failed to load clothing template image'))
    image.src = source
  })
}

/**
 * The rig's baked texture uses the GLTF top-left UV origin, so we keep the
 * CanvasTexture in that same orientation (flipY = false) instead of the
 * Three.js default.
 */
export function configureClassicClothingTexture(texture) {
  texture.colorSpace = THREE.SRGBColorSpace
  texture.flipY = false
  texture.wrapS = THREE.ClampToEdgeWrapping
  texture.wrapT = THREE.ClampToEdgeWrapping
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

export function createClassicClothingMaterial(texture) {
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.05,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  })
}

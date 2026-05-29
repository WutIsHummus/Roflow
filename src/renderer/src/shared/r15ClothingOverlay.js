import * as THREE from 'three'
import { normName } from '../modules/Modeling/r15Utils.js'
import { createClassicClothingMaterial } from '../modules/Playground/classicClothingTexture.js'
import { prepareClassicClothingGeometry, resolveClothingPartName } from '../modules/Playground/classicClothingUv.js'

export const R15_RIG_URL = `${import.meta.env.BASE_URL}r15_rig.glb`

export function configureRigMaterials(rigScene) {
  rigScene.traverse((obj) => {
    if (!obj.isMesh) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    mats.forEach((mat) => {
      mat.transparent = false
      mat.depthWrite = true
      mat.alphaTest = 0
      mat.side = THREE.FrontSide
      mat.needsUpdate = true
    })
    obj.castShadow = true
    obj.receiveShadow = true
  })
}

export function findPrimarySkinnedMesh(rigScene) {
  let skinnedMesh = null
  rigScene.traverse((obj) => {
    if (!skinnedMesh && obj.isSkinnedMesh && obj.skeleton) skinnedMesh = obj
  })
  return skinnedMesh
}

export function applyClothingTextureToRig(state, texture, assetType, renderOrderOffset = 1) {
  if (!state?.rigScene || !texture) return []

  const overlays = []
  state.rigScene.traverse((obj) => {
    if (!isClothingBodyMesh(obj) || !isClothingTargetMesh(obj, assetType)) return

    const partName = resolveClothingPartName(obj)
    const geometry = prepareClassicClothingGeometry(obj.geometry, assetType, partName)
    const material = createClassicClothingMaterial(texture)

    const isSkinned = obj.isSkinnedMesh && obj.skeleton
    const overlay = isSkinned ? new THREE.SkinnedMesh(geometry, material) : new THREE.Mesh(geometry, material)
    overlay.name = `__clothing_overlay_${assetType || 'shirt'}_${obj.name}`
    overlay.renderOrder = (obj.renderOrder || 0) + renderOrderOffset
    overlay.castShadow = false
    overlay.receiveShadow = false
    overlay.frustumCulled = false
    overlay.position.copy(obj.position)
    overlay.quaternion.copy(obj.quaternion)
    overlay.scale.copy(obj.scale)
    obj.parent?.add(overlay)

    if (isSkinned) {
      overlay.bind(obj.skeleton, obj.bindMatrix)
    }

    overlays.push({ mesh: overlay, material, geometry, texture })
  })

  return overlays
}

export function clearClothingOverlays(state) {
  if (!state?.clothingOverlays?.length) {
    if (state) state.clothingOverlays = []
    return
  }

  const disposedTextures = new Set()
  for (const overlay of state.clothingOverlays) {
    overlay.mesh.parent?.remove(overlay.mesh)
    overlay.material?.dispose()
    overlay.geometry?.dispose()
    if (overlay.texture && !disposedTextures.has(overlay.texture)) {
      overlay.texture.dispose()
      disposedTextures.add(overlay.texture)
    }
  }
  state.clothingOverlays = []
}

function isClothingBodyMesh(obj) {
  return Boolean(obj?.isMesh && !obj.name.startsWith('__clothing_overlay_'))
}

function isClothingTargetMesh(object, assetType) {
  const names = [object?.name, object?.parent?.name].filter(Boolean)
  return names.some((name) => isClothingTargetName(name, assetType))
}

function isClothingTargetName(name, assetType) {
  const normalized = normName(name)
  if (!normalized) return false

  const isLowerTorso = normalized.includes('lowertorso')
  const isTorso = normalized.includes('torso')
  const isArm = normalized.includes('arm')
  const isHand = normalized.includes('hand')
  const isLeg = normalized.includes('leg') || normalized.includes('foot')

  const mode = assetType || 'shirt'

  if (mode === 'pants') {
    return isLowerTorso || isLeg
  }

  return isTorso || isArm || isHand
}

export function focusRigPreview(state, padding = 1.35) {
  if (!state?.camera || !state?.orbit || !state?.rigScene) return

  const bounds = new THREE.Box3()
  bounds.expandByObject(state.rigScene)
  if (bounds.isEmpty()) return

  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1.2)
  state.orbit.target.copy(center)
  state.camera.position.set(center.x, center.y + maxDim * 0.15, center.z + maxDim * padding + 0.8)
  state.camera.lookAt(center)
}

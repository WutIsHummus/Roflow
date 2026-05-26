import * as THREE from 'three'

const MAT_GREY = new THREE.Color(0xc9c9c9)

const PANELS = {
  shirt: {
    torsoFront: { x: 400, y: 138, w: 226, h: 233 },
    torsoBack: { x: 759, y: 138, w: 231, h: 233 },
    torsoRight: { x: 281, y: 138, w: 113, h: 233 },
    torsoLeft: { x: 638, y: 138, w: 113, h: 233 },
    torsoTop: { x: 400, y: 18, w: 226, h: 114 },
    torsoBottom: { x: 400, y: 379, w: 226, h: 108 },
    rightArmFront: { x: 87, y: 448, w: 70, h: 150 },
    rightArmBack: { x: 187, y: 448, w: 70, h: 150 },
    leftArmFront: { x: 763, y: 518, w: 70, h: 88 },
    leftArmBack: { x: 862, y: 518, w: 72, h: 88 }
  },
  pants: {
    rightLegRight: { x: 12, y: 653, w: 114, h: 230 },
    rightLegFront: { x: 132, y: 653, w: 114, h: 230 },
    rightLegLeft: { x: 252, y: 653, w: 114, h: 230 },
    rightLegBack: { x: 374, y: 653, w: 114, h: 230 },
    rightLegBottom: { x: 374, y: 892, w: 114, h: 96 },
    leftLegRight: { x: 540, y: 653, w: 114, h: 230 },
    leftLegFront: { x: 660, y: 653, w: 114, h: 230 },
    leftLegLeft: { x: 780, y: 653, w: 114, h: 230 },
    leftLegBack: { x: 900, y: 653, w: 114, h: 230 },
    leftLegBottom: { x: 540, y: 892, w: 114, h: 96 }
  }
}

function cropTexture(texture, panel) {
  if (!texture || !panel) return null
  const width = texture.image?.naturalWidth || texture.image?.width || 1024
  const height = texture.image?.naturalHeight || texture.image?.height || 1024
  const scaleX = width / 1024
  const scaleY = height / 1024
  const insetX = Math.min(4 * scaleX, panel.w * scaleX * 0.12)
  const insetY = Math.min(4 * scaleY, panel.h * scaleY * 0.12)
  const x = panel.x * scaleX + insetX
  const y = panel.y * scaleY + insetY
  const w = panel.w * scaleX - insetX * 2
  const h = panel.h * scaleY - insetY * 2

  const map = texture.clone()
  map.colorSpace = THREE.SRGBColorSpace
  map.flipY = false
  map.wrapS = THREE.ClampToEdgeWrapping
  map.wrapT = THREE.ClampToEdgeWrapping
  map.generateMipmaps = false
  map.minFilter = THREE.LinearFilter
  map.magFilter = THREE.LinearFilter
  map.repeat.set(w / width, h / height)
  map.offset.set(x / width, 1 - (y + h) / height)
  map.needsUpdate = true
  return map
}

function makeMaterial(texture, panel, color = MAT_GREY) {
  const map = cropTexture(texture, panel)
  return {
    material: new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : color,
      map,
      roughness: 0.78,
      metalness: 0.02
    }),
    map
  }
}

function createBoxPart({ name, size, position, facePanels, texture, fallbackColor }) {
  const resources = []
  const materials = ['right', 'left', 'top', 'bottom', 'front', 'back'].map((face) => {
    const resource = makeMaterial(texture, facePanels?.[face], fallbackColor)
    resources.push(resource)
    return resource.material
  })

  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), materials)
  mesh.name = name
  mesh.position.set(...position)
  mesh.castShadow = true
  mesh.receiveShadow = true
  return { mesh, resources }
}

function addPart(group, options, resources) {
  const part = createBoxPart(options)
  group.add(part.mesh)
  resources.push(...part.resources, { geometry: part.mesh.geometry })
}

export function createClassicClothingAvatar({ shirtTexture, pantsTexture }) {
  const group = new THREE.Group()
  group.name = 'classic-clothing-avatar'
  const resources = []

  addPart(
    group,
    {
      name: 'Head',
      size: [0.95, 0.95, 0.95],
      position: [0, 3.05, 0],
      fallbackColor: MAT_GREY
    },
    resources
  )

  addPart(
    group,
    {
      name: 'Torso',
      size: [1.8, 1.55, 0.72],
      position: [0, 1.95, 0],
      texture: shirtTexture,
      fallbackColor: MAT_GREY,
      facePanels: {
        front: PANELS.shirt.torsoFront,
        back: PANELS.shirt.torsoBack,
        right: PANELS.shirt.torsoRight,
        left: PANELS.shirt.torsoLeft,
        top: PANELS.shirt.torsoTop,
        bottom: PANELS.shirt.torsoBottom
      }
    },
    resources
  )

  addPart(
    group,
    {
      name: 'RightArm',
      size: [0.72, 1.55, 0.72],
      position: [-1.28, 1.95, 0],
      texture: shirtTexture,
      fallbackColor: MAT_GREY,
      facePanels: {
        front: PANELS.shirt.rightArmFront,
        back: PANELS.shirt.rightArmBack,
        left: PANELS.shirt.rightArmFront,
        right: PANELS.shirt.rightArmBack
      }
    },
    resources
  )

  addPart(
    group,
    {
      name: 'LeftArm',
      size: [0.72, 1.55, 0.72],
      position: [1.28, 1.95, 0],
      texture: shirtTexture,
      fallbackColor: MAT_GREY,
      facePanels: {
        front: PANELS.shirt.leftArmFront,
        back: PANELS.shirt.leftArmBack,
        left: PANELS.shirt.leftArmBack,
        right: PANELS.shirt.leftArmFront
      }
    },
    resources
  )

  addPart(
    group,
    {
      name: 'RightLeg',
      size: [0.82, 1.45, 0.72],
      position: [-0.43, 0.45, 0],
      texture: pantsTexture,
      fallbackColor: MAT_GREY,
      facePanels: {
        front: PANELS.pants.rightLegFront,
        back: PANELS.pants.rightLegBack,
        right: PANELS.pants.rightLegRight,
        left: PANELS.pants.rightLegLeft,
        bottom: PANELS.pants.rightLegBottom
      }
    },
    resources
  )

  addPart(
    group,
    {
      name: 'LeftLeg',
      size: [0.82, 1.45, 0.72],
      position: [0.43, 0.45, 0],
      texture: pantsTexture,
      fallbackColor: MAT_GREY,
      facePanels: {
        front: PANELS.pants.leftLegFront,
        back: PANELS.pants.leftLegBack,
        right: PANELS.pants.leftLegRight,
        left: PANELS.pants.leftLegLeft,
        bottom: PANELS.pants.leftLegBottom
      }
    },
    resources
  )

  group.userData.resources = resources
  return group
}

export function clearClassicClothingAvatar(group) {
  if (!group) return
  group.parent?.remove(group)
  for (const resource of group.userData.resources || []) {
    resource.material?.dispose()
    resource.map?.dispose()
    resource.geometry?.dispose()
  }
}

export function createPlaceholderAvatar() {
  return createClassicClothingAvatar({})
}

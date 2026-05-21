import * as THREE from 'three'

export const ROBLOX_ATTACH = {
  HatAttachment: {
    bonePat: ['head'],
    worldFrac: [0, 0.97, 0],
    anchor: 'bottom',
    label: 'Hat / Helmet'
  },
  HairAttachment: {
    bonePat: ['head'],
    worldFrac: [0, 0.97, -0.06],
    anchor: 'bottom',
    label: 'Hair'
  },
  FaceCenterAttachment: {
    bonePat: ['head'],
    worldFrac: [0, 0.875, 0.12],
    anchor: 'center',
    label: 'Mask / Face accessory'
  },
  FaceFrontAttachment: {
    bonePat: ['head'],
    worldFrac: [0, 0.84, 0.14],
    anchor: 'center',
    label: 'Glasses / Front face'
  },
  NeckAttachment: {
    bonePat: ['uppertorso', 'torso'],
    worldFrac: [0, 0.82, 0],
    anchor: 'bottom',
    label: 'Neck / Collar'
  },
  BodyFrontAttachment: {
    bonePat: ['uppertorso', 'torso'],
    worldFrac: [0, 0.62, 0.1],
    anchor: 'center',
    label: 'Chest front'
  },
  BodyBackAttachment: {
    bonePat: ['uppertorso', 'torso'],
    worldFrac: [0, 0.62, -0.1],
    anchor: 'center',
    label: 'Back (backpack, wings)'
  },
  LeftCollarAttachment: {
    bonePat: ['uppertorso', 'torso'],
    worldFrac: [-0.18, 0.72, 0],
    anchor: 'center',
    label: 'Left collar'
  },
  RightCollarAttachment: {
    bonePat: ['uppertorso', 'torso'],
    worldFrac: [0.18, 0.72, 0],
    anchor: 'center',
    label: 'Right collar'
  },
  WaistCenterAttachment: {
    bonePat: ['lowertorso', 'lower'],
    worldFrac: [0, 0.38, 0],
    anchor: 'center',
    label: 'Waist center (belt)'
  },
  WaistFrontAttachment: {
    bonePat: ['lowertorso', 'lower'],
    worldFrac: [0, 0.38, 0.1],
    anchor: 'center',
    label: 'Waist front'
  },
  WaistBackAttachment: {
    bonePat: ['lowertorso', 'lower'],
    worldFrac: [0, 0.38, -0.1],
    anchor: 'center',
    label: 'Waist back'
  },
  LeftShoulderAttachment: {
    bonePat: ['leftupperarm', 'leftshoulder', 'leftarm'],
    worldFrac: [-0.24, 0.73, 0],
    anchor: 'center',
    label: 'Left shoulder'
  },
  RightShoulderAttachment: {
    bonePat: ['rightupperarm', 'rightshoulder', 'rightarm'],
    worldFrac: [0.24, 0.73, 0],
    anchor: 'center',
    label: 'Right shoulder'
  },
  LeftGripAttachment: {
    bonePat: ['lefthand'],
    worldFrac: [-0.26, 0.3, 0],
    anchor: 'center',
    label: 'Left grip (tool/weapon)'
  },
  RightGripAttachment: {
    bonePat: ['righthand'],
    worldFrac: [0.26, 0.3, 0],
    anchor: 'center',
    label: 'Right grip (tool/weapon)'
  },
  LeftFootAttachment: {
    bonePat: ['leftfoot'],
    worldFrac: [-0.08, 0.02, 0],
    anchor: 'top',
    label: 'Left foot'
  },
  RightFootAttachment: {
    bonePat: ['rightfoot'],
    worldFrac: [0.08, 0.02, 0],
    anchor: 'top',
    label: 'Right foot'
  }
}

export const BONE_SEARCH = {
  Root: ['humanoidrootpart', 'root'],
  Head: ['head'],
  UpperTorso: ['uppertorso', 'upper_torso', 'torso', 'chest', 'spine', 'uptorso'],
  LowerTorso: ['lowertorso', 'lower_torso', 'hips', 'pelvis', 'lowtorso'],
  LeftUpperArm: ['leftupperarm', 'left_upper_arm', 'leftshoulder', 'leftarm'],
  RightUpperArm: ['rightupperarm', 'right_upper_arm', 'rightshoulder', 'rightarm'],
  LeftLowerArm: ['leftlowerarm', 'left_lower_arm', 'leftforearm'],
  RightLowerArm: ['rightlowerarm', 'right_lower_arm', 'rightforearm'],
  LeftHand: ['lefthand', 'left_hand'],
  RightHand: ['righthand', 'right_hand'],
  LeftUpperLeg: ['leftupperleg', 'left_upper_leg', 'leftupleg', 'lefthip'],
  RightUpperLeg: ['rightupperleg', 'right_upper_leg', 'rightupleg', 'righthip'],
  LeftLowerLeg: ['leftlowerleg', 'left_lower_leg', 'leftleg', 'leftknee'],
  RightLowerLeg: ['rightlowerleg', 'right_lower_leg', 'rightleg', 'rightknee'],
  LeftFoot: ['leftfoot', 'left_foot'],
  RightFoot: ['rightfoot', 'right_foot']
}

const MOTION_NAME_MAP = {
  hips: 'Root',
  pelvis: 'Root',
  root: 'Root',
  humanoidrootpart: 'Root',
  spine: 'LowerTorso',
  spine1: 'LowerTorso',
  spine2: 'UpperTorso',
  spine3: 'UpperTorso',
  chest: 'UpperTorso',
  upperchest: 'UpperTorso',
  neck: 'UpperTorso',
  head: 'Head',
  leftshoulder: 'LeftUpperArm',
  leftarm: 'LeftUpperArm',
  leftupperarm: 'LeftUpperArm',
  leftforearm: 'LeftLowerArm',
  leftlowerarm: 'LeftLowerArm',
  lefthand: 'LeftHand',
  rightshoulder: 'RightUpperArm',
  rightarm: 'RightUpperArm',
  rightupperarm: 'RightUpperArm',
  rightforearm: 'RightLowerArm',
  rightlowerarm: 'RightLowerArm',
  righthand: 'RightHand',
  leftupleg: 'LeftUpperLeg',
  leftupperleg: 'LeftUpperLeg',
  lefthip: 'LeftUpperLeg',
  leftleg: 'LeftLowerLeg',
  leftlowerleg: 'LeftLowerLeg',
  leftknee: 'LeftLowerLeg',
  leftfoot: 'LeftFoot',
  leftankle: 'LeftFoot',
  rightupleg: 'RightUpperLeg',
  rightupperleg: 'RightUpperLeg',
  righthip: 'RightUpperLeg',
  rightleg: 'RightLowerLeg',
  rightlowerleg: 'RightLowerLeg',
  rightknee: 'RightLowerLeg',
  rightfoot: 'RightFoot',
  rightankle: 'RightFoot',
  lowertorso: 'LowerTorso',
  uppertorso: 'UpperTorso'
}

export function normName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[\s_\-.:]/g, '')
}

export function canonicalizeMotionBoneName(name) {
  const normalized = normName(name)
  return MOTION_NAME_MAP[normalized] || null
}

export function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

export function findBonesByName(root) {
  const bones = {}
  root.traverse((obj) => {
    const normalized = normName(obj.name)
    for (const [id, patterns] of Object.entries(BONE_SEARCH)) {
      if (!bones[id] && patterns.some((pattern) => normalized.includes(pattern))) {
        bones[id] = obj
      }
    }
  })
  return bones
}

export function buildAttachmentAnchors(rigScene) {
  const anchors = {}

  rigScene.traverse((obj) => {
    if (ROBLOX_ATTACH[obj.name]) anchors[obj.name] = obj
  })

  if (Object.keys(anchors).length >= 4) return anchors

  const bones = findBonesByName(rigScene)
  const bbox = new THREE.Box3().setFromObject(rigScene)
  const height = bbox.max.y - bbox.min.y
  const baseY = bbox.min.y

  for (const [name, def] of Object.entries(ROBLOX_ATTACH)) {
    if (anchors[name]) continue

    let parentBone = null
    for (const bonePattern of def.bonePat) {
      const key = Object.keys(BONE_SEARCH).find((boneName) =>
        BONE_SEARCH[boneName].some(
          (pattern) =>
            pattern === bonePattern ||
            pattern.includes(bonePattern) ||
            bonePattern.includes(pattern)
        )
      )
      if (key && bones[key]) {
        parentBone = bones[key]
        break
      }
    }

    if (!parentBone) parentBone = rigScene

    const worldTarget = new THREE.Vector3(
      def.worldFrac[0] * height,
      baseY + def.worldFrac[1] * height,
      def.worldFrac[2] * height
    )
    const helper = new THREE.Object3D()
    helper.name = name
    parentBone.add(helper)
    helper.position.copy(parentBone.worldToLocal(worldTarget.clone()))
    anchors[name] = helper
  }

  return anchors
}

export function buildRigNameMap(rigScene) {
  const names = {}
  rigScene.traverse((obj) => {
    const canonical =
      canonicalizeMotionBoneName(obj.name) || (BONE_SEARCH[obj.name] ? obj.name : null)
    if (!canonical) {
      const normalized = normName(obj.name)
      const matched = Object.entries(BONE_SEARCH).find(([, patterns]) =>
        patterns.some((pattern) => normalized.includes(pattern))
      )
      if (matched) names[obj.name] = matched[0]
      return
    }
    names[obj.name] = canonical
  })
  return names
}

export function canonicalizeMotionSkeleton(rootBone) {
  rootBone.traverse((bone) => {
    const canonical = canonicalizeMotionBoneName(bone.name)
    if (canonical) bone.name = canonical
  })
}

export function canonicalizeMotionClip(clip) {
  clip.tracks.forEach((track) => {
    const [boneName, property] = track.name.split('.')
    const canonical = canonicalizeMotionBoneName(boneName)
    if (canonical) track.name = `${canonical}.${property}`
  })
}

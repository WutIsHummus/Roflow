/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CONFIG_KEYS } from '../../../../shared/configKeys.js'
import { useConfigKey } from '../../hooks/useConfigKey.js'
import {
  MAX_SEQUENCE_KEYPOINTS,
  MIN_SEQUENCE_KEYPOINTS,
  buildRobloxSequenceExport,
  clamp,
  colorSequenceGradientCss,
  migrateLayerSequences,
  normalizeColorKeypoints,
  normalizeSizeKeypoints,
  normalizeTransparencyKeypoints,
  numberSequenceGradientCss,
  syncLegacyFieldsFromSequences
} from '../../../../shared/vfxSequenceUtils.js'
import VfxPreview3D from './VfxPreview3D'
import { RotateCcw, Download, Plus, Image, Video, Sparkles, Sliders, Play, Layers, Trash2, AlertCircle } from 'lucide-react'

let nextReferenceId = 1
let nextLayerId = 1

const EFFECT_TYPES = [
  { id: 'impact', label: 'Impact Burst' },
  { id: 'projectile', label: 'Projectile Trail' },
  { id: 'aura', label: 'Aura / Buff' },
  { id: 'explosion', label: 'Explosion' },
  { id: 'environment', label: 'Ambient / Environment' }
]

const PERFORMANCE_OPTIONS = [
  { id: 'low', label: 'Low Cost' },
  { id: 'medium', label: 'Balanced' },
  { id: 'high', label: 'Hero Effect' }
]

const SHAPE_OPTIONS = [
  { id: 'orb', label: 'Orb' },
  { id: 'spark', label: 'Spark' },
  { id: 'smoke', label: 'Smoke' },
  { id: 'ring', label: 'Ring' },
  { id: 'slash', label: 'Slash' },
  { id: 'flare', label: 'Flare' }
]

const TEXTURE_SOURCE_OPTIONS = [
  { id: 'shape', label: 'Procedural Shape' },
  { id: 'image', label: 'Custom Image' }
]

const DEFAULT_ELEVENLABS_WEB_CONFIG = {
  elevenlabsWebLoginUrl: 'https://elevenlabs.io/',
  elevenlabsWebImageUrl: 'https://elevenlabs.io/image'
}

const DEEPSEEK_MODELS = [
  { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash' },
  { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' }
]

const SOURCE_MODES = [
  { id: 'ground-up', label: 'Ground Up' },
  { id: 'niagara-rebuild', label: 'Niagara ΓåÆ Roblox' }
]

const ROBLOX_CLASS_OPTIONS = [
  { id: 'ParticleEmitter', label: 'ParticleEmitter' },
  { id: 'Beam', label: 'Beam' },
  { id: 'Trail', label: 'Trail' }
]

const EMISSION_DIRECTION_OPTIONS = [
  { id: 'Top', label: 'Top' },
  { id: 'Bottom', label: 'Bottom' },
  { id: 'Front', label: 'Front' },
  { id: 'Back', label: 'Back' },
  { id: 'Left', label: 'Left' },
  { id: 'Right', label: 'Right' }
]

const EMISSION_SHAPE_OPTIONS = [
  { id: 'Ball', label: 'Ball' },
  { id: 'Box', label: 'Box' },
  { id: 'Cylinder', label: 'Cylinder' },
  { id: 'Disc', label: 'Disc' },
  { id: 'Sphere', label: 'Sphere' }
]

const SHAPE_IN_OUT_OPTIONS = [
  { id: 'Inward', label: 'Inward' },
  { id: 'Outward', label: 'Outward' },
  { id: 'InAndOut', label: 'In & Out' }
]

const SHAPE_STYLE_OPTIONS = [
  { id: 'Volume', label: 'Volume' },
  { id: 'Surface', label: 'Surface' }
]

const ORIENTATION_OPTIONS = [
  { id: 'FacingCamera', label: 'Facing Camera' },
  { id: 'FacingCameraWorldUp', label: 'Camera World Up' },
  { id: 'VelocityParallel', label: 'Velocity Parallel' },
  { id: 'VelocityPerpendicular', label: 'Velocity Perpendicular' }
]

const FLIPBOOK_LAYOUT_OPTIONS = [
  { id: 'None', label: 'None' },
  { id: 'Grid2x2', label: 'Grid 2├ù2' },
  { id: 'Grid4x4', label: 'Grid 4├ù4' },
  { id: 'Grid8x8', label: 'Grid 8├ù8' }
]

const FLIPBOOK_MODE_OPTIONS = [
  { id: 'None', label: 'None' },
  { id: 'Loop', label: 'Loop' },
  { id: 'PingPong', label: 'Ping Pong' },
  { id: 'Random', label: 'Random' },
  { id: 'OneShot', label: 'One Shot' }
]

function createReference(overrides = {}) {
  return {
    id: `vfx-ref-${nextReferenceId++}`,
    kind: 'image',
    label: '',
    filePath: '',
    format: '',
    ...overrides
  }
}

function createLayer(overrides = {}) {
  return migrateLayerSequences({
    id: `vfx-layer-${nextLayerId++}`,
    name: 'Main Flash',
    role: 'primary burst',
    textureSource: 'shape',
    shape: 'orb',
    enabled: true,
    textureImagePath: '',
    textureDataUrl: '',
    color: '#a78bfa',
    secondaryColor: '#f8fafc',
    colorKeypoints: [
      { time: 0, color: '#a78bfa' },
      { time: 1, color: '#f8fafc' }
    ],
    opacity: 0.8,
    transparencyEnd: 1,
    transparencyKeypoints: [
      { time: 0, value: 0.2 },
      { time: 1, value: 1 }
    ],
    sizeMin: 0.35,
    sizeMax: 1.3,
    sizeKeypoints: [
      { time: 0, value: 0.35 },
      { time: 1, value: 1.3 }
    ],
    lifetimeMin: 0.15,
    lifetimeMax: 0.75,
    rate: 28,
    speedMin: 6,
    speedMax: 18,
    spread: 18,
    spreadAngleY: 18,
    drag: 0.12,
    accelerationX: 0,
    accelerationY: 0,
    accelerationZ: 0,
    velocityInheritance: 0,
    windAffectsDrag: false,
    lockedToPart: false,
    emissionDirection: 'Top',
    emissionShape: 'Sphere',
    shapeInOut: 'Outward',
    shapeStyle: 'Volume',
    lightEmission: 0.85,
    lightInfluence: 0,
    zOffset: 0,
    rotationMin: 0,
    rotationMax: 0,
    rotSpeedMin: 0,
    rotSpeedMax: 0,
    orientation: 'FacingCamera',
    flipbookLayout: 'None',
    flipbookMode: 'None',
    flipbookStartRandom: false,
    flipbookFramerateMin: 1,
    flipbookFramerateMax: 1,
    timeScale: 1,
    width0: 0.5,
    width1: 0.5,
    robloxClass: 'ParticleEmitter',
    textureHint: 'soft additive orb sprite',
    notes: '',
    ...overrides
  })
}

function createStarterLayers(effectType) {
  if (effectType === 'aura') {
    return [
      createLayer({
        name: 'Aura Glow',
        role: 'main aura body',
        shape: 'flare',
        color: '#8b5cf6',
        secondaryColor: '#c4b5fd',
        sizeMin: 1,
        sizeMax: 1.9,
        lifetimeMin: 0.5,
        lifetimeMax: 1.5,
        rate: 8,
        speedMin: 0,
        speedMax: 2,
        spread: 0
      }),
      createLayer({
        name: 'Orbit Accents',
        role: 'bright accents',
        shape: 'spark',
        color: '#f472b6',
        sizeMin: 0.1,
        sizeMax: 0.45,
        rate: 18,
        speedMin: 3,
        speedMax: 8,
        spread: 55
      })
    ]
  }

  if (effectType === 'projectile') {
    return [
      createLayer({
        name: 'Travel Streak',
        role: 'main travel streak',
        shape: 'slash',
        color: '#38bdf8',
        sizeMin: 0.18,
        sizeMax: 0.4,
        rate: 12,
        speedMin: 18,
        speedMax: 32,
        spread: 8
      }),
      createLayer({
        name: 'Trailing Debris',
        role: 'secondary debris',
        shape: 'spark',
        color: '#fb7185',
        rate: 22,
        speedMin: 8,
        speedMax: 18,
        spread: 28
      })
    ]
  }

  return [
    createLayer({
      name: 'Main Flash',
      role: 'primary hit flash',
      shape: 'flare',
      color: '#f59e0b',
      sizeMin: 0.4,
      sizeMax: 1.4,
      rate: 30,
      speedMin: 8,
      speedMax: 20,
      spread: 20
    }),
    createLayer({
      name: 'Debris',
      role: 'fast debris',
      shape: 'spark',
      color: '#fb7185',
      sizeMin: 0.08,
      sizeMax: 0.35,
      rate: 24,
      speedMin: 12,
      speedMax: 26,
      spread: 42
    }),
    createLayer({
      name: 'Smoke Fade',
      role: 'lingering fade',
      shape: 'smoke',
      color: '#94a3b8',
      opacity: 0.5,
      sizeMin: 0.55,
      sizeMax: 1.8,
      lifetimeMin: 0.35,
      lifetimeMax: 1.2,
      rate: 14,
      speedMin: 2,
      speedMax: 8,
      spread: 55
    })
  ]
}

function createDefaultWorkflow(overrides = {}) {
  const layers = createStarterLayers(overrides.effectType || 'impact')
  return {
    effectName: 'Arcane Burst',
    sourceMode: 'ground-up',
    effectType: 'impact',
    performanceTarget: 'medium',
    deepseekModel: 'deepseek-v4-flash',
    prompt: '',
    gameplayPurpose: 'Ability impact burst with a magical hit confirm.',
    visualDirection: 'Stylized magic with readable silhouettes and soft additive energy.',
    unrealSystemType: 'Niagara',
    unrealValuesText: '',
    unrealMaterialNotes: '',
    unrealTimingNotes: '',
    generatedNotes: '',
    activeLayerId: layers[0]?.id || null,
    references: [],
    layers,
    ...overrides
  }
}

function layerSequences(layer) {
  const colorKeypoints = normalizeColorKeypoints(layer.colorKeypoints, layer)
  const sizeKeypoints = normalizeSizeKeypoints(layer.sizeKeypoints, layer)
  const transparencyKeypoints = normalizeTransparencyKeypoints(layer.transparencyKeypoints, layer)
  return { colorKeypoints, sizeKeypoints, transparencyKeypoints }
}

function buildVfxTextureImagePrompt(workflow, layer) {
  const shape = layer.shape || 'orb'
  const textureHint = layer.textureHint?.trim() || `${shape} particle sprite`
  const visualDirection = workflow.visualDirection?.trim() || 'Stylized game VFX with readable silhouettes.'
  const effectName = workflow.effectName?.trim() || 'VFX effect'
  const layerRole = layer.role?.trim() || layer.name?.trim() || 'particle layer'

  return [
    `Roblox particle texture sprite for "${effectName}" ΓÇö ${layerRole}.`,
    `Visual direction: ${visualDirection}`,
    `Sprite shape/style: ${textureHint} (${shape} silhouette).`,
    'Requirements: square PNG-friendly sprite, transparent background, soft edges, additive-friendly glow, no text, no watermark, game-ready VFX texture.'
  ].join(' ')
}

function buildLayerRobloxMapping(layer) {
  const textureSource = layer.textureSource || 'shape'
  const textureValue =
    textureSource === 'image' && layer.textureImagePath
      ? `rbxassetid://ΓÇª (${fileNameFromPath(layer.textureImagePath)})`
      : `rbxassetid://ΓÇª ΓÇö ${layer.textureHint || `${layer.shape || 'orb'} procedural sprite`}`

  const robloxClass = layer.robloxClass || 'ParticleEmitter'
  const spreadY = layer.spreadAngleY ?? layer.spread ?? 18
  const { colorKeypoints, sizeKeypoints, transparencyKeypoints } = layerSequences(layer)

  const baseProperties = {
    Enabled: layer.enabled !== false,
    Texture: textureValue,
    TextureSource: textureSource,
    ProceduralShape: textureSource === 'shape' ? layer.shape : undefined
  }

  if (robloxClass === 'Beam') {
    return {
      className: 'Beam',
      properties: {
        ...baseProperties,
        Width0: layer.width0 ?? 0.5,
        Width1: layer.width1 ?? 0.5,
        Color: buildRobloxSequenceExport(colorKeypoints),
        LightEmission: layer.lightEmission ?? 1,
        LightInfluence: layer.lightInfluence ?? 0,
        Transparency: buildRobloxSequenceExport(transparencyKeypoints)
      },
      parenting: 'Requires two Attachments (Attachment0, Attachment1)',
      notes: layer.notes || ''
    }
  }

  if (robloxClass === 'Trail') {
    return {
      className: 'Trail',
      properties: {
        ...baseProperties,
        Lifetime: { min: layer.lifetimeMin, max: layer.lifetimeMax },
        Color: buildRobloxSequenceExport(colorKeypoints),
        LightEmission: layer.lightEmission ?? 1,
        LightInfluence: layer.lightInfluence ?? 0,
        Transparency: buildRobloxSequenceExport(transparencyKeypoints),
        WidthScale: buildRobloxSequenceExport(sizeKeypoints)
      },
      parenting: 'Parent on moving Part; requires Attachment0/Attachment1 trail path',
      notes: layer.notes || ''
    }
  }

  return {
    className: 'ParticleEmitter',
    properties: {
      ...baseProperties,
      Rate: layer.rate,
      EmissionDirection: layer.emissionDirection || 'Top',
      Shape: layer.emissionShape || 'Sphere',
      ShapeInOut: layer.shapeInOut || 'Outward',
      ShapeStyle: layer.shapeStyle || 'Volume',
      Lifetime: { min: layer.lifetimeMin, max: layer.lifetimeMax },
      Speed: { min: layer.speedMin, max: layer.speedMax },
      SpreadAngle: { x: layer.spread, y: spreadY },
      Drag: layer.drag,
      Acceleration: {
        x: layer.accelerationX ?? 0,
        y: layer.accelerationY ?? 0,
        z: layer.accelerationZ ?? 0
      },
      VelocityInheritance: layer.velocityInheritance ?? 0,
      WindAffectsDrag: layer.windAffectsDrag ?? false,
      LockedToPart: layer.lockedToPart ?? false,
      Size: buildRobloxSequenceExport(sizeKeypoints),
      Color: buildRobloxSequenceExport(colorKeypoints),
      Transparency: buildRobloxSequenceExport(transparencyKeypoints),
      LightEmission: layer.lightEmission ?? 1,
      LightInfluence: layer.lightInfluence ?? 0,
      ZOffset: layer.zOffset ?? 0,
      Rotation: { min: layer.rotationMin ?? 0, max: layer.rotationMax ?? 0 },
      RotSpeed: { min: layer.rotSpeedMin ?? 0, max: layer.rotSpeedMax ?? 0 },
      Orientation: layer.orientation || 'FacingCamera',
      FlipbookLayout: layer.flipbookLayout || 'None',
      FlipbookMode: layer.flipbookMode || 'None',
      FlipbookStartRandom: layer.flipbookStartRandom ?? false,
      FlipbookFramerate: { min: layer.flipbookFramerateMin ?? 1, max: layer.flipbookFramerateMax ?? 1 },
      TimeScale: layer.timeScale ?? 1
    },
    parenting: 'Prefer Attachment on tool/character; Part for world FX',
    notes: layer.notes || ''
  }
}

function fileNameFromPath(filePath) {
  return String(filePath || '')
    .split(/[/\\]/)
    .pop()
}

function fileStemFromPath(filePath) {
  const name = fileNameFromPath(filePath)
  const dot = name.lastIndexOf('.')
  return dot === -1 ? name : name.slice(0, dot)
}

function extensionFromPath(filePath) {
  const name = fileNameFromPath(filePath)
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).toLowerCase()
}

function inferReferenceKind(filePath) {
  const ext = extensionFromPath(filePath)
  if (['png', 'jpg', 'jpeg', 'webp', 'gif', 'tga'].includes(ext)) return 'image'
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video'
  return 'asset'
}

function isPreviewableImage(filePath) {
  return ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(extensionFromPath(filePath))
}

function estimateLayerCost(layer) {
  const sizeKeypoints = normalizeSizeKeypoints(layer.sizeKeypoints, layer)
  const maxSize = Math.max(...sizeKeypoints.map((kp) => kp.value))
  return Math.round(layer.rate + maxSize * 12 + layer.speedMax * 0.8)
}

function buildPreset(workflow) {
  const performanceScale =
    workflow.performanceTarget === 'low' ? 0.72 : workflow.performanceTarget === 'high' ? 1.2 : 1

  const layers = workflow.layers
    .filter((layer) => layer.enabled)
    .map((layer) => {
      const { colorKeypoints, sizeKeypoints, transparencyKeypoints } = layerSequences(layer)
      const sizeValues = sizeKeypoints.map((kp) => kp.value)
      const sizeMin = Math.min(...sizeValues)
      const sizeMax = Math.max(...sizeValues)
      const lifetimeMin = Math.min(layer.lifetimeMin, layer.lifetimeMax)
      const lifetimeMax = Math.max(layer.lifetimeMin, layer.lifetimeMax)
      const speedMin = Math.min(layer.speedMin, layer.speedMax)
      const speedMax = Math.max(layer.speedMin, layer.speedMax)

      return {
        id: layer.id,
        name: layer.name,
        role: layer.role,
        enabled: layer.enabled !== false,
        textureSource: layer.textureSource || 'shape',
        shape: layer.shape,
        robloxClass: layer.robloxClass || 'ParticleEmitter',
        textureHint: layer.textureHint,
        textureImagePath: layer.textureImagePath || '',
        color: buildRobloxSequenceExport(colorKeypoints),
        size: buildRobloxSequenceExport(sizeKeypoints),
        transparency: buildRobloxSequenceExport(transparencyKeypoints),
        opacity: layer.opacity,
        transparencyEnd: layer.transparencyEnd ?? 1,
        lightEmission: layer.lightEmission ?? 1,
        lightInfluence: layer.lightInfluence ?? 0,
        zOffset: layer.zOffset ?? 0,
        flipbookLayout: layer.flipbookLayout || 'None',
        flipbookMode: layer.flipbookMode || 'None',
        flipbookStartRandom: layer.flipbookStartRandom ?? false,
        flipbookFramerate: {
          min: layer.flipbookFramerateMin ?? 1,
          max: layer.flipbookFramerateMax ?? 1
        },
        timeScale: layer.timeScale ?? 1,
        emissionDirection: layer.emissionDirection || 'Top',
        emissionShape: layer.emissionShape || 'Sphere',
        shapeInOut: layer.shapeInOut || 'Outward',
        shapeStyle: layer.shapeStyle || 'Volume',
        acceleration: {
          x: layer.accelerationX ?? 0,
          y: layer.accelerationY ?? 0,
          z: layer.accelerationZ ?? 0
        },
        velocityInheritance: layer.velocityInheritance ?? 0,
        windAffectsDrag: layer.windAffectsDrag ?? false,
        lockedToPart: layer.lockedToPart ?? false,
        rotation: { min: layer.rotationMin ?? 0, max: layer.rotationMax ?? 0 },
        rotSpeed: { min: layer.rotSpeedMin ?? 0, max: layer.rotSpeedMax ?? 0 },
        orientation: layer.orientation || 'FacingCamera',
        width0: layer.width0 ?? 0.5,
        width1: layer.width1 ?? 0.5,
        sizeMin: Number(sizeMin.toFixed(2)),
        sizeMax: Number(sizeMax.toFixed(2)),
        lifetime: { min: Number(lifetimeMin.toFixed(2)), max: Number(lifetimeMax.toFixed(2)) },
        rate: Math.max(1, Math.round(layer.rate * performanceScale)),
        speed: { min: Number(speedMin.toFixed(2)), max: Number(speedMax.toFixed(2)) },
        spread: Math.round(layer.spread),
        spreadAngleY: Math.round(layer.spreadAngleY ?? layer.spread),
        drag: Number(layer.drag.toFixed(2)),
        notes: layer.notes || '',
        roblox: buildLayerRobloxMapping(layer)
      }
    })

  const totalCost = layers.reduce((sum, layer) => sum + estimateLayerCost(layer), 0)

  return {
    meta: {
      effectName: workflow.effectName,
      sourceMode: workflow.sourceMode,
      effectType: workflow.effectType,
      performanceTarget: workflow.performanceTarget,
      prompt: workflow.prompt,
      visualDirection: workflow.visualDirection,
      gameplayPurpose: workflow.gameplayPurpose
    },
    ...(workflow.sourceMode === 'niagara-rebuild'
      ? {
          unrealSource: {
            systemType: workflow.unrealSystemType,
            niagaraValues: workflow.unrealValuesText,
            materialNotes: workflow.unrealMaterialNotes,
            timingNotes: workflow.unrealTimingNotes
          }
        }
      : {}),
    references: workflow.references.map((reference) => ({
      kind: reference.kind,
      label: reference.label,
      filePath: reference.filePath,
      format: reference.format
    })),
    layers,
    metrics: {
      layerCount: layers.length,
      referenceCount: workflow.references.length,
      estimatedCost: totalCost
    }
  }
}

function buildWorkflowSummary(workflow, preset) {
  return [
    `Effect: ${workflow.effectName}`,
    `Type: ${workflow.effectType}`,
    `Performance: ${workflow.performanceTarget}`,
    '',
    'Prompt',
    workflow.prompt || 'Not provided',
    '',
    'Gameplay Purpose',
    workflow.gameplayPurpose || 'Not provided',
    '',
    'Visual Direction',
    workflow.visualDirection || 'Not provided',
    '',
    workflow.generatedNotes ? `AI Notes\n${workflow.generatedNotes}\n` : null,
    'Preset JSON',
    JSON.stringify(preset, null, 2)
  ]
    .filter(Boolean)
    .join('\n')
}

function applyGeneratedLogic(workflow, logic) {
  const layers = (logic.layers || []).map((layer) => createLayer(layer))
  return {
    ...workflow,
    effectName: logic.effectName || workflow.effectName,
    visualDirection: logic.visualDirection || workflow.visualDirection,
    generatedNotes: logic.reasoning || '',
    layers,
    activeLayerId: layers[0]?.id || null
  }
}

const S = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'transparent'
  },
  header: {
    padding: '22px 24px 18px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    flexShrink: 0
  },
  title: {
    fontSize: 20,
    fontWeight: 800,
    color: '#eef0f6',
    margin: 0
  },
  subtitle: { fontSize: 12, color: '#94a3b8', marginTop: 4, lineHeight: 1.6 },
  body: { flex: 1, display: 'flex', minHeight: 0 },
  rail: {
    width: 320,
    borderRight: '1px solid rgba(255, 255, 255, 0.08)',
    overflowY: 'auto',
    padding: 20,
    background: 'rgba(12, 14, 21, 0.4)',
    backdropFilter: 'blur(24px)'
  },
  editor: { flex: 1, minWidth: 0, overflowY: 'auto', padding: 24 },
  pack: {
    width: 360,
    borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
    overflowY: 'auto',
    padding: 20,
    background: 'rgba(12, 14, 21, 0.4)',
    backdropFilter: 'blur(24px)'
  },
  card: {
    background: 'rgba(16, 19, 28, 0.4)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 16
  },
  input: {
    width: '100%',
    background: 'rgba(16, 19, 28, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: '11px 14px',
    fontSize: 12,
    color: '#f8fafc',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'all 0.15s'
  },
  textarea: {
    width: '100%',
    background: 'rgba(16, 19, 28, 0.4)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: '11px 14px',
    fontSize: 12,
    color: '#f8fafc',
    outline: 'none',
    boxSizing: 'border-box',
    resize: 'vertical',
    transition: 'all 0.15s'
  },
  label: {
    fontSize: 11,
    fontWeight: 700,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
    display: 'block'
  },
  button: {
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#0c0e17',
    border: 'none',
    borderRadius: 12,
    padding: '11px 18px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    boxShadow: '0 4px 16px rgba(255, 255, 255, 0.05)',
    transition: 'all 0.15s'
  },
  subtleButton: {
    background: 'rgba(255, 255, 255, 0.03)',
    color: '#e2e8f0',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: '11px 16px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    transition: 'all 0.15s'
  }
}

function StatChip({ label, value, accent = '#a78bfa' }) {
  return (
    <div style={{ ...S.card, padding: '12px 14px' }}>
      <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: '#64748b' }}>{label}</span>
      <div style={{ fontSize: 16, fontWeight: 800, color: accent, marginTop: 4 }}>{value}</div>
    </div>
  )
}

function LayerSection({ title, children, defaultOpen = true }) {
  return (
    <details
      open={defaultOpen}
      style={{ ...S.card, padding: 14, background: 'rgba(0,0,0,0.18)' }}
    >
      <summary
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#eef0f6',
          cursor: 'pointer',
          listStyle: 'none'
        }}
      >
        {title}
      </summary>
      <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>{children}</div>
    </details>
  )
}

function LayerNumField({ label, value, min, max, step = 0.05, onChange }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      <input
        style={S.input}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(clamp(Number(event.target.value) || min, min, max))}
      />
    </div>
  )
}

function LayerSelectField({ label, value, options, onChange }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      <select style={S.input} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function LayerCheckField({ label, checked, onChange }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#c7d0e2' }}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

function SequenceEditor({
  label,
  kind,
  layer,
  keypoints,
  onChange,
  valueMin = 0,
  valueMax = 1,
  valueStep = 0.05,
  valueLabel = 'Value'
}) {
  const sorted = [...keypoints].sort((a, b) => a.time - b.time)
  const field =
    kind === 'color' ? 'colorKeypoints' : kind === 'size' ? 'sizeKeypoints' : 'transparencyKeypoints'

  const setKeypoints = (nextKeypoints) => {
    onChange(syncLegacyFieldsFromSequences({ ...layer, [field]: nextKeypoints }))
  }

  const handleTimeChange = (index, time) => {
    const next = sorted.map((kp, i) =>
      i === index ? { ...kp, time: clamp(Number(time) || 0, 0, 1) } : kp
    )
    setKeypoints(next)
  }

  const handleValueChange = (index, rawValue) => {
    const next = sorted.map((kp, i) => {
      if (i !== index) return kp
      if (kind === 'color') return { ...kp, color: rawValue }
      return { ...kp, value: clamp(Number(rawValue) || valueMin, valueMin, valueMax) }
    })
    setKeypoints(next)
  }

  const handleRemove = (index) => {
    if (sorted.length <= MIN_SEQUENCE_KEYPOINTS) return
    setKeypoints(sorted.filter((_, i) => i !== index))
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
    const midTime = Number(((a.time + b.time) / 2).toFixed(3))
    const newKp =
      kind === 'color'
        ? { time: midTime, color: a.color }
        : { time: midTime, value: (a.value + b.value) / 2 }
    const next = [...sorted]
    next.splice(insertAfter + 1, 0, newKp)
    setKeypoints(next)
  }

  const gradientStyle =
    kind === 'color'
      ? { background: colorSequenceGradientCss(sorted) }
      : {
          background: numberSequenceGradientCss(
            sorted,
            valueMin,
            valueMax,
            kind === 'transparency' ? '#94a3b8' : '#a78bfa'
          )
        }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ ...S.label, marginBottom: 0 }}>{label}</span>
        <button
          type="button"
          style={{ ...S.subtleButton, padding: '6px 10px', fontSize: 11 }}
          onClick={handleAdd}
          disabled={sorted.length >= MAX_SEQUENCE_KEYPOINTS}
        >
          Add Keypoint
        </button>
      </div>
      <div
        style={{
          height: 14,
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.08)',
          position: 'relative',
          overflow: 'hidden',
          ...gradientStyle
        }}
      >
        {sorted.map((kp) => (
          <div
            key={`${kp.time}-${kp.color || kp.value}`}
            title={`t=${kp.time}`}
            style={{
              position: 'absolute',
              top: 2,
              bottom: 2,
              left: `${kp.time * 100}%`,
              width: 3,
              marginLeft: -1,
              borderRadius: 2,
              background: kind === 'color' ? '#fff' : '#eef0f6',
              boxShadow: '0 0 4px rgba(0,0,0,0.45)'
            }}
          />
        ))}
      </div>
      <div style={{ display: 'grid', gap: 6 }}>
        {sorted.map((kp, index) => (
          <div
            key={`${kind}-${index}-${kp.time}`}
            style={{
              display: 'grid',
              gridTemplateColumns: kind === 'color' ? '72px 1fr 44px 32px' : '72px 1fr 32px',
              gap: 8,
              alignItems: 'end'
            }}
          >
            <div>
              <label style={{ ...S.label, fontSize: 9 }}>Time</label>
              <input
                style={{ ...S.input, padding: '7px 8px' }}
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={kp.time}
                onChange={(event) => handleTimeChange(index, event.target.value)}
              />
            </div>
            {kind === 'color' ? (
              <div>
                <label style={{ ...S.label, fontSize: 9 }}>Color</label>
                <input
                  style={{ ...S.input, padding: 4, height: 36 }}
                  type="color"
                  value={kp.color}
                  onChange={(event) => handleValueChange(index, event.target.value)}
                />
              </div>
            ) : (
              <div>
                <label style={{ ...S.label, fontSize: 9 }}>{valueLabel}</label>
                <input
                  style={{ ...S.input, padding: '7px 8px' }}
                  type="number"
                  min={valueMin}
                  max={valueMax}
                  step={valueStep}
                  value={Number(kp.value.toFixed(3))}
                  onChange={(event) => handleValueChange(index, event.target.value)}
                />
              </div>
            )}
            {kind === 'color' ? (
              <div
                style={{
                  height: 36,
                  borderRadius: 10,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: kp.color
                }}
              />
            ) : null}
            <button
              type="button"
              style={{
                ...S.subtleButton,
                padding: '7px 0',
                fontSize: 14,
                opacity: sorted.length <= MIN_SEQUENCE_KEYPOINTS ? 0.35 : 1
              }}
              onClick={() => handleRemove(index)}
              disabled={sorted.length <= MIN_SEQUENCE_KEYPOINTS}
              title="Remove keypoint"
            >
              ├ù
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function migrateWorkflowLayers(workflow) {
  return {
    ...workflow,
    layers: (workflow.layers || []).map(migrateLayerSequences)
  }
}

export default function VFXModule({ workflowState, setWorkflowState }) {
  const [workflow, setWorkflow] = useState(() =>
    migrateWorkflowLayers(workflowState?.vfxWorkflow || createDefaultWorkflow())
  )
  const [previewCache, setPreviewCache] = useState({})
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [progress, setProgress] = useState(null)
  const deepseekApiKey = useConfigKey(CONFIG_KEYS.DEEPSEEK_API_KEY)
  const [elevenLabsWebConfig, setElevenLabsWebConfig] = useState(DEFAULT_ELEVENLABS_WEB_CONFIG)

  useEffect(() => {
    let active = true
    Promise.all([
      window.api.configGet(CONFIG_KEYS.CLOTHING_PROVIDER_WEB_CONFIG),
      window.api.configGet(CONFIG_KEYS.UI_PROVIDER_WEB_CONFIG)
    ]).then(([clothingConfig, uiConfig]) => {
      if (!active) return
      setElevenLabsWebConfig({
        ...DEFAULT_ELEVENLABS_WEB_CONFIG,
        ...(clothingConfig && typeof clothingConfig === 'object' ? clothingConfig : {}),
        ...(uiConfig && typeof uiConfig === 'object' ? uiConfig : {})
      })
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!setWorkflowState) return
    setWorkflowState((prev) => ({ ...prev, vfxWorkflow: workflow }))
  }, [setWorkflowState, workflow])

  useEffect(() => {
    const unsubscribe = window.api.onVfxProgress?.((data) => setProgress(data))
    return () => unsubscribe?.()
  }, [])

  useEffect(() => {
    const previewable = workflow.references.filter(
      (reference) => isPreviewableImage(reference.filePath) && !previewCache[reference.id]
    )
    if (!previewable.length) return

    let active = true
    ;(async () => {
      for (const reference of previewable) {
        const result = await window.api.readFileAsDataURL({ filePath: reference.filePath })
        if (!active || !result?.success) continue
        setPreviewCache((prev) => ({ ...prev, [reference.id]: result.dataUrl }))
      }
    })()

    return () => {
      active = false
    }
  }, [previewCache, workflow.references])

  const activeLayer =
    workflow.layers.find((layer) => layer.id === workflow.activeLayerId) || workflow.layers[0] || null
  const preset = useMemo(
    () => buildPreset(workflow),
    [
      workflow.effectName,
      workflow.sourceMode,
      workflow.effectType,
      workflow.performanceTarget,
      workflow.prompt,
      workflow.visualDirection,
      workflow.gameplayPurpose,
      workflow.unrealSystemType,
      workflow.unrealValuesText,
      workflow.unrealMaterialNotes,
      workflow.unrealTimingNotes,
      workflow.references,
      workflow.layers
    ]
  )
  const layerTextureDataUrls = useMemo(
    () =>
      Object.fromEntries(
        workflow.layers
          .filter((layer) => layer.textureSource === 'image' && layer.textureDataUrl)
          .map((layer) => [layer.id, layer.textureDataUrl])
      ),
    [
      workflow.layers
        .map(
          (layer) =>
            `${layer.id}:${layer.textureSource || 'shape'}:${layer.textureImagePath}:${layer.textureDataUrl?.length || 0}`
        )
        .join('|')
    ]
  )
  const workflowText = useMemo(() => buildWorkflowSummary(workflow, preset), [preset, workflow])

  const setField = useCallback((key, value) => {
    setWorkflow((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateLayer = useCallback((layerId, changes) => {
    setWorkflow((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) => (layer.id === layerId ? { ...layer, ...changes } : layer))
    }))
  }, [])

  useEffect(() => {
    const layersNeedingLoad = workflow.layers.filter(
      (layer) => layer.textureImagePath && isPreviewableImage(layer.textureImagePath) && !layer.textureDataUrl
    )
    if (!layersNeedingLoad.length) return

    let active = true
    ;(async () => {
      for (const layer of layersNeedingLoad) {
        const result = await window.api.readFileAsDataURL({ filePath: layer.textureImagePath })
        if (!active || !result?.success) continue
        updateLayer(layer.id, { textureDataUrl: result.dataUrl })
      }
    })()

    return () => {
      active = false
    }
  }, [updateLayer, workflow.layers])

  const pickLayerTexture = useCallback(
    async (layerId) => {
      const filePath = await window.api.openImage()
      if (!filePath) return

      const changes = { textureSource: 'image', textureImagePath: filePath, textureDataUrl: '' }
      if (isPreviewableImage(filePath)) {
        const result = await window.api.readFileAsDataURL({ filePath })
        if (result?.success) changes.textureDataUrl = result.dataUrl
      }

      updateLayer(layerId, changes)
      setNotice(`Texture assigned to layer.`)
    },
    [updateLayer]
  )

  const clearLayerTexture = useCallback(
    (layerId) => {
      updateLayer(layerId, { textureImagePath: '', textureDataUrl: '', textureSource: 'shape' })
    },
    [updateLayer]
  )

  const assignReferenceToLayer = useCallback(
    async (layerId, reference) => {
      if (!reference?.filePath || reference.kind !== 'image') return

      const changes = {
        textureSource: 'image',
        textureImagePath: reference.filePath,
        textureDataUrl: previewCache[reference.id] || ''
      }
      if (!changes.textureDataUrl && isPreviewableImage(reference.filePath)) {
        const result = await window.api.readFileAsDataURL({ filePath: reference.filePath })
        if (result?.success) {
          changes.textureDataUrl = result.dataUrl
          setPreviewCache((prev) => ({ ...prev, [reference.id]: result.dataUrl }))
        }
      }

      updateLayer(layerId, changes)
      setNotice(`Reference "${reference.label}" assigned as layer texture.`)
    },
    [previewCache, updateLayer]
  )

  const generateLayerTextureWithElevenLabs = useCallback(
    async (layer) => {
      if (!layer) return

      const prompt = buildVfxTextureImagePrompt(workflow, layer)
      const webOptions = {
        loginUrl: elevenLabsWebConfig.elevenlabsWebLoginUrl,
        imageUrl: elevenLabsWebConfig.elevenlabsWebImageUrl
      }

      setBusy(`elevenlabs-${layer.id}`)
      setProgress({ step: 'Checking ElevenLabs sessionΓÇª', pct: 4 })

      const session = await window.api.elevenLabsWebSessionStatus(webOptions)
      if (!session?.connected) {
        await window.api.copyText(prompt)
        await window.api.elevenLabsWebOpenLogin(webOptions)
        setBusy('')
        setProgress(null)
        setNotice('ElevenLabs session not connected. Prompt copied ΓÇö log in, then try again.')
        return
      }

      setProgress({ step: 'Generating texture in ElevenLabsΓÇª', pct: 12 })
      const result = await window.api.elevenLabsWebGenerateImage({
        prompt,
        ...webOptions,
        showBrowser: true
      })

      if (result?.success && result.outputPath) {
        const changes = {
          textureSource: 'image',
          textureImagePath: result.outputPath,
          textureDataUrl: ''
        }
        if (isPreviewableImage(result.outputPath)) {
          const preview = await window.api.readFileAsDataURL({ filePath: result.outputPath })
          if (preview?.success) changes.textureDataUrl = preview.dataUrl
        }
        updateLayer(layer.id, changes)
        setNotice('ElevenLabs texture generated and assigned to layer.')
      } else {
        await window.api.copyText(prompt)
        await window.api.elevenLabsWebOpenImageStudio(webOptions)
        setNotice(
          result?.error ||
            'Prompt copied and Image Studio opened. Generate manually, then pick the saved image.'
        )
      }

      setBusy('')
      setProgress(null)
    },
    [elevenLabsWebConfig, updateLayer, workflow]
  )

  const addLayer = useCallback(() => {
    const template = createLayer({ name: 'Extra Layer', role: 'secondary detail' })
    setWorkflow((prev) => ({
      ...prev,
      layers: [...prev.layers, template],
      activeLayerId: template.id
    }))
  }, [])

  const removeLayer = useCallback((layerId) => {
    setWorkflow((prev) => {
      const layers = prev.layers.filter((layer) => layer.id !== layerId)
      return {
        ...prev,
        layers,
        activeLayerId: prev.activeLayerId === layerId ? layers[0]?.id || null : prev.activeLayerId
      }
    })
  }, [])

  const resetStarterLayers = useCallback(() => {
    const layers = createStarterLayers(workflow.effectType)
    setWorkflow((prev) => ({
      ...prev,
      layers,
      activeLayerId: layers[0]?.id || null
    }))
    setNotice('Starter layers refreshed.')
  }, [workflow.effectType])

  const attachReferenceFiles = useCallback(async (filePaths) => {
    if (!filePaths?.length) return
    setBusy('references')

    const builtReferences = filePaths.map((filePath) =>
      createReference({
        kind: inferReferenceKind(filePath),
        filePath,
        label: fileNameFromPath(filePath),
        format: extensionFromPath(filePath).toUpperCase()
      })
    )

    for (const reference of builtReferences) {
      if (isPreviewableImage(reference.filePath)) {
        const previewResult = await window.api.readFileAsDataURL({ filePath: reference.filePath })
        if (previewResult?.success) {
          setPreviewCache((prev) => ({ ...prev, [reference.id]: previewResult.dataUrl }))
        }
      }
    }

    setWorkflow((prev) => ({
      ...prev,
      references: [...prev.references, ...builtReferences],
      effectName: prev.effectName || fileStemFromPath(builtReferences[0]?.filePath || '') || prev.effectName
    }))
    setBusy('')
    setNotice(`${builtReferences.length} reference${builtReferences.length === 1 ? '' : 's'} attached.`)
  }, [])

  const attachImage = useCallback(async () => {
    const filePath = await window.api.openImage()
    if (!filePath) return
    await attachReferenceFiles([filePath])
  }, [attachReferenceFiles])

  const attachVideo = useCallback(async () => {
    const filePath = await window.api.openVideo()
    if (!filePath) return
    await attachReferenceFiles([filePath])
  }, [attachReferenceFiles])

  const generateParticleLogic = useCallback(async () => {
    if (!deepseekApiKey.trim()) {
      setNotice('Add your DeepSeek API key in Settings first.')
      return
    }

    setBusy('generate')
    setProgress({ step: 'Preparing requestΓÇª', pct: 4 })
    setNotice('')

    const result = await window.api.vfxGenerateParticleLogic({
      apiKey: deepseekApiKey.trim(),
      model: workflow.deepseekModel,
      sourceMode: workflow.sourceMode,
      effectName: workflow.effectName,
      effectType: workflow.effectType,
      performanceTarget: workflow.performanceTarget,
      gameplayPurpose: workflow.gameplayPurpose,
      visualDirection: workflow.visualDirection,
      prompt: workflow.prompt,
      unrealSystemType: workflow.unrealSystemType,
      unrealValuesText: workflow.unrealValuesText,
      unrealMaterialNotes: workflow.unrealMaterialNotes,
      unrealTimingNotes: workflow.unrealTimingNotes,
      existingLayers: workflow.layers,
      references: workflow.references
    })

    setBusy('')
    setProgress(null)

    if (!result?.success) {
      setNotice(result?.error || 'Particle logic generation failed.')
      return
    }

    setWorkflow((prev) => applyGeneratedLogic(prev, result.logic))
    setNotice(`Generated ${result.logic.layers.length} layers with ${result.model || workflow.deepseekModel}.`)
  }, [deepseekApiKey, workflow])

  const exportPackage = useCallback(async () => {
    const folderPath = await window.api.saveFolder({ title: 'Export VFX Preset' })
    if (!folderPath) return

    const result = await window.api.exportVfxPackage({
      folderPath,
      effectName: workflow.effectName,
      preset,
      workflowText
    })

    if (!result?.success) {
      setNotice(result?.error || 'Could not export the VFX package.')
      return
    }

    setNotice('VFX preset exported.')
    if (result.files?.presetPath) {
      window.api.openPath(result.files.presetPath)
    }
  }, [preset, workflow.effectName, workflowText])

  const copyText = useCallback(async (text, label) => {
    const result = await window.api.copyText(text)
    setNotice(result?.success ? `${label} copied.` : result?.error || `Could not copy ${label}.`)
  }, [])

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start' }}>
          <div>
            <h1 style={S.title}>VFX Studio</h1>
            <p style={S.subtitle}>
              Describe an effect or paste Niagara reference data ΓÇö DeepSeek V4 translates it into Roblox-ready particle
              layers.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={S.subtleButton} onClick={resetStarterLayers}>
              <RotateCcw size={14} /> Reset Layers
            </button>
            <button style={S.button} onClick={exportPackage}>
              <Download size={14} /> Export Preset
            </button>
          </div>
        </div>
      </div>

      <div style={S.body}>
        <aside style={S.rail}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 12 }}>Effect Brief</div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={S.label}>Effect Name</label>
                  <input
                    style={S.input}
                    value={workflow.effectName}
                    onChange={(event) => setField('effectName', event.target.value)}
                    placeholder="Arcane Burst"
                  />
                </div>
                <div>
                  <label style={S.label}>Source Mode</label>
                  <select
                    style={S.input}
                    value={workflow.sourceMode}
                    onChange={(event) => setField('sourceMode', event.target.value)}
                  >
                    {SOURCE_MODES.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={S.label}>Effect Type</label>
                    <select
                      style={S.input}
                      value={workflow.effectType}
                      onChange={(event) => setField('effectType', event.target.value)}
                    >
                      {EFFECT_TYPES.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={S.label}>Performance</label>
                    <select
                      style={S.input}
                      value={workflow.performanceTarget}
                      onChange={(event) => setField('performanceTarget', event.target.value)}
                    >
                      {PERFORMANCE_OPTIONS.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={S.label}>
                    {workflow.sourceMode === 'niagara-rebuild' ? 'Notes (optional)' : 'Prompt'}
                  </label>
                  <textarea
                    style={{ ...S.textarea, minHeight: 96 }}
                    value={workflow.prompt}
                    onChange={(event) => setField('prompt', event.target.value)}
                    placeholder={
                      workflow.sourceMode === 'niagara-rebuild'
                        ? 'Optional context: readability goals, mobile constraints, which Niagara modules matter mostΓÇª'
                        : 'Describe the effect: timing, mood, colors, motion, and readability goals.'
                    }
                  />
                </div>
                <div>
                  <label style={S.label}>Visual Direction</label>
                  <textarea
                    style={{ ...S.textarea, minHeight: 72 }}
                    value={workflow.visualDirection}
                    onChange={(event) => setField('visualDirection', event.target.value)}
                    placeholder="Readable anime magic, smoky industrial blast, icy shard burst..."
                  />
                </div>
                <div>
                  <label style={S.label}>Gameplay Purpose</label>
                  <textarea
                    style={{ ...S.textarea, minHeight: 72 }}
                    value={workflow.gameplayPurpose}
                    onChange={(event) => setField('gameplayPurpose', event.target.value)}
                    placeholder="What player action or event should this effect communicate?"
                  />
                </div>
                <div>
                  <label style={S.label}>DeepSeek Model</label>
                  <select
                    style={S.input}
                    value={workflow.deepseekModel}
                    onChange={(event) => setField('deepseekModel', event.target.value)}
                  >
                    {DEEPSEEK_MODELS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  style={{ ...S.button, opacity: busy === 'generate' ? 0.7 : 1 }}
                  onClick={generateParticleLogic}
                  disabled={busy === 'generate'}
                >
                  {busy === 'generate'
                    ? 'GeneratingΓÇª'
                    : workflow.sourceMode === 'niagara-rebuild'
                      ? 'Rebuild from Niagara'
                      : 'Generate Particle Logic'}
                </button>
                {progress && (
                  <div style={{ fontSize: 11, color: '#93c5fd', lineHeight: 1.5 }}>
                    {progress.step} {progress.pct ? `(${progress.pct}%)` : ''}
                  </div>
                )}
              </div>
            </div>

            {workflow.sourceMode === 'niagara-rebuild' && (
              <div style={S.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>
                  Niagara Reference
                </div>
                <div style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label style={S.label}>System Type</label>
                    <input
                      style={S.input}
                      value={workflow.unrealSystemType}
                      onChange={(event) => setField('unrealSystemType', event.target.value)}
                      placeholder="Niagara"
                    />
                  </div>
                  <div>
                    <label style={S.label}>Niagara Values / Exported Parameters</label>
                    <textarea
                      style={{ ...S.textarea, minHeight: 110 }}
                      value={workflow.unrealValuesText}
                      onChange={(event) => setField('unrealValuesText', event.target.value)}
                      placeholder="Spawn rate, lifetime, velocity, color over life, curl/noise, module stackΓÇª"
                    />
                  </div>
                  <div>
                    <label style={S.label}>Material / Texture Notes</label>
                    <textarea
                      style={{ ...S.textarea, minHeight: 72 }}
                      value={workflow.unrealMaterialNotes}
                      onChange={(event) => setField('unrealMaterialNotes', event.target.value)}
                      placeholder="Additive, soft glow, masked smoke, flipbook, distortionΓÇª"
                    />
                  </div>
                  <div>
                    <label style={S.label}>Timing Notes</label>
                    <textarea
                      style={{ ...S.textarea, minHeight: 72 }}
                      value={workflow.unrealTimingNotes}
                      onChange={(event) => setField('unrealTimingNotes', event.target.value)}
                      placeholder="0-0.08s flash, 0.12s sparks, 0.3-1.0s smoke decayΓÇª"
                    />
                  </div>
                </div>
              </div>
            )}

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>References</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <button style={S.subtleButton} onClick={attachImage}>
                  <Image size={14} /> Add Image
                </button>
                <button style={S.subtleButton} onClick={attachVideo}>
                  <Video size={14} /> Add Video
                </button>
              </div>
              {workflow.references.length === 0 ? (
                <div style={{ fontSize: 12, color: '#657089' }}>
                  Optional screenshots or clips to guide generation.
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {workflow.references.map((reference) => (
                    <div
                      key={reference.id}
                      style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 10, background: 'rgba(0,0,0,0.15)' }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#eef0f6' }}>{reference.label}</div>
                      <div style={{ fontSize: 10, color: '#6d778c', marginTop: 3 }}>
                        {reference.kind.toUpperCase()} ┬╖ {reference.format || 'FILE'}
                      </div>
                      {previewCache[reference.id] && (
                        <img
                          src={previewCache[reference.id]}
                          alt={reference.label}
                          style={{
                            marginTop: 10,
                            width: '100%',
                            borderRadius: 10,
                            maxHeight: 120,
                            objectFit: 'cover'
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>

        <main style={S.editor}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
              <StatChip label="Layers" value={preset.metrics.layerCount} />
              <StatChip label="Estimated Cost" value={preset.metrics.estimatedCost} accent="#fb7185" />
              <StatChip label="References" value={preset.metrics.referenceCount} accent="#34d399" />
            </div>

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>Preview</div>
              <VfxPreview3D
                preset={preset}
                activeLayerId={workflow.activeLayerId}
                onSelectLayer={(layerId) => setField('activeLayerId', layerId)}
                layerTextureDataUrls={layerTextureDataUrls}
              />
            </div>

            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Particle Layers</div>
                  <div style={{ fontSize: 11, color: '#555b6e', marginTop: 4 }}>
                    Tune generated layers or edit them manually.
                  </div>
                </div>
                <button style={S.subtleButton} onClick={addLayer}>
                  <Plus size={14} /> Add Layer
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {workflow.layers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => setField('activeLayerId', layer.id)}
                    style={{
                      ...S.subtleButton,
                      background:
                        workflow.activeLayerId === layer.id ? 'rgba(96,165,250,0.16)' : 'rgba(255,255,255,0.03)',
                      borderColor: workflow.activeLayerId === layer.id ? '#35507a' : 'rgba(255,255,255,0.06)'
                    }}
                  >
                    {layer.name}
                  </button>
                ))}
              </div>

              {activeLayer ? (
                <div style={{ display: 'grid', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={S.label}>Layer Name</label>
                      <input
                        style={S.input}
                        value={activeLayer.name}
                        onChange={(event) => updateLayer(activeLayer.id, { name: event.target.value })}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Role</label>
                      <input
                        style={S.input}
                        value={activeLayer.role}
                        onChange={(event) => updateLayer(activeLayer.id, { role: event.target.value })}
                      />
                    </div>
                    <LayerSelectField
                      label="Roblox Class"
                      value={activeLayer.robloxClass || 'ParticleEmitter'}
                      options={ROBLOX_CLASS_OPTIONS}
                      onChange={(value) => updateLayer(activeLayer.id, { robloxClass: value })}
                    />
                  </div>

                  <LayerCheckField
                    label="Enabled"
                    checked={activeLayer.enabled !== false}
                    onChange={(value) => updateLayer(activeLayer.id, { enabled: value })}
                  />

                  <LayerSection title="Texture Source">
                    <LayerSelectField
                      label="Visual Identity"
                      value={activeLayer.textureSource || 'shape'}
                      options={TEXTURE_SOURCE_OPTIONS}
                      onChange={(value) => updateLayer(activeLayer.id, { textureSource: value })}
                    />

                    {(activeLayer.textureSource || 'shape') === 'shape' ? (
                      <LayerSelectField
                        label="Procedural Shape"
                        value={activeLayer.shape}
                        options={SHAPE_OPTIONS}
                        onChange={(value) => updateLayer(activeLayer.id, { shape: value })}
                      />
                    ) : (
                      <div style={{ display: 'grid', gap: 10 }}>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button style={S.subtleButton} onClick={() => pickLayerTexture(activeLayer.id)}>
                            Pick Image
                          </button>
                          <button
                            style={S.subtleButton}
                            disabled={Boolean(busy)}
                            onClick={() => generateLayerTextureWithElevenLabs(activeLayer)}
                          >
                            {busy === `elevenlabs-${activeLayer.id}` ? 'GeneratingΓÇª' : 'Generate with ElevenLabs'}
                          </button>
                          {activeLayer.textureImagePath ? (
                            <button style={S.subtleButton} onClick={() => clearLayerTexture(activeLayer.id)}>
                              Clear Image
                            </button>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 11, color: '#657089', lineHeight: 1.5 }}>
                          ElevenLabs Image (Web) builds a sprite prompt from texture hint and visual direction,
                          then tries browser automation or opens Image Studio with the prompt copied.
                        </div>
                        {activeLayer.textureImagePath ? (
                          <>
                            <div style={{ fontSize: 11, color: '#6d778c' }}>
                              {fileNameFromPath(activeLayer.textureImagePath)}
                            </div>
                            {activeLayer.textureDataUrl ? (
                              <img
                                src={activeLayer.textureDataUrl}
                                alt="Layer texture"
                                style={{
                                  width: '100%',
                                  maxHeight: 120,
                                  objectFit: 'contain',
                                  borderRadius: 10,
                                  background: '#0d1016'
                                }}
                              />
                            ) : null}
                          </>
                        ) : (
                          <div style={{ fontSize: 11, color: '#657089' }}>
                            Pick a sprite or flipbook frame. Falls back to procedural shape until loaded.
                          </div>
                        )}
                        {workflow.references.some((reference) => reference.kind === 'image') ? (
                          <LayerSelectField
                            label="Assign Reference"
                            value=""
                            options={[
                              { id: '', label: 'Choose reference imageΓÇª' },
                              ...workflow.references
                                .filter((reference) => reference.kind === 'image')
                                .map((reference) => ({ id: reference.id, label: reference.label }))
                            ]}
                            onChange={(value) => {
                              const reference = workflow.references.find((item) => item.id === value)
                              if (reference) assignReferenceToLayer(activeLayer.id, reference)
                            }}
                          />
                        ) : null}
                      </div>
                    )}
                  </LayerSection>

                  {(activeLayer.robloxClass || 'ParticleEmitter') === 'ParticleEmitter' && (
                    <>
                      <LayerSection title="Emission">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                          <LayerNumField
                            label="Rate"
                            value={activeLayer.rate}
                            min={1}
                            max={120}
                            step={1}
                            onChange={(value) => updateLayer(activeLayer.id, { rate: value })}
                          />
                          <LayerSelectField
                            label="Emission Direction"
                            value={activeLayer.emissionDirection || 'Top'}
                            options={EMISSION_DIRECTION_OPTIONS}
                            onChange={(value) => updateLayer(activeLayer.id, { emissionDirection: value })}
                          />
                          <LayerSelectField
                            label="Emission Shape"
                            value={activeLayer.emissionShape || 'Sphere'}
                            options={EMISSION_SHAPE_OPTIONS}
                            onChange={(value) => updateLayer(activeLayer.id, { emissionShape: value })}
                          />
                          <LayerSelectField
                            label="Shape In/Out"
                            value={activeLayer.shapeInOut || 'Outward'}
                            options={SHAPE_IN_OUT_OPTIONS}
                            onChange={(value) => updateLayer(activeLayer.id, { shapeInOut: value })}
                          />
                          <LayerSelectField
                            label="Shape Style"
                            value={activeLayer.shapeStyle || 'Volume'}
                            options={SHAPE_STYLE_OPTIONS}
                            onChange={(value) => updateLayer(activeLayer.id, { shapeStyle: value })}
                          />
                        </div>
                      </LayerSection>

                      <LayerSection title="Motion">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                          <LayerNumField
                            label="Speed Min"
                            value={activeLayer.speedMin}
                            min={0}
                            max={100}
                            onChange={(value) => updateLayer(activeLayer.id, { speedMin: value })}
                          />
                          <LayerNumField
                            label="Speed Max"
                            value={activeLayer.speedMax}
                            min={0}
                            max={120}
                            onChange={(value) => updateLayer(activeLayer.id, { speedMax: value })}
                          />
                          <LayerNumField
                            label="Spread X"
                            value={activeLayer.spread}
                            min={0}
                            max={180}
                            step={1}
                            onChange={(value) => updateLayer(activeLayer.id, { spread: value })}
                          />
                          <LayerNumField
                            label="Spread Y"
                            value={activeLayer.spreadAngleY ?? activeLayer.spread}
                            min={0}
                            max={180}
                            step={1}
                            onChange={(value) => updateLayer(activeLayer.id, { spreadAngleY: value })}
                          />
                          <LayerNumField
                            label="Drag"
                            value={activeLayer.drag}
                            min={0}
                            max={4}
                            onChange={(value) => updateLayer(activeLayer.id, { drag: value })}
                          />
                          <LayerNumField
                            label="Velocity Inherit"
                            value={activeLayer.velocityInheritance ?? 0}
                            min={0}
                            max={1}
                            onChange={(value) => updateLayer(activeLayer.id, { velocityInheritance: value })}
                          />
                          <LayerNumField
                            label="Accel X"
                            value={activeLayer.accelerationX ?? 0}
                            min={-200}
                            max={200}
                            onChange={(value) => updateLayer(activeLayer.id, { accelerationX: value })}
                          />
                          <LayerNumField
                            label="Accel Y"
                            value={activeLayer.accelerationY ?? 0}
                            min={-200}
                            max={200}
                            onChange={(value) => updateLayer(activeLayer.id, { accelerationY: value })}
                          />
                          <LayerNumField
                            label="Accel Z"
                            value={activeLayer.accelerationZ ?? 0}
                            min={-200}
                            max={200}
                            onChange={(value) => updateLayer(activeLayer.id, { accelerationZ: value })}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                          <LayerCheckField
                            label="Wind Affects Drag"
                            checked={activeLayer.windAffectsDrag ?? false}
                            onChange={(value) => updateLayer(activeLayer.id, { windAffectsDrag: value })}
                          />
                          <LayerCheckField
                            label="Locked To Part"
                            checked={activeLayer.lockedToPart ?? false}
                            onChange={(value) => updateLayer(activeLayer.id, { lockedToPart: value })}
                          />
                        </div>
                      </LayerSection>

                      <LayerSection title="Rotation">
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                          <LayerNumField
                            label="Rotation Min (┬░)"
                            value={activeLayer.rotationMin ?? 0}
                            min={-360}
                            max={360}
                            step={1}
                            onChange={(value) => updateLayer(activeLayer.id, { rotationMin: value })}
                          />
                          <LayerNumField
                            label="Rotation Max (┬░)"
                            value={activeLayer.rotationMax ?? 0}
                            min={-360}
                            max={360}
                            step={1}
                            onChange={(value) => updateLayer(activeLayer.id, { rotationMax: value })}
                          />
                          <LayerSelectField
                            label="Orientation"
                            value={activeLayer.orientation || 'FacingCamera'}
                            options={ORIENTATION_OPTIONS}
                            onChange={(value) => updateLayer(activeLayer.id, { orientation: value })}
                          />
                          <LayerNumField
                            label="Rot Speed Min"
                            value={activeLayer.rotSpeedMin ?? 0}
                            min={-720}
                            max={720}
                            step={1}
                            onChange={(value) => updateLayer(activeLayer.id, { rotSpeedMin: value })}
                          />
                          <LayerNumField
                            label="Rot Speed Max"
                            value={activeLayer.rotSpeedMax ?? 0}
                            min={-720}
                            max={720}
                            step={1}
                            onChange={(value) => updateLayer(activeLayer.id, { rotSpeedMax: value })}
                          />
                        </div>
                      </LayerSection>
                    </>
                  )}

                  {(activeLayer.robloxClass === 'Beam' || activeLayer.robloxClass === 'Trail') && (
                    <LayerSection title={activeLayer.robloxClass === 'Beam' ? 'Beam Properties' : 'Trail Properties'}>
                      {activeLayer.robloxClass === 'Beam' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <LayerNumField
                            label="Width0"
                            value={activeLayer.width0 ?? 0.5}
                            min={0.01}
                            max={10}
                            onChange={(value) => updateLayer(activeLayer.id, { width0: value })}
                          />
                          <LayerNumField
                            label="Width1"
                            value={activeLayer.width1 ?? 0.5}
                            min={0.01}
                            max={10}
                            onChange={(value) => updateLayer(activeLayer.id, { width1: value })}
                          />
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <LayerNumField
                            label="Lifetime Min"
                            value={activeLayer.lifetimeMin}
                            min={0.01}
                            max={5}
                            onChange={(value) => updateLayer(activeLayer.id, { lifetimeMin: value })}
                          />
                          <LayerNumField
                            label="Lifetime Max"
                            value={activeLayer.lifetimeMax}
                            min={0.01}
                            max={6}
                            onChange={(value) => updateLayer(activeLayer.id, { lifetimeMax: value })}
                          />
                        </div>
                      )}
                    </LayerSection>
                  )}

                  <LayerSection title="Appearance">
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                      {(activeLayer.robloxClass || 'ParticleEmitter') === 'ParticleEmitter' && (
                        <>
                          <LayerNumField
                            label="Lifetime Min"
                            value={activeLayer.lifetimeMin}
                            min={0.01}
                            max={5}
                            onChange={(value) => updateLayer(activeLayer.id, { lifetimeMin: value })}
                          />
                          <LayerNumField
                            label="Lifetime Max"
                            value={activeLayer.lifetimeMax}
                            min={0.01}
                            max={6}
                            onChange={(value) => updateLayer(activeLayer.id, { lifetimeMax: value })}
                          />
                        </>
                      )}
                      <LayerNumField
                        label="Light Emission"
                        value={activeLayer.lightEmission ?? 1}
                        min={0}
                        max={1}
                        onChange={(value) => updateLayer(activeLayer.id, { lightEmission: value })}
                      />
                      <LayerNumField
                        label="Light Influence"
                        value={activeLayer.lightInfluence ?? 0}
                        min={0}
                        max={1}
                        onChange={(value) => updateLayer(activeLayer.id, { lightInfluence: value })}
                      />
                      <LayerNumField
                        label="Z Offset"
                        value={activeLayer.zOffset ?? 0}
                        min={-10}
                        max={10}
                        onChange={(value) => updateLayer(activeLayer.id, { zOffset: value })}
                      />
                    </div>

                    <LayerSection title="Sequences" defaultOpen>
                      <SequenceEditor
                        label="Color Sequence (ColorSequence)"
                        kind="color"
                        layer={activeLayer}
                        keypoints={normalizeColorKeypoints(activeLayer.colorKeypoints, activeLayer)}
                        onChange={(changes) => updateLayer(activeLayer.id, changes)}
                      />
                      <SequenceEditor
                        label="Size Sequence (NumberSequence)"
                        kind="size"
                        layer={activeLayer}
                        keypoints={normalizeSizeKeypoints(activeLayer.sizeKeypoints, activeLayer)}
                        onChange={(changes) => updateLayer(activeLayer.id, changes)}
                        valueMin={0.01}
                        valueMax={6}
                        valueStep={0.05}
                        valueLabel="Size (studs)"
                      />
                      <SequenceEditor
                        label="Transparency Sequence (NumberSequence)"
                        kind="transparency"
                        layer={activeLayer}
                        keypoints={normalizeTransparencyKeypoints(
                          activeLayer.transparencyKeypoints,
                          activeLayer
                        )}
                        onChange={(changes) => updateLayer(activeLayer.id, changes)}
                        valueMin={0}
                        valueMax={1}
                        valueStep={0.05}
                        valueLabel="Transparency"
                      />
                    </LayerSection>
                  </LayerSection>

                  <LayerSection title="Flipbook" defaultOpen={false}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                      <LayerSelectField
                        label="Layout"
                        value={activeLayer.flipbookLayout || 'None'}
                        options={FLIPBOOK_LAYOUT_OPTIONS}
                        onChange={(value) => updateLayer(activeLayer.id, { flipbookLayout: value })}
                      />
                      <LayerSelectField
                        label="Mode"
                        value={activeLayer.flipbookMode || 'None'}
                        options={FLIPBOOK_MODE_OPTIONS}
                        onChange={(value) => updateLayer(activeLayer.id, { flipbookMode: value })}
                      />
                      <LayerNumField
                        label="Framerate Min"
                        value={activeLayer.flipbookFramerateMin ?? 1}
                        min={1}
                        max={60}
                        step={1}
                        onChange={(value) => updateLayer(activeLayer.id, { flipbookFramerateMin: value })}
                      />
                      <LayerNumField
                        label="Framerate Max"
                        value={activeLayer.flipbookFramerateMax ?? 1}
                        min={1}
                        max={60}
                        step={1}
                        onChange={(value) => updateLayer(activeLayer.id, { flipbookFramerateMax: value })}
                      />
                    </div>
                    <LayerCheckField
                      label="Flipbook Start Random"
                      checked={activeLayer.flipbookStartRandom ?? false}
                      onChange={(value) => updateLayer(activeLayer.id, { flipbookStartRandom: value })}
                    />
                  </LayerSection>

                  <LayerSection title="Advanced" defaultOpen={false}>
                    <LayerNumField
                      label="Time Scale"
                      value={activeLayer.timeScale ?? 1}
                      min={0.01}
                      max={10}
                      onChange={(value) => updateLayer(activeLayer.id, { timeScale: value })}
                    />
                    <div>
                      <label style={S.label}>Texture Hint</label>
                      <input
                        style={S.input}
                        value={activeLayer.textureHint}
                        onChange={(event) => updateLayer(activeLayer.id, { textureHint: event.target.value })}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Notes</label>
                      <textarea
                        style={{ ...S.textarea, minHeight: 64 }}
                        value={activeLayer.notes || ''}
                        onChange={(event) => updateLayer(activeLayer.id, { notes: event.target.value })}
                        placeholder="Roblox setup notesΓÇª"
                      />
                    </div>
                  </LayerSection>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: '#6d778c' }}>
                      {activeLayer.robloxClass || 'ParticleEmitter'} ┬╖ cost {estimateLayerCost(activeLayer)}
                    </span>
                    <button style={S.subtleButton} onClick={() => removeLayer(activeLayer.id)}>
                      Remove Layer
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#6d778c' }}>Generate or add a layer to begin.</div>
              )}
            </div>
          </div>
        </main>

        <aside style={S.pack}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>Export</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <button style={S.subtleButton} onClick={() => copyText(JSON.stringify(preset, null, 2), 'Preset JSON')}>
                  Copy Preset JSON
                </button>
                <button style={S.subtleButton} onClick={() => copyText(workflowText, 'Workflow summary')}>
                  Copy Workflow Summary
                </button>
              </div>
            </div>

            {workflow.generatedNotes && (
              <div style={S.card}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>AI Notes</div>
                <div style={{ fontSize: 12, color: '#c7d0e2', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {workflow.generatedNotes}
                </div>
              </div>
            )}

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>Preset JSON</div>
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  margin: 0,
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: '#c7d0e2',
                  background: '#0d1016',
                  border: '1px solid #202533',
                  borderRadius: 10,
                  padding: 12,
                  maxHeight: 420,
                  overflowY: 'auto'
                }}
              >
                {JSON.stringify(preset, null, 2)}
              </pre>
            </div>

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 8 }}>Status</div>
              <div style={{ fontSize: 12, color: notice ? '#bfdbfe' : '#6d778c', lineHeight: 1.6 }}>
                {notice || 'Describe the effect, generate particle logic, then export the preset.'}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

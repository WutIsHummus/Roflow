/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import VfxPreview3D from './VfxPreview3D'

let nextReferenceId = 1
let nextLayerId = 1

const SOURCE_MODES = [
  { id: 'hybrid', label: 'Unreal + Ground Up' },
  { id: 'unreal-rebuild', label: 'Unreal Rebuild' },
  { id: 'image-driven', label: 'Ground Up from Images' }
]

const EFFECT_TYPES = [
  { id: 'impact', label: 'Impact Burst' },
  { id: 'projectile', label: 'Projectile Trail' },
  { id: 'aura', label: 'Aura / Buff' },
  { id: 'explosion', label: 'Explosion' },
  { id: 'environment', label: 'Ambient / Environment' }
]

const TARGET_OPTIONS = [
  { id: 'roblox-desktop', label: 'Roblox Desktop' },
  { id: 'roblox-mobile', label: 'Roblox Mobile' },
  { id: 'cross-platform', label: 'Desktop + Mobile' }
]

const PERFORMANCE_OPTIONS = [
  { id: 'low', label: 'Low Cost' },
  { id: 'medium', label: 'Balanced' },
  { id: 'high', label: 'Hero Effect' }
]

const OUTPUT_OPTIONS = [
  { id: 'attachment', label: 'Attachment-based prefab' },
  { id: 'part', label: 'Part-based prefab' },
  { id: 'module-script', label: 'Reusable ModuleScript' }
]

const LAYER_TYPES = [
  { id: 'particle', label: 'Particle' },
  { id: 'beam', label: 'Beam' },
  { id: 'trail', label: 'Trail' },
  { id: 'billboard', label: 'Billboard' },
  { id: 'ring', label: 'Ring' }
]

const SHAPE_OPTIONS = [
  { id: 'orb', label: 'Orb' },
  { id: 'spark', label: 'Spark' },
  { id: 'smoke', label: 'Smoke' },
  { id: 'ring', label: 'Ring' },
  { id: 'slash', label: 'Slash' },
  { id: 'flare', label: 'Flare' }
]

const FLIPBOOK_LAYOUTS = [
  { id: 'None', label: 'None (single frame)' },
  { id: 'Grid2x2', label: 'Grid 2×2 (4 frames)' },
  { id: 'Grid4x4', label: 'Grid 4×4 (16 frames)' },
  { id: 'Grid8x8', label: 'Grid 8×8 (64 frames)' }
]

const FLIPBOOK_MODES = [
  { id: 'None', label: 'None' },
  { id: 'Loop', label: 'Loop' },
  { id: 'PingPong', label: 'Ping-Pong' },
  { id: 'Random', label: 'Random' },
  { id: 'OneShot', label: 'One Shot' }
]

const PROVIDERS = {
  manus: {
    label: 'Manus',
    accent: '#60a5fa',
    note: 'Best for breaking Unreal references into a layered Roblox VFX recipe.'
  },
  'chatgpt-image': {
    label: 'ChatGPT Image',
    accent: '#34d399',
    note: 'Best for generating particle sprites, flipbooks, and polish passes from prompts.'
  }
}

function createReference(overrides = {}) {
  return {
    id: `vfx-ref-${nextReferenceId++}`,
    kind: 'image',
    label: '',
    filePath: '',
    format: '',
    textSnippet: '',
    ...overrides
  }
}

function createLayer(overrides = {}) {
  return {
    id: `vfx-layer-${nextLayerId++}`,
    name: 'Main Flash',
    layerType: 'particle',
    role: 'main hit flash',
    shape: 'orb',
    enabled: true,
    lightEmission: 1,
    lightInfluence: 0,
    textureHint: 'soft additive orb sprite',
    color: '#a78bfa',
    secondaryColor: '#f8fafc',
    opacity: 0.8,
    sizeMin: 0.35,
    sizeMax: 1.3,
    lifetimeMin: 0.15,
    lifetimeMax: 0.75,
    rate: 28,
    speedMin: 6,
    speedMax: 18,
    spread: 18,
    drag: 0.12,
    flipbookLayout: 'None',
    flipbookMode: 'None',
    notes: '',
    ...overrides
  }
}

function createStarterLayers(effectType) {
  if (effectType === 'aura') {
    return [
      createLayer({
        name: 'Main Aura Glow',
        role: 'main aura body',
        layerType: 'billboard',
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
        role: 'small bright accents',
        layerType: 'particle',
        shape: 'spark',
        color: '#f472b6',
        secondaryColor: '#ffffff',
        sizeMin: 0.1,
        sizeMax: 0.45,
        lifetimeMin: 0.2,
        lifetimeMax: 0.8,
        rate: 18,
        speedMin: 3,
        speedMax: 8,
        spread: 55
      }),
      createLayer({
        name: 'Soft Motion Streak',
        role: 'soft follow-through',
        layerType: 'trail',
        shape: 'smoke',
        color: '#818cf8',
        secondaryColor: '#e0e7ff',
        sizeMin: 0.25,
        sizeMax: 0.8,
        lifetimeMin: 0.35,
        lifetimeMax: 1.2,
        rate: 10,
        speedMin: 1,
        speedMax: 4,
        spread: 35
      })
    ]
  }

  if (effectType === 'projectile') {
    return [
      createLayer({
        name: 'Main Projectile Streak',
        role: 'main travel streak',
        layerType: 'beam',
        shape: 'slash',
        color: '#38bdf8',
        secondaryColor: '#f8fafc',
        sizeMin: 0.18,
        sizeMax: 0.4,
        lifetimeMin: 0.1,
        lifetimeMax: 0.35,
        rate: 12,
        speedMin: 18,
        speedMax: 32,
        spread: 8
      }),
      createLayer({
        name: 'Impact Wave',
        role: 'impact shock ring',
        layerType: 'ring',
        shape: 'ring',
        color: '#67e8f9',
        secondaryColor: '#ffffff',
        sizeMin: 0.8,
        sizeMax: 1.8,
        lifetimeMin: 0.08,
        lifetimeMax: 0.25,
        rate: 6,
        speedMin: 0,
        speedMax: 4,
        spread: 0
      }),
      createLayer({
        name: 'Trailing Debris',
        role: 'fast secondary debris',
        layerType: 'particle',
        shape: 'spark',
        color: '#fb7185',
        secondaryColor: '#fef3c7',
        sizeMin: 0.08,
        sizeMax: 0.28,
        lifetimeMin: 0.1,
        lifetimeMax: 0.45,
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
      role: 'main hit flash',
      layerType: 'particle',
      shape: 'flare',
      color: '#f59e0b',
      secondaryColor: '#fff7ed',
      sizeMin: 0.4,
      sizeMax: 1.4,
      lifetimeMin: 0.08,
      lifetimeMax: 0.35,
      rate: 30,
      speedMin: 8,
      speedMax: 20,
      spread: 20
    }),
    createLayer({
      name: 'Fast Debris',
      role: 'fast bright debris',
      layerType: 'particle',
      shape: 'spark',
      color: '#fb7185',
      secondaryColor: '#fef08a',
      sizeMin: 0.08,
      sizeMax: 0.35,
      lifetimeMin: 0.1,
      lifetimeMax: 0.55,
      rate: 24,
      speedMin: 12,
      speedMax: 26,
      spread: 42
    }),
    createLayer({
      name: 'Soft Smoke Fade',
      role: 'soft lingering fade',
      layerType: 'particle',
      shape: 'smoke',
      color: '#94a3b8',
      secondaryColor: '#e2e8f0',
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
    projectName: '',
    effectName: 'Arcane Burst',
    sourceMode: 'hybrid',
    effectType: 'impact',
    targetPlatform: 'cross-platform',
    performanceTarget: 'medium',
    outputMode: 'module-script',
    aiProvider: 'manus',
    gameplayPurpose: 'Ability impact burst with a magical hit confirm.',
    visualDirection: 'Stylized anime magic with readable silhouettes and soft additive energy.',
    implementationNotes:
      'Keep it readable on Roblox camera distances and avoid expensive overdraw for mobile.',
    unrealSystemType: 'Niagara',
    unrealValuesText: '',
    unrealMaterialNotes: '',
    unrealTimingNotes: '',
    activeLayerId: layers[0]?.id || null,
    references: [],
    layers,
    ...overrides
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
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

function isTextLikeAsset(filePath) {
  return ['json', 'txt', 'csv', 'ini'].includes(extensionFromPath(filePath))
}

function hexToRgb(hex) {
  const clean = String(hex || '#ffffff').replace('#', '')
  const normalized = clean.length === 3 ? clean.split('').map((char) => char + char).join('') : clean
  const value = Number.parseInt(normalized.padEnd(6, 'f').slice(0, 6), 16)
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255
  }
}

function estimateLayerCost(layer) {
  const multiplier =
    layer.layerType === 'beam'
      ? 1.4
      : layer.layerType === 'trail'
        ? 1.15
        : layer.layerType === 'billboard'
          ? 1.25
          : layer.layerType === 'ring'
            ? 1.1
            : 1
  return Math.round((layer.rate + layer.sizeMax * 12 + layer.speedMax * 0.8) * multiplier)
}

function buildPromptPack(workflow, preset) {
  const references = workflow.references
    .map((reference, index) => {
      const suffix = reference.textSnippet ? `\nSnippet: ${reference.textSnippet.slice(0, 240)}` : ''
      return `${index + 1}. ${reference.kind.toUpperCase()} — ${reference.label || 'Untitled reference'}${suffix}`
    })
    .join('\n')

  const layerSummary = workflow.layers
    .filter((layer) => layer.enabled)
    .map(
      (layer, index) =>
        `${index + 1}. ${layer.name} (${layer.layerType})\nRole: ${layer.role}\nTexture: ${
          layer.textureHint
        }\nMotion: rate ${layer.rate}, speed ${layer.speedMin}-${layer.speedMax}, spread ${layer.spread}\nColor: ${
          layer.color
        } -> ${layer.secondaryColor}`
    )
    .join('\n\n')

  const overview = [
    workflow.projectName ? `Project: ${workflow.projectName}` : null,
    `Effect: ${workflow.effectName}`,
    `Mode: ${workflow.sourceMode}`,
    `Type: ${workflow.effectType}`,
    `Target: ${workflow.targetPlatform}`,
    `Performance target: ${workflow.performanceTarget}`,
    workflow.gameplayPurpose ? `Gameplay purpose: ${workflow.gameplayPurpose}` : null,
    workflow.visualDirection ? `Visual direction: ${workflow.visualDirection}` : null,
    workflow.implementationNotes ? `Implementation notes: ${workflow.implementationNotes}` : null
  ]
    .filter(Boolean)
    .join('\n')

  const analysisPrompt = [
    'Break down this Unreal-inspired VFX into a Roblox-ready layered effect recipe.',
    '',
    overview,
    '',
    `Unreal system type: ${workflow.unrealSystemType || 'Not specified'}`,
    workflow.unrealValuesText ? `Niagara values / notes:\n${workflow.unrealValuesText}` : 'Niagara values: not provided',
    workflow.unrealMaterialNotes
      ? `Material notes:\n${workflow.unrealMaterialNotes}`
      : 'Material notes: not provided',
    workflow.unrealTimingNotes ? `Timing notes:\n${workflow.unrealTimingNotes}` : 'Timing notes: not provided',
    '',
    'Reference inputs:',
    references || 'No references attached yet.',
    '',
    'Return:',
    '- Main effect parts to rebuild in Roblox',
    '- Required sprite / flipbook assets',
    '- Timing beats and layer sequencing',
    '- Roblox approximations for anything Niagara-specific',
    '- Performance adjustments for desktop and mobile'
  ].join('\n')

  const texturePrompt = [
    'Create Roblox-friendly particle textures or flipbook frames for this effect.',
    '',
    overview,
    '',
    `Desired texture direction: ${workflow.visualDirection || 'Stylized readable VFX'}`,
    '',
    'Effect part breakdown:',
    layerSummary || 'No effect parts defined yet.',
    '',
    'Output should favor high readability, clean alpha edges, and additive-friendly shapes.'
  ].join('\n')

  const handoffPrompt = [
    'Generate a Roblox VFX implementation recipe for ParticleEmitter, Beam, Trail, and BillboardGui.',
    '',
    overview,
    '',
    'Use this normalized preset:',
    JSON.stringify(preset, null, 2),
    '',
    'Return implementation notes, tuning advice, and any extra effect parts that would improve the effect.'
  ].join('\n')

  return {
    analysisPrompt,
    texturePrompt,
    handoffPrompt,
    exportText: [
      `Roblox VFX Workflow — ${workflow.effectName}`,
      '',
      overview,
      '',
      'Analysis Prompt',
      analysisPrompt,
      '',
      'Texture Prompt',
      texturePrompt,
      '',
      'Roblox Handoff Prompt',
      handoffPrompt
    ].join('\n')
  }
}

function buildPreset(workflow) {
  const performanceScale =
    workflow.performanceTarget === 'low'
      ? 0.72
      : workflow.performanceTarget === 'high'
        ? 1.2
        : 1

  const layers = workflow.layers
    .filter((layer) => layer.enabled)
    .map((layer) => {
      const sizeMin = Math.min(layer.sizeMin, layer.sizeMax)
      const sizeMax = Math.max(layer.sizeMin, layer.sizeMax)
      const lifetimeMin = Math.min(layer.lifetimeMin, layer.lifetimeMax)
      const lifetimeMax = Math.max(layer.lifetimeMin, layer.lifetimeMax)
      const speedMin = Math.min(layer.speedMin, layer.speedMax)
      const speedMax = Math.max(layer.speedMin, layer.speedMax)
      const className =
        layer.layerType === 'beam'
          ? 'Beam'
          : layer.layerType === 'trail'
            ? 'Trail'
            : layer.layerType === 'billboard'
              ? 'BillboardGui'
              : 'ParticleEmitter'

      return {
        id: layer.id,
        name: layer.name,
        className,
        layerType: layer.layerType,
        role: layer.role,
        shape: layer.shape,
        textureHint: layer.textureHint,
        lightEmission: clamp(layer.lightEmission ?? 1, 0, 1),
        lightInfluence: clamp(layer.lightInfluence ?? 0, 0, 1),
        color: {
          primary: layer.color,
          secondary: layer.secondaryColor
        },
        opacity: layer.opacity,
        size: {
          min: Number(sizeMin.toFixed(2)),
          max: Number(sizeMax.toFixed(2))
        },
        lifetime: {
          min: Number(lifetimeMin.toFixed(2)),
          max: Number(lifetimeMax.toFixed(2))
        },
        rate: Math.max(1, Math.round(layer.rate * performanceScale)),
        speed: {
          min: Number(speedMin.toFixed(2)),
          max: Number(speedMax.toFixed(2))
        },
        spread: Math.round(layer.spread),
        drag: Number(layer.drag.toFixed(2)),
        flipbookLayout: layer.flipbookLayout || 'None',
        flipbookMode: layer.flipbookMode || 'None',
        notes: layer.notes || ''
      }
    })

  const totalCost = layers.reduce((sum, layer) => sum + estimateLayerCost(layer), 0)
  const mobileHint =
    totalCost > 140
      ? 'Reduce rate or remove one additive layer for mobile.'
      : totalCost > 90
        ? 'Balanced. Consider a lighter billboard or fewer smoke particles on low-end devices.'
        : 'Safe for most Roblox mobile scenes.'

  return {
    meta: {
      effectName: workflow.effectName,
      projectName: workflow.projectName,
      sourceMode: workflow.sourceMode,
      effectType: workflow.effectType,
      targetPlatform: workflow.targetPlatform,
      performanceTarget: workflow.performanceTarget,
      outputMode: workflow.outputMode
    },
    unrealSource: {
      systemType: workflow.unrealSystemType,
      niagaraValues: workflow.unrealValuesText,
      materialNotes: workflow.unrealMaterialNotes,
      timingNotes: workflow.unrealTimingNotes
    },
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
      estimatedCost: totalCost,
      mobileHint
    }
  }
}

function buildNumberSequence(opacity) {
  const visible = clamp(1 - opacity, 0, 1)
  return `NumberSequence.new({
    NumberSequenceKeypoint.new(0, ${visible.toFixed(2)}),
    NumberSequenceKeypoint.new(0.6, ${(visible + 0.15).toFixed(2)}),
    NumberSequenceKeypoint.new(1, 1)
  })`
}

function buildSizeSequence(min, max) {
  return `NumberSequence.new({
    NumberSequenceKeypoint.new(0, ${min.toFixed(2)}),
    NumberSequenceKeypoint.new(1, ${max.toFixed(2)})
  })`
}

function buildColorSequence(primary, secondary) {
  const start = hexToRgb(primary)
  const finish = hexToRgb(secondary)
  return `ColorSequence.new({
    ColorSequenceKeypoint.new(0, Color3.fromRGB(${start.r}, ${start.g}, ${start.b})),
    ColorSequenceKeypoint.new(1, Color3.fromRGB(${finish.r}, ${finish.g}, ${finish.b}))
  })`
}

function buildLuaScript(preset) {
  const effectStem = String(preset.meta.effectName || 'RobloxVFX').replace(/[^a-zA-Z0-9]+/g, '')
  const layers = preset.layers
    .map((layer, index) => {
      const baseName = `${effectStem}${index + 1}`
      if (layer.className === 'Beam') {
        return [
          `  local ${baseName}Start = Instance.new("Attachment")`,
          `  ${baseName}Start.Name = "${layer.name.replace(/"/g, "'")}Start"`,
          `  ${baseName}Start.Position = Vector3.new(-1.2, 0, 0)`,
          `  ${baseName}Start.Parent = holder`,
          `  local ${baseName}End = Instance.new("Attachment")`,
          `  ${baseName}End.Name = "${layer.name.replace(/"/g, "'")}End"`,
          `  ${baseName}End.Position = Vector3.new(1.2, 0, 0)`,
          `  ${baseName}End.Parent = holder`,
          `  local ${baseName} = Instance.new("Beam")`,
          `  ${baseName}.Name = "${layer.name.replace(/"/g, "'")}"`,
          `  ${baseName}.Attachment0 = ${baseName}Start`,
          `  ${baseName}.Attachment1 = ${baseName}End`,
          `  ${baseName}.FaceCamera = true`,
          `  ${baseName}.LightEmission = ${layer.lightEmission.toFixed(2)}`,
          `  ${baseName}.LightInfluence = ${layer.lightInfluence.toFixed(2)}`,
          `  ${baseName}.Color = ${buildColorSequence(layer.color.primary, layer.color.secondary)}`,
          `  ${baseName}.Transparency = ${buildNumberSequence(layer.opacity)}`,
          `  ${baseName}.Width0 = ${layer.size.min.toFixed(2)}`,
          `  ${baseName}.Width1 = ${layer.size.max.toFixed(2)}`,
          `  ${baseName}.Parent = folder`,
          ''
        ].join('\n')
      }

      if (layer.className === 'Trail') {
        return [
          `  local ${baseName}Start = Instance.new("Attachment")`,
          `  ${baseName}Start.Name = "${layer.name.replace(/"/g, "'")}Start"`,
          `  ${baseName}Start.Position = Vector3.new(-0.65, 0.4, 0)`,
          `  ${baseName}Start.Parent = holder`,
          `  local ${baseName}End = Instance.new("Attachment")`,
          `  ${baseName}End.Name = "${layer.name.replace(/"/g, "'")}End"`,
          `  ${baseName}End.Position = Vector3.new(0.65, -0.4, 0)`,
          `  ${baseName}End.Parent = holder`,
          `  local ${baseName} = Instance.new("Trail")`,
          `  ${baseName}.Name = "${layer.name.replace(/"/g, "'")}"`,
          `  ${baseName}.Attachment0 = ${baseName}Start`,
          `  ${baseName}.Attachment1 = ${baseName}End`,
          `  ${baseName}.FaceCamera = true`,
          `  ${baseName}.Lifetime = ${layer.lifetime.max.toFixed(2)}`,
          `  ${baseName}.LightEmission = ${layer.lightEmission.toFixed(2)}`,
          `  ${baseName}.LightInfluence = ${layer.lightInfluence.toFixed(2)}`,
          `  ${baseName}.Color = ${buildColorSequence(layer.color.primary, layer.color.secondary)}`,
          `  ${baseName}.Transparency = ${buildNumberSequence(layer.opacity)}`,
          `  ${baseName}.MinLength = 0.05`,
          `  ${baseName}.Parent = folder`,
          ''
        ].join('\n')
      }

      if (layer.className === 'BillboardGui') {
        const primary = hexToRgb(layer.color.primary)
        return [
          `  local ${baseName} = Instance.new("BillboardGui")`,
          `  ${baseName}.Name = "${layer.name.replace(/"/g, "'")}"`,
          `  ${baseName}.Size = UDim2.fromOffset(${Math.round(layer.size.max * 96)}, ${Math.round(
            layer.size.max * 96
          )})`,
          `  ${baseName}.AlwaysOnTop = true`,
          `  ${baseName}.StudsOffset = Vector3.new(0, 1.1, 0)`,
          `  ${baseName}.Parent = folder`,
          `  local ${baseName}Frame = Instance.new("Frame")`,
          `  ${baseName}Frame.BackgroundColor3 = Color3.fromRGB(${primary.r}, ${primary.g}, ${primary.b})`,
          `  ${baseName}Frame.BackgroundTransparency = ${(1 - layer.opacity).toFixed(2)}`,
          `  ${baseName}Frame.BorderSizePixel = 0`,
          `  ${baseName}Frame.Size = UDim2.fromScale(1, 1)`,
          `  ${baseName}Frame.Parent = ${baseName}`,
          ''
        ].join('\n')
      }

      return [
        `  local ${baseName} = Instance.new("ParticleEmitter")`,
        `  ${baseName}.Name = "${layer.name.replace(/"/g, "'")}"`,
        `  ${baseName}.Rate = ${layer.rate}`,
        `  ${baseName}.Lifetime = NumberRange.new(${layer.lifetime.min.toFixed(2)}, ${layer.lifetime.max.toFixed(
          2
        )})`,
        `  ${baseName}.Speed = NumberRange.new(${layer.speed.min.toFixed(2)}, ${layer.speed.max.toFixed(2)})`,
        `  ${baseName}.SpreadAngle = Vector2.new(${layer.spread}, ${layer.spread})`,
        `  ${baseName}.Drag = ${layer.drag.toFixed(2)}`,
        `  ${baseName}.LightEmission = ${layer.lightEmission.toFixed(2)}`,
        `  ${baseName}.LightInfluence = ${layer.lightInfluence.toFixed(2)}`,
        `  ${baseName}.Color = ${buildColorSequence(layer.color.primary, layer.color.secondary)}`,
        `  ${baseName}.Transparency = ${buildNumberSequence(layer.opacity)}`,
        `  ${baseName}.Size = ${buildSizeSequence(layer.size.min, layer.size.max)}`,
        layer.flipbookLayout !== 'None'
          ? `  ${baseName}.FlipbookLayout = Enum.ParticleFlipbookLayout.${layer.flipbookLayout}`
          : null,
        layer.flipbookMode !== 'None'
          ? `  ${baseName}.FlipbookMode = Enum.ParticleFlipbookMode.${layer.flipbookMode}`
          : null,
        `  ${baseName}.Parent = anchor`,
        ''
      ].filter(Boolean).join('\n')
    })
    .join('\n')

  return [
    '-- Roblox VFX prefab generated by AI Game Dev Hub',
    '-- Replace placeholder textures with uploaded assets or sprite sheets as needed.',
    '',
    'local VFX = {}',
    '',
    'function VFX.build(parent)',
    '  local folder = Instance.new("Folder")',
    `  folder.Name = "${preset.meta.effectName.replace(/"/g, "'")}VFX"`,
    '  folder.Parent = parent',
    '',
    '  local holder = parent',
    '  if parent:IsA("BasePart") then',
    '    holder = parent',
    '  end',
    '',
    '  local anchor = Instance.new("Attachment")',
    `  anchor.Name = "${preset.meta.effectName.replace(/"/g, "'")}Anchor"`,
    '  anchor.Parent = holder',
    '',
    layers,
    '  return { folder = folder, anchor = anchor }',
    'end',
    '',
    'return VFX'
  ].join('\n')
}

function buildWorkflowSummary(workflow, promptPack) {
  return [
    `Effect: ${workflow.effectName}`,
    `Mode: ${workflow.sourceMode}`,
    `Type: ${workflow.effectType}`,
    `Performance: ${workflow.performanceTarget}`,
    `References: ${workflow.references.length}`,
    '',
    'Gameplay Purpose',
    workflow.gameplayPurpose || 'Not provided',
    '',
    'Visual Direction',
    workflow.visualDirection || 'Not provided',
    '',
    'Implementation Notes',
    workflow.implementationNotes || 'Not provided',
    '',
    'Unreal Notes',
    workflow.unrealValuesText || 'No Niagara values attached yet.',
    '',
    'Export Prompts',
    promptPack.exportText
  ].join('\n')
}

const S = {
  page: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1116' },
  header: { padding: '20px 24px 0', borderBottom: '1px solid #1e2330', flexShrink: 0 },
  title: { fontSize: 18, fontWeight: 700, color: '#eef0f6', margin: 0 },
  subtitle: { fontSize: 13, color: '#555b6e', marginTop: 4, lineHeight: 1.6 },
  body: { flex: 1, display: 'flex', minHeight: 0 },
  rail: { width: 320, borderRight: '1px solid #1e2330', overflowY: 'auto', padding: 20 },
  editor: { flex: 1, minWidth: 0, overflowY: 'auto', padding: 24 },
  pack: { width: 380, borderLeft: '1px solid #1e2330', overflowY: 'auto', padding: 20 },
  card: {
    background: '#141821',
    border: '1px solid #202533',
    borderRadius: 12,
    padding: 14
  },
  input: {
    width: '100%',
    background: '#0d0f14',
    border: '1px solid #252a36',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    color: '#eef0f6',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  },
  textarea: {
    width: '100%',
    background: '#0d0f14',
    border: '1px solid #252a36',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    color: '#eef0f6',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical'
  },
  label: { fontSize: 11, fontWeight: 600, color: '#8f96a8', marginBottom: 6, display: 'block' },
  button: {
    background: '#1d4ed8',
    color: '#eff6ff',
    border: 'none',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer'
  },
  subtleButton: {
    background: '#171b25',
    color: '#d7deee',
    border: '1px solid #2b3240',
    borderRadius: 10,
    padding: '8px 11px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer'
  }
}

function StatChip({ label, value, accent = '#a78bfa' }) {
  return (
    <div
      style={{
        ...S.card,
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0
      }}
    >
      <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#555b6e' }}>
        {label}
      </span>
      <span style={{ fontSize: 15, fontWeight: 700, color: accent }}>{value}</span>
    </div>
  )
}

export default function VFXModule({ workflowState, setWorkflowState }) {
  const [workflow, setWorkflow] = useState(() => workflowState?.vfxWorkflow || createDefaultWorkflow())
  const [previewCache, setPreviewCache] = useState({})
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!setWorkflowState) return
    setWorkflowState((prev) => ({ ...prev, vfxWorkflow: workflow }))
  }, [setWorkflowState, workflow])

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

  const activeLayer = workflow.layers.find((layer) => layer.id === workflow.activeLayerId) || workflow.layers[0] || null
  const preset = useMemo(() => buildPreset(workflow), [workflow])
  const promptPack = useMemo(() => buildPromptPack(workflow, preset), [preset, workflow])
  const luaScript = useMemo(() => buildLuaScript(preset), [preset])
  const workflowText = useMemo(() => buildWorkflowSummary(workflow, promptPack), [promptPack, workflow])

  const referenceCounts = useMemo(() => {
    return workflow.references.reduce(
      (acc, reference) => {
        acc[reference.kind] += 1
        return acc
      },
      { image: 0, video: 0, asset: 0 }
    )
  }, [workflow.references])

  const setField = useCallback((key, value) => {
    setWorkflow((prev) => ({ ...prev, [key]: value }))
  }, [])

  const updateLayer = useCallback((layerId, changes) => {
    setWorkflow((prev) => ({
      ...prev,
      layers: prev.layers.map((layer) => (layer.id === layerId ? { ...layer, ...changes } : layer))
    }))
  }, [])

  const addLayer = useCallback(() => {
    const template = createLayer({
      name: 'Extra Effect Part',
      role: 'secondary visual detail',
      color: '#38bdf8',
      secondaryColor: '#ffffff'
    })
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
    setNotice('Starter effect parts refreshed for the selected effect type.')
  }, [workflow.effectType])

  const removeReference = useCallback((referenceId) => {
    setWorkflow((prev) => ({
      ...prev,
      references: prev.references.filter((reference) => reference.id !== referenceId)
    }))
    setPreviewCache((prev) => {
      const next = { ...prev }
      delete next[referenceId]
      return next
    })
  }, [])

  const attachReferenceFiles = useCallback(async (filePaths) => {
    if (!filePaths?.length) return
    setBusy('references')

    const builtReferences = []
    for (const filePath of filePaths) {
      const kind = inferReferenceKind(filePath)
      const reference = createReference({
        kind,
        filePath,
        label: fileNameFromPath(filePath),
        format: extensionFromPath(filePath).toUpperCase()
      })

      if (isTextLikeAsset(filePath)) {
        const textResult = await window.api.readTextFile({ filePath })
        if (textResult?.success) {
          reference.textSnippet = String(textResult.text || '').slice(0, 1200)
        }
      }

      if (isPreviewableImage(filePath)) {
        const previewResult = await window.api.readFileAsDataURL({ filePath })
        if (previewResult?.success) {
          setPreviewCache((prev) => ({ ...prev, [reference.id]: previewResult.dataUrl }))
        }
      }

      builtReferences.push(reference)
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

  const attachLooseAssets = useCallback(async () => {
    const filePaths = await window.api.openVfxAssetFiles()
    if (!filePaths?.length) return
    await attachReferenceFiles(filePaths)
  }, [attachReferenceFiles])

  const copyText = useCallback(async (text, label) => {
    const result = await window.api.copyText(text)
    if (!result?.success) {
      setNotice(result?.error || `Could not copy ${label}.`)
      return
    }
    setNotice(`${label} copied.`)
  }, [])

  const exportPackage = useCallback(async () => {
    const folderPath = await window.api.saveFolder({ title: 'Export Roblox VFX Package' })
    if (!folderPath) return

    const result = await window.api.exportVfxPackage({
      folderPath,
      effectName: workflow.effectName,
      preset,
      luaScript,
      workflowText
    })

    if (!result?.success) {
      setNotice(result?.error || 'Could not export the VFX package.')
      return
    }

    setNotice('VFX package exported.')
    if (result.files?.luaPath) {
      window.api.openPath(result.files.luaPath)
    }
  }, [luaScript, preset, workflow.effectName, workflowText])

  const provider = PROVIDERS[workflow.aiProvider] || PROVIDERS.manus

  return (
    <div style={S.page}>
      <div style={S.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'flex-start' }}>
          <div>
            <h1 style={S.title}>VFX Workflow Studio</h1>
            <p style={S.subtitle}>
              Build Roblox-ready particle workflows from Unreal references, loose Niagara notes, or ground-up particle
              images. The preview is Roblox-native, and exports are Lua + preset JSON + workflow handoff.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={S.subtleButton} onClick={resetStarterLayers}>
              Refresh Starter Effect Parts
            </button>
            <button style={S.button} onClick={exportPackage}>
              Export Package
            </button>
          </div>
        </div>
      </div>

      <div style={S.body}>
        <aside style={S.rail}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Workflow Brief</div>
                  <div style={{ fontSize: 11, color: '#555b6e', marginTop: 4 }}>
                    Define the effect before tuning the main effect parts.
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '3px 7px',
                    borderRadius: 999,
                    background: '#1e2330',
                    color: '#93c5fd'
                  }}
                >
                  {provider.label}
                </span>
              </div>

              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={S.label}>Project Name</label>
                  <input
                    style={S.input}
                    value={workflow.projectName}
                    onChange={(event) => setField('projectName', event.target.value)}
                    placeholder="Spellbound Arena"
                  />
                </div>
                <div>
                  <label style={S.label}>Effect Name</label>
                  <input
                    style={S.input}
                    value={workflow.effectName}
                    onChange={(event) => setField('effectName', event.target.value)}
                    placeholder="Arcane Burst"
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div>
                    <label style={S.label}>Target</label>
                    <select
                      style={S.input}
                      value={workflow.targetPlatform}
                      onChange={(event) => setField('targetPlatform', event.target.value)}
                    >
                      {TARGET_OPTIONS.map((option) => (
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
                  <label style={S.label}>Roblox Output Mode</label>
                  <select
                    style={S.input}
                    value={workflow.outputMode}
                    onChange={(event) => setField('outputMode', event.target.value)}
                  >
                    {OUTPUT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={S.label}>Gameplay Purpose</label>
                  <textarea
                    style={{ ...S.textarea, minHeight: 72 }}
                    value={workflow.gameplayPurpose}
                    onChange={(event) => setField('gameplayPurpose', event.target.value)}
                    placeholder="What player action or event does this effect sell?"
                  />
                </div>

                <div>
                  <label style={S.label}>Visual Direction</label>
                  <textarea
                    style={{ ...S.textarea, minHeight: 78 }}
                    value={workflow.visualDirection}
                    onChange={(event) => setField('visualDirection', event.target.value)}
                    placeholder="Readable anime magic, smoky industrial blast, icy shard burst..."
                  />
                </div>

                <div>
                  <label style={S.label}>Implementation Notes</label>
                  <textarea
                    style={{ ...S.textarea, minHeight: 78 }}
                    value={workflow.implementationNotes}
                    onChange={(event) => setField('implementationNotes', event.target.value)}
                    placeholder="Constraints, platform notes, shader limitations, gameplay readability..."
                  />
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Reference Intake</div>
                  <div style={{ fontSize: 11, color: '#555b6e', marginTop: 4 }}>
                    Images, clips, text exports, Niagara notes, or loose Unreal asset files.
                  </div>
                </div>
                {busy === 'references' && <span style={{ fontSize: 11, color: '#93c5fd' }}>Loading...</span>}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <button style={S.subtleButton} onClick={attachImage}>
                  Add Image
                </button>
                <button style={S.subtleButton} onClick={attachVideo}>
                  Add Video
                </button>
                <button style={S.subtleButton} onClick={attachLooseAssets}>
                  Add UE / Loose Assets
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
                <StatChip label="Images" value={referenceCounts.image} accent="#34d399" />
                <StatChip label="Videos" value={referenceCounts.video} accent="#60a5fa" />
                <StatChip label="Assets" value={referenceCounts.asset} accent="#f59e0b" />
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {workflow.references.length === 0 && (
                  <div
                    style={{
                      border: '1px dashed #2b3240',
                      borderRadius: 12,
                      padding: 14,
                      fontSize: 12,
                      color: '#657089'
                    }}
                  >
                    Attach screenshots, particle PNGs, MP4 captures, copied Niagara values, or `.uasset` references.
                  </div>
                )}

                {workflow.references.map((reference) => (
                  <div
                    key={reference.id}
                    style={{
                      border: '1px solid #222938',
                      borderRadius: 12,
                      padding: 10,
                      background: '#10141c'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#eef0f6' }}>{reference.label}</div>
                        <div style={{ fontSize: 10, color: '#6d778c', marginTop: 3 }}>
                          {reference.kind.toUpperCase()} · {reference.format || 'FILE'}
                        </div>
                      </div>
                      <button style={S.subtleButton} onClick={() => removeReference(reference.id)}>
                        Remove
                      </button>
                    </div>
                    {previewCache[reference.id] && (
                      <img
                        src={previewCache[reference.id]}
                        alt={reference.label}
                        style={{
                          marginTop: 10,
                          width: '100%',
                          borderRadius: 10,
                          maxHeight: 140,
                          objectFit: 'cover',
                          border: '1px solid #202533'
                        }}
                      />
                    )}
                    {!previewCache[reference.id] && reference.kind === 'video' && (
                      <div
                        style={{
                          marginTop: 10,
                          borderRadius: 10,
                          border: '1px solid #202533',
                          background: '#0c1016',
                          padding: 12,
                          fontSize: 12,
                          color: '#7f8aa1'
                        }}
                      >
                        Video reference attached. Use it as timing and shape reference for layer tuning.
                      </div>
                    )}
                    {reference.textSnippet && (
                      <pre
                        style={{
                          marginTop: 10,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          background: '#0c1016',
                          border: '1px solid #202533',
                          borderRadius: 10,
                          padding: 10,
                          fontSize: 11,
                          lineHeight: 1.55,
                          color: '#c7d0e2',
                          maxHeight: 150,
                          overflowY: 'auto'
                        }}
                      >
                        {reference.textSnippet}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>Unreal Notes</div>
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
                    style={{ ...S.textarea, minHeight: 100 }}
                    value={workflow.unrealValuesText}
                    onChange={(event) => setField('unrealValuesText', event.target.value)}
                    placeholder="Spawn rate, lifetime, velocity, color over life, curl/noise notes..."
                  />
                </div>
                <div>
                  <label style={S.label}>Material / Texture Notes</label>
                  <textarea
                    style={{ ...S.textarea, minHeight: 82 }}
                    value={workflow.unrealMaterialNotes}
                    onChange={(event) => setField('unrealMaterialNotes', event.target.value)}
                    placeholder="Additive, soft glow, masked smoke, flipbook, distortion, etc."
                  />
                </div>
                <div>
                  <label style={S.label}>Timing Notes</label>
                  <textarea
                    style={{ ...S.textarea, minHeight: 72 }}
                    value={workflow.unrealTimingNotes}
                    onChange={(event) => setField('unrealTimingNotes', event.target.value)}
                    placeholder="0-0.08s flash, 0.12s sparks, 0.3-1.0s smoke decay..."
                  />
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main style={S.editor}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
              <StatChip label="Effect Parts" value={preset.metrics.layerCount} />
              <StatChip label="Estimated Cost" value={preset.metrics.estimatedCost} accent="#fb7185" />
              <StatChip label="References" value={preset.metrics.referenceCount} accent="#34d399" />
              <StatChip label="Provider" value={provider.label} accent={provider.accent} />
            </div>

            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Roblox Preview</div>
                  <div style={{ fontSize: 11, color: '#555b6e', marginTop: 4 }}>
                    Preview the stacked effect parts as Roblox-style emitters and planes, not a direct Unreal render.
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#93c5fd' }}>{preset.metrics.mobileHint}</div>
              </div>

              <div style={{ marginTop: 14, borderRadius: 16, border: '1px solid #252c3b', overflow: 'hidden' }}>
                <VfxPreview3D
                  preset={preset}
                  activeLayerId={workflow.activeLayerId}
                  onSelectLayer={(layerId) => setField('activeLayerId', layerId)}
                  imageDataUrls={Object.values(previewCache)}
                />
              </div>
            </div>

            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Effect Parts Editor</div>
                  <div style={{ fontSize: 11, color: '#555b6e', marginTop: 4 }}>
                    Each part has one job in the final effect, like main flash, debris, smoke, trail, or impact wave.
                  </div>
                </div>
                <button style={S.subtleButton} onClick={addLayer}>
                  Add Effect Part
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {workflow.layers.map((layer) => (
                  <button
                    key={layer.id}
                    onClick={() => setField('activeLayerId', layer.id)}
                    style={{
                      ...S.subtleButton,
                      background: workflow.activeLayerId === layer.id ? 'rgba(96,165,250,0.16)' : '#171b25',
                      color: workflow.activeLayerId === layer.id ? '#bfdbfe' : '#d7deee',
                      borderColor: workflow.activeLayerId === layer.id ? '#35507a' : '#2b3240'
                    }}
                  >
                    {layer.name}
                  </button>
                ))}
              </div>

              {activeLayer ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <label style={S.label}>Part Name</label>
                      <input
                        style={S.input}
                        value={activeLayer.name}
                        onChange={(event) => updateLayer(activeLayer.id, { name: event.target.value })}
                      />
                    </div>
                    <div style={{ width: 170 }}>
                      <label style={S.label}>Part Type</label>
                      <select
                        style={S.input}
                        value={activeLayer.layerType}
                        onChange={(event) => updateLayer(activeLayer.id, { layerType: event.target.value })}
                      >
                        {LAYER_TYPES.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: 118 }}>
                      <label style={S.label}>Enabled</label>
                      <select
                        style={S.input}
                        value={activeLayer.enabled ? 'yes' : 'no'}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, { enabled: event.target.value === 'yes' })
                        }
                      >
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={S.label}>Role</label>
                      <input
                        style={S.input}
                        value={activeLayer.role}
                        onChange={(event) => updateLayer(activeLayer.id, { role: event.target.value })}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Shape</label>
                      <select
                        style={S.input}
                        value={activeLayer.shape}
                        onChange={(event) => updateLayer(activeLayer.id, { shape: event.target.value })}
                      >
                        {SHAPE_OPTIONS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Light Emission</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={activeLayer.lightEmission ?? 1}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, {
                            lightEmission: clamp(Number(event.target.value) || 0, 0, 1)
                          })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Texture / Flipbook Hint</label>
                    <input
                      style={S.input}
                      value={activeLayer.textureHint}
                      onChange={(event) => updateLayer(activeLayer.id, { textureHint: event.target.value })}
                      placeholder="soft orb, spark slash, smoky puff, 6-frame burst..."
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                    <div>
                      <label style={S.label}>Primary Color</label>
                      <input
                        style={{ ...S.input, padding: 6, height: 40 }}
                        type="color"
                        value={activeLayer.color}
                        onChange={(event) => updateLayer(activeLayer.id, { color: event.target.value })}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Secondary Color</label>
                      <input
                        style={{ ...S.input, padding: 6, height: 40 }}
                        type="color"
                        value={activeLayer.secondaryColor}
                        onChange={(event) => updateLayer(activeLayer.id, { secondaryColor: event.target.value })}
                      />
                    </div>
                    <div>
                      <label style={S.label}>Opacity (0–1)</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0.05"
                        max="1"
                        step="0.05"
                        value={activeLayer.opacity}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, {
                            opacity: clamp(Number(event.target.value) || 0.05, 0.05, 1)
                          })
                        }
                      />
                    </div>
                    <div>
                      <label style={S.label}>Light Influence</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0"
                        max="1"
                        step="0.05"
                        value={activeLayer.lightInfluence ?? 0}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, {
                            lightInfluence: clamp(Number(event.target.value) || 0, 0, 1)
                          })
                        }
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={S.label}>Flipbook Layout</label>
                      <select
                        style={S.input}
                        value={activeLayer.flipbookLayout || 'None'}
                        onChange={(event) => updateLayer(activeLayer.id, { flipbookLayout: event.target.value })}
                      >
                        {FLIPBOOK_LAYOUTS.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={S.label}>Flipbook Mode</label>
                      <select
                        style={S.input}
                        value={activeLayer.flipbookMode || 'None'}
                        onChange={(event) => updateLayer(activeLayer.id, { flipbookMode: event.target.value })}
                      >
                        {FLIPBOOK_MODES.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                    <div>
                      <label style={S.label}>Size Min</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0.01"
                        max="4"
                        step="0.05"
                        value={activeLayer.sizeMin}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, { sizeMin: clamp(Number(event.target.value) || 0.05, 0.01, 4) })
                        }
                      />
                    </div>
                    <div>
                      <label style={S.label}>Size Max</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0.01"
                        max="6"
                        step="0.05"
                        value={activeLayer.sizeMax}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, { sizeMax: clamp(Number(event.target.value) || 0.05, 0.01, 6) })
                        }
                      />
                    </div>
                    <div>
                      <label style={S.label}>Rate</label>
                      <input
                        style={S.input}
                        type="number"
                        min="1"
                        max="120"
                        step="1"
                        value={activeLayer.rate}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, { rate: clamp(Number(event.target.value) || 1, 1, 120) })
                        }
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                    <div>
                      <label style={S.label}>Lifetime Min</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0.01"
                        max="5"
                        step="0.05"
                        value={activeLayer.lifetimeMin}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, {
                            lifetimeMin: clamp(Number(event.target.value) || 0.05, 0.01, 5)
                          })
                        }
                      />
                    </div>
                    <div>
                      <label style={S.label}>Lifetime Max</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0.01"
                        max="6"
                        step="0.05"
                        value={activeLayer.lifetimeMax}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, {
                            lifetimeMax: clamp(Number(event.target.value) || 0.05, 0.01, 6)
                          })
                        }
                      />
                    </div>
                    <div>
                      <label style={S.label}>Spread</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0"
                        max="180"
                        step="1"
                        value={activeLayer.spread}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, { spread: clamp(Number(event.target.value) || 0, 0, 180) })
                        }
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
                    <div>
                      <label style={S.label}>Speed Min</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={activeLayer.speedMin}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, { speedMin: clamp(Number(event.target.value) || 0, 0, 100) })
                        }
                      />
                    </div>
                    <div>
                      <label style={S.label}>Speed Max</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0"
                        max="120"
                        step="0.5"
                        value={activeLayer.speedMax}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, { speedMax: clamp(Number(event.target.value) || 0, 0, 120) })
                        }
                      />
                    </div>
                    <div>
                      <label style={S.label}>Drag</label>
                      <input
                        style={S.input}
                        type="number"
                        min="0"
                        max="4"
                        step="0.05"
                        value={activeLayer.drag}
                        onChange={(event) =>
                          updateLayer(activeLayer.id, { drag: clamp(Number(event.target.value) || 0, 0, 4) })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label style={S.label}>Part Notes</label>
                    <textarea
                      style={{ ...S.textarea, minHeight: 78 }}
                      value={activeLayer.notes}
                      onChange={(event) => updateLayer(activeLayer.id, { notes: event.target.value })}
                      placeholder="Why this layer exists, how it should feel, any timing or texture requirements..."
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: '#6d778c' }}>
                      Estimated part cost: {estimateLayerCost(activeLayer)} · Roblox class:{' '}
                      {activeLayer.layerType === 'beam'
                        ? 'Beam'
                        : activeLayer.layerType === 'trail'
                          ? 'Trail'
                          : activeLayer.layerType === 'billboard'
                            ? 'BillboardGui'
                            : 'ParticleEmitter'}
                    </div>
                    <button style={S.subtleButton} onClick={() => removeLayer(activeLayer.id)}>
                      Remove Effect Part
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#6d778c' }}>Add an effect part to start shaping the Roblox effect.</div>
              )}
            </div>
          </div>
        </main>

        <aside style={S.pack}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Export Pack</div>
                  <div style={{ fontSize: 11, color: '#555b6e', marginTop: 4 }}>{provider.note}</div>
                </div>
                <button style={S.button} onClick={exportPackage}>
                  Export
                </button>
              </div>
              <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
                <button style={S.subtleButton} onClick={() => copyText(luaScript, 'Lua prefab')}>
                  Copy Lua Prefab
                </button>
                <button
                  style={S.subtleButton}
                  onClick={() => copyText(JSON.stringify(preset, null, 2), 'preset JSON')}
                >
                  Copy Preset JSON
                </button>
                <button style={S.subtleButton} onClick={() => copyText(promptPack.analysisPrompt, 'analysis prompt')}>
                  Copy Analysis Prompt
                </button>
                <button style={S.subtleButton} onClick={() => copyText(promptPack.texturePrompt, 'texture prompt')}>
                  Copy Texture Prompt
                </button>
                <button style={S.subtleButton} onClick={() => copyText(promptPack.handoffPrompt, 'handoff prompt')}>
                  Copy Handoff Prompt
                </button>
              </div>
            </div>

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
                  maxHeight: 280,
                  overflowY: 'auto'
                }}
              >
                {JSON.stringify(preset, null, 2)}
              </pre>
            </div>

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>Lua Prefab</div>
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
                  maxHeight: 240,
                  overflowY: 'auto'
                }}
              >
                {luaScript}
              </pre>
            </div>

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 10 }}>AI Workflow Pack</div>
              <div style={{ display: 'grid', gap: 10 }}>
                <div>
                  <div style={{ ...S.label, marginBottom: 8 }}>Analysis Prompt</div>
                  <textarea style={{ ...S.textarea, minHeight: 130 }} readOnly value={promptPack.analysisPrompt} />
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 8 }}>Texture Prompt</div>
                  <textarea style={{ ...S.textarea, minHeight: 110 }} readOnly value={promptPack.texturePrompt} />
                </div>
                <div>
                  <div style={{ ...S.label, marginBottom: 8 }}>Roblox Handoff Prompt</div>
                  <textarea style={{ ...S.textarea, minHeight: 130 }} readOnly value={promptPack.handoffPrompt} />
                </div>
              </div>
            </div>

            <div style={S.card}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6', marginBottom: 8 }}>Status</div>
              <div style={{ fontSize: 12, color: notice ? '#bfdbfe' : '#6d778c', lineHeight: 1.6 }}>
                {notice || 'Attach references, tune the effect parts, then export the Roblox VFX package.'}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

import {
  buildRobloxSequenceExport,
  migrateLayerSequences,
  normalizeColorKeypoints,
  normalizeSizeKeypoints,
  normalizeTransparencyKeypoints
} from '../shared/vfxSequenceUtils.js'

const SHAPES = new Set(['orb', 'spark', 'smoke', 'ring', 'slash', 'flare'])
const TEXTURE_SOURCES = new Set(['shape', 'image'])
const FLIPBOOK_LAYOUTS = new Set(['None', 'Grid2x2', 'Grid4x4', 'Grid8x8'])
const FLIPBOOK_MODES = new Set(['None', 'Loop', 'PingPong', 'Random', 'OneShot'])
const ROBLOX_CLASSES = new Set(['ParticleEmitter', 'Beam', 'Trail'])
const EMISSION_DIRECTIONS = new Set(['Top', 'Bottom', 'Front', 'Back', 'Left', 'Right'])
const EMISSION_SHAPES = new Set(['Ball', 'Box', 'Cylinder', 'Disc', 'Sphere'])
const SHAPE_IN_OUT = new Set(['Inward', 'Outward', 'InAndOut'])
const SHAPE_STYLES = new Set(['Volume', 'Surface'])
const ORIENTATIONS = new Set([
  'FacingCamera',
  'FacingCameraWorldUp',
  'VelocityParallel',
  'VelocityPerpendicular'
])

export const PARTICLE_LOGIC_JSON_SCHEMA = {
  effectName: 'string',
  visualDirection: 'string',
  reasoning:
    'string — explain layer stack; for niagara-rebuild list what was approximated vs lost in Roblox',
  layers: [
    {
      name: 'string',
      role: 'string',
      enabled: 'boolean — maps to ParticleEmitter.Enabled',
      robloxClass: 'ParticleEmitter|Beam|Trail (default ParticleEmitter)',
      textureSource: 'shape|image — shape uses procedural sprite preset; image needs custom art',
      shape: 'orb|spark|smoke|ring|slash|flare — required when textureSource is shape',
      colorKeypoints: '[{time:0-1, color:"#RRGGBB"}, ...] — ColorSequence over lifetime (2-5 keypoints)',
      sizeKeypoints: '[{time:0-1, value:number}, ...] — Size NumberSequence in studs (2-5 keypoints)',
      transparencyKeypoints:
        '[{time:0-1, value:0-1}, ...] — Transparency NumberSequence (0=opaque, 1=invisible)',
      color: '#RRGGBB — legacy fallback tint start if colorKeypoints omitted',
      secondaryColor: '#RRGGBB — legacy fallback tint end if colorKeypoints omitted',
      opacity: '0.05-1 — legacy start opacity if transparencyKeypoints omitted',
      transparencyEnd: '0-1 — legacy end transparency if transparencyKeypoints omitted',
      sizeMin: 'number studs — legacy size start if sizeKeypoints omitted',
      sizeMax: 'number studs — legacy size end if sizeKeypoints omitted',
      lifetimeMin: 'seconds — maps to Lifetime NumberRange min',
      lifetimeMax: 'seconds — maps to Lifetime NumberRange max',
      rate: 'integer 1-120 — maps to Rate (particles/sec)',
      speedMin: 'studs/sec — maps to Speed NumberRange min',
      speedMax: 'studs/sec — maps to Speed NumberRange max',
      spread: 'integer 0-180 — maps to SpreadAngle Vector2 X',
      spreadAngleY: 'integer 0-180 — maps to SpreadAngle Vector2 Y',
      drag: '0-4 — maps to Drag',
      accelerationX: 'studs/s² — Acceleration Vector3 X',
      accelerationY: 'studs/s² — Acceleration Vector3 Y (negative = gravity)',
      accelerationZ: 'studs/s² — Acceleration Vector3 Z',
      velocityInheritance: '0-1 — VelocityInheritance from parent part motion',
      windAffectsDrag: 'boolean — WindAffectsDrag',
      lockedToPart: 'boolean — LockedToPart (particles move with parent)',
      emissionDirection: 'Top|Bottom|Front|Back|Left|Right — EmissionDirection NormalId',
      emissionShape: 'Ball|Box|Cylinder|Disc|Sphere — emission volume Shape enum',
      shapeInOut: 'Inward|Outward|InAndOut — ShapeInOut',
      shapeStyle: 'Volume|Surface — ShapeStyle',
      lightEmission: '0-1 — maps to LightEmission (additive glow)',
      lightInfluence: '0-1 — maps to LightInfluence (scene lighting)',
      zOffset: 'number — ZOffset render sort bias',
      rotationMin: 'degrees — Rotation NumberRange min',
      rotationMax: 'degrees — Rotation NumberRange max',
      rotSpeedMin: 'deg/sec — RotSpeed NumberRange min',
      rotSpeedMax: 'deg/sec — RotSpeed NumberRange max',
      orientation:
        'FacingCamera|FacingCameraWorldUp|VelocityParallel|VelocityPerpendicular — Orientation enum',
      flipbookLayout: 'None|Grid2x2|Grid4x4|Grid8x8',
      flipbookMode: 'None|Loop|PingPong|Random|OneShot',
      flipbookStartRandom: 'boolean — FlipbookStartRandom',
      flipbookFramerateMin: 'fps — FlipbookFramerate NumberRange min',
      flipbookFramerateMax: 'fps — FlipbookFramerate NumberRange max',
      timeScale: 'number — TimeScale (default 1)',
      width0: 'studs — Beam Width0 at attachment 0',
      width1: 'studs — Beam Width1 at attachment 1',
      textureHint:
        'Describe sprite/flipbook art needed for Roblox Texture = "rbxassetid://…" — e.g. soft radial orb, 4-frame smoke puff, shockwave ring. Always specify art even when textureSource is shape.',
      notes: 'Roblox setup notes: parent on Attachment vs Part, EmissionDirection, etc.'
    }
  ]
}

const ROBLOX_PROPERTY_MAPPING = `
## Roblox ParticleEmitter property mapping (JSON field → Roblox API)

| App field | Roblox property | Notes |
|-----------|-----------------|-------|
| enabled | Enabled | Toggle emission on/off |
| rate | Rate | Particles emitted per second while Enabled |
| emissionDirection | EmissionDirection (NormalId) | Top, Bottom, Front, Back, Left, Right |
| emissionShape | Shape (Enum) | Ball, Box, Cylinder, Disc, Sphere — emission volume |
| shapeInOut | ShapeInOut | Inward, Outward, InAndOut |
| shapeStyle | ShapeStyle | Volume or Surface emission |
| lifetimeMin/Max | Lifetime (NumberRange) | Seconds each particle lives |
| speedMin/Max | Speed (NumberRange) | Initial velocity magnitude in studs/sec |
| spread | SpreadAngle (Vector2 X) | Cone half-angle in degrees on X |
| spreadAngleY | SpreadAngle (Vector2 Y) | Cone half-angle in degrees on Y |
| drag | Drag | Linear deceleration; higher = slower fade of motion |
| accelerationX/Y/Z | Acceleration (Vector3) | Continuous force; negative Y = gravity |
| velocityInheritance | VelocityInheritance | 0-1 inherit parent part velocity |
| windAffectsDrag | WindAffectsDrag | Whether global wind affects drag |
| lockedToPart | LockedToPart | Particles locked to parent transform |
| sizeKeypoints | Size (NumberSequence) | 2-5 keypoints: particle size in studs over lifetime |
| colorKeypoints | Color (ColorSequence) | 2-5 keypoints: tint over lifetime — NOT a substitute for sprite art |
| transparencyKeypoints | Transparency (NumberSequence) | 2-5 keypoints: 0=opaque, 1=fully transparent |
| sizeMin/Max (legacy) | Size (NumberSequence) | Fallback 2-keypoint sequence if sizeKeypoints omitted |
| color + secondaryColor (legacy) | Color (ColorSequence) | Fallback 2-keypoint sequence if colorKeypoints omitted |
| opacity + transparencyEnd (legacy) | Transparency (NumberSequence) | Fallback if transparencyKeypoints omitted |
| lightEmission | LightEmission | 0=lit by scene, 1=fully self-lit additive |
| lightInfluence | LightInfluence | How much world lighting tints the particle |
| zOffset | ZOffset | Render sort offset |
| rotationMin/Max | Rotation (NumberRange) | Initial rotation in degrees |
| rotSpeedMin/Max | RotSpeed (NumberRange) | Rotation speed deg/sec |
| orientation | Orientation | FacingCamera, FacingCameraWorldUp, VelocityParallel, VelocityPerpendicular |
| flipbookLayout | FlipbookLayout (Enum) | None, Grid2x2, Grid4x4, Grid8x8 |
| flipbookMode | FlipbookMode (Enum) | None, Loop, PingPong, Random, OneShot |
| flipbookStartRandom | FlipbookStartRandom | Random starting frame |
| flipbookFramerateMin/Max | FlipbookFramerate (NumberRange) | Animation fps |
| timeScale | TimeScale | Simulation speed multiplier |
| textureSource + shape | Procedural sprite preset | orb/spark/smoke/ring/slash/flare — use when no custom art |
| textureHint | Texture (Content rbxassetid) | Roblox: Texture = "rbxassetid://123456". Describe art even if asset not uploaded yet |
| textureSource: image | Texture (Content rbxassetid) | User will attach PNG/sprite; describe flipbook grid in textureHint |
| robloxClass | Instance class | ParticleEmitter (default), Beam for streaks, Trail for motion ribbons |
| width0/width1 | Beam Width0/Width1 | Beam thickness at each attachment |

Parent the emitter on an Attachment (character/weapons) or directly on a Part (world FX).
Use multiple layered emitters instead of one overloaded emitter.
`.trim()

const ROBLOX_BEHAVIOR_GUIDE = `
## How Roblox particles behave

- Emitters spawn billboard quads (or meshes with SpecialMesh) that face the camera unless Orientation says otherwise.
- EmissionDirection + Shape define where particles spawn and their initial cone; ShapeStyle Volume vs Surface changes fill pattern.
- Rate × average Lifetime ≈ on-screen particle count. Keep total Rate across all layers ≤150 for mobile, ≤250 for desktop hero FX.
- Speed + SpreadAngle define the emission cone; Drag slows particles over time; Acceleration adds gravity/wind-like forces.
- Size and Color are sequences over normalized lifetime (0→1), not arbitrary curves — use 2-3 keypoints mentally.
- LightEmission > 0.5 gives additive magic/energy reads; keep smoke layers at 0-0.3 emission with higher transparency.
- Flipbooks animate sprite sheets; match Grid layout to actual texture (4 frames = Grid2x2, 16 = Grid4x4).
- Roblox has NO GPU collision, fluid sim, curl noise, sub-UV animation beyond flipbook, or Niagara-style ribbons in ParticleEmitter.
  Approximate ribbons/trails with Trail instance (robloxClass: Trail) or stacked low-rate stretched particles.
- Beams (robloxClass: Beam) suit laser/projectile cores; pair with ParticleEmitter sparks for impact effects.
`.trim()

const SHAPE_TEXTURE_GUIDE = `
## Shape → texture intent

| shape | Sprite style | LightEmission typical |
|-------|--------------|----------------------|
| orb | Soft radial gradient, additive core | 0.7-1.0 |
| spark | Thin slash/streak, high contrast | 0.8-1.0 |
| smoke | Soft puff, eroded alpha edges | 0.0-0.3 |
| ring | Shockwave ring, hollow center | 0.5-0.9 |
| slash | Directional motion streak | 0.7-1.0 |
| flare | Star/bloom burst | 0.8-1.0 |
`.trim()

const PERFORMANCE_GUIDE = `
## Performance targets (Roblox)

| target | Total Rate budget | Size guidance | Layer count |
|--------|-------------------|---------------|-------------|
| low | ≤80 combined | sizeMax ≤1.2, avoid large smoke stacks | 2-3 layers |
| medium | ≤150 combined | sizeMax ≤2.0 | 3-4 layers |
| high | ≤250 combined | hero sizes OK, still split into layers | 4-5 layers |

Reduce Rate before removing layers. Prefer shorter Lifetime on flash layers (0.05-0.3s).
`.trim()

const EFFECT_RECIPES = `
## Effect type recipes (Roblox layering)

- impact: bright flash (flare, high rate, short lifetime) + sparks (wide spread) + optional smoke fade (low emission)
- projectile: Beam or slash streak (Trail/Beam) + trailing sparks (narrow spread, moderate drag)
- aura: low-rate orb/flare shell (Loop flipbook optional) + orbit sparks (low speed, wide spread)
- explosion: ring shockwave (OneShot, short lifetime) + flash + debris sparks + lingering smoke
- environment: low rate, long lifetime, low speed, smoke/orb shapes, minimal lightEmission
`.trim()

const NIAGARA_TRANSLATION_GUIDE = `
## Niagara → Roblox translation rules

When rebuilding from Niagara reference data, map modules to layered Roblox emitters:

| Niagara concept | Roblox approximation | What is lost |
|-----------------|----------------------|--------------|
| Spawn Rate / Spawn Burst | Rate (burst ≈ high Rate + short Enabled window or OneShot flipbook) | Precise burst timing curves |
| Initialize Particle Lifetime | Lifetime NumberRange | Per-particle custom curves |
| Add Velocity / Cone Velocity | Speed + SpreadAngle + EmissionDirection | Vector fields, curl noise |
| Drag / Linear Force | Drag + Acceleration Vector3 | Continuous force fields |
| Scale Sprite Size / Size Over Life | sizeKeypoints NumberSequence | Arbitrary curve shapes beyond 5 keypoints |
| Color Over Life / Dynamic Material | colorKeypoints ColorSequence | Material params, HDR, beyond 5 stops |
| Sprite Renderer SubUV / Flipbook | flipbookLayout + flipbookMode + textureHint | Sub-UV beyond grid flipbook |
| Ribbon / GPU Ribbon Renderer | robloxClass: Trail or Beam | UV scrolling ribbons, tessellation |
| Collision (GPU) | Not available — note in reasoning | Bounce/slide |
| Curl Noise / Turbulence | Wider SpreadAngle + moderate Drag + extra spark layer | True noise fields |
| Mesh Renderer | ParticleEmitter with mesh texture hint only | Full mesh debris |
| Light Renderer | LightEmission / LightInfluence | Actual dynamic lights |

In reasoning, always include sections:
1. "Niagara → Roblox mapping" — what you translated
2. "Approximations" — acceptable shortcuts
3. "Lost in translation" — features Roblox cannot replicate

Split complex Niagara systems into 2-5 Roblox layers (flash, core, debris, smoke, ring) rather than one emitter.
`.trim()

function clampNum(value, min, max, fallback) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(max, Math.max(min, parsed))
}

function clampBool(value, fallback) {
  if (typeof value === 'boolean') return value
  if (value === 'true' || value === 1) return true
  if (value === 'false' || value === 0) return false
  return fallback
}

export function normalizeGeneratedLayer(layer, index) {
  const shape = SHAPES.has(layer?.shape) ? layer.shape : 'orb'
  const textureSource = TEXTURE_SOURCES.has(layer?.textureSource) ? layer.textureSource : 'shape'
  const flipbookLayout = FLIPBOOK_LAYOUTS.has(layer?.flipbookLayout) ? layer.flipbookLayout : 'None'
  const flipbookMode = FLIPBOOK_MODES.has(layer?.flipbookMode) ? layer.flipbookMode : 'None'
  let robloxClass = ROBLOX_CLASSES.has(layer?.robloxClass) ? layer.robloxClass : 'ParticleEmitter'

  if (shape === 'slash' && layer?.role?.toLowerCase().includes('trail') && robloxClass === 'ParticleEmitter') {
    robloxClass = 'Trail'
  }

  const spread = Math.round(clampNum(layer?.spread, 0, 180, 18))
  const migrated = migrateLayerSequences(layer)

  return {
    name: String(layer?.name || `Layer ${index + 1}`).slice(0, 80),
    role: String(layer?.role || 'particle detail').slice(0, 200),
    textureSource,
    shape,
    enabled: clampBool(layer?.enabled, true),
    robloxClass,
    colorKeypoints: migrated.colorKeypoints,
    sizeKeypoints: migrated.sizeKeypoints,
    transparencyKeypoints: migrated.transparencyKeypoints,
    color: migrated.color,
    secondaryColor: migrated.secondaryColor,
    opacity: migrated.opacity,
    transparencyEnd: migrated.transparencyEnd,
    sizeMin: migrated.sizeMin,
    sizeMax: migrated.sizeMax,
    lifetimeMin: clampNum(layer?.lifetimeMin, 0.01, 5, 0.15),
    lifetimeMax: clampNum(layer?.lifetimeMax, 0.01, 6, 0.75),
    rate: Math.round(clampNum(layer?.rate, 1, 120, 28)),
    speedMin: clampNum(layer?.speedMin, 0, 100, 6),
    speedMax: clampNum(layer?.speedMax, 0, 120, 18),
    spread,
    spreadAngleY: Math.round(clampNum(layer?.spreadAngleY, 0, 180, spread)),
    drag: clampNum(layer?.drag, 0, 4, 0.12),
    accelerationX: clampNum(layer?.accelerationX, -200, 200, 0),
    accelerationY: clampNum(layer?.accelerationY, -200, 200, 0),
    accelerationZ: clampNum(layer?.accelerationZ, -200, 200, 0),
    velocityInheritance: clampNum(layer?.velocityInheritance, 0, 1, 0),
    windAffectsDrag: clampBool(layer?.windAffectsDrag, false),
    lockedToPart: clampBool(layer?.lockedToPart, false),
    emissionDirection: EMISSION_DIRECTIONS.has(layer?.emissionDirection) ? layer.emissionDirection : 'Top',
    emissionShape: EMISSION_SHAPES.has(layer?.emissionShape) ? layer.emissionShape : 'Sphere',
    shapeInOut: SHAPE_IN_OUT.has(layer?.shapeInOut) ? layer.shapeInOut : 'Outward',
    shapeStyle: SHAPE_STYLES.has(layer?.shapeStyle) ? layer.shapeStyle : 'Volume',
    lightEmission: clampNum(layer?.lightEmission, 0, 1, shape === 'smoke' ? 0.15 : 0.85),
    lightInfluence: clampNum(layer?.lightInfluence, 0, 1, 0),
    zOffset: clampNum(layer?.zOffset, -10, 10, 0),
    rotationMin: clampNum(layer?.rotationMin, -360, 360, 0),
    rotationMax: clampNum(layer?.rotationMax, -360, 360, 0),
    rotSpeedMin: clampNum(layer?.rotSpeedMin, -720, 720, 0),
    rotSpeedMax: clampNum(layer?.rotSpeedMax, -720, 720, 0),
    orientation: ORIENTATIONS.has(layer?.orientation) ? layer.orientation : 'FacingCamera',
    flipbookLayout,
    flipbookMode,
    flipbookStartRandom: clampBool(layer?.flipbookStartRandom, false),
    flipbookFramerateMin: clampNum(layer?.flipbookFramerateMin, 1, 60, 1),
    flipbookFramerateMax: clampNum(layer?.flipbookFramerateMax, 1, 60, 1),
    timeScale: clampNum(layer?.timeScale, 0.01, 10, 1),
    width0: clampNum(layer?.width0, 0.01, 10, 0.5),
    width1: clampNum(layer?.width1, 0.01, 10, 0.5),
    textureHint: String(layer?.textureHint || 'soft additive sprite').slice(0, 200),
    notes: String(layer?.notes || '').slice(0, 500)
  }
}

export function normalizeParticleLogicPayload(payload) {
  const layers = Array.isArray(payload?.layers) ? payload.layers : []
  if (!layers.length) {
    throw new Error('DeepSeek did not return any particle layers.')
  }

  return {
    effectName: String(payload?.effectName || '').slice(0, 120),
    visualDirection: String(payload?.visualDirection || '').slice(0, 500),
    reasoning: String(payload?.reasoning || payload?.notes || '').slice(0, 3000),
    layers: layers.slice(0, 8).map(normalizeGeneratedLayer)
  }
}

export function buildRobloxVfxSystemPrompt({ sourceMode = 'ground-up' } = {}) {
  const sections = [
    'You are a senior Roblox VFX technical artist who specializes in translating real-time FX into Roblox ParticleEmitter, Beam, and Trail setups.',
    'Target platform: Roblox (ParticleEmitter on Attachment or Part). Output JSON only — no Lua, no Instance.new blocks.',
    '',
    'Respond with valid JSON matching this schema:',
    JSON.stringify(PARTICLE_LOGIC_JSON_SCHEMA, null, 2),
    '',
    ROBLOX_PROPERTY_MAPPING,
    '',
    ROBLOX_BEHAVIOR_GUIDE,
    '',
    SHAPE_TEXTURE_GUIDE,
    '',
    PERFORMANCE_GUIDE,
    '',
    EFFECT_RECIPES
  ]

  if (sourceMode === 'niagara-rebuild') {
    sections.push('', NIAGARA_TRANSLATION_GUIDE)
    sections.push(
      '',
      'SOURCE MODE: niagara-rebuild — prioritize fidelity to supplied Niagara parameters.',
      'Decompose the Niagara system into Roblox layers. Document approximations and losses in reasoning.'
    )
  } else {
    sections.push(
      '',
      'SOURCE MODE: ground-up — design from the user brief and effect type.',
      'Use Roblox-realistic ranges; explain layer timing in reasoning.'
    )
  }

  sections.push(
    '',
    'Rules:',
    '- Return 2-5 layers with readable silhouettes at Roblox camera distances.',
    '- Prefer multiple simple emitters over one overloaded emitter.',
    '- Set robloxClass to Trail or Beam only when the layer role clearly needs it.',
    '- Include ALL ParticleEmitter fields in each layer (use sensible defaults).',
    '- Include lightEmission/lightInfluence on every layer.',
    '- Default textureSource to "shape" and pick a procedural shape that matches the layer role.',
    '- Always write textureHint describing the sprite/flipbook art for Roblox Texture = "rbxassetid://…".',
    '- Prefer colorKeypoints, sizeKeypoints, and transparencyKeypoints (2-5 keypoints each) for Roblox sequences.',
    '- Use 3+ colorKeypoints when the effect shifts hue/saturation over lifetime (e.g. hot core → cool fade).',
    '- Set flipbookLayout/Mode when Niagara reference or textureHint implies animated sprite sheets.',
    '- Use negative accelerationY for gravity on debris/smoke layers.',
    '- Set spreadAngleY independently when the cone is asymmetric.'
  )

  return sections.join('\n')
}

export function buildRobloxVfxUserMessage({
  sourceMode = 'ground-up',
  effectName,
  effectType,
  performanceTarget,
  gameplayPurpose,
  visualDirection,
  prompt,
  unrealSystemType,
  unrealValuesText,
  unrealMaterialNotes,
  unrealTimingNotes,
  referenceSummary,
  existingSummary
} = {}) {
  const parts = [
    `Source mode: ${sourceMode}`,
    `Effect name: ${effectName || 'Untitled Effect'}`,
    `Effect type: ${effectType || 'impact'}`,
    `Performance target: ${performanceTarget || 'medium'}`
  ]

  if (gameplayPurpose) parts.push(`Gameplay purpose: ${gameplayPurpose}`)
  if (visualDirection) parts.push(`Visual direction: ${visualDirection}`)
  if (prompt) parts.push(`User prompt: ${prompt}`)

  if (sourceMode === 'niagara-rebuild') {
    parts.push(
      '',
      '--- Niagara / Unreal reference ---',
      `System type: ${unrealSystemType || 'Niagara'}`,
      unrealValuesText
        ? `Exported parameters / module values:\n${unrealValuesText}`
        : 'Exported parameters: not provided',
      unrealMaterialNotes ? `Material / texture notes:\n${unrealMaterialNotes}` : 'Material notes: not provided',
      unrealTimingNotes ? `Timing notes:\n${unrealTimingNotes}` : 'Timing notes: not provided',
      '',
      'Translate this Niagara reference into Roblox-ready particle layers.',
      'Explain Niagara → Roblox mapping, approximations, and lost features in reasoning.'
    )
  }

  parts.push(
    '',
    referenceSummary ? `Reference inputs:\n${referenceSummary}` : 'Reference inputs: none',
    existingSummary ? `Existing layers to refine:\n${existingSummary}` : null,
    '',
    sourceMode === 'niagara-rebuild'
      ? 'Rebuild the effect as Roblox layers from the Niagara data above.'
      : 'Generate or refine the Roblox particle layer stack from the brief above.'
  )

  return parts.filter(Boolean).join('\n')
}

function layerSequencesFromLayer(layer) {
  return {
    colorKeypoints: normalizeColorKeypoints(layer.colorKeypoints, layer),
    sizeKeypoints: normalizeSizeKeypoints(layer.sizeKeypoints, layer),
    transparencyKeypoints: normalizeTransparencyKeypoints(layer.transparencyKeypoints, layer)
  }
}

export function buildLayerRobloxMapping(layer) {
  const textureSource = layer.textureSource || 'shape'
  const textureValue =
    textureSource === 'image' && layer.textureImagePath
      ? `rbxassetid://… (${layer.textureImagePath.split(/[/\\]/).pop()})`
      : `rbxassetid://… — ${layer.textureHint || `${layer.shape || 'orb'} procedural sprite`}`

  const robloxClass = layer.robloxClass || 'ParticleEmitter'
  const spreadY = layer.spreadAngleY ?? layer.spread ?? 18
  const { colorKeypoints, sizeKeypoints, transparencyKeypoints } = layerSequencesFromLayer(layer)

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
        Transparency: buildRobloxSequenceExport(transparencyKeypoints),
        Texture: textureValue
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

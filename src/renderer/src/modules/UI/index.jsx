/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Settings,
  Sparkles,
  Trash2,
  Image as ImageIcon,
  Copy,
  Sparkle,
  Compass,
  Upload,
  X,
  ChevronRight,
  ChevronDown,
  LayoutTemplate
} from 'lucide-react'

let nextInstanceId = 1

// ─── Roblox instance catalogue ───────────────────────────────────────────────

const RBX_CLASSES = {
  // Containers
  ScreenGui:       { label: 'ScreenGui',       group: 'Container', color: '#1e3a5f', icon: '🖥️',  canHaveChildren: true  },
  Frame:           { label: 'Frame',           group: 'Container', color: '#1e3a5f', icon: '▭',   canHaveChildren: true  },
  ScrollingFrame:  { label: 'ScrollingFrame',  group: 'Container', color: '#1d4ed8', icon: '⬛',  canHaveChildren: true  },
  ViewportFrame:   { label: 'ViewportFrame',   group: 'Container', color: '#1e3a5f', icon: '🎥',  canHaveChildren: true  },
  BillboardGui:    { label: 'BillboardGui',    group: 'Container', color: '#374151', icon: '📋',  canHaveChildren: true  },
  SurfaceGui:      { label: 'SurfaceGui',      group: 'Container', color: '#374151', icon: '🗂️',  canHaveChildren: true  },
  // Labels
  TextLabel:       { label: 'TextLabel',       group: 'Label',     color: '#065f46', icon: 'T',   canHaveChildren: false },
  ImageLabel:      { label: 'ImageLabel',      group: 'Label',     color: '#4c1d95', icon: '🖼',  canHaveChildren: false },
  VideoFrame:      { label: 'VideoFrame',      group: 'Label',     color: '#7c2d12', icon: '▶',   canHaveChildren: false },
  // Buttons
  TextButton:      { label: 'TextButton',      group: 'Button',    color: '#1e3a5f', icon: '🔘',  canHaveChildren: true  },
  ImageButton:     { label: 'ImageButton',     group: 'Button',    color: '#4c1d95', icon: '🖼🔘', canHaveChildren: true  },
  // Input
  TextBox:         { label: 'TextBox',         group: 'Input',     color: '#3f3f46', icon: '✏️',  canHaveChildren: false },
  // Layout modifiers (non-visual, shown as badges)
  UIListLayout:    { label: 'UIListLayout',    group: 'Layout',    color: '#713f12', icon: '☰',   canHaveChildren: false },
  UIGridLayout:    { label: 'UIGridLayout',    group: 'Layout',    color: '#713f12', icon: '⊞',   canHaveChildren: false },
  UIPageLayout:    { label: 'UIPageLayout',    group: 'Layout',    color: '#713f12', icon: '📄',  canHaveChildren: false },
  UITableLayout:   { label: 'UITableLayout',   group: 'Layout',    color: '#713f12', icon: '⊟',   canHaveChildren: false },
  UICorner:        { label: 'UICorner',        group: 'Modifier',  color: '#134e4a', icon: '◟',   canHaveChildren: false },
  UIStroke:        { label: 'UIStroke',        group: 'Modifier',  color: '#134e4a', icon: '▱',   canHaveChildren: false },
  UIPadding:       { label: 'UIPadding',       group: 'Modifier',  color: '#134e4a', icon: '⊡',   canHaveChildren: false },
  UIScale:         { label: 'UIScale',         group: 'Modifier',  color: '#134e4a', icon: '⤡',   canHaveChildren: false },
  UIFlexItem:      { label: 'UIFlexItem',      group: 'Modifier',  color: '#134e4a', icon: '⇔',   canHaveChildren: false },
  UIAspectRatioConstraint: { label: 'UIAspectRatio', group: 'Modifier', color: '#134e4a', icon: '⊟', canHaveChildren: false },
  UISizeConstraint:{ label: 'UISizeConstraint',group: 'Modifier',  color: '#134e4a', icon: '⟺',   canHaveChildren: false },
  UIShadow:        { label: 'UIShadow',        group: 'Modifier',  color: '#312e81', icon: '🌑',  canHaveChildren: false, beta: true },
  Path2D:          { label: 'Path2D',          group: 'Label',     color: '#581c87', icon: '⌇',   canHaveChildren: false, beta: true },
}

const CLASS_GROUPS = ['Container', 'Label', 'Button', 'Input', 'Layout', 'Modifier']

const IMPLICIT_ROOT_LABEL = 'ScreenGui'
const PALETTE_HIDDEN = new Set(['ScreenGui'])

const VISUAL_CLASSES = new Set(['ScreenGui','Frame','ScrollingFrame','ViewportFrame','BillboardGui',
  'SurfaceGui','TextLabel','ImageLabel','VideoFrame','TextButton','ImageButton','TextBox','Path2D'])

const CANVAS_VISUAL_CLASSES = new Set([...VISUAL_CLASSES].filter((c) => c !== 'ScreenGui'))
const GUI_OBJECT_CLASSES = CANVAS_VISUAL_CLASSES
const ZINDEX_MODIFIER_CLASSES = new Set(['UIShadow'])

function migrateUiInstances(instances = []) {
  const screenGuiIds = new Set(instances.filter((i) => i.rbxClass === 'ScreenGui').map((i) => i.id))
  return instances
    .filter((i) => i.rbxClass !== 'ScreenGui')
    .map((i) => ({
      ...i,
      parentId: i.parentId && screenGuiIds.has(i.parentId) ? null : i.parentId
    }))
}

function getParentOptions(allInstances, instanceId) {
  return allInstances.filter(
    (i) => i.id !== instanceId && RBX_CLASSES[i.rbxClass]?.canHaveChildren && i.rbxClass !== 'ScreenGui'
  )
}

function getDescendantIds(instances, instanceId) {
  const ids = new Set()
  function walk(id) {
    for (const child of instances.filter((i) => i.parentId === id)) {
      ids.add(child.id)
      walk(child.id)
    }
  }
  walk(instanceId)
  return ids
}

function isValidParent(allInstances, instanceId, candidateParentId) {
  if (!candidateParentId) return true
  if (candidateParentId === instanceId) return false
  if (getDescendantIds(allInstances, instanceId).has(candidateParentId)) return false
  return getParentOptions(allInstances, instanceId).some((p) => p.id === candidateParentId)
}

function getAbsoluteBounds(inst, instances) {
  let x = inst.x
  let y = inst.y
  let width = inst.width
  let height = inst.height
  let current = inst
  while (current.parentId) {
    const parent = instances.find((i) => i.id === current.parentId)
    if (!parent) break
    x = parent.x + (x / 100) * parent.width
    y = parent.y + (y / 100) * parent.height
    width = (width / 100) * parent.width
    height = (height / 100) * parent.height
    current = parent
  }
  return { x, y, width, height }
}

function absoluteToParentRelative(absX, absY, absW, absH, parentInst, instances) {
  const parentAbs = getAbsoluteBounds(parentInst, instances)
  return {
    x: Math.max(0, Math.min(95, ((absX - parentAbs.x) / parentAbs.width) * 100)),
    y: Math.max(0, Math.min(95, ((absY - parentAbs.y) / parentAbs.height) * 100)),
    width: Math.max(4, Math.min(100, (absW / parentAbs.width) * 100)),
    height: Math.max(4, Math.min(100, (absH / parentAbs.height) * 100))
  }
}

function findDeepestContainerAt(instances, absX, absY, excludeId = null) {
  const containers = instances.filter(
    (i) =>
      i.id !== excludeId &&
      RBX_CLASSES[i.rbxClass]?.canHaveChildren &&
      CANVAS_VISUAL_CLASSES.has(i.rbxClass)
  )
  let best = null
  let bestArea = Infinity
  for (const c of containers) {
    const b = getAbsoluteBounds(c, instances)
    if (absX >= b.x && absX <= b.x + b.width && absY >= b.y && absY <= b.y + b.height) {
      const area = b.width * b.height
      if (area < bestArea) {
        bestArea = area
        best = c
      }
    }
  }
  return best
}

function pctToScale(pct) {
  return Math.round((pct / 100) * 10000) / 10000
}

function scaleToPct(scale) {
  return scale * 100
}

function formatUDim2Position(inst) {
  return `UDim2.fromScale(${pctToScale(inst.x)}, ${pctToScale(inst.y)})`
}

function formatUDim2Size(inst) {
  return `UDim2.fromScale(${pctToScale(inst.width)}, ${pctToScale(inst.height)})`
}

function getLocalDeltaFromScreenDelta(dxPx, dyPx, inst, instances, canvasRect) {
  const screenDxPct = (dxPx / canvasRect.width) * 100
  const screenDyPct = (dyPx / canvasRect.height) * 100
  if (!inst?.parentId) {
    return { dxPct: screenDxPct, dyPct: screenDyPct }
  }
  const parent = instances.find((i) => i.id === inst.parentId)
  if (!parent) return { dxPct: screenDxPct, dyPct: screenDyPct }
  const parentAbs = getAbsoluteBounds(parent, instances)
  return {
    dxPct: parentAbs.width > 0 ? (screenDxPct / parentAbs.width) * 100 : screenDxPct,
    dyPct: parentAbs.height > 0 ? (screenDyPct / parentAbs.height) * 100 : screenDyPct
  }
}

function getLocalSizeDeltaFromScreenDelta(dxPx, dyPx, inst, instances, canvasRect) {
  const screenDxPct = (dxPx / canvasRect.width) * 100
  const screenDyPct = (dyPx / canvasRect.height) * 100
  if (!inst?.parentId) {
    return { dwPct: screenDxPct, dhPct: screenDyPct }
  }
  const parent = instances.find((i) => i.id === inst.parentId)
  if (!parent) return { dwPct: screenDxPct, dhPct: screenDyPct }
  const parentAbs = getAbsoluteBounds(parent, instances)
  return {
    dwPct: parentAbs.width > 0 ? (screenDxPct / parentAbs.width) * 100 : screenDxPct,
    dhPct: parentAbs.height > 0 ? (screenDyPct / parentAbs.height) * 100 : screenDyPct
  }
}

// Default props per class
function defaultProps(rbxClass) {
  const base = {
    BackgroundColor3: '{ R:30, G:30, B:40 }',
    BackgroundTransparency: 0,
    BorderSizePixel: 0,
    Visible: true,
    ZIndex: 1,
    LayoutOrder: 0
  }
  switch (rbxClass) {
    case 'TextLabel':
    case 'TextButton':
      return { ...base, Text: 'Label', TextColor3: '{ R:238, G:240, B:246 }', FontFace: 'GothamBold', TextSize: 14, TextWrapped: true, RichText: false }
    case 'TextBox':
      return { ...base, PlaceholderText: 'Enter text...', Text: '', TextColor3: '{ R:238, G:240, B:246 }', FontFace: 'Gotham', TextSize: 14, ClearTextOnFocus: true }
    case 'ImageLabel':
    case 'ImageButton':
      return { ...base, Image: '', ImageColor3: '{ R:255, G:255, B:255 }', ScaleType: 'Stretch', BackgroundTransparency: 1 }
    case 'ScrollingFrame':
      return { ...base, ScrollingDirection: 'Y', CanvasSize: 'UDim2.new(0,0,2,0)', ScrollBarThickness: 6 }
    case 'UIListLayout':
      return {
        FillDirection: 'Vertical',
        HorizontalAlignment: 'Left',
        VerticalAlignment: 'Top',
        Padding: 'UDim.new(0,4)',
        SortOrder: 'LayoutOrder',
        HorizontalFlex: 'None',
        VerticalFlex: 'None',
        Wraps: false,
        ItemLineAlignment: 'Automatic'
      }
    case 'UIGridLayout':
      return { CellSize: 'UDim2.new(0,100,0,100)', CellPadding: 'UDim2.new(0,4,0,4)', FillDirection: 'Horizontal', SortOrder: 'LayoutOrder' }
    case 'UICorner':
      return {
        CornerRadius: 'UDim.new(0,8)',
        TopLeftRadius: '',
        TopRightRadius: '',
        BottomLeftRadius: '',
        BottomRightRadius: ''
      }
    case 'UIStroke':
      return { Color: '{ R:255, G:255, B:255 }', Thickness: 1, Transparency: 0, ApplyStrokeMode: 'Border' }
    case 'UIPadding':
      return { PaddingTop: 'UDim.new(0,8)', PaddingBottom: 'UDim.new(0,8)', PaddingLeft: 'UDim.new(0,8)', PaddingRight: 'UDim.new(0,8)' }
    case 'UIScale':
      return { Scale: 1 }
    case 'UIFlexItem':
      return { FlexMode: 'Fill', GrowRatio: 1, ShrinkRatio: 1, ItemLineAlignment: 'Automatic' }
    case 'UIAspectRatioConstraint':
      return { AspectRatio: 1, AspectType: 'FitWithinMaxSize', DominantAxis: 'Width' }
    case 'UISizeConstraint':
      return { MinSize: 'Vector2.new(0,0)', MaxSize: 'Vector2.new(math.huge,math.huge)' }
    case 'UIShadow':
      return {
        Color: '{ R:0, G:0, B:0 }',
        Transparency: 0.5,
        BlurRadius: 'UDim.new(0,12)',
        Offset: 'UDim2.new(0,4,0,4)',
        Spread: 0,
        ZIndex: -1
      }
    case 'Path2D':
      return {
        ...base,
        BackgroundTransparency: 1,
        Color3: '{ R:255, G:255, B:255 }',
        Thickness: 2
      }
    default:
      return base
  }
}

function createInstance(rbxClass, overrides = {}) {
  const meta = RBX_CLASSES[rbxClass] || RBX_CLASSES.Frame
  const isVisual = CANVAS_VISUAL_CLASSES.has(rbxClass)
  return {
    id: `inst-${nextInstanceId++}`,
    rbxClass,
    name: `${meta.label}${nextInstanceId - 1}`,
    parentId: null,
    // canvas geometry (% of canvas, only for visual instances)
    x: isVisual ? 10 : 0,
    y: isVisual ? 10 : 0,
    width: isVisual ? 30 : 0,
    height: isVisual ? 20 : 0,
    properties: defaultProps(rbxClass),
    imageDataUrl: null,
    imagePath: null,
    notes: '',
    ...overrides
  }
}

function normalizeInstance(inst = {}) {
  const base = createInstance(inst.rbxClass || 'Frame', inst)
  return {
    ...base,
    imageDataUrl: inst.imageDataUrl || null,
    imagePath: inst.imagePath || null
  }
}

const DEFAULT_WORKFLOW = {
  provider: 'manus',
  projectName: '',
  targetPlatform: 'roblox-desktop',
  visualDirection: '',
  implementationNotes: '',
  activeInstanceId: null,
  instances: [],
  screenGuiDefaults: {
    ZIndexBehavior: 'Sibling',
    DisplayOrder: 0
  }
}

const PROVIDERS = {
  manus: {
    label: 'Manus',
    accent: '#60a5fa',
    generateLabel: 'Generate with Manus'
  },
  'chatgpt-image': {
    label: 'ChatGPT Image',
    accent: '#34d399',
    generateLabel: 'Generate with ChatGPT Image'
  }
}

const PLATFORM_OPTIONS = [
  { id: 'roblox-desktop', label: 'Roblox Desktop' },
  { id: 'roblox-mobile', label: 'Roblox Mobile' },
  { id: 'cross-platform', label: 'Desktop + Mobile' }
]

const DEFAULT_PROVIDER_WEB_CONFIG = {
  manusLoginUrl: 'https://manus.im/',
  manusWorkspaceUrl: 'https://manus.im/',
  chatgptLoginUrl: 'https://chatgpt.com/auth/login',
  chatgptWorkspaceUrl: 'https://chatgpt.com/'
}

const DEFAULT_PROVIDER_SESSION_STATE = {
  manus: {
    checked: false,
    loading: false,
    connected: false,
    loginDetected: false,
    cookieCount: 0,
    promptCandidates: 0,
    error: null
  },
  'chatgpt-image': {
    checked: false,
    loading: false,
    connected: false,
    loginDetected: false,
    cookieCount: 0,
    promptCandidates: 0,
    error: null
  }
}

// ─── Prompt builder ──────────────────────────────────────────────────────────

function buildUIPrompt(workflow) {
  const instances = workflow.instances || []
  const visualInsts = instances.filter((i) => CANVAS_VISUAL_CLASSES.has(i.rbxClass))
  const modifierInsts = instances.filter((i) => !CANVAS_VISUAL_CLASSES.has(i.rbxClass))

  const header = [
    'Design a Roblox UI layout. Use only the information provided. Do not invent missing details.',
    '',
    workflow.projectName ? `Project: ${workflow.projectName}` : '',
    workflow.targetPlatform ? `Platform: ${workflow.targetPlatform}` : '',
    workflow.visualDirection ? `Visual direction: ${workflow.visualDirection}` : '',
    workflow.implementationNotes ? `Implementation notes: ${workflow.implementationNotes}` : '',
    `ScreenGui defaults: ZIndexBehavior=${workflow.screenGuiDefaults?.ZIndexBehavior || 'Sibling'}, DisplayOrder=${workflow.screenGuiDefaults?.DisplayOrder ?? 0}`
  ].filter(Boolean).join('\n')

  const instLines = visualInsts.map((inst, idx) => {
    const props = Object.entries(inst.properties || {})
      .map(([k, v]) => `    ${k}: ${v}`)
      .join('\n')
    const pos = `Position = ${formatUDim2Position(inst)}`
    const size = `Size = ${formatUDim2Size(inst)}`
    const parent = inst.parentId
      ? `parent: ${instances.find((i) => i.id === inst.parentId)?.name || inst.parentId}`
      : 'parent: ScreenGui'
    return [
      `${idx + 1}. [${inst.rbxClass}] ${inst.name}`,
      `    ${parent}`,
      `    ${pos}`,
      `    ${size}`,
      props,
      inst.notes ? `    notes: ${inst.notes}` : ''
    ].filter(Boolean).join('\n')
  })

  const modLines = modifierInsts.map((inst) => {
    const props = Object.entries(inst.properties || {})
      .map(([k, v]) => `  ${k}: ${v}`)
      .join(', ')
    const parent = inst.parentId
      ? instances.find((i) => i.id === inst.parentId)?.name || inst.parentId
      : IMPLICIT_ROOT_LABEL
    return `[${inst.rbxClass}] on ${parent}${props ? ' — ' + props : ''}`
  })

  const parts = [
    header,
    instLines.length ? `\nInstances:\n${instLines.join('\n\n')}` : '',
    modLines.length ? `\nModifiers:\n${modLines.join('\n')}` : ''
  ].filter(Boolean).join('\n')

  return { prompt: parts, hasContent: instances.length > 0 }
}

function buildImagePrompt(workflow, inst, referenceDataUrl = null) {
  const meta = RBX_CLASSES[inst.rbxClass]
  const lines = [
    `Generate an image asset for a Roblox ${inst.rbxClass} named "${inst.name}".`,
    '',
    workflow.projectName ? `Project: ${workflow.projectName}` : '',
    workflow.visualDirection ? `Visual direction: ${workflow.visualDirection}` : '',
    inst.notes ? `Design notes: ${inst.notes}` : '',
    inst.properties?.Text ? `Label text: ${inst.properties.Text}` : '',
    `Size = ${formatUDim2Size(inst)} (relative to ${inst.parentId ? 'parent' : 'screen'})`,
    '',
    referenceDataUrl
      ? 'A reference image is attached — match its style, palette, composition, and level of detail.'
      : '',
    `Render as a flat 2D game UI asset — no 3D, no shadows, no backgrounds unless explicitly described.`,
    `Output: transparent PNG, game-ready, clean edges, Roblox ${meta?.label || inst.rbxClass} style.`
  ].filter(Boolean).join('\n')
  return lines
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page: { 
    display: 'flex', 
    flexDirection: 'column', 
    height: '100%', 
    background: 'radial-gradient(circle at top left, rgba(20, 24, 33, 0.4), rgba(10, 11, 15, 0.6))',
    backdropFilter: 'blur(20px)',
    position: 'relative',
    overflow: 'hidden'
  },
  header: { 
    padding: '20px 24px 12px', 
    borderBottom: '1px solid rgba(255,255,255,0.05)', 
    background: 'rgba(0,0,0,0.15)',
    flexShrink: 0 
  },
  title: { 
    fontSize: 18, 
    fontWeight: 800, 
    letterSpacing: '-0.02em',
    color: '#eef0f6', 
    margin: 0 
  },
  body: { 
    flex: 1, 
    display: 'flex', 
    minHeight: 0 
  },
  rail: { 
    width: 260, 
    borderRight: '1px solid rgba(255,255,255,0.05)', 
    display: 'flex', 
    flexDirection: 'column', 
    minHeight: 0,
    background: 'rgba(0,0,0,0.08)'
  },
  canvas: { 
    flex: 1, 
    minWidth: 0, 
    background: 'radial-gradient(circle at center, rgba(16, 19, 28, 0.3) 0%, rgba(9, 10, 15, 0.6) 100%)', 
    position: 'relative', 
    overflow: 'hidden', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center' 
  },
  side: { 
    width: 320, 
    borderLeft: '1px solid rgba(255,255,255,0.05)', 
    overflowY: 'auto', 
    padding: 16,
    background: 'rgba(0,0,0,0.08)'
  },
  card: { 
    background: 'rgba(16, 19, 28, 0.4)', 
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 12,
    boxShadow: '0 4px 24px rgba(0,0,0,0.15)'
  },
  label: { 
    display: 'block', 
    fontSize: 10, 
    fontWeight: 800, 
    textTransform: 'uppercase', 
    letterSpacing: '0.08em', 
    color: '#64748b', 
    marginBottom: 6 
  },
  input: { 
    width: '100%', 
    background: 'rgba(9, 10, 15, 0.6)', 
    border: '1px solid rgba(255,255,255,0.05)', 
    borderRadius: 8, 
    padding: '9px 12px', 
    fontSize: 12, 
    color: '#eef0f6', 
    outline: 'none', 
    boxSizing: 'border-box', 
    fontFamily: 'inherit',
    transition: 'all 0.2s'
  },
  textarea: { 
    width: '100%', 
    background: 'rgba(9, 10, 15, 0.6)', 
    border: '1px solid rgba(255,255,255,0.05)', 
    borderRadius: 8, 
    padding: '9px 12px', 
    fontSize: 11, 
    color: '#c4cad8', 
    outline: 'none', 
    boxSizing: 'border-box', 
    fontFamily: 'inherit', 
    resize: 'vertical', 
    lineHeight: 1.6,
    transition: 'all 0.2s'
  },
  btn: { 
    border: '1px solid rgba(255,255,255,0.08)', 
    borderRadius: 10, 
    padding: '10px 18px', 
    fontSize: 12, 
    fontWeight: 700, 
    background: 'rgba(255, 255, 255, 0.04)', 
    color: '#cbd5e1', 
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    transition: 'all 0.2s'
  },
  primaryBtn: { 
    border: 'none', 
    borderRadius: 10, 
    padding: '10px 18px', 
    fontSize: 12, 
    fontWeight: 700, 
    background: 'rgba(255, 255, 255, 0.9)', 
    color: '#0c0e17', 
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    boxShadow: '0 4px 16px rgba(255, 255, 255, 0.05)',
    transition: 'all 0.2s'
  },
  select: { 
    width: '100%', 
    background: 'rgba(9, 10, 15, 0.6)', 
    border: '1px solid rgba(255,255,255,0.05)', 
    borderRadius: 8, 
    padding: '9px 12px', 
    fontSize: 12, 
    color: '#eef0f6', 
    outline: 'none', 
    boxSizing: 'border-box', 
    fontFamily: 'inherit',
    transition: 'all 0.2s'
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UIModule({ workflowState, setWorkflowState, onChangeModule }) {
  const [uiWorkflow, setUiWorkflow] = useState(() => {
    const saved = workflowState?.uiWorkflow
    if (!saved) return DEFAULT_WORKFLOW
    return {
      ...DEFAULT_WORKFLOW,
      ...saved,
      instances: migrateUiInstances((saved.instances || []).map(normalizeInstance)),
      screenGuiDefaults: {
        ...DEFAULT_WORKFLOW.screenGuiDefaults,
        ...(saved.screenGuiDefaults || {})
      }
    }
  })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [providerWebConfig, setProviderWebConfig] = useState(DEFAULT_PROVIDER_WEB_CONFIG)
  const [providerWebConfigLoaded, setProviderWebConfigLoaded] = useState(() => !window.api?.configGet)
  const [providerSessionState, setProviderSessionState] = useState(DEFAULT_PROVIDER_SESSION_STATE)
  const [generatePanel, setGeneratePanel] = useState(null) // null | { mode: 'layout' } | { mode: 'image', instanceId }

  useEffect(() => {
    if (!setWorkflowState) return
    setWorkflowState((prev) => ({ ...prev, uiWorkflow }))
  }, [uiWorkflow, setWorkflowState])

  useEffect(() => {
    if (!notice) return undefined
    const t = window.setTimeout(() => setNotice(''), 2200)
    return () => window.clearTimeout(t)
  }, [notice])

  useEffect(() => {
    let active = true
    if (!window.api?.configGet) return undefined
    window.api.configGet('uiProviderWebConfig').then((saved) => {
      if (!active) return
      if (saved && typeof saved === 'object') setProviderWebConfig((p) => ({ ...p, ...saved }))
      setProviderWebConfigLoaded(true)
    }).catch(() => { if (active) setProviderWebConfigLoaded(true) })
    return () => { active = false }
  }, [])

  const activeInstance = useMemo(
    () => uiWorkflow.instances.find((i) => i.id === uiWorkflow.activeInstanceId) || null,
    [uiWorkflow.activeInstanceId, uiWorkflow.instances]
  )
  const promptState = useMemo(() => buildUIPrompt(uiWorkflow), [uiWorkflow])

  const updateWorkflow = useCallback((changes) => setUiWorkflow((p) => ({ ...p, ...changes })), [])

  const addInstance = useCallback((rbxClass) => {
    const inst = createInstance(rbxClass, {
      x: 10 + Math.random() * 20,
      y: 10 + Math.random() * 20
    })
    setUiWorkflow((p) => ({ ...p, instances: [...p.instances, inst], activeInstanceId: inst.id }))
  }, [])

  const updateInstance = useCallback((id, changes) => {
    setUiWorkflow((p) => ({
      ...p,
      instances: p.instances.map((i) => (i.id === id ? { ...i, ...changes } : i))
    }))
  }, [])

  const updateInstanceProp = useCallback((id, key, value) => {
    setUiWorkflow((p) => ({
      ...p,
      instances: p.instances.map((i) =>
        i.id === id ? { ...i, properties: { ...i.properties, [key]: value } } : i
      )
    }))
  }, [])

  const removeInstance = useCallback((id) => {
    setUiWorkflow((p) => {
      const instances = p.instances.filter((i) => i.id !== id && i.parentId !== id)
      return { ...p, instances, activeInstanceId: p.activeInstanceId === id ? instances[0]?.id || null : p.activeInstanceId }
    })
  }, [])

  const reparentInstance = useCallback((instanceId, newParentId) => {
    setUiWorkflow((p) => {
      if (!isValidParent(p.instances, instanceId, newParentId)) return p
      const inst = p.instances.find((i) => i.id === instanceId)
      if (!inst) return p
      if (!newParentId) {
        const abs = getAbsoluteBounds(inst, p.instances)
        return {
          ...p,
          instances: p.instances.map((i) =>
            i.id === instanceId ? { ...i, parentId: null, x: abs.x, y: abs.y, width: abs.width, height: abs.height } : i
          )
        }
      }
      const parent = p.instances.find((i) => i.id === newParentId)
      if (!parent) return p
      const abs = getAbsoluteBounds(inst, p.instances)
      const rel = absoluteToParentRelative(abs.x, abs.y, abs.width, abs.height, parent, p.instances)
      return {
        ...p,
        instances: p.instances.map((i) =>
          i.id === instanceId ? { ...i, parentId: newParentId, ...rel } : i
        )
      }
    })
  }, [])

  const getProviderWebOptions = useCallback((pid) => {
    if (pid === 'manus') return { loginUrl: providerWebConfig.manusLoginUrl, workspaceUrl: providerWebConfig.manusWorkspaceUrl }
    return { loginUrl: providerWebConfig.chatgptLoginUrl, workspaceUrl: providerWebConfig.chatgptWorkspaceUrl }
  }, [providerWebConfig])

  const refreshProviderStatus = useCallback(async (pid) => {
    const options = getProviderWebOptions(pid)
    setProviderSessionState((p) => ({ ...p, [pid]: { ...p[pid], loading: true, error: null } }))
    const result = pid === 'manus'
      ? await window.api.manusWebSessionStatus(options)
      : await window.api.chatgptWebSessionStatus(options)
    setProviderSessionState((p) => ({
      ...p,
      [pid]: { checked: true, loading: false, connected: Boolean(result?.connected), loginDetected: Boolean(result?.loginDetected), cookieCount: Number(result?.cookieCount || 0), promptCandidates: Number(result?.promptCandidates || 0), error: result?.success === false ? result.error || 'Session check failed.' : null }
    }))
  }, [getProviderWebOptions])

  useEffect(() => {
    if (!providerWebConfigLoaded) return
    let cancelled = false
    const t = window.setTimeout(async () => {
      await refreshProviderStatus('manus')
      if (!cancelled) await refreshProviderStatus('chatgpt-image')
    }, 0)
    return () => { cancelled = true; window.clearTimeout(t) }
  }, [providerWebConfigLoaded, refreshProviderStatus])

  const openProviderWorkspace = useCallback(async (pid) => {
    const options = getProviderWebOptions(pid)
    const result = pid === 'manus' ? await window.api.manusWebOpenWorkspace(options) : await window.api.chatgptWebOpenWorkspace(options)
    if (!result?.success) { setNotice(result?.error || 'Could not open workspace.'); return false }
    return true
  }, [getProviderWebOptions])

  const connectProvider = useCallback(async (pid) => {
    const options = getProviderWebOptions(pid)
    const result = pid === 'manus'
      ? await window.api.manusWebOpenLogin(options)
      : await window.api.chatgptWebOpenLogin(options)
    if (!result?.success) { setNotice(result?.error || 'Could not open login.'); return false }
    setNotice(pid === 'manus' ? 'Opened Manus login.' : 'Opened ChatGPT login.')
    return true
  }, [getProviderWebOptions])

  const copyPrompt = useCallback(async (text) => {
    const result = await window.api.copyText(text)
    if (!result?.success) { setNotice(result?.error || 'Could not copy.'); return false }
    setNotice('Copied.')
    return true
  }, [])

  const generate = useCallback(async () => {
    if (!promptState.hasContent) { setNotice('Add some instances first.'); return }
    setBusy('gen')
    const copied = await copyPrompt(promptState.prompt)
    if (!copied) { setBusy(''); return }
    const opened = await openProviderWorkspace(uiWorkflow.provider)
    setBusy('')
    if (!opened) return
    setNotice('Prompt copied and workspace opened.')
    setGeneratePanel(null)
  }, [copyPrompt, openProviderWorkspace, promptState, uiWorkflow.provider])

  const generateImageFor = useCallback(async (inst, referenceDataUrl = null) => {
    const ref = referenceDataUrl || inst.imageDataUrl || null
    const text = buildImagePrompt(uiWorkflow, inst, ref)
    setBusy(`img-${inst.id}`)
    const copied = await copyPrompt(text)
    if (!copied) { setBusy(''); return }
    if (ref && window.api?.copyImageFromDataURL) {
      const imgResult = await window.api.copyImageFromDataURL(ref)
      if (!imgResult?.success) {
        setNotice(imgResult?.error || 'Could not copy reference image.')
        setBusy('')
        return
      }
    }
    const opened = await openProviderWorkspace(uiWorkflow.provider)
    setBusy('')
    if (!opened) return
    setNotice(
      ref
        ? `Prompt and reference image copied for ${inst.name} — paste both in your provider.`
        : `Image prompt for ${inst.name} copied — workspace opened.`
    )
    setGeneratePanel(null)
  }, [copyPrompt, openProviderWorkspace, uiWorkflow])

  const uploadImageForInstance = useCallback(async (instId) => {
    if (!window.api?.openImage) return
    setBusy(`upload-${instId}`)
    try {
      const filePath = await window.api.openImage()
      if (!filePath) return
      const result = await window.api.readFileAsDataURL({ filePath })
      if (!result?.success) {
        setNotice(result?.error || 'Could not read image.')
        return
      }
      updateInstance(instId, { imageDataUrl: result.dataUrl, imagePath: filePath })
      setNotice('Image uploaded.')
    } finally {
      setBusy('')
    }
  }, [updateInstance])

  const clearInstanceImage = useCallback((instId) => {
    updateInstance(instId, { imageDataUrl: null, imagePath: null })
    updateInstanceProp(instId, 'Image', '')
    setNotice('Image cleared.')
  }, [updateInstance, updateInstanceProp])

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
              <Compass size={20} className="text-rose-400" /> UI Studio
            </h1>
            <p className="text-xs text-slate-400 mt-1 font-medium">
              Design Roblox UI layouts, upload or generate assets, and parent instances like Studio.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              className="px-4 py-2 text-xs font-bold rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-slate-100 hover:border-white/[0.15] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
              onClick={() => onChangeModule?.('settings')}
            >
              <Settings size={13} /> Settings
            </button>
            <button
              className="px-4 py-2 text-xs font-bold rounded-lg bg-white text-slate-950 hover:bg-white/90 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
              onClick={() => setGeneratePanel({ mode: 'layout' })}
            >
              <Sparkles size={13} /> Generate
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-3.5 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium animate-fadeIn flex items-center gap-1.5">
            <Sparkles size={13} className="text-purple-300" /> <span>{notice}</span>
          </div>
        )}
      </div>

      {generatePanel && (
        <GeneratePanel
          mode={generatePanel.mode}
          targetInstance={generatePanel.instanceId ? uiWorkflow.instances.find((i) => i.id === generatePanel.instanceId) : null}
          workflow={uiWorkflow}
          promptState={promptState}
          providers={PROVIDERS}
          providerSessionState={providerSessionState}
          busy={busy}
          onClose={() => setGeneratePanel(null)}
          onSelectProvider={(id) => updateWorkflow({ provider: id })}
          onConnect={connectProvider}
          onRefresh={refreshProviderStatus}
          onOpenWorkspace={openProviderWorkspace}
          onGenerateLayout={generate}
          onGenerateImage={generateImageFor}
          onCopyPrompt={copyPrompt}
          styles={S}
        />
      )}

      {/* ── Body ── */}
      <div style={S.body}>
        {/* Left rail: instance palette + hierarchy */}
        <div style={S.rail}>
          <InstancePalette onAdd={addInstance} />
          <InstanceTree
            instances={uiWorkflow.instances}
            activeId={uiWorkflow.activeInstanceId}
            onSelect={(id) => updateWorkflow({ activeInstanceId: id })}
            onRemove={removeInstance}
            onReparent={reparentInstance}
          />
        </div>

        {/* Canvas */}
        <div style={S.canvas}>
          <UICanvas
            instances={uiWorkflow.instances}
            activeId={uiWorkflow.activeInstanceId}
            onSelect={(id) => updateWorkflow({ activeInstanceId: id })}
            onUpdate={updateInstance}
            onCreate={(rbxClass, x, y, w, h, parentId = null) => {
              const inst = createInstance(rbxClass, { x, y, width: w, height: h, parentId })
              setUiWorkflow((p) => ({ ...p, instances: [...p.instances, inst], activeInstanceId: inst.id }))
            }}
            onDeselect={() => updateWorkflow({ activeInstanceId: null })}
          />
        </div>

        {/* Right panel: properties + project brief */}
        <div style={S.side}>
          <PropertiesPanel
            instance={activeInstance}
            allInstances={uiWorkflow.instances}
            onUpdate={updateInstance}
            onUpdateProp={updateInstanceProp}
            onOpenGeneratePanel={(instanceId) => setGeneratePanel({ mode: 'image', instanceId })}
            onUploadImage={uploadImageForInstance}
            onClearImage={clearInstanceImage}
            onOpenLayoutGenerate={() => setGeneratePanel({ mode: 'layout' })}
            onCopyPrompt={copyPrompt}
            promptPreview={promptState.prompt}
            busy={busy}
            styles={S}
            workflow={uiWorkflow}
            onUpdateWorkflow={updateWorkflow}
            onReparent={reparentInstance}
          />
        </div>
      </div>
    </div>
  )
}

// ─── Instance Palette ─────────────────────────────────────────────────────────

function InstancePalette({ onAdd }) {
  const [openGroup, setOpenGroup] = useState('Container')
  return (
    <div style={{ borderBottom: '1px solid #1e2330', padding: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7c8499', marginBottom: 8 }}>Insert</div>
      {CLASS_GROUPS.map((group) => (
        <div key={group}>
          <button
            onClick={() => setOpenGroup((p) => (p === group ? null : group))}
            style={{ width: '100%', background: 'none', border: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#9aa0b0', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: '4px 0', marginBottom: 2 }}
          >
            <span>{group}</span>
            <span style={{ opacity: 0.5 }}>{openGroup === group ? '▲' : '▼'}</span>
          </button>
          {openGroup === group && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
              {Object.entries(RBX_CLASSES).filter(([cls, m]) => m.group === group && !PALETTE_HIDDEN.has(cls) && !m.hidden).map(([cls, meta]) => (
                <button
                  key={cls}
                  title={cls + (meta.beta ? ' (beta)' : '')}
                  onClick={() => onAdd(cls)}
                  style={{ fontSize: 10, padding: '3px 7px', borderRadius: 6, background: meta.color + '33', border: `1px solid ${meta.color}55`, color: '#c4cad8', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {meta.icon} {meta.label}{meta.beta ? ' β' : ''}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Instance Tree ────────────────────────────────────────────────────────────

function InstanceTree({ instances, activeId, onSelect, onRemove, onReparent }) {
  const [collapsed, setCollapsed] = useState({})
  const [dragOverId, setDragOverId] = useState(null)
  const roots = instances.filter((i) => !i.parentId)

  function toggleCollapse(id) {
    setCollapsed((p) => ({ ...p, [id]: !p[id] }))
  }

  function handleDrop(targetId, e) {
    e.preventDefault()
    e.stopPropagation()
    setDragOverId(null)
    const sourceId = e.dataTransfer.getData('text/ui-instance-id')
    if (!sourceId || sourceId === targetId) return
    if (targetId === 'root') {
      onReparent(sourceId, null)
    } else if (isValidParent(instances, sourceId, targetId)) {
      onReparent(sourceId, targetId)
    }
  }

  function renderNode(inst, depth = 0) {
    const meta = RBX_CLASSES[inst.rbxClass] || RBX_CLASSES.Frame
    const children = instances.filter((i) => i.parentId === inst.id)
    const active = inst.id === activeId
    const isCollapsed = collapsed[inst.id]
    const canAcceptChildren = meta.canHaveChildren
    const isDragOver = dragOverId === inst.id

    return (
      <div key={inst.id}>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/ui-instance-id', inst.id)
            e.dataTransfer.effectAllowed = 'move'
          }}
          onDragOver={(e) => {
            if (!canAcceptChildren) return
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            setDragOverId(inst.id)
          }}
          onDragLeave={() => setDragOverId((p) => (p === inst.id ? null : p))}
          onDrop={(e) => canAcceptChildren && handleDrop(inst.id, e)}
          onClick={() => onSelect(inst.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: `3px ${6 + depth * 12}px`,
            cursor: 'grab',
            background: isDragOver ? 'rgba(96,165,250,0.15)' : active ? 'rgba(124,58,237,0.15)' : 'transparent',
            borderLeft: active ? '2px solid #7c3aed' : isDragOver ? '2px solid #60a5fa' : '2px solid transparent',
            borderRadius: 4
          }}
        >
          {children.length > 0 ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleCollapse(inst.id) }}
              style={{ background: 'none', border: 'none', color: '#7c8499', cursor: 'pointer', padding: 0, display: 'flex' }}
            >
              {isCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
            </button>
          ) : (
            <span style={{ width: 11 }} />
          )}
          <span style={{ fontSize: 11 }}>{meta.icon}</span>
          <span style={{ flex: 1, fontSize: 11, color: active ? '#c4b5fd' : '#c4cad8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</span>
          <span style={{ fontSize: 9, color: '#555b6e' }}>{inst.rbxClass}{meta.beta ? ' β' : ''}</span>
          <button onClick={(e) => { e.stopPropagation(); onRemove(inst.id) }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
        </div>
        {!isCollapsed && children.map((c) => renderNode(c, depth + 1))}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOverId('root') }}
        onDragLeave={() => setDragOverId((p) => (p === 'root' ? null : p))}
        onDrop={(e) => handleDrop('root', e)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '3px 6px',
          color: dragOverId === 'root' ? '#93c5fd' : '#7c8499',
          fontSize: 11,
          borderBottom: '1px solid #1e2330',
          marginBottom: 4,
          background: dragOverId === 'root' ? 'rgba(96,165,250,0.1)' : 'transparent',
          borderRadius: 4
        }}
      >
        <span>🖥️</span>
        <span style={{ flex: 1, fontWeight: 700 }}>{IMPLICIT_ROOT_LABEL}</span>
        <span style={{ fontSize: 9 }}>root</span>
      </div>
      {roots.length === 0
        ? <div style={{ fontSize: 11, color: '#555b6e', padding: '8px 10px' }}>No instances yet — insert from palette or draw on canvas</div>
        : roots.map((i) => renderNode(i))}
      <div style={{ fontSize: 9, color: '#555b6e', padding: '8px 10px', lineHeight: 1.5 }}>
        Drag instances onto containers to reparent, like Roblox Explorer.
      </div>
    </div>
  )
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

const CANVAS_ASPECT = 16 / 9

const RESIZE_HANDLES = [
  { h: 'nw', style: { top: -4, left: -4 } },
  { h: 'n',  style: { top: -4, left: 'calc(50% - 4px)' } },
  { h: 'ne', style: { top: -4, right: -4 } },
  { h: 'e',  style: { top: 'calc(50% - 4px)', right: -4 } },
  { h: 'se', style: { bottom: -4, right: -4 } },
  { h: 's',  style: { bottom: -4, left: 'calc(50% - 4px)' } },
  { h: 'sw', style: { bottom: -4, left: -4 } },
  { h: 'w',  style: { top: 'calc(50% - 4px)', left: -4 } }
]

function UICanvas({ instances, activeId, onSelect, onUpdate, onCreate, onDeselect }) {
  const containerRef = useRef(null)
  const canvasElRef = useRef(null)
  // drag state — only accessed in effects/event handlers, never during render
  const dragRef = useRef(null)
  // keep latest instances/callbacks in refs so the single effect never goes stale
  const instancesRef = useRef(instances)
  const onSelectRef = useRef(onSelect)
  const onDeselectRef = useRef(onDeselect)
  const onUpdateRef = useRef(onUpdate)
  const onCreateRef = useRef(onCreate)

  useEffect(() => { instancesRef.current = instances }, [instances])
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])
  useEffect(() => { onDeselectRef.current = onDeselect }, [onDeselect])
  useEffect(() => { onUpdateRef.current = onUpdate }, [onUpdate])
  useEffect(() => { onCreateRef.current = onCreate }, [onCreate])

  // canvas rect measured for resizing — stored in a ref so the drag effect doesn't re-attach
  const canvasRectRef = useRef({ left: 0, top: 0, width: 800, height: 450 })
  const [canvasDisplay, setCanvasDisplay] = useState({ left: 0, top: 0, width: 800, height: 450 })
  const [gridKey, setGridKey] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    function measure() {
      const { width, height } = el.getBoundingClientRect()
      const cw = Math.min(width - 32, (height - 32) * CANVAS_ASPECT)
      const ch = cw / CANVAS_ASPECT
      const rect = { left: (width - cw) / 2, top: (height - ch) / 2, width: cw, height: ch }
      canvasRectRef.current = rect
      setCanvasDisplay(rect)
      setGridKey((k) => k + 1)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Single effect owns ALL mouse interactions — no ref access during render
  useEffect(() => {
    const canvasEl = canvasElRef.current
    if (!canvasEl) return

    function getRect() { return canvasRectRef.current }

    function onCanvasMouseDown(e) {
      const handleEl = e.target.closest('[data-handle]')
      const instEl = e.target.closest('[data-inst-id]')
      const rect = getRect()

      if (handleEl) {
        const instId = handleEl.closest('[data-inst-id]')?.dataset.instId
        if (!instId) return
        const handle = handleEl.dataset.handle
        const inst = instancesRef.current.find((i) => i.id === instId)
        if (!inst) return
        dragRef.current = {
          type: 'resize',
          instId,
          handle,
          dragEl: handleEl.closest('[data-inst-id]'),
          startMx: e.clientX,
          startMy: e.clientY,
          startX: inst.x,
          startY: inst.y,
          startW: inst.width,
          startH: inst.height,
          pending: null
        }
        onSelectRef.current(instId)
        e.stopPropagation()
        e.preventDefault()
      } else if (instEl) {
        const instId = instEl.dataset.instId
        const inst = instancesRef.current.find((i) => i.id === instId)
        if (!inst) return
        dragRef.current = {
          type: 'move',
          instId,
          dragEl: instEl,
          startMx: e.clientX,
          startMy: e.clientY,
          startX: inst.x,
          startY: inst.y,
          startW: inst.width,
          startH: inst.height,
          pending: null
        }
        onSelectRef.current(instId)
        e.preventDefault()
        e.stopPropagation()
      } else {
        onDeselectRef.current()
        const cr = canvasEl.getBoundingClientRect()
        const mx = e.clientX - cr.left
        const my = e.clientY - cr.top
        const xPct = Math.max(0, Math.min(100, (mx / rect.width) * 100))
        const yPct = Math.max(0, Math.min(100, (my / rect.height) * 100))
        dragRef.current = { type: 'create', createClass: 'Frame', startMx: e.clientX, startMy: e.clientY, startX: xPct, startY: yPct, startW: 0, startH: 0 }
      }
    }

    function applyDragVisual(el, x, y, w, h) {
      if (!el) return
      el.style.left = `${x}%`
      el.style.top = `${y}%`
      el.style.width = `${w}%`
      el.style.height = `${h}%`
    }

    function onMouseMove(e) {
      const d = dragRef.current
      if (!d) return
      const rect = getRect()
      const dx = e.clientX - d.startMx
      const dy = e.clientY - d.startMy
      const inst = instancesRef.current.find((i) => i.id === d.instId)

      if (d.type === 'move' && inst) {
        const { dxPct, dyPct } = getLocalDeltaFromScreenDelta(dx, dy, inst, instancesRef.current, rect)
        const x = Math.max(0, Math.min(95, d.startX + dxPct))
        const y = Math.max(0, Math.min(95, d.startY + dyPct))
        applyDragVisual(d.dragEl, x, y, d.startW, d.startH)
        d.pending = { x, y }
      } else if (d.type === 'resize' && inst) {
        const { dxPct, dyPct } = getLocalDeltaFromScreenDelta(dx, dy, inst, instancesRef.current, rect)
        const { dwPct, dhPct } = getLocalSizeDeltaFromScreenDelta(dx, dy, inst, instancesRef.current, rect)
        const h = d.handle
        let x = d.startX, y = d.startY, w = d.startW, ht = d.startH
        if (h === 'se') { w = Math.max(4, d.startW + dwPct); ht = Math.max(4, d.startH + dhPct) }
        else if (h === 'sw') { x = d.startX + dxPct; w = Math.max(4, d.startW - dwPct); ht = Math.max(4, d.startH + dhPct) }
        else if (h === 'ne') { y = d.startY + dyPct; w = Math.max(4, d.startW + dwPct); ht = Math.max(4, d.startH - dhPct) }
        else if (h === 'nw') { x = d.startX + dxPct; y = d.startY + dyPct; w = Math.max(4, d.startW - dwPct); ht = Math.max(4, d.startH - dhPct) }
        else if (h === 'n') { y = d.startY + dyPct; ht = Math.max(4, d.startH - dhPct) }
        else if (h === 's') { ht = Math.max(4, d.startH + dhPct) }
        else if (h === 'e') { w = Math.max(4, d.startW + dwPct) }
        else if (h === 'w') { x = d.startX + dxPct; w = Math.max(4, d.startW - dwPct) }
        x = Math.max(0, x)
        y = Math.max(0, y)
        w = Math.min(100, w)
        ht = Math.min(100, ht)
        applyDragVisual(d.dragEl, x, y, w, ht)
        d.pending = { x, y, width: w, height: ht }
      } else if (d.type === 'create') {
        const dxPct = (dx / rect.width) * 100
        const dyPct = (dy / rect.height) * 100
        dragRef.current = { ...d, startW: Math.abs(dxPct), startH: Math.abs(dyPct) }
      }
    }

    function onMouseUp(e) {
      const d = dragRef.current
      if (d && (d.type === 'move' || d.type === 'resize') && d.pending) {
        onUpdateRef.current(d.instId, d.pending)
      }
      if (d && d.type === 'move') {
        const inst = instancesRef.current.find((i) => i.id === d.instId)
        if (inst) {
          const merged = { ...inst, ...d.pending }
          const abs = getAbsoluteBounds(merged, instancesRef.current)
          const centerX = abs.x + abs.width / 2
          const centerY = abs.y + abs.height / 2
          const container = findDeepestContainerAt(instancesRef.current, centerX, centerY, inst.id)
          if (container && container.id !== inst.parentId) {
            const rel = absoluteToParentRelative(abs.x, abs.y, abs.width, abs.height, container, instancesRef.current)
            onUpdateRef.current(inst.id, { parentId: container.id, ...rel })
          } else if (!container && inst.parentId) {
            onUpdateRef.current(inst.id, { parentId: null, x: abs.x, y: abs.y, width: abs.width, height: abs.height })
          }
        }
      }
      if (d && d.type === 'create' && (d.startW > 3 || d.startH > 3)) {
        const rect = getRect()
        const dx = e.clientX - d.startMx
        const dy = e.clientY - d.startMy
        const dxPct = (dx / rect.width) * 100
        const dyPct = (dy / rect.height) * 100
        const x = dxPct < 0 ? d.startX + dxPct : d.startX
        const y = dyPct < 0 ? d.startY + dyPct : d.startY
        const w = Math.max(4, Math.abs(dxPct))
        const h = Math.max(4, Math.abs(dyPct))
        const centerX = x + w / 2
        const centerY = y + h / 2
        const container = findDeepestContainerAt(instancesRef.current, centerX, centerY)
        if (container) {
          const rel = absoluteToParentRelative(x, y, w, h, container, instancesRef.current)
          onCreateRef.current(d.createClass, rel.x, rel.y, rel.width, rel.height, container.id)
        } else {
          onCreateRef.current(d.createClass, Math.max(0, x), Math.max(0, y), w, h, null)
        }
      }
      dragRef.current = null
    }

    canvasEl.addEventListener('mousedown', onCanvasMouseDown)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      canvasEl.removeEventListener('mousedown', onCanvasMouseDown)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, []) // stable — reads everything via refs

  const visualRoots = instances.filter((i) => !i.parentId && CANVAS_VISUAL_CLASSES.has(i.rbxClass))

  function renderCanvasInstance(inst) {
    const meta = RBX_CLASSES[inst.rbxClass] || RBX_CLASSES.Frame
    const active = inst.id === activeId
    const children = instances.filter((i) => i.parentId === inst.id && CANVAS_VISUAL_CLASSES.has(i.rbxClass))
    const isContainer = meta.canHaveChildren
    const hasImage = (inst.rbxClass === 'ImageLabel' || inst.rbxClass === 'ImageButton') && inst.imageDataUrl

    const instStyle = {
      position: 'absolute',
      left: `${inst.x}%`,
      top: `${inst.y}%`,
      width: `${inst.width}%`,
      height: `${inst.height}%`,
      boxSizing: 'border-box',
      border: active ? `2px solid ${meta.color === '#1e3a5f' ? '#60a5fa' : '#a78bfa'}` : `1px solid ${meta.color}88`,
      background: hasImage ? 'transparent' : meta.color + (active ? '30' : '18'),
      cursor: 'move',
      userSelect: 'none',
      display: 'flex',
      alignItems: 'flex-start',
      overflow: isContainer ? 'hidden' : 'hidden'
    }

    return (
      <div key={inst.id} data-inst-id={inst.id} style={instStyle}>
        {hasImage && (
          <img
            src={inst.imageDataUrl}
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
          />
        )}
        <div style={{ fontSize: 9, fontWeight: 700, background: meta.color + 'cc', color: '#eef0f6', padding: '1px 5px', borderRadius: '0 0 4px 0', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none', position: 'relative', zIndex: 1 }}>
          {meta.icon} {inst.name}
        </div>
        {(inst.rbxClass === 'TextLabel' || inst.rbxClass === 'TextButton' || inst.rbxClass === 'TextBox') && inst.properties?.Text && (
          <div style={{ position: 'absolute', bottom: 2, left: 4, right: 4, fontSize: 10, color: '#eef0f6cc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 1 }}>
            {inst.properties.Text}
          </div>
        )}
        {(inst.rbxClass === 'ImageLabel' || inst.rbxClass === 'ImageButton') && !hasImage && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, opacity: 0.3, pointerEvents: 'none' }}>🖼</div>
        )}
        {children.map((child) => renderCanvasInstance(child))}
        {active && RESIZE_HANDLES.map(({ h, style: hPos }) => (
          <div key={h} data-inst-id={inst.id} data-handle={h} style={{ position: 'absolute', width: 8, height: 8, background: '#fff', border: '1px solid #7c3aed', borderRadius: 2, cursor: `${h}-resize`, zIndex: 10, ...hPos }} />
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* The 16:9 viewport */}
      <div
        ref={canvasElRef}
        style={{
          position: 'absolute',
          left: canvasDisplay.left,
          top: canvasDisplay.top,
          width: canvasDisplay.width,
          height: canvasDisplay.height,
          background: '#0a0c12',
          border: '1px solid #2a3040',
          borderRadius: 4,
          cursor: 'crosshair',
          overflow: 'hidden'
        }}
      >
        {/* Grid */}
        <svg key={gridKey} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.12 }}>
          <defs>
            <pattern id="ui-grid" width={canvasDisplay.width / 16} height={canvasDisplay.height / 9} patternUnits="userSpaceOnUse">
              <path d={`M ${canvasDisplay.width / 16} 0 L 0 0 0 ${canvasDisplay.height / 9}`} fill="none" stroke="#6b7280" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ui-grid)" />
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="#6b7280" strokeWidth="0.5" strokeDasharray="4,4" />
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#6b7280" strokeWidth="0.5" strokeDasharray="4,4" />
        </svg>

        {/* Instances — nested hierarchy like Roblox */}
        {visualRoots.map((inst) => renderCanvasInstance(inst))}

        <div style={{ position: 'absolute', bottom: 4, right: 8, fontSize: 9, color: '#555b6e', pointerEvents: 'none' }}>
          1920 × 1080 (scaled)
        </div>
      </div>
    </div>
  )
}

// ─── Properties Panel ─────────────────────────────────────────────────────────

const IMAGE_CLASSES = new Set(['ImageLabel', 'ImageButton'])
const TEXT_CLASSES = new Set(['TextLabel', 'TextButton', 'TextBox'])

function PropertiesPanel({ instance, allInstances, onUpdate, onUpdateProp, onOpenGeneratePanel, onUploadImage, onClearImage, onOpenLayoutGenerate, onCopyPrompt, promptPreview, busy, styles: S, workflow, onUpdateWorkflow, onReparent }) {
  const screenGuiDefaults = workflow.screenGuiDefaults || DEFAULT_WORKFLOW.screenGuiDefaults
  const [showPromptPreview, setShowPromptPreview] = useState(false)

  if (!instance) {
    return (
      <div style={{ fontSize: 12, color: '#555b6e', lineHeight: 1.8 }}>
        <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Project Brief</div>
        <div style={{ fontSize: 11, color: '#7c8499', marginBottom: 12, lineHeight: 1.5 }}>
          These settings feed into Generate when creating full UI layouts or image assets. There is no separate prompt tab — use Generate to copy the layout prompt.
        </div>
        <div style={S.card}>
          <label style={S.label}>Project name</label>
          <input style={S.input} value={workflow.projectName} onChange={(e) => onUpdateWorkflow({ projectName: e.target.value })} placeholder="Project name" />
        </div>
        <div style={S.card}>
          <label style={S.label}>Platform</label>
          <select style={S.select} value={workflow.targetPlatform} onChange={(e) => onUpdateWorkflow({ targetPlatform: e.target.value })}>
            {PLATFORM_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </div>
        <div style={S.card}>
          <label style={S.label}>Visual direction</label>
          <textarea rows={3} style={S.textarea} value={workflow.visualDirection} onChange={(e) => onUpdateWorkflow({ visualDirection: e.target.value })} placeholder="Dark fantasy, neon, minimal..." />
        </div>
        <div style={S.card}>
          <label style={S.label}>Implementation notes</label>
          <textarea rows={2} style={S.textarea} value={workflow.implementationNotes} onChange={(e) => onUpdateWorkflow({ implementationNotes: e.target.value })} placeholder="Extra notes for the AI" />
        </div>
        <div style={S.card}>
          <label style={S.label}>{IMPLICIT_ROOT_LABEL} (implicit root)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>ZIndexBehavior</div>
              <select
                style={S.select}
                value={screenGuiDefaults.ZIndexBehavior || 'Sibling'}
                onChange={(e) => onUpdateWorkflow({ screenGuiDefaults: { ...screenGuiDefaults, ZIndexBehavior: e.target.value } })}
              >
                {['Sibling', 'Global'].map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>DisplayOrder</div>
              <input
                type="number"
                style={S.input}
                value={screenGuiDefaults.DisplayOrder ?? 0}
                onChange={(e) => onUpdateWorkflow({ screenGuiDefaults: { ...screenGuiDefaults, DisplayOrder: Number(e.target.value) } })}
              />
            </div>
          </div>
        </div>
        <button style={{ ...S.primaryBtn, width: '100%', marginBottom: 12 }} onClick={onOpenLayoutGenerate}>
          <Sparkles size={13} /> Generate Layout
        </button>
        <details open={showPromptPreview} onToggle={(e) => setShowPromptPreview(e.target.open)}>
          <summary style={{ fontSize: 10, color: '#7c8499', cursor: 'pointer', fontWeight: 700, marginBottom: 8 }}>Layout prompt preview</summary>
          <textarea readOnly rows={8} style={{ ...S.textarea, color: '#d5d9e5', fontSize: 10 }} value={promptPreview || 'Add instances to build a layout prompt.'} />
          <button style={{ ...S.btn, width: '100%', marginTop: 8 }} onClick={() => onCopyPrompt(promptPreview)}>Copy Prompt</button>
        </details>
        <div style={{ padding: '12px 4px', color: '#555b6e', fontSize: 11 }}>
          Select an instance on the canvas to edit its properties.
        </div>
      </div>
    )
  }

  const meta = RBX_CLASSES[instance.rbxClass] || RBX_CLASSES.Frame
  const isVisual = CANVAS_VISUAL_CLASSES.has(instance.rbxClass)
  const isImage = IMAGE_CLASSES.has(instance.rbxClass)
  const isText = TEXT_CLASSES.has(instance.rbxClass)
  const isGuiObject = GUI_OBJECT_CLASSES.has(instance.rbxClass)
  const isZIndexModifier = ZINDEX_MODIFIER_CLASSES.has(instance.rbxClass)
  const parents = getParentOptions(allInstances, instance.id)

  return (
    <div>
      <div style={{ ...S.card, borderColor: meta.color + '88' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 18 }}>{meta.icon}</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>{instance.rbxClass}</div>
            <div style={{ fontSize: 10, color: '#7c8499' }}>{meta.group}</div>
          </div>
        </div>
        <label style={S.label}>Name</label>
        <input style={S.input} value={instance.name} onChange={(e) => onUpdate(instance.id, { name: e.target.value })} />
        {meta.beta && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 6 }}>Beta instance — requires recent Roblox Studio.</div>}
      </div>

      <div style={S.card}>
        <label style={S.label}>Parent</label>
        <select
          style={S.select}
          value={instance.parentId || ''}
          onChange={(e) => {
            const newParentId = e.target.value || null
            if (onReparent) onReparent(instance.id, newParentId)
            else onUpdate(instance.id, { parentId: newParentId })
          }}
        >
          <option value="">{IMPLICIT_ROOT_LABEL} (root)</option>
          {parents.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.rbxClass})</option>)}
        </select>
        <div style={{ fontSize: 9, color: '#555b6e', marginTop: 6, lineHeight: 1.4 }}>
          Or drag in the hierarchy tree to reparent like Roblox Explorer.
        </div>
      </div>

      {(isGuiObject || isZIndexModifier) && (
        <div style={S.card}>
          <label style={S.label}>Render &amp; Layering</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>ZIndex{isZIndexModifier ? ' (≤0 for shadow)' : ''}</div>
              <input type="number" style={S.input} value={instance.properties.ZIndex ?? (isZIndexModifier ? -1 : 1)} onChange={(e) => onUpdateProp(instance.id, 'ZIndex', Number(e.target.value))} />
            </div>
            {isGuiObject && (
              <div>
                <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>LayoutOrder</div>
                <input type="number" style={S.input} value={instance.properties.LayoutOrder ?? 0} onChange={(e) => onUpdateProp(instance.id, 'LayoutOrder', Number(e.target.value))} />
              </div>
            )}
            {isGuiObject && (
              <div>
                <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Visible</div>
                <select style={S.select} value={String(instance.properties.Visible ?? true)} onChange={(e) => onUpdateProp(instance.id, 'Visible', e.target.value === 'true')}>
                  <option value="true">true</option><option value="false">false</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {isVisual && (
        <div style={S.card}>
          <label style={S.label}>Position &amp; Size (UDim2 scale)</label>
          <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 8, lineHeight: 1.4 }}>
            Relative to {instance.parentId ? 'parent' : 'ScreenGui'}. Offset is always 0 — scale only, like Roblox Studio.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['x', 'X scale'], ['y', 'Y scale'], ['width', 'Width scale'], ['height', 'Height scale']].map(([key, label]) => (
              <div key={key}>
                <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>{label}</div>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  style={S.input}
                  value={pctToScale(instance[key])}
                  onChange={(e) => onUpdate(instance.id, { [key]: scaleToPct(Number(e.target.value)) })}
                />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 9, color: '#64748b', fontFamily: 'monospace', lineHeight: 1.5 }}>
            {formatUDim2Position(instance)}<br />
            {formatUDim2Size(instance)}
          </div>
        </div>
      )}

      {/* Text properties */}
      {isText && (
        <div style={S.card}>
          <label style={S.label}>Text</label>
          <input style={S.input} value={instance.properties.Text || ''} onChange={(e) => onUpdateProp(instance.id, 'Text', e.target.value)} placeholder="Label text" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>TextSize</div>
              <input type="number" style={S.input} value={instance.properties.TextSize || 14} onChange={(e) => onUpdateProp(instance.id, 'TextSize', Number(e.target.value))} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Font</div>
              <select style={S.select} value={instance.properties.FontFace || 'Gotham'} onChange={(e) => onUpdateProp(instance.id, 'FontFace', e.target.value)}>
                {['Gotham','GothamBold','GothamBlack','LegacyArial','Arial','ArialBold','Code','Creepster','DenkOne','Fondamento','FredokaOne','GrenzeGotisch','Highway','IndieFlower','JosefinSans','Kalam','Luckiest Guy','MerriweatherBold','Michroma','Nunito','Oswald','PatrickHand','PermanentMarker','Roboto','RobotoCondensed','RobotoMono','Sarpanch','SourceSansPro','TitilliumWeb','Ubuntu'].map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>TextWrapped</div>
              <select style={S.select} value={String(instance.properties.TextWrapped)} onChange={(e) => onUpdateProp(instance.id, 'TextWrapped', e.target.value === 'true')}>
                <option value="true">true</option><option value="false">false</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>RichText</div>
              <select style={S.select} value={String(instance.properties.RichText)} onChange={(e) => onUpdateProp(instance.id, 'RichText', e.target.value === 'true')}>
                <option value="false">false</option><option value="true">true</option>
              </select>
            </div>
          </div>
          {instance.rbxClass === 'TextBox' && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>PlaceholderText</div>
              <input style={S.input} value={instance.properties.PlaceholderText || ''} onChange={(e) => onUpdateProp(instance.id, 'PlaceholderText', e.target.value)} />
            </div>
          )}
        </div>
      )}

      {/* Image asset */}
      {isImage && (
        <div style={S.card}>
          <label style={S.label}>Image Asset</label>
          {instance.imageDataUrl ? (
            <div style={{ marginBottom: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.3)' }}>
              <img src={instance.imageDataUrl} alt="" style={{ width: '100%', maxHeight: 120, objectFit: 'contain', display: 'block' }} />
            </div>
          ) : (
            <div style={{ marginBottom: 10, padding: 20, borderRadius: 8, border: '1px dashed rgba(255,255,255,0.1)', textAlign: 'center', color: '#555b6e', fontSize: 11 }}>
              No image yet — upload or generate
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <button
              style={{ ...S.btn, flex: 1, minWidth: 90 }}
              onClick={() => onUploadImage(instance.id)}
              disabled={busy === `upload-${instance.id}`}
            >
              <Upload size={12} /> {busy === `upload-${instance.id}` ? 'Uploading…' : 'Upload PNG'}
            </button>
            <button
              style={{ ...S.primaryBtn, flex: 1, minWidth: 90 }}
              onClick={() => onOpenGeneratePanel(instance.id)}
            >
              <Sparkles size={12} /> Generate
            </button>
            {instance.imageDataUrl && (
              <button style={{ ...S.btn, flex: '1 1 100%' }} onClick={() => onClearImage(instance.id)}>
                Clear image
              </button>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>ScaleType</div>
              <select style={S.select} value={instance.properties.ScaleType || 'Stretch'} onChange={(e) => onUpdateProp(instance.id, 'ScaleType', e.target.value)}>
                {['Stretch','Fit','Crop','Slice','Tile'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Transparency</div>
              <input type="number" min={0} max={1} step={0.05} style={S.input} value={instance.properties.BackgroundTransparency ?? 1} onChange={(e) => onUpdateProp(instance.id, 'BackgroundTransparency', Number(e.target.value))} />
            </div>
          </div>
          <details style={{ marginTop: 10 }}>
            <summary style={{ fontSize: 10, color: '#7c8499', cursor: 'pointer', fontWeight: 700 }}>Roblox export (optional)</summary>
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>rbxassetid after upload to Roblox</div>
              <input style={S.input} value={instance.properties.Image || ''} onChange={(e) => onUpdateProp(instance.id, 'Image', e.target.value)} placeholder="rbxassetid://…" />
            </div>
          </details>
        </div>
      )}

      {/* Common visual props */}
      {isVisual && (
        <div style={S.card}>
          <label style={S.label}>Background</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Color3 (R,G,B)</div>
              <input style={S.input} value={instance.properties.BackgroundColor3 || ''} onChange={(e) => onUpdateProp(instance.id, 'BackgroundColor3', e.target.value)} placeholder="{ R:30, G:30, B:40 }" />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Transparency</div>
              <input type="number" min={0} max={1} step={0.05} style={S.input} value={instance.properties.BackgroundTransparency ?? 0} onChange={(e) => onUpdateProp(instance.id, 'BackgroundTransparency', Number(e.target.value))} />
            </div>
          </div>
        </div>
      )}

      {/* ScrollingFrame extras */}
      {instance.rbxClass === 'ScrollingFrame' && (
        <div style={S.card}>
          <label style={S.label}>Scrolling</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Direction</div>
              <select style={S.select} value={instance.properties.ScrollingDirection || 'Y'} onChange={(e) => onUpdateProp(instance.id, 'ScrollingDirection', e.target.value)}>
                {['X','Y','XY'].map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>BarThickness</div>
              <input type="number" style={S.input} value={instance.properties.ScrollBarThickness ?? 6} onChange={(e) => onUpdateProp(instance.id, 'ScrollBarThickness', Number(e.target.value))} />
            </div>
          </div>
        </div>
      )}

      {/* Layout modifier props */}
      {instance.rbxClass === 'UIListLayout' && (
        <div style={S.card}>
          <label style={S.label}>UIListLayout</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>FillDirection</div>
              <select style={S.select} value={instance.properties.FillDirection || 'Vertical'} onChange={(e) => onUpdateProp(instance.id, 'FillDirection', e.target.value)}>
                <option>Horizontal</option><option>Vertical</option>
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Padding</div>
              <input style={S.input} value={instance.properties.Padding || ''} onChange={(e) => onUpdateProp(instance.id, 'Padding', e.target.value)} placeholder="UDim.new(0,4)" />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>HAlign</div>
              <select style={S.select} value={instance.properties.HorizontalAlignment || 'Left'} onChange={(e) => onUpdateProp(instance.id, 'HorizontalAlignment', e.target.value)}>
                {['Left','Center','Right'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>VAlign</div>
              <select style={S.select} value={instance.properties.VerticalAlignment || 'Top'} onChange={(e) => onUpdateProp(instance.id, 'VerticalAlignment', e.target.value)}>
                {['Top','Center','Bottom'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>SortOrder</div>
              <select style={S.select} value={instance.properties.SortOrder || 'LayoutOrder'} onChange={(e) => onUpdateProp(instance.id, 'SortOrder', e.target.value)}>
                {['LayoutOrder', 'Name', 'Custom'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>ItemLineAlignment</div>
              <select style={S.select} value={instance.properties.ItemLineAlignment || 'Automatic'} onChange={(e) => onUpdateProp(instance.id, 'ItemLineAlignment', e.target.value)}>
                {['Automatic', 'Start', 'Center', 'End', 'Stretch'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>HorizontalFlex</div>
              <select style={S.select} value={instance.properties.HorizontalFlex || 'None'} onChange={(e) => onUpdateProp(instance.id, 'HorizontalFlex', e.target.value)}>
                {['None', 'Fill', 'SpaceAround', 'SpaceBetween', 'SpaceEvenly'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>VerticalFlex</div>
              <select style={S.select} value={instance.properties.VerticalFlex || 'None'} onChange={(e) => onUpdateProp(instance.id, 'VerticalFlex', e.target.value)}>
                {['None', 'Fill', 'SpaceAround', 'SpaceBetween', 'SpaceEvenly'].map((v) => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Wraps</div>
              <select style={S.select} value={String(instance.properties.Wraps ?? false)} onChange={(e) => onUpdateProp(instance.id, 'Wraps', e.target.value === 'true')}>
                <option value="false">false</option><option value="true">true</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {instance.rbxClass === 'UICorner' && (
        <div style={S.card}>
          <label style={S.label}>UICorner</label>
          <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 6 }}>CornerRadius (uniform)</div>
          <input style={S.input} value={instance.properties.CornerRadius || ''} onChange={(e) => onUpdateProp(instance.id, 'CornerRadius', e.target.value)} placeholder="UDim.new(0,8)" />
          <div style={{ fontSize: 9, color: '#7c8499', margin: '10px 0 6px' }}>Individual corners (beta, optional)</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['TopLeftRadius', 'Top Left'], ['TopRightRadius', 'Top Right'], ['BottomLeftRadius', 'Bottom Left'], ['BottomRightRadius', 'Bottom Right']].map(([key, label]) => (
              <div key={key}>
                <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>{label}</div>
                <input style={S.input} value={instance.properties[key] || ''} onChange={(e) => onUpdateProp(instance.id, key, e.target.value)} placeholder="UDim.new(0,8)" />
              </div>
            ))}
          </div>
        </div>
      )}

      {instance.rbxClass === 'UIShadow' && (
        <div style={S.card}>
          <label style={S.label}>UIShadow (beta)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>BlurRadius</div><input style={S.input} value={instance.properties.BlurRadius || ''} onChange={(e) => onUpdateProp(instance.id, 'BlurRadius', e.target.value)} placeholder="UDim.new(0,12)" /></div>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Offset</div><input style={S.input} value={instance.properties.Offset || ''} onChange={(e) => onUpdateProp(instance.id, 'Offset', e.target.value)} placeholder="UDim2.new(0,4,0,4)" /></div>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Spread</div><input type="number" style={S.input} value={instance.properties.Spread ?? 0} onChange={(e) => onUpdateProp(instance.id, 'Spread', Number(e.target.value))} /></div>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Transparency</div><input type="number" min={0} max={1} step={0.05} style={S.input} value={instance.properties.Transparency ?? 0.5} onChange={(e) => onUpdateProp(instance.id, 'Transparency', Number(e.target.value))} /></div>
            <div style={{ gridColumn: '1 / -1' }}><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Color</div><input style={S.input} value={instance.properties.Color || ''} onChange={(e) => onUpdateProp(instance.id, 'Color', e.target.value)} placeholder="{ R:0, G:0, B:0 }" /></div>
          </div>
        </div>
      )}

      {instance.rbxClass === 'Path2D' && (
        <div style={S.card}>
          <label style={S.label}>Path2D (beta)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Color3</div><input style={S.input} value={instance.properties.Color3 || ''} onChange={(e) => onUpdateProp(instance.id, 'Color3', e.target.value)} placeholder="{ R:255, G:255, B:255 }" /></div>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Thickness</div><input type="number" style={S.input} value={instance.properties.Thickness ?? 2} onChange={(e) => onUpdateProp(instance.id, 'Thickness', Number(e.target.value))} /></div>
          </div>
        </div>
      )}

      {instance.rbxClass === 'UIStroke' && (
        <div style={S.card}>
          <label style={S.label}>UIStroke</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Thickness</div><input type="number" style={S.input} value={instance.properties.Thickness ?? 1} onChange={(e) => onUpdateProp(instance.id, 'Thickness', Number(e.target.value))} /></div>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Mode</div><select style={S.select} value={instance.properties.ApplyStrokeMode || 'Border'} onChange={(e) => onUpdateProp(instance.id, 'ApplyStrokeMode', e.target.value)}><option>Border</option><option>Contextual</option></select></div>
          </div>
        </div>
      )}

      {instance.rbxClass === 'UIGridLayout' && (
        <div style={S.card}>
          <label style={S.label}>UIGridLayout</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>CellSize</div><input style={S.input} value={instance.properties.CellSize || ''} onChange={(e) => onUpdateProp(instance.id, 'CellSize', e.target.value)} placeholder="UDim2.new(0,100,0,100)" /></div>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>CellPadding</div><input style={S.input} value={instance.properties.CellPadding || ''} onChange={(e) => onUpdateProp(instance.id, 'CellPadding', e.target.value)} placeholder="UDim2.new(0,4,0,4)" /></div>
          </div>
        </div>
      )}

      {instance.rbxClass === 'UIFlexItem' && (
        <div style={S.card}>
          <label style={S.label}>UIFlexItem</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>FlexMode</div><select style={S.select} value={instance.properties.FlexMode || 'Fill'} onChange={(e) => onUpdateProp(instance.id, 'FlexMode', e.target.value)}>{['Fill','Shrink','Grow','Custom'].map((v) => <option key={v}>{v}</option>)}</select></div>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>GrowRatio</div><input type="number" style={S.input} value={instance.properties.GrowRatio ?? 1} onChange={(e) => onUpdateProp(instance.id, 'GrowRatio', Number(e.target.value))} /></div>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>ShrinkRatio</div><input type="number" style={S.input} value={instance.properties.ShrinkRatio ?? 1} onChange={(e) => onUpdateProp(instance.id, 'ShrinkRatio', Number(e.target.value))} /></div>
            <div><div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>ItemLineAlignment</div><select style={S.select} value={instance.properties.ItemLineAlignment || 'Automatic'} onChange={(e) => onUpdateProp(instance.id, 'ItemLineAlignment', e.target.value)}>{['Automatic','Start','Center','End','Stretch'].map((v) => <option key={v}>{v}</option>)}</select></div>
          </div>
        </div>
      )}

      {/* Design notes */}
      <div style={S.card}>
        <label style={S.label}>Design Notes</label>
        <textarea rows={3} style={S.textarea} value={instance.notes || ''} onChange={(e) => onUpdate(instance.id, { notes: e.target.value })} placeholder="Describe this element's look, behaviour, content..." />
      </div>
    </div>
  )
}

// ─── Generate Panel (modal) ───────────────────────────────────────────────────

function GeneratePanel({
  mode,
  targetInstance,
  workflow,
  promptState,
  providers,
  providerSessionState,
  busy,
  onClose,
  onSelectProvider,
  onConnect,
  onRefresh,
  onOpenWorkspace,
  onGenerateLayout,
  onGenerateImage,
  onCopyPrompt,
  styles: S
}) {
  const isLayout = mode === 'layout'
  const isBusy = isLayout ? busy === 'gen' : targetInstance && busy === `img-${targetInstance.id}`
  const [referenceDataUrl, setReferenceDataUrl] = useState(
    () => (!isLayout && targetInstance?.imageDataUrl) || null
  )
  const imagePrompt = targetInstance ? buildImagePrompt(workflow, targetInstance, referenceDataUrl) : ''

  async function uploadReference() {
    if (!window.api?.openImage) return
    const filePath = await window.api.openImage()
    if (!filePath) return
    const result = await window.api.readFileAsDataURL({ filePath })
    if (result?.success) setReferenceDataUrl(result.dataUrl)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'rgba(16, 19, 28, 0.95)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: 20,
          boxShadow: '0 24px 64px rgba(0,0,0,0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#eef0f6', display: 'flex', alignItems: 'center', gap: 8 }}>
              {isLayout ? <LayoutTemplate size={18} className="text-purple-400" /> : <ImageIcon size={18} className="text-purple-400" />}
              {isLayout ? 'Generate UI Layout' : 'Generate Image Asset'}
            </div>
            <div style={{ fontSize: 11, color: '#7c8499', marginTop: 4 }}>
              {isLayout
                ? 'Copy a full layout prompt and open your AI workspace.'
                : targetInstance
                  ? `Create an image for ${targetInstance.name} (${targetInstance.rbxClass}).`
                  : 'Select an ImageLabel or ImageButton first.'}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#7c8499', cursor: 'pointer', padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={S.card}>
          <label style={S.label}>Provider</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {Object.entries(providers).map(([id, provider]) => {
              const active = workflow.provider === id
              const status = providerSessionState[id]
              return (
                <button
                  key={id}
                  onClick={() => onSelectProvider(id)}
                  style={{
                    flex: 1,
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: active ? `1px solid ${provider.accent}` : '1px solid rgba(255,255,255,0.08)',
                    background: active ? `${provider.accent}18` : 'rgba(255,255,255,0.03)',
                    color: '#eef0f6',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {id === 'manus' && <Compass size={12} style={{ color: provider.accent }} />}
                    {id === 'chatgpt-image' && <Sparkle size={12} style={{ color: provider.accent }} />}
                    {provider.label}
                  </div>
                  <div style={{ fontSize: 9, marginTop: 4, color: status?.connected ? '#4ade80' : '#64748b' }}>
                    {status?.connected ? 'Connected' : 'Offline'}
                  </div>
                </button>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <button style={{ ...S.btn, fontSize: 10, padding: '6px 10px' }} onClick={() => onConnect(workflow.provider)}>Connect</button>
            <button style={{ ...S.btn, fontSize: 10, padding: '6px 10px' }} onClick={() => onOpenWorkspace(workflow.provider)}>Workspace</button>
            <button style={{ ...S.btn, fontSize: 10, padding: '6px 10px' }} onClick={() => onRefresh(workflow.provider)}>Refresh</button>
          </div>
        </div>

        {!isLayout && (
          <div style={S.card}>
            <label style={S.label}>Reference Image (optional)</label>
            <div style={{ fontSize: 10, color: '#7c8499', marginBottom: 8, lineHeight: 1.4 }}>
              Attach a style or composition reference. It will be copied to your clipboard when you generate so you can paste it into Manus or ChatGPT.
            </div>
            {referenceDataUrl ? (
              <div style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <img src={referenceDataUrl} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'contain', display: 'block', background: 'rgba(0,0,0,0.3)' }} />
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button style={{ ...S.btn, flex: 1 }} onClick={uploadReference}>
                <Upload size={12} /> Upload reference
              </button>
              {targetInstance?.imageDataUrl && referenceDataUrl !== targetInstance.imageDataUrl && (
                <button style={{ ...S.btn, flex: 1 }} onClick={() => setReferenceDataUrl(targetInstance.imageDataUrl)}>
                  Use instance image
                </button>
              )}
              {referenceDataUrl && (
                <button style={{ ...S.btn, flex: '1 1 100%' }} onClick={() => setReferenceDataUrl(null)}>
                  Remove reference
                </button>
              )}
            </div>
          </div>
        )}

        <div style={S.card}>
          <label style={S.label}>Prompt Preview</label>
          <textarea
            readOnly
            rows={isLayout ? 10 : 8}
            style={{ ...S.textarea, fontSize: 10 }}
            value={isLayout ? (promptState.prompt || 'Add instances to build a layout prompt.') : (imagePrompt || 'No target instance.')}
          />
          <button
            style={{ ...S.btn, width: '100%', marginTop: 8 }}
            onClick={() => onCopyPrompt(isLayout ? promptState.prompt : imagePrompt)}
          >
            <Copy size={12} /> Copy Prompt
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button style={{ ...S.btn, flex: 1 }} onClick={onClose}>Cancel</button>
          <button
            style={{ ...S.primaryBtn, flex: 2 }}
            disabled={isBusy || (!isLayout && !targetInstance) || (isLayout && !promptState.hasContent)}
            onClick={() => {
              if (isLayout) onGenerateLayout()
              else if (targetInstance) onGenerateImage(targetInstance, referenceDataUrl)
            }}
          >
            <Sparkles size={13} />
            {isBusy ? 'Opening…' : isLayout ? 'Generate Layout' : 'Generate Image'}
          </button>
        </div>

        <div style={{ fontSize: 10, color: '#555b6e', marginTop: 12, lineHeight: 1.5 }}>
          {isLayout
            ? 'The layout prompt is copied to your clipboard and your provider workspace opens.'
            : 'Prompt is copied to clipboard. If a reference image is set, it is copied too — paste both into your provider, then upload the result here.'}
        </div>
      </div>
    </div>
  )
}

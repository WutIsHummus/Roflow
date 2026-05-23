/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
}

const CLASS_GROUPS = ['Container', 'Label', 'Button', 'Input', 'Layout', 'Modifier']

const VISUAL_CLASSES = new Set(['ScreenGui','Frame','ScrollingFrame','ViewportFrame','BillboardGui',
  'SurfaceGui','TextLabel','ImageLabel','VideoFrame','TextButton','ImageButton','TextBox'])

// Default props per class
function defaultProps(rbxClass) {
  const base = {
    BackgroundColor3: '{ R:30, G:30, B:40 }',
    BackgroundTransparency: 0,
    BorderSizePixel: 0,
    Visible: true,
    ZIndex: 1
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
      return { FillDirection: 'Vertical', HorizontalAlignment: 'Left', VerticalAlignment: 'Top', Padding: 'UDim.new(0,4)', SortOrder: 'LayoutOrder' }
    case 'UIGridLayout':
      return { CellSize: 'UDim2.new(0,100,0,100)', CellPadding: 'UDim2.new(0,4,0,4)', FillDirection: 'Horizontal', SortOrder: 'LayoutOrder' }
    case 'UICorner':
      return { CornerRadius: 'UDim.new(0,8)' }
    case 'UIStroke':
      return { Color: '{ R:255, G:255, B:255 }', Thickness: 1, Transparency: 0, ApplyStrokeMode: 'Border' }
    case 'UIPadding':
      return { PaddingTop: 'UDim.new(0,8)', PaddingBottom: 'UDim.new(0,8)', PaddingLeft: 'UDim.new(0,8)', PaddingRight: 'UDim.new(0,8)' }
    case 'UIScale':
      return { Scale: 1 }
    case 'UIFlexItem':
      return { FlexMode: 'Fill', GrowRatio: 1, ShrinkRatio: 1 }
    case 'UIAspectRatioConstraint':
      return { AspectRatio: 1, AspectType: 'FitWithinMaxSize', DominantAxis: 'Width' }
    case 'UISizeConstraint':
      return { MinSize: 'Vector2.new(0,0)', MaxSize: 'Vector2.new(math.huge,math.huge)' }
    default:
      return base
  }
}

function createInstance(rbxClass, overrides = {}) {
  const meta = RBX_CLASSES[rbxClass] || RBX_CLASSES.Frame
  const isVisual = VISUAL_CLASSES.has(rbxClass)
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
    notes: '',
    ...overrides
  }
}

function normalizeInstance(inst = {}) {
  return createInstance(inst.rbxClass || 'Frame', inst)
}

const DEFAULT_WORKFLOW = {
  provider: 'manus',
  projectName: '',
  targetPlatform: 'roblox-desktop',
  visualDirection: '',
  implementationNotes: '',
  activeInstanceId: null,
  instances: []
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
  const visualInsts = instances.filter((i) => VISUAL_CLASSES.has(i.rbxClass))
  const modifierInsts = instances.filter((i) => !VISUAL_CLASSES.has(i.rbxClass))

  const header = [
    'Design a Roblox UI layout. Use only the information provided. Do not invent missing details.',
    '',
    workflow.projectName ? `Project: ${workflow.projectName}` : '',
    workflow.targetPlatform ? `Platform: ${workflow.targetPlatform}` : '',
    workflow.visualDirection ? `Visual direction: ${workflow.visualDirection}` : '',
    workflow.implementationNotes ? `Implementation notes: ${workflow.implementationNotes}` : ''
  ].filter(Boolean).join('\n')

  const instLines = visualInsts.map((inst, idx) => {
    const props = Object.entries(inst.properties || {})
      .map(([k, v]) => `    ${k}: ${v}`)
      .join('\n')
    const pos = `position: UDim2.new(${(inst.x / 100).toFixed(2)},0,${(inst.y / 100).toFixed(2)},0)`
    const size = `size: UDim2.new(${(inst.width / 100).toFixed(2)},0,${(inst.height / 100).toFixed(2)},0)`
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
      : '(none)'
    return `[${inst.rbxClass}] on ${parent}${props ? ' — ' + props : ''}`
  })

  const parts = [
    header,
    instLines.length ? `\nInstances:\n${instLines.join('\n\n')}` : '',
    modLines.length ? `\nModifiers:\n${modLines.join('\n')}` : ''
  ].filter(Boolean).join('\n')

  return { prompt: parts, hasContent: instances.length > 0 }
}

function buildImagePrompt(workflow, inst) {
  const meta = RBX_CLASSES[inst.rbxClass]
  const lines = [
    `Generate an image asset for a Roblox ${inst.rbxClass} named "${inst.name}".`,
    '',
    workflow.projectName ? `Project: ${workflow.projectName}` : '',
    workflow.visualDirection ? `Visual direction: ${workflow.visualDirection}` : '',
    inst.notes ? `Design notes: ${inst.notes}` : '',
    inst.properties?.Text ? `Label text: ${inst.properties.Text}` : '',
    `Size context: ${inst.width.toFixed(0)}% × ${inst.height.toFixed(0)}% of screen`,
    '',
    `Render as a flat 2D game UI asset — no 3D, no shadows, no backgrounds unless explicitly described.`,
    `Output: transparent PNG, game-ready, clean edges, Roblox ${meta?.label || inst.rbxClass} style.`
  ].filter(Boolean).join('\n')
  return lines
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = {
  page: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1116' },
  header: { padding: '14px 20px 0', borderBottom: '1px solid #1e2330', flexShrink: 0 },
  title: { fontSize: 16, fontWeight: 700, color: '#eef0f6', margin: 0 },
  body: { flex: 1, display: 'flex', minHeight: 0 },
  rail: { width: 240, borderRight: '1px solid #1e2330', display: 'flex', flexDirection: 'column', minHeight: 0 },
  canvas: { flex: 1, minWidth: 0, background: '#090b0f', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  side: { width: 300, borderLeft: '1px solid #1e2330', overflowY: 'auto', padding: 16 },
  card: { background: '#141821', border: '1px solid #202533', borderRadius: 10, padding: 12, marginBottom: 10 },
  label: { display: 'block', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#7c8499', marginBottom: 5 },
  input: { width: '100%', background: '#0d0f14', border: '1px solid #252a36', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#eef0f6', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
  textarea: { width: '100%', background: '#0d0f14', border: '1px solid #252a36', borderRadius: 8, padding: '7px 10px', fontSize: 11, color: '#c4cad8', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 },
  btn: { border: '1px solid #2a3040', borderRadius: 8, padding: '7px 10px', fontSize: 11, fontWeight: 700, background: '#171b24', color: '#c4cad8', cursor: 'pointer' },
  primaryBtn: { border: 'none', borderRadius: 8, padding: '7px 10px', fontSize: 11, fontWeight: 700, background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', cursor: 'pointer' },
  select: { width: '100%', background: '#0d0f14', border: '1px solid #252a36', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: '#eef0f6', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UIModule({ workflowState, setWorkflowState }) {
  const [uiWorkflow, setUiWorkflow] = useState(() => {
    const saved = workflowState?.uiWorkflow
    if (!saved) return DEFAULT_WORKFLOW
    return {
      ...DEFAULT_WORKFLOW,
      ...saved,
      instances: (saved.instances || []).map(normalizeInstance)
    }
  })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [providerWebConfig, setProviderWebConfig] = useState(DEFAULT_PROVIDER_WEB_CONFIG)
  const [providerWebConfigLoaded, setProviderWebConfigLoaded] = useState(() => !window.api?.configGet)
  const [providerSessionState, setProviderSessionState] = useState(DEFAULT_PROVIDER_SESSION_STATE)
  const [rightTab, setRightTab] = useState('props') // 'props' | 'prompt' | 'session'

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

  useEffect(() => {
    if (!providerWebConfigLoaded || !window.api?.configSet) return
    window.api.configSet('uiProviderWebConfig', providerWebConfig)
  }, [providerWebConfig, providerWebConfigLoaded])

  const activeInstance = useMemo(
    () => uiWorkflow.instances.find((i) => i.id === uiWorkflow.activeInstanceId) || null,
    [uiWorkflow.activeInstanceId, uiWorkflow.instances]
  )
  const promptState = useMemo(() => buildUIPrompt(uiWorkflow), [uiWorkflow])
  const selectedProvider = PROVIDERS[uiWorkflow.provider] || PROVIDERS.manus

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
    const t = window.setTimeout(() => { refreshProviderStatus('manus'); refreshProviderStatus('chatgpt-image') }, 0)
    return () => window.clearTimeout(t)
  }, [providerWebConfigLoaded, refreshProviderStatus])

  const openProviderLogin = useCallback(async (pid) => {
    const options = getProviderWebOptions(pid)
    const result = pid === 'manus' ? await window.api.manusWebOpenLogin(options) : await window.api.chatgptWebOpenLogin(options)
    if (!result?.success) { setNotice(result?.error || 'Could not open provider login.'); return }
    setNotice(pid === 'manus' ? 'Opened Manus login.' : 'Opened ChatGPT login.')
  }, [getProviderWebOptions])

  const openProviderWorkspace = useCallback(async (pid) => {
    const options = getProviderWebOptions(pid)
    const result = pid === 'manus' ? await window.api.manusWebOpenWorkspace(options) : await window.api.chatgptWebOpenWorkspace(options)
    if (!result?.success) { setNotice(result?.error || 'Could not open workspace.'); return false }
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
  }, [copyPrompt, openProviderWorkspace, promptState, uiWorkflow.provider])

  const generateImageFor = useCallback(async (inst) => {
    const text = buildImagePrompt(uiWorkflow, inst)
    setBusy(`img-${inst.id}`)
    const copied = await copyPrompt(text)
    if (!copied) { setBusy(''); return }
    const opened = await openProviderWorkspace(uiWorkflow.provider)
    setBusy('')
    if (!opened) return
    setNotice(`Image prompt for ${inst.name} copied — workspace opened.`)
  }, [copyPrompt, openProviderWorkspace, uiWorkflow])

  const currentProviderStatus = providerSessionState[uiWorkflow.provider] || DEFAULT_PROVIDER_SESSION_STATE.manus
  const providerStatusLabel = currentProviderStatus.loading ? 'Checking...' : currentProviderStatus.connected ? 'Connected' : currentProviderStatus.loginDetected ? 'Login required' : currentProviderStatus.checked ? 'Not connected' : 'Not checked'

  return (
    <div style={S.page}>
      {/* ── Header ── */}
      <div style={S.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div>
            <h1 style={S.title}>UI Studio</h1>
            <p style={{ fontSize: 11, color: '#555b6e', margin: 0 }}>Place Roblox UI instances on the canvas, then generate.</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {Object.entries(PROVIDERS).map(([id, prov]) => {
              const active = uiWorkflow.provider === id
              const status = providerSessionState[id]
              return (
                <button key={id} onClick={() => updateWorkflow({ provider: id })} style={{ ...S.btn, border: active ? `1px solid ${prov.accent}` : '1px solid #2a3040', color: active ? prov.accent : '#c4cad8', position: 'relative' }}>
                  {prov.label}
                  {status?.connected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', position: 'absolute', top: 4, right: 4 }} />}
                </button>
              )
            })}
            <button style={S.primaryBtn} onClick={generate} disabled={busy === 'gen'}>
              {busy === 'gen' ? 'Opening…' : selectedProvider.generateLabel}
            </button>
          </div>
        </div>
        {notice && (
          <div style={{ marginBottom: 10, padding: '7px 12px', borderRadius: 8, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.18)', color: '#c4b5fd', fontSize: 11 }}>
            {notice}
          </div>
        )}
      </div>

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
          />
        </div>

        {/* Canvas */}
        <div style={S.canvas}>
          <UICanvas
            instances={uiWorkflow.instances}
            activeId={uiWorkflow.activeInstanceId}
            onSelect={(id) => updateWorkflow({ activeInstanceId: id })}
            onUpdate={updateInstance}
            onCreate={(rbxClass, x, y, w, h) => {
              const inst = createInstance(rbxClass, { x, y, width: w, height: h })
              setUiWorkflow((p) => ({ ...p, instances: [...p.instances, inst], activeInstanceId: inst.id }))
            }}
            onDeselect={() => updateWorkflow({ activeInstanceId: null })}
          />
        </div>

        {/* Right panel: props / prompt / session */}
        <div style={S.side}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {[['props','Properties'], ['prompt','Prompt'], ['session','Session']].map(([id, label]) => (
              <button key={id} onClick={() => setRightTab(id)} style={{ ...S.btn, flex: 1, fontSize: 10, padding: '5px 6px', border: rightTab === id ? '1px solid #7c3aed' : '1px solid #2a3040', color: rightTab === id ? '#c4b5fd' : '#c4cad8' }}>{label}</button>
            ))}
          </div>

          {rightTab === 'props' && (
            <PropertiesPanel
              instance={activeInstance}
              allInstances={uiWorkflow.instances}
              onUpdate={updateInstance}
              onUpdateProp={updateInstanceProp}
              onGenerateImage={generateImageFor}
              busy={busy}
              styles={S}
              workflow={uiWorkflow}
              onUpdateWorkflow={updateWorkflow}
            />
          )}

          {rightTab === 'prompt' && (
            <div>
              <div style={S.card}>
                <label style={S.label}>Project</label>
                <input style={S.input} value={uiWorkflow.projectName} onChange={(e) => updateWorkflow({ projectName: e.target.value })} placeholder="Project name" />
              </div>
              <div style={S.card}>
                <label style={S.label}>Platform</label>
                <select style={S.select} value={uiWorkflow.targetPlatform} onChange={(e) => updateWorkflow({ targetPlatform: e.target.value })}>
                  {PLATFORM_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
              <div style={S.card}>
                <label style={S.label}>Visual Direction</label>
                <textarea rows={3} style={S.textarea} value={uiWorkflow.visualDirection} onChange={(e) => updateWorkflow({ visualDirection: e.target.value })} placeholder="Dark fantasy, neon, minimal..." />
              </div>
              <div style={S.card}>
                <label style={S.label}>Implementation Notes</label>
                <textarea rows={2} style={S.textarea} value={uiWorkflow.implementationNotes} onChange={(e) => updateWorkflow({ implementationNotes: e.target.value })} placeholder="Any extra notes for the AI" />
              </div>
              <div style={{ ...S.card, marginTop: 4 }}>
                <label style={S.label}>Generated Prompt</label>
                <textarea readOnly rows={14} style={{ ...S.textarea, color: '#d5d9e5' }} value={promptState.prompt || 'Add instances to build a prompt.'} />
                <button style={{ ...S.btn, width: '100%', marginTop: 8 }} onClick={() => copyPrompt(promptState.prompt)}>Copy Prompt</button>
              </div>
            </div>
          )}

          {rightTab === 'session' && (
            <div>
              <div style={S.card}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 10, color: '#7c8499', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Browser session</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: selectedProvider.accent, marginTop: 6 }}>{selectedProvider.label}</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: currentProviderStatus.connected ? '#4ade80' : currentProviderStatus.loginDetected ? '#f59e0b' : '#94a3b8' }}>{providerStatusLabel}</span>
                </div>
                {currentProviderStatus.error && (
                  <div style={{ marginTop: 8, padding: '6px 8px', borderRadius: 8, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.18)', color: '#fca5a5', fontSize: 11 }}>{currentProviderStatus.error}</div>
                )}
                <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                  <button style={S.btn} onClick={() => openProviderLogin(uiWorkflow.provider)}>Connect</button>
                  <button style={S.btn} onClick={() => openProviderWorkspace(uiWorkflow.provider)}>Workspace</button>
                  <button style={S.btn} onClick={() => refreshProviderStatus(uiWorkflow.provider)}>Refresh</button>
                </div>
              </div>
            </div>
          )}
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
              {Object.entries(RBX_CLASSES).filter(([, m]) => m.group === group).map(([cls, meta]) => (
                <button
                  key={cls}
                  title={cls}
                  onClick={() => onAdd(cls)}
                  style={{ fontSize: 10, padding: '3px 7px', borderRadius: 6, background: meta.color + '33', border: `1px solid ${meta.color}55`, color: '#c4cad8', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {meta.icon} {meta.label}
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

function InstanceTree({ instances, activeId, onSelect, onRemove }) {
  const roots = instances.filter((i) => !i.parentId)
  function renderNode(inst, depth = 0) {
    const meta = RBX_CLASSES[inst.rbxClass] || RBX_CLASSES.Frame
    const children = instances.filter((i) => i.parentId === inst.id)
    const active = inst.id === activeId
    return (
      <div key={inst.id}>
        <div
          onClick={() => onSelect(inst.id)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: `3px ${6 + depth * 12}px`, cursor: 'pointer', background: active ? 'rgba(124,58,237,0.15)' : 'transparent', borderLeft: active ? '2px solid #7c3aed' : '2px solid transparent', borderRadius: 4 }}
        >
          <span style={{ fontSize: 11 }}>{meta.icon}</span>
          <span style={{ flex: 1, fontSize: 11, color: active ? '#c4b5fd' : '#c4cad8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inst.name}</span>
          <span style={{ fontSize: 9, color: '#555b6e' }}>{inst.rbxClass}</span>
          <button onClick={(e) => { e.stopPropagation(); onRemove(inst.id) }} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 10, padding: 0 }}>✕</button>
        </div>
        {children.map((c) => renderNode(c, depth + 1))}
      </div>
    )
  }
  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
      {roots.length === 0
        ? <div style={{ fontSize: 11, color: '#555b6e', padding: '8px 10px' }}>No instances yet</div>
        : roots.map((i) => renderNode(i))}
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
        dragRef.current = { type: 'resize', instId, handle, startMx: e.clientX, startMy: e.clientY, startX: inst.x, startY: inst.y, startW: inst.width, startH: inst.height }
        onSelectRef.current(instId)
        e.stopPropagation()
        e.preventDefault()
      } else if (instEl) {
        const instId = instEl.dataset.instId
        const inst = instancesRef.current.find((i) => i.id === instId)
        if (!inst) return
        dragRef.current = { type: 'move', instId, startMx: e.clientX, startMy: e.clientY, startX: inst.x, startY: inst.y, startW: inst.width, startH: inst.height }
        onSelectRef.current(instId)
        e.preventDefault()
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

    function onMouseMove(e) {
      const d = dragRef.current
      if (!d) return
      const rect = getRect()
      const dx = e.clientX - d.startMx
      const dy = e.clientY - d.startMy
      const dxPct = (dx / rect.width) * 100
      const dyPct = (dy / rect.height) * 100

      if (d.type === 'move') {
        onUpdateRef.current(d.instId, { x: Math.max(0, Math.min(90, d.startX + dxPct)), y: Math.max(0, Math.min(90, d.startY + dyPct)) })
      } else if (d.type === 'resize') {
        const h = d.handle
        let x = d.startX, y = d.startY, w = d.startW, ht = d.startH
        if (h === 'se') { w = Math.max(4, d.startW + dxPct); ht = Math.max(4, d.startH + dyPct) }
        else if (h === 'sw') { x = d.startX + dxPct; w = Math.max(4, d.startW - dxPct); ht = Math.max(4, d.startH + dyPct) }
        else if (h === 'ne') { y = d.startY + dyPct; w = Math.max(4, d.startW + dxPct); ht = Math.max(4, d.startH - dyPct) }
        else if (h === 'nw') { x = d.startX + dxPct; y = d.startY + dyPct; w = Math.max(4, d.startW - dxPct); ht = Math.max(4, d.startH - dyPct) }
        else if (h === 'n') { y = d.startY + dyPct; ht = Math.max(4, d.startH - dyPct) }
        else if (h === 's') { ht = Math.max(4, d.startH + dyPct) }
        else if (h === 'e') { w = Math.max(4, d.startW + dxPct) }
        else if (h === 'w') { x = d.startX + dxPct; w = Math.max(4, d.startW - dxPct) }
        onUpdateRef.current(d.instId, { x: Math.max(0, x), y: Math.max(0, y), width: Math.min(100, w), height: Math.min(100, ht) })
      } else if (d.type === 'create') {
        dragRef.current = { ...d, startW: Math.abs(dxPct), startH: Math.abs(dyPct) }
      }
    }

    function onMouseUp(e) {
      const d = dragRef.current
      if (d && d.type === 'create' && (d.startW > 3 || d.startH > 3)) {
        const rect = getRect()
        const dx = e.clientX - d.startMx
        const dy = e.clientY - d.startMy
        const dxPct = (dx / rect.width) * 100
        const dyPct = (dy / rect.height) * 100
        const x = dxPct < 0 ? d.startX + dxPct : d.startX
        const y = dyPct < 0 ? d.startY + dyPct : d.startY
        onCreateRef.current(d.createClass, Math.max(0, x), Math.max(0, y), Math.max(4, Math.abs(dxPct)), Math.max(4, Math.abs(dyPct)))
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

  const visualInstances = instances.filter((i) => VISUAL_CLASSES.has(i.rbxClass))

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

        {/* Instances — no mouse event props; all handled by effect via data attributes */}
        {visualInstances.map((inst) => {
          const meta = RBX_CLASSES[inst.rbxClass] || RBX_CLASSES.Frame
          const active = inst.id === activeId
          const instStyle = {
            position: 'absolute',
            left: `${inst.x}%`,
            top: `${inst.y}%`,
            width: `${inst.width}%`,
            height: `${inst.height}%`,
            boxSizing: 'border-box',
            border: active ? `2px solid ${meta.color === '#1e3a5f' ? '#60a5fa' : '#a78bfa'}` : `1px solid ${meta.color}88`,
            background: meta.color + (active ? '30' : '18'),
            cursor: 'move',
            userSelect: 'none',
            display: 'flex',
            alignItems: 'flex-start',
            overflow: 'hidden'
          }
          return (
            <div key={inst.id} data-inst-id={inst.id} style={instStyle}>
              <div style={{ fontSize: 9, fontWeight: 700, background: meta.color + 'cc', color: '#eef0f6', padding: '1px 5px', borderRadius: '0 0 4px 0', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                {meta.icon} {inst.name}
              </div>
              {(inst.rbxClass === 'TextLabel' || inst.rbxClass === 'TextButton' || inst.rbxClass === 'TextBox') && inst.properties?.Text && (
                <div style={{ position: 'absolute', bottom: 2, left: 4, right: 4, fontSize: 10, color: '#eef0f6cc', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
                  {inst.properties.Text}
                </div>
              )}
              {(inst.rbxClass === 'ImageLabel' || inst.rbxClass === 'ImageButton') && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, opacity: 0.3, pointerEvents: 'none' }}>🖼</div>
              )}
              {active && RESIZE_HANDLES.map(({ h, style: hPos }) => (
                <div key={h} data-inst-id={inst.id} data-handle={h} style={{ position: 'absolute', width: 8, height: 8, background: '#fff', border: '1px solid #7c3aed', borderRadius: 2, cursor: `${h}-resize`, zIndex: 10, ...hPos }} />
              ))}
            </div>
          )
        })}

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

function PropertiesPanel({ instance, allInstances, onUpdate, onUpdateProp, onGenerateImage, busy, styles: S, workflow, onUpdateWorkflow }) {
  if (!instance) {
    return (
      <div style={{ fontSize: 12, color: '#555b6e', lineHeight: 1.8 }}>
        <div style={{ marginBottom: 10, fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Project</div>
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
        <div style={{ padding: '12px 4px', color: '#555b6e', fontSize: 11 }}>
          Select an instance or click the canvas to add one.
        </div>
      </div>
    )
  }

  const meta = RBX_CLASSES[instance.rbxClass] || RBX_CLASSES.Frame
  const isVisual = VISUAL_CLASSES.has(instance.rbxClass)
  const isImage = IMAGE_CLASSES.has(instance.rbxClass)
  const isText = TEXT_CLASSES.has(instance.rbxClass)
  const parents = allInstances.filter((i) => i.id !== instance.id && RBX_CLASSES[i.rbxClass]?.canHaveChildren)

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
      </div>

      {isVisual && (
        <div style={S.card}>
          <label style={S.label}>Parent</label>
          <select style={S.select} value={instance.parentId || ''} onChange={(e) => onUpdate(instance.id, { parentId: e.target.value || null })}>
            <option value="">ScreenGui (root)</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.rbxClass})</option>)}
          </select>
        </div>
      )}

      {isVisual && (
        <div style={S.card}>
          <label style={S.label}>Position &amp; Size (%)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {[['x','X','%'],['y','Y','%'],['width','W','%'],['height','H','%']].map(([key, label]) => (
              <div key={key}>
                <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>{label}</div>
                <input type="number" style={S.input} value={Number(instance[key]).toFixed(1)} onChange={(e) => onUpdate(instance.id, { [key]: Number(e.target.value) })} />
              </div>
            ))}
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

      {/* Image properties */}
      {isImage && (
        <div style={S.card}>
          <label style={S.label}>Image</label>
          <input style={S.input} value={instance.properties.Image || ''} onChange={(e) => onUpdateProp(instance.id, 'Image', e.target.value)} placeholder="rbxassetid://..." />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
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
          <button
            style={{ ...S.primaryBtn, width: '100%', marginTop: 10 }}
            onClick={() => onGenerateImage(instance)}
            disabled={busy === `img-${instance.id}`}
          >
            {busy === `img-${instance.id}` ? 'Opening…' : '✨ Generate image for this'}
          </button>
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>ZIndex</div>
              <input type="number" style={S.input} value={instance.properties.ZIndex ?? 1} onChange={(e) => onUpdateProp(instance.id, 'ZIndex', Number(e.target.value))} />
            </div>
            <div>
              <div style={{ fontSize: 9, color: '#7c8499', marginBottom: 3 }}>Visible</div>
              <select style={S.select} value={String(instance.properties.Visible ?? true)} onChange={(e) => onUpdateProp(instance.id, 'Visible', e.target.value === 'true')}>
                <option value="true">true</option><option value="false">false</option>
              </select>
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
          </div>
        </div>
      )}

      {instance.rbxClass === 'UICorner' && (
        <div style={S.card}>
          <label style={S.label}>CornerRadius</label>
          <input style={S.input} value={instance.properties.CornerRadius || ''} onChange={(e) => onUpdateProp(instance.id, 'CornerRadius', e.target.value)} placeholder="UDim.new(0,8)" />
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

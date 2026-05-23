/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'

let nextFrameId = 1
let nextComponentId = 1
let nextInteractionId = 1

function createComponent(overrides = {}) {
  return {
    id: `ui-component-${nextComponentId++}`,
    name: '',
    type: '',
    purpose: '',
    styleNotes: '',
    states: '',
    ...overrides
  }
}

function createInteraction(overrides = {}) {
  return {
    id: `ui-interaction-${nextInteractionId++}`,
    name: '',
    trigger: '',
    response: '',
    feedback: '',
    notes: '',
    ...overrides
  }
}

function createFrame(overrides = {}) {
  return {
    id: `ui-frame-${nextFrameId++}`,
    name: '',
    surface: 'hud',
    objective: '',
    layoutNotes: '',
    visualNotes: '',
    motionNotes: '',
    states: '',
    referenceImagePath: null,
    referenceDataUrl: null,
    components: [],
    interactions: [],
    ...overrides
  }
}

function normalizeComponent(component = {}) {
  return createComponent(component)
}

function normalizeInteraction(interaction = {}) {
  return createInteraction(interaction)
}

function normalizeFrame(frame = {}) {
  return createFrame({
    ...frame,
    components: (frame.components || []).map(normalizeComponent),
    interactions: (frame.interactions || []).map(normalizeInteraction)
  })
}

const DEFAULT_WORKFLOW = {
  provider: 'manus',
  activeStep: 'frames',
  projectName: '',
  audience: '',
  targetPlatform: 'roblox-desktop',
  visualDirection: '',
  animationDirection: '',
  implementationNotes: '',
  activeFrameId: null,
  screens: []
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

const STEP_CONFIG = [
  { id: 'frames', label: '1. Frames' },
  { id: 'components', label: '2. Components' },
  { id: 'interactivity', label: '3. Interactivity' }
]

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

function compactLines(lines) {
  return lines.filter(Boolean).join('\n')
}

function formatSection(title, entries) {
  if (!entries.length) return ''
  return `${title}\n${entries.join('\n')}`
}

function summarizeComponent(component, index) {
  return compactLines([
    `${index + 1}. ${component.name || 'Component'}`,
    component.type ? `type: ${component.type}` : '',
    component.purpose ? `purpose: ${component.purpose}` : '',
    component.styleNotes ? `style: ${component.styleNotes}` : '',
    component.states ? `states: ${component.states}` : ''
  ])
}

function summarizeInteraction(interaction, index) {
  return compactLines([
    `${index + 1}. ${interaction.name || 'Interaction'}`,
    interaction.trigger ? `trigger: ${interaction.trigger}` : '',
    interaction.response ? `response: ${interaction.response}` : '',
    interaction.feedback ? `feedback: ${interaction.feedback}` : '',
    interaction.notes ? `notes: ${interaction.notes}` : ''
  ])
}

function buildCurrentPrompt(workflow, activeFrame) {
  if (!activeFrame) {
    return { prompt: '', hasContent: false }
  }

  const baseContext = [
    workflow.projectName ? `project: ${workflow.projectName}` : '',
    workflow.audience ? `audience: ${workflow.audience}` : '',
    workflow.targetPlatform ? `platform: ${workflow.targetPlatform}` : '',
    workflow.visualDirection ? `visual direction: ${workflow.visualDirection}` : '',
    workflow.animationDirection ? `animation direction: ${workflow.animationDirection}` : '',
    workflow.implementationNotes ? `implementation notes: ${workflow.implementationNotes}` : ''
  ].filter(Boolean)

  const frameContext = [
    activeFrame.name ? `frame name: ${activeFrame.name}` : '',
    activeFrame.surface ? `surface: ${activeFrame.surface}` : '',
    activeFrame.objective ? `objective: ${activeFrame.objective}` : '',
    activeFrame.layoutNotes ? `layout: ${activeFrame.layoutNotes}` : '',
    activeFrame.visualNotes ? `visuals: ${activeFrame.visualNotes}` : '',
    activeFrame.motionNotes ? `motion: ${activeFrame.motionNotes}` : '',
    activeFrame.states ? `states: ${activeFrame.states}` : ''
  ].filter(Boolean)

  const componentEntries = (activeFrame.components || [])
    .map(summarizeComponent)
    .filter(Boolean)
  const interactionEntries = (activeFrame.interactions || [])
    .map(summarizeInteraction)
    .filter(Boolean)

  let instruction = ''
  let promptBody = []

  if (workflow.activeStep === 'frames') {
    instruction =
      workflow.provider === 'chatgpt-image'
        ? 'Create a Roblox UI frame image. Use only the information below. Do not invent missing details.'
        : 'Design a Roblox UI frame. Use only the information below. Do not invent missing details.'
    promptBody = [...baseContext, ...frameContext]
  } else if (workflow.activeStep === 'components') {
    instruction =
      'Generate reusable Roblox UI components for this frame. Use only the information below. Do not invent missing details.'
    promptBody = [
      ...baseContext,
      ...frameContext,
      formatSection('components', componentEntries)
    ].filter(Boolean)
  } else {
    instruction =
      'Define UI interactivity and motion for this frame. Use only the information below. Do not invent missing details.'
    promptBody = [
      ...baseContext,
      ...frameContext,
      formatSection('interactions', interactionEntries)
    ].filter(Boolean)
  }

  const hasContent = promptBody.length > 0
  if (!hasContent) {
    return { prompt: '', hasContent: false }
  }

  return {
    prompt: compactLines([instruction, '', ...promptBody]),
    hasContent: true
  }
}

const SHELL = {
  page: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1116' },
  header: { padding: '20px 24px 0', borderBottom: '1px solid #1e2330', flexShrink: 0 },
  title: { fontSize: 18, fontWeight: 700, color: '#eef0f6', margin: 0 },
  subtitle: { fontSize: 13, color: '#555b6e', marginTop: 4, lineHeight: 1.6 },
  body: { flex: 1, display: 'flex', minHeight: 0 },
  rail: {
    width: 280,
    borderRight: '1px solid #1e2330',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0
  },
  editor: { flex: 1, minWidth: 0, overflowY: 'auto', padding: 24 },
  side: { width: 360, borderLeft: '1px solid #1e2330', overflowY: 'auto', padding: 20 },
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
    color: '#c4cad8',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
    lineHeight: 1.6
  },
  label: {
    display: 'block',
    fontSize: 11,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#7c8499',
    marginBottom: 7
  },
  button: {
    border: '1px solid #2a3040',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 700,
    background: '#171b24',
    color: '#c4cad8',
    cursor: 'pointer'
  },
  primaryButton: {
    border: 'none',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 12,
    fontWeight: 700,
    background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
    color: '#fff',
    cursor: 'pointer'
  }
}

export default function UIModule({ workflowState, setWorkflowState, onChangeModule }) {
  const [uiWorkflow, setUiWorkflow] = useState(() => {
    const saved = workflowState?.uiWorkflow
    if (!saved) return DEFAULT_WORKFLOW

    const normalizedScreens = (saved.screens || []).map(normalizeFrame)
    return {
      ...DEFAULT_WORKFLOW,
      ...saved,
      screens: normalizedScreens,
      activeFrameId: saved.activeFrameId || normalizedScreens[0]?.id || null
    }
  })
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [providerWebConfig, setProviderWebConfig] = useState(DEFAULT_PROVIDER_WEB_CONFIG)
  const [providerWebConfigLoaded, setProviderWebConfigLoaded] = useState(
    () => !window.api?.configGet
  )
  const [providerSessionState, setProviderSessionState] = useState(DEFAULT_PROVIDER_SESSION_STATE)

  useEffect(() => {
    if (!setWorkflowState) return
    setWorkflowState((prev) => ({ ...prev, uiWorkflow }))
  }, [uiWorkflow, setWorkflowState])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 2200)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    let active = true
    if (!window.api?.configGet) return undefined

    window.api
      .configGet('uiProviderWebConfig')
      .then((saved) => {
        if (!active) return
        if (saved && typeof saved === 'object') {
          setProviderWebConfig((prev) => ({ ...prev, ...saved }))
        }
        setProviderWebConfigLoaded(true)
      })
      .catch(() => {
        if (active) setProviderWebConfigLoaded(true)
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!providerWebConfigLoaded || !window.api?.configSet) return
    window.api.configSet('uiProviderWebConfig', providerWebConfig)
  }, [providerWebConfig, providerWebConfigLoaded])

  const activeFrameId = uiWorkflow.activeFrameId || uiWorkflow.screens[0]?.id || null
  const activeFrame = useMemo(
    () => uiWorkflow.screens.find((frame) => frame.id === activeFrameId) || null,
    [activeFrameId, uiWorkflow.screens]
  )
  const currentPromptState = useMemo(
    () => buildCurrentPrompt(uiWorkflow, activeFrame),
    [uiWorkflow, activeFrame]
  )
  const selectedProvider = PROVIDERS[uiWorkflow.provider] || PROVIDERS.manus

  const updateWorkflow = useCallback((changes) => {
    setUiWorkflow((prev) => ({ ...prev, ...changes }))
  }, [])

  const updateFrame = useCallback((frameId, changes) => {
    setUiWorkflow((prev) => ({
      ...prev,
      screens: prev.screens.map((frame) => (frame.id === frameId ? { ...frame, ...changes } : frame))
    }))
  }, [])

  const addFrame = useCallback(() => {
    const nextFrame = createFrame()
    setUiWorkflow((prev) => ({
      ...prev,
      screens: [...prev.screens, nextFrame],
      activeFrameId: nextFrame.id
    }))
  }, [])

  const removeFrame = useCallback((frameId) => {
    setUiWorkflow((prev) => {
      const screens = prev.screens.filter((frame) => frame.id !== frameId)
      return {
        ...prev,
        screens,
        activeFrameId: prev.activeFrameId === frameId ? screens[0]?.id || null : prev.activeFrameId
      }
    })
  }, [])

  const addComponent = useCallback(() => {
    if (!activeFrameId) return
    const nextComponent = createComponent()
    setUiWorkflow((prev) => ({
      ...prev,
      screens: prev.screens.map((frame) =>
        frame.id === activeFrameId
          ? { ...frame, components: [...frame.components, nextComponent] }
          : frame
      )
    }))
  }, [activeFrameId])

  const updateComponent = useCallback((componentId, changes) => {
    if (!activeFrameId) return
    setUiWorkflow((prev) => ({
      ...prev,
      screens: prev.screens.map((frame) =>
        frame.id === activeFrameId
          ? {
              ...frame,
              components: frame.components.map((component) =>
                component.id === componentId ? { ...component, ...changes } : component
              )
            }
          : frame
      )
    }))
  }, [activeFrameId])

  const removeComponent = useCallback((componentId) => {
    if (!activeFrameId) return
    setUiWorkflow((prev) => ({
      ...prev,
      screens: prev.screens.map((frame) =>
        frame.id === activeFrameId
          ? {
              ...frame,
              components: frame.components.filter((component) => component.id !== componentId)
            }
          : frame
      )
    }))
  }, [activeFrameId])

  const addInteraction = useCallback(() => {
    if (!activeFrameId) return
    const nextInteraction = createInteraction()
    setUiWorkflow((prev) => ({
      ...prev,
      screens: prev.screens.map((frame) =>
        frame.id === activeFrameId
          ? { ...frame, interactions: [...frame.interactions, nextInteraction] }
          : frame
      )
    }))
  }, [activeFrameId])

  const updateInteraction = useCallback((interactionId, changes) => {
    if (!activeFrameId) return
    setUiWorkflow((prev) => ({
      ...prev,
      screens: prev.screens.map((frame) =>
        frame.id === activeFrameId
          ? {
              ...frame,
              interactions: frame.interactions.map((interaction) =>
                interaction.id === interactionId ? { ...interaction, ...changes } : interaction
              )
            }
          : frame
      )
    }))
  }, [activeFrameId])

  const removeInteraction = useCallback((interactionId) => {
    if (!activeFrameId) return
    setUiWorkflow((prev) => ({
      ...prev,
      screens: prev.screens.map((frame) =>
        frame.id === activeFrameId
          ? {
              ...frame,
              interactions: frame.interactions.filter((interaction) => interaction.id !== interactionId)
            }
          : frame
      )
    }))
  }, [activeFrameId])

  const attachReference = useCallback(
    async (frameId) => {
      setBusy(`ref-${frameId}`)
      const filePath = await window.api.openImage()
      if (!filePath) {
        setBusy('')
        return
      }

      const result = await window.api.readFileAsDataURL({ filePath })
      setBusy('')
      if (!result.success) {
        setNotice(result.error || 'Could not load reference image.')
        return
      }

      updateFrame(frameId, {
        referenceImagePath: filePath,
        referenceDataUrl: result.dataUrl
      })
      setNotice('Reference image attached.')
    },
    [updateFrame]
  )

  const removeReference = useCallback(
    (frameId) => {
      updateFrame(frameId, {
        referenceImagePath: null,
        referenceDataUrl: null
      })
      setNotice('Reference image removed.')
    },
    [updateFrame]
  )

  const getProviderWebOptions = useCallback(
    (providerId) => {
      if (providerId === 'manus') {
        return {
          loginUrl: providerWebConfig.manusLoginUrl,
          workspaceUrl: providerWebConfig.manusWorkspaceUrl
        }
      }

      return {
        loginUrl: providerWebConfig.chatgptLoginUrl,
        workspaceUrl: providerWebConfig.chatgptWorkspaceUrl
      }
    },
    [providerWebConfig]
  )

  const refreshProviderStatus = useCallback(
    async (providerId) => {
      const options = getProviderWebOptions(providerId)
      setProviderSessionState((prev) => ({
        ...prev,
        [providerId]: { ...prev[providerId], loading: true, error: null }
      }))

      const result =
        providerId === 'manus'
          ? await window.api.manusWebSessionStatus(options)
          : await window.api.chatgptWebSessionStatus(options)

      setProviderSessionState((prev) => ({
        ...prev,
        [providerId]: {
          checked: true,
          loading: false,
          connected: Boolean(result?.connected),
          loginDetected: Boolean(result?.loginDetected),
          cookieCount: Number(result?.cookieCount || 0),
          promptCandidates: Number(result?.promptCandidates || 0),
          error: result?.success === false ? result.error || 'Session check failed.' : null
        }
      }))
    },
    [getProviderWebOptions]
  )

  useEffect(() => {
    if (!providerWebConfigLoaded) return
    const timeout = window.setTimeout(() => {
      refreshProviderStatus('manus')
      refreshProviderStatus('chatgpt-image')
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [providerWebConfigLoaded, refreshProviderStatus])

  const openProviderLogin = useCallback(
    async (providerId) => {
      const options = getProviderWebOptions(providerId)
      const result =
        providerId === 'manus'
          ? await window.api.manusWebOpenLogin(options)
          : await window.api.chatgptWebOpenLogin(options)

      if (!result?.success) {
        setNotice(result?.error || 'Could not open provider login.')
        return
      }

      setNotice(providerId === 'manus' ? 'Opened Manus login.' : 'Opened ChatGPT login.')
    },
    [getProviderWebOptions]
  )

  const openProviderWorkspace = useCallback(
    async (providerId) => {
      const options = getProviderWebOptions(providerId)
      const result =
        providerId === 'manus'
          ? await window.api.manusWebOpenWorkspace(options)
          : await window.api.chatgptWebOpenWorkspace(options)

      if (!result?.success) {
        setNotice(result?.error || 'Could not open provider workspace.')
        return false
      }

      return true
    },
    [getProviderWebOptions]
  )

  const copyCurrentPrompt = useCallback(async () => {
    if (!currentPromptState.hasContent) {
      setNotice('Fill in the current step first.')
      return false
    }

    const result = await window.api.copyText(currentPromptState.prompt)
    if (!result?.success) {
      setNotice(result?.error || 'Could not copy prompt.')
      return false
    }

    return true
  }, [currentPromptState])

  const generateCurrentStep = useCallback(async () => {
    const copied = await copyCurrentPrompt()
    if (!copied) return

    const opened = await openProviderWorkspace(uiWorkflow.provider)
    if (!opened) return

    setNotice('Prompt copied and workspace opened.')
  }, [copyCurrentPrompt, openProviderWorkspace, uiWorkflow.provider])

  const currentProviderStatus =
    providerSessionState[uiWorkflow.provider] || DEFAULT_PROVIDER_SESSION_STATE.manus
  const providerStatusLabel = currentProviderStatus.loading
    ? 'Checking...'
    : currentProviderStatus.connected
      ? 'Connected'
      : currentProviderStatus.loginDetected
        ? 'Login required'
        : currentProviderStatus.checked
          ? 'Not connected'
          : 'Not checked'

  return (
    <div style={SHELL.page}>
      <div style={SHELL.header}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 14
          }}
        >
          <div>
            <h1 style={SHELL.title}>UI Studio</h1>
            <p style={SHELL.subtitle}>
              Fill the current step, then press generate. The prompt only uses what you entered.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={SHELL.button} onClick={() => onChangeModule?.('playground')}>
              Open Playground
            </button>
            <button style={SHELL.primaryButton} onClick={generateCurrentStep}>
              {selectedProvider.generateLabel}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10,
            marginBottom: 10
          }}
        >
          {Object.entries(PROVIDERS).map(([id, provider]) => {
            const active = uiWorkflow.provider === id
            const status = providerSessionState[id]
            return (
              <button
                key={id}
                onClick={() => updateWorkflow({ provider: id })}
                style={{
                  ...SHELL.card,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: active ? `1px solid ${provider.accent}` : '1px solid #202533'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  <strong style={{ color: '#eef0f6', fontSize: 14 }}>{provider.label}</strong>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: status?.connected ? '#4ade80' : '#6b7280',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}
                  >
                    {status?.connected ? 'Connected' : 'Selected'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 10,
            marginBottom: 14
          }}
        >
          {STEP_CONFIG.map((step) => {
            const active = uiWorkflow.activeStep === step.id
            return (
              <button
                key={step.id}
                onClick={() => updateWorkflow({ activeStep: step.id })}
                style={{
                  ...SHELL.card,
                  cursor: 'pointer',
                  textAlign: 'left',
                  border: active ? '1px solid #7c3aed' : '1px solid #202533'
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>{step.label}</div>
              </button>
            )
          })}
        </div>

        {notice && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.18)',
              color: '#c4b5fd',
              fontSize: 12
            }}
          >
            {notice}
          </div>
        )}
      </div>

      <div style={SHELL.body}>
        <div style={SHELL.rail}>
          <div style={{ padding: 16, borderBottom: '1px solid #1e2330' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>Frames</div>
              <button style={SHELL.primaryButton} onClick={addFrame}>
                Add Frame
              </button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
            {uiWorkflow.screens.length ? (
              uiWorkflow.screens.map((frame) => {
                const active = frame.id === activeFrameId
                return (
                  <div
                    key={frame.id}
                    onClick={() => updateWorkflow({ activeFrameId: frame.id })}
                    style={{
                      ...SHELL.card,
                      marginBottom: 10,
                      cursor: 'pointer',
                      border: active ? '1px solid #7c3aed' : '1px solid #202533'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: '#eef0f6',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                        >
                          {frame.name || 'Untitled frame'}
                        </div>
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                          {frame.surface}
                        </div>
                      </div>
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          removeFrame(frame.id)
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#6b7280',
                          cursor: 'pointer',
                          fontSize: 11
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                )
              })
            ) : (
              <EmptyCard text="Add a frame to start." />
            )}
          </div>
        </div>

        <div style={SHELL.editor}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 14,
              marginBottom: 16
            }}
          >
            <FieldCard label="Project name">
              <input
                style={SHELL.input}
                value={uiWorkflow.projectName}
                onChange={(event) => updateWorkflow({ projectName: event.target.value })}
                placeholder="Project name"
              />
            </FieldCard>
            <FieldCard label="Target platform">
              <select
                style={SHELL.input}
                value={uiWorkflow.targetPlatform}
                onChange={(event) => updateWorkflow({ targetPlatform: event.target.value })}
              >
                {PLATFORM_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </FieldCard>
            <FieldCard label="Visual direction">
              <textarea
                rows={3}
                style={SHELL.textarea}
                value={uiWorkflow.visualDirection}
                onChange={(event) => updateWorkflow({ visualDirection: event.target.value })}
                placeholder="Visual direction"
              />
            </FieldCard>
            <FieldCard label="Animation direction">
              <textarea
                rows={3}
                style={SHELL.textarea}
                value={uiWorkflow.animationDirection}
                onChange={(event) => updateWorkflow({ animationDirection: event.target.value })}
                placeholder="Animation direction"
              />
            </FieldCard>
          </div>

          {activeFrame ? (
            <div style={SHELL.card}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 14
                }}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#eef0f6' }}>
                    {activeFrame.name || 'Untitled frame'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                    Edit the current step and then press generate.
                  </div>
                </div>
                <button style={SHELL.primaryButton} onClick={generateCurrentStep}>
                  {selectedProvider.generateLabel}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={SHELL.label}>Frame name</label>
                  <input
                    style={SHELL.input}
                    value={activeFrame.name}
                    onChange={(event) => updateFrame(activeFrame.id, { name: event.target.value })}
                    placeholder="Frame name"
                  />
                </div>
                <div>
                  <label style={SHELL.label}>Surface</label>
                  <select
                    style={SHELL.input}
                    value={activeFrame.surface}
                    onChange={(event) => updateFrame(activeFrame.id, { surface: event.target.value })}
                  >
                    <option value="hud">HUD</option>
                    <option value="menu">Menu</option>
                    <option value="shop">Shop</option>
                    <option value="inventory">Inventory</option>
                    <option value="modal">Modal</option>
                    <option value="reward">Reward</option>
                  </select>
                </div>
              </div>

              {uiWorkflow.activeStep === 'frames' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={SHELL.label}>Objective</label>
                      <textarea
                        rows={3}
                        style={SHELL.textarea}
                        value={activeFrame.objective}
                        onChange={(event) => updateFrame(activeFrame.id, { objective: event.target.value })}
                        placeholder="What this frame needs to do"
                      />
                    </div>
                    <div>
                      <label style={SHELL.label}>Layout</label>
                      <textarea
                        rows={5}
                        style={SHELL.textarea}
                        value={activeFrame.layoutNotes}
                        onChange={(event) => updateFrame(activeFrame.id, { layoutNotes: event.target.value })}
                        placeholder="Layout details"
                      />
                    </div>
                    <div>
                      <label style={SHELL.label}>Visuals</label>
                      <textarea
                        rows={5}
                        style={SHELL.textarea}
                        value={activeFrame.visualNotes}
                        onChange={(event) => updateFrame(activeFrame.id, { visualNotes: event.target.value })}
                        placeholder="Visual details"
                      />
                    </div>
                    <div>
                      <label style={SHELL.label}>Motion</label>
                      <textarea
                        rows={4}
                        style={SHELL.textarea}
                        value={activeFrame.motionNotes}
                        onChange={(event) => updateFrame(activeFrame.id, { motionNotes: event.target.value })}
                        placeholder="Motion details"
                      />
                    </div>
                    <div>
                      <label style={SHELL.label}>States</label>
                      <input
                        style={SHELL.input}
                        value={activeFrame.states}
                        onChange={(event) => updateFrame(activeFrame.id, { states: event.target.value })}
                        placeholder="idle, hover, pressed"
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 16,
                      display: 'grid',
                      gridTemplateColumns: '280px 1fr',
                      gap: 16,
                      alignItems: 'start'
                    }}
                  >
                    <div
                      style={{
                        background: '#0d0f14',
                        border: '1px dashed #2a3040',
                        borderRadius: 12,
                        minHeight: 180,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                      }}
                    >
                      {activeFrame.referenceDataUrl ? (
                        <img
                          src={activeFrame.referenceDataUrl}
                          alt={activeFrame.name || 'Reference'}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div style={{ padding: 16, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
                          Optional reference
                        </div>
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>
                        Reference image
                      </div>
                      {activeFrame.referenceImagePath && (
                        <div style={{ fontSize: 11, color: '#7c8499', marginTop: 8, lineHeight: 1.5 }}>
                          {activeFrame.referenceImagePath}
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                        <button style={SHELL.button} onClick={() => attachReference(activeFrame.id)}>
                          {busy === `ref-${activeFrame.id}` ? 'Loading...' : 'Attach Reference'}
                        </button>
                        <button
                          style={SHELL.button}
                          onClick={() => removeReference(activeFrame.id)}
                          disabled={!activeFrame.referenceDataUrl}
                        >
                          Remove Reference
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {uiWorkflow.activeStep === 'components' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: '#9aa0b0' }}>
                      Add only the components you want in the prompt.
                    </div>
                    <button style={SHELL.primaryButton} onClick={addComponent}>
                      Add Component
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {activeFrame.components.length ? (
                      activeFrame.components.map((component) => (
                        <EditableCard
                          key={component.id}
                          title={component.name || 'Component'}
                          onRemove={() => removeComponent(component.id)}
                        >
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                            <div>
                              <label style={SHELL.label}>Name</label>
                              <input
                                style={SHELL.input}
                                value={component.name}
                                onChange={(event) => updateComponent(component.id, { name: event.target.value })}
                                placeholder="Component name"
                              />
                            </div>
                            <div>
                              <label style={SHELL.label}>Type</label>
                              <input
                                style={SHELL.input}
                                value={component.type}
                                onChange={(event) => updateComponent(component.id, { type: event.target.value })}
                                placeholder="button, panel, card"
                              />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={SHELL.label}>Purpose</label>
                              <textarea
                                rows={2}
                                style={SHELL.textarea}
                                value={component.purpose}
                                onChange={(event) =>
                                  updateComponent(component.id, { purpose: event.target.value })
                                }
                                placeholder="Purpose"
                              />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={SHELL.label}>Style notes</label>
                              <textarea
                                rows={3}
                                style={SHELL.textarea}
                                value={component.styleNotes}
                                onChange={(event) =>
                                  updateComponent(component.id, { styleNotes: event.target.value })
                                }
                                placeholder="Style notes"
                              />
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={SHELL.label}>States</label>
                              <input
                                style={SHELL.input}
                                value={component.states}
                                onChange={(event) => updateComponent(component.id, { states: event.target.value })}
                                placeholder="idle, hover, pressed"
                              />
                            </div>
                          </div>
                        </EditableCard>
                      ))
                    ) : (
                      <EmptyCard text="No components yet." />
                    )}
                  </div>
                </>
              )}

              {uiWorkflow.activeStep === 'interactivity' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div style={{ fontSize: 12, color: '#9aa0b0' }}>
                      Add only the interactions you want in the prompt.
                    </div>
                    <button style={SHELL.primaryButton} onClick={addInteraction}>
                      Add Interaction
                    </button>
                  </div>
                  <div style={{ display: 'grid', gap: 12 }}>
                    {activeFrame.interactions.length ? (
                      activeFrame.interactions.map((interaction) => (
                        <EditableCard
                          key={interaction.id}
                          title={interaction.name || 'Interaction'}
                          onRemove={() => removeInteraction(interaction.id)}
                        >
                          <div style={{ display: 'grid', gap: 12 }}>
                            <div>
                              <label style={SHELL.label}>Name</label>
                              <input
                                style={SHELL.input}
                                value={interaction.name}
                                onChange={(event) =>
                                  updateInteraction(interaction.id, { name: event.target.value })
                                }
                                placeholder="Interaction name"
                              />
                            </div>
                            <div>
                              <label style={SHELL.label}>Trigger</label>
                              <textarea
                                rows={2}
                                style={SHELL.textarea}
                                value={interaction.trigger}
                                onChange={(event) =>
                                  updateInteraction(interaction.id, { trigger: event.target.value })
                                }
                                placeholder="Trigger"
                              />
                            </div>
                            <div>
                              <label style={SHELL.label}>Response</label>
                              <textarea
                                rows={3}
                                style={SHELL.textarea}
                                value={interaction.response}
                                onChange={(event) =>
                                  updateInteraction(interaction.id, { response: event.target.value })
                                }
                                placeholder="Response"
                              />
                            </div>
                            <div>
                              <label style={SHELL.label}>Feedback</label>
                              <textarea
                                rows={2}
                                style={SHELL.textarea}
                                value={interaction.feedback}
                                onChange={(event) =>
                                  updateInteraction(interaction.id, { feedback: event.target.value })
                                }
                                placeholder="Feedback"
                              />
                            </div>
                            <div>
                              <label style={SHELL.label}>Notes</label>
                              <textarea
                                rows={2}
                                style={SHELL.textarea}
                                value={interaction.notes}
                                onChange={(event) =>
                                  updateInteraction(interaction.id, { notes: event.target.value })
                                }
                                placeholder="Notes"
                              />
                            </div>
                          </div>
                        </EditableCard>
                      ))
                    ) : (
                      <EmptyCard text="No interactions yet." />
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <EmptyCard text="Add a frame to begin." />
          )}
        </div>

        <div style={SHELL.side}>
          <div style={{ ...SHELL.card, marginBottom: 14 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 10
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: '#7c8499', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Browser session
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: selectedProvider.accent, marginTop: 8 }}>
                  {selectedProvider.label}
                </div>
              </div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: currentProviderStatus.connected
                    ? '#4ade80'
                    : currentProviderStatus.loginDetected
                      ? '#f59e0b'
                      : '#94a3b8',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}
              >
                {providerStatusLabel}
              </span>
            </div>
            {currentProviderStatus.error && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.18)',
                  color: '#fca5a5',
                  fontSize: 11,
                  lineHeight: 1.6
                }}
              >
                {currentProviderStatus.error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button style={SHELL.button} onClick={() => openProviderLogin(uiWorkflow.provider)}>
                Connect
              </button>
              <button style={SHELL.button} onClick={() => openProviderWorkspace(uiWorkflow.provider)}>
                Workspace
              </button>
              <button style={SHELL.button} onClick={() => refreshProviderStatus(uiWorkflow.provider)}>
                Refresh
              </button>
            </div>
          </div>

          <div style={SHELL.card}>
            <div style={{ fontSize: 11, color: '#7c8499', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Current prompt
            </div>
            <div style={{ fontSize: 12, color: '#9aa0b0', lineHeight: 1.7, marginTop: 8 }}>
              {STEP_CONFIG.find((step) => step.id === uiWorkflow.activeStep)?.label || '1. Frames'}
            </div>
            <textarea
              readOnly
              rows={18}
              style={{ ...SHELL.textarea, marginTop: 12, color: '#d5d9e5' }}
              value={currentPromptState.prompt || 'Fill in the current step to build a prompt.'}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <button style={SHELL.button} onClick={copyCurrentPrompt}>
                Copy Prompt
              </button>
              <button style={SHELL.primaryButton} onClick={generateCurrentStep}>
                Generate
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldCard({ label, children }) {
  return (
    <div style={SHELL.card}>
      <label style={SHELL.label}>{label}</label>
      {children}
    </div>
  )
}

function EditableCard({ title, onRemove, children }) {
  return (
    <div
      style={{
        background: '#11141b',
        border: '1px solid #202533',
        borderRadius: 12,
        padding: 14
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 14
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: '#eef0f6' }}>{title}</div>
        <button
          onClick={onRemove}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: 11
          }}
        >
          Remove
        </button>
      </div>
      {children}
    </div>
  )
}

function EmptyCard({ text }) {
  return (
    <div
      style={{
        background: '#11141b',
        border: '1px dashed #2a3040',
        borderRadius: 12,
        padding: 18,
        fontSize: 12,
        color: '#7c8499',
        lineHeight: 1.8
      }}
    >
      {text}
    </div>
  )
}

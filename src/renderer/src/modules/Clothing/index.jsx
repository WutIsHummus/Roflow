/* eslint-disable react/prop-types */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { CONFIG_KEYS } from '../../../../shared/configKeys.js'
import { useConfigKey } from '../../hooks/useConfigKey.js'
import {
  Shirt,
  Settings,
  Sparkles,
  Download,
  Copy,
  Compass,
  Sparkle,
  Plus,
  Trash2,
  FolderDown,
  Upload
} from 'lucide-react'

const DEFAULT_WORKFLOW = {
  provider: 'replicate',
  assetType: 'shirt',
  designPrompt: '',
  colorPalette: '',
  materialNotes: '',
  styleNotes: '',
  templateImagePath: null,
  templateDataUrl: null,
  resultPath: null,
  resultDataUrl: null,
  seed: '',
  lastPrompt: ''
}

const REPLICATE_MODEL = 'black-forest-labs/flux-kontext-pro'
const BUNDLED_SHIRT_TEMPLATE_URL = '/roblox-classic-shirt-template.png'
const BUNDLED_SHIRT_TEMPLATE_LABEL = 'Built-in Roblox shirt template'

const PROVIDERS = {
  replicate: {
    label: 'Replicate FLUX',
    accent: '#a78bfa',
    generateLabel: 'Generate with Replicate'
  },
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

function buildPromptPack(workflow) {
  const hardRequirements = [
    'You are filling a Roblox classic clothing template with original clothing artwork.',
    '',
    'Follow these rules exactly:',
    '- Use the provided template as the fixed UV layout.',
    '- Keep the original canvas size, proportions, and panel positions unchanged.',
    '- Fill the blank clothing template panels with clothing artwork.',
    '- Treat the template as panel guides to fill, not as an image whose style should be changed.',
    '- Do not restyle, repaint, reinterpret, or transform the template itself.',
    '- Generate only the final clothing artwork mapped onto the template.',
    '- Do not generate a character, mannequin, mockup, or 3D preview.',
    '- Do not add perspective, staging, background scenery, or presentation elements.',
    '- Keep the design seam-aware so adjacent faces connect cleanly across torso and sleeves or legs.',
    '- Put the main visual focus on the torso front or primary visible panel.',
    '- Keep side transitions simple and consistent.',
    '- Use bold readable shapes suitable for Roblox classic non-mesh clothing.',
    '- Avoid tiny noisy details that will blur after upload.',
    '- Preserve clean transparent or empty non-design areas where appropriate.',
    '- Cover the template guide regions with usable clothing graphics so the result is ready for PNG cleanup.',
    '- The result must look like a production-ready PNG texture for Roblox classic clothing.',
    '',
    'Rendering intent:',
    '- flat graphic texture',
    '- template-aligned',
    '- panel-filling artwork',
    '- clean edges',
    '- game-ready',
    '- easy to edit manually after generation'
  ].join('\n')

  const negativePrompt = [
    'person',
    'mannequin',
    'avatar',
    'roblox character',
    'shirt mockup',
    'pants mockup',
    'folded clothing',
    'hanging clothing',
    'fashion photo',
    '3d render',
    'perspective',
    'realistic cloth folds',
    'studio lighting',
    'scene background',
    'extra panels',
    'warped template',
    'distorted layout',
    'style transfer',
    'restyled template',
    'template redesign',
    'watermark',
    'signature',
    'labels',
    'text annotations',
    'tiny noisy details'
  ].join(', ')

  const designBrief = [
    `User clothing request: ${workflow.designPrompt || 'Create a clean Roblox classic clothing texture.'}`,
    `Asset target: Roblox classic ${workflow.assetType}.`,
    workflow.colorPalette ? `Color palette: ${workflow.colorPalette}` : null,
    workflow.materialNotes ? `Material notes: ${workflow.materialNotes}` : null,
    workflow.styleNotes ? `Style notes: ${workflow.styleNotes}` : null,
    'Output goal: Roblox classic clothing texture, flat 2D, seam-aware, template-safe.',
    `Avoid: ${negativePrompt}.`
  ]
    .filter(Boolean)
    .join('\n')

  const finalPrompt = `${hardRequirements}\n\n${designBrief}`

  const workflowNotes = [
    'Workflow',
    '1. Start with the built-in Roblox shirt template or attach your own template PNG.',
    '2. Write the clothing direction in plain language.',
    '3. Generate with Replicate FLUX Kontext Pro so it fills the UV panels with clothing artwork.',
    '4. Inspect seams and clean up any edge issues in an editor before upload.',
    '5. Upload the final PNG to Roblox as classic clothing.'
  ].join('\n')

  const exportText = [
    'Roblox Classic Clothing Prompt Pack',
    '',
    `Model: ${REPLICATE_MODEL}`,
    `Asset type: ${workflow.assetType}`,
    workflow.colorPalette ? `Palette: ${workflow.colorPalette}` : null,
    workflow.materialNotes ? `Material notes: ${workflow.materialNotes}` : null,
    workflow.styleNotes ? `Style notes: ${workflow.styleNotes}` : null,
    '',
    'Prompt Prefix',
    hardRequirements,
    '',
    'Negative Constraints',
    negativePrompt,
    '',
    'Final Prompt',
    finalPrompt,
    '',
    workflowNotes
  ]
    .filter(Boolean)
    .join('\n')

  return {
    hardRequirements,
    negativePrompt,
    finalPrompt,
    exportText,
    workflowNotes
  }
}

const styles = {
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
    padding: '24px 24px 12px', 
    borderBottom: '1px solid rgba(255,255,255,0.05)', 
    background: 'rgba(0,0,0,0.15)',
    flexShrink: 0 
  },
  title: { 
    fontSize: 20, 
    fontWeight: 800, 
    letterSpacing: '-0.02em',
    color: '#f1f5f9', 
    margin: 0 
  },
  subtitle: { 
    fontSize: 12.5, 
    color: '#94a3b8', 
    marginTop: 6, 
    lineHeight: 1.6,
    fontWeight: 500
  },
  body: { 
    flex: 1, 
    display: 'grid', 
    gridTemplateColumns: '360px 1fr 360px', 
    minHeight: 0 
  },
  rail: { 
    borderRight: '1px solid rgba(255,255,255,0.05)', 
    padding: '20px 16px', 
    overflowY: 'auto',
    background: 'rgba(0,0,0,0.08)'
  },
  center: { 
    padding: 24, 
    overflowY: 'auto' 
  },
  pack: { 
    borderLeft: '1px solid rgba(255,255,255,0.05)', 
    padding: '20px 16px', 
    overflowY: 'auto',
    background: 'rgba(0,0,0,0.08)'
  },
  card: {
    background: 'rgba(16, 19, 28, 0.4)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    borderRadius: 14,
    padding: 16,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
  },
  label: {
    display: 'block',
    fontSize: 10,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b',
    marginBottom: 8
  },
  input: {
    width: '100%',
    background: 'rgba(9, 10, 15, 0.6)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 500,
    color: '#e2e8f0',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  textarea: {
    width: '100%',
    background: 'rgba(9, 10, 15, 0.6)',
    border: '1px solid rgba(255,255,255,0.05)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 500,
    color: '#cbd5e1',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    resize: 'vertical',
    lineHeight: 1.6,
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  button: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: '9px 14px',
    fontSize: 12,
    fontWeight: 700,
    background: 'rgba(30, 41, 59, 0.4)',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  },
  primaryButton: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 12,
    fontWeight: 700,
    background: 'rgba(255, 255, 255, 0.9)',
    color: '#0c0e17',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
  }
}

export default function ClothingModule({ workflowState, setWorkflowState, onChangeModule }) {
  const [workflow, setWorkflow] = useState(() => ({ ...DEFAULT_WORKFLOW, ...(workflowState?.clothingWorkflow || {}) }))
  const replicateToken = useConfigKey(CONFIG_KEYS.REPLICATE_API_TOKEN)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState('')
  const [progress, setProgress] = useState(null)
  const [providerWebConfig, setProviderWebConfig] = useState(DEFAULT_PROVIDER_WEB_CONFIG)
  const [providerWebConfigLoaded, setProviderWebConfigLoaded] = useState(
    () => !window.api?.configGet
  )
  const [providerSessionState, setProviderSessionState] = useState(DEFAULT_PROVIDER_SESSION_STATE)

  const promptPack = useMemo(() => buildPromptPack(workflow), [workflow])

  useEffect(() => {
    if (workflowState?.clothingWorkflow?.templateDataUrl) return
    let cancelled = false

    async function loadBundledTemplate() {
      const response = await fetch(BUNDLED_SHIRT_TEMPLATE_URL)
      const blob = await response.blob()
      const reader = new FileReader()
      reader.onloadend = () => {
        if (cancelled) return
        const dataUrl = typeof reader.result === 'string' ? reader.result : null
        if (!dataUrl) return
        setWorkflow((prev) => {
          if (prev.templateDataUrl) return prev
          return {
            ...prev,
            templateImagePath: BUNDLED_SHIRT_TEMPLATE_LABEL,
            templateDataUrl: dataUrl
          }
        })
      }
      reader.readAsDataURL(blob)
    }

    loadBundledTemplate().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [workflowState?.clothingWorkflow?.templateDataUrl])

  useEffect(() => {
    if (!workflow.resultPath || workflow.resultDataUrl) return undefined
    let cancelled = false

    async function hydrateResultTexture() {
      const result = await window.api.readFileAsDataURL({ filePath: workflow.resultPath })
      if (cancelled || !result.success) return
      setWorkflow((prev) => ({ ...prev, resultDataUrl: result.dataUrl }))
    }

    hydrateResultTexture().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [workflow.resultPath, workflow.resultDataUrl])

  useEffect(() => {
    if (!setWorkflowState) return
    setWorkflowState((prev) => ({ ...prev, clothingWorkflow: workflow }))
  }, [workflow, setWorkflowState])

  useEffect(() => {
    if (!notice) return undefined
    const timeout = window.setTimeout(() => setNotice(''), 2400)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => {
    if (!window.api.onClothingProgress) return undefined
    const unsubscribe = window.api.onClothingProgress((data) => setProgress(data))
    return unsubscribe
  }, [])

  useEffect(() => {
    let active = true
    if (!window.api?.configGet) return undefined

    window.api
      .configGet(CONFIG_KEYS.CLOTHING_PROVIDER_WEB_CONFIG)
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

  const updateWorkflow = useCallback((changes) => {
    setWorkflow((prev) => ({ ...prev, ...changes }))
  }, [])

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

  const copyPromptForProvider = useCallback(async () => {
    const result = await window.api.copyText(promptPack.finalPrompt)
    if (!result?.success) {
      setNotice(result?.error || 'Could not copy prompt.')
      return false
    }
    setNotice('Prompt copied.')
    return true
  }, [promptPack.finalPrompt])

  const generateWithWebProvider = useCallback(async () => {
    const copied = await copyPromptForProvider()
    if (!copied) return
    const opened = await openProviderWorkspace(workflow.provider)
    if (!opened) return
    setNotice('Prompt copied and workspace opened.')
  }, [copyPromptForProvider, openProviderWorkspace, workflow.provider])

  const attachTemplate = useCallback(async () => {
    setBusy('template')
    const filePath = await window.api.openImage()
    if (!filePath) {
      setBusy('')
      return
    }
    const result = await window.api.readFileAsDataURL({ filePath })
    setBusy('')
    if (!result.success) {
      setNotice(result.error || 'Could not load template image.')
      return
    }
    updateWorkflow({
      templateImagePath: filePath,
      templateDataUrl: result.dataUrl
    })
    setNotice('Template attached.')
  }, [updateWorkflow])

  const removeTemplate = useCallback(() => {
    updateWorkflow({
      templateImagePath: null,
      templateDataUrl: null
    })
    setNotice('Template removed.')
  }, [updateWorkflow])

  const importClothingTexture = useCallback(async () => {
    setBusy('import')
    const filePath = await window.api.openImage()
    if (!filePath) {
      setBusy('')
      return
    }
    const result = await window.api.readFileAsDataURL({ filePath })
    setBusy('')
    if (!result.success) {
      setNotice(result.error || 'Could not load clothing image.')
      return
    }
    updateWorkflow({
      resultPath: filePath,
      resultDataUrl: result.dataUrl,
      lastPrompt: ''
    })
    setNotice('Clothing texture imported.')
  }, [updateWorkflow])

  const removeResult = useCallback(() => {
    updateWorkflow({
      resultPath: null,
      resultDataUrl: null,
      lastPrompt: ''
    })
    setNotice('Result cleared.')
  }, [updateWorkflow])

  const exportPromptPack = useCallback(async () => {
    const filePath = await window.api.saveFile({
      title: 'Export Clothing Prompt Pack',
      defaultPath: 'roblox-classic-clothing-pack.txt',
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    })
    if (!filePath) return
    const result = await window.api.writeTextFile({
      filePath,
      text: promptPack.exportText
    })
    if (!result?.success) {
      setNotice(result?.error || 'Could not export prompt pack.')
      return
    }
    setNotice('Prompt pack exported.')
    window.api.openPath(filePath)
  }, [promptPack.exportText])

  const saveGeneratedTexture = useCallback(async () => {
    if (!workflow.resultPath) return
    const filePath = await window.api.saveFile({
      title: 'Save Classic Clothing Texture',
      defaultPath: `roblox-${workflow.assetType}-texture.png`,
      filters: [{ name: 'PNG Images', extensions: ['png'] }]
    })
    if (!filePath) return
    await window.api.copyFile({ src: workflow.resultPath, dest: filePath })
    setNotice('Clothing texture saved.')
    window.api.openPath(filePath)
  }, [workflow.assetType, workflow.resultPath])

  const generateTexture = useCallback(async () => {
    if (!replicateToken.trim()) {
      setNotice('Add your Replicate API token in Settings first.')
      return
    }
    if (!workflow.templateImagePath) {
      setNotice('Attach a Roblox clothing template image first.')
      return
    }
    if (!workflow.designPrompt.trim()) {
      setNotice('Describe the clothing design first.')
      return
    }

    setBusy('generate')
    setProgress({ step: 'Preparing Replicate request…', pct: 4 })

    const parsedSeed =
      workflow.seed.trim() && Number.isFinite(Number(workflow.seed)) ? Number(workflow.seed) : null

    const result = await window.api.replicateGenerateClothing({
      apiToken: replicateToken.trim(),
      prompt: promptPack.finalPrompt,
      inputImagePath: workflow.templateImagePath,
      inputImageDataUrl: workflow.templateDataUrl,
      model: REPLICATE_MODEL,
      seed: parsedSeed
    })

    setBusy('')

    if (!result?.success) {
      setProgress(null)
      setNotice(result?.error || 'Generation failed.')
      return
    }

    const dataUrlResult = await window.api.readFileAsDataURL({ filePath: result.outputPath })
    setProgress(null)
    updateWorkflow({
      resultPath: result.outputPath,
      resultDataUrl: dataUrlResult.success ? dataUrlResult.dataUrl : null,
      lastPrompt: promptPack.finalPrompt
    })
    setNotice('Classic clothing texture generated.')
  }, [promptPack.finalPrompt, replicateToken, updateWorkflow, workflow.designPrompt, workflow.seed, workflow.templateDataUrl, workflow.templateImagePath])

  const selectedProvider = PROVIDERS[workflow.provider] || PROVIDERS.replicate

  const handleGenerate = workflow.provider === 'replicate' ? generateTexture : generateWithWebProvider

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h1 style={styles.title} className="text-xl font-extrabold tracking-tight text-slate-100 flex items-center gap-2">
              <Shirt size={20} className="text-purple-400" /> Classic Clothing Studio
            </h1>
            <p style={styles.subtitle} className="text-xs text-slate-400 mt-1 font-medium">
              Generate Roblox classic clothing by filling the Roblox UV template panels.
              Choose a generation provider below.
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
              className="px-4 py-2 text-xs font-bold rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-slate-100 hover:border-white/[0.15] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
              onClick={importClothingTexture}
              disabled={busy === 'import'}
            >
              <Upload size={13} /> {busy === 'import' ? 'Importing…' : 'Import PNG'}
            </button>
            <button 
              className="px-4 py-2 text-xs font-bold rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-slate-100 hover:border-white/[0.15] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
              onClick={exportPromptPack}
            >
              <FolderDown size={13} /> Export Prompt Pack
            </button>
            <button 
              className="px-4 py-2 text-xs font-bold rounded-lg bg-white text-slate-950 hover:bg-white/90 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
              onClick={handleGenerate} 
              disabled={busy === 'generate'}
            >
              <Sparkles size={13} /> {busy === 'generate' ? 'Generating…' : selectedProvider.generateLabel}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-3">
          {Object.entries(PROVIDERS).map(([id, provider]) => {
            const active = workflow.provider === id
            const status = id !== 'replicate' ? providerSessionState[id] : null
            
            let activeClass = ""
            let borderStyle = "border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/[0.12]"
            if (active) {
              if (id === 'replicate') {
                activeClass = "bg-gradient-to-br from-violet-950/40 to-fuchsia-950/30 border-violet-500/50 text-violet-200 shadow-[0_0_15px_rgba(167,139,250,0.25)] font-bold"
                borderStyle = ""
              } else if (id === 'manus') {
                activeClass = "bg-gradient-to-br from-sky-950/40 to-blue-950/30 border-sky-500/50 text-sky-200 shadow-[0_0_15px_rgba(56,189,248,0.25)] font-bold"
                borderStyle = ""
              } else if (id === 'chatgpt-image') {
                activeClass = "bg-gradient-to-br from-emerald-950/40 to-teal-950/30 border-emerald-500/50 text-emerald-200 shadow-[0_0_15px_rgba(52,211,153,0.25)] font-bold"
                borderStyle = ""
              }
            }

            return (
              <button
                key={id}
                onClick={() => updateWorkflow({ provider: id })}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] ${borderStyle} ${activeClass}`}
              >
                <div className="flex justify-between items-center gap-2">
                  <strong className="text-xs font-bold text-slate-100 flex items-center gap-1.5">
                    {id === 'replicate' && <Sparkles size={13} className="text-violet-400" />}
                    {id === 'manus' && <Compass size={13} className="text-sky-400" />}
                    {id === 'chatgpt-image' && <Sparkle size={13} className="text-emerald-400" />}
                    {provider.label}
                  </strong>
                  <span
                    className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                      status?.connected 
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' 
                        : id === 'replicate' 
                          ? 'bg-violet-500/10 border-violet-500/25 text-violet-300'
                          : 'bg-slate-800 border-slate-700 text-slate-500'
                    }`}
                  >
                    {status ? (status.connected ? 'Connected' : 'Offline') : 'API'}
                  </span>
                </div>
              </button>
            )
          })}
        </div>

        {notice && (
          <div className="mb-3.5 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium animate-fadeIn flex items-center gap-1.5">
            <Sparkles size={13} className="text-purple-300" /> <span>{notice}</span>
          </div>
        )}

        {progress && (
          <div className="mb-3.5 bg-purple-500/5 border border-purple-500/15 p-2.5 rounded-lg">
            <div className="flex justify-between text-xs font-semibold text-purple-300 mb-1.5 tracking-wide">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#c084fc]"></span>
                {progress.step}
              </span>
              <span>{progress.pct}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                style={{
                  width: `${progress.pct}%`,
                  transition: 'width .3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div style={styles.body}>
        <div style={styles.rail}>
          <div style={{ ...styles.card, marginBottom: 14 }}>
            <label style={styles.label}>Asset Type</label>
            <div className="flex gap-2">
              {['shirt', 'pants'].map((type) => {
                const active = workflow.assetType === type
                return (
                  <button
                    key={type}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5 ${
                      active 
                        ? 'bg-purple-500/10 border-purple-500/30 text-purple-300' 
                        : 'border-white/[0.08] bg-white/[0.04] text-slate-400 hover:text-slate-200 hover:border-white/[0.15]'
                    }`}
                    onClick={() => updateWorkflow({ assetType: type })}
                  >
                    {type === 'shirt' && <Shirt size={12} />}
                    {type === 'shirt' ? 'Classic Shirt' : 'Classic Pants'}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={styles.card}>
            <div className="text-xs font-bold text-slate-200 mb-1.5">
              Template Input
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed mb-3.5">
              The built-in shirt template is already loaded. Attach a different template only if you
              want to replace it.
            </div>
            <div className="flex gap-2 flex-wrap mb-3">
              <button 
                className="px-4 py-2 text-xs font-bold rounded-lg bg-white text-slate-950 hover:bg-white/90 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                onClick={attachTemplate} 
                disabled={busy === 'template'}
              >
                <Plus size={13} /> {busy === 'template' ? 'Loading…' : 'Replace Template'}
              </button>
              {workflow.templateImagePath && (
                <button 
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-slate-100 hover:border-white/[0.15] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                  onClick={removeTemplate}
                >
                  <Trash2 size={13} /> Remove
                </button>
              )}
            </div>
            <div className="text-[10px] text-slate-500 font-mono break-all leading-normal">
              {workflow.templateImagePath || 'Loading built-in template...'}
            </div>
          </div>
        </div>

        <div style={styles.center}>
          <div style={{ ...styles.card, marginBottom: 16 }}>
            <div className="grid grid-cols-2 gap-3.5">
              <div>
                <label style={styles.label}>Design Prompt</label>
                <textarea
                  value={workflow.designPrompt}
                  onChange={(event) => updateWorkflow({ designPrompt: event.target.value })}
                  placeholder="Example: black varsity jacket with white sleeves, red trim, chest patch, and clean sleeve stripes"
                  style={{ ...styles.textarea, minHeight: 110 }}
                  className="focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 focus:bg-slate-950/80 hover:border-slate-800 transition-all duration-200"
                />
              </div>
              <div>
                <label style={styles.label}>Panel Fill Notes</label>
                <textarea
                  value={workflow.styleNotes}
                  onChange={(event) => updateWorkflow({ styleNotes: event.target.value })}
                  placeholder="Example: front logo on torso front, plain back, matching cuffs, simple side seams"
                  style={{ ...styles.textarea, minHeight: 110 }}
                  className="focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 focus:bg-slate-950/80 hover:border-slate-800 transition-all duration-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_1fr_140px] gap-3.5 mt-3.5">
              <div>
                <label style={styles.label}>Color Palette</label>
                <input
                  value={workflow.colorPalette}
                  onChange={(event) => updateWorkflow({ colorPalette: event.target.value })}
                  placeholder="black, red, dark gray"
                  style={styles.input}
                  className="focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 focus:bg-slate-950/80 hover:border-slate-800 transition-all duration-200"
                />
              </div>
              <div>
                <label style={styles.label}>Material Notes</label>
                <input
                  value={workflow.materialNotes}
                  onChange={(event) => updateWorkflow({ materialNotes: event.target.value })}
                  placeholder="matte fabric, soft trim"
                  style={styles.input}
                  className="focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 focus:bg-slate-950/80 hover:border-slate-800 transition-all duration-200"
                />
              </div>
              {workflow.provider === 'replicate' && (
                <div>
                  <label style={styles.label}>Seed</label>
                  <input
                    value={workflow.seed}
                    onChange={(event) => updateWorkflow({ seed: event.target.value })}
                    placeholder="optional"
                    style={styles.input}
                    className="focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 focus:bg-slate-950/80 hover:border-slate-800 transition-all duration-200"
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2.5 mt-4 flex-wrap">
              <button
                className="px-4 py-2 text-xs font-bold rounded-lg bg-white text-slate-950 hover:bg-white/90 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                onClick={handleGenerate}
                disabled={busy === 'generate'}
              >
                <Sparkles size={13} /> {busy === 'generate' ? 'Generating…' : selectedProvider.generateLabel}
              </button>
              <button 
                className="px-4 py-2 text-xs font-bold rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-slate-100 hover:border-white/[0.15] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                onClick={copyPromptForProvider}
              >
                <Copy size={13} /> Copy Prompt
              </button>
              <button
                className="px-4 py-2 text-xs font-bold rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-slate-100 hover:border-white/[0.15] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                onClick={importClothingTexture}
                disabled={busy === 'import'}
              >
                <Upload size={13} /> {busy === 'import' ? 'Importing…' : 'Import PNG'}
              </button>
              {workflow.resultPath && (
                <button 
                  className="px-4 py-2 text-xs font-bold rounded-lg border border-purple-500/35 bg-purple-950/40 text-purple-300 hover:bg-purple-900/40 hover:border-purple-400 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.1)] flex items-center justify-center gap-1.5"
                  onClick={saveGeneratedTexture}
                >
                  <Download size={13} /> Save PNG
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div style={styles.card}>
              <div className="text-xs font-extrabold text-slate-200 mb-2 uppercase tracking-wide">
                Template Preview
              </div>
              {workflow.templateDataUrl ? (
                <img
                  src={workflow.templateDataUrl}
                  alt="Roblox clothing template"
                  className="w-full rounded-lg border border-white/5 shadow-inner"
                />
              ) : (
                <div className="text-xs text-slate-500 leading-relaxed font-medium">
                  The built-in shirt template will appear here once loaded.
                </div>
              )}
            </div>

            <div style={styles.card}>
              <div className="flex justify-between items-center gap-2 mb-2">
                <div className="text-xs font-extrabold text-slate-200 uppercase tracking-wide">
                  Result Texture
                </div>
                <div className="flex gap-1.5">
                  <button
                    className="px-2.5 py-1 text-[10px] font-bold rounded-md border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200 transition-all duration-200 cursor-pointer flex items-center gap-1"
                    onClick={importClothingTexture}
                    disabled={busy === 'import'}
                  >
                    <Upload size={11} /> {busy === 'import' ? '…' : 'Import'}
                  </button>
                  {workflow.resultPath && (
                    <button
                      className="px-2.5 py-1 text-[10px] font-bold rounded-md border border-white/[0.08] bg-white/[0.04] text-slate-400 hover:bg-white/[0.1] hover:text-slate-200 transition-all duration-200 cursor-pointer flex items-center gap-1"
                      onClick={removeResult}
                    >
                      <Trash2 size={11} /> Clear
                    </button>
                  )}
                </div>
              </div>
              {workflow.resultDataUrl ? (
                <>
                  <img
                    src={workflow.resultDataUrl}
                    alt="Classic clothing texture"
                    className="w-full rounded-lg border border-white/5 shadow-inner"
                  />
                  <div className="text-[10px] text-slate-500 font-mono break-all leading-normal mt-2">
                    {workflow.resultPath}
                  </div>
                </>
              ) : (
                <div className="text-xs text-slate-500 leading-relaxed font-medium">
                  Generate with a provider or import your own finished PNG texture here.
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={styles.pack}>
          <div style={{ ...styles.card, marginBottom: 14 }}>
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
              Final Prompt
            </div>
            <textarea
              readOnly
              rows={14}
              style={{ ...styles.textarea, color: '#d1d5db' }}
              value={promptPack.finalPrompt || 'Fill in the design prompt to build a prompt.'}
              className="focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500 focus:bg-slate-950/80 hover:border-slate-800 transition-all duration-200 font-mono text-[11px] leading-relaxed"
            />
            <div className="flex gap-2 mt-3 flex-wrap">
              <button 
                className="px-4 py-2 text-xs font-bold rounded-lg border border-white/[0.08] bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-slate-100 hover:border-white/[0.15] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer flex items-center justify-center gap-1.5"
                onClick={copyPromptForProvider}
              >
                <Copy size={13} /> Copy Prompt
              </button>
              <button 
                className="px-4 py-2 text-xs font-bold rounded-lg border border-purple-500/35 bg-purple-950/40 text-purple-300 hover:bg-purple-900/40 hover:border-purple-400 transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer shadow-[0_0_12px_rgba(168,85,247,0.1)] flex items-center justify-center gap-1.5"
                onClick={exportPromptPack}
              >
                <FolderDown size={13} /> Export Pack
              </button>
            </div>
          </div>

          <div style={{ ...styles.card, marginBottom: 14 }}>
            <div className="text-xs font-bold text-slate-200 mb-2 uppercase tracking-wide">
              Negative Constraints
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed font-medium">
              {promptPack.negativePrompt}
            </div>
          </div>

          <div style={styles.card}>
            <div className="text-xs font-bold text-slate-200 mb-2 uppercase tracking-wide">
              Hosted Workflow
            </div>
            <pre className="m-0 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-slate-400 font-medium">
              {promptPack.workflowNotes}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

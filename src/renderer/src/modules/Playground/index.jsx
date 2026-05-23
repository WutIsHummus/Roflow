/* eslint-disable react/prop-types, react-hooks/set-state-in-effect */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Shirt, Trash2, Upload } from 'lucide-react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js'
import {
  ROBLOX_ATTACH,
  buildAttachmentAnchors,
  buildRigNameMap,
  canonicalizeMotionClip,
  canonicalizeMotionSkeleton,
  dataUrlToArrayBuffer,
  normName
} from '../Modeling/r15Utils'
import {
  configureClassicClothingTexture,
  createClassicClothingMaterial
} from './classicClothingTexture.js'
import {
  prepareClassicClothingGeometry,
  resolveClothingPartName
} from './classicClothingUv.js'

const CLOTHING_ASSET_TYPES = ['shirt', 'pants']

function clothingAssetTypeLabel(type) {
  if (type === 'pants') return 'Classic Pants'
  return 'Classic Shirt'
}

function clothingSlotKeys(assetType) {
  return assetType === 'pants'
    ? { path: 'pantsResultPath', dataUrl: 'pantsResultDataUrl' }
    : { path: 'shirtResultPath', dataUrl: 'shirtResultDataUrl' }
}

function getClothingSlotPaths(workflow, assetType) {
  const { path, dataUrl } = clothingSlotKeys(assetType)
  let resultPath = workflow?.[path] ?? null
  let resultDataUrl = workflow?.[dataUrl] ?? null
  if (!resultPath && !resultDataUrl && workflow) {
    const legacyType = workflow.assetType || 'shirt'
    if (legacyType === assetType && (workflow.resultPath || workflow.resultDataUrl)) {
      resultPath = workflow.resultPath
      resultDataUrl = workflow.resultDataUrl
    }
  }
  return { resultPath, resultDataUrl }
}

function hasClothingSlot(workflow, assetType) {
  const { resultPath, resultDataUrl } = getClothingSlotPaths(workflow, assetType)
  return Boolean(resultPath || resultDataUrl)
}

function hasAnyClothingTexture(workflow) {
  return hasClothingSlot(workflow, 'shirt') || hasClothingSlot(workflow, 'pants')
}

function clothingConnectionSummary(workflow) {
  const hasShirt = hasClothingSlot(workflow, 'shirt')
  const hasPants = hasClothingSlot(workflow, 'pants')
  if (hasShirt && hasPants) return 'Shirt and pants textures ready'
  if (hasShirt) return 'Classic Shirt texture ready'
  if (hasPants) return 'Classic Pants texture ready'
  return null
}

const categoryStyles = {
  animation: {
    border: 'border-violet-500/20 hover:border-violet-500/40',
    bg: 'bg-violet-950/[0.03]',
    activeBg: 'bg-violet-950/[0.08]',
    shadow: 'shadow-[0_0_14px_rgba(167,139,250,0.12),inset_0_0_12px_rgba(167,139,250,0.05)]',
    badge: 'border-violet-500/20 text-violet-400 bg-violet-950/40 shadow-[0_0_8px_rgba(167,139,250,0.15)]',
    btn: 'hover:border-violet-500/30 hover:bg-violet-500/10 text-violet-300 bg-violet-950/20'
  },
  clothing: {
    border: 'border-sky-500/20 hover:border-sky-500/40',
    bg: 'bg-sky-950/[0.03]',
    activeBg: 'bg-sky-950/[0.08]',
    shadow: 'shadow-[0_0_14px_rgba(56,189,248,0.12),inset_0_0_12px_rgba(56,189,248,0.05)]',
    badge: 'border-sky-500/20 text-sky-400 bg-sky-950/40 shadow-[0_0_8px_rgba(56,189,248,0.15)]',
    btn: 'hover:border-sky-500/30 hover:bg-sky-500/10 text-sky-300 bg-sky-950/20'
  },
  modeling: {
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
    bg: 'bg-emerald-950/[0.03]',
    activeBg: 'bg-emerald-950/[0.08]',
    shadow: 'shadow-[0_0_14px_rgba(74,222,128,0.12),inset_0_0_12px_rgba(74,222,128,0.05)]',
    badge: 'border-emerald-500/20 text-emerald-400 bg-emerald-950/40 shadow-[0_0_8px_rgba(74,222,128,0.15)]',
    btn: 'hover:border-emerald-500/30 hover:bg-emerald-500/10 text-emerald-300 bg-emerald-950/20'
  },
  'modeling-environment': {
    border: 'border-amber-500/20 hover:border-amber-500/40',
    bg: 'bg-amber-950/[0.03]',
    activeBg: 'bg-amber-950/[0.08]',
    shadow: 'shadow-[0_0_14px_rgba(245,158,11,0.12),inset_0_0_12px_rgba(245,158,11,0.05)]',
    badge: 'border-amber-500/20 text-amber-400 bg-amber-950/40 shadow-[0_0_8px_rgba(245,158,11,0.15)]',
    btn: 'hover:border-amber-500/30 hover:bg-amber-500/10 text-amber-300 bg-amber-950/20'
  },
  ui: {
    border: 'border-rose-500/20 hover:border-rose-500/40',
    bg: 'bg-rose-950/[0.03]',
    activeBg: 'bg-rose-950/[0.08]',
    shadow: 'shadow-[0_0_14px_rgba(251,113,133,0.12),inset_0_0_12px_rgba(251,113,133,0.05)]',
    badge: 'border-rose-500/20 text-rose-400 bg-rose-950/40 shadow-[0_0_8px_rgba(251,113,133,0.15)]',
    btn: 'hover:border-rose-500/30 hover:bg-rose-500/10 text-rose-300 bg-rose-950/20'
  }
}

const ENV_SPACING = 2.8

const PREVIEW_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'clothes', label: 'Clothes' }
]

const DEFAULT_CLOTHING_WORKFLOW = {
  provider: 'replicate',
  assetType: 'shirt',
  designPrompt: '',
  colorPalette: '',
  materialNotes: '',
  styleNotes: '',
  templateImagePath: null,
  templateDataUrl: null,
  shirtResultPath: null,
  shirtResultDataUrl: null,
  pantsResultPath: null,
  pantsResultDataUrl: null,
  resultPath: null,
  resultDataUrl: null,
  seed: '',
  lastPrompt: ''
}

export default function PlaygroundModule({ workflowState, setWorkflowState, onChangeModule }) {
  const [previewTab, setPreviewTab] = useState('overview')
  const [clothingBusy, setClothingBusy] = useState('')
  const [clothingNotice, setClothingNotice] = useState('')

  const animationResult = workflowState?.animationResult || null
  const clothingWorkflow = workflowState?.clothingWorkflow || null
  const hasShirtTexture = hasClothingSlot(clothingWorkflow, 'shirt')
  const hasPantsTexture = hasClothingSlot(clothingWorkflow, 'pants')
  const hasClothingTexture = hasAnyClothingTexture(clothingWorkflow)
  const activeAssetType = clothingWorkflow?.assetType || 'shirt'
  const accessories = useMemo(
    () => (workflowState?.charParts || []).filter((part) => part.status === 'done' && part.dataUrl),
    [workflowState]
  )
  const envParts = useMemo(
    () => (workflowState?.envParts || []).filter((part) => part.status === 'done' && part.dataUrl),
    [workflowState]
  )
  const uiWorkflow = workflowState?.uiWorkflow || null
  const uiFrames = useMemo(
    () =>
      (uiWorkflow?.screens || []).filter(
        (frame) =>
          frame.name?.trim() ||
          frame.objective?.trim() ||
          frame.layoutNotes?.trim() ||
          frame.motionNotes?.trim()
      ),
    [uiWorkflow]
  )
  const readyUiFrames = useMemo(
    () => uiFrames.filter((frame) => frame.status === 'ready'),
    [uiFrames]
  )
  const uiComponentCount = uiFrames.reduce((total, frame) => total + (frame.components?.length || 0), 0)
  const uiInteractionCount = uiFrames.reduce(
    (total, frame) => total + (frame.interactions?.length || 0),
    0
  )
  const workflowNodes = [
    {
      id: 'animation',
      title: 'Animation Node',
      ready: Boolean(animationResult?.bvhPath),
      accent: '#a78bfa',
      actionLabel: 'Open Animation',
      summary: animationResult?.bvhPath
        ? animationResult.type === 'video'
          ? 'Video-driven BVH is feeding the rig.'
          : 'Text-generated BVH is feeding the rig.'
        : 'No motion connected yet.'
    },
    {
      id: 'clothing',
      title: 'Clothing Node',
      ready: hasClothingTexture,
      accent: '#38bdf8',
      actionLabel: 'Open Clothing',
      summary: clothingConnectionSummary(clothingWorkflow)
        ? `${clothingConnectionSummary(clothingWorkflow)} for the avatar overlay.`
        : 'No classic clothing texture connected yet.'
    },
    {
      id: 'modeling',
      title: 'Accessories Node',
      ready: accessories.length > 0,
      accent: '#4ade80',
      actionLabel: 'Open Modeling',
      summary:
        accessories.length > 0
          ? `${accessories.length} accessory${accessories.length === 1 ? '' : 'ies'} attached to the character preview.`
          : 'No generated accessories connected yet.'
    },
    {
      id: 'modeling-environment',
      title: 'Environment Node',
      ready: envParts.length > 0,
      accent: '#f59e0b',
      actionLabel: 'Open Modeling',
      actionModule: 'modeling',
      summary:
        envParts.length > 0
          ? `${envParts.length} environment part${envParts.length === 1 ? '' : 's'} placed around the rig.`
          : 'No scene dressing connected yet.'
    },
    {
      id: 'ui',
      title: 'UI Node',
      ready: readyUiFrames.length > 0,
      accent: '#fb7185',
      actionLabel: 'Open UI Studio',
      summary:
        readyUiFrames.length > 0
          ? `${readyUiFrames.length} ready UI frame${readyUiFrames.length === 1 ? '' : 's'} with ${uiComponentCount} components and ${uiInteractionCount} interactions mapped into the workflow.`
          : 'No ready UI frames connected yet.'
    }
  ]
  const connectedNodeCount = workflowNodes.filter((node) => node.ready).length

  const updateClothingWorkflow = useCallback(
    (changes) => {
      if (!setWorkflowState) return
      setWorkflowState((prev) => ({
        ...prev,
        clothingWorkflow: {
          ...DEFAULT_CLOTHING_WORKFLOW,
          ...(prev.clothingWorkflow || {}),
          ...changes
        }
      }))
    },
    [setWorkflowState]
  )

  useEffect(() => {
    const workflow = clothingWorkflow
    if (!workflow) return undefined
    let cancelled = false

    async function hydrateSlot(assetType) {
      const { path, dataUrl } = clothingSlotKeys(assetType)
      const slotPaths = getClothingSlotPaths(workflow, assetType)
      if (!slotPaths.resultPath || slotPaths.resultDataUrl || workflow[dataUrl]) return

      const result = await window.api.readFileAsDataURL({ filePath: slotPaths.resultPath })
      if (cancelled || !result.success) return
      updateClothingWorkflow({ [dataUrl]: result.dataUrl })
    }

    hydrateSlot('shirt').catch(() => {})
    hydrateSlot('pants').catch(() => {})
    return () => {
      cancelled = true
    }
  }, [
    clothingWorkflow?.shirtResultPath,
    clothingWorkflow?.shirtResultDataUrl,
    clothingWorkflow?.pantsResultPath,
    clothingWorkflow?.pantsResultDataUrl,
    clothingWorkflow?.resultPath,
    clothingWorkflow?.resultDataUrl,
    clothingWorkflow?.assetType,
    updateClothingWorkflow
  ])

  const importClothingTexture = useCallback(async () => {
    setClothingBusy('import')
    const filePath = await window.api.openImage()
    if (!filePath) {
      setClothingBusy('')
      return
    }
    const result = await window.api.readFileAsDataURL({ filePath })
    setClothingBusy('')
    if (!result.success) {
      setClothingNotice(result.error || 'Could not load clothing image.')
      return
    }
    const slot = clothingWorkflow?.assetType || 'shirt'
    const { path, dataUrl } = clothingSlotKeys(slot)
    const changes = {
      assetType: slot,
      [path]: filePath,
      [dataUrl]: result.dataUrl,
      lastPrompt: ''
    }
    if ((clothingWorkflow?.assetType || 'shirt') === slot) {
      changes.resultPath = filePath
      changes.resultDataUrl = result.dataUrl
    }
    updateClothingWorkflow(changes)
    setPreviewTab('clothes')
    setClothingNotice(`${clothingAssetTypeLabel(slot)} texture imported.`)
  }, [clothingWorkflow?.assetType, updateClothingWorkflow])

  const clearClothingTexture = useCallback(() => {
    const slot = clothingWorkflow?.assetType || 'shirt'
    const { path, dataUrl } = clothingSlotKeys(slot)
    const changes = {
      [path]: null,
      [dataUrl]: null,
      lastPrompt: ''
    }
    if ((clothingWorkflow?.assetType || 'shirt') === slot) {
      changes.resultPath = null
      changes.resultDataUrl = null
    }
    updateClothingWorkflow(changes)
    setClothingNotice(`${clothingAssetTypeLabel(slot)} texture cleared.`)
  }, [clothingWorkflow?.assetType, updateClothingWorkflow])

  useEffect(() => {
    if (!clothingNotice) return undefined
    const timeout = window.setTimeout(() => setClothingNotice(''), 2400)
    return () => window.clearTimeout(timeout)
  }, [clothingNotice])

  return (
    <div className="flex h-full w-full overflow-hidden bg-radial from-[#121625] to-[#07090e] text-slate-100">
      <div className="w-[340px] shrink-0 border-r border-white/5 bg-[#0a0c14]/40 backdrop-blur-xl p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
        <div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
            Workflow Playground
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed mt-1.5">
            Streamline the flow as one connected graph: motion, classic clothing, accessories,
            environment, and UI all feed the same Roblox preview stage.
          </p>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
            Playground graph
          </div>
          <div className="text-base font-bold text-white mb-1.5">
            {connectedNodeCount}/{workflowNodes.length} node{workflowNodes.length === 1 ? '' : 's'} connected
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            This is a lightweight node-based review board rather than a full graph editor, so you
            can jump between modules quickly and see what is already feeding the live viewport.
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 shadow-xl backdrop-blur-md">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Connected clothing
              </div>
              <div className="text-base font-bold text-white mb-1.5">
                {clothingConnectionSummary(clothingWorkflow) || 'No clothing texture yet'}
              </div>
            </div>
            <button
              className="px-2.5 py-1.5 text-[10px] font-bold rounded-lg border border-sky-500/25 bg-sky-950/30 text-sky-300 hover:bg-sky-900/40 hover:border-sky-400/40 transition-all duration-200 cursor-pointer flex items-center gap-1 shrink-0"
              onClick={() => setPreviewTab('clothes')}
            >
              <Shirt size={11} /> Clothes tab
            </button>
          </div>
          <div className="text-xs text-slate-400 leading-relaxed">
            Roblox outfits use separate 585×559 shirt and pants template PNGs. Import both for a
            full outfit preview on the R15 rig.
          </div>

          <button
            className="w-full mt-3 px-4 py-3 text-sm font-bold rounded-xl border border-sky-500/30 bg-sky-950/40 text-sky-200 hover:bg-sky-900/50 hover:border-sky-400/50 transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(56,189,248,0.08)]"
            onClick={importClothingTexture}
            disabled={clothingBusy === 'import'}
          >
            <Upload size={14} />
            {clothingBusy === 'import' ? 'Importing…' : 'Import PNG'}
          </button>

          <div className="flex gap-2 mt-3 flex-wrap">
            {(hasShirtTexture || hasPantsTexture) && (
              <button
                className="px-3 py-2 text-xs font-semibold rounded-xl border border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                onClick={clearClothingTexture}
              >
                <Trash2 size={12} /> Clear {clothingAssetTypeLabel(activeAssetType)}
              </button>
            )}
          </div>

          <div className="flex gap-2 mt-3">
            {CLOTHING_ASSET_TYPES.map((type) => {
              const active = (clothingWorkflow?.assetType || 'shirt') === type
              return (
                <button
                  key={type}
                  className={`flex-1 py-2 text-[11px] font-bold rounded-xl border transition-all duration-200 cursor-pointer ${
                    active
                      ? 'bg-sky-950/40 border-sky-500/30 text-sky-300'
                      : 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-slate-200 hover:border-white/10'
                  }`}
                  onClick={() => updateClothingWorkflow({ assetType: type })}
                >
                  {clothingAssetTypeLabel(type)}
                </button>
              )
            })}
          </div>

          {clothingNotice && (
            <div className="mt-3 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] font-medium">
              {clothingNotice}
            </div>
          )}

          {(hasShirtTexture || hasPantsTexture) && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              {hasShirtTexture && (
                <div>
                  <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wide mb-1">
                    Shirt
                  </div>
                  <img
                    src={getClothingSlotPaths(clothingWorkflow, 'shirt').resultDataUrl}
                    alt="Connected classic shirt texture"
                    className="w-full rounded-xl border border-white/5 shadow-lg shadow-black/25 hover:border-white/10 transition-all duration-300"
                  />
                </div>
              )}
              {hasPantsTexture && (
                <div>
                  <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wide mb-1">
                    Pants
                  </div>
                  <img
                    src={getClothingSlotPaths(clothingWorkflow, 'pants').resultDataUrl}
                    alt="Connected classic pants texture"
                    className="w-full rounded-xl border border-white/5 shadow-lg shadow-black/25 hover:border-white/10 transition-all duration-300"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 mt-1">
          {workflowNodes.map((node, index) => {
            const nodeStyle = categoryStyles[node.id] || {
              border: 'border-white/5',
              bg: 'bg-white/[0.01]',
              activeBg: 'bg-white/[0.02]',
              shadow: '',
              badge: 'border-white/5 text-slate-400 bg-slate-950/40',
              btn: 'hover:border-white/10 hover:bg-white/[0.04]'
            }
            return (
              <div key={node.id} className="flex flex-col items-stretch">
                {index > 0 && (
                  <div className="w-0.5 h-6 bg-gradient-to-b from-violet-500/30 to-transparent self-center rounded-full my-1" />
                )}
                <div
                  className={`border rounded-2xl p-4 transition-all duration-300 backdrop-blur-md ${
                    node.ready
                      ? `${nodeStyle.border} ${nodeStyle.activeBg} ${nodeStyle.shadow}`
                      : 'border-white/5 bg-white/[0.01] hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex justify-between items-center gap-3 mb-2">
                    <div className="text-xs font-bold text-slate-100">{node.title}</div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-semibold tracking-wide rounded-full border backdrop-blur-md ${
                        node.ready
                          ? nodeStyle.badge
                          : 'border-slate-500/20 text-slate-400 bg-slate-950/40'
                      }`}
                    >
                      {node.ready ? 'Connected' : 'Waiting'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed">{node.summary}</div>
                  <button
                    className={`w-full mt-3 px-3 py-2 text-xs font-semibold rounded-xl border transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                      node.ready
                        ? `${nodeStyle.btn}`
                        : 'border-white/5 bg-white/[0.02] text-slate-300 hover:border-white/10 hover:bg-white/[0.05]'
                    }`}
                    onClick={() => onChangeModule?.(node.actionModule || node.id)}
                  >
                    {node.actionLabel}
                  </button>
                </div>
              </div>
            )
          })}
          
          <div className="w-0.5 h-6 bg-gradient-to-b from-violet-500/30 to-transparent self-center rounded-full my-1" />
          
          <div className="border border-violet-500/30 bg-violet-950/[0.08] shadow-[0_0_16px_rgba(124,58,237,0.12),inset_0_0_12px_rgba(124,58,237,0.06)] rounded-2xl p-4 backdrop-blur-md">
            <div className="flex justify-between items-center gap-3 mb-2">
              <div className="text-xs font-bold text-slate-100">Playground Output</div>
              <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wide rounded-full border border-violet-500/30 text-violet-400 bg-violet-950/40 shadow-[0_0_8px_rgba(124,58,237,0.15)] backdrop-blur-md">
                Live
              </span>
            </div>
            <div className="text-xs text-slate-400 leading-relaxed">
              Combined preview of the animated R15 rig, classic clothing overlay, equipped
              accessories, scene parts, and workflow state.
            </div>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-violet-950/[0.04] border border-violet-500/10 text-xs text-slate-400 leading-relaxed flex flex-col gap-1.5">
          <strong className="text-violet-300">Current workflow:</strong>
          <div>1. Generate motion in Animation</div>
          <div>2. Generate classic shirt/pants in Clothing</div>
          <div>3. Generate accessories in Modeling</div>
          <div>4. Create UI frames in UI Studio</div>
          <div>5. Review the connected flow here</div>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="shrink-0 border-b border-white/5 bg-[#0a0c14]/60 backdrop-blur-xl px-4 py-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex gap-1.5 bg-white/[0.02] p-1 rounded-xl border border-white/5">
              {PREVIEW_TABS.map((tab) => {
                const active = previewTab === tab.id
                const clothesConnected = tab.id === 'clothes' && hasClothingTexture
                return (
                  <button
                    key={tab.id}
                    onClick={() => setPreviewTab(tab.id)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 cursor-pointer flex items-center gap-1.5 ${
                      active
                        ? tab.id === 'clothes'
                          ? 'bg-sky-950/50 border border-sky-500/30 text-sky-300 shadow-[0_0_12px_rgba(56,189,248,0.12)]'
                          : 'bg-violet-950/50 border border-violet-500/30 text-violet-300 shadow-[0_0_12px_rgba(167,139,250,0.12)]'
                        : tab.id === 'clothes'
                          ? 'border border-sky-500/15 text-sky-400/90 hover:text-sky-300 hover:bg-sky-950/20'
                          : 'border border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                    }`}
                  >
                    {tab.id === 'clothes' && <Shirt size={12} />}
                    {tab.label}
                    {clothesConnected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2 flex-wrap">
              {previewTab === 'clothes' && (
                <button
                  className="px-4 py-2 text-xs font-bold rounded-xl border border-sky-500/30 bg-sky-950/40 text-sky-200 hover:bg-sky-900/50 hover:border-sky-400/50 transition-all duration-200 cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(56,189,248,0.08)]"
                  onClick={importClothingTexture}
                  disabled={clothingBusy === 'import'}
                >
                  <Upload size={13} />
                  {clothingBusy === 'import' ? 'Importing…' : 'Import PNG'}
                </button>
              )}
              {previewTab === 'clothes' && hasClothingTexture && (
                <button
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
                  onClick={clearClothingTexture}
                >
                  <Trash2 size={12} /> Clear {clothingAssetTypeLabel(activeAssetType)}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 relative">
          <WorkflowViewport
            previewTab={previewTab}
            animationResult={animationResult}
            clothingWorkflow={clothingWorkflow}
            accessories={accessories}
            envParts={envParts}
          />

          {previewTab === 'clothes' && (
            <ClothesTabOverlay
              clothingWorkflow={clothingWorkflow}
              hasShirtTexture={hasShirtTexture}
              hasPantsTexture={hasPantsTexture}
              clothingBusy={clothingBusy}
              clothingNotice={clothingNotice}
              onImport={importClothingTexture}
              onClear={clearClothingTexture}
              onAssetTypeChange={(assetType) => updateClothingWorkflow({ assetType })}
              onOpenClothing={() => onChangeModule?.('clothing')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ClothesTabOverlay({
  clothingWorkflow,
  hasShirtTexture,
  hasPantsTexture,
  clothingBusy,
  clothingNotice,
  onImport,
  onClear,
  onAssetTypeChange,
  onOpenClothing
}) {
  const assetType = clothingWorkflow?.assetType || 'shirt'
  const activeSlot = getClothingSlotPaths(clothingWorkflow, assetType)

  return (
    <div className="absolute bottom-4 right-4 w-[280px] max-w-[calc(100%-2rem)] pointer-events-auto">
      <div className="bg-[#0a0c14]/90 border border-sky-500/20 rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-xs font-bold text-sky-300 uppercase tracking-wide flex items-center gap-1.5">
            <Shirt size={13} /> Clothes Preview
          </div>
          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full border border-sky-500/25 text-sky-400 bg-sky-950/40">
            {clothingAssetTypeLabel(assetType)}
          </span>
        </div>

        <div className="text-[11px] text-slate-400 leading-relaxed mb-3">
          Roblox uses separate 585×559 templates: <strong className="text-sky-300">shirt</strong>{' '}
          (torso + arms) and <strong className="text-sky-300">pants</strong> (torso + legs). Import
          each PNG into its slot — they stack on the rig for a full outfit.
        </div>

        {hasShirtTexture &&
          hasPantsTexture &&
          getClothingSlotPaths(clothingWorkflow, 'shirt').resultDataUrl &&
          getClothingSlotPaths(clothingWorkflow, 'shirt').resultDataUrl ===
            getClothingSlotPaths(clothingWorkflow, 'pants').resultDataUrl && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px] leading-relaxed">
              Shirt and pants are the same file. The pants slot needs the{' '}
              <strong>pants template</strong> PNG (legs layout), not the shirt template — otherwise
              legs will show scrambled guide/logo regions.
            </div>
          )}

        <div className="flex gap-2 mb-3 flex-wrap">
          {CLOTHING_ASSET_TYPES.map((type) => {
            const active = assetType === type
            const loaded = type === 'shirt' ? hasShirtTexture : hasPantsTexture
            return (
              <button
                key={type}
                className={`flex-1 min-w-[72px] py-1.5 text-[10px] font-bold rounded-lg border transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-sky-950/40 border-sky-500/30 text-sky-300'
                    : 'border-white/5 bg-white/[0.02] text-slate-400 hover:text-slate-200 hover:border-white/10'
                }`}
                onClick={() => onAssetTypeChange(type)}
              >
                {type === 'shirt' ? 'Shirt' : 'Pants'}
                {loaded && (
                  <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-sky-400 align-middle" />
                )}
              </button>
            )
          })}
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          <button
            className="flex-1 px-3 py-2 text-xs font-semibold rounded-xl border border-sky-500/25 bg-sky-950/30 text-sky-300 hover:bg-sky-900/40 hover:border-sky-400/40 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
            onClick={onImport}
            disabled={clothingBusy === 'import'}
          >
            <Upload size={12} />
            {clothingBusy === 'import' ? 'Importing…' : `Import ${assetType === 'pants' ? 'Pants' : 'Shirt'} PNG`}
          </button>
          {activeSlot.resultDataUrl && (
            <button
              className="px-3 py-2 text-xs font-semibold rounded-xl border border-white/5 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05] hover:border-white/10 transition-all duration-200 cursor-pointer flex items-center gap-1.5"
              onClick={onClear}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>

        {clothingNotice && (
          <div className="mb-3 px-3 py-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-300 text-[11px] font-medium">
            {clothingNotice}
          </div>
        )}

        {(hasShirtTexture || hasPantsTexture) ? (
          <div className="space-y-2">
            {hasShirtTexture && (
              <div>
                <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wide mb-1">
                  Shirt
                </div>
                <img
                  src={getClothingSlotPaths(clothingWorkflow, 'shirt').resultDataUrl}
                  alt="Imported classic shirt texture"
                  className="w-full rounded-xl border border-white/5 shadow-inner"
                />
              </div>
            )}
            {hasPantsTexture && (
              <div>
                <div className="text-[10px] font-bold text-sky-400 uppercase tracking-wide mb-1">
                  Pants
                </div>
                <img
                  src={getClothingSlotPaths(clothingWorkflow, 'pants').resultDataUrl}
                  alt="Imported classic pants texture"
                  className="w-full rounded-xl border border-white/5 shadow-inner"
                />
              </div>
            )}
            {activeSlot.resultPath && (
              <div className="text-[10px] text-slate-500 font-mono break-all leading-normal">
                {activeSlot.resultPath}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-sky-500/20 bg-sky-950/10 px-3 py-8 text-center">
            <Shirt size={28} className="mx-auto text-sky-400/70 mb-2" />
            <p className="text-sm font-bold text-sky-200">No clothing textures yet</p>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Import shirt and pants PNGs separately, or generate them in Clothing Studio.
            </p>
            <button
              className="mt-4 w-full px-4 py-2.5 text-xs font-bold rounded-xl border border-sky-500/30 bg-sky-950/40 text-sky-200 hover:bg-sky-900/50 hover:border-sky-400/50 transition-all duration-200 cursor-pointer flex items-center justify-center gap-1.5"
              onClick={onImport}
              disabled={clothingBusy === 'import'}
            >
              <Upload size={13} />
              {clothingBusy === 'import' ? 'Importing…' : 'Import PNG'}
            </button>
            <button
              className="mt-2 w-full px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-white/5 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-200 cursor-pointer"
              onClick={onOpenClothing}
            >
              Open Clothing Studio
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function WorkflowViewport({ previewTab, animationResult, clothingWorkflow, accessories, envParts }) {
  const mountRef = useRef(null)
  const stateRef = useRef({})
  const previewTabRef = useRef(previewTab)
  previewTabRef.current = previewTab
  const [rigReady, setRigReady] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [status, setStatus] = useState({ rig: false, motion: false, clothing: false, error: null })
  const clothesFocus = previewTab === 'clothes'
  const hasShirtTexture = hasClothingSlot(clothingWorkflow, 'shirt')
  const hasPantsTexture = hasClothingSlot(clothingWorkflow, 'pants')
  const visibleAccessories = clothesFocus ? [] : accessories
  const visibleEnvParts = clothesFocus ? [] : envParts

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0c0e13)

    const camera = new THREE.PerspectiveCamera(52, el.clientWidth / el.clientHeight, 0.01, 500)
    camera.position.set(0, 2.4, 6.6)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(0, 1.5, 0)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08

    scene.add(new THREE.GridHelper(28, 28, 0x252a36, 0x1a1d26))
    scene.add(new THREE.AmbientLight(0xffffff, 0.75))

    const key = new THREE.DirectionalLight(0xffffff, 1.25)
    key.position.set(5, 8, 5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)

    const fill = new THREE.DirectionalLight(0xa78bfa, 0.45)
    fill.position.set(-4, 3, -5)
    scene.add(fill)

    const rigGroup = new THREE.Group()
    scene.add(rigGroup)

    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight)
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
    })
    ro.observe(el)

    let animId
    const clock = new THREE.Clock()
    function animate() {
      animId = requestAnimationFrame(animate)
      orbit.update()
      if (stateRef.current.mixer && stateRef.current.playing) {
        stateRef.current.mixer.update(clock.getDelta())
      } else {
        clock.getDelta()
      }
      renderer.render(scene, camera)
    }
    animate()

    stateRef.current = {
      scene,
      renderer,
      camera,
      orbit,
      rigGroup,
      envMap: new Map(),
      accMap: new Map(),
      clothingOverlays: [],
      playing: true
    }

    const loader = new GLTFLoader()
    loader.load(
      '/r15_rig.glb',
      (gltf) => {
        rigGroup.add(gltf.scene)
        gltf.scene.traverse((obj) => {
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

        let skinnedMesh = null
        gltf.scene.traverse((obj) => {
          if (!skinnedMesh && obj.isSkinnedMesh && obj.skeleton) skinnedMesh = obj
        })

        stateRef.current.rigScene = gltf.scene
        stateRef.current.targetMesh = skinnedMesh
        stateRef.current.anchors = buildAttachmentAnchors(gltf.scene)
        stateRef.current.rigNameMap = buildRigNameMap(gltf.scene)
        setStatus((prev) => ({ ...prev, rig: true, error: null }))
        setRigReady((prev) => prev + 1)
      },
      undefined,
      (err) =>
        setStatus({ rig: false, motion: false, error: `Failed to load R15 rig: ${err.message}` })
    )

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    const s = stateRef.current
    if (!s.rigScene || !s.anchors) return

    const currentIds = new Set(visibleAccessories.map((acc) => acc.id))
    for (const [id, entry] of s.accMap.entries()) {
      if (!currentIds.has(id)) {
        entry.anchor.remove(entry.object)
        s.accMap.delete(id)
      }
    }

    for (const acc of visibleAccessories) {
      if (s.accMap.has(acc.id) || !acc.dataUrl) continue

      let buffer
      try {
        buffer = dataUrlToArrayBuffer(acc.dataUrl)
      } catch {
        continue
      }

      const loader = new GLTFLoader()
      loader.parse(
        buffer,
        '',
        (gltf) => {
          const accScene = gltf.scene
          const attachKey = acc.attachPoint || 'HatAttachment'
          const anchor = s.anchors[attachKey]
          const def = ROBLOX_ATTACH[attachKey]
          if (!anchor || !def) return

          const bbox = new THREE.Box3().setFromObject(accScene)
          const size = bbox.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const rigBbox = new THREE.Box3().setFromObject(s.rigScene)
          const rigHeight = rigBbox.max.y - rigBbox.min.y
          if (maxDim > 0) accScene.scale.setScalar((rigHeight * 0.15) / maxDim)

          const scaledBox = new THREE.Box3().setFromObject(accScene)
          const offset = new THREE.Vector3()
          if (def.anchor === 'bottom') offset.y = -scaledBox.min.y
          else if (def.anchor === 'top') offset.y = -scaledBox.max.y

          const center = scaledBox.getCenter(new THREE.Vector3())
          accScene.position.sub(center).add(offset)

          anchor.add(accScene)
          s.accMap.set(acc.id, { object: accScene, anchor })
        },
        (err) => setStatus((prev) => ({ ...prev, error: `Accessory parse failed: ${err.message}` }))
      )
    }
  }, [visibleAccessories, rigReady])

  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return

    const parts = visibleEnvParts.filter((part) => part.dataUrl)
    const currentIds = new Set(parts.map((part) => part.id))

    for (const [id, group] of s.envMap.entries()) {
      if (!currentIds.has(id)) {
        s.scene.remove(group)
        s.envMap.delete(id)
      }
    }

    for (const part of parts) {
      if (s.envMap.has(part.id)) continue

      let buffer
      try {
        buffer = dataUrlToArrayBuffer(part.dataUrl)
      } catch {
        continue
      }

      const loader = new GLTFLoader()
      loader.parse(
        buffer,
        '',
        (gltf) => {
          const group = new THREE.Group()
          group.add(gltf.scene)

          const bbox = new THREE.Box3().setFromObject(group)
          const size = bbox.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          if (maxDim > 0) group.scale.setScalar(1.35 / maxDim)

          bbox.setFromObject(group)
          group.position.y -= bbox.min.y
          s.scene.add(group)
          s.envMap.set(part.id, group)
          layoutEnvironment(s)
          focusScene(s)
        },
        (err) =>
          setStatus((prev) => ({ ...prev, error: `Environment part parse failed: ${err.message}` }))
      )
    }

    layoutEnvironment(s)
    focusScene(s)
  }, [visibleEnvParts])

  useEffect(() => {
    const s = stateRef.current
    if (!s.rigScene) return

    clearClothingOverlays(s)

    let cancelled = false

    async function applyClothingOverlays() {
      const shirtSource = await resolveClothingSlotTextureSource(clothingWorkflow, 'shirt')
      const pantsSource = await resolveClothingSlotTextureSource(clothingWorkflow, 'pants')
      if (cancelled) return

      if (!shirtSource && !pantsSource) {
        setStatus((prev) => ({ ...prev, clothing: false }))
        if (previewTabRef.current === 'clothes') focusClothingScene(s, clothingWorkflow)
        else focusScene(s)
        return
      }

      const textureLoader = new THREE.TextureLoader()
      const overlays = []

      async function loadSlotTexture(source, assetType, renderOrderOffset) {
        return new Promise((resolve) => {
          textureLoader.load(
            source,
            (texture) => {
              if (cancelled) {
                texture.dispose()
                resolve([])
                return
              }

              configureClassicClothingTexture(texture)
              const slotOverlays = applyClothingTextureToRig(
                s,
                texture,
                assetType,
                renderOrderOffset
              )
              overlays.push(...slotOverlays)
              resolve(slotOverlays)
            },
            undefined,
            () => resolve([])
          )
        })
      }

      if (shirtSource) await loadSlotTexture(shirtSource, 'shirt', 1)
      if (pantsSource) await loadSlotTexture(pantsSource, 'pants', 2)

      if (cancelled) {
        clearClothingOverlays(s)
        return
      }

      s.clothingOverlays = overlays
      setStatus((prev) => ({
        ...prev,
        clothing: overlays.length > 0,
        error: overlays.length > 0 ? null : prev.error
      }))

      if (import.meta.env.DEV && overlays.length === 0) {
        console.warn('[Playground] Clothing textures loaded but no R15 body meshes matched.')
      }

      if (previewTabRef.current === 'clothes') focusClothingScene(s, clothingWorkflow)
      else focusScene(s)
    }

    applyClothingOverlays().catch((err) => {
      if (cancelled) return
      setStatus((prev) => ({
        ...prev,
        clothing: false,
        error: err.message || 'Clothing overlay failed.'
      }))
    })

    return () => {
      cancelled = true
    }
  }, [
    clothingWorkflow?.shirtResultDataUrl,
    clothingWorkflow?.shirtResultPath,
    clothingWorkflow?.pantsResultDataUrl,
    clothingWorkflow?.pantsResultPath,
    clothingWorkflow?.resultDataUrl,
    clothingWorkflow?.resultPath,
    clothingWorkflow?.assetType,
    rigReady
  ])

  useEffect(() => {
    const s = stateRef.current
    if (!s.rigScene) return
    if (clothesFocus) focusClothingScene(s, clothingWorkflow)
    else focusScene(s)
  }, [clothesFocus, rigReady, clothingWorkflow])

  useEffect(() => {
    const s = stateRef.current
    if (!s.scene || !s.rigScene || !s.targetMesh) return

    if (s.action) {
      s.action.stop()
      s.action = null
    }
    if (s.mixer) {
      s.mixer.stopAllAction()
      s.mixer = null
    }
    if (s.sourceHelper) {
      s.scene.remove(s.sourceHelper)
      s.sourceHelper = null
    }

    if (!animationResult?.bvhPath) {
      setStatus((prev) => ({ ...prev, motion: false }))
      return
    }

    window.api
      .readTextFile({ filePath: animationResult.bvhPath })
      .then(({ success, text, error }) => {
        if (!success) {
          setStatus((prev) => ({ ...prev, motion: false, error }))
          return
        }

        const loader = new BVHLoader()
        const parsed = loader.parse(text)
        canonicalizeMotionSkeleton(parsed.skeleton.bones[0])
        canonicalizeMotionClip(parsed.clip)

        const sourceHelper = new THREE.SkeletonHelper(parsed.skeleton.bones[0])
        sourceHelper.skeleton = parsed.skeleton
        sourceHelper.visible = false
        s.scene.add(sourceHelper)

        const clip = retargetClip(s.targetMesh, sourceHelper, parsed.clip, {
          names: s.rigNameMap,
          hip: 'Root',
          useFirstFramePosition: true
        })

        const mixer = new THREE.AnimationMixer(s.rigScene)
        const action = mixer.clipAction(clip)
        action.play()

        s.sourceHelper = sourceHelper
        s.mixer = mixer
        s.action = action
        s.playing = true
        setPlaying(true)
        setStatus((prev) => ({ ...prev, motion: true, error: null }))
        if (clothesFocus) focusClothingScene(s, clothingWorkflow)
        else focusScene(s)
      })
      .catch((err) => setStatus((prev) => ({ ...prev, motion: false, error: err.message })))
  }, [animationResult?.bvhPath, rigReady, clothesFocus, clothingWorkflow])

  function togglePlayback() {
    const s = stateRef.current
    if (!s.action) return
    s.playing = !s.playing
    s.action.paused = !s.playing
    setPlaying(s.playing)
  }

  function focusCurrentScene() {
    const s = stateRef.current
    if (clothesFocus) focusClothingScene(s, clothingWorkflow)
    else focusScene(s)
  }

  return (
    <div className="relative h-full w-full bg-[#0a0c14]">
      <div ref={mountRef} className="w-full h-full" />

      <div className="absolute top-4 left-4 flex flex-wrap gap-2 items-center pointer-events-none">
        <span className="px-2.5 py-1 text-[11px] font-semibold tracking-wide rounded-full border border-white/5 bg-[#0a0c14]/80 text-slate-400 backdrop-blur-md">
          {clothesFocus ? 'Clothes Preview' : 'Connected Preview'}
        </span>
        {status.rig && (
          <span className="px-2.5 py-1 text-[11px] font-semibold tracking-wide rounded-full border border-emerald-500/20 bg-emerald-950/40 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)] backdrop-blur-md">
            R15 Ready
          </span>
        )}
        {status.motion && (
          <span className="px-2.5 py-1 text-[11px] font-semibold tracking-wide rounded-full border border-violet-500/20 bg-violet-950/40 text-violet-400 shadow-[0_0_10px_rgba(167,139,250,0.1)] backdrop-blur-md">
            Motion Applied
          </span>
        )}
        {status.clothing && (
          <span className="px-2.5 py-1 text-[11px] font-semibold tracking-wide rounded-full border border-sky-500/20 bg-sky-950/40 text-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.1)] backdrop-blur-md">
            Clothing Applied
          </span>
        )}
      </div>

      <div className="absolute top-4 right-4 flex gap-2">
        <button
          onClick={togglePlayback}
          disabled={!status.motion}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl shadow-lg backdrop-blur-md transition-all duration-200 border ${
            !status.motion
              ? 'text-slate-500 bg-white/[0.01] border-white/5 cursor-not-allowed opacity-50'
              : 'text-slate-200 bg-white/[0.03] hover:bg-white/[0.08] border-white/5 hover:border-white/10 active:scale-[0.98] cursor-pointer'
          }`}
        >
          {playing ? 'Pause Motion' : 'Play Motion'}
        </button>
        <button
          onClick={focusCurrentScene}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-200 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 active:scale-[0.98] rounded-xl shadow-lg backdrop-blur-md cursor-pointer transition-all duration-200"
        >
          Focus View
        </button>
      </div>

      {status.error && (
        <div className="absolute bottom-4 left-4 right-4 flex justify-center">
          <div className="max-w-xl bg-red-950/40 border border-red-500/20 rounded-2xl px-4 py-3 text-xs text-red-300 shadow-[0_0_16px_rgba(239,68,68,0.15)] backdrop-blur-md leading-relaxed">
            {status.error}
          </div>
        </div>
      )}

      {previewTab === 'clothes' && (hasShirtTexture || hasPantsTexture) && (
        <div className="absolute top-16 left-4 z-10 pointer-events-none max-w-[min(380px,44vw)]">
          <div className="bg-[#0a0c14]/90 border border-sky-500/25 rounded-2xl p-3 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="text-[10px] font-bold text-sky-300 uppercase tracking-wide mb-2">
              2D Clothing Preview
            </div>
            <div className="grid grid-cols-2 gap-2">
              {hasShirtTexture && (
                <div>
                  <div className="text-[9px] font-bold text-sky-400 uppercase tracking-wide mb-1">
                    Shirt
                  </div>
                  <img
                    src={getClothingSlotPaths(clothingWorkflow, 'shirt').resultDataUrl}
                    alt="Classic shirt texture preview"
                    className="w-full max-h-[min(40vh,360px)] object-contain rounded-xl border border-white/10 bg-black/20"
                  />
                </div>
              )}
              {hasPantsTexture && (
                <div>
                  <div className="text-[9px] font-bold text-sky-400 uppercase tracking-wide mb-1">
                    Pants
                  </div>
                  <img
                    src={getClothingSlotPaths(clothingWorkflow, 'pants').resultDataUrl}
                    alt="Classic pants texture preview"
                    className="w-full max-h-[min(40vh,360px)] object-contain rounded-xl border border-white/10 bg-black/20"
                  />
                </div>
              )}
            </div>
            {!status.clothing && status.rig && (
              <p className="text-[10px] text-amber-300/90 mt-2 leading-relaxed">
                Textures loaded — applying 3D overlays to the R15 rig…
              </p>
            )}
          </div>
        </div>
      )}

      {previewTab === 'clothes' && !hasShirtTexture && !hasPantsTexture && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center select-none">
          <div className="bg-slate-950/40 border border-sky-500/15 backdrop-blur-lg rounded-3xl p-6 max-w-sm shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <Shirt size={32} className="mx-auto text-sky-400/80 mb-3" />
            <p className="text-sm font-bold text-sky-200 uppercase tracking-wider">
              Import clothing to preview
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Import separate 585×559 shirt and pants template PNGs to preview a full Roblox outfit
              on the R15 rig.
            </p>
          </div>
        </div>
      )}

      {previewTab === 'clothes' &&
        !getClothingSlotPaths(clothingWorkflow, 'shirt').resultDataUrl &&
        !getClothingSlotPaths(clothingWorkflow, 'pants').resultDataUrl &&
        (getClothingSlotPaths(clothingWorkflow, 'shirt').resultPath ||
          getClothingSlotPaths(clothingWorkflow, 'pants').resultPath) && (
        <div className="absolute top-16 left-4 z-10 pointer-events-none">
          <div className="bg-[#0a0c14]/90 border border-sky-500/20 rounded-2xl px-4 py-3 text-xs text-sky-300 backdrop-blur-xl">
            Loading clothing textures…
          </div>
        </div>
      )}

      {previewTab === 'overview' &&
        !animationResult?.bvhPath &&
        !hasShirtTexture &&
        !hasPantsTexture &&
        accessories.length === 0 &&
        envParts.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none p-6 text-center select-none">
          <div className="bg-slate-950/40 border border-white/5 backdrop-blur-lg rounded-3xl p-6 max-w-sm shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
            <p className="text-sm font-bold text-slate-200 uppercase tracking-wider">
              Nothing to preview yet
            </p>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Generate animation, classic clothing, accessories, or environment parts and they will
              appear here automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

function layoutEnvironment(state) {
  if (!state?.envMap) return
  let index = 0
  for (const group of state.envMap.values()) {
    group.position.x = (index - (state.envMap.size - 1) / 2) * ENV_SPACING
    group.position.z = -2.2
    index += 1
  }
}

async function resolveClothingSlotTextureSource(workflow, assetType) {
  if (!workflow) return null
  const { resultPath, resultDataUrl } = getClothingSlotPaths(workflow, assetType)
  if (resultDataUrl) return resultDataUrl
  if (!resultPath || !window.api?.readFileAsDataURL) return null
  const result = await window.api.readFileAsDataURL({ filePath: resultPath })
  return result.success ? result.dataUrl : null
}

function applyClothingTextureToRig(state, texture, assetType, renderOrderOffset = 1) {
  if (!state?.rigScene || !texture) return []

  const overlays = []
  state.rigScene.traverse((obj) => {
    if (!isClothingBodyMesh(obj) || !isClothingTargetMesh(obj, assetType)) return

    const partName = resolveClothingPartName(obj)
    const geometry = prepareClassicClothingGeometry(obj.geometry, assetType, partName)
    const material = createClassicClothingMaterial(texture)
    const overlay = new THREE.Mesh(geometry, material)
    overlay.name = `__clothing_overlay_${assetType || 'shirt'}_${obj.name}`
    overlay.renderOrder = (obj.renderOrder || 0) + renderOrderOffset
    overlay.castShadow = false
    overlay.receiveShadow = false
    overlay.frustumCulled = false
    overlay.position.copy(obj.position)
    overlay.quaternion.copy(obj.quaternion)
    overlay.scale.copy(obj.scale)
    obj.parent?.add(overlay)
    overlays.push({ mesh: overlay, material, geometry, texture })
  })

  return overlays
}

function isClothingBodyMesh(obj) {
  return Boolean(obj?.isMesh && !obj.name.startsWith('__clothing_overlay_'))
}

function focusClothingScene(state, clothingWorkflow) {
  if (!state?.camera || !state?.orbit || !state?.rigScene) return

  const activeAssetTypes = []
  if (hasClothingSlot(clothingWorkflow, 'shirt')) activeAssetTypes.push('shirt')
  if (hasClothingSlot(clothingWorkflow, 'pants')) activeAssetTypes.push('pants')
  if (activeAssetTypes.length === 0) {
    focusScene(state)
    return
  }

  const bounds = new THREE.Box3()
  state.rigScene.traverse((obj) => {
    if (!isClothingBodyMesh(obj)) return
    if (!activeAssetTypes.some((assetType) => isClothingTargetMesh(obj, assetType))) return
    bounds.expandByObject(obj)
  })

  if (bounds.isEmpty()) {
    focusScene(state)
    return
  }

  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z, 1.2)
  state.orbit.target.copy(center)
  state.camera.position.set(center.x, center.y + maxDim * 0.15, center.z + maxDim * 1.35 + 0.8)
  state.camera.lookAt(center)
}

function focusScene(state) {
  if (!state?.camera || !state?.orbit || !state?.rigScene) return
  const bounds = new THREE.Box3()
  bounds.expandByObject(state.rigScene)
  for (const group of state.envMap?.values() || []) bounds.expandByObject(group)
  if (bounds.isEmpty()) return

  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  state.orbit.target.copy(center)
  state.camera.position.set(center.x, center.y + maxDim * 0.45, center.z + maxDim * 1.7 + 1.4)
  state.camera.lookAt(center)
}

function clearClothingOverlays(state) {
  if (!state?.clothingOverlays?.length) {
    state.clothingOverlays = []
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

  // Classic shirt: torso + arms only (no legs)
  return isTorso || isArm || isHand
}

/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Settings, Play, Compass, Sparkles, User } from 'lucide-react'
import PartsList from './PartsList'
import R15Viewer from './R15Viewer'
import SceneBuilder from './SceneBuilder'
import {
  emptyReferenceImages,
  normalizeReferenceImages,
  partHasReferenceImages,
  serializeReferenceImagePaths,
  hydrateReferenceImages,
  REFERENCE_IMAGE_SLOTS,
  REFERENCE_IMAGE_LABELS
} from './referenceImages'

let nextId = 1
function hydratePart(part = {}) {
  return mkPart({
    ...part,
    referenceImages: hydrateReferenceImages(part)
  })
}

function mkPart(overrides = {}) {
  return {
    id: `part-${nextId++}`,
    name: '',
    prompt: '',
    status: 'pending',
    outputPath: null,
    dataUrl: null,
    referenceImages: emptyReferenceImages(),
    attachPoint: 'HatAttachment',
    error: null,
    provider: null,
    ...overrides
  }
}

const TABS = [
  { id: 'character', label: 'Character Accessories', icon: 'user' },
  { id: 'environment', label: 'Environment Scene', icon: 'compass' }
]

export default function ModelingModule({ workflowState, setWorkflowState, onChangeModule }) {
  const [tab, setTab] = useState('character')
  const [charParts, setCharParts] = useState(() => (workflowState?.charParts || []).map(hydratePart))
  const [envParts, setEnvParts] = useState(() => (workflowState?.envParts || []).map(hydratePart))
  const [tripoOpts, setTripoOpts] = useState({
    authMode: 'web',
    webBaseUrl: 'https://studio.tripo3d.ai/',
    webGenerateUrl: 'https://studio.tripo3d.ai/workspace/generate',
    showBrowserAutomation: true,
    modelVersion: 'v3.1-20260211',
    texture: true,
    pbr: true,
    smartLowPoly: false,
    style: null,
    downloadFormat: 'glb'
  })
  const [globalProgress, setGlobalProgress] = useState(null)
  const [workspaceAssets, setWorkspaceAssets] = useState([])
  const [historyAssets, setHistoryAssets] = useState([])
  const [historyState, setHistoryState] = useState('idle')
  const [historyMessage, setHistoryMessage] = useState('')
  const [importingAssetId, setImportingAssetId] = useState(null)
  const [recentlyRemoved, setRecentlyRemoved] = useState(null)
  const [showAiFill, setShowAiFill] = useState(false)
  const [aiFillDesc, setAiFillDesc] = useState('')
  const [aiFillStyle, setAiFillStyle] = useState('Generic')
  const [aiFillBusy, setAiFillBusy] = useState(false)
  const [aiFillError, setAiFillError] = useState('')

  useEffect(() => {
    let active = true

    Promise.all([
      window.api.configGet('tripoWebBaseUrl'),
      window.api.configGet('tripoWebGenerateUrl'),
      window.api.configGet('tripoShowBrowserAutomation'),
      window.api.configGet('tripoModelVersion'),
      window.api.configGet('tripoStyle'),
      window.api.configGet('tripoTexture'),
      window.api.configGet('tripoPbr'),
      window.api.configGet('tripoSmartLowPoly')
    ]).then(([baseUrl, generateUrl, showBrowser, modelVersion, style, texture, pbr, smartLowPoly]) => {
      if (!active) return
      setTripoOpts((prev) => ({
        ...prev,
        webBaseUrl: baseUrl || prev.webBaseUrl,
        webGenerateUrl: generateUrl || prev.webGenerateUrl,
        showBrowserAutomation: typeof showBrowser === 'boolean' ? showBrowser : prev.showBrowserAutomation,
        modelVersion: modelVersion || prev.modelVersion,
        style: style ?? prev.style,
        texture: typeof texture === 'boolean' ? texture : prev.texture,
        pbr: typeof pbr === 'boolean' ? pbr : prev.pbr,
        smartLowPoly: typeof smartLowPoly === 'boolean' ? smartLowPoly : prev.smartLowPoly
      }))
    })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (window.api.onModelingProgress) {
      const unsub = window.api.onModelingProgress((data) => setGlobalProgress(data))
      return unsub
    }
  }, [])

  useEffect(() => {
    let active = true

    async function rehydrateParts(setter) {
      setter((prev) => {
        if (!prev.some((part) => part.status === 'done' && part.outputPath && !part.dataUrl)) {
          return prev
        }
        return prev
      })

      let currentParts = []
      setter((prev) => {
        currentParts = prev
        return prev
      })

      const updates = await Promise.all(
        currentParts.map(async (part) => {
          let next = part
          if (part.status === 'done' && part.outputPath && !part.dataUrl) {
            const res = await window.api.readFileAsDataURL({ filePath: part.outputPath })
            if (active && res.success) next = { ...next, dataUrl: res.dataUrl }
          }
          if (partHasReferenceImages(part)) {
            const refs = normalizeReferenceImages(part)
            let nextRefs = { ...refs }
            let refsChanged = false
            for (const slot of REFERENCE_IMAGE_SLOTS) {
              if (nextRefs[slot]?.path && !nextRefs[slot]?.preview) {
                const res = await window.api.readFileAsDataURL({ filePath: nextRefs[slot].path })
                if (active && res.success) {
                  nextRefs = {
                    ...nextRefs,
                    [slot]: { ...nextRefs[slot], preview: res.dataUrl }
                  }
                  refsChanged = true
                }
              }
            }
            if (refsChanged) next = { ...next, referenceImages: nextRefs }
          }
          return next
        })
      )

      if (!active) return
      const changed = updates.some((part, index) => {
        const prev = currentParts[index]
        if (part.dataUrl !== prev?.dataUrl) return true
        return REFERENCE_IMAGE_SLOTS.some((slot) => {
          const prevPreview = normalizeReferenceImages(prev)[slot]?.preview
          const nextPreview = normalizeReferenceImages(part)[slot]?.preview
          return prevPreview !== nextPreview
        })
      })
      if (changed) setter(updates)
    }

    rehydrateParts(setCharParts)
    rehydrateParts(setEnvParts)

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!setWorkflowState) return
    setWorkflowState((prev) => ({ ...prev, charParts, envParts }))
  }, [charParts, envParts, setWorkflowState])

  const loadWorkspaceAssets = useCallback(async () => {
    if (!window.api.listGeneratedModels) return
    const res = await window.api.listGeneratedModels()
    if (res?.success) setWorkspaceAssets(res.items || [])
  }, [])

  useEffect(() => {
    loadWorkspaceAssets()
  }, [loadWorkspaceAssets])

  const hydrateSyncedTripoAssets = useCallback(async () => {
    if (!window.api.tripoListSyncedAssets) return
    const res = await window.api.tripoListSyncedAssets()
    if (!res?.success || !res.items?.length) return
    setHistoryAssets(
      res.items.map((item) => ({
        ...item,
        provider: item.provider || 'tripo-history'
      }))
    )
    setHistoryState('ready')
    setHistoryMessage(
      `${res.items.length} synced Tripo asset${res.items.length === 1 ? '' : 's'} loaded from cache`
    )
  }, [])

  useEffect(() => {
    hydrateSyncedTripoAssets()
  }, [hydrateSyncedTripoAssets])

  const syncTripoHistory = useCallback(async () => {
    if (!window.api.tripoWebListHistory) return
    setHistoryState('loading')
    setHistoryMessage('Reading Tripo History…')

    const res = await window.api.tripoWebListHistory({
      baseUrl: tripoOpts.webBaseUrl,
      generateUrl: tripoOpts.webGenerateUrl
    })

    if (!res?.success) {
      setHistoryState('error')
      setHistoryMessage(res?.error || 'Could not read Tripo History.')
      return
    }

    setHistoryAssets(
      (res.items || []).map((item) => ({
        ...item,
        provider: item.provider || 'tripo-history'
      }))
    )
    setHistoryState('ready')
    setHistoryMessage(
      res.message ||
        (res.items?.length
          ? `Synced ${res.items.length} asset${res.items.length === 1 ? '' : 's'} from Tripo My Assets`
          : 'No models found in your Tripo My Assets library')
    )
  }, [tripoOpts.webBaseUrl, tripoOpts.webGenerateUrl])

  const parts = tab === 'character' ? charParts : envParts
  const setParts = tab === 'character' ? setCharParts : setEnvParts

  const addPart = useCallback((seed = {}) => {
    setParts((prev) => [...prev, mkPart(seed)])
  }, [setParts])

  const removePart = useCallback(
    (id) => {
      let removedPart = null
      let removedIndex = -1
      setParts((prev) => {
        removedIndex = prev.findIndex((part) => part.id === id)
        if (removedIndex === -1) return prev
        removedPart = prev[removedIndex]
        return prev.filter((part) => part.id !== id)
      })
      if (removedPart) {
        setRecentlyRemoved({
          tab,
          index: removedIndex,
          part: removedPart
        })
      }
    },
    [setParts, tab]
  )

  const updatePart = useCallback(
    (id, changes) => {
      setParts((prev) =>
        prev.map((part) => {
          if (part.id !== id) return part
          const nextChanges = typeof changes === 'function' ? changes(part) : changes
          return { ...part, ...nextChanges }
        })
      )
    },
    [setParts]
  )

  const duplicatePart = useCallback(
    (id) => {
      setParts((prev) => {
        const index = prev.findIndex((part) => part.id === id)
        if (index === -1) return prev
        const source = prev[index]
        const clone = mkPart({
          name: source.name ? `${source.name} Copy` : '',
          prompt: source.prompt || '',
          attachPoint: source.attachPoint || 'HatAttachment',
          referenceImages: hydrateReferenceImages(source)
        })
        return [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)]
      })
    },
    [setParts]
  )

  const restoreRecentlyRemoved = useCallback(() => {
    if (!recentlyRemoved?.part) return
    const targetSetter = recentlyRemoved.tab === 'character' ? setCharParts : setEnvParts
    targetSetter((prev) => {
      const next = [...prev]
      const insertIndex = Math.max(0, Math.min(recentlyRemoved.index ?? prev.length, prev.length))
      next.splice(insertIndex, 0, recentlyRemoved.part)
      return next
    })
    setRecentlyRemoved(null)
  }, [recentlyRemoved])

  const generatePart = useCallback(
    async (id) => {
      const setter = tab === 'character' ? setCharParts : setEnvParts
      const getCurrentParts = () => {
        let result
        setter((prev) => {
          result = prev
          return prev
        })
        return result
      }

      setter((prev) =>
        prev.map((part) => (part.id === id ? { ...part, status: 'generating', error: null } : part))
      )
      setGlobalProgress({ step: 'Starting…', pct: 0 })

      const part = getCurrentParts()?.find((item) => item.id === id)
      if (!part) return

      try {
        const refs = serializeReferenceImagePaths(part)
        const res = await window.api.tripoWebGenerate({
          prompt: part.prompt.trim(),
          imagePath: refs.front || part.imagePath || '',
          referenceImages: refs,
          multiviewImages: part.multiviewImages || [],
          baseUrl: tripoOpts.webBaseUrl,
          generateUrl: tripoOpts.webGenerateUrl,
          showBrowser: tripoOpts.showBrowserAutomation,
          keepWindowOpen: tripoOpts.showBrowserAutomation,
          downloadFormat: tripoOpts.downloadFormat || 'glb',
          modelVersion: tripoOpts.modelVersion,
          style: tripoOpts.style,
          texture: tripoOpts.texture,
          pbr: tripoOpts.pbr,
          smartLowPoly: tripoOpts.smartLowPoly
        })

        setGlobalProgress(null)

        if (!res.success) {
          setter((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, status: 'error', error: res.error } : item
            )
          )
          return
        }

        let finalOutputPath = res.outputPath || null
        let finalProvider = res.provider || 'tripo-web'

        if (res.outputPath && window.api.saveGeneratedModel) {
          const persistRes = await window.api.saveGeneratedModel({
            sourcePath: res.outputPath,
            name: part.name?.trim() || '',
            prompt: part.prompt.trim(),
            provider: finalProvider,
            sourceTab: tab
          })
          if (persistRes.success && persistRes.item?.outputPath) {
            finalOutputPath = persistRes.item.outputPath
            finalProvider = persistRes.item.provider || finalProvider
          }
        }

        let dataUrl = null
        if (finalOutputPath) {
          const dataUrlRes = await window.api.readFileAsDataURL({ filePath: finalOutputPath })
          if (dataUrlRes.success) dataUrl = dataUrlRes.dataUrl
        }

        setter((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: 'done',
                  outputPath: finalOutputPath,
                  dataUrl,
                  provider: finalProvider
                }
              : item
          )
        )
        loadWorkspaceAssets()
      } catch (error) {
        setGlobalProgress(null)
        setter((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: 'error', error: error.message } : item
          )
        )
      }
    },
    [loadWorkspaceAssets, tab, tripoOpts]
  )

  const aiFillEnvironment = useCallback(async () => {
    if (!aiFillDesc.trim()) {
      setAiFillError('Enter a scene description first.')
      return
    }
    const apiKey = await window.api.configGet('deepseekApiKey')
    if (!apiKey) {
      setAiFillError('Add a DeepSeek API key in Settings or Building Generator first.')
      return
    }
    setAiFillError('')
    setAiFillBusy(true)
    const result = await window.api.buildingGenerateRecipe({
      description: aiFillDesc.trim(),
      style: aiFillStyle,
      gameType: 'RPG',
      apiKey
    })
    setAiFillBusy(false)
    if (!result?.success) {
      setAiFillError(result?.error || 'AI generation failed.')
      return
    }
    const components = result.recipe?.components || []
    setEnvParts((prev) => [
      ...prev,
      ...components.map((comp) =>
        mkPart({
          name: comp.name || 'Environment Part',
          prompt: comp.tripoPrompt || comp.name || '',
          status: 'pending',
          provider: null
        })
      )
    ])
    setAiFillDesc('')
    setShowAiFill(false)
  }, [aiFillDesc, aiFillStyle])

  const generateAllPending = useCallback(async () => {
    const pending = parts.filter(
      (part) =>
        part.status !== 'generating' &&
        part.status !== 'done' &&
        ((part.prompt || '').trim().length > 0 || partHasReferenceImages(part))
    )
    for (const part of pending) {
      await generatePart(part.id)
    }
  }, [generatePart, parts])

  const pickReferenceImage = useCallback(
    async (id, slot) => {
      const filePath = await window.api.openImage()
      if (!filePath) return

      const previewRes = await window.api.readFileAsDataURL({ filePath })
      updatePart(id, (part) => {
        const refs = normalizeReferenceImages(part)
        return {
          referenceImages: {
            ...refs,
            [slot]: {
              path: filePath,
              preview: previewRes.success ? previewRes.dataUrl : null
            }
          }
        }
      })
    },
    [updatePart]
  )

  const clearReferenceImage = useCallback(
    (id, slot) => {
      updatePart(id, (part) => {
        const refs = normalizeReferenceImages(part)
        return {
          referenceImages: {
            ...refs,
            [slot]: null
          }
        }
      })
    },
    [updatePart]
  )

  const clearAllReferenceImages = useCallback(
    (id) => {
      updatePart(id, { referenceImages: emptyReferenceImages() })
    },
    [updatePart]
  )

  const optimizePart = useCallback(
    async (id, ratio = 0.5) => {
      const setter = tab === 'character' ? setCharParts : setEnvParts
      setter((prev) =>
        prev.map((p) => (p.id === id ? { ...p, optimizeState: 'optimizing', optimizeError: null } : p))
      )
      const part = (() => {
        let found = null
        setter((prev) => {
          found = prev.find((p) => p.id === id)
          return prev
        })
        return found
      })()
      if (!part?.outputPath) {
        setter((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, optimizeState: 'error', optimizeError: 'No output file to optimize.' } : p
          )
        )
        return
      }
      const res = await window.api.optimizeMesh({ inputPath: part.outputPath, ratio })
      if (!res.success) {
        setter((prev) =>
          prev.map((p) => (p.id === id ? { ...p, optimizeState: 'error', optimizeError: res.error } : p))
        )
        return
      }
      const dataUrlRes = await window.api.readFileAsDataURL({ filePath: res.outputPath })
      setter((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                outputPath: res.outputPath,
                dataUrl: dataUrlRes.success ? dataUrlRes.dataUrl : p.dataUrl,
                optimizeState: 'done',
                optimizeSaved: res.saved,
                optimizeError: null
              }
            : p
        )
      )
    },
    [tab]
  )

  const retopoPart = useCallback(
    async (id, targetFaces = 2000) => {
      const setter = tab === 'character' ? setCharParts : setEnvParts
      setter((prev) =>
        prev.map((p) => (p.id === id ? { ...p, retopoState: 'retopoing', retopoError: null } : p))
      )
      const part = (() => {
        let found = null
        setter((prev) => {
          found = prev.find((p) => p.id === id)
          return prev
        })
        return found
      })()
      if (!part?.outputPath) {
        setter((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, retopoState: 'error', retopoError: 'No output file to retopologize.' } : p
          )
        )
        return
      }
      const res = await window.api.retopologyMesh({ inputPath: part.outputPath, targetFaces })
      if (!res.success) {
        setter((prev) =>
          prev.map((p) => (p.id === id ? { ...p, retopoState: 'error', retopoError: res.error } : p))
        )
        return
      }
      const dataUrlRes = await window.api.readFileAsDataURL({ filePath: res.outputPath })
      setter((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                outputPath: res.outputPath,
                dataUrl: dataUrlRes.success ? dataUrlRes.dataUrl : p.dataUrl,
                retopoState: 'done',
                retopoError: null
              }
            : p
        )
      )
    },
    [tab]
  )

  const exportScene = useCallback(async () => {
    const doneParts = envParts.filter((part) => part.status === 'done' && part.outputPath)
    if (!doneParts.length) return
    const folder = await window.api.saveFolder({ title: 'Export Scene — Choose Folder' })
    if (!folder) return
    for (const part of doneParts) {
      const ext = part.outputPath.split('.').pop()
      const name = (part.name || part.id).replace(/[^a-z0-9_-]/gi, '_')
      await window.api.copyFile({ src: part.outputPath, dest: `${folder}\\${name}.${ext}` })
    }
    window.api.openPath(folder)
  }, [envParts])

  const accessories = charParts.filter((part) => part.status === 'done' && part.dataUrl)

  const localWorkspaceAssets = useMemo(
    () => workspaceAssets.filter((asset) => asset.outputPath || asset.filePath),
    [workspaceAssets]
  )

  const tripoHistoryAssets = useMemo(() => historyAssets, [historyAssets])

  const addGeneratedAssetToCurrentTab = useCallback(
    async (asset) => {
      const assetKey = asset.id || asset.detailUrl || asset.downloadUrl || asset.outputPath
      setImportingAssetId(assetKey)

      const outputPath = asset.outputPath || asset.filePath || null
      let dataUrl = asset.dataUrl || null
      const targetSetter = tab === 'character' ? setCharParts : setEnvParts
      const attachPoint = tab === 'character' ? 'HatAttachment' : undefined
      const defaultName =
        tab === 'character' ? 'Imported Generated Accessory' : 'Imported Generated Scene Part'

      try {
        const needsRemoteImport =
          !outputPath &&
          (asset.id || asset.detailUrl || asset.downloadUrl) &&
          (window.api.tripoImportSyncedAssetById || window.api.tripoWebImportHistoryItem)

        if (needsRemoteImport) {
          let importRes = null
          if (asset.id && window.api.tripoImportSyncedAssetById) {
            importRes = await window.api.tripoImportSyncedAssetById({
              id: asset.id,
              name: asset.name || defaultName,
              prompt: asset.prompt || '',
              sourceTab: tab
            })
          } else if (window.api.tripoWebImportHistoryItem) {
            importRes = await window.api.tripoWebImportHistoryItem({
              detailUrl: asset.detailUrl || '',
              downloadUrl: asset.downloadUrl || '',
              name: asset.name || defaultName,
              prompt: asset.prompt || '',
              sourceTab: tab
            })
          }

          if (!importRes?.success || !importRes.item?.outputPath) {
            targetSetter((prev) => [
              ...prev,
              mkPart({
                name: asset.name || defaultName,
                prompt: asset.prompt || '',
                status: 'error',
                outputPath: null,
                dataUrl: null,
                provider: asset.provider || 'tripo-history',
                ...(attachPoint ? { attachPoint } : {}),
                error: importRes?.error || 'Could not import the selected Tripo History asset.'
              })
            ])
            return
          }

          asset = importRes.item
          await loadWorkspaceAssets()
        }

        const resolvedOutputPath = asset.outputPath || asset.filePath || outputPath

        if (!dataUrl && resolvedOutputPath) {
          const res = await window.api.readFileAsDataURL({ filePath: resolvedOutputPath })
          if (res.success) {
            dataUrl = res.dataUrl
          } else {
            targetSetter((prev) => [
              ...prev,
              mkPart({
                name: asset.name || defaultName,
                prompt: asset.prompt || '',
                status: 'error',
                outputPath: resolvedOutputPath,
                dataUrl: null,
                provider: asset.provider || 'workspace',
                ...(attachPoint ? { attachPoint } : {}),
                error: res.error || 'Could not load the generated asset file.'
              })
            ])
            return
          }
        }

        if (!dataUrl) {
          targetSetter((prev) => [
            ...prev,
            mkPart({
              name: asset.name || defaultName,
              prompt: asset.prompt || '',
              status: 'error',
              outputPath: resolvedOutputPath,
              dataUrl: null,
              provider: asset.provider || 'workspace',
              ...(attachPoint ? { attachPoint } : {}),
              error: 'Could not load the selected Tripo model.'
            })
          ])
          return
        }

        targetSetter((prev) => [
          ...prev,
          mkPart({
            name: asset.name || defaultName,
            prompt: asset.prompt || '',
            status: 'done',
            outputPath: resolvedOutputPath,
            dataUrl,
            provider: asset.provider || 'workspace',
            ...(attachPoint ? { attachPoint } : {}),
            error: null
          })
        ])
      } finally {
        setImportingAssetId(null)
      }
    },
    [loadWorkspaceAssets, tab]
  )

  const tripoSummary =
    tripoOpts.showBrowserAutomation
      ? 'Tripo browser session automation'
      : 'Tripo browser session automation (headless)'

  return (
    <div 
      className="flex flex-col h-full bg-[#08090f] relative overflow-hidden text-slate-100"
      style={{
        background: 'radial-gradient(circle at 50% 50%, rgba(20, 16, 35, 0.6) 0%, rgba(8, 9, 15, 1) 100%)'
      }}
    >
      {/* Background liquid glass glowing ambient orbs */}
      <div className="absolute top-[-5%] left-[10%] w-[380px] h-[380px] rounded-full bg-purple-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[10%] left-[-5%] w-[350px] h-[350px] rounded-full bg-fuchsia-600/6 blur-[120px] pointer-events-none" />
      <div className="absolute top-[25%] right-[-10%] w-[420px] h-[420px] rounded-full bg-violet-600/8 blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[30%] w-[300px] h-[300px] rounded-full bg-blue-600/6 blur-[90px] pointer-events-none" />

      {/* Floating Header Panel */}
      <div className="mx-5 mt-5 px-6 py-4 border border-white/[0.08] bg-slate-900/15 backdrop-blur-2xl rounded-2xl flex-shrink-0 shadow-[0_12px_40px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.12)] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-100 via-fuchsia-100 to-violet-200 flex items-center gap-2">
              <Sparkles size={18} className="text-purple-400 filter drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
              3D Modeling Studio
            </h1>
            <p className="text-2xs text-slate-400 mt-1 font-bold uppercase tracking-wider flex items-center gap-1.5">
              <span>Build assets part by part</span>
              <span className="w-1 h-1 rounded-full bg-purple-500/50"></span>
              <span className="text-purple-300/90 normal-case font-semibold">{tripoSummary}</span>
            </p>
          </div>

          <div className="flex gap-2 items-center">
            <button
              onClick={() => onChangeModule?.('settings')}
              className="px-4 py-2 text-xs font-bold rounded-full border border-white/[0.08] bg-white/[0.03] text-slate-300 hover:border-slate-600 hover:bg-white/[0.08] transition-all duration-200 cursor-pointer flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] shadow-sm backdrop-blur-md"
            >
              <Settings size={13} className="text-slate-400" />
              Settings
            </button>
            <button
              onClick={() => onChangeModule?.('playground')}
              className="px-4 py-2 text-xs font-bold rounded-full border border-purple-500/40 bg-purple-500/15 text-purple-200 hover:bg-purple-500/25 hover:border-purple-400/60 hover:shadow-[0_0_16px_rgba(168,85,247,0.3)] transition-all duration-200 cursor-pointer flex items-center gap-1.5 hover:scale-[1.02] active:scale-[0.98] backdrop-blur-md"
            >
              <Play size={13} className="text-purple-300 fill-purple-300/10" />
              Open Playground
            </button>
          </div>
        </div>

        {globalProgress && (
          <div className="bg-purple-500/5 border border-purple-500/15 p-2.5 rounded-xl">
            <div className="flex justify-between text-xs font-semibold text-purple-300 mb-1.5 tracking-wide">
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#c084fc]"></span>
                {globalProgress.step}
              </span>
              <span>{globalProgress.pct}%</span>
            </div>
            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-500 to-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                style={{
                  width: `${globalProgress.pct}%`,
                  transition: 'width .3s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center">
          <div className="inline-flex gap-1.5 p-1 bg-white/[0.02] border border-white/[0.08] rounded-full backdrop-blur-md shadow-[inset_0_1px_1px_rgba(255,255,255,0.08)]">
            {TABS.map((section) => {
              const isActive = tab === section.id
              return (
                <button
                  key={section.id}
                  onClick={() => setTab(section.id)}
                  className={`px-4.5 py-2 text-xs font-bold uppercase tracking-wider rounded-full cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5 ${
                    isActive 
                      ? 'bg-white/[0.06] border border-white/[0.1] text-white shadow-sm font-extrabold' 
                      : 'text-slate-400 border border-transparent hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {section.icon === 'user' ? (
                    <User size={13} className={isActive ? 'text-purple-300' : 'text-slate-400'} />
                  ) : (
                    <Compass size={13} className={isActive ? 'text-purple-300' : 'text-slate-400'} />
                  )}
                  {section.label}
                </button>
              )
            })}
          </div>
          {tab === 'environment' && (
            <button
              type="button"
              onClick={() => setShowAiFill((value) => !value)}
              className="ml-auto px-3 py-1.5 text-[11px] font-bold rounded-lg border cursor-pointer transition-colors duration-200"
              style={{
                background: showAiFill ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.03)',
                borderColor: showAiFill ? 'rgba(124,58,237,0.45)' : 'rgba(255,255,255,0.08)',
                color: showAiFill ? '#c4b5fd' : '#94a3b8'
              }}
            >
              AI Auto-fill Scene
            </button>
          )}
        </div>
        {tab === 'environment' && showAiFill && (
          <div className="mt-3 rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 grid gap-3">
            <div className="text-xs font-bold text-purple-200">Auto-fill Environment from AI</div>
            <div className="text-[11px] text-slate-400 leading-relaxed">
              Describe your scene and DeepSeek will add Tripo-ready parts to the list.
            </div>
            <textarea
              value={aiFillDesc}
              onChange={(event) => setAiFillDesc(event.target.value)}
              placeholder="e.g. A medieval market square with a stone fountain and wooden inn"
              rows={2}
              className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none resize-y"
            />
            <div className="flex gap-2 items-center flex-wrap">
              <select
                value={aiFillStyle}
                onChange={(event) => setAiFillStyle(event.target.value)}
                className="bg-slate-950/60 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-slate-300"
              >
                {['Generic', 'Medieval', 'Sci-Fi', 'Modern', 'Fantasy', 'Japanese', 'Western', 'Cyberpunk'].map((style) => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={aiFillEnvironment}
                disabled={aiFillBusy}
                className="px-3 py-2 rounded-lg text-xs font-bold text-white cursor-pointer disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)' }}
              >
                {aiFillBusy ? 'Generating…' : 'Fill Scene Parts'}
              </button>
            </div>
            {aiFillError && <div className="text-[11px] text-rose-300">{aiFillError}</div>}
          </div>
        )}
      </div>

      {/* Floating Content Panels */}
      <div className="flex-1 flex overflow-hidden mx-5 mb-5 mt-4 gap-4">
        {/* Floating Sidebar (Parts List) */}
        <div className="w-[360px] shrink-0 flex flex-col overflow-hidden bg-slate-900/15 backdrop-blur-2xl border border-white/[0.08] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25),inset_0_1px_1px_rgba(255,255,255,0.12)]">
          <PartsList
            activeTab={tab}
            parts={parts}
            onAdd={addPart}
            onRemove={removePart}
            onDuplicate={duplicatePart}
            onGenerate={generatePart}
            onGenerateAll={generateAllPending}
            onPickReferenceImage={pickReferenceImage}
            onClearReferenceImage={clearReferenceImage}
            onClearAllReferenceImages={clearAllReferenceImages}
            onOptimize={optimizePart}
            onRetopo={retopoPart}
            onPartChange={updatePart}
            showAttachPoint={tab === 'character'}
            tripoAssets={tripoHistoryAssets}
            localAssets={localWorkspaceAssets}
            onAddTripoAsset={addGeneratedAssetToCurrentTab}
            importingAssetId={importingAssetId}
            showTripoBrowser
            assetBrowserLabel={tab === 'character' ? 'Add to Accessories' : 'Add to Scene'}
            emptyAssetHint={
              tab === 'character'
                ? 'Sync Tripo My Assets (not the public gallery), then import your own models here.'
                : 'Sync Tripo My Assets (not the public gallery), then import your own scene props here.'
            }
            onRefreshAssets={syncTripoHistory}
            assetRefreshState={historyState}
            assetRefreshMessage={historyMessage}
            recentlyRemoved={
              recentlyRemoved?.tab === tab ? recentlyRemoved.part : null
            }
            onUndoRemove={restoreRecentlyRemoved}
          />
        </div>

        {/* Floating 3D Viewport Panel */}
        <div className="flex-1 overflow-hidden relative bg-slate-950/20 border border-white/[0.06] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.2)]">
          {tab === 'character' ? (
            <R15Viewer accessories={accessories} />
          ) : (
            <SceneBuilder parts={envParts} onExport={exportScene} />
          )}
        </div>
      </div>
    </div>
  )
}

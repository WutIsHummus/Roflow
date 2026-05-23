/* eslint-disable react/prop-types */
import { useState, useEffect, useCallback, useMemo } from 'react'
import PartsList from './PartsList'
import R15Viewer from './R15Viewer'
import SceneBuilder from './SceneBuilder'
import TripoPanel from './TripoPanel'

let nextId = 1
function mkPart(overrides = {}) {
  return {
    id: `part-${nextId++}`,
    name: '',
    prompt: '',
    status: 'pending',
    outputPath: null,
    dataUrl: null,
    attachPoint: 'HatAttachment',
    error: null,
    provider: null,
    ...overrides
  }
}

const TABS = [
  { id: 'character', label: '🧍 Character Accessories' },
  { id: 'environment', label: '🏙️ Environment Scene' }
]

export default function ModelingModule({ workflowState, setWorkflowState, onChangeModule }) {
  const [tab, setTab] = useState('character')
  const [charParts, setCharParts] = useState(() => workflowState?.charParts || [])
  const [envParts, setEnvParts] = useState(() => workflowState?.envParts || [])
  const [showSettings, setShowSettings] = useState(false)
  const [tripoOpts, setTripoOpts] = useState({
    authMode: 'web',
    webBaseUrl: 'https://www.tripo3d.ai/',
    webGenerateUrl: 'https://www.tripo3d.ai/',
    showBrowserAutomation: true,
    modelVersion: 'v3.0-20250421',
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
  const [recentlyRemoved, setRecentlyRemoved] = useState(null)
  const [showAiFill, setShowAiFill] = useState(false)
  const [aiFillDesc, setAiFillDesc] = useState('')
  const [aiFillStyle, setAiFillStyle] = useState('Generic')
  const [aiFillBusy, setAiFillBusy] = useState(false)
  const [aiFillError, setAiFillError] = useState('')

  useEffect(() => {
    if (window.api.onModelingProgress) {
      const unsub = window.api.onModelingProgress((data) => setGlobalProgress(data))
      return unsub
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

  const syncTripoHistory = useCallback(async () => {
    if (!window.api.tripoWebListHistory) return
    setHistoryState('loading')
    setHistoryMessage('Reading Tripo History…')

    const res = await window.api.tripoWebListHistory({
      baseUrl: tripoOpts.webBaseUrl,
      generateUrl: tripoOpts.webGenerateUrl
    })

    if (!res?.success) {
      setHistoryAssets([])
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
      res.items?.length
        ? `Synced ${res.items.length} asset${res.items.length === 1 ? '' : 's'} from Tripo History`
        : 'No assets found in Tripo History'
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
      setParts((prev) => prev.map((part) => (part.id === id ? { ...part, ...changes } : part)))
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
          attachPoint: source.attachPoint || 'HatAttachment'
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

  const importMeshAsPart = useCallback(async () => {
    if (!window.api?.openMesh) return
    const filePath = await window.api.openMesh()
    if (!filePath) return

    const dataUrlRes = await window.api.readFileAsDataURL({ filePath })
    const targetSetter = tab === 'character' ? setCharParts : setEnvParts
    const ext = filePath.split('.').pop().toLowerCase()
    const fileName = filePath.split(/[\\/]/).pop().replace(/\.[^.]+$/, '')
    const attachPoint = tab === 'character' ? 'HatAttachment' : undefined

    targetSetter((prev) => [
      ...prev,
      mkPart({
        name: fileName,
        prompt: '',
        status: dataUrlRes.success ? 'done' : 'error',
        outputPath: filePath,
        dataUrl: dataUrlRes.success ? dataUrlRes.dataUrl : null,
        provider: `imported-${ext}`,
        ...(attachPoint ? { attachPoint } : {}),
        error: dataUrlRes.success ? null : dataUrlRes.error || 'Could not read mesh file.'
      })
    ])
  }, [tab])

  const aiFillEnvironment = useCallback(async () => {
    if (!aiFillDesc.trim()) { setAiFillError('Enter a scene description first.'); return }
    const apiKey = await window.api.configGet('deepseekApiKey')
    if (!apiKey) { setAiFillError('Add a DeepSeek API key in Building Generator first.'); return }
    setAiFillError('')
    setAiFillBusy(true)
    const result = await window.api.buildingGenerateRecipe({
      description: aiFillDesc.trim(),
      style: aiFillStyle,
      gameType: 'RPG',
      apiKey
    })
    setAiFillBusy(false)
    if (!result?.success) { setAiFillError(result?.error || 'AI generation failed.'); return }
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
        const res = await window.api.tripoWebGenerate({
          prompt: part.prompt.trim(),
          imagePath: part.imagePath || '',
          multiviewImages: part.multiviewImages || [],
          baseUrl: tripoOpts.webBaseUrl,
          generateUrl: tripoOpts.webGenerateUrl,
          showBrowser: tripoOpts.showBrowserAutomation,
          keepWindowOpen: tripoOpts.showBrowserAutomation,
          downloadFormat: tripoOpts.downloadFormat || 'glb'
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

  const optimizePart = useCallback(
    async (id) => {
      const setter = tab === 'character' ? setCharParts : setEnvParts
      setter((prev) =>
        prev.map((p) => (p.id === id ? { ...p, optimizeState: 'optimizing', optimizeError: null } : p))
      )
      const part = (() => {
        let found = null
        setter((prev) => { found = prev.find((p) => p.id === id); return prev })
        return found
      })()
      if (!part?.outputPath) {
        setter((prev) =>
          prev.map((p) => (p.id === id ? { ...p, optimizeState: 'error', optimizeError: 'No output file to optimize.' } : p))
        )
        return
      }
      const res = await window.api.optimizeMesh({ inputPath: part.outputPath })
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
  const historyBrowserAssets = useMemo(() => {
    const merged = new Map()
    for (const asset of workspaceAssets) {
      if (!String(asset.provider || '').startsWith('tripo')) continue
      const key = asset.outputPath || asset.filePath || asset.id
      if (!key || merged.has(key)) continue
      merged.set(key, asset)
    }
    for (const asset of historyAssets) {
      const key = asset.detailUrl || asset.downloadUrl || asset.id
      if (!key || merged.has(key)) continue
      merged.set(key, asset)
    }
    return [...merged.values()]
  }, [historyAssets, workspaceAssets])

  const addGeneratedAssetToCurrentTab = useCallback(
    async (asset) => {
      const outputPath = asset.outputPath || asset.filePath || null
      let dataUrl = asset.dataUrl || null
      const targetSetter = tab === 'character' ? setCharParts : setEnvParts
      const attachPoint = tab === 'character' ? 'HatAttachment' : undefined
      const defaultName =
        tab === 'character' ? 'Imported Generated Accessory' : 'Imported Generated Scene Part'

      if (!outputPath && asset.provider === 'tripo-history' && window.api.tripoWebImportHistoryItem) {
        const importRes = await window.api.tripoWebImportHistoryItem({
          detailUrl: asset.detailUrl || '',
          downloadUrl: asset.downloadUrl || '',
          name: asset.name || defaultName,
          prompt: asset.prompt || '',
          sourceTab: tab
        })

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
    },
    [loadWorkspaceAssets, tab]
  )

  const tripoSummary =
    tripoOpts.showBrowserAutomation
      ? 'Tripo browser session automation'
      : 'Tripo browser session automation (headless)'

  const settingsButtonStyle = {
    padding: '6px 10px',
    fontSize: 11,
    borderRadius: 20,
    cursor: 'pointer',
    border: '1px solid #252a36',
    background: showSettings ? '#252a36' : '#1a1d26',
    color: '#555b6e'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0f1116' }}>
      <div style={{ padding: '18px 24px 0', borderBottom: '1px solid #1e2330', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: 12
          }}
        >
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#eef0f6', margin: 0 }}>
              3D Modeling Studio
            </h1>
            <p style={{ fontSize: 13, color: '#555b6e', marginTop: 3 }}>
              Build assets part by part · {tripoSummary}
            </p>
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 2 }}>
            <button onClick={() => setShowSettings((value) => !value)} style={settingsButtonStyle}>
              ⚙ Settings
            </button>
            <button
              onClick={() => onChangeModule?.('playground')}
              style={{
                padding: '6px 10px',
                fontSize: 11,
                borderRadius: 20,
                cursor: 'pointer',
                border: '1px solid rgba(124,58,237,0.28)',
                background: 'rgba(124,58,237,0.08)',
                color: '#c4b5fd'
              }}
            >
              Open Playground
            </button>
          </div>
        </div>

        {showSettings && (
          <div
            style={{
              background: '#111318',
              border: '1px solid #1e2330',
              borderRadius: 10,
              padding: '16px 18px',
              marginBottom: 14
            }}
          >
            <TripoPanel options={tripoOpts} onChange={setTripoOpts} />
          </div>
        )}

        {globalProgress && (
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                color: '#9499a8',
                marginBottom: 4
              }}
            >
              <span>{globalProgress.step}</span>
              <span>{globalProgress.pct}%</span>
            </div>
            <div style={{ height: 3, background: '#1e2330', borderRadius: 2 }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 2,
                  background: 'linear-gradient(90deg,#7c3aed,#a78bfa)',
                  width: `${globalProgress.pct}%`,
                  transition: 'width .3s'
                }}
              />
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map((section) => (
            <button
              key={section.id}
              onClick={() => setTab(section.id)}
              style={{
                padding: '9px 16px',
                fontSize: 13,
                fontWeight: tab === section.id ? 600 : 500,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: tab === section.id ? '#c4b5fd' : '#6b7280',
                borderBottom: tab === section.id ? '2px solid #a78bfa' : '2px solid transparent',
                marginBottom: -1
              }}
            >
              {section.label}
            </button>
          ))}
          {tab === 'environment' && (
            <button
              onClick={() => setShowAiFill((v) => !v)}
              style={{
                marginLeft: 'auto',
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                background: showAiFill ? 'rgba(124,58,237,0.2)' : '#12151d',
                border: showAiFill ? '1px solid rgba(124,58,237,0.45)' : '1px solid #252a36',
                borderRadius: 8,
                cursor: 'pointer',
                color: showAiFill ? '#c4b5fd' : '#7c8499',
                alignSelf: 'center',
                marginBottom: 2
              }}
            >
              ✨ AI Auto-fill Scene
            </button>
          )}
        </div>

        {tab === 'environment' && showAiFill && (
          <div
            style={{
              background: '#111318',
              border: '1px solid rgba(124,58,237,0.22)',
              borderRadius: 10,
              padding: '14px 16px',
              marginBottom: 2,
              display: 'grid',
              gap: 10
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c4b5fd' }}>
              Auto-fill Environment from AI
            </div>
            <div style={{ fontSize: 11, color: '#555b6e', lineHeight: 1.6 }}>
              Describe your scene — DeepSeek breaks it into components and adds them to the parts list with optimised Tripo prompts ready to generate.
            </div>
            <textarea
              value={aiFillDesc}
              onChange={(e) => setAiFillDesc(e.target.value)}
              placeholder="e.g. A medieval market square with a stone fountain, merchant stalls, and a wooden inn"
              rows={2}
              style={{
                width: '100%',
                background: '#0d0f14',
                border: '1px solid #252a36',
                borderRadius: 8,
                padding: '9px 11px',
                fontSize: 12,
                color: '#c4cad8',
                resize: 'vertical',
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.6,
                boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={aiFillStyle}
                onChange={(e) => setAiFillStyle(e.target.value)}
                style={{
                  background: '#0d0f14',
                  border: '1px solid #252a36',
                  borderRadius: 7,
                  padding: '6px 10px',
                  fontSize: 11,
                  color: '#9499a8',
                  cursor: 'pointer',
                  outline: 'none'
                }}
              >
                {['Generic', 'Medieval', 'Sci-Fi', 'Modern', 'Fantasy', 'Japanese', 'Western', 'Cyberpunk'].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button
                onClick={aiFillEnvironment}
                disabled={aiFillBusy}
                style={{
                  background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
                  border: 'none',
                  borderRadius: 8,
                  padding: '8px 14px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: aiFillBusy ? 'wait' : 'pointer',
                  opacity: aiFillBusy ? 0.6 : 1
                }}
              >
                {aiFillBusy ? 'Generating…' : 'Generate Components'}
              </button>
            </div>
            {aiFillError && (
              <div style={{ fontSize: 11, color: '#fca5a5', background: 'rgba(248,113,113,0.08)', borderRadius: 6, padding: '7px 10px' }}>
                {aiFillError}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div
          style={{
            width: 310,
            flexShrink: 0,
            borderRight: '1px solid #1e2330',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}
        >
          <PartsList
            activeTab={tab}
            parts={parts}
            onAdd={addPart}
            onRemove={removePart}
            onDuplicate={duplicatePart}
            onGenerate={generatePart}
            onPartChange={updatePart}
            onImportMesh={importMeshAsPart}
            onOptimize={optimizePart}
            showAttachPoint={tab === 'character'}
            tripoAssets={historyBrowserAssets}
            onAddTripoAsset={addGeneratedAssetToCurrentTab}
            showTripoBrowser
            assetBrowserLabel={tab === 'character' ? 'Add to Accessories' : 'Add to Scene'}
            emptyAssetHint={
              tab === 'character'
                ? 'Sync your Tripo History, then import an asset here as an accessory part.'
                : 'Sync your Tripo History, then import an asset here as an environment scene part.'
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

        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
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

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
    modelVersion: 'v2.5-20250123',
    texture: true,
    pbr: true,
    smartLowPoly: false,
    style: null
  })
  const [globalProgress, setGlobalProgress] = useState(null)
  const [workspaceAssets, setWorkspaceAssets] = useState([])
  const [historyAssets, setHistoryAssets] = useState([])
  const [historyState, setHistoryState] = useState('idle')
  const [historyMessage, setHistoryMessage] = useState('')
  const [recentlyRemoved, setRecentlyRemoved] = useState(null)

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
          baseUrl: tripoOpts.webBaseUrl,
          generateUrl: tripoOpts.webGenerateUrl,
          showBrowser: tripoOpts.showBrowserAutomation,
          keepWindowOpen: tripoOpts.showBrowserAutomation
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
        </div>
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

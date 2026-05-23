import { useEffect, useState } from 'react'
import Sidebar from './components/Layout/Sidebar'
import AnimationModule from './modules/Animation'
import ModelingModule from './modules/Modeling'
import PlaygroundModule from './modules/Playground'
import ClothingModule from './modules/Clothing'
import UIModule from './modules/UI'
import SFXModule from './modules/SFX'
import VFXModule from './modules/VFX'
import SettingsModule from './modules/Settings'
import { serializeReferenceImagePaths } from './modules/Modeling/referenceImages'
import {
  normalizeAnimationWorkflow,
  serializeAnimationWorkflow
} from './modules/Animation/animationWorkflow'

const MODULES = {
  animation: AnimationModule,
  modeling: ModelingModule,
  clothing: ClothingModule,
  ui: UIModule,
  playground: PlaygroundModule,
  sfx: SFXModule,
  vfx: VFXModule,
  settings: SettingsModule
}

const INITIAL_WORKFLOW_STATE = {
  animationResult: null,
  animationWorkflow: null,
  charParts: [],
  envParts: [],
  uiWorkflow: null,
  clothingWorkflow: null,
  vfxWorkflow: null
}

function serializePart(part) {
  return {
    id: part.id,
    name: part.name || '',
    prompt: part.prompt || '',
    status: part.status || 'pending',
    outputPath: part.outputPath || null,
    referenceImages: serializeReferenceImagePaths(part),
    attachPoint: part.attachPoint || 'HatAttachment',
    error: part.error || null,
    provider: part.provider || null
  }
}

function serializeClothingWorkflow(workflow) {
  if (!workflow) return null
  const { resultDataUrl: _resultDataUrl, templateDataUrl: _templateDataUrl, ...rest } = workflow
  return rest
}

function serializeWorkflowState(state) {
  const animationWorkflow = serializeAnimationWorkflow(state.animationWorkflow)
  return {
    animationResult: animationWorkflow?.result || state.animationResult || null,
    animationWorkflow,
    charParts: (state.charParts || []).map(serializePart),
    envParts: (state.envParts || []).map(serializePart),
    uiWorkflow: state.uiWorkflow || null,
    clothingWorkflow: serializeClothingWorkflow(state.clothingWorkflow),
    vfxWorkflow: state.vfxWorkflow || null
  }
}

function App() {
  const [activeModule, setActiveModule] = useState('animation')
  const [workflowState, setWorkflowState] = useState(INITIAL_WORKFLOW_STATE)
  const [workflowLoaded, setWorkflowLoaded] = useState(false)
  const ActiveModule = MODULES[activeModule] || AnimationModule

  useEffect(() => {
    let active = true

    async function loadWorkflowState() {
      const savedState = await window.api.configGet('workflowState')
      if (!active) return

      if (savedState && typeof savedState === 'object') {
        const animationWorkflow = normalizeAnimationWorkflow(savedState)
        setWorkflowState({
          ...INITIAL_WORKFLOW_STATE,
          ...savedState,
          animationWorkflow,
          animationResult: animationWorkflow.result || null,
          charParts: Array.isArray(savedState.charParts) ? savedState.charParts : [],
          envParts: Array.isArray(savedState.envParts) ? savedState.envParts : []
        })
      }
      setWorkflowLoaded(true)
    }

    loadWorkflowState()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!workflowLoaded) return
    window.api.configSet('workflowState', serializeWorkflowState(workflowState))
  }, [workflowLoaded, workflowState])

  useEffect(() => {
    if (!window.api?.onProgress) return undefined
    return window.api.onProgress((data) => {
      setWorkflowState((prev) => {
        if (!prev.animationWorkflow?.activeJob) return prev
        return {
          ...prev,
          animationWorkflow: { ...prev.animationWorkflow, progress: data }
        }
      })
    })
  }, [])

  return (
    <div
      className="relative overflow-hidden"
      style={{
        display: 'flex',
        height: '100vh',
        background: 'radial-gradient(circle at 50% 50%, #10121a 0%, #07080c 100%)',
        color: '#eef0f6',
        overflow: 'hidden'
      }}
    >
      {/* Global liquid glass glowing ambient orbs */}
      <div className="absolute top-[-10%] left-[10%] w-[450px] h-[450px] rounded-full bg-purple-600/6 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[5%] left-[-5%] w-[400px] h-[450px] rounded-full bg-violet-600/5 blur-[130px] pointer-events-none" />
      <div className="absolute top-[20%] right-[-10%] w-[500px] h-[500px] rounded-full bg-indigo-600/5 blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[20%] w-[400px] h-[400px] rounded-full bg-fuchsia-600/4 blur-[110px] pointer-events-none" />

      <Sidebar active={activeModule} onChange={setActiveModule} />
      <main className="relative z-10" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ActiveModule
          workflowState={workflowState}
          setWorkflowState={setWorkflowState}
          onChangeModule={setActiveModule}
        />
      </main>
    </div>
  )
}

export default App

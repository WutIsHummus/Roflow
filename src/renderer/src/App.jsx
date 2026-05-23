import { useEffect, useState } from 'react'
import Sidebar from './components/Layout/Sidebar'
import AnimationModule from './modules/Animation'
import ModelingModule from './modules/Modeling'
import PlaygroundModule from './modules/Playground'
import ClothingModule from './modules/Clothing'
import UIModule from './modules/UI'
import SFXModule from './modules/SFX'
import VFXModule from './modules/VFX'

const MODULES = {
  animation: AnimationModule,
  modeling: ModelingModule,
  clothing: ClothingModule,
  ui: UIModule,
  playground: PlaygroundModule,
  sfx: SFXModule,
  vfx: VFXModule
}

const INITIAL_WORKFLOW_STATE = {
  animationResult: null,
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
    attachPoint: part.attachPoint || 'HatAttachment',
    error: part.error || null,
    provider: part.provider || null
  }
}

function serializeWorkflowState(state) {
  return {
    animationResult: state.animationResult || null,
    charParts: (state.charParts || []).map(serializePart),
    envParts: (state.envParts || []).map(serializePart),
    uiWorkflow: state.uiWorkflow || null,
    clothingWorkflow: state.clothingWorkflow || null,
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
        setWorkflowState({
          ...INITIAL_WORKFLOW_STATE,
          ...savedState,
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

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        background: '#111318',
        color: '#eef0f6',
        overflow: 'hidden'
      }}
    >
      <Sidebar active={activeModule} onChange={setActiveModule} />
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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

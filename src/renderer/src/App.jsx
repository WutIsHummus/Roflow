import { useState } from 'react'
import Sidebar from './components/Layout/Sidebar'
import AnimationModule from './modules/Animation'
import ModelingModule from './modules/Modeling'
import PlaygroundModule from './modules/Playground'
import SFXModule from './modules/SFX'
import VFXModule from './modules/VFX'

const MODULES = {
  animation: AnimationModule,
  modeling: ModelingModule,
  playground: PlaygroundModule,
  sfx: SFXModule,
  vfx: VFXModule
}

function App() {
  const [activeModule, setActiveModule] = useState('animation')
  const [workflowState, setWorkflowState] = useState({
    animationResult: null,
    charParts: [],
    envParts: []
  })
  const ActiveModule = MODULES[activeModule] || AnimationModule

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

/* eslint-disable react/prop-types, react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export default function AnimationPreview({ bvhPath }) {
  const mountRef = useRef(null)
  const stateRef = useRef({})
  const [playing, setPlaying] = useState(true)
  const [timeInfo, setTimeInfo] = useState({ current: 0, total: 0 })
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(null)

  // ── Setup Three.js scene ────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0d0f14)

    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.01, 1000)
    camera.position.set(0, 1.2, 3.5)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(0, 1, 0)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08

    // Grid
    const grid = new THREE.GridHelper(12, 24, 0x2a2f3f, 0x1e2330)
    scene.add(grid)

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.6))
    const key = new THREE.DirectionalLight(0xa78bfa, 1.5)
    key.position.set(3, 5, 3)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x8b5cf6, 0.4)
    fill.position.set(-3, 2, -2)
    scene.add(fill)

    // Resize observer
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
      const s = stateRef.current
      if (s.mixer && s.playing) {
        const delta = clock.getDelta()
        s.mixer.update(delta)
        if (s.action) {
          const t = s.action.time
          setTimeInfo({ current: t, total: s.duration || 1 })
        }
      }
      renderer.render(scene, camera)
    }
    animate()

    stateRef.current.scene = scene
    stateRef.current.renderer = renderer
    stateRef.current.camera = camera
    stateRef.current.orbit = orbit
    stateRef.current.playing = true

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // ── Load BVH when path changes ──────────────────────────────────────────
  useEffect(() => {
    if (!bvhPath) return
    setLoaded(false)
    setError(null)
    setTimeInfo({ current: 0, total: 0 })

    const s = stateRef.current
    if (!s.scene) return

    // Clean up previous skeleton
    if (s.boneGroup) s.scene.remove(s.boneGroup)
    if (s.helper) s.scene.remove(s.helper)
    if (s.mixer) s.mixer.stopAllAction()

    window.api.readTextFile({ filePath: bvhPath }).then(({ success, text, error: err }) => {
      if (!success) { setError(err); return }

      try {
        const loader = new BVHLoader()
        const result = loader.parse(text)

        const boneGroup = new THREE.Group()
        boneGroup.add(result.skeleton.bones[0])
        s.scene.add(boneGroup)

        const helper = new THREE.SkeletonHelper(result.skeleton.bones[0])
        helper.skeleton = result.skeleton
        // Purple bones
        const lineMat = new THREE.LineBasicMaterial({ color: 0xa78bfa, linewidth: 2 })
        helper.material = lineMat
        s.scene.add(helper)

        const mixer = new THREE.AnimationMixer(helper)
        const action = mixer.clipAction(result.clip)
        action.play()

        s.boneGroup = boneGroup
        s.helper = helper
        s.mixer = mixer
        s.action = action
        s.duration = result.clip.duration
        s.playing = true
        setPlaying(true)
        setLoaded(true)
      } catch (e) {
        setError('Failed to parse BVH: ' + e.message)
      }
    }).catch(e => setError(e.message))
  }, [bvhPath])

  function togglePlay() {
    const s = stateRef.current
    if (!s.action) return
    s.playing = !s.playing
    if (s.playing) s.action.paused = false
    else s.action.paused = true
    setPlaying(s.playing)
  }

  function resetAnim() {
    const s = stateRef.current
    if (!s.action) return
    s.action.reset()
    s.action.play()
    s.playing = true
    setPlaying(true)
  }

  const pct = timeInfo.total > 0 ? (timeInfo.current / timeInfo.total) * 100 : 0

  return (
    <div style={{ position: 'relative', height: '100%', background: '#0d0f14', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e2330', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#9499a8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Animation Preview
        </span>
        {loaded && (
          <span style={{ fontSize: 11, color: '#4ade80' }}>● Live</span>
        )}
      </div>

      {/* Canvas mount */}
      <div ref={mountRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!bvhPath && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2e3340" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
            <p style={{ fontSize: 13, color: '#3e4455' }}>Generate an animation to preview</p>
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#fca5a5', maxWidth: 300, textAlign: 'center' }}>
              ⚠ {error}
            </div>
          </div>
        )}
        {bvhPath && !loaded && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <SpinIcon />
            <p style={{ fontSize: 12, color: '#6b7280' }}>Loading BVH...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      {loaded && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #1e2330', flexShrink: 0 }}>
          {/* Timeline */}
          <div style={{ height: 3, background: '#1e2330', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', borderRadius: 2, transition: 'width 0.1s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={togglePlay} style={{ background: '#252a36', border: '1px solid #2e3340', borderRadius: 6, padding: '5px 10px', color: '#c4b5fd', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
              {playing ? <PauseIcon /> : <PlayIcon />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button onClick={resetAnim} style={{ background: 'transparent', border: '1px solid #2e3340', borderRadius: 6, padding: '5px 10px', color: '#6b7280', cursor: 'pointer', fontSize: 12 }}>
              Reset
            </button>
            <span style={{ fontSize: 11, color: '#555b6e', marginLeft: 'auto' }}>
              {timeInfo.current.toFixed(2)}s / {timeInfo.total.toFixed(2)}s
            </span>
          </div>
          <p style={{ fontSize: 10, color: '#3e4455', marginTop: 6 }}>Drag to orbit · Scroll to zoom</p>
        </div>
      )}
    </div>
  )
}

function SpinIcon() {
  return (
    <svg style={{ animation: 'spin 1s linear infinite', width: 22, height: 22 }} viewBox="0 0 24 24" fill="none">
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="#a78bfa" strokeWidth="3" strokeOpacity="0.25" />
      <path fill="#a78bfa" fillOpacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}
function PlayIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z"/></svg> }
function PauseIcon() { return <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> }

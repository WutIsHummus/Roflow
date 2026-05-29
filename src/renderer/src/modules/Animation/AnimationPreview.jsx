/* eslint-disable react/prop-types, react-hooks/set-state-in-effect */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js'
import {
  buildRigNameMap,
  canonicalizeMotionClip,
  canonicalizeMotionSkeleton
} from '../Modeling/r15Utils'
import { R15_RIG_URL } from '../../shared/r15ClothingOverlay.js'

export default function AnimationPreview({ bvhPath }) {
  const mountRef = useRef(null)
  const stateRef = useRef({})
  const [playing, setPlaying] = useState(true)
  const [timeInfo, setTimeInfo] = useState({ current: 0, total: 0 })
  const [loaded, setLoaded] = useState(false)
  const [rigLoaded, setRigLoaded] = useState(false)
  const [error, setError] = useState(null)

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
    scene.background = new THREE.Color(0x0d0f14)

    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.01, 500)
    camera.position.set(0, 2.1, 5.2)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(0, 1.45, 0)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08

    scene.add(new THREE.GridHelper(12, 24, 0x2a2f3f, 0x1e2330))
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))

    const key = new THREE.DirectionalLight(0xffffff, 1.25)
    key.position.set(4, 6, 4)
    key.castShadow = true
    scene.add(key)

    const fill = new THREE.DirectionalLight(0x8b5cf6, 0.45)
    fill.position.set(-3, 2, -3)
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
      const s = stateRef.current
      if (s.mixer && s.playing) {
        s.mixer.update(clock.getDelta())
        if (s.action) {
          setTimeInfo({ current: s.action.time, total: s.duration || 1 })
        }
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
      playing: true
    }

    const loader = new GLTFLoader()
    loader.load(
      R15_RIG_URL,
      (gltf) => {
        rigGroup.add(gltf.scene)
        gltf.scene.traverse((obj) => {
          if (!obj.isMesh) return
          obj.castShadow = true
          obj.receiveShadow = true
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          mats.forEach((mat) => {
            mat.transparent = false
            mat.depthWrite = true
            mat.alphaTest = 0
            mat.side = THREE.FrontSide
            mat.needsUpdate = true
          })
        })

        let targetMesh = null
        gltf.scene.traverse((obj) => {
          if (!targetMesh && obj.isSkinnedMesh && obj.skeleton) targetMesh = obj
        })

        stateRef.current.rigScene = gltf.scene
        stateRef.current.targetMesh = targetMesh
        stateRef.current.rigNameMap = buildRigNameMap(gltf.scene)
        setRigLoaded(true)
        focusRig(stateRef.current)
      },
      undefined,
      (err) => setError(`Failed to load Roblox R15 rig: ${err.message}`)
    )

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    if (!bvhPath) return

    setLoaded(false)
    setError(null)
    setTimeInfo({ current: 0, total: 0 })

    const s = stateRef.current
    if (!s.scene || !s.rigScene || !s.targetMesh) return

    clearMotion(s)

    window.api
      .readTextFile({ filePath: bvhPath })
      .then(({ success, text, error: err }) => {
        if (!success) {
          setError(err)
          return
        }

        try {
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
          s.duration = clip.duration
          s.playing = true
          setPlaying(true)
          setLoaded(true)
          focusRig(s)
        } catch (e) {
          setError(`Failed to pre-retarget BVH to Roblox R15: ${e.message}`)
        }
      })
      .catch((e) => setError(e.message))
  }, [bvhPath, rigLoaded])

  function togglePlay() {
    const s = stateRef.current
    if (!s.action) return
    s.playing = !s.playing
    s.action.paused = !s.playing
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
      <div style={{ padding: '10px 16px', borderBottom: '1px solid #1e2330', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#9499a8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Roblox Render Preview
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {rigLoaded && <span style={badgeStyle('#4ade80')}>R15 Rig</span>}
          {loaded && <span style={badgeStyle('#a78bfa')}>Pre-retargeted</span>}
        </div>
      </div>

      <div ref={mountRef} style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        {!bvhPath && (
          <div style={emptyStateStyle}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2e3340" strokeWidth="1.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            <p style={{ fontSize: 13, color: '#3e4455' }}>Generate an animation to render on the Roblox rig</p>
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: '12px 16px', fontSize: 12, color: '#fca5a5', maxWidth: 360, textAlign: 'center' }}>
              {error}
            </div>
          </div>
        )}
        {bvhPath && !loaded && !error && (
          <div style={emptyStateStyle}>
            <SpinIcon />
            <p style={{ fontSize: 12, color: '#6b7280' }}>
              {rigLoaded ? 'Pre-retargeting BVH to Roblox R15...' : 'Loading Roblox R15 rig...'}
            </p>
          </div>
        )}
      </div>

      {loaded && (
        <div style={{ padding: '10px 16px', borderTop: '1px solid #1e2330', flexShrink: 0 }}>
          <div style={{ height: 3, background: '#1e2330', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#7c3aed,#a78bfa)', borderRadius: 2, transition: 'width 0.1s' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={togglePlay} style={controlButtonStyle}>
              {playing ? <PauseIcon /> : <PlayIcon />}
              {playing ? 'Pause' : 'Play'}
            </button>
            <button onClick={resetAnim} style={{ ...controlButtonStyle, background: 'transparent', color: '#6b7280' }}>
              Reset
            </button>
            <span style={{ fontSize: 11, color: '#555b6e', marginLeft: 'auto' }}>
              {timeInfo.current.toFixed(2)}s / {timeInfo.total.toFixed(2)}s
            </span>
          </div>
          <p style={{ fontSize: 10, color: '#3e4455', marginTop: 6 }}>Rendered on bundled Roblox R15 rig · Drag to orbit · Scroll to zoom</p>
        </div>
      )}
    </div>
  )
}

function clearMotion(state) {
  if (state.action) state.action.stop()
  if (state.mixer) state.mixer.stopAllAction()
  if (state.sourceHelper) state.scene.remove(state.sourceHelper)
  state.action = null
  state.mixer = null
  state.sourceHelper = null
}

function focusRig(state) {
  if (!state?.camera || !state?.orbit || !state?.rigScene) return
  const bounds = new THREE.Box3().setFromObject(state.rigScene)
  if (bounds.isEmpty()) return
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  state.orbit.target.copy(center)
  state.camera.position.set(center.x, center.y + maxDim * 0.35, center.z + maxDim * 1.8 + 1.2)
  state.camera.lookAt(center)
}

function badgeStyle(color) {
  return {
    fontSize: 11,
    color,
    background: 'rgba(10,11,16,0.72)',
    border: '1px solid #1f2532',
    borderRadius: 999,
    padding: '4px 10px'
  }
}

const emptyStateStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  pointerEvents: 'none'
}

const controlButtonStyle = {
  background: '#252a36',
  border: '1px solid #2e3340',
  borderRadius: 6,
  padding: '5px 10px',
  color: '#c4b5fd',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12
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

function PlayIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3l14 9-14 9V3z" /></svg>
}

function PauseIcon() {
  return <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
}

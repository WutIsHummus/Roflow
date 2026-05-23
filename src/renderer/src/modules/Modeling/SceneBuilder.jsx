/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'

function dataUrlToArrayBuffer(dataUrl) {
  const base64 = dataUrl.split(',')[1]
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

const SPACING = 2.5

export default function SceneBuilder({ parts = [], onExport }) {
  const mountRef = useRef(null)
  const stateRef = useRef({})
  const [selectedId, setSelectedId] = useState(null)
  const [transformMode, setTransformMode] = useState('translate')

  function rearrange() {
    const { partMap } = stateRef.current
    if (!partMap) return
    let i = 0
    for (const group of partMap.values()) {
      group.position.x = (i - (partMap.size - 1) / 2) * SPACING
      group.position.z = 0
      i++
    }
  }

  // ── Three.js setup ───────────────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.0
    renderer.shadowMap.enabled = true
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0c0e13)

    const camera = new THREE.PerspectiveCamera(55, el.clientWidth / el.clientHeight, 0.01, 500)
    camera.position.set(3, 3, 6)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.07
    orbit.target.set(0, 0, 0)

    // Grid
    const gridHelper = new THREE.GridHelper(40, 40, 0x252a36, 0x1a1d26)
    scene.add(gridHelper)

    // Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.7))
    const sun = new THREE.DirectionalLight(0xffffff, 1.3)
    sun.position.set(5, 8, 5)
    sun.castShadow = true
    sun.shadow.mapSize.set(1024, 1024)
    scene.add(sun)
    const fill = new THREE.DirectionalLight(0xa78bfa, 0.3)
    fill.position.set(-5, 3, -5)
    scene.add(fill)

    // TransformControls
    const tc = new TransformControls(camera, renderer.domElement)
    tc.setMode('translate')
    scene.add(tc)
    tc.addEventListener('dragging-changed', e => {
      orbit.enabled = !e.value
    })

    // Raycaster for click selection
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    function onPointerDown(event) {
      // Only trigger on left click without TC drag
      if (event.button !== 0) return
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(mouse, camera)

      const { partMap } = stateRef.current
      if (!partMap) return

      // Collect all meshes and map back to their group
      const meshes = []
      const meshToId = new Map()
      for (const [id, group] of partMap.entries()) {
        group.traverse(obj => {
          if (obj.isMesh) { meshes.push(obj); meshToId.set(obj.uuid, id) }
        })
      }

      const hits = raycaster.intersectObjects(meshes, false)
      if (hits.length > 0) {
        const id = meshToId.get(hits[0].object.uuid)
        if (id) {
          const group = partMap.get(id)
          tc.attach(group)
          setSelectedId(id)
          stateRef.current.selectedId = id
        }
      } else {
        // Clicked empty space — deselect (but not if TC is handling it)
        if (!tc.dragging) {
          tc.detach()
          setSelectedId(null)
          stateRef.current.selectedId = null
        }
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)

    // Resize
    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight)
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
    })
    ro.observe(el)

    let animId
    function animate() {
      animId = requestAnimationFrame(animate)
      orbit.update()
      renderer.render(scene, camera)
    }
    animate()

    stateRef.current = {
      scene, renderer, camera, orbit, tc, raycaster,
      partMap: new Map(), // partId → THREE.Group
      loadedDataUrls: new Map(), // partId → dataUrl (for change detection)
    }

    return () => {
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      cancelAnimationFrame(animId)
      tc.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // ── Keep transform mode in sync ───────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (s.tc) s.tc.setMode(transformMode)
  }, [transformMode])

  // ── Sync parts prop → scene ───────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (!s.scene || !s.partMap) return
    const { scene, partMap, loadedDataUrls } = s

    const partsWithData = parts.filter(p => p.dataUrl && p.status === 'done')
    const currentIds = new Set(partsWithData.map(p => p.id))

    // Remove groups no longer in parts
    for (const id of partMap.keys()) {
      if (!currentIds.has(id)) {
        const group = partMap.get(id)
        scene.remove(group)
        partMap.delete(id)
        loadedDataUrls.delete(id)
        if (stateRef.current.selectedId === id) {
          s.tc.detach()
          setSelectedId(null)
          stateRef.current.selectedId = null
        }
      }
    }

    // Load new parts
    for (const part of partsWithData) {
      if (partMap.has(part.id) && loadedDataUrls.get(part.id) === part.dataUrl) continue

      // Remove old version if regenerated
      if (partMap.has(part.id)) {
        scene.remove(partMap.get(part.id))
        partMap.delete(part.id)
      }

      const loader = new GLTFLoader()
      let buf
      try { buf = dataUrlToArrayBuffer(part.dataUrl) }
      catch { continue }

      loader.parse(buf, '', (gltf) => {
        const group = new THREE.Group()
        group.name = part.id
        group.add(gltf.scene)

        // Normalize to ~1.5 unit height
        const bbox = new THREE.Box3().setFromObject(group)
        const size = bbox.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        if (maxDim > 0) group.scale.setScalar(1.5 / maxDim)

        // Position above ground
        bbox.setFromObject(group)
        group.position.y -= bbox.min.y

        scene.add(group)
        partMap.set(part.id, group)
        loadedDataUrls.set(part.id, part.dataUrl)
        rearrange()
      }, err => console.error('[SceneBuilder] parse error:', err))
    }
  }, [parts])

  function clearScene() {
    const s = stateRef.current
    if (!s.scene || !s.partMap) return
    for (const group of s.partMap.values()) s.scene.remove(group)
    s.partMap.clear()
    s.loadedDataUrls.clear()
    s.tc.detach()
    setSelectedId(null)
  }

  function focusAll() {
    const s = stateRef.current
    if (!s.scene || !s.partMap || s.partMap.size === 0) return
    const box = new THREE.Box3()
    for (const group of s.partMap.values()) box.expandByObject(group)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    s.orbit.target.copy(center)
    s.camera.position.set(center.x, center.y + maxDim * 0.5, center.z + maxDim * 1.5)
    s.camera.lookAt(center)
  }

  const modeBtn = (mode, label) => (
    <button
      key={mode}
      onClick={() => setTransformMode(mode)}
      title={label}
      style={{
        padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: 5,
        background: transformMode === mode ? 'rgba(124,58,237,0.25)' : 'rgba(15,17,22,0.8)',
        border: transformMode === mode ? '1px solid #7c3aed' : '1px solid #252a36',
        color: transformMode === mode ? '#c4b5fd' : '#555b6e',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Toolbar */}
      <div style={{ position: 'absolute', top: 10, left: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: '#555b6e', background: 'rgba(10,11,16,0.7)', padding: '3px 8px', borderRadius: 5, marginRight: 4 }}>
          Scene
        </span>
        {selectedId && (
          <>
            {modeBtn('translate', 'Move')}
            {modeBtn('rotate', 'Rotate')}
            {modeBtn('scale', 'Scale')}
          </>
        )}
      </div>

      {/* Right toolbar */}
      <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 6 }}>
        <button
          onClick={focusAll}
          style={{ padding: '5px 10px', fontSize: 11, borderRadius: 5, background: 'rgba(10,11,16,0.7)', border: '1px solid #252a36', color: '#6b7280', cursor: 'pointer' }}
        >
          Focus All
        </button>
        <button
          onClick={clearScene}
          style={{ padding: '5px 10px', fontSize: 11, borderRadius: 5, background: 'rgba(10,11,16,0.7)', border: '1px solid #252a36', color: '#6b7280', cursor: 'pointer' }}
        >
          Clear
        </button>
        {onExport && (
          <button
            onClick={onExport}
            style={{ padding: '5px 10px', fontSize: 11, fontWeight: 700, borderRadius: 5, background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)', color: '#c4b5fd', cursor: 'pointer' }}
          >
            Export Scene
          </button>
        )}
      </div>

      {/* Selection hint */}
      {selectedId && (
        <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none' }}>
          <span style={{ fontSize: 11, color: '#a78bfa', background: 'rgba(10,11,16,0.7)', padding: '4px 12px', borderRadius: 20 }}>
            Selected · Click empty space to deselect
          </span>
        </div>
      )}

      {/* Empty state */}
      {parts.filter(p => p.status === 'done').length === 0 && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', gap: 8 }}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2e3340" strokeWidth="1.5">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
          <p style={{ fontSize: 13, color: '#3e4455' }}>Generate parts to build your scene</p>
          <p style={{ fontSize: 11, color: '#2e3340' }}>Click objects to select · Drag handles to transform</p>
        </div>
      )}
    </div>
  )
}

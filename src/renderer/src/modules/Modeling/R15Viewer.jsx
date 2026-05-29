/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { ROBLOX_ATTACH, buildAttachmentAnchors, dataUrlToArrayBuffer } from './r15Utils'
import { R15_RIG_URL } from '../../shared/r15ClothingOverlay.js'

export default function R15Viewer({ accessories = [] }) {
  const mountRef = useRef(null)
  const stateRef = useRef({})
  const [showAnchors, setShowAnchors] = useState(false)

  // ── One-time Three.js setup ─────────────────────────────────────────────
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0c0e13)

    const camera = new THREE.PerspectiveCamera(48, el.clientWidth / el.clientHeight, 0.01, 100)
    camera.position.set(0, 2.2, 4.5)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(0, 1.5, 0)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.07
    orbit.minDistance = 1
    orbit.maxDistance = 10

    scene.add(new THREE.GridHelper(12, 24, 0x252a36, 0x1a1d26))
    scene.add(new THREE.AmbientLight(0xffffff, 0.65))
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(3, 6, 4)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xa78bfa, 0.5)
    fill.position.set(-4, 2, -3)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0x8b5cf6, 0.3)
    rim.position.set(0, 4, -5)
    scene.add(rim)

    const anchorMarkers = [] // sphere markers for debug view

    // Load R15 rig
    const rigGroup = new THREE.Group()
    scene.add(rigGroup)

    const loader = new GLTFLoader()
    loader.load(
      R15_RIG_URL,
      (gltf) => {
        rigGroup.add(gltf.scene)
        stateRef.current.rigScene = gltf.scene

        // Fix transparency artifacts at joints — force all rig meshes to be opaque
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

        // Build Roblox-style attachment anchors
        const anchors = buildAttachmentAnchors(gltf.scene)
        stateRef.current.anchors = anchors
        console.log('[R15Viewer] Attachment anchors built:', Object.keys(anchors))

        // Create small sphere markers for each anchor (shown in debug mode)
        const markerGeo = new THREE.SphereGeometry(0.04, 8, 8)
        const markerMat = new THREE.MeshBasicMaterial({
          color: 0xa78bfa,
          transparent: true,
          opacity: 0.8
        })
        for (const anchor of Object.values(anchors)) {
          const marker = new THREE.Mesh(markerGeo, markerMat)
          marker.visible = false
          marker.name = '__anchor_marker'
          anchor.add(marker)
          anchorMarkers.push(marker)
        }
        stateRef.current.anchorMarkers = anchorMarkers

        // Attach any queued accessories
        const pending = stateRef.current.pendingAcc || []
        stateRef.current.pendingAcc = []
        for (const acc of pending) loadAccessory(acc)
      },
      undefined,
      (err) => console.error('[R15Viewer] Rig load error:', err)
    )

    const accMap = new Map() // partId → { obj, anchorObj }

    function loadAccessory(acc) {
      if (!acc.dataUrl) return
      if (accMap.has(acc.id)) return
      const anchors = stateRef.current.anchors
      if (!anchors) {
        // Rig not loaded yet — queue
        stateRef.current.pendingAcc = stateRef.current.pendingAcc || []
        stateRef.current.pendingAcc.push(acc)
        return
      }

      let buf
      try {
        buf = dataUrlToArrayBuffer(acc.dataUrl)
      } catch {
        return
      }

      const gltfLoader = new GLTFLoader()
      gltfLoader.parse(
        buf,
        '',
        (gltf) => {
          const accScene = gltf.scene
          const attachKey = acc.attachPoint || 'HatAttachment'
          const def = ROBLOX_ATTACH[attachKey]
          const anchor = anchors[attachKey]

          if (!anchor) {
            console.warn('[R15Viewer] No anchor for', attachKey)
            return
          }

          // ── Normalize accessory size ─────────────────────────────────────
          const bbox = new THREE.Box3().setFromObject(accScene)
          const size = bbox.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)

          // Target size: ~15% of character height for most accessories
          const rigScene = stateRef.current.rigScene
          const rigBbox = new THREE.Box3().setFromObject(rigScene)
          const rigH = rigBbox.max.y - rigBbox.min.y
          const targetSize = rigH * 0.15
          if (maxDim > 0) accScene.scale.setScalar(targetSize / maxDim)

          // ── Position relative to anchor (Roblox-style snapping) ─────────
          // Re-compute bbox after scaling
          const scaledBbox = new THREE.Box3().setFromObject(accScene)
          const anchor_mode = def?.anchor || 'center'
          const offset = new THREE.Vector3()

          if (anchor_mode === 'bottom') {
            // Accessory bottom sits at the attachment point (e.g. hat sits on HatAttachment)
            offset.y = -scaledBbox.min.y // shift so bottom = 0 in anchor local space
          } else if (anchor_mode === 'top') {
            // Accessory top at attachment point (hangs down)
            offset.y = -scaledBbox.max.y
          }
          // 'center': centered at attachment point (default, offset stays [0,0,0])
          const center = scaledBbox.getCenter(new THREE.Vector3())
          accScene.position.sub(center).add(offset)

          anchor.add(accScene)
          accMap.set(acc.id, { obj: accScene, anchorObj: anchor })
        },
        (err) => console.error('[R15Viewer] Accessory parse error:', err)
      )
    }

    // Resize observer
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
      ...stateRef.current,
      scene,
      renderer,
      camera,
      orbit,
      rigGroup,
      accMap,
      loadAccessory,
      anchorMarkers
    }

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  // ── Sync accessories → scene ──────────────────────────────────────────────
  useEffect(() => {
    const s = stateRef.current
    if (!s.accMap) return
    const { accMap, loadAccessory } = s
    const currentIds = new Set(accessories.map((a) => a.id))

    // Remove stale accessories
    for (const [id, { obj, anchorObj }] of accMap.entries()) {
      if (!currentIds.has(id)) {
        anchorObj.remove(obj)
        accMap.delete(id)
      }
    }
    // Add new accessories
    for (const acc of accessories) {
      if (!accMap.has(acc.id) && acc.dataUrl) loadAccessory(acc)
    }
  }, [accessories])

  // ── Toggle anchor markers visibility ──────────────────────────────────────
  useEffect(() => {
    const markers = stateRef.current.anchorMarkers || []
    markers.forEach((m) => {
      m.visible = showAnchors
    })
  }, [showAnchors])

  const doneCount = accessories.filter((a) => a.status === 'done').length

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Top-left: label */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          pointerEvents: 'none'
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: '#555b6e',
            background: 'rgba(10,11,16,0.7)',
            padding: '3px 8px',
            borderRadius: 5
          }}
        >
          R15 Character
        </span>
        <span
          style={{
            fontSize: 10,
            color: '#3e4455',
            background: 'rgba(10,11,16,0.7)',
            padding: '2px 7px',
            borderRadius: 5
          }}
        >
          Roblox Attachment System
        </span>
      </div>

      {/* Top-right: badge + anchor toggle */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 12,
          display: 'flex',
          gap: 6,
          alignItems: 'center'
        }}
      >
        {doneCount > 0 && (
          <span
            style={{
              fontSize: 11,
              color: '#4ade80',
              background: 'rgba(10,11,16,0.7)',
              padding: '3px 8px',
              borderRadius: 5,
              pointerEvents: 'none'
            }}
          >
            {doneCount} accessory{doneCount !== 1 ? 's' : ''} attached
          </span>
        )}
        <button
          onClick={() => setShowAnchors((v) => !v)}
          title="Toggle attachment point markers"
          style={{
            fontSize: 10,
            padding: '3px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            background: showAnchors ? 'rgba(167,139,250,0.25)' : 'rgba(10,11,16,0.7)',
            border: showAnchors ? '1px solid rgba(167,139,250,0.4)' : '1px solid #1e2330',
            color: showAnchors ? '#c4b5fd' : '#555b6e'
          }}
        >
          {showAnchors ? '⚓ Hide Anchors' : '⚓ Show Anchors'}
        </button>
      </div>

      {/* Empty state hint */}
      {accessories.length === 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 0,
            right: 0,
            textAlign: 'center',
            pointerEvents: 'none'
          }}
        >
          <p style={{ fontSize: 12, color: '#3e4455' }}>
            Generate accessories to see them on the character
          </p>
          <p style={{ fontSize: 11, color: '#2a2e3d', marginTop: 4 }}>
            Each part snaps to its Roblox attachment point
          </p>
        </div>
      )}
    </div>
  )
}

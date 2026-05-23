/* eslint-disable react/prop-types, react-hooks/set-state-in-effect */
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BVHLoader } from 'three/examples/jsm/loaders/BVHLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { retargetClip } from 'three/examples/jsm/utils/SkeletonUtils.js'
import {
  ROBLOX_ATTACH,
  buildAttachmentAnchors,
  buildRigNameMap,
  canonicalizeMotionClip,
  canonicalizeMotionSkeleton,
  dataUrlToArrayBuffer,
  normName
} from '../Modeling/r15Utils'

const PANEL = {
  page: { display: 'flex', height: '100%', overflow: 'hidden', background: '#0f1116' },
  side: {
    width: 320,
    flexShrink: 0,
    borderRight: '1px solid #1e2330',
    padding: '20px 18px',
    overflowY: 'auto'
  },
  title: { fontSize: 18, fontWeight: 700, color: '#eef0f6', margin: 0 },
  desc: { fontSize: 13, color: '#555b6e', marginTop: 4, lineHeight: 1.6 },
  card: {
    background: '#141821',
    border: '1px solid #202533',
    borderRadius: 12,
    padding: 14,
    marginTop: 14
  },
  cardTitle: {
    fontSize: 11,
    color: '#7c8499',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 8
  },
  cardValue: { fontSize: 14, fontWeight: 700, color: '#eef0f6', marginBottom: 6 },
  cardText: { fontSize: 12, color: '#8c93a7', lineHeight: 1.6 },
  buttonRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 },
  primaryBtn: {
    border: 'none',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
    background: 'linear-gradient(135deg,#7c3aed,#a78bfa)',
    cursor: 'pointer'
  },
  secondaryBtn: {
    border: '1px solid #2a3040',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 700,
    color: '#aab0c0',
    background: '#171b24',
    cursor: 'pointer'
  },
  hint: {
    marginTop: 16,
    padding: '12px 14px',
    borderRadius: 10,
    background: 'rgba(124,58,237,0.08)',
    border: '1px solid rgba(124,58,237,0.18)',
    fontSize: 12,
    color: '#9aa0b0',
    lineHeight: 1.7
  },
  nodeStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginTop: 14
  },
  nodeWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10
  },
  nodeConnector: {
    width: 2,
    height: 18,
    background: 'linear-gradient(180deg,rgba(124,58,237,0.4),rgba(167,139,250,0.08))',
    borderRadius: 999,
    alignSelf: 'center'
  },
  nodeShell: {
    background: '#141821',
    border: '1px solid #202533',
    borderRadius: 14,
    padding: 14
  },
  nodeHead: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8
  },
  nodeTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: '#eef0f6'
  },
  nodeMeta: {
    fontSize: 11,
    color: '#8c93a7',
    lineHeight: 1.6
  },
  nodeAction: {
    border: '1px solid #2a3040',
    borderRadius: 9,
    padding: '8px 10px',
    fontSize: 11,
    fontWeight: 700,
    color: '#c4cad8',
    background: '#171b24',
    cursor: 'pointer',
    marginTop: 10,
    width: '100%'
  }
}

const ENV_SPACING = 2.8

export default function PlaygroundModule({ workflowState, onChangeModule }) {
  const animationResult = workflowState?.animationResult || null
  const clothingWorkflow = workflowState?.clothingWorkflow || null
  const activeClothing = clothingWorkflow?.resultDataUrl ? clothingWorkflow : null
  const accessories = useMemo(
    () => (workflowState?.charParts || []).filter((part) => part.status === 'done' && part.dataUrl),
    [workflowState]
  )
  const envParts = useMemo(
    () => (workflowState?.envParts || []).filter((part) => part.status === 'done' && part.dataUrl),
    [workflowState]
  )
  const uiWorkflow = workflowState?.uiWorkflow || null
  const uiFrames = useMemo(
    () =>
      (uiWorkflow?.screens || []).filter(
        (frame) =>
          frame.name?.trim() ||
          frame.objective?.trim() ||
          frame.layoutNotes?.trim() ||
          frame.motionNotes?.trim()
      ),
    [uiWorkflow]
  )
  const readyUiFrames = useMemo(
    () => uiFrames.filter((frame) => frame.status === 'ready'),
    [uiFrames]
  )
  const uiComponentCount = uiFrames.reduce((total, frame) => total + (frame.components?.length || 0), 0)
  const uiInteractionCount = uiFrames.reduce(
    (total, frame) => total + (frame.interactions?.length || 0),
    0
  )
  const workflowNodes = [
    {
      id: 'animation',
      title: 'Animation Node',
      ready: Boolean(animationResult?.bvhPath),
      accent: '#a78bfa',
      actionLabel: 'Open Animation',
      summary: animationResult?.bvhPath
        ? animationResult.type === 'video'
          ? 'Video-driven BVH is feeding the rig.'
          : 'Text-generated BVH is feeding the rig.'
        : 'No motion connected yet.'
    },
    {
      id: 'clothing',
      title: 'Clothing Node',
      ready: Boolean(activeClothing?.resultDataUrl),
      accent: '#38bdf8',
      actionLabel: 'Open Clothing',
      summary: activeClothing?.resultDataUrl
        ? `Classic ${activeClothing.assetType || 'shirt'} texture is ready for the avatar overlay.`
        : 'No classic clothing texture connected yet.'
    },
    {
      id: 'modeling',
      title: 'Accessories Node',
      ready: accessories.length > 0,
      accent: '#4ade80',
      actionLabel: 'Open Modeling',
      summary:
        accessories.length > 0
          ? `${accessories.length} accessory${accessories.length === 1 ? '' : 'ies'} attached to the character preview.`
          : 'No generated accessories connected yet.'
    },
    {
      id: 'modeling-environment',
      title: 'Environment Node',
      ready: envParts.length > 0,
      accent: '#f59e0b',
      actionLabel: 'Open Modeling',
      actionModule: 'modeling',
      summary:
        envParts.length > 0
          ? `${envParts.length} environment part${envParts.length === 1 ? '' : 's'} placed around the rig.`
          : 'No scene dressing connected yet.'
    },
    {
      id: 'ui',
      title: 'UI Node',
      ready: readyUiFrames.length > 0,
      accent: '#fb7185',
      actionLabel: 'Open UI Studio',
      summary:
        readyUiFrames.length > 0
          ? `${readyUiFrames.length} ready UI frame${readyUiFrames.length === 1 ? '' : 's'} with ${uiComponentCount} components and ${uiInteractionCount} interactions mapped into the workflow.`
          : 'No ready UI frames connected yet.'
    }
  ]
  const connectedNodeCount = workflowNodes.filter((node) => node.ready).length

  return (
    <div style={PANEL.page}>
      <div style={PANEL.side}>
        <h1 style={PANEL.title}>Workflow Playground</h1>
        <p style={PANEL.desc}>
          Streamline the flow as one connected graph: motion, classic clothing, accessories,
          environment, and UI all feed the same Roblox preview stage.
        </p>

        <div style={PANEL.card}>
          <div style={PANEL.cardTitle}>Playground graph</div>
          <div style={PANEL.cardValue}>
            {connectedNodeCount}/{workflowNodes.length} node{workflowNodes.length === 1 ? '' : 's'} connected
          </div>
          <div style={PANEL.cardText}>
            This is a lightweight node-based review board rather than a full graph editor, so you
            can jump between modules quickly and see what is already feeding the live viewport.
          </div>
        </div>

        <div style={PANEL.nodeStack}>
          {workflowNodes.map((node, index) => (
            <div key={node.id} style={PANEL.nodeWrap}>
              {index > 0 && <div style={PANEL.nodeConnector} />}
              <div
                style={{
                  ...PANEL.nodeShell,
                  border: node.ready ? `1px solid ${node.accent}55` : '1px solid #202533',
                  boxShadow: node.ready ? `0 0 0 1px ${node.accent}15 inset` : 'none'
                }}
              >
                <div style={PANEL.nodeHead}>
                  <div style={PANEL.nodeTitle}>{node.title}</div>
                  <span style={badgeStyle(node.ready ? node.accent : '#6b7280')}>
                    {node.ready ? 'Connected' : 'Waiting'}
                  </span>
                </div>
                <div style={PANEL.nodeMeta}>{node.summary}</div>
                <button
                  style={PANEL.nodeAction}
                  onClick={() => onChangeModule?.(node.actionModule || node.id)}
                >
                  {node.actionLabel}
                </button>
              </div>
            </div>
          ))}
          <div style={PANEL.nodeConnector} />
          <div style={{ ...PANEL.nodeShell, border: '1px solid rgba(124,58,237,0.45)' }}>
            <div style={PANEL.nodeHead}>
              <div style={PANEL.nodeTitle}>Playground Output</div>
              <span style={badgeStyle('#c4b5fd')}>Live</span>
            </div>
            <div style={PANEL.nodeMeta}>
              Combined preview of the animated R15 rig, classic clothing overlay, equipped
              accessories, scene parts, and workflow state.
            </div>
          </div>
        </div>

        <div style={PANEL.card}>
          <div style={PANEL.cardTitle}>Connected clothing</div>
          <div style={PANEL.cardValue}>
            {activeClothing?.resultDataUrl
              ? `Classic ${activeClothing.assetType || 'shirt'} ready`
              : 'No clothing texture yet'}
          </div>
          <div style={PANEL.cardText}>
            {activeClothing?.resultDataUrl
              ? 'The generated texture is projected onto the rig as an overlay so you can judge seams and silhouette while the character animates.'
              : 'Generate a classic shirt or pants texture in Clothing Studio and it will appear on the rig here automatically.'}
          </div>
          {activeClothing?.resultDataUrl && (
            <img
              src={activeClothing.resultDataUrl}
              alt="Connected classic clothing texture"
              style={{
                width: '100%',
                marginTop: 12,
                borderRadius: 10,
                border: '1px solid #252a36'
              }}
            />
          )}
        </div>

        <div style={PANEL.hint}>
          <strong style={{ color: '#c4b5fd' }}>Current workflow:</strong>
          <br />
          1. Generate motion in Animation
          <br />
          2. Generate classic shirt or pants textures in Clothing
          <br />
          3. Generate accessories / scene parts in Modeling
          <br />
          4. Create UI frames in UI Studio
          <br />
          5. Return here to review the connected node flow in one viewport
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <WorkflowViewport
          animationResult={animationResult}
          clothingAsset={activeClothing}
          accessories={accessories}
          envParts={envParts}
        />
      </div>
    </div>
  )
}

function WorkflowViewport({ animationResult, clothingAsset, accessories, envParts }) {
  const mountRef = useRef(null)
  const stateRef = useRef({})
  const [rigReady, setRigReady] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [status, setStatus] = useState({ rig: false, motion: false, clothing: false, error: null })

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
    scene.background = new THREE.Color(0x0c0e13)

    const camera = new THREE.PerspectiveCamera(52, el.clientWidth / el.clientHeight, 0.01, 500)
    camera.position.set(0, 2.4, 6.6)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(0, 1.5, 0)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08

    scene.add(new THREE.GridHelper(28, 28, 0x252a36, 0x1a1d26))
    scene.add(new THREE.AmbientLight(0xffffff, 0.75))

    const key = new THREE.DirectionalLight(0xffffff, 1.25)
    key.position.set(5, 8, 5)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    scene.add(key)

    const fill = new THREE.DirectionalLight(0xa78bfa, 0.45)
    fill.position.set(-4, 3, -5)
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
      if (stateRef.current.mixer && stateRef.current.playing) {
        stateRef.current.mixer.update(clock.getDelta())
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
      envMap: new Map(),
      accMap: new Map(),
      clothingOverlays: [],
      playing: true
    }

    const loader = new GLTFLoader()
    loader.load(
      '/r15_rig.glb',
      (gltf) => {
        rigGroup.add(gltf.scene)
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

        let skinnedMesh = null
        gltf.scene.traverse((obj) => {
          if (!skinnedMesh && obj.isSkinnedMesh && obj.skeleton) skinnedMesh = obj
        })

        stateRef.current.rigScene = gltf.scene
        stateRef.current.targetMesh = skinnedMesh
        stateRef.current.anchors = buildAttachmentAnchors(gltf.scene)
        stateRef.current.rigNameMap = buildRigNameMap(gltf.scene)
        setStatus((prev) => ({ ...prev, rig: true, error: null }))
        setRigReady((prev) => prev + 1)
      },
      undefined,
      (err) =>
        setStatus({ rig: false, motion: false, error: `Failed to load R15 rig: ${err.message}` })
    )

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animId)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    const s = stateRef.current
    if (!s.rigScene || !s.anchors) return

    const currentIds = new Set(accessories.map((acc) => acc.id))
    for (const [id, entry] of s.accMap.entries()) {
      if (!currentIds.has(id)) {
        entry.anchor.remove(entry.object)
        s.accMap.delete(id)
      }
    }

    for (const acc of accessories) {
      if (s.accMap.has(acc.id) || !acc.dataUrl) continue

      let buffer
      try {
        buffer = dataUrlToArrayBuffer(acc.dataUrl)
      } catch {
        continue
      }

      const loader = new GLTFLoader()
      loader.parse(
        buffer,
        '',
        (gltf) => {
          const accScene = gltf.scene
          const attachKey = acc.attachPoint || 'HatAttachment'
          const anchor = s.anchors[attachKey]
          const def = ROBLOX_ATTACH[attachKey]
          if (!anchor || !def) return

          const bbox = new THREE.Box3().setFromObject(accScene)
          const size = bbox.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          const rigBbox = new THREE.Box3().setFromObject(s.rigScene)
          const rigHeight = rigBbox.max.y - rigBbox.min.y
          if (maxDim > 0) accScene.scale.setScalar((rigHeight * 0.15) / maxDim)

          const scaledBox = new THREE.Box3().setFromObject(accScene)
          const offset = new THREE.Vector3()
          if (def.anchor === 'bottom') offset.y = -scaledBox.min.y
          else if (def.anchor === 'top') offset.y = -scaledBox.max.y

          const center = scaledBox.getCenter(new THREE.Vector3())
          accScene.position.sub(center).add(offset)

          anchor.add(accScene)
          s.accMap.set(acc.id, { object: accScene, anchor })
        },
        (err) => setStatus((prev) => ({ ...prev, error: `Accessory parse failed: ${err.message}` }))
      )
    }
  }, [accessories, rigReady])

  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return

    const parts = envParts.filter((part) => part.dataUrl)
    const currentIds = new Set(parts.map((part) => part.id))

    for (const [id, group] of s.envMap.entries()) {
      if (!currentIds.has(id)) {
        s.scene.remove(group)
        s.envMap.delete(id)
      }
    }

    for (const part of parts) {
      if (s.envMap.has(part.id)) continue

      let buffer
      try {
        buffer = dataUrlToArrayBuffer(part.dataUrl)
      } catch {
        continue
      }

      const loader = new GLTFLoader()
      loader.parse(
        buffer,
        '',
        (gltf) => {
          const group = new THREE.Group()
          group.add(gltf.scene)

          const bbox = new THREE.Box3().setFromObject(group)
          const size = bbox.getSize(new THREE.Vector3())
          const maxDim = Math.max(size.x, size.y, size.z)
          if (maxDim > 0) group.scale.setScalar(1.35 / maxDim)

          bbox.setFromObject(group)
          group.position.y -= bbox.min.y
          s.scene.add(group)
          s.envMap.set(part.id, group)
          layoutEnvironment(s)
          focusScene(s)
        },
        (err) =>
          setStatus((prev) => ({ ...prev, error: `Environment part parse failed: ${err.message}` }))
      )
    }

    layoutEnvironment(s)
    focusScene(s)
  }, [envParts])

  useEffect(() => {
    const s = stateRef.current
    if (!s.rigScene) return

    clearClothingOverlays(s)

    if (!clothingAsset?.resultDataUrl) {
      setStatus((prev) => ({ ...prev, clothing: false }))
      focusScene(s)
      return
    }

    const textureLoader = new THREE.TextureLoader()
    textureLoader.load(
      clothingAsset.resultDataUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = false
        texture.needsUpdate = true

        const overlays = []
        s.rigScene.traverse((obj) => {
          if (!obj?.isSkinnedMesh || !isClothingTargetMesh(obj.name, clothingAsset.assetType)) return

          const overlayMaterial = new THREE.MeshStandardMaterial({
            map: texture,
            transparent: true,
            alphaTest: 0.05,
            depthWrite: false
          })
          overlayMaterial.skinning = true
          overlayMaterial.side = THREE.FrontSide
          overlayMaterial.polygonOffset = true
          overlayMaterial.polygonOffsetFactor = -1
          overlayMaterial.polygonOffsetUnits = 1

          const overlayMesh = new THREE.SkinnedMesh(obj.geometry, overlayMaterial)
          overlayMesh.name = `__clothing_overlay_${clothingAsset.assetType}_${obj.name}`
          overlayMesh.bind(obj.skeleton, obj.bindMatrix)
          overlayMesh.bindMode = obj.bindMode
          overlayMesh.renderOrder = (obj.renderOrder || 0) + 1
          overlayMesh.castShadow = false
          overlayMesh.receiveShadow = false
          overlayMesh.position.copy(obj.position)
          overlayMesh.quaternion.copy(obj.quaternion)
          overlayMesh.scale.copy(obj.scale)
          obj.parent?.add(overlayMesh)
          overlays.push({ mesh: overlayMesh, material: overlayMaterial })
        })

        s.clothingOverlays = overlays
        setStatus((prev) => ({ ...prev, clothing: overlays.length > 0, error: null }))
        focusScene(s)
      },
      undefined,
      (err) => setStatus((prev) => ({ ...prev, clothing: false, error: `Clothing overlay failed: ${err.message}` }))
    )
  }, [clothingAsset?.assetType, clothingAsset?.resultDataUrl, rigReady])

  useEffect(() => {
    const s = stateRef.current
    if (!s.scene || !s.rigScene || !s.targetMesh) return

    if (s.action) {
      s.action.stop()
      s.action = null
    }
    if (s.mixer) {
      s.mixer.stopAllAction()
      s.mixer = null
    }
    if (s.sourceHelper) {
      s.scene.remove(s.sourceHelper)
      s.sourceHelper = null
    }

    if (!animationResult?.bvhPath) {
      setStatus((prev) => ({ ...prev, motion: false }))
      return
    }

    window.api
      .readTextFile({ filePath: animationResult.bvhPath })
      .then(({ success, text, error }) => {
        if (!success) {
          setStatus((prev) => ({ ...prev, motion: false, error }))
          return
        }

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
        s.playing = true
        setPlaying(true)
        setStatus((prev) => ({ ...prev, motion: true, error: null }))
        focusScene(s)
      })
      .catch((err) => setStatus((prev) => ({ ...prev, motion: false, error: err.message })))
  }, [animationResult?.bvhPath, rigReady])

  function togglePlayback() {
    const s = stateRef.current
    if (!s.action) return
    s.playing = !s.playing
    s.action.paused = !s.playing
    setPlaying(s.playing)
  }

  function focusCurrentScene() {
    focusScene(stateRef.current)
  }

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          display: 'flex',
          gap: 8,
          alignItems: 'center'
        }}
      >
        <span style={badgeStyle('#555b6e')}>Connected Preview</span>
        {status.rig && <span style={badgeStyle('#4ade80')}>R15 Ready</span>}
        {status.motion && <span style={badgeStyle('#a78bfa')}>Motion Applied</span>}
        {status.clothing && <span style={badgeStyle('#38bdf8')}>Clothing Applied</span>}
      </div>

      <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 8 }}>
        <button
          onClick={togglePlayback}
          disabled={!status.motion}
          style={toolbarButton(!status.motion)}
        >
          {playing ? 'Pause Motion' : 'Play Motion'}
        </button>
        <button onClick={focusCurrentScene} style={toolbarButton(false)}>
          Focus View
        </button>
      </div>

      {status.error && (
        <div
          style={{
            position: 'absolute',
            bottom: 14,
            left: 14,
            right: 14,
            display: 'flex',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              maxWidth: 560,
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.25)',
              borderRadius: 10,
              padding: '10px 14px',
              fontSize: 12,
              color: '#fca5a5'
            }}
          >
            {status.error}
          </div>
        </div>
      )}

      {!animationResult?.bvhPath &&
        !clothingAsset?.resultDataUrl &&
        accessories.length === 0 &&
        envParts.length === 0 && (
        <div style={emptyStateStyle}>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#c4cad8', margin: 0 }}>
            Nothing to preview yet
          </p>
          <p style={{ fontSize: 12, color: '#596071', margin: '8px 0 0' }}>
            Generate animation, classic clothing, accessories, or environment parts and they will
            appear here automatically.
          </p>
        </div>
      )}
    </div>
  )
}

function layoutEnvironment(state) {
  if (!state?.envMap) return
  let index = 0
  for (const group of state.envMap.values()) {
    group.position.x = (index - (state.envMap.size - 1) / 2) * ENV_SPACING
    group.position.z = -2.2
    index += 1
  }
}

function focusScene(state) {
  if (!state?.camera || !state?.orbit || !state?.rigScene) return
  const bounds = new THREE.Box3()
  bounds.expandByObject(state.rigScene)
  for (const group of state.envMap?.values() || []) bounds.expandByObject(group)
  if (bounds.isEmpty()) return

  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const maxDim = Math.max(size.x, size.y, size.z)
  state.orbit.target.copy(center)
  state.camera.position.set(center.x, center.y + maxDim * 0.45, center.z + maxDim * 1.7 + 1.4)
  state.camera.lookAt(center)
}

function clearClothingOverlays(state) {
  if (!state?.clothingOverlays?.length) {
    state.clothingOverlays = []
    return
  }

  for (const overlay of state.clothingOverlays) {
    overlay.mesh.parent?.remove(overlay.mesh)
    overlay.material.dispose()
  }
  state.clothingOverlays = []
}

function isClothingTargetMesh(name, assetType) {
  const normalized = normName(name)
  if (!normalized) return false

  const isTorso = normalized.includes('torso')
  const isArm = normalized.includes('arm')
  const isLeg = normalized.includes('leg') || normalized.includes('foot')

  if ((assetType || 'shirt') === 'pants') {
    return normalized.includes('lowertorso') || isLeg
  }

  return isTorso || isArm
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

function toolbarButton(disabled) {
  return {
    border: '1px solid #2a3040',
    borderRadius: 8,
    padding: '7px 11px',
    fontSize: 11,
    fontWeight: 700,
    color: disabled ? '#5a6070' : '#c4cad8',
    background: disabled ? '#131821' : '#171b24',
    cursor: disabled ? 'not-allowed' : 'pointer'
  }
}

const emptyStateStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none'
}

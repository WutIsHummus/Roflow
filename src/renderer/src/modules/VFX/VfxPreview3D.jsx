/* eslint-disable react/prop-types */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function makeCanvasTexture(draw) {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  draw(ctx, canvas)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createRadialTexture(primary, secondary, smoke = false) {
  return makeCanvasTexture((ctx, canvas) => {
    const gradient = ctx.createRadialGradient(
      canvas.width / 2,
      canvas.height / 2,
      smoke ? canvas.width * 0.08 : canvas.width * 0.03,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width * 0.48
    )
    gradient.addColorStop(0, secondary)
    gradient.addColorStop(smoke ? 0.3 : 0.18, primary)
    gradient.addColorStop(smoke ? 0.8 : 0.68, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  })
}

function createSparkTexture(primary, secondary) {
  return makeCanvasTexture((ctx, canvas) => {
    ctx.translate(canvas.width / 2, canvas.height / 2)
    const gradient = ctx.createLinearGradient(-canvas.width * 0.35, 0, canvas.width * 0.35, 0)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.3, primary)
    gradient.addColorStop(0.5, secondary)
    gradient.addColorStop(0.7, primary)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(-canvas.width * 0.38, -canvas.height * 0.08, canvas.width * 0.76, canvas.height * 0.16)
  })
}

function createBeamTexture(primary, secondary) {
  return makeCanvasTexture((ctx, canvas) => {
    const gradient = ctx.createLinearGradient(0, canvas.height / 2, canvas.width, canvas.height / 2)
    gradient.addColorStop(0, 'rgba(0,0,0,0)')
    gradient.addColorStop(0.22, primary)
    gradient.addColorStop(0.5, secondary)
    gradient.addColorStop(0.78, primary)
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, canvas.height * 0.28, canvas.width, canvas.height * 0.44)
  })
}

function createRingTexture(primary, secondary) {
  return makeCanvasTexture((ctx, canvas) => {
    ctx.strokeStyle = primary
    ctx.lineWidth = 16
    ctx.beginPath()
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.28, 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = secondary
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width * 0.28, 0, Math.PI * 2)
    ctx.stroke()
  })
}

function createPlaneMaterial(layer, texture) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: clamp(layer.opacity, 0.05, 1),
    depthWrite: false,
    blending: layer.blendMode === 'alpha' ? THREE.NormalBlending : THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    color: new THREE.Color(0xffffff)
  })
}

function pickTexture(layer, imageTexture) {
  if (imageTexture && (layer.layerType === 'particle' || layer.layerType === 'billboard')) {
    return imageTexture.clone()
  }
  if (layer.shape === 'spark' || layer.shape === 'slash') {
    return createSparkTexture(layer.color.primary, layer.color.secondary)
  }
  if (layer.layerType === 'beam' || layer.layerType === 'trail') {
    return createBeamTexture(layer.color.primary, layer.color.secondary)
  }
  if (layer.layerType === 'ring' || layer.shape === 'ring') {
    return createRingTexture(layer.color.primary, layer.color.secondary)
  }
  return createRadialTexture(layer.color.primary, layer.color.secondary, layer.shape === 'smoke')
}

function layerWidth(layer) {
  return clamp(layer.size.max * 1.4, 0.18, 3.2)
}

function layerHeight(layer) {
  return clamp(layer.size.max * (layer.shape === 'spark' || layer.shape === 'slash' ? 0.24 : 1.4), 0.08, 2.6)
}

export default function VfxPreview3D({ preset, activeLayerId, onSelectLayer, imageDataUrls = [] }) {
  const mountRef = useRef(null)
  const activeLayerIdRef = useRef(activeLayerId)
  const onSelectLayerRef = useRef(onSelectLayer)

  useEffect(() => {
    activeLayerIdRef.current = activeLayerId
  }, [activeLayerId])

  useEffect(() => {
    onSelectLayerRef.current = onSelectLayer
  }, [onSelectLayer])

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x0b0f15)

    const camera = new THREE.PerspectiveCamera(48, el.clientWidth / el.clientHeight, 0.01, 100)
    camera.position.set(0, 1.2, 5.4)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.07
    orbit.target.set(0, 1, 0)
    orbit.minDistance = 2.2
    orbit.maxDistance = 9

    scene.add(new THREE.GridHelper(14, 14, 0x252a36, 0x1a1d26))
    scene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const key = new THREE.DirectionalLight(0xffffff, 1.15)
    key.position.set(2.8, 5, 4.2)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xa78bfa, 0.35)
    fill.position.set(-4, 3, -2)
    scene.add(fill)

    const emitterAnchor = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, opacity: 0.45, transparent: true })
    )
    emitterAnchor.position.set(0, 1, 0)
    scene.add(emitterAnchor)

    const effectRoot = new THREE.Group()
    effectRoot.position.copy(emitterAnchor.position)
    scene.add(effectRoot)

    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const clickTargets = []
    const animated = []

    let imageTexture = null
    if (imageDataUrls[0]) {
      imageTexture = new THREE.TextureLoader().load(imageDataUrls[0])
      imageTexture.colorSpace = THREE.SRGBColorSpace
    }

    for (const [index, layer] of (preset.layers || []).entries()) {
      const texture = pickTexture(layer, imageTexture)
      const material = createPlaneMaterial(layer, texture)
      const layerGroup = new THREE.Group()
      layerGroup.userData.layerId = layer.id
      effectRoot.add(layerGroup)

      const registerPlane = (mesh, meta) => {
        mesh.userData.layerId = layer.id
        mesh.userData.meta = meta
        mesh.userData.baseOpacity = mesh.material.opacity
        clickTargets.push(mesh)
        layerGroup.add(mesh)
        animated.push(mesh)
      }

      if (layer.layerType === 'beam' || layer.layerType === 'trail') {
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(clamp(1.8 + layer.speed.max * 0.05, 1.6, 4.8), clamp(layerHeight(layer), 0.08, 0.8)),
          material
        )
        plane.position.set(0, index * 0.12, 0)
        plane.rotation.z = (index % 2 === 0 ? -1 : 1) * 0.18
        registerPlane(plane, { kind: 'beam', offset: index * 0.22, pulse: 0.8 + index * 0.12 })
      } else if (layer.layerType === 'billboard' || layer.layerType === 'ring') {
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(clamp(layerWidth(layer) * 1.4, 0.8, 4.8), clamp(layerHeight(layer) * 1.4, 0.8, 4.8)),
          material
        )
        plane.position.set(0, 0.15, 0)
        registerPlane(plane, { kind: 'billboard', pulse: 0.7 + index * 0.08 })
      } else {
        const count = clamp(Math.round(layer.rate / 2), 8, 20)
        for (let particleIndex = 0; particleIndex < count; particleIndex += 1) {
          const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(layerWidth(layer), layerHeight(layer)),
            material.clone()
          )
          const angle = (Math.PI * 2 * particleIndex) / count + index * 0.45
          const radius = 0.18 + (particleIndex % 4) * 0.14 + index * 0.03
          const base = new THREE.Vector3(Math.cos(angle) * radius, (particleIndex % 3) * 0.08, Math.sin(angle) * radius)
          plane.position.copy(base)
          plane.rotation.z = particleIndex * 0.33
          registerPlane(plane, {
            kind: 'particle',
            base,
            angle,
            radius,
            speed: clamp(layer.speed.max * 0.015, 0.04, 0.65),
            spread: THREE.MathUtils.degToRad(layer.spread || 0),
            pulse: 0.5 + particleIndex * 0.06
          })
        }
      }
    }

    const highlightColor = new THREE.Color(0xffffff)
    const normalColor = new THREE.Color(0xffffff)

    function onPointerDown(event) {
      if (!onSelectLayerRef.current) return
      const rect = renderer.domElement.getBoundingClientRect()
      mouse.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1)
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(clickTargets, false)
      if (hits.length > 0) {
        onSelectLayerRef.current(hits[0].object.userData.layerId)
      }
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)

    const ro = new ResizeObserver(() => {
      renderer.setSize(el.clientWidth, el.clientHeight)
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
    })
    ro.observe(el)

    const clock = new THREE.Clock()
    let animId

    function animate() {
      animId = requestAnimationFrame(animate)
      const time = clock.getElapsedTime()

      for (const mesh of animated) {
        const meta = mesh.userData.meta || {}
        const material = mesh.material
        mesh.lookAt(camera.position)

        if (meta.kind === 'particle') {
          const orbitRadius = meta.radius + Math.sin(time * meta.speed + meta.pulse) * 0.28
          const vertical = 0.08 + Math.sin(time * (meta.speed + 0.6) + meta.pulse) * 0.38
          mesh.position.set(
            Math.cos(meta.angle + time * meta.speed) * orbitRadius,
            vertical,
            Math.sin(meta.angle + time * meta.speed) * orbitRadius
          )
          const scale = 0.75 + Math.sin(time * 2.1 + meta.pulse) * 0.18
          mesh.scale.setScalar(scale)
        } else if (meta.kind === 'billboard') {
          const scale = 1 + Math.sin(time * 1.7 + meta.pulse) * 0.12
          mesh.scale.setScalar(scale)
          mesh.position.y = 0.16 + Math.sin(time * 1.2 + meta.pulse) * 0.08
        } else if (meta.kind === 'beam') {
          mesh.position.y = Math.sin(time * 1.4 + meta.offset) * 0.18
          mesh.rotation.z = Math.sin(time * 0.9 + meta.offset) * 0.22
        }

        const isActive = mesh.userData.layerId === activeLayerIdRef.current
        material.color.copy(isActive ? highlightColor : normalColor)
        material.opacity = clamp((isActive ? 1 : 0.85) * mesh.userData.baseOpacity, 0.05, 1)
      }

      orbit.update()
      renderer.render(scene, camera)
    }

    animate()

    return () => {
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      cancelAnimationFrame(animId)
      orbit.dispose()
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
          mats.forEach((mat) => {
            if (mat.map) mat.map.dispose()
            mat.dispose()
          })
        }
      })
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [imageDataUrls, preset])

  return (
    <div style={{ position: 'relative', width: '100%', height: 340, borderRadius: 16, overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 12,
          padding: '4px 8px',
          borderRadius: 999,
          background: 'rgba(10, 14, 20, 0.72)',
          border: '1px solid rgba(51, 65, 85, 0.9)',
          fontSize: 11,
          color: '#cbd5e1'
        }}
      >
        3D billboard plane preview
      </div>
    </div>
  )
}

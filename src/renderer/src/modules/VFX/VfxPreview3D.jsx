/* eslint-disable react/prop-types */

import { useEffect, useMemo, useRef } from 'react'

import * as THREE from 'three'

import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

import {

  clamp,

  interpolateColorAtTime,

  interpolateNumberAtTime,

  normalizeColorKeypoints,

  normalizeSizeKeypoints,

  normalizeTransparencyKeypoints

} from '../../../../shared/vfxSequenceUtils.js'



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



function createDataUrlTexture(dataUrl) {

  const image = new Image()

  image.src = dataUrl

  const texture = new THREE.Texture(image)

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



function createFlareTexture(primary, secondary) {

  return makeCanvasTexture((ctx, canvas) => {

    const cx = canvas.width / 2

    const cy = canvas.height / 2

    for (let ray = 0; ray < 8; ray += 1) {

      const angle = (Math.PI * 2 * ray) / 8

      const gradient = ctx.createLinearGradient(

        cx,

        cy,

        cx + Math.cos(angle) * canvas.width * 0.45,

        cy + Math.sin(angle) * canvas.width * 0.45

      )

      gradient.addColorStop(0, secondary)

      gradient.addColorStop(0.35, primary)

      gradient.addColorStop(1, 'rgba(0,0,0,0)')

      ctx.strokeStyle = gradient

      ctx.lineWidth = 10

      ctx.beginPath()

      ctx.moveTo(cx, cy)

      ctx.lineTo(cx + Math.cos(angle) * canvas.width * 0.42, cy + Math.sin(angle) * canvas.width * 0.42)

      ctx.stroke()

    }

    const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, canvas.width * 0.18)

    core.addColorStop(0, secondary)

    core.addColorStop(0.5, primary)

    core.addColorStop(1, 'rgba(0,0,0,0)')

    ctx.fillStyle = core

    ctx.fillRect(0, 0, canvas.width, canvas.height)

  })

}



function layerSequenceData(layer) {

  const colorKeypoints =

    layer.color?.keypoints ||

    normalizeColorKeypoints(layer.colorKeypoints, {

      color: layer.color?.primary,

      secondaryColor: layer.color?.secondary

    })

  const sizeKeypoints =

    layer.size?.keypoints ||

    normalizeSizeKeypoints(layer.sizeKeypoints, {

      sizeMin: layer.sizeMin ?? layer.size?.min,

      sizeMax: layer.sizeMax ?? layer.size?.max

    })

  const transparencyKeypoints =

    layer.transparency?.keypoints ||

    normalizeTransparencyKeypoints(layer.transparencyKeypoints, {

      opacity: layer.opacity,

      transparencyEnd: layer.transparencyEnd

    })



  return { colorKeypoints, sizeKeypoints, transparencyKeypoints }

}



function createPlaneMaterial(layer, texture, usesCustomImage = false) {

  const emission = layer.lightEmission ?? 1

  const { colorKeypoints, transparencyKeypoints } = layerSequenceData(layer)

  const birthColor = usesCustomImage ? '#ffffff' : interpolateColorAtTime(colorKeypoints, 0)

  const birthTransparency = interpolateNumberAtTime(transparencyKeypoints, 0)

  const birthOpacity = clamp(1 - birthTransparency, 0.05, 1)



  return new THREE.MeshBasicMaterial({

    map: texture,

    transparent: true,

    opacity: birthOpacity,

    depthWrite: false,

    blending: usesCustomImage

      ? THREE.NormalBlending

      : emission > 0.5

        ? THREE.AdditiveBlending

        : THREE.NormalBlending,

    side: THREE.DoubleSide,

    color: new THREE.Color(birthColor)

  })

}



function createShapeTexture(layer) {

  const shape = layer.shape || 'orb'

  const core = '#ffffff'

  const edge = 'rgba(255,255,255,0.75)'



  if (shape === 'spark' || shape === 'slash') {

    return createSparkTexture(core, edge)

  }

  if (shape === 'ring') {

    return createRingTexture(core, edge)

  }

  if (shape === 'flare') {

    return createFlareTexture(core, edge)

  }

  return createRadialTexture(core, edge, shape === 'smoke')

}



function pickTexture(layer, layerImageTexture) {

  const wantsImage = layer.textureSource === 'image'

  if (wantsImage && layerImageTexture) {

    return layerImageTexture

  }

  return createShapeTexture(layer)

}



function particleBaseSize(layer, sizeKeypoints) {

  const maxSize = Math.max(...sizeKeypoints.map((kp) => kp.value))

  return clamp(maxSize * 1.4, 0.18, 3.2)

}



function particleBaseHeight(layer, sizeKeypoints) {

  const maxSize = Math.max(...sizeKeypoints.map((kp) => kp.value))

  return clamp(maxSize * (layer.shape === 'spark' || layer.shape === 'slash' ? 0.24 : 1.4), 0.08, 2.6)

}



function emissionDirectionVector(direction) {

  switch (direction) {

    case 'Bottom':

      return new THREE.Vector3(0, -1, 0)

    case 'Front':

      return new THREE.Vector3(0, 0, -1)

    case 'Back':

      return new THREE.Vector3(0, 0, 1)

    case 'Left':

      return new THREE.Vector3(-1, 0, 0)

    case 'Right':

      return new THREE.Vector3(1, 0, 0)

    case 'Top':

    default:

      return new THREE.Vector3(0, 1, 0)

  }

}



function emissionShapeRadius(shape, style) {

  const volumeScale = style === 'Surface' ? 0.85 : 1

  switch (shape) {

    case 'Box':

      return 0.32 * volumeScale

    case 'Cylinder':

    case 'Disc':

      return 0.38 * volumeScale

    case 'Ball':

    case 'Sphere':

    default:

      return 0.42 * volumeScale

  }

}



function randomInEmissionVolume(shape, radius) {

  if (shape === 'Box') {

    return new THREE.Vector3(

      (Math.random() - 0.5) * radius * 2,

      (Math.random() - 0.5) * radius * 2,

      (Math.random() - 0.5) * radius * 2

    )

  }

  if (shape === 'Disc') {

    const angle = Math.random() * Math.PI * 2

    const r = Math.sqrt(Math.random()) * radius

    return new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r)

  }

  if (shape === 'Cylinder') {

    const angle = Math.random() * Math.PI * 2

    const r = Math.sqrt(Math.random()) * radius

    const y = (Math.random() - 0.5) * radius * 1.6

    return new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r)

  }

  const angle = Math.random() * Math.PI * 2

  const elevation = (Math.random() - 0.5) * Math.PI

  const r = Math.cbrt(Math.random()) * radius

  return new THREE.Vector3(

    Math.cos(elevation) * Math.cos(angle) * r,

    Math.sin(elevation) * r,

    Math.cos(elevation) * Math.sin(angle) * r

  )

}



function buildSceneSignature(layers, layerTextureDataUrls) {

  return {

    layers: (layers || []).map((layer) => ({

      id: layer.id,

      enabled: layer.enabled !== false,

      robloxClass: layer.robloxClass || 'ParticleEmitter',

      textureSource: layer.textureSource || 'shape',

      shape: layer.shape,

      textureImagePath: layer.textureImagePath || '',

      color: layer.color,

      size: layer.size,

      transparency: layer.transparency,

      sizeMin: layer.sizeMin,

      sizeMax: layer.sizeMax,

      opacity: layer.opacity,

      transparencyEnd: layer.transparencyEnd,

      lightEmission: layer.lightEmission,

      rate: layer.rate,

      lifetime: layer.lifetime,

      speed: layer.speed,

      spread: layer.spread,

      spreadAngleY: layer.spreadAngleY,

      drag: layer.drag,

      acceleration: layer.acceleration,

      emissionDirection: layer.emissionDirection,

      emissionShape: layer.emissionShape,

      shapeStyle: layer.shapeStyle,

      rotation: layer.rotation,

      rotSpeed: layer.rotSpeed,

      orientation: layer.orientation,

      timeScale: layer.timeScale

    })),

    loadedTextures: Object.entries(layerTextureDataUrls || {})

      .sort(([a], [b]) => a.localeCompare(b))

      .map(([id, url]) => `${id}:${String(url || '').length}`)

  }

}



export default function VfxPreview3D({

  preset,

  activeLayerId,

  onSelectLayer,

  layerTextureDataUrls = {}

}) {

  const mountRef = useRef(null)

  const activeLayerIdRef = useRef(activeLayerId)

  const onSelectLayerRef = useRef(onSelectLayer)



  useEffect(() => {

    activeLayerIdRef.current = activeLayerId

  }, [activeLayerId])



  useEffect(() => {

    onSelectLayerRef.current = onSelectLayer

  }, [onSelectLayer])



  const sceneKey = useMemo(

    () => JSON.stringify(buildSceneSignature(preset?.layers, layerTextureDataUrls)),

    [preset?.layers, layerTextureDataUrls]

  )



  useEffect(() => {

    const el = mountRef.current

    if (!el) return



    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })

    renderer.setPixelRatio(window.devicePixelRatio)

    renderer.setSize(el.clientWidth, el.clientHeight)

    renderer.outputColorSpace = THREE.SRGBColorSpace

    el.appendChild(renderer.domElement)



    const scene = new THREE.Scene()

    scene.background = new THREE.Color(0x0b0f15)



    const camera = new THREE.PerspectiveCamera(48, el.clientWidth / el.clientHeight, 0.01, 100)

    camera.position.set(0, 1.2, 5.4)



    const orbit = new OrbitControls(camera, renderer.domElement)

    orbit.enableDamping = true

    orbit.target.set(0, 1, 0)



    scene.add(new THREE.GridHelper(14, 14, 0x252a36, 0x1a1d26))

    scene.add(new THREE.AmbientLight(0xffffff, 0.5))

    const key = new THREE.DirectionalLight(0xffffff, 1.1)

    key.position.set(2.8, 5, 4.2)

    scene.add(key)



    const effectRoot = new THREE.Group()

    effectRoot.position.set(0, 1, 0)

    scene.add(effectRoot)



    const raycaster = new THREE.Raycaster()

    const mouse = new THREE.Vector2()

    const clickTargets = []

    const animated = []



    const loadedImageTextures = {}

    for (const [layerId, dataUrl] of Object.entries(layerTextureDataUrls)) {

      if (!dataUrl) continue

      loadedImageTextures[layerId] = createDataUrlTexture(dataUrl)

    }



    for (const [index, layer] of (preset.layers || []).entries()) {

      if (layer.enabled === false) continue



      const { colorKeypoints, sizeKeypoints, transparencyKeypoints } = layerSequenceData(layer)

      const layerImageTexture = loadedImageTextures[layer.id] || null

      const usesCustomImage = layer.textureSource === 'image' && !!layerImageTexture

      const texture = pickTexture(layer, layerImageTexture)

      const material = createPlaneMaterial(layer, texture, usesCustomImage)

      const count = clamp(Math.round(layer.rate / 2), 8, 20)

      const baseWidth = particleBaseSize(layer, sizeKeypoints)

      const baseHeight = particleBaseHeight(layer, sizeKeypoints)

      const referenceSize = Math.max(...sizeKeypoints.map((kp) => kp.value), 0.01)



      const emitDir = emissionDirectionVector(layer.emissionDirection || 'Top')

      const emitRadius = emissionShapeRadius(layer.emissionShape || 'Sphere', layer.shapeStyle || 'Volume')

      const spreadXRad = THREE.MathUtils.degToRad(layer.spread ?? 18)

      const spreadYRad = THREE.MathUtils.degToRad(layer.spreadAngleY ?? layer.spread ?? 18)

      const accel = layer.acceleration || { x: 0, y: 0, z: 0 }

      const timeScale = layer.timeScale ?? 1

      const rotMin = layer.rotation?.min ?? 0

      const rotMax = layer.rotation?.max ?? 0

      const rotSpeedMin = layer.rotSpeed?.min ?? 0

      const rotSpeedMax = layer.rotSpeed?.max ?? 0

      const orientation = layer.orientation || 'FacingCamera'



      for (let particleIndex = 0; particleIndex < count; particleIndex += 1) {

        const planeMaterial = material.clone()

        if (layerImageTexture) {

          planeMaterial.map = layerImageTexture

        }

        const plane = new THREE.Mesh(new THREE.PlaneGeometry(baseWidth, baseHeight), planeMaterial)



        const offset = randomInEmissionVolume(layer.emissionShape || 'Sphere', emitRadius)

        const base = offset.clone()

        const seed = particleIndex + index * 0.45

        const speed = clamp(

          (layer.speed.min + Math.random() * (layer.speed.max - layer.speed.min)) * 0.015,

          0.04,

          0.65

        )

        const spreadOffset = new THREE.Vector3(

          (Math.random() - 0.5) * Math.tan(spreadXRad),

          (Math.random() - 0.5) * Math.tan(spreadYRad),

          (Math.random() - 0.5) * Math.tan(spreadXRad)

        )

        const velocity = emitDir.clone().add(spreadOffset).normalize().multiplyScalar(speed)

        const initialRotation = THREE.MathUtils.degToRad(

          rotMin + Math.random() * (rotMax - rotMin || 0)

        )

        const rotationSpeed = THREE.MathUtils.degToRad(

          rotSpeedMin + Math.random() * (rotSpeedMax - rotSpeedMin || 0)

        )



        plane.position.copy(base)

        plane.userData.layerId = layer.id

        plane.userData.meta = {

          base,

          velocity,

          speed,

          pulse: 0.5 + particleIndex * 0.06,

          birthTime: seed * 0.17,

          lifetime: layer.lifetime?.max ?? 1,

          drag: layer.drag ?? 0.12,

          accel: new THREE.Vector3(accel.x ?? 0, accel.y ?? 0, accel.z ?? 0).multiplyScalar(0.0004),

          initialRotation,

          rotationSpeed,

          orientation,

          timeScale,

          colorKeypoints,

          sizeKeypoints,

          transparencyKeypoints,

          referenceSize

        }

        clickTargets.push(plane)

        effectRoot.add(plane)

        animated.push(plane)

      }

    }



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

        const meta = mesh.userData.meta

        const material = mesh.material

        const localTime = (time - meta.birthTime) * meta.timeScale

        const lifeT = (localTime % meta.lifetime) / meta.lifetime



        const dragFactor = Math.exp(-meta.drag * localTime * 2.5)

        const displacement = meta.velocity.clone().multiplyScalar(localTime * dragFactor)

        displacement.add(meta.accel.clone().multiplyScalar(localTime * localTime * 0.5))

        mesh.position.copy(meta.base).add(displacement)



        if (meta.orientation === 'FacingCameraWorldUp') {

          mesh.quaternion.copy(camera.quaternion)

          mesh.rotateZ(meta.initialRotation + meta.rotationSpeed * localTime)

        } else if (meta.orientation === 'VelocityParallel') {

          const vel = meta.velocity.clone().normalize()

          if (vel.lengthSq() > 0.0001) {

            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), vel)

          }

          mesh.rotateZ(meta.initialRotation + meta.rotationSpeed * localTime)

        } else if (meta.orientation === 'VelocityPerpendicular') {

          mesh.lookAt(mesh.position.clone().add(meta.velocity))

          mesh.rotateZ(Math.PI * 0.5 + meta.initialRotation + meta.rotationSpeed * localTime)

        } else {

          mesh.lookAt(camera.position)

          mesh.rotateZ(meta.initialRotation + meta.rotationSpeed * localTime)

        }



        const sizeValue = interpolateNumberAtTime(meta.sizeKeypoints, lifeT)

        const sizeScale = clamp(sizeValue / meta.referenceSize, 0.08, 2.5)

        const pulse = 0.92 + Math.sin(time * 2.1 + meta.pulse) * 0.08

        mesh.scale.setScalar(sizeScale * pulse)



        const tint = interpolateColorAtTime(meta.colorKeypoints, lifeT)

        material.color.set(tint)



        const transparency = interpolateNumberAtTime(meta.transparencyKeypoints, lifeT)

        const fadeOpacity = clamp(1 - transparency, 0.05, 1)

        const isActive = mesh.userData.layerId === activeLayerIdRef.current

        material.opacity = clamp((isActive ? 1 : 0.85) * fadeOpacity, 0.05, 1)

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

  }, [sceneKey])



  return (

    <div className="relative w-full h-[340px] rounded-2xl overflow-hidden border border-white/5">

      <div ref={mountRef} className="w-full h-full" />

      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-[#0a0c14]/80 border border-white/5 text-[10px] font-bold uppercase tracking-wider text-slate-400">

        Particle preview

      </div>

    </div>

  )

}


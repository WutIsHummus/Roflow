/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { loadClassicClothingTexture } from '../Playground/classicClothingTexture.js'
import {
  R15_RIG_URL,
  applyClothingTextureToRig,
  clearClothingOverlays,
  configureRigMaterials,
  focusRigPreview
} from '../../shared/r15ClothingOverlay.js'

export default function ClassicClothingPreview({ shirtDataUrl, pantsDataUrl }) {
  const mountRef = useRef(null)
  const stateRef = useRef({})
  const [rigReady, setRigReady] = useState(false)
  const [applied, setApplied] = useState({ shirt: false, pants: false })
  const [error, setError] = useState(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return undefined

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.05
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x090b10)
    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.01, 500)
    camera.position.set(0, 2.2, 5.7)

    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.target.set(0, 1.55, 0)
    orbit.enableDamping = true
    orbit.dampingFactor = 0.08

    scene.add(new THREE.GridHelper(10, 20, 0x2a2f3f, 0x1e2330))
    scene.add(new THREE.AmbientLight(0xffffff, 0.75))
    const key = new THREE.DirectionalLight(0xffffff, 1.25)
    key.position.set(4, 6, 4)
    key.castShadow = true
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x38bdf8, 0.35)
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
    function animate() {
      animId = requestAnimationFrame(animate)
      orbit.update()
      renderer.render(scene, camera)
    }
    animate()

    stateRef.current = {
      scene,
      camera,
      orbit,
      renderer,
      rigGroup,
      rigScene: null,
      clothingOverlays: []
    }

    const loader = new GLTFLoader()
    loader.load(
      R15_RIG_URL,
      (gltf) => {
        rigGroup.add(gltf.scene)
        configureRigMaterials(gltf.scene)
        stateRef.current.rigScene = gltf.scene
        focusRigPreview(stateRef.current)
        setRigReady(true)
        setError(null)
      },
      undefined,
      (err) => setError(`Failed to load R15 rig: ${err.message}`)
    )

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animId)
      clearClothingOverlays(stateRef.current)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    const s = stateRef.current
    if (!s.rigScene || !rigReady) return

    let cancelled = false
    setError(null)
    clearClothingOverlays(s)

    async function applyClothing() {
      const overlays = []

      if (shirtDataUrl) {
        const texture = await loadClassicClothingTexture(shirtDataUrl, 'shirt')
        if (cancelled) {
          texture.dispose()
          return
        }
        overlays.push(...applyClothingTextureToRig(s, texture, 'shirt', 1))
      }

      if (pantsDataUrl) {
        const texture = await loadClassicClothingTexture(pantsDataUrl, 'pants')
        if (cancelled) {
          texture.dispose()
          return
        }
        overlays.push(...applyClothingTextureToRig(s, texture, 'pants', 2))
      }

      s.clothingOverlays = overlays
      setApplied({ shirt: Boolean(shirtDataUrl), pants: Boolean(pantsDataUrl) })
      focusRigPreview(s)
    }

    applyClothing().catch((err) => {
      if (!cancelled) setError(err.message || 'Clothing preview failed.')
    })

    return () => {
      cancelled = true
    }
  }, [pantsDataUrl, rigReady, shirtDataUrl])

  return (
    <div className="relative h-[420px] overflow-hidden rounded-xl border border-white/[0.08] bg-[rgba(9,10,15,0.6)] shadow-inner">
      <div ref={mountRef} className="h-full w-full" />
      <div className="absolute top-3 left-3 flex flex-wrap gap-2 pointer-events-none">
        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-violet-500/10 border-violet-500/25 text-violet-300">
          R15 Preview
        </span>
        {applied.shirt && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-sky-500/10 border-sky-500/25 text-sky-300">
            Shirt
          </span>
        )}
        {applied.pants && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border bg-amber-500/10 border-amber-500/25 text-amber-300">
            Pants
          </span>
        )}
      </div>
      {!shirtDataUrl && !pantsDataUrl && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center pointer-events-none">
          <p className="text-xs text-slate-500 leading-relaxed font-medium max-w-sm">
            Generate or import shirt and pants textures to preview them on the bundled R15 rig.
          </p>
        </div>
      )}
      {error && (
        <div className="absolute left-3 right-3 bottom-3 flex justify-center pointer-events-none">
          <div className="max-w-[360px] rounded-lg border border-red-500/25 bg-red-950/40 px-3 py-2 text-[11px] leading-relaxed text-red-300">
            {error}
          </div>
        </div>
      )}
    </div>
  )
}

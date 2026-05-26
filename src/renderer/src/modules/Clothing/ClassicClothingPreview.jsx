/* eslint-disable react/prop-types */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  clearClassicClothingAvatar,
  createClassicClothingAvatar,
  createPlaceholderAvatar
} from './classicClothingRig'

export default function ClassicClothingPreview({ shirtDataUrl, pantsDataUrl }) {
  const mountRef = useRef(null)
  const stateRef = useRef({})
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
    scene.background = new THREE.Color(0x0d0f14)
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

    const avatar = createPlaceholderAvatar()
    scene.add(avatar)

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

    stateRef.current = { scene, camera, orbit, renderer, avatar }

    return () => {
      ro.disconnect()
      cancelAnimationFrame(animId)
      clearClassicClothingAvatar(stateRef.current.avatar)
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  useEffect(() => {
    const s = stateRef.current
    if (!s.scene) return

    let cancelled = false
    setError(null)

    Promise.all([
      loadTexture(shirtDataUrl).catch((err) => {
        throw new Error(`Shirt texture failed: ${err.message}`)
      }),
      loadTexture(pantsDataUrl).catch((err) => {
        throw new Error(`Pants texture failed: ${err.message}`)
      })
    ])
      .then(([shirtTexture, pantsTexture]) => {
        if (cancelled) return
        clearClassicClothingAvatar(s.avatar)
        s.avatar = createClassicClothingAvatar({ shirtTexture, pantsTexture })
        s.scene.add(s.avatar)
        setApplied({ shirt: Boolean(shirtTexture), pants: Boolean(pantsTexture) })
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })

    return () => {
      cancelled = true
    }
  }, [pantsDataUrl, shirtDataUrl])

  return (
    <div style={{ height: 420, position: 'relative', overflow: 'hidden', borderRadius: 10, border: '1px solid #252a36', background: '#0d0f14' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span style={badgeStyle('#4ade80')}>Blocky Roblox Preview</span>
        {applied.shirt && <span style={badgeStyle('#38bdf8')}>Shirt</span>}
        {applied.pants && <span style={badgeStyle('#f59e0b')}>Pants</span>}
      </div>
      {!shirtDataUrl && !pantsDataUrl && (
        <div style={emptyStateStyle}>
          Generate a shirt, pants, or full outfit texture to preview it on the Roblox character.
        </div>
      )}
      {error && (
        <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, display: 'flex', justifyContent: 'center' }}>
          <div style={{ maxWidth: 360, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: '9px 12px', color: '#fca5a5', fontSize: 11, lineHeight: 1.5 }}>
            {error}
          </div>
        </div>
      )}
    </div>
  )
}

function loadTexture(dataUrl) {
  if (!dataUrl) return Promise.resolve(null)
  return new Promise((resolve, reject) => {
    new THREE.TextureLoader().load(
      dataUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace
        texture.flipY = false
        texture.needsUpdate = true
        resolve(texture)
      },
      undefined,
      reject
    )
  })
}

function badgeStyle(color) {
  return {
    fontSize: 10,
    color,
    background: 'rgba(10,11,16,0.72)',
    border: '1px solid #1f2532',
    borderRadius: 999,
    padding: '4px 9px'
  }
}

const emptyStateStyle = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  textAlign: 'center',
  color: '#6b7280',
  fontSize: 12,
  pointerEvents: 'none'
}

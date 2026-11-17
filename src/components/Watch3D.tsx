import { useEffect, useRef, useState } from 'react'
import type * as Three from 'three'
import { asset } from '../lib/asset'
import { t } from '../lib/i18n'

interface Props {
  /** Public GLB path, e.g. "models/3d-watch.glb". */
  src: string
  label: string
}

/**
 * Product-photo studio baked into an environment map: grey walls, an overhead softbox,
 * tall strip lights left and right, a low front fill card, a back rim light and a white sweep below.
 * Polished steel mirrors these as the light/dark bands seen in watch photography.
 */
function studioScene(THREE: typeof Three): Three.Scene {
  const scene = new THREE.Scene()
  // Mid-grey walls: polished steel mirrors them, so near-black walls turn the case black.
  const walls = new THREE.MeshBasicMaterial({ side: THREE.BackSide })
  walls.color.setScalar(0.22)
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(30, 30, 30), walls))
  const panel = (w: number, h: number, intensity: number, x: number, y: number, z: number) => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })
    material.color.setScalar(intensity)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material)
    mesh.position.set(x, y, z)
    mesh.lookAt(0, 0, 0)
    scene.add(mesh)
  }
  panel(10, 10, 4, 0, 12, 0) // overhead softbox
  panel(2, 14, 8, -11, 2, 2) // left strip
  panel(2, 14, 6, 11, 2, -2) // right strip
  panel(14, 3, 2.5, 0, -2, 12) // front fill card
  panel(10, 3, 3, 0, 6, -12) // back rim
  panel(24, 24, 1.2, 0, -12, 0) // white sweep under the watch, as on a product table
  return scene
}

/** Replaces the exported glTF materials with physically based ones, by material name (scripts/watch3d/build_watch.py). */
function physical(THREE: typeof Three, source: Three.MeshStandardMaterial): Three.Material {
  const base = {
    name: source.name,
    // glTF doubleSided: the dial disc and lofted links rely on it; FrontSide culled the dial.
    side: source.side,
    color: source.color,
    map: source.map,
    normalMap: source.normalMap,
    normalScale: source.normalScale,
    metalness: source.metalness,
    roughness: source.roughness,
  }
  switch (source.name) {
    case 'SteelBrushed':
      // Streaks run along V in the build's UVs; anisotropy stretches highlights along them.
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 1, roughness: 0.34, anisotropy: 0.85, anisotropyRotation: Math.PI / 2 })
    case 'SteelPolished':
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 1, roughness: 0.08 })
    case 'Dial':
      // Sunburst lacquer: soft base under a glossy clear coat.
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 0.1, roughness: 0.4, clearcoat: 0.5, clearcoatRoughness: 0.12 })
    case 'Crystal':
      // Sapphire with anti-reflective coating: a dark, faint shell. A white or refractive crystal mirrored
      // the softbox over the dial (washed-out grey) or refracted the bracelet across it.
      return new THREE.MeshPhysicalMaterial({ name: source.name, side: source.side, color: 0x000000, metalness: 0, roughness: 0, transparent: true, opacity: 0.08, depthWrite: false })
    case 'HandFrame':
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 1, roughness: 0.18 })
    case 'Lume':
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 0, roughness: 0.6 })
    case 'GmtRed':
      return new THREE.MeshPhysicalMaterial({ ...base, metalness: 0, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.1 })
    default:
      return source
  }
}

/**
 * Rotatable, zoomable 3D view of a watch (three.js, loaded on demand so the catalog never pays for it).
 * Studio environment and physical materials; renders only on interaction or damping;
 * disposes the GPU state on unmount.
 */
export default function Watch3D({ src, label }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const el = host.current
    if (!el) return
    let disposed = false
    let cleanup = () => {}

    ;(async () => {
      const [THREE, { GLTFLoader }, { OrbitControls }, { MeshoptDecoder }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ])
      if (disposed) return

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.setClearColor(0xf5f5f3, 1) // --color-well, the page behind the viewer
      // Neutral keeps product colours (blue dial, steel) true; ACES shifts and desaturates them.
      renderer.toneMapping = THREE.NeutralToneMapping
      renderer.toneMappingExposure = 1
      renderer.outputColorSpace = THREE.SRGBColorSpace
      el.appendChild(renderer.domElement)
      renderer.domElement.style.touchAction = 'none'

      const scene = new THREE.Scene()
      const pmrem = new THREE.PMREMGenerator(renderer)
      const studio = studioScene(THREE)
      const envMap = pmrem.fromScene(studio, 0.03).texture
      scene.environment = envMap
      studio.traverse((o) => {
        const mesh = o as Three.Mesh
        if (!mesh.isMesh) return
        mesh.geometry.dispose()
        ;(mesh.material as Three.Material).dispose()
      })
      pmrem.dispose()

      const camera = new THREE.PerspectiveCamera(30, 1, 1, 2000)
      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controls.enablePan = false

      let frame = 0
      const render = () => {
        frame = 0
        if (controls.update()) request()
        renderer.render(scene, camera)
      }
      const request = () => {
        if (!frame) frame = requestAnimationFrame(render)
      }
      controls.addEventListener('change', request)

      const resize = () => {
        const w = el.clientWidth
        const h = el.clientHeight
        if (!w || !h) return
        renderer.setSize(w, h, false)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        request()
      }
      const observer = new ResizeObserver(resize)
      observer.observe(el)

      cleanup = () => {
        cancelAnimationFrame(frame)
        observer.disconnect()
        controls.dispose()
        scene.traverse((o) => {
          const mesh = o as Three.Mesh
          if (!mesh.isMesh) return
          mesh.geometry.dispose()
          for (const m of [mesh.material].flat() as Three.MeshPhysicalMaterial[]) {
            for (const tex of [m.map, m.normalMap, m.roughnessMap, m.metalnessMap]) tex?.dispose()
            m.dispose()
          }
        })
        envMap.dispose()
        renderer.dispose()
        renderer.domElement.remove()
      }

      const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
      try {
        const gltf = await loader.loadAsync(asset(src))
        if (disposed) return cleanup()
        const model = gltf.scene
        model.traverse((o) => {
          const mesh = o as Three.Mesh
          if (!mesh.isMesh) return
          const replaced = [mesh.material].flat().map((m) => {
            const next = physical(THREE, m as Three.MeshStandardMaterial)
            if (next !== m) m.dispose()
            return next
          })
          mesh.material = Array.isArray(mesh.material) ? replaced : replaced[0]
          // The crystal draws after the dial and never hides it in the depth buffer.
          if (replaced.some((m) => m.name === 'Crystal')) mesh.renderOrder = 1
        })
        // Frame the watch head: centre on the case, distance from the whole bounding sphere.
        const box = new THREE.Box3().setFromObject(model)
        const sphere = box.getBoundingSphere(new THREE.Sphere())
        const caseObj = model.getObjectByName('Case')
        const centre = caseObj ? new THREE.Box3().setFromObject(caseObj).getCenter(new THREE.Vector3()) : sphere.center
        model.position.sub(centre)
        scene.add(model)
        const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.8
        // Model is Y-up with the dial facing +Y after glTF export: look down at the dial, slightly tilted.
        camera.position.set(0, dist * 0.9, dist * 0.45)
        controls.target.set(0, 0, 0)
        controls.minDistance = sphere.radius * 0.6
        controls.maxDistance = dist * 1.6
        resize()
        setState('ready')
      } catch {
        if (!disposed) setState('error')
      }
    })().catch(() => {
      if (!disposed) setState('error')
    })

    return () => {
      disposed = true
      cleanup()
    }
  }, [src])

  return (
    <div className="relative aspect-square w-full bg-well">
      <div ref={host} role="img" aria-label={`${label} – ${t('modello 3D, trascina per ruotare, scorri per ingrandire')}`} className="absolute inset-0 [&>canvas]:h-full [&>canvas]:w-full" />
      {state !== 'ready' && (
        <p className="absolute inset-0 flex items-center justify-center text-small text-muted">
          {state === 'loading' ? t('Caricamento del modello 3D…') : t('Il modello 3D non è disponibile su questo dispositivo.')}
        </p>
      )}
      {state === 'ready' && <p className="pointer-events-none absolute inset-x-0 top-3 text-center text-small text-muted">{t('Trascina per ruotare · scorri o pizzica per ingrandire')}</p>}
    </div>
  )
}

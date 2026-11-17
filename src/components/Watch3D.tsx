import { useEffect, useRef, useState } from 'react'
import type { Mesh, MeshStandardMaterial } from 'three'
import { asset } from '../lib/asset'
import { t } from '../lib/i18n'

interface Props {
  /** Public GLB path, e.g. "models/3d-watch.glb". */
  src: string
  label: string
}

/**
 * Rotatable, zoomable 3D view of a watch (three.js, loaded on demand so the catalog never pays for it).
 * Renders only while visible and only on interaction or damping; disposes the GPU state on unmount.
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
      const [THREE, { GLTFLoader }, { OrbitControls }, { RoomEnvironment }, { MeshoptDecoder }] = await Promise.all([
        import('three'),
        import('three/examples/jsm/loaders/GLTFLoader.js'),
        import('three/examples/jsm/controls/OrbitControls.js'),
        import('three/examples/jsm/environments/RoomEnvironment.js'),
        import('three/examples/jsm/libs/meshopt_decoder.module.js'),
      ])
      if (disposed) return

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      // The room environment is bright and even; lower exposure keeps dark reflections in the steel.
      renderer.toneMappingExposure = 0.8
      renderer.outputColorSpace = THREE.SRGBColorSpace
      el.appendChild(renderer.domElement)
      renderer.domElement.style.touchAction = 'none'

      const scene = new THREE.Scene()
      const pmrem = new THREE.PMREMGenerator(renderer)
      const room = new RoomEnvironment()
      const envMap = pmrem.fromScene(room, 0.04).texture
      scene.environment = envMap
      scene.environmentIntensity = 0.7
      room.dispose()
      pmrem.dispose()
      const key = new THREE.DirectionalLight(0xffffff, 1.0)
      key.position.set(1, 2, 3)
      scene.add(key)

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
          const mesh = o as Mesh
          if (!mesh.isMesh) return
          mesh.geometry.dispose()
          for (const m of [mesh.material].flat() as MeshStandardMaterial[]) {
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
        // Frame the watch head: centre on the case, distance from the whole bounding sphere.
        const box = new THREE.Box3().setFromObject(model)
        const sphere = box.getBoundingSphere(new THREE.Sphere())
        const caseObj = model.getObjectByName('Case')
        const centre = caseObj ? new THREE.Box3().setFromObject(caseObj).getCenter(new THREE.Vector3()) : sphere.center
        model.position.sub(centre)
        scene.add(model)
        const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 0.8
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

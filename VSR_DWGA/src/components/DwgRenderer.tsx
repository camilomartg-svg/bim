import React, { useEffect, useRef, useState, useCallback } from 'react'
import type { Calibration, Tool, DimensionItem, AreaItem, SnapSettings } from '../types'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js'
import { DXFLoader } from 'three-dxf-loader'
import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web'

import { useLayers } from '../hooks/useLayers'

interface Props {
  file: File | null
  tool: Tool
  showGrid: boolean
  showZoomSlider?: boolean
  calibration: Calibration | null
  onCalibrationComplete: (c: Calibration) => void
  snapSettings: SnapSettings
  isDarkMode: boolean
}

const DwgRenderer: React.FC<Props> = ({
  file, tool, showGrid, showZoomSlider = false, calibration, onCalibrationComplete, snapSettings, isDarkMode
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsTargetRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null)
  const [scene] = useState(() => new THREE.Scene())
  const [camera] = useState(() => new THREE.OrthographicCamera(-50, 50, 50, -50, -1000000, 1000000))
  const [controls, setControls] = useState<OrbitControls | null>(null)
  const [entityRoot, setEntityRoot] = useState<THREE.Object3D | null>(null)
  const [points, setPoints] = useState<THREE.Vector3[]>([])
  const [snap, setSnap] = useState<{ type: 'endpoint' | 'midpoint', pos: THREE.Vector3 } | null>(null)
  const [snapCandidates, setSnapCandidates] = useState<{pos: THREE.Vector3, type: 'endpoint' | 'midpoint'}[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [loadingText, setLoadingText] = useState<string>('')
  const loadTimeoutRef = useRef<number | null>(null)
  const [dimensions, setDimensions] = useState<DimensionItem[]>([])
  const [polyPoints, setPolyPoints] = useState<THREE.Vector3[]>([])
  const [areas, setAreas] = useState<AreaItem[]>([])
  const [debugStats, setDebugStats] = useState<string>('')
  const [zoomLevel, setZoomLevel] = useState<number>(1)
  const [, setCamVersion] = useState<number>(0)
  
  const { layers, layerVisibility, toggleLayer, showAll, hideAll } = useLayers(entityRoot, file)
  
  const [showLayers, setShowLayers] = useState(false)
  const [layerSearch, setLayerSearch] = useState('')
  const [activeLayout, setActiveLayout] = useState<string>('Modelo')
  const [availableLayouts, setAvailableLayouts] = useState<string[]>(['Modelo'])

  useEffect(() => {
    const handleToggleLayers = () => {
      setShowLayers(prev => !prev)
    }
    window.addEventListener('toggle-dwg-layers', handleToggleLayers)
    return () => {
      window.removeEventListener('toggle-dwg-layers', handleToggleLayers)
    }
  }, [])

  const isObjectEffectivelyVisible = (obj: THREE.Object3D) => {
    let curr: THREE.Object3D | null = obj
    while (curr) {
      if (!curr.visible) return false
      curr = curr.parent
    }
    return true
  }

  const fitToVisible = useCallback(() => {
    if (!entityRoot || !camera || !controls || !renderer) return
    entityRoot.updateMatrixWorld(true)
    const box = new THREE.Box3()
    entityRoot.traverse((obj: any) => {
      if (
        (obj.isMesh || obj.isLine || obj.isLineSegments || obj.isLineLoop || obj.isPoints) &&
        !obj.userData?.isViewportContent &&
        isObjectEffectivelyVisible(obj)
      ) {
        box.expandByObject(obj)
      }
    })

    let center = new THREE.Vector3(0, 0, 0)
    let viewSize = 100

    if (!box.isEmpty()) {
      center = box.getCenter(new THREE.Vector3())
      const size = box.getSize(new THREE.Vector3())
      const maxSize = Math.max(size.x, size.y)
      viewSize = Math.max(1, maxSize * 1.15)
    }

    const w = renderer.domElement.clientWidth || 800
    const h = renderer.domElement.clientHeight || 600
    const aspect = w / h
    const halfH = viewSize / 2
    const halfW = halfH * aspect

    camera.left = -halfW
    camera.right = halfW
    camera.top = halfH
    camera.bottom = -halfH
    camera.position.set(center.x, center.y, 100)
    camera.zoom = 1
    if (controls.object instanceof THREE.OrthographicCamera) {
      controls.object.zoom = 1
    }
    setZoomLevel(1)
    camera.updateProjectionMatrix()
    controls.target.set(center.x, center.y, 0)
    controls.update()
  }, [entityRoot, camera, controls, renderer])

  const handleLayoutChange = (layoutName: string) => {
    setActiveLayout(layoutName)
    if (!entityRoot) return

    let hasLayoutGroups = false
    entityRoot.children.forEach((child: any) => {
      if (child.userData?.isLayoutGroup) {
        hasLayoutGroups = true
        child.visible = (child.userData.layoutName === layoutName)
      }
    })

    if (!hasLayoutGroups) {
      entityRoot.traverse((obj: any) => {
        if (obj.isMesh || obj.isLine || obj.isLineSegments || obj.isLineLoop || obj.isPoints) {
          const isPaper = Boolean(obj.userData?.inPaperSpace)
          const objLayout = obj.userData?.layout || 'Modelo'

          let match = false
          if (layoutName === 'Modelo') {
            match = (objLayout === 'Modelo' && !isPaper)
          } else {
            match = (objLayout === layoutName || (isPaper && objLayout === 'Layout1' && layoutName === 'Layout1'))
          }

          obj.userData.layoutVisible = match
          const layerId = obj.userData?.layerId
          const layerOk = !layerId || layerVisibility[layerId] !== false
          obj.visible = match && layerOk
        }
      })
    }

    setTimeout(() => {
      extractSnapPoints(entityRoot)
      fitToVisible()
    }, 40)
  }

  const extractSnapPoints = (root: THREE.Object3D) => {
    root.updateMatrixWorld(true)
    const candidates: {pos: THREE.Vector3, type: 'endpoint' | 'midpoint'}[] = []
    const stats: Record<string, number> = {}
     let loggedDebug = false

     root.traverse((obj) => {
      if (obj.userData?.isPaperSheet || !isObjectEffectivelyVisible(obj)) return
      stats[obj.type] = (stats[obj.type] || 0) + 1
      
      const processGeometry = (geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, isLine: boolean) => {
          const pos = geometry.attributes.position
          const index = geometry.index
          
          if (!pos) {
            if (!loggedDebug) console.warn('Geometry has no position attribute:', obj)
            return
          }

          const isLineSeg = (obj as any).isLineSegments
          
          if (!loggedDebug && isLine && isLineSeg) {
            console.log('DEBUG LineSegments:', {
              posCount: pos.count,
              indexCount: index ? index.count : 'no index',
              uuid: obj.uuid,
              posArray: pos.array ? pos.array.length : 'no array'
            })
            // Log first few points to see if they are valid
            if (pos.count > 0) {
              console.log('First point:', pos.getX(0), pos.getY(0), pos.getZ(0))
            }
            loggedDebug = true
          }

          const getPoint = (i: number) => {
            return new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(matrix)
          }
          
          const add = (p: THREE.Vector3, type: 'endpoint' | 'midpoint') => {
             // Force Z to 0 for 2D snapping
             p.z = 0
             candidates.push({ pos: p, type })
          }

          if (isLine) {
             // Existing Line Logic
             if (isLineSeg) {
                const count = index ? index.count : pos.count
                for (let i = 0; i < count; i += 2) {
                  const idx1 = index ? index.getX(i) : i
                  const idx2 = index ? index.getX(i+1) : i+1
                  if (idx1 < pos.count && idx2 < pos.count) {
                    const p1 = getPoint(idx1)
                    const p2 = getPoint(idx2)
                    add(p1, 'endpoint')
                    add(p2, 'endpoint')
                    add(p1.clone().add(p2).multiplyScalar(0.5), 'midpoint')
                  }
                }
             } else {
                // Line Strip / Loop
                const count = index ? index.count : pos.count
                // For LineLoop, we should close the loop, but for now treat as strip
                const isLoop = (obj as any).isLineLoop
                const segments = isLoop ? count : count - 1
                
                for (let i = 0; i < segments; i++) {
                  const idx1 = index ? index.getX(i) : i
                  const idx2 = index ? index.getX((i+1) % count) : (i+1)
                  
                  if (idx1 < pos.count && idx2 < pos.count) {
                    const p1 = getPoint(idx1)
                    const p2 = getPoint(idx2)
                    add(p1, 'endpoint')
                    add(p2, 'endpoint')
                    add(p1.clone().add(p2).multiplyScalar(0.5), 'midpoint')
                  }
                }
             }
          } else {
             // Mesh Logic (Vertices as endpoints)
             // Only add vertices as endpoints, no midpoints for now to avoid noise
             for (let i = 0; i < pos.count; i++) {
               add(getPoint(i), 'endpoint')
             }
          }
      }

      // Check using boolean flags to support multiple Three.js instances
      const isLine = (obj as any).isLine || (obj as any).isLineSegments || (obj as any).isLineLoop
      const isMesh = (obj as any).isMesh

      if (isLine) {
         if ((obj as any).geometry) processGeometry((obj as any).geometry, obj.matrixWorld, true)
      } else if (isMesh) {
         if ((obj as any).geometry) processGeometry((obj as any).geometry, obj.matrixWorld, false)
      }
    })
    
    // console.log(`Extracted ${candidates.length} snap points`)
    console.log(`Snap Candidates Extracted: ${candidates.length}`, candidates.slice(0, 5))
    console.log('Scene Objects:', stats)
    setDebugStats(JSON.stringify(stats).replace(/[{"}]/g, '').replace(/,/g, ', '))
    setSnapCandidates(candidates)
  }

  const fitToView = () => {
    fitToVisible()
  }

  useEffect(() => {
    if (entityRoot) {
      console.log('EntityRoot changed, extracting snap points...')
      extractSnapPoints(entityRoot)
      
      // Auto-Fit on load
      // Use setTimeout to ensure renderer/controls are ready and layout is computed
      setTimeout(() => {
         fitToVisible()
      }, 100)
    }
  }, [entityRoot, fitToVisible])

  useEffect(() => {
    if (renderer) {
      if (activeLayout !== 'Modelo') {
        renderer.setClearColor(0x525659, 1)
      } else {
        renderer.setClearColor(0x181718, 1)
      }
    }
  }, [isDarkMode, renderer, activeLayout])

  useEffect(() => {
    if (!containerRef.current || !renderer) return

    const resizeObserver = new ResizeObserver(() => {
      const w = containerRef.current?.clientWidth || 800
      const h = containerRef.current?.clientHeight || 600
      renderer.setSize(w, h)
      
      const aspect = w / h
      const frustumHeight = camera.top - camera.bottom
      const frustumWidth = frustumHeight * aspect
      
      const cy = (camera.top + camera.bottom) / 2
      const cx = (camera.left + camera.right) / 2
      
      camera.left = cx - frustumWidth / 2
      camera.right = cx + frustumWidth / 2
      camera.top = cy + frustumHeight / 2
      camera.bottom = cy - frustumHeight / 2
      
      camera.updateProjectionMatrix()
    })

    resizeObserver.observe(containerRef.current)
    return () => resizeObserver.disconnect()
  }, [renderer, camera])

  useEffect(() => {
    if (!canvasRef.current || renderer) return
    const r = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true })
    r.localClippingEnabled = true
    r.setPixelRatio(window.devicePixelRatio)
    r.setSize(containerRef.current?.clientWidth || 800, containerRef.current?.clientHeight || 600)
    // Always init with Dark BG (0x181718)
    r.setClearColor(0x181718, 1)
    setRenderer(r)

    camera.position.set(0, 0, 10)
    camera.zoom = 1
    camera.updateProjectionMatrix()

    const ambient = new THREE.AmbientLight(0xffffff, 1.0)
    scene.add(ambient)

    const ctrls = new OrbitControls(camera, controlsTargetRef.current!)
    setControls(ctrls)

    const animate = () => {
      ctrls.update()
      r.render(scene, camera)
      requestAnimationFrame(animate)
    }
    animate()

    const onResize = () => {
      const w = containerRef.current?.clientWidth || 800
      const h = containerRef.current?.clientHeight || 600
      r.setSize(w, h)
      
      // Update camera frustum maintaining current scale
      const aspect = w / h
      const frustumHeight = camera.top - camera.bottom
      const frustumWidth = frustumHeight * aspect
      
      const cy = (camera.top + camera.bottom) / 2
      const cx = (camera.left + camera.right) / 2
      
      camera.left = cx - frustumWidth / 2
      camera.right = cx + frustumWidth / 2
      camera.top = cy + frustumHeight / 2
      camera.bottom = cy - frustumHeight / 2
      
      camera.updateProjectionMatrix()
    }
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      ctrls.dispose()
      r.dispose()
    }
  }, []) // Empty dependency array to run only once on mount

  // Update controls configuration
  useEffect(() => {
    if (!controls) return
    controls.enabled = true
    controls.enableRotate = false
    controls.enableZoom = false // Disable built-in zoom to handle manually
    controls.screenSpacePanning = true
    controls.zoomSpeed = 0.025
    controls.panSpeed = 1.0
    controls.minZoom = 0.1
    controls.maxZoom = 10
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    // Strictly lock camera to 2D view (top-down)
    controls.minPolarAngle = Math.PI / 2
    controls.maxPolarAngle = Math.PI / 2
    controls.minAzimuthAngle = 0
    controls.maxAzimuthAngle = 0
    
    // Listen to zoom and pan changes
    const onChange = () => {
      if (controls.object instanceof THREE.OrthographicCamera) {
        setZoomLevel(controls.object.zoom)
      }
      setCamVersion(v => (v + 1) % 1000000)
    }
    controls.addEventListener('change', onChange)

    // Update mouse buttons based on tool
    if (tool === 'hand') {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.PAN,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      }
    } else {
      controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE, // Disabled via enableRotate=false
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
      }
    }
    
    controls.update()
    
    return () => {
      controls.removeEventListener('change', onChange)
    }
  }, [controls, tool])

  const touchStateRef = useRef<{
    mode: 'pan' | 'pinch' | 'none';
    startX: number;
    startY: number;
    startCamX: number;
    startCamY: number;
    startTargetX: number;
    startTargetY: number;
    initialDist: number;
    initialZoom: number;
  } | null>(null)

  useEffect(() => {
    const container = controlsTargetRef.current
    if (!container || !camera || !controls || !renderer) return

    const getScreenToWorldUnits = () => {
      const rect = container.getBoundingClientRect()
      if (!rect.height) return 1
      const visibleHeight = (camera.top - camera.bottom) / camera.zoom
      return visibleHeight / rect.height
    }

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        const touch = e.touches[0]
        touchStateRef.current = {
          mode: 'pan',
          startX: touch.clientX,
          startY: touch.clientY,
          startCamX: camera.position.x,
          startCamY: camera.position.y,
          startTargetX: controls.target.x,
          startTargetY: controls.target.y,
          initialDist: 0,
          initialZoom: camera.zoom,
        }
      } else if (e.touches.length === 2) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        const centerX = (t1.clientX + t2.clientX) / 2
        const centerY = (t1.clientY + t2.clientY) / 2

        touchStateRef.current = {
          mode: 'pinch',
          startX: centerX,
          startY: centerY,
          startCamX: camera.position.x,
          startCamY: camera.position.y,
          startTargetX: controls.target.x,
          startTargetY: controls.target.y,
          initialDist: dist,
          initialZoom: camera.zoom,
        }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStateRef.current) return

      if (e.touches.length === 1 && touchStateRef.current.mode === 'pan') {
        e.preventDefault()
        const touch = e.touches[0]
        const dx = touch.clientX - touchStateRef.current.startX
        const dy = touch.clientY - touchStateRef.current.startY
        const unitsPerPixel = getScreenToWorldUnits()

        const worldDx = -dx * unitsPerPixel
        const worldDy = dy * unitsPerPixel

        camera.position.x = touchStateRef.current.startCamX + worldDx
        camera.position.y = touchStateRef.current.startCamY + worldDy
        controls.target.x = touchStateRef.current.startTargetX + worldDx
        controls.target.y = touchStateRef.current.startTargetY + worldDy
        controls.update()
      } else if (e.touches.length === 2) {
        e.preventDefault()
        const t1 = e.touches[0]
        const t2 = e.touches[1]
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)
        const currentCenterX = (t1.clientX + t2.clientX) / 2
        const currentCenterY = (t1.clientY + t2.clientY) / 2

        if (touchStateRef.current.mode !== 'pinch') {
          touchStateRef.current = {
            mode: 'pinch',
            startX: currentCenterX,
            startY: currentCenterY,
            startCamX: camera.position.x,
            startCamY: camera.position.y,
            startTargetX: controls.target.x,
            startTargetY: controls.target.y,
            initialDist: currentDist,
            initialZoom: camera.zoom,
          }
          return
        }

        const { initialDist, initialZoom } = touchStateRef.current
        if (initialDist <= 0) return

        const ratio = currentDist / initialDist
        let newZoom = initialZoom * ratio
        if (newZoom < 0.1) newZoom = 0.1
        if (newZoom > 10) newZoom = 10

        camera.zoom = newZoom
        camera.updateProjectionMatrix()
        setZoomLevel(newZoom)

        const dx = currentCenterX - touchStateRef.current.startX
        const dy = currentCenterY - touchStateRef.current.startY
        const unitsPerPixel = (camera.top - camera.bottom) / (newZoom * container.getBoundingClientRect().height)

        const worldDx = -dx * unitsPerPixel
        const worldDy = dy * unitsPerPixel

        camera.position.x = touchStateRef.current.startCamX + worldDx
        camera.position.y = touchStateRef.current.startCamY + worldDy
        controls.target.x = touchStateRef.current.startTargetX + worldDx
        controls.target.y = touchStateRef.current.startTargetY + worldDy
        controls.update()
      }
      setCamVersion(v => (v + 1) % 1000000)
    }

    const handleTouchEnd = () => {
      touchStateRef.current = null
    }

    container.addEventListener('touchstart', handleTouchStart, { passive: false })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: false })
    container.addEventListener('touchcancel', handleTouchEnd, { passive: false })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
      container.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [camera, controls, renderer, file])

  useEffect(() => {
    if (!renderer || !entityRoot) return

    const ensureContrast = (obj: any) => {
      if (!obj.material || obj.userData?.inPaperLayout || obj.userData?.isPaperSheet) return
      let p = obj.parent
      while (p) {
        if (p.userData?.inPaperLayout || p.userData?.isPaperSheet) return
        p = p.parent
      }

      const updateMat = (m: any) => {
        if (m.color) {
          const hex = m.color.getHex()
          const hsl = { h: 0, s: 0, l: 0 }
          m.color.getHSL(hsl)
          
          // Since we are ALWAYS rendering on a DARK background (before inversion),
          // we only need to ensure visibility against DARK.
          
          // 1. Black lines (0x000000) must be White (0xffffff)
          // (So when inverted in Light Mode, they become Black again)
          if (hex === 0x000000) {
            m.color.setHex(0xffffff)
          } 
          // 2. Very dark colors must be lightened
          else if (hsl.l < 0.35) {
            m.color.setHSL(hsl.h, hsl.s, 0.6)
          }
           
          m.needsUpdate = true
        }
      }

      if (Array.isArray(obj.material)) {
        obj.material.forEach(updateMat)
      } else {
        updateMat(obj.material)
      }
    }

    if (activeLayout !== 'Modelo') {
      renderer.domElement.style.filter = ''
      return
    }

    // Apply filter only for Light Mode in Model Space
    if (!isDarkMode) {
      renderer.domElement.style.filter = 'invert(1) hue-rotate(180deg) brightness(1.1) contrast(1.25)'
      entityRoot.traverse(ensureContrast)
    } else {
      renderer.domElement.style.filter = ''
      entityRoot.traverse(ensureContrast)
    }
  }, [renderer, entityRoot, isDarkMode, activeLayout])

  useEffect(() => {
    if (!renderer || !showGrid) return

    let size = 2000
    let divisions = 20
    let center = new THREE.Vector3(0, 0, 0)

    if (entityRoot) {
      const box = new THREE.Box3().setFromObject(entityRoot)
      if (!box.isEmpty()) {
        const boxCenter = box.getCenter(new THREE.Vector3())
        const boxSize = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(boxSize.x, boxSize.y)
        
        // Make grid large enough to cover everything plus margin
        size = Math.max(2000, maxDim * 5)
        center.copy(boxCenter)
        
        // Calculate divisions for reasonable density
        // Aim for lines every ~50-100 units or so depending on scale
        // magnitude = 10^floor(log10(maxDim))
        const magnitude = Math.pow(10, Math.floor(Math.log10(maxDim || 1)))
        // spacing e.g. magnitude / 2
        const spacing = magnitude / 2 || 10
        divisions = Math.max(10, Math.floor(size / spacing))
      }
    }

    const gh = new THREE.GridHelper(size, divisions, 0x334155, 0x1e293b)
    gh.rotation.x = Math.PI / 2
    gh.position.copy(center)
    // slightly behind to not z-fight with lines at z=0?
    // Actually lines are at z=0. If grid is at z=0, z-fighting occurs.
    // Move grid to z=-1
    gh.position.z = -0.5
    
    ;(gh.material as THREE.LineBasicMaterial).opacity = 0.25
    ;(gh.material as THREE.LineBasicMaterial).transparent = true
    scene.add(gh)

    return () => {
      scene.remove(gh)
      gh.geometry.dispose()
      if (Array.isArray(gh.material)) {
        gh.material.forEach(m => m.dispose())
      } else {
        gh.material.dispose()
      }
    }
  }, [showGrid, entityRoot, scene, renderer])

  useEffect(() => {
    if (!file || !renderer) return
    setLoading(true)
    setErrorMsg(null)
    setPoints([])
    if (entityRoot) {
      scene.remove(entityRoot)
      setEntityRoot(null)
      setSnapCandidates([])
    }

    const run = async () => {
      const maxSizeBytes = 20 * 1024 * 1024
      if (file.size > maxSizeBytes) {
        setLoading(false)
        setErrorMsg('Archivo demasiado grande (>20MB). Usa un DXF más liviano o divide el plano.')
        return
      }
      if (file.name.toLowerCase().endsWith('.dwg')) {
        setLoadingText('Cargando DWG')
        try {
          const libPath = (import.meta as any).env?.BASE_URL
            ? (import.meta as any).env.BASE_URL + 'libredwg/'
            : './libredwg/'
          await Promise.race([
            (async () => {
              const lib = await LibreDwg.create(libPath)
              const buf = await file.arrayBuffer()
              const dwg = lib.dwg_read_data(buf as ArrayBuffer, Dwg_File_Type.DWG) as any
              const db: any = lib.convert(dwg as number)
              console.log('DWG Database:', Object.keys(db || {}), db)
              
              const root = new THREE.Group()
              const material = new THREE.LineBasicMaterial({ color: 0xffffff })
              
              // Helper to create line from points
              const createLine = (pts: THREE.Vector3[], closed: boolean, container: THREE.Object3D) => {
                if (pts.length < 2) return
                if (closed) pts.push(pts[0])
                const geo = new THREE.BufferGeometry().setFromPoints(pts)
                container.add(new THREE.Line(geo, material))
              }

              // Function to parse entities into a container
              const parseEntities = (entities: any, container: THREE.Object3D) => {
                if (!entities) return

                // LINES
                ;((entities.lines || []) as any[]).forEach((ln: any) => {
                   createLine([
                     new THREE.Vector3(ln.start.x, ln.start.y, 0),
                     new THREE.Vector3(ln.end.x, ln.end.y, 0)
                   ], false, container)
                })
                
                // LWPOLYLINES
                ;((entities.lwpolylines || []) as any[]).forEach((pl: any) => {
                  if (!pl.vertices) return
                  const pts = pl.vertices.map((v: any) => new THREE.Vector3(v.x, v.y, 0))
                  createLine(pts, pl.flag === 1 || pl.closed === true, container)
                })
  
                // POLYLINES
                ;((entities.polylines || []) as any[]).forEach((pl: any) => {
                  if (!pl.vertices) return
                  const pts = pl.vertices.map((v: any) => new THREE.Vector3(v.x, v.y, 0))
                  createLine(pts, pl.flag === 1 || pl.closed === true, container)
                })
  
                // ARCS
                ;((entities.arcs || []) as any[]).forEach((arc: any) => {
                  const segs = 64
                  const curve = new THREE.EllipseCurve(
                    arc.center.x, arc.center.y,
                    arc.radius, arc.radius,
                    arc.startAngle, arc.endAngle, false, 0
                  )
                  const pts = curve.getPoints(segs).map(p => new THREE.Vector3(p.x, p.y, 0))
                  const geo = new THREE.BufferGeometry().setFromPoints(pts)
                  container.add(new THREE.Line(geo, material))
                })

                // CIRCLES
                ;((entities.circles || []) as any[]).forEach((c: any) => {
                  const segs = 64
                  const curve = new THREE.EllipseCurve(
                    c.center.x, c.center.y,
                    c.radius, c.radius, 0, Math.PI * 2, false, 0
                  )
                  const pts = curve.getPoints(segs).map(p => new THREE.Vector3(p.x, p.y, 0))
                  const geo = new THREE.BufferGeometry().setFromPoints(pts)
                  container.add(new THREE.Line(geo, material))
                })
                
                // INSERTS (Block References)
                ;((entities.inserts || []) as any[]).forEach((ins: any) => {
                  // Find block definition
                  const blockName = ins.name
                  if (!db.blocks || !db.blocks[blockName]) return
                  
                  const blockDef = db.blocks[blockName]
                  const blockGroup = new THREE.Group()
                  
                  // Apply Insert Transformations
                  blockGroup.position.set(ins.insertion_point.x, ins.insertion_point.y, 0)
                  if (ins.scale) {
                    blockGroup.scale.set(ins.scale.x, ins.scale.y, ins.scale.z || 1)
                  }
                  if (ins.rotation) {
                    blockGroup.rotation.z = ins.rotation * (Math.PI / 180) // Assuming degrees in JSON
                  }
                  
                  // Recursive parse
                  parseEntities(blockDef, blockGroup)
                  
                  container.add(blockGroup)
                })
              }

              // Parse Root Entities
              parseEntities(db, root)

              scene.add(root)
              setEntityRoot(root)
              // Extract snap points immediately after creating the root
              // We need to update matrix world to get correct coordinates if root had transforms (it doesn't, but safe)
              root.updateMatrixWorld(true)
              extractSnapPoints(root)

              const box = new THREE.Box3().setFromObject(root)
              const center = box.getCenter(new THREE.Vector3())
              const size = box.getSize(new THREE.Vector3())
              const maxSize = Math.max(size.x, size.y)
              const viewSize = maxSize * 0.6
              const w = renderer.domElement.clientWidth
              const h = renderer.domElement.clientHeight
              const aspect = w / h
              camera.left = -viewSize * aspect
              camera.right = viewSize * aspect
              camera.top = viewSize
              camera.bottom = -viewSize
              camera.position.set(center.x, center.y, 10)
              camera.zoom = 1
              camera.updateProjectionMatrix()
              controls?.target.set(center.x, center.y, 0)
              controls?.update()
            })(),
            new Promise((_, reject) => {
              loadTimeoutRef.current = window.setTimeout(() => reject(new Error('DWG_TIMEOUT')), 20000)
            })
          ])
        } catch (e) {
          const msg = (e as Error)?.message === 'DWG_TIMEOUT'
            ? 'Tiempo de carga excedido. Verifica que el DWG sea válido.'
            : 'Error al procesar DWG en navegador. Prueba otro archivo.'
          setErrorMsg(msg)
        } finally {
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current)
            loadTimeoutRef.current = null
          }
          setLoading(false)
        }
        return
      }

    const url = URL.createObjectURL(file)
    setLoadingText('Cargando DXF')
    
    const fontUrl = (import.meta as any).env?.BASE_URL
      ? (import.meta as any).env.BASE_URL + 'fonts/helvetiker_regular.typeface.json'
      : './fonts/helvetiker_regular.typeface.json'

    let parsedDxfData: any = null
    let rawDxfText = ''
    let normalizedDxfText = ''
    try {
      rawDxfText = await file.text()
      normalizedDxfText = rawDxfText.replace(/\\U\+([0-9A-Fa-f]{4})/gi, (_, hex) => {
        const code = parseInt(hex, 16)
        if (code === 0x202f || code === 0x00a0) return ' '
        return String.fromCharCode(code)
      })
      const DxfParserModule = await import('dxf-parser')
      const DxfParserClass = (DxfParserModule as any).default || DxfParserModule
      parsedDxfData = new DxfParserClass().parseSync(normalizedDxfText)
    } catch (pe) {
      console.warn('dxf-parser parseSync notice:', pe)
    }

    const normalizedFile =
      normalizedDxfText && normalizedDxfText !== rawDxfText
        ? new File([normalizedDxfText], file.name, { type: file.type || 'application/dxf' })
        : file

    interface RawBlockImage {
      blockName: string
      x: number
      y: number
      uX: number
      uY: number
      vX: number
      vY: number
      wPx: number
      hPx: number
      imageDefHandle: string
      layer: string
    }

    interface RawDxfEntity {
      type: string
      handle: string
      owner: string
      space: number
      layer: string
      name: string
      id: number
      status: number
      centerX: number
      centerY: number
      width: number
      height: number
      viewCenterX: number
      viewCenterY: number
      targetX: number
      targetY: number
      viewDirX: number
      viewDirY: number
      viewDirZ: number
      viewHeight: number
      twistAngle: number
    }

    const parseDxfStructure = (dxfText: string) => {
      const lines = dxfText.split(/\r?\n/)
      const layoutsByHandle: Record<string, { name: string, order: number, handle: string }> = {}
      const blockRecordToLayout: Record<string, string> = {}
      const layouts: { name: string, order: number, handle: string }[] = []
      const imageDefsByHandle: Record<string, string> = {}
      const blockImagesByBlockName: Record<string, RawBlockImage[]> = {}
      const entitiesByHandle: Record<string, RawDxfEntity> = {}
      const viewports: RawDxfEntity[] = []

      let currentSection = ''
      let inLayout = false
      let currentLayout: { name: string, order: number, handle: string, inAcDbLayout: boolean } | null = null
      let inBlockRecord = false
      let currentBlockRecord: { handle: string, name: string, layoutHandle: string } | null = null
      let inImageDef = false
      let currentImageDef: { handle: string, filePath: string } | null = null
      let inBlockHeader = false
      let currentBlockName = ''
      let currentBlockImage: RawBlockImage | null = null
      let currentEnt: RawDxfEntity | null = null

      const flushObjects = () => {
        if (inLayout && currentLayout && currentLayout.name) {
          layoutsByHandle[currentLayout.handle] = currentLayout
          layouts.push(currentLayout)
        }
        if (inBlockRecord && currentBlockRecord && currentBlockRecord.layoutHandle) {
          blockRecordToLayout[currentBlockRecord.handle] = currentBlockRecord.layoutHandle
        }
        if (inImageDef && currentImageDef && currentImageDef.handle) {
          imageDefsByHandle[currentImageDef.handle] = currentImageDef.filePath
        }
        if (currentBlockImage && currentBlockImage.blockName) {
          blockImagesByBlockName[currentBlockImage.blockName] = blockImagesByBlockName[currentBlockImage.blockName] || []
          blockImagesByBlockName[currentBlockImage.blockName].push(currentBlockImage)
        }
        if (currentEnt && currentEnt.handle) {
          entitiesByHandle[currentEnt.handle] = currentEnt
          if (currentEnt.type === 'VIEWPORT') {
            viewports.push(currentEnt)
          }
        }
        inLayout = false
        currentLayout = null
        inBlockRecord = false
        currentBlockRecord = null
        inImageDef = false
        currentImageDef = null
        currentBlockImage = null
        currentEnt = null
      }

      for (let i = 0; i < lines.length - 1; i += 2) {
        const code = lines[i].trim()
        const val = lines[i + 1].trim()

        if (code === '0') {
          flushObjects()
          if (val === 'SECTION') {
            const nextCode = (lines[i + 2] || '').trim()
            const nextVal = (lines[i + 3] || '').trim()
            if (nextCode === '2') currentSection = nextVal
            continue
          }
          if (val === 'ENDSEC') {
            currentSection = ''
            continue
          }
          if (currentSection === 'TABLES' && val === 'BLOCK_RECORD') {
            inBlockRecord = true
            currentBlockRecord = { handle: '', name: '', layoutHandle: '' }
          } else if (currentSection === 'OBJECTS' && val === 'LAYOUT') {
            inLayout = true
            currentLayout = { name: '', order: 0, handle: '', inAcDbLayout: false }
          } else if (currentSection === 'OBJECTS' && val === 'IMAGEDEF') {
            inImageDef = true
            currentImageDef = { handle: '', filePath: '' }
          } else if (currentSection === 'BLOCKS') {
            if (val === 'BLOCK') {
              inBlockHeader = true
              currentBlockName = ''
            } else {
              inBlockHeader = false
              if (val === 'IMAGE' && currentBlockName) {
                currentBlockImage = {
                  blockName: currentBlockName,
                  x: 0,
                  y: 0,
                  uX: 1,
                  uY: 0,
                  vX: 0,
                  vY: 1,
                  wPx: 0,
                  hPx: 0,
                  imageDefHandle: '',
                  layer: '0'
                }
              }
            }
          } else if (currentSection === 'ENTITIES') {
            currentEnt = {
              type: val,
              handle: '',
              owner: '',
              space: 0,
              layer: '0',
              name: '',
              id: 0,
              status: 0,
              centerX: 0,
              centerY: 0,
              width: 0,
              height: 0,
              viewCenterX: 0,
              viewCenterY: 0,
              targetX: 0,
              targetY: 0,
              viewDirX: 0,
              viewDirY: 0,
              viewDirZ: 1,
              viewHeight: 0,
              twistAngle: 0
            }
          }
          continue
        }

        if (inBlockRecord && currentBlockRecord) {
          if (code === '5' && !currentBlockRecord.handle) currentBlockRecord.handle = val
          else if (code === '2' && !currentBlockRecord.name) currentBlockRecord.name = val
          else if (code === '340') currentBlockRecord.layoutHandle = val
        } else if (inLayout && currentLayout) {
          if (code === '5' && !currentLayout.handle) currentLayout.handle = val
          else if (code === '100' && val === 'AcDbLayout') currentLayout.inAcDbLayout = true
          else if (currentLayout.inAcDbLayout && code === '1' && !currentLayout.name) currentLayout.name = val
          else if (currentLayout.inAcDbLayout && code === '71') currentLayout.order = parseInt(val, 10) || 0
        } else if (inImageDef && currentImageDef) {
          if (code === '5' && !currentImageDef.handle) currentImageDef.handle = val
          else if (code === '1' && !currentImageDef.filePath) currentImageDef.filePath = val
        } else if (currentSection === 'BLOCKS') {
          if (inBlockHeader && code === '2' && !currentBlockName) {
            currentBlockName = val
          } else if (currentBlockImage) {
            if (code === '8') currentBlockImage.layer = val
            else if (code === '10') currentBlockImage.x = parseFloat(val) || 0
            else if (code === '20') currentBlockImage.y = parseFloat(val) || 0
            else if (code === '11') currentBlockImage.uX = parseFloat(val) || 0
            else if (code === '21') currentBlockImage.uY = parseFloat(val) || 0
            else if (code === '12') currentBlockImage.vX = parseFloat(val) || 0
            else if (code === '22') currentBlockImage.vY = parseFloat(val) || 0
            else if (code === '13') currentBlockImage.wPx = parseFloat(val) || 0
            else if (code === '23') currentBlockImage.hPx = parseFloat(val) || 0
            else if (code === '340') currentBlockImage.imageDefHandle = val
          }
        } else if (currentSection === 'ENTITIES' && currentEnt) {
          if (code === '5' && !currentEnt.handle) currentEnt.handle = val
          else if (code === '330' && !currentEnt.owner) currentEnt.owner = val
          else if (code === '67') currentEnt.space = parseInt(val, 10) || 0
          else if (code === '8' && currentEnt.layer === '0') currentEnt.layer = val
          else if (code === '2' && !currentEnt.name) currentEnt.name = val
          if (currentEnt.type === 'VIEWPORT') {
            if (code === '10') currentEnt.centerX = parseFloat(val) || 0
            else if (code === '20') currentEnt.centerY = parseFloat(val) || 0
            else if (code === '40') currentEnt.width = parseFloat(val) || 0
            else if (code === '41') currentEnt.height = parseFloat(val) || 0
            else if (code === '12') currentEnt.viewCenterX = parseFloat(val) || 0
            else if (code === '22') currentEnt.viewCenterY = parseFloat(val) || 0
            else if (code === '17') currentEnt.targetX = parseFloat(val) || 0
            else if (code === '27') currentEnt.targetY = parseFloat(val) || 0
            else if (code === '16') currentEnt.viewDirX = parseFloat(val) || 0
            else if (code === '26') currentEnt.viewDirY = parseFloat(val) || 0
            else if (code === '36') currentEnt.viewDirZ = parseFloat(val) || 0
            else if (code === '45') currentEnt.viewHeight = parseFloat(val) || 0
            else if (code === '51') currentEnt.twistAngle = parseFloat(val) || 0
            else if (code === '68') currentEnt.status = parseInt(val, 10) || 0
            else if (code === '69') currentEnt.id = parseInt(val, 10) || 0
          }
        }
      }

      flushObjects()
      layouts.sort((a, b) => a.order - b.order)
      return {
        layouts,
        layoutsByHandle,
        blockRecordToLayout,
        imageDefsByHandle,
        blockImagesByBlockName,
        entitiesByHandle,
        viewports
      }
    }

    const safeCloneObject3D = (source: THREE.Object3D): THREE.Object3D => {
      const origList: THREE.Object3D[] = []
      const savedUserData: any[] = []
      source.traverse((node) => {
        origList.push(node)
        savedUserData.push(node.userData)
        node.userData = {}
      })
      const cloned = source.clone(true)
      const clonedList: THREE.Object3D[] = []
      cloned.traverse((node) => {
        clonedList.push(node)
      })
      for (let idx = 0; idx < origList.length; idx++) {
        const ud = savedUserData[idx] || {}
        origList[idx].userData = ud
        if (clonedList[idx]) {
          clonedList[idx].userData = {
            layer: ud.layer || ud.entity?.layer,
            layerId: ud.layerId || ud.layer || ud.entity?.layer,
            entity: ud.entity
              ? { layer: ud.entity.layer, type: ud.entity.type, handle: ud.entity.handle }
              : undefined
          }
        }
      }
      return cloned
    }

    const buildViewerLayoutsAndScene = async (viewer: any, modelDrawn: THREE.Object3D): Promise<THREE.Group> => {
      const textToParse = normalizedDxfText || rawDxfText
      const struct = textToParse
        ? parseDxfStructure(textToParse)
        : {
            layouts: [],
            layoutsByHandle: {},
            blockRecordToLayout: {},
            imageDefsByHandle: {},
            blockImagesByBlockName: {},
            entitiesByHandle: {},
            viewports: []
          }

      let layoutList: string[] = []
      if (struct.layouts.length > 0) {
        layoutList = struct.layouts.map((l) => (l.name.toLowerCase() === 'model' ? 'Modelo' : l.name))
      } else {
        layoutList = ['Modelo']
        if (Array.isArray(viewer.lastDXF?.entities)) {
          viewer.lastDXF.entities.forEach((ent: any) => {
            if (ent.paperSpace || ent.inPaperSpace) {
              if (!layoutList.includes('Layout1')) layoutList.push('Layout1')
            }
          })
        }
      }
      layoutList = Array.from(new Set(layoutList))
      if (!layoutList.includes('Modelo')) layoutList.unshift('Modelo')

      setAvailableLayouts(layoutList)
      setActiveLayout('Modelo')

      const rootGroup = new THREE.Group()
      rootGroup.name = 'DXFRoot'
      const dxfData = viewer.lastDXF || parsedDxfData
      if (dxfData) {
        rootGroup.userData.dxf = dxfData
        rootGroup.userData.dxfLayers = dxfData.tables?.layers || dxfData.tables?.layer?.layers
      }

      const modelLayoutGroup = new THREE.Group()
      modelLayoutGroup.name = 'Layout_Modelo'
      modelLayoutGroup.userData = { isLayoutGroup: true, layoutName: 'Modelo' }
      modelLayoutGroup.visible = true
      modelLayoutGroup.add(modelDrawn)
      rootGroup.add(modelLayoutGroup)

      modelDrawn.updateMatrixWorld(true)
      const modelBox = new THREE.Box3().setFromObject(modelDrawn)

      const paperLayoutNames = layoutList.filter((l) => l !== 'Modelo')
      if (paperLayoutNames.length === 0 || !viewer.lastDXF) {
        return rootGroup
      }

      // 1. Ensure non-off layers (including plot=false layers like G-____-____-NPLT) are visible
      if (viewer.lastDXF.tables?.layers) {
        Object.values(viewer.lastDXF.tables.layers).forEach((layer: any) => {
          if (layer && !(layer.colorNumber < 0)) {
            layer.visible = true
          }
        })
      }

      // 2. Strip paperSpace flag from block definitions so Paper Space blocks (title blocks, view titles) render
      if (Array.isArray(viewer.lastDXF.blocks)) {
        viewer.lastDXF.blocks.forEach((blk: any) => {
          delete blk.paperSpace
          delete blk._cache
          if (Array.isArray(blk.entities)) {
            blk.entities.forEach((be: any) => {
              delete be.paperSpace
              delete be._cache
            })
          }
        })
      }

      // 3. Group Paper Space entities by layout
      const firstPaperLayout = paperLayoutNames[0]
      const paperEntitiesByLayout: Record<string, any[]> = {}
      paperLayoutNames.forEach((ln) => {
        paperEntitiesByLayout[ln] = []
      })

      if (Array.isArray(viewer.lastDXF.entities)) {
        viewer.lastDXF.entities.forEach((ent: any) => {
          const rawEnt = ent.handle ? struct.entitiesByHandle[ent.handle] : undefined
          const isPaper = Boolean(ent.paperSpace || rawEnt?.space === 1)
          if (!isPaper) return

          let targetLayout = firstPaperLayout
          const ownerHandle = ent.ownerHandle || rawEnt?.owner
          if (ownerHandle && struct.blockRecordToLayout[ownerHandle]) {
            const lh = struct.blockRecordToLayout[ownerHandle]
            const mappedName = struct.layoutsByHandle[lh]?.name
            if (mappedName && mappedName.toLowerCase() !== 'model') {
              targetLayout = mappedName
            }
          }

          const clonedEnt = { ...ent }
          delete clonedEnt.paperSpace
          delete clonedEnt._cache
          if (!paperEntitiesByLayout[targetLayout]) {
            paperEntitiesByLayout[targetLayout] = []
          }
          paperEntitiesByLayout[targetLayout].push(clonedEnt)
        })
      }

      // 4. Build each Paper Space Layout Group
      for (const layoutName of paperLayoutNames) {
        const paperLayoutGroup = new THREE.Group()
        paperLayoutGroup.name = 'Layout_' + layoutName
        paperLayoutGroup.userData = { isLayoutGroup: true, layoutName, inPaperLayout: true }
        paperLayoutGroup.visible = false

        const entsForLayout = paperEntitiesByLayout[layoutName] || []
        if (entsForLayout.length > 0) {
          try {
            const paperDxfData = {
              ...viewer.lastDXF,
              objects: { ...(viewer.lastDXF.objects || {}), layouts: [] },
              entities: entsForLayout
            }
            const paperDrawn = await viewer._drawDXF(paperDxfData)
            if (paperDrawn) {
              paperLayoutGroup.add(paperDrawn)
            }
          } catch (pe) {
            console.warn(`Error drawing paper layout ${layoutName}:`, pe)
          }

          // Render any raster IMAGE placeholders inside inserted title-block definitions (e.g. Autodesk logo)
          entsForLayout.forEach((ent: any) => {
            if (ent.type === 'INSERT' && ent.block && struct.blockImagesByBlockName[ent.block]) {
              const imgs = struct.blockImagesByBlockName[ent.block]
              imgs.forEach((img) => {
                const imgW = Math.hypot(img.uX, img.uY) * img.wPx
                const imgH = Math.hypot(img.vX, img.vY) * img.hPx
                if (imgW > 0 && imgH > 0 && viewer._font?.generateShapes) {
                  try {
                    const filePath = struct.imageDefsByHandle[img.imageDefHandle] || ''
                    const label = /autodesk/i.test(filePath) ? 'AUTODESK' : ''
                    if (label) {
                      const shapes = viewer._font.generateShapes(label, imgH * 0.36)
                      const textGeo = new THREE.ShapeGeometry(shapes)
                      textGeo.computeBoundingBox()
                      const tb = textGeo.boundingBox
                      const boxX = (ent.x || 0) + img.x
                      const boxY = (ent.y || 0) + img.y
                      if (tb) {
                        const tw = tb.max.x - tb.min.x
                        const th = tb.max.y - tb.min.y
                        textGeo.translate(boxX + (imgW - tw) / 2 - tb.min.x, boxY + (imgH - th) / 2 - tb.min.y, 0.05)
                      }
                      const textMat = new THREE.MeshBasicMaterial({ color: 0x111111, side: THREE.DoubleSide })
                      const textMesh = new THREE.Mesh(textGeo, textMat)
                      textMesh.userData = { layerId: img.layer || ent.layer || '0', inPaperLayout: true }
                      paperLayoutGroup.add(textMesh)
                    }
                  } catch (ie) {
                    console.warn('Error rendering block image label:', ie)
                  }
                }
              })
            }
          })
        }

        // Find Viewports belonging to this layout
        const layoutVps = struct.viewports
          .filter((vp) => {
            if (vp.id === 1 || vp.width <= 0 || vp.height <= 0) return false
            let vpLayout = firstPaperLayout
            if (vp.owner && struct.blockRecordToLayout[vp.owner]) {
              const lh = struct.blockRecordToLayout[vp.owner]
              const mappedName = struct.layoutsByHandle[lh]?.name
              if (mappedName && mappedName.toLowerCase() !== 'model') {
                vpLayout = mappedName
              }
            }
            return vpLayout === layoutName
          })
          .map((vp) => ({ ...vp }))

        // If an uninitialized layout tab (like Layout2 seed) has no entities and no viewports,
        // synthesize a standard sheet frame + viewport framing Model Space (matching AutoCAD behavior)
        if (entsForLayout.length === 0 && layoutVps.length === 0 && !modelBox.isEmpty()) {
          const mCenter = modelBox.getCenter(new THREE.Vector3())
          const mSize = modelBox.getSize(new THREE.Vector3())
          const sheetW = 841
          const sheetH = 594
          const margin = 20
          const framePts = [
            new THREE.Vector3(margin, margin, 0.01),
            new THREE.Vector3(sheetW - margin, margin, 0.01),
            new THREE.Vector3(sheetW - margin, sheetH - margin, 0.01),
            new THREE.Vector3(margin, sheetH - margin, 0.01)
          ]
          const frameGeo = new THREE.BufferGeometry().setFromPoints(framePts)
          const frameMat = new THREE.LineBasicMaterial({ color: 0x222222 })
          const frameLoop = new THREE.LineLoop(frameGeo, frameMat)
          frameLoop.userData = { layerId: '0', inPaperLayout: true }
          paperLayoutGroup.add(frameLoop)

          const vpW = sheetW - margin * 4
          const vpH = sheetH - margin * 4
          const fitVh = Math.max(mSize.y * 1.15, mSize.x * 1.15 * (vpH / vpW), 1)
          layoutVps.push({
            type: 'VIEWPORT',
            handle: 'synth_' + layoutName,
            owner: '',
            space: 1,
            layer: '0',
            name: '',
            id: 2,
            status: 1,
            centerX: sheetW / 2,
            centerY: sheetH / 2,
            width: vpW,
            height: vpH,
            viewCenterX: mCenter.x,
            viewCenterY: mCenter.y,
            targetX: 0,
            targetY: 0,
            viewDirX: 0,
            viewDirY: 0,
            viewDirZ: 1,
            viewHeight: fitVh,
            twistAngle: 0
          })
        }

        // Render each Viewport (border + clipped Model Space projection)
        for (const vp of layoutVps) {
          const vpLeft = vp.centerX - vp.width / 2
          const vpRight = vp.centerX + vp.width / 2
          const vpBottom = vp.centerY - vp.height / 2
          const vpTop = vp.centerY + vp.height / 2

          let vpBorderColor = 0x444444
          const dxfLayer = viewer.lastDXF?.tables?.layers?.[vp.layer]
          if (dxfLayer && typeof dxfLayer.color === 'number' && dxfLayer.color > 0 && dxfLayer.color !== 0xffffff) {
            vpBorderColor = dxfLayer.color
          }
          const borderPts = [
            new THREE.Vector3(vpLeft, vpBottom, 0.02),
            new THREE.Vector3(vpRight, vpBottom, 0.02),
            new THREE.Vector3(vpRight, vpTop, 0.02),
            new THREE.Vector3(vpLeft, vpTop, 0.02)
          ]
          const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts)
          const borderMat = new THREE.LineBasicMaterial({ color: vpBorderColor })
          const borderLine = new THREE.LineLoop(borderGeo, borderMat)
          borderLine.userData = { layerId: vp.layer || '0', inPaperLayout: true }
          paperLayoutGroup.add(borderLine)

          if (!modelBox.isEmpty() && vp.viewHeight > 0) {
            const scale = vp.height / vp.viewHeight
            const modelCx = (vp.targetX || 0) + (vp.viewCenterX || 0)
            const modelCy = (vp.targetY || 0) + (vp.viewCenterY || 0)

            const clipPlanes = [
              new THREE.Plane(new THREE.Vector3(1, 0, 0), -vpLeft),
              new THREE.Plane(new THREE.Vector3(-1, 0, 0), vpRight),
              new THREE.Plane(new THREE.Vector3(0, 1, 0), -vpBottom),
              new THREE.Plane(new THREE.Vector3(0, -1, 0), vpTop)
            ]

            const vpClone = safeCloneObject3D(modelDrawn)
            vpClone.scale.set(scale, scale, 1)
            if (vp.twistAngle) {
              vpClone.rotation.z = (vp.twistAngle * Math.PI) / 180
            }
            vpClone.position.set(vp.centerX - modelCx * scale, vp.centerY - modelCy * scale, 0.05)

            vpClone.traverse((child: any) => {
              child.userData = {
                ...child.userData,
                isViewportContent: true,
                inPaperLayout: true
              }
              if (child.material) {
                const cloneWithClip = (m: any) => {
                  const mc = m.clone()
                  mc.clippingPlanes = clipPlanes
                  return mc
                }
                child.material = Array.isArray(child.material)
                  ? child.material.map(cloneWithClip)
                  : cloneWithClip(child.material)
              }
            })

            paperLayoutGroup.add(vpClone)
          }
        }

        // Adjust materials on Paper Space so white/near-white lines become dark charcoal on the white sheet
        const adjustMatForWhitePaper = (m: any, alreadyCloned: boolean) => {
          const mc = alreadyCloned ? m : m.clone()
          if (mc.color) {
            const hex = mc.color.getHex()
            const hsl = { h: 0, s: 0, l: 0 }
            mc.color.getHSL(hsl)
            if (hex === 0xffffff || (hsl.s < 0.1 && hsl.l > 0.85)) {
              mc.color.setHex(0x111111)
            } else if (hsl.l > 0.72) {
              mc.color.setHSL(hsl.h, hsl.s, 0.42)
            }
            mc.needsUpdate = true
          }
          return mc
        }

        paperLayoutGroup.traverse((obj: any) => {
          if (obj.userData?.isPaperSheet) return
          obj.userData.inPaperLayout = true
          if (obj.material) {
            const alreadyCloned = Boolean(obj.userData?.isViewportContent)
            obj.material = Array.isArray(obj.material)
              ? obj.material.map((m: any) => adjustMatForWhitePaper(m, alreadyCloned))
              : adjustMatForWhitePaper(obj.material, alreadyCloned)
          }
        })

        // Compute 2D sheet bounding box and add white paper background + drop shadow
        paperLayoutGroup.updateMatrixWorld(true)
        const sheetBox = new THREE.Box3()
        paperLayoutGroup.traverse((obj: any) => {
          if (
            (obj.isMesh || obj.isLine || obj.isLineSegments || obj.isLineLoop) &&
            !obj.userData?.isViewportContent &&
            !obj.userData?.isPaperSheet
          ) {
            sheetBox.expandByObject(obj)
          }
        })

        if (!sheetBox.isEmpty()) {
          const minX = sheetBox.min.x
          const maxX = sheetBox.max.x
          const minY = sheetBox.min.y
          const maxY = sheetBox.max.y
          const w = Math.max(10, maxX - minX)
          const h = Math.max(10, maxY - minY)
          const cx = (minX + maxX) / 2
          const cy = (minY + maxY) / 2
          const padX = w * 0.015
          const padY = h * 0.015
          const sheetW = w + padX * 2
          const sheetH = h + padY * 2

          const shadowGeo = new THREE.PlaneGeometry(sheetW, sheetH)
          const shadowMat = new THREE.MeshBasicMaterial({ color: 0x2b2d30, side: THREE.DoubleSide, depthWrite: false })
          const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat)
          shadowMesh.position.set(cx + w * 0.008, cy - h * 0.008, -0.6)
          shadowMesh.renderOrder = -20
          shadowMesh.userData = { isPaperSheet: true, inPaperLayout: true }
          paperLayoutGroup.add(shadowMesh)

          const paperGeo = new THREE.PlaneGeometry(sheetW, sheetH)
          const paperMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, depthWrite: false })
          const paperMesh = new THREE.Mesh(paperGeo, paperMat)
          paperMesh.position.set(cx, cy, -0.5)
          paperMesh.renderOrder = -10
          paperMesh.userData = { isPaperSheet: true, inPaperLayout: true }
          paperLayoutGroup.add(paperMesh)
        }

        rootGroup.add(paperLayoutGroup)
      }

      return rootGroup
    }

    const extractAndSetupLayouts = (rootObj: THREE.Object3D, fallbackDxf?: any, rawText?: string) => {
      const dxfData = parsedDxfData || fallbackDxf
      if (dxfData) {
        rootObj.userData.dxf = dxfData
        rootObj.userData.dxfLayers = dxfData.tables?.layer?.layers || dxfData.tables?.layers
      }

      let struct = {
        layouts: [] as { name: string, order: number, handle: string }[],
        layoutsByHandle: {} as Record<string, { name: string, order: number, handle: string }>,
        blockRecordToLayout: {} as Record<string, string>
      }

      const textToParse = rawText || rawDxfText
      if (textToParse) {
        try {
          struct = parseDxfStructure(textToParse)
        } catch (e) {
          console.warn('Error parsing DXF structure:', e)
        }
      }

      let layoutList: string[] = []
      if (struct.layouts.length > 0) {
        layoutList = struct.layouts.map(l => l.name.toLowerCase() === 'model' ? 'Modelo' : l.name)
      } else {
        const layoutsSet = new Set<string>()
        layoutsSet.add('Modelo')
        if (Array.isArray(dxfData?.entities)) {
          dxfData.entities.forEach((ent: any) => {
            if (ent.inPaperSpace || ent.paperSpace) layoutsSet.add('Layout1')
          })
        }
        layoutList = Array.from(layoutsSet)
      }

      // Asegurar nombres únicos manteniendo orden
      layoutList = Array.from(new Set(layoutList))

      setAvailableLayouts(layoutList)
      setActiveLayout('Modelo')

      // Mapear cada entidad 3D con su Layout y estado PaperSpace
      if (dxfData?.entities && Array.isArray(dxfData.entities)) {
        const entitiesByLayer: Record<string, any[]> = {}
        dxfData.entities.forEach((ent: any) => {
          const l = ent.layer || 'default'
          entitiesByLayer[l] = entitiesByLayer[l] || []
          entitiesByLayer[l].push(ent)
        })

        rootObj.children.forEach((layerGroup: any) => {
          const lName = layerGroup.name || 'default'
          const ents = entitiesByLayer[lName] || []
          if (Array.isArray(layerGroup.children)) {
            layerGroup.children.forEach((child: any, idx: number) => {
              const ent = ents[idx] || (ents.length === 1 ? ents[0] : null)
              const isPaper = Boolean(ent?.inPaperSpace || ent?.paperSpace)
              let layoutName = 'Modelo'

              if (ent?.ownerHandle && struct.blockRecordToLayout[ent.ownerHandle]) {
                const lh = struct.blockRecordToLayout[ent.ownerHandle]
                if (struct.layoutsByHandle[lh]) {
                  layoutName = struct.layoutsByHandle[lh].name
                  if (layoutName.toLowerCase() === 'model') layoutName = 'Modelo'
                }
              } else if (isPaper) {
                layoutName = 'Layout1'
              }

              child.userData.entity = ent
              child.userData.inPaperSpace = isPaper
              child.userData.layout = layoutName
              child.userData.layerId = lName

              child.traverse((descendant: any) => {
                descendant.userData.entity = descendant.userData.entity || ent
                descendant.userData.inPaperSpace = isPaper
                descendant.userData.layout = layoutName
                descendant.userData.layerId = descendant.userData.layerId || lName
              })
            })
          }
        })
      }

      // Inicialmente mostrar sólo Modelo
      rootObj.traverse((obj: any) => {
        if (obj.isMesh || obj.isLine || obj.isPoints) {
          const isPaper = Boolean(obj.userData?.inPaperSpace)
          const objLayout = obj.userData?.layout || 'Modelo'
          obj.visible = (objLayout === 'Modelo' && !isPaper)
        }
      })
    }

    const fontLoader = new FontLoader()
    fontLoader.load(fontUrl, (font) => {
      const loadWithDXFLoader = () => {
        const loader = new DXFLoader()
        loader.setFont(font)
        loader.setEnableLayer(true)
        loader.setConsumeUnits(true)
        loader.setDefaultColor(0xffffff)
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current)
        }
        loadTimeoutRef.current = window.setTimeout(() => {
          setLoading(false)
          setErrorMsg('Tiempo de carga excedido. Verifica que el DXF sea válido.')
          URL.revokeObjectURL(url)
        }, 15000)
 
        loader.load(url, (data: any) => {
          console.log('DXF loaded data:', data)
          const root = data?.entity || data
          if (root) {
            if (!root.isObject3D && !root.traverse) {
              console.error('Loaded object is not a valid Object3D', root)
            } else {
              extractAndSetupLayouts(root, data?.dxf, rawDxfText)
              scene.add(root)
              setEntityRoot(root)
              // Extract snap points
              root.updateMatrixWorld(true)
              extractSnapPoints(root)

              setTimeout(() => {
                fitToVisible()
              }, 60)
            }
          } else {
            console.error('No entity found in DXF data')
          }
          setLoading(false)
          if (loadTimeoutRef.current) {
            clearTimeout(loadTimeoutRef.current)
            loadTimeoutRef.current = null
          }
          URL.revokeObjectURL(url)
        }, undefined, async (err: any) => {
          console.warn('DXFLoader failed, trying viewer', err)
          setLoading(false)
          try {
            const mod = await import('three-dxf-viewer')
            const viewer = new (mod as any).DXFViewer()
            if (viewer.LayerHelper) {
              viewer.LayerHelper.isVisible = (layer: any) => !(layer.colorNumber < 0)
            }
            const dxfObj = await viewer.getFromFile(normalizedFile, fontUrl)
            if (dxfObj) {
              const rootGroup = await buildViewerLayoutsAndScene(viewer, dxfObj as any)
              scene.add(rootGroup)
              setEntityRoot(rootGroup)
              setTimeout(() => {
                fitToVisible()
              }, 60)
              setErrorMsg(null)
            }
          } catch (e) {
            console.error('Viewer loader failed', e)
            setErrorMsg('Error al procesar DXF. Prueba con otro archivo o convertir desde CAD.')
          } finally {
            URL.revokeObjectURL(url)
            setLoading(false)
          }
        })
      }
 
      ;(async () => {
        try {
          const mod = await import('three-dxf-viewer')
          const viewer = new (mod as any).DXFViewer()
          if (viewer.LayerHelper) {
            viewer.LayerHelper.isVisible = (layer: any) => !(layer.colorNumber < 0)
          }
          const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('DXF_VIEWER_TIMEOUT')), 12000)
          )
          const dxfObj = await Promise.race([
            viewer.getFromFile(normalizedFile, fontUrl),
            timeout
          ])
          if (dxfObj && (dxfObj as any).isObject3D) {
            const rootGroup = await buildViewerLayoutsAndScene(viewer, dxfObj as any)
            scene.add(rootGroup)
            setEntityRoot(rootGroup)
            const box = new THREE.Box3().setFromObject(dxfObj as any)
            const center = box.getCenter(new THREE.Vector3())
            const size = box.getSize(new THREE.Vector3())
            const maxSize = Math.max(size.x, size.y)
            const viewSize = maxSize * 0.6
            const w = renderer.domElement.clientWidth
            const h = renderer.domElement.clientHeight
            const aspect = w / h
            camera.left = -viewSize * aspect
            camera.right = viewSize * aspect
            camera.top = viewSize
            camera.bottom = -viewSize
            camera.position.set(center.x, center.y, 100)
            camera.zoom = 1
            camera.updateProjectionMatrix()
            controls?.target.set(center.x, center.y, 0)
            controls?.update()
            setErrorMsg(null)
            setLoading(false)
            URL.revokeObjectURL(url)
          } else {
            console.warn('Viewer returned invalid object, falling back to DXFLoader')
            loadWithDXFLoader()
          }
        } catch (e) {
          if ((e as Error).message === 'DXF_VIEWER_TIMEOUT') {
            console.warn('Viewer timeout, falling back to DXFLoader')
          } else {
            console.error('Viewer failed, falling back to DXFLoader', e)
          }
          loadWithDXFLoader()
        }
      })()
    }, undefined, (err) => {
      console.error('Font loading failed', err)
      setLoading(false)
      setErrorMsg('Error cargando fuente de texto (verifica conexión o archivos locales).')
      URL.revokeObjectURL(url)
    })
    }
    run()
  }, [file, renderer])

  const ndcToWorldOnPlaneZ0 = (event: React.MouseEvent) => {
    if (!renderer) return null
    const rect = renderer.domElement.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(x, y), camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const p = new THREE.Vector3()
    ray.ray.intersectPlane(plane, p)
    return p
  }

  const getMouseWorldPos = (clientX: number, clientY: number) => {
    if (!renderer || !camera) return null
    const rect = renderer.domElement.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) return null
    
    const x = ((clientX - rect.left) / rect.width) * 2 - 1
    const y = -((clientY - rect.top) / rect.height) * 2 + 1
    
    // Use Raycaster to intersect Z=0 plane
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const target = new THREE.Vector3()
    const hit = raycaster.ray.intersectPlane(plane, target)
    return hit ? target : null
  }

  const [debugInfo, setDebugInfo] = useState<{pos: string, candidates: number, zoom: string}>({ pos: '', candidates: 0, zoom: '' })
  const [showInfo, setShowInfo] = useState(false)

  const onMouseMove = (e: React.MouseEvent) => {
    // console.log('MouseMove', tool, snapCandidates.length)
    if (!renderer || !camera) return

    // Update Debug Info
    const mousePos = getMouseWorldPos(e.clientX, e.clientY)
    if (mousePos) {
       setDebugInfo({
         pos: `${mousePos.x.toFixed(2)}, ${mousePos.y.toFixed(2)}`,
         candidates: snapCandidates.length,
         zoom: camera.zoom.toFixed(2)
       })
    }

    if (!entityRoot || (tool !== 'measure' && tool !== 'calibrate' && tool !== 'dimension' && tool !== 'area')) {
      if (snap) setSnap(null)
      return
    }

    if (!mousePos) return

    // New Geometry-Based Snap Logic
    if (snapCandidates.length > 0 && (snapSettings.enableEndpoint || snapSettings.enableMidpoint)) {
       const vector = mousePos
       // vector is already on Z=0 plane
       
       const rect = renderer.domElement.getBoundingClientRect()
       const visibleHeight = (camera.top - camera.bottom) / camera.zoom
       const unitsPerPixel = visibleHeight / rect.height
       const threshold = (snapSettings.thresholdPx || 10) * unitsPerPixel * 1.5 // default 10px if undefined
       
       // console.log('Snap Check', { pos: vector, candidates: snapCandidates.length, threshold })

       let best = { type: 'none', pos: new THREE.Vector3(), dist: Infinity }
       const prio = (t: string) => (t === 'endpoint' ? 2 : t === 'midpoint' ? 1 : 0)

       for (const cand of snapCandidates) {
         if (cand.type === 'endpoint' && !snapSettings.enableEndpoint) continue
         if (cand.type === 'midpoint' && !snapSettings.enableMidpoint) continue

         const d = vector.distanceTo(cand.pos)
         if (d < threshold) {
            if (best.type === 'none' || d < best.dist || (Math.abs(d - best.dist) < threshold * 0.1 && prio(cand.type) > prio(best.type))) {
               best = { type: cand.type, pos: cand.pos, dist: d } as any
            }
         }
       }

       if (best.type !== 'none') {
         if (!snap || snap.type !== best.type || !snap.pos.equals(best.pos)) {
              setSnap(best as any)
         }
         return 
       }
    }
    
    if (snap) setSnap(null)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    // Allow Pan (Right Click) and Zoom (Middle Click) to pass through to OrbitControls
    if (e.button !== 0) return // Only act on Left Click for tools

    if (!renderer) return
    
    // Calculate world position (considering snap)
    const getPos = () => {
      if (snap) return snap.pos
      return getMouseWorldPos(e.clientX, e.clientY)
    }

    if (tool === 'area') {
      const p = getPos()
      if (!p) return
      setPolyPoints(prev => [...prev, new THREE.Vector3(p.x, p.y, 0)])
      return
    }
    if (tool === 'measure' || tool === 'calibrate' || tool === 'dimension') {
      const p = getPos()
      if (!p) return
      if (points.length >= 2) {
        setPoints([p])
      } else {
        const next = [...points, p]
        setPoints(next)
        if (next.length === 2) {
          if (tool === 'calibrate') {
            const worldDist = next[0].distanceTo(next[1])
            const val = prompt('Establecer escala: ¿Cuántos metros mide esta línea en la realidad?', '1.0')
            if (val) {
              onCalibrationComplete({ world: worldDist, realValue: parseFloat(val), unit: 'm' })
            }
          } else if (tool === 'dimension') {
            const d = next[0].distanceTo(next[1])
            const text = calibration ? `${((d / calibration.world) * calibration.realValue).toFixed(2)} ${calibration.unit}` : `${d.toFixed(2)} m`
            const item: DimensionItem = { ax: next[0].x, ay: next[0].y, bx: next[1].x, by: next[1].y, text }
            setDimensions(prev => [...prev, item])
            setPoints([])
          }
        }
      }
    }
  }

  const onDoubleClick = () => {
    if (!renderer) return
    if (tool !== 'area') return
    if (polyPoints.length < 3) return
    const areaWorld = (() => {
      let sum = 0
      for (let i = 0; i < polyPoints.length; i++) {
        const a = polyPoints[i]
        const b = polyPoints[(i + 1) % polyPoints.length]
        sum += a.x * b.y - b.x * a.y
      }
      return Math.abs(sum) * 0.5
    })()
    const factor = calibration ? (calibration.realValue / calibration.world) : null
    const text = factor
      ? `${(areaWorld * factor * factor).toFixed(2)} ${calibration!.unit}²`
      : `${areaWorld.toFixed(2)} m²`
    const item: AreaItem = {
      pts: polyPoints.map(p => ({ x: p.x, y: p.y })),
      text
    }
    setAreas(prev => [...prev, item])
    setPolyPoints([])
  }

  const projectToScreen = (v: THREE.Vector3) => {
    if (!renderer) return { x: 0, y: 0 }
    const p = v.clone().project(camera)
    const w = renderer.domElement.clientWidth
    const h = renderer.domElement.clientHeight
    return { x: (p.x + 1) * 0.5 * w, y: (1 - (p.y + 1) * 0.5) * h }
  }

  const displayDist = () => {
    if (points.length !== 2) return null
    const d = points[0].distanceTo(points[1])
    if (calibration) {
      const real = (d / calibration.world) * calibration.realValue
      return `${real.toFixed(2)} ${calibration.unit}`
    }
    return `${d.toFixed(2)} m`
  }

  const handleManualZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!camera || !controls) return
    let newZoom = parseFloat(e.target.value)
    
    // Clamp zoom if coming from input
    if (isNaN(newZoom)) return
    if (newZoom < 0.1) newZoom = 0.1
    if (newZoom > 10) newZoom = 10

    camera.zoom = newZoom
    camera.updateProjectionMatrix()
    controls.update()
    setZoomLevel(newZoom)
  }

  const handleZoomInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!camera || !controls) return
    const val = parseFloat(e.target.value)
    if (!isNaN(val)) {
        // Convert percentage to zoom level
        let zoom = val / 100
        if (zoom < 0.1) zoom = 0.1
        if (zoom > 10) zoom = 10

        camera.zoom = zoom
        camera.updateProjectionMatrix()
        controls.update()
        setZoomLevel(zoom)
    }
  }

  const handleWheel = (e: React.WheelEvent) => {
    if (!camera || !controls) return
    
    // Manual zoom handling to prevent massive jumps
    // Use exponential decay based on deltaY magnitude to handle both
    // notched mice (delta ~100) and trackpads (delta ~1-10) gracefully
    const sensitivity = 0.0005 
    const delta = e.deltaY
    const zoomFactor = Math.exp(-delta * sensitivity)
    
    let newZoom = camera.zoom * zoomFactor
    
    if (newZoom < 0.1) newZoom = 0.1
    if (newZoom > 10) newZoom = 10
    
    camera.zoom = newZoom
    camera.updateProjectionMatrix()
    controls.update()
    setZoomLevel(newZoom)
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'} h-full ${tool === 'hand' ? 'cursor-grab' : 'cursor-crosshair'}`}
    >
      {/* Fit to View Button */}
      <button 
        onClick={fitToView}
        className={`absolute top-2 right-2 ${isDarkMode ? 'bg-nora-600 hover:bg-nora-500' : 'bg-nora-600 hover:bg-nora-700'} text-white px-3 py-1.5 rounded shadow-lg text-sm font-medium z-50 flex items-center gap-2 transition-colors`}
        title="Centrar dibujo"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
        </svg>
        Centrar
      </button>

      {/* Zoom Slider */}
      {showZoomSlider && (
        <div className="absolute top-1/2 right-4 transform -translate-y-1/2 flex flex-col items-center bg-slate-800/80 p-2 rounded-xl z-50 gap-2 shadow-xl border border-slate-700">
           <div className="flex flex-col items-center gap-1 mb-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Zoom</span>
              <input 
                type="number" 
                value={Math.round(zoomLevel * 100)} 
                onChange={handleZoomInput}
                className="w-12 bg-slate-900 text-white text-xs text-center rounded border border-slate-600 py-1 focus:border-nora-500 outline-none"
              />
              <span className="text-xs text-slate-400">%</span>
           </div>
           <input 
              type="range" 
              min="0.1" 
              max="10" 
              step="0.1"
              value={zoomLevel} 
              onChange={handleManualZoom}
              className="h-40 w-2 appearance-none bg-slate-600 rounded-lg outline-none slider-vertical"
              style={{ writingMode: 'bt-lr', WebkitAppearance: 'slider-vertical' } as any}
              {...{ orient: "vertical" } as any}
           />
        </div>
      )}

      {/* Top Left Tools */}
      <div className="absolute top-2 left-2 z-[100] flex gap-2">
        <button 
          onClick={() => setShowInfo(!showInfo)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all border ${
            showInfo 
              ? isDarkMode 
                ? 'bg-slate-800 border-nora-500/50 text-nora-400 shadow-lg shadow-nora-500/10' 
                : 'bg-nora-50 border-nora-200 text-nora-600 shadow-lg shadow-nora-500/10'
              : isDarkMode
                ? 'bg-slate-900/50 border-transparent text-slate-600 hover:text-slate-400 hover:bg-slate-800'
                : 'bg-white/50 border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
          title="Información Técnica"
        >
          <i className="fa-solid fa-circle-info text-xs"></i>
        </button>

        <button 
          onClick={() => setShowLayers(!showLayers)}
          className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all border shadow-lg ${
            showLayers 
              ? isDarkMode 
                ? 'bg-slate-800 border-nora-500/50 text-nora-400 shadow-nora-500/10' 
                : 'bg-nora-50 border-nora-200 text-nora-600 shadow-nora-500/10'
              : isDarkMode
                ? 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                : 'bg-white/80 border-slate-200 text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
          title="Panel de Capas"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
            <polyline points="2 17 12 22 22 17"></polyline>
            <polyline points="2 12 12 17 22 12"></polyline>
          </svg>
        </button>
      </div>

      {/* Layers Panel */}
      {showLayers && (
        <div className={`absolute top-12 left-2 ${isDarkMode ? 'bg-slate-900/95 text-slate-300 border-slate-700' : 'bg-white/95 text-slate-600 border-slate-200'} backdrop-blur border p-3 rounded-xl z-[100] shadow-2xl min-w-[240px] max-w-[300px] max-h-[60vh] flex flex-col transition-all duration-200`}>
          <div className={`flex flex-col gap-2 border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} pb-3 mb-2`}>
             <div className="flex justify-between items-center">
                <span className="text-xs font-semibold uppercase tracking-wider">Capas ({layers.length})</span>
                <div className="flex items-center gap-1">
                  <div className="flex gap-1 bg-slate-100/10 rounded-lg p-0.5">
                    <button 
                      onClick={showAll}
                      className={`p-1.5 rounded-md transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-nora-400' : 'hover:bg-slate-100 text-slate-500 hover:text-nora-600'}`}
                      title="Seleccionar todas"
                    >
                      <i className="fa-solid fa-check-double text-xs"></i>
                    </button>
                    <button 
                      onClick={showAll}
                      className={`p-1.5 rounded-md transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-nora-400' : 'hover:bg-slate-100 text-slate-500 hover:text-nora-600'}`}
                      title="Encender todas"
                    >
                      <i className="fa-solid fa-eye text-xs"></i>
                    </button>
                    <button 
                      onClick={hideAll}
                      className={`p-1.5 rounded-md transition-all ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-red-400' : 'hover:bg-slate-100 text-slate-500 hover:text-red-600'}`}
                      title="Apagar todas (mantiene 1)"
                    >
                      <i className="fa-solid fa-eye-slash text-xs"></i>
                    </button>
                  </div>
                  <button 
                    onClick={() => setShowLayers(false)}
                    className={`p-1 rounded-md transition-all ml-1 ${isDarkMode ? 'hover:bg-slate-700 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-900'}`}
                    title="Cerrar panel de capas"
                  >
                    <i className="fa-solid fa-xmark text-xs"></i>
                  </button>
                </div>
             </div>
             
             {/* Search Input */}
             <div className="relative">
                <input 
                  type="text" 
                  placeholder="Buscar capa..." 
                  value={layerSearch}
                  onChange={e => setLayerSearch(e.target.value)}
                  className={`w-full text-xs px-2 py-1.5 pl-7 rounded-lg border outline-none transition-colors ${
                    isDarkMode 
                      ? 'bg-slate-950 border-slate-700 focus:border-nora-500 text-slate-200 placeholder-slate-600' 
                      : 'bg-slate-50 border-slate-200 focus:border-nora-500 text-slate-700 placeholder-slate-400'
                  }`}
                />
                <i className={`fa-solid fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] ${isDarkMode ? 'text-slate-600' : 'text-slate-400'}`}></i>
             </div>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar space-y-0.5">
            {layers.filter(l => l.name.toLowerCase().includes(layerSearch.toLowerCase())).length === 0 ? (
               <div className="text-[10px] italic opacity-50 text-center py-4">
                 {layers.length === 0 ? 'No hay capas' : 'No se encontraron resultados'}
               </div>
            ) : (
               layers
                 .filter(l => l.name.toLowerCase().includes(layerSearch.toLowerCase()))
                 .map(layer => (
                   <label key={layer.name} className={`group flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer transition-colors ${
                     isDarkMode ? 'hover:bg-slate-800' : 'hover:bg-slate-50'
                   }`}>
                      <div className="relative flex items-center">
                        <input 
                          type="checkbox"
                          checked={layerVisibility[layer.name] !== false}
                          onChange={(e) => toggleLayer(layer.name, e.target.checked)}
                          className={`rounded border-slate-500 text-nora-600 focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5 cursor-pointer ${isDarkMode ? 'bg-slate-700 border-slate-600' : 'bg-white'}`}
                        />
                      </div>
                      
                      {/* Color Indicator */}
                      <div 
                        className="w-2.5 h-2.5 rounded-full shadow-sm border border-white/10 shrink-0" 
                        style={{backgroundColor: layer.color}}
                        title={`Color: ${layer.color}`}
                      ></div>
                      
                      <span className={`text-[11px] truncate select-none flex-1 transition-opacity ${
                        layerVisibility[layer.name] !== false 
                          ? (isDarkMode ? 'text-slate-200' : 'text-slate-700') 
                          : (isDarkMode ? 'text-slate-600' : 'text-slate-400')
                      }`} title={layer.name}>
                        {layer.name}
                      </span>
                   </label>
                 ))
            )}
          </div>
        </div>
      )}

      {/* Debug Info Overlay */}
      {showInfo && (
        <div className={`absolute top-12 left-2 ${isDarkMode ? 'bg-slate-900/90 text-slate-300 border-slate-700' : 'bg-white/90 text-slate-600 border-slate-200'} backdrop-blur border p-3 text-[10px] rounded-xl pointer-events-none z-50 shadow-2xl font-mono min-w-[180px]`}>
          <div className="space-y-1">
            <div className={`flex justify-between border-b ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} pb-1 mb-1`}>
              <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Pos</span>
              <span className={isDarkMode ? 'text-white' : 'text-slate-900'}>{debugInfo.pos || '0.00, 0.00'}</span>
            </div>
            <div className="flex justify-between">
              <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Zoom</span>
              <span className="text-nora-500">{debugInfo.zoom}x</span>
            </div>
            <div className="flex justify-between">
              <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Snaps</span>
              <span>{debugInfo.candidates} pts</span>
            </div>
            <div className="flex justify-between items-start gap-2">
              <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Objs</span>
              <span className="text-right leading-tight opacity-70 break-all">{debugStats || '-'}</span>
            </div>
            <div className={`flex justify-between border-t ${isDarkMode ? 'border-slate-800' : 'border-slate-100'} pt-1 mt-1`}>
              <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Tool</span>
              <span className="uppercase font-bold text-nora-500">{tool}</span>
            </div>
            <div className="flex justify-between">
              <span className={isDarkMode ? 'text-slate-500' : 'text-slate-400'}>Status</span>
              <span className={`${snap ? 'text-nora-500' : isDarkMode ? 'text-slate-600' : 'text-slate-300'}`}>
                {snap ? snap.type.toUpperCase() : 'IDLE'}
              </span>
            </div>
          </div>
        </div>
      )}

      <div
        ref={controlsTargetRef}
        className="absolute inset-0 w-full h-full touch-none"
        onContextMenu={(e) => e.preventDefault()}
        onMouseDown={onMouseDown}
        onDoubleClick={onDoubleClick}
        onMouseMove={onMouseMove}
        onWheel={handleWheel}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Snap Marker */}
      {snap && renderer && (() => {
        const s = projectToScreen(snap.pos)
        if (isNaN(s.x) || isNaN(s.y)) return null
        
        const color = isDarkMode ? "#38bdf8" : "#0284c7"
        
        return (
          <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
            {snap.type === 'endpoint' && (
              <rect x={s.x - 5} y={s.y - 5} width="10" height="10" stroke={color} strokeWidth="2.5" fill="none" />
            )}
            {snap.type === 'midpoint' && (
               <polygon points={`${s.x},${s.y - 6} ${s.x - 5},${s.y + 4} ${s.x + 5},${s.y + 4}`} stroke={color} strokeWidth="2.5" fill="none" />
            )}
          </svg>
        )
      })()}

      {polyPoints.length > 0 && renderer && tool === 'area' && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
          {(() => {
            const color = isDarkMode ? "#38bdf8" : "#0284c7"
            const pts = polyPoints.map(p => projectToScreen(p))
            return (
              <>
                {pts.map((p, i) => (
                  i > 0 ? <line key={`seg-${i}`} x1={pts[i-1].x} y1={pts[i-1].y} x2={p.x} y2={p.y} stroke={color} strokeWidth="2.5" /> : null
                ))}
                {(() => {
                  const last = pts[pts.length - 1]
                  const target = (() => {
                    if (snap) return projectToScreen(snap.pos)
                    const p = ndcToWorldOnPlaneZ0({ clientX: 0, clientY: 0 } as any)
                    return p ? projectToScreen(p) : last
                  })()
                  return <line x1={last.x} y1={last.y} x2={target.x} y2={target.y} stroke={color} strokeWidth="2.5" strokeDasharray="4,3" />
                })()}
              </>
            )
          })()}
        </svg>
      )}

      {areas.length > 0 && renderer && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
          {areas.map((ar, i) => {
            const spts = ar.pts.map(p => projectToScreen(new THREE.Vector3(p.x, p.y, 0)))
            const path = spts.map(p => `${p.x},${p.y}`).join(' ')
            const cx = spts.reduce((acc, p) => acc + p.x, 0) / spts.length
            const cy = spts.reduce((acc, p) => acc + p.y, 0) / spts.length
            const color = isDarkMode ? "#a855f7" : "#7e22ce"
            const badgeBg = isDarkMode ? "#0f172a" : "#ffffff"
            const textColor = isDarkMode ? "#f8fafc" : "#0f172a"
            return (
              <g key={`area-${i}`}>
                <polygon points={path} fill="rgba(168, 85, 247, 0.25)" stroke={color} strokeWidth="2.5" />
                <g transform={`translate(${cx}, ${cy - 12})`}>
                  <rect x="-60" y="-14" width="120" height="28" rx="14" fill={badgeBg} stroke={color} strokeWidth="2" />
                  <text fontSize="12" fontWeight="800" textAnchor="middle" fill={textColor} dy="5" className="font-mono">
                    {ar.text}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>
      )}

      {dimensions.length > 0 && renderer && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
          {dimensions.map((dim, i) => {
            const a = projectToScreen(new THREE.Vector3(dim.ax, dim.ay, 0))
            const b = projectToScreen(new THREE.Vector3(dim.bx, dim.by, 0))
            const dx = b.x - a.x
            const dy = b.y - a.y
            const len = Math.sqrt(dx*dx + dy*dy)
            if (!isFinite(len) || len < 1) return null
            const ux = dx / len
            const uy = dy / len
            const px = -uy
            const py = ux
            const off = 16
            const a1 = { x: a.x + px * off, y: a.y + py * off }
            const b1 = { x: b.x + px * off, y: b.y + py * off }
            const arrowLen = 10
            const arrowWing = 5
            const inUx = ux
            const inUy = uy
            const outUx = -ux
            const outUy = -uy
            const aHead1 = { x: a1.x + inUx * arrowLen + px * arrowWing, y: a1.y + inUy * arrowLen + py * arrowWing }
            const aHead2 = { x: a1.x + inUx * arrowLen - px * arrowWing, y: a1.y + inUy * arrowLen - py * arrowWing }
            const bHead1 = { x: b1.x + outUx * arrowLen + px * arrowWing, y: b1.y + outUy * arrowLen + py * arrowWing }
            const bHead2 = { x: b1.x + outUx * arrowLen - px * arrowWing, y: b1.y + outUy * arrowLen - py * arrowWing }
            const mid = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 - 10 }
            
            const color = isDarkMode ? "#38bdf8" : "#0284c7"
            const badgeBg = isDarkMode ? "#0f172a" : "#ffffff"
            const textColor = isDarkMode ? "#f8fafc" : "#0f172a"

            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={a1.x} y2={a1.y} stroke={color} strokeWidth="2" strokeDasharray="3,3" opacity="0.8" />
                <line x1={b.x} y1={b.y} x2={b1.x} y2={b1.y} stroke={color} strokeWidth="2" strokeDasharray="3,3" opacity="0.8" />
                <line x1={a1.x} y1={a1.y} x2={b1.x} y2={b1.y} stroke={color} strokeWidth="2.5" />
                <line x1={a1.x} y1={a1.y} x2={aHead1.x} y2={aHead1.y} stroke={color} strokeWidth="2.5" />
                <line x1={a1.x} y1={a1.y} x2={aHead2.x} y2={aHead2.y} stroke={color} strokeWidth="2.5" />
                <line x1={b1.x} y1={b1.y} x2={bHead1.x} y2={bHead1.y} stroke={color} strokeWidth="2.5" />
                <line x1={b1.x} y1={b1.y} x2={bHead2.x} y2={bHead2.y} stroke={color} strokeWidth="2.5" />
                <g transform={`translate(${mid.x}, ${mid.y})`}>
                  <rect x="-55" y="-14" width="110" height="28" rx="14" fill={badgeBg} stroke={color} strokeWidth="2" className="shadow-lg" />
                  <text fontSize="12" fontWeight="800" textAnchor="middle" fill={textColor} dy="5" className="font-mono">
                    {dim.text}
                  </text>
                </g>
              </g>
            )
          })}
        </svg>
      )}

      {points.length > 0 && renderer && (
        <svg className="absolute inset-0 pointer-events-none w-full h-full z-10">
          {points.map((p, i) => {
            const s = projectToScreen(p)
            const color = isDarkMode ? "#38bdf8" : "#0284c7"
            return <circle key={i} cx={s.x} cy={s.y} r="6" fill={color} stroke={isDarkMode ? '#ffffff' : '#000000'} strokeWidth="2" />
          })}
          {points.length === 2 && (() => {
            const a = projectToScreen(points[0])
            const b = projectToScreen(points[1])
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - 20 }
            const color = isDarkMode ? "#38bdf8" : "#0284c7"
            const badgeBg = isDarkMode ? "#0f172a" : "#ffffff"
            const textColor = isDarkMode ? "#f8fafc" : "#0f172a"
            return (
              <>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth="3" strokeDasharray="6,4" />
                <g transform={`translate(${mid.x}, ${mid.y})`}>
                  <rect x="-55" y="-14" width="110" height="28" rx="14" fill={badgeBg} stroke={color} strokeWidth="2" />
                  <text fontSize="12" fontWeight="800" textAnchor="middle" fill={textColor} dy="5" className="font-mono">
                    {displayDist()}
                  </text>
                </g>
              </>
            )
          })()}
        </svg>
      )}

      </div>

      {/* Floating Action Buttons for Clear Cotas / Clear Areas */}
      <div 
        className="absolute bottom-6 right-4 z-[120] flex flex-col gap-2 pointer-events-auto"
      >
        {dimensions.length > 0 && (
          <button
            onClick={() => setDimensions([])}
            className="text-xs font-bold text-white px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 border border-red-400 shadow-2xl transition-all flex items-center gap-2 backdrop-blur-md cursor-pointer transform active:scale-95"
            title="Borrar todas las cotas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Borrar Cotas ({dimensions.length})
          </button>
        )}
        {areas.length > 0 && (
          <button
            onClick={() => setAreas([])}
            className="text-xs font-bold text-white px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 border border-red-400 shadow-2xl transition-all flex items-center gap-2 backdrop-blur-md cursor-pointer transform active:scale-95"
            title="Borrar todas las áreas"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Borrar Áreas ({areas.length})
          </button>
        )}
      </div>
      {loading && (
        <div className={`absolute inset-0 ${isDarkMode ? 'bg-slate-950/80' : 'bg-white/80'} backdrop-blur-md flex items-center justify-center z-50`}>
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 border-4 border-nora-500/30 border-t-nora-500 animate-spin rounded-full"></div>
            <div className="text-center">
              <span className="block text-nora-500 font-mono text-xs tracking-widest uppercase mb-1">{loadingText}</span>
              <span className="text-slate-500 text-[10px] uppercase font-bold tracking-widest">Preparando geometría...</span>
            </div>
          </div>
        </div>
      )}

      {/* AutoCAD-style Layouts Bottom Bar (Modelo / Layout1 / Layout2) */}
      {availableLayouts.length > 0 && (
        <div className={`absolute bottom-3 left-4 z-40 flex items-center rounded-lg border shadow-2xl overflow-hidden backdrop-blur ${
          isDarkMode 
            ? 'bg-slate-950/95 border-slate-700 text-slate-300 shadow-black/80' 
            : 'bg-white/95 border-slate-300 text-slate-700 shadow-slate-300/80'
        }`}>
          <div className="flex items-center text-[11px] font-semibold divide-x divide-slate-700/50">
            {availableLayouts.map((lName) => {
              const isActive = activeLayout === lName
              return (
                <button
                  key={lName}
                  onClick={() => handleLayoutChange(lName)}
                  className={`px-3.5 py-1.5 flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? isDarkMode
                        ? 'bg-slate-800 text-white font-bold border-b-2 border-b-nora-400 shadow-inner'
                        : 'bg-slate-100 text-slate-900 font-bold border-b-2 border-b-nora-600 shadow-inner'
                      : isDarkMode
                        ? 'text-slate-400 hover:bg-slate-900/90 hover:text-white'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  title={`Ver ${lName === 'Modelo' ? 'Espacio Modelo' : 'Presentación ' + lName}`}
                >
                  <i className={`fa-regular ${lName === 'Modelo' ? 'fa-square' : 'fa-file-lines'} text-[11px] ${
                    isActive ? (isDarkMode ? 'text-nora-400' : 'text-nora-600') : 'opacity-60'
                  }`}></i>
                  <span>{lName}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="absolute bottom-6 left-6 bg-red-600/20 border border-red-600 px-4 py-2 rounded-xl z-50">
          <span className="text-[11px] text-red-200">{errorMsg}</span>
        </div>
      )}
    </div>
  )
}

export default DwgRenderer

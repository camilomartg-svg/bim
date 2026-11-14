import { useState, useEffect } from 'react'
import * as THREE from 'three'

export interface LayerInfo {
  name: string
  color: string
}

export const useLayers = (entityRoot: THREE.Object3D | null, file: File | null) => {
  const [layers, setLayers] = useState<LayerInfo[]>([])
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>({})

  // Load persisted layer configuration
  useEffect(() => {
    if (file) {
      const key = `dwg_layer_config_${file.name}`
      const saved = localStorage.getItem(key)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          setLayerVisibility(parsed)
        } catch (e) {
          console.error('Failed to load layer config', e)
        }
      }
    }
  }, [file])

  // Save layer configuration
  useEffect(() => {
    if (file && Object.keys(layerVisibility).length > 0) {
      const key = `dwg_layer_config_${file.name}`
      localStorage.setItem(key, JSON.stringify(layerVisibility))
    }
  }, [layerVisibility, file])

  const resolveLayerName = (obj: THREE.Object3D, knownLayers?: Set<string>): { name: string, isColorFallback: boolean } | null => {
    if (obj.userData?.isLayoutGroup || obj.userData?.isPaperSheet) return null
    if (obj.name && (obj.name.startsWith('Layout_') || obj.name === 'DXFRoot')) return null

    let layerName: any = null

    // 1. Direct userData.layer
    if (obj.userData?.layer) layerName = obj.userData.layer

    // 2. Nested in 'entity' property (dxf-parser / three-dxf-viewer structure)
    if (!layerName && obj.userData?.entity?.layer) layerName = obj.userData.entity.layer

    // 3. Parent's entity layer (e.g. inside a block or group)
    if (!layerName && obj.parent?.userData?.entity?.layer) layerName = obj.parent.userData.entity.layer
    if (!layerName && obj.parent?.userData?.layer) layerName = obj.parent.userData.layer

    // 4. Other common DXF keys
    if (!layerName && (obj as any).userData?.properties?.layer) layerName = (obj as any).userData.properties.layer
    if (!layerName && (obj as any).userData?.attribs?.layer) layerName = (obj as any).userData.attribs.layer
    if (!layerName && (obj as any).userData?.dxf?.layer) layerName = (obj as any).userData.dxf.layer

    // 5. Direct property on object
    if (!layerName && (obj as any).layer) layerName = (obj as any).layer

    // 6. Name of object or parent matching a known layer (three-dxf-loader creates groups named by layer)
    if (!layerName && knownLayers) {
      if (obj.name && knownLayers.has(obj.name)) layerName = obj.name
      else if (obj.parent && obj.parent.name && knownLayers.has(obj.parent.name)) layerName = obj.parent.name
    }

    // 7. Resolve object-style layer ( {name: 'Layer1', ...} )
    if (typeof layerName === 'object' && layerName !== null) {
       if (layerName.name) layerName = layerName.name
       else if (layerName.toString) layerName = layerName.toString()
    }

    if (layerName && typeof layerName === 'string') {
        return { name: layerName, isColorFallback: false }
    }

    // 8. If parent directly under root has a non-generic name (as in three-dxf-loader)
    if (
      obj.parent &&
      obj.parent.parent === null &&
      obj.parent.name &&
      !obj.parent.name.startsWith('Scene') &&
      !obj.parent.name.startsWith('Group') &&
      !obj.parent.name.startsWith('Layout_') &&
      obj.parent.name !== 'DXFRoot'
    ) {
      return { name: obj.parent.name, isColorFallback: false }
    }

    // 9. FALLBACK: Use Color if no layer found
    let colorHex: string | null = null
    if ((obj as any).material) {
        const mat = (obj as any).material
        if (Array.isArray(mat)) {
            if (mat[0]?.color) colorHex = '#' + mat[0].color.getHexString()
        } else if (mat.color) {
            colorHex = '#' + mat.color.getHexString()
        }
    }
    // If no material color, try vertex colors from geometry
    if (!colorHex && (obj as any).geometry?.attributes?.color) {
      const attr = (obj as any).geometry.attributes.color
      if (attr && attr.count >= 1 && attr.itemSize >= 3) {
        const r = Math.max(0, Math.min(255, Math.round(attr.getX(0) * 255)))
        const g = Math.max(0, Math.min(255, Math.round(attr.getY(0) * 255)))
        const b = Math.max(0, Math.min(255, Math.round(attr.getZ(0) * 255)))
        const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
        colorHex = '#' + hex
      }
    }

    if (colorHex) {
        return { name: `Color ${colorHex.toUpperCase()}`, isColorFallback: true }
    }

    return null
  }

  // Extract layers from entityRoot and DXF tables
  useEffect(() => {
    if (entityRoot) {
      const layerMap = new Map<string, string>()
      const knownLayers = new Set<string>()

      // 1. First add all DXF table layers if available
      const dxfLayers = entityRoot.userData?.dxfLayers || entityRoot.userData?.dxf?.tables?.layer?.layers || entityRoot.userData?.dxf?.tables?.layers
      if (dxfLayers && typeof dxfLayers === 'object') {
        Object.entries(dxfLayers).forEach(([k, val]: [string, any]) => {
          const lName = val?.name || k
          knownLayers.add(lName)
          let color = '#ffffff'
          if (val?.color !== undefined) {
            color = typeof val.color === 'number'
              ? '#' + val.color.toString(16).padStart(6, '0')
              : String(val.color)
          }
          layerMap.set(lName, color)
        })
      }

      // 2. Traverse scene objects
      entityRoot.traverse((obj) => {
        const result = resolveLayerName(obj, knownLayers)
        
        if (result) {
          obj.userData.layerId = result.name
          const layerName = result.name
          if (!layerMap.has(layerName)) {
            let color = '#ffffff'
            if (result.isColorFallback) {
              const hex = layerName.replace('Color ', '')
              if (hex.startsWith('#')) color = hex
            } else {
              if ((obj as any).material) {
                const mat = (obj as any).material
                if (Array.isArray(mat)) {
                  if (mat[0]?.color) color = '#' + mat[0].color.getHexString()
                } else if (mat.color) {
                  color = '#' + mat.color.getHexString()
                }
              }
            }
            layerMap.set(layerName, color)
          }
        } else {
          obj.userData.layerId = null
        }
      })

      const sortedLayers = Array.from(layerMap.entries())
        .map(([name, color]) => ({ name, color }))
        .sort((a, b) => a.name.localeCompare(b.name))
        
      setLayers(sortedLayers)
      
      // Init visibility
      setLayerVisibility(prev => {
        const next = { ...prev }
        sortedLayers.forEach(l => {
          if (next[l.name] === undefined) next[l.name] = true
        })
        return next
      })
    }
  }, [entityRoot])

  // Apply Layer Visibility
  useEffect(() => {
    if (!entityRoot) return
    entityRoot.traverse((obj) => {
      if (obj === entityRoot || obj.userData?.isLayoutGroup || obj.userData?.isPaperSheet) return
      if (obj.parent === entityRoot && obj.name && !obj.name.startsWith('Layout_') && layerVisibility[obj.name] !== undefined) {
        obj.visible = layerVisibility[obj.name] !== false
      }
      const layerName = obj.userData?.layerId
      if (layerName && layerVisibility[layerName] !== undefined) {
        if (obj.userData?.layoutVisible !== undefined) {
          obj.visible = (layerVisibility[layerName] !== false) && Boolean(obj.userData.layoutVisible)
        } else {
          obj.visible = layerVisibility[layerName] !== false
        }
      }
    })
  }, [layerVisibility, entityRoot])

  const toggleLayer = (layerName: string, force?: boolean) => {
    setLayerVisibility(prev => {
      const current = prev[layerName] !== false
      const nextVal = force !== undefined ? force : !current
      
      if (!nextVal) {
        const visibleCount = layers.filter(l => prev[l.name] !== false).length
        if (visibleCount <= 1 && current) {
          return prev
        }
      }
      
      return { ...prev, [layerName]: nextVal }
    })
  }

  const showAll = () => {
    const newVis = { ...layerVisibility }
    layers.forEach(l => newVis[l.name] = true)
    setLayerVisibility(newVis)
  }

  const hideAll = () => {
    const newVis = { ...layerVisibility }
    layers.forEach(l => newVis[l.name] = false)
    if (layers.length > 0) {
      newVis[layers[0].name] = true
    }
    setLayerVisibility(newVis)
  }

  return {
    layers,
    layerVisibility,
    setLayerVisibility,
    toggleLayer,
    showAll,
    hideAll
  }
}

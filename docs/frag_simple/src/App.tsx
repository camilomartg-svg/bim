import React, { useState, useRef, useEffect } from 'react';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import * as FRAGS from '@thatopen/fragments';
import * as WEBIFC from 'web-ifc';
import workerUrl from '@thatopen/fragments/worker?url';
import { 
  FileUp, 
  AlertCircle, 
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---
interface ConversionState {
  status: 'idle' | 'loading' | 'converting' | 'success' | 'error';
  message: string;
  fragBlob?: Blob;
  jsonBlob?: Blob;
  fileName?: string;
}

const getWorkerUrl = () => {
  try {
    return new URL(workerUrl, window.location.href).href;
  } catch {
    return workerUrl || "https://unpkg.com/@thatopen/fragments@3.3.6/dist/Worker/worker.mjs";
  }
};

function unwrapIfcValue(val: any): any {
  if (val == null) return null;
  if (typeof val === 'object') {
    if ('value' in val) return unwrapIfcValue(val.value);
    if (Array.isArray(val)) return val.map(unwrapIfcValue);
  }
  return val;
}

function shouldIncludeEntityType(typeName: string): boolean {
  if (!typeName) return false;
  const upper = typeName.toUpperCase();
  // Filter out pure internal geometric point/curve math to avoid massive JSON bloat without loss of properties
  const pureGeometry = /^(IFC)?(CARTESIANPOINT|DIRECTION|AXIS2PLACEMENT|AXIS1PLACEMENT|POLYLOOP|POLYLINE|INDEXEDPOLYCURVE|FACETEDBREP|FACE|EDGE|VERTEX|SURFACE|VECTOR|PLANE|BOUNDINGBOX|SHAPEREPRESENTATION|PRODUCTDEFINITIONSHAPE|GEOMETRICREPRESENTATION)/i;
  const semantic = /(PROPERTY|REL|QUANTITY|MATERIAL|TYPE|STYLE|PRESENTATION|CLASSIFICATION|PRODUCT|PROJECT|SITE|BUILDING|STOREY|ELEMENT|SYSTEM|GROUP|ZONE|SPATIAL|PORT|ACTUATOR|VALVE|PIPE|DUCT|BEAM|COLUMN|WALL|SLAB|DOOR|WINDOW|ROOF|STAIR|RAILING|COVERING|FOOTING|PLATE|MEMBER)/i;
  
  if (semantic.test(upper)) return true;
  if (pureGeometry.test(upper)) return false;
  return true;
}

async function extractCompleteIfcProperties(
  webIfc: WEBIFC.IfcAPI, 
  buffer: Uint8Array,
  onProgress?: (progress: number, msg: string) => void
): Promise<Record<string, any>> {
  const modelID = webIfc.OpenModel(buffer);
  try {
    onProgress?.(80, 'Indexando relaciones y parámetros IFC...');
    
    // 1. IFCRELDEFINESBYPROPERTIES: elements -> psets/qsets
    const elementToPsetIds = new Map<number, number[]>();
    try {
      const relDefinesIds = webIfc.GetLineIDsWithType(modelID, WEBIFC.IFCRELDEFINESBYPROPERTIES);
      const totalRels = relDefinesIds.size();
      for (let i = 0; i < totalRels; i++) {
        const relId = relDefinesIds.get(i);
        const rel = webIfc.GetLine(modelID, relId, false);
        if (rel && rel.RelatedObjects && rel.RelatingPropertyDefinition) {
          const psetId = unwrapIfcValue(rel.RelatingPropertyDefinition);
          if (typeof psetId === 'number') {
            const relObjects = Array.isArray(rel.RelatedObjects) ? rel.RelatedObjects : [rel.RelatedObjects];
            for (const obj of relObjects) {
              const elId = unwrapIfcValue(obj);
              if (typeof elId === 'number') {
                const list = elementToPsetIds.get(elId);
                if (list) list.push(psetId);
                else elementToPsetIds.set(elId, [psetId]);
              }
            }
          }
        }
      }
      relDefinesIds.delete?.();
    } catch (e) {
      console.warn('Warning indexing IFCRELDEFINESBYPROPERTIES:', e);
    }

    // 2. IFCRELDEFINESBYTYPE: element -> type
    const elementToTypeId = new Map<number, number>();
    try {
      const relTypesIds = webIfc.GetLineIDsWithType(modelID, WEBIFC.IFCRELDEFINESBYTYPE);
      const totalRelTypes = relTypesIds.size();
      for (let i = 0; i < totalRelTypes; i++) {
        const relId = relTypesIds.get(i);
        const rel = webIfc.GetLine(modelID, relId, false);
        if (rel && rel.RelatedObjects && rel.RelatingType) {
          const typeId = unwrapIfcValue(rel.RelatingType);
          if (typeof typeId === 'number') {
            const relObjects = Array.isArray(rel.RelatedObjects) ? rel.RelatedObjects : [rel.RelatedObjects];
            for (const obj of relObjects) {
              const elId = unwrapIfcValue(obj);
              if (typeof elId === 'number') {
                elementToTypeId.set(elId, typeId);
              }
            }
          }
        }
      }
      relTypesIds.delete?.();
    } catch (e) {
      console.warn('Warning indexing IFCRELDEFINESBYTYPE:', e);
    }

    // 3. IFCRELCONTAINEDINSPATIALSTRUCTURE: element -> spatial structure (Level / Storey)
    const elementToSpatialId = new Map<number, number>();
    try {
      const relSpatialIds = webIfc.GetLineIDsWithType(modelID, WEBIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE);
      const totalRelSpatial = relSpatialIds.size();
      for (let i = 0; i < totalRelSpatial; i++) {
        const relId = relSpatialIds.get(i);
        const rel = webIfc.GetLine(modelID, relId, false);
        if (rel && rel.RelatedElements && rel.RelatingStructure) {
          const structId = unwrapIfcValue(rel.RelatingStructure);
          if (typeof structId === 'number') {
            const relElements = Array.isArray(rel.RelatedElements) ? rel.RelatedElements : [rel.RelatedElements];
            for (const obj of relElements) {
              const elId = unwrapIfcValue(obj);
              if (typeof elId === 'number') {
                elementToSpatialId.set(elId, structId);
              }
            }
          }
        }
      }
      relSpatialIds.delete?.();
    } catch (e) {
      console.warn('Warning indexing IFCRELCONTAINEDINSPATIALSTRUCTURE:', e);
    }

    // 4. IFCRELASSOCIATESMATERIAL: element -> material
    const elementToMaterialId = new Map<number, number>();
    try {
      const relMaterialIds = webIfc.GetLineIDsWithType(modelID, WEBIFC.IFCRELASSOCIATESMATERIAL);
      const totalRelMat = relMaterialIds.size();
      for (let i = 0; i < totalRelMat; i++) {
        const relId = relMaterialIds.get(i);
        const rel = webIfc.GetLine(modelID, relId, false);
        if (rel && rel.RelatedObjects && rel.RelatingMaterial) {
          const matId = unwrapIfcValue(rel.RelatingMaterial);
          if (typeof matId === 'number') {
            const relObjects = Array.isArray(rel.RelatedObjects) ? rel.RelatedObjects : [rel.RelatedObjects];
            for (const obj of relObjects) {
              const elId = unwrapIfcValue(obj);
              if (typeof elId === 'number') {
                elementToMaterialId.set(elId, matId);
              }
            }
          }
        }
      }
      relMaterialIds.delete?.();
    } catch (e) {
      console.warn('Warning indexing IFCRELASSOCIATESMATERIAL:', e);
    }

    // Helper: Parse a Property Set or Element Quantity by expressID
    const resolvePset = (psetId: number): { psetName: string; props: Record<string, any> } | null => {
      try {
        const psetEntity = webIfc.GetLine(modelID, psetId, false);
        if (!psetEntity) return null;
        const psetName = unwrapIfcValue(psetEntity.Name) || `Pset_${psetId}`;
        const props: Record<string, any> = {};

        // HasProperties (IfcPropertySet)
        if (psetEntity.HasProperties && Array.isArray(psetEntity.HasProperties)) {
          for (const propRef of psetEntity.HasProperties) {
            const propId = unwrapIfcValue(propRef);
            if (typeof propId !== 'number') continue;
            const propLine = webIfc.GetLine(modelID, propId, false);
            if (!propLine) continue;
            const propName = unwrapIfcValue(propLine.Name);
            if (!propName) continue;

            if (propLine.NominalValue !== undefined) {
              props[propName] = unwrapIfcValue(propLine.NominalValue);
            } else if (propLine.EnumerationValues && Array.isArray(propLine.EnumerationValues)) {
              props[propName] = propLine.EnumerationValues.map(unwrapIfcValue);
            } else if (propLine.HasProperties && Array.isArray(propLine.HasProperties)) {
              const subProps: Record<string, any> = {};
              for (const subRef of propLine.HasProperties) {
                const subId = unwrapIfcValue(subRef);
                if (typeof subId === 'number') {
                  const subLine = webIfc.GetLine(modelID, subId, false);
                  if (subLine && subLine.Name) {
                    const subName = unwrapIfcValue(subLine.Name);
                    subProps[subName] = unwrapIfcValue(subLine.NominalValue ?? subLine.Description);
                  }
                }
              }
              props[propName] = subProps;
            } else {
              props[propName] = unwrapIfcValue(propLine.Description ?? true);
            }
          }
        }

        // Quantities (IfcElementQuantity)
        if (psetEntity.Quantities && Array.isArray(psetEntity.Quantities)) {
          for (const qRef of psetEntity.Quantities) {
            const qId = unwrapIfcValue(qRef);
            if (typeof qId !== 'number') continue;
            const qLine = webIfc.GetLine(modelID, qId, false);
            if (!qLine) continue;
            const qName = unwrapIfcValue(qLine.Name);
            if (!qName) continue;
            const val = unwrapIfcValue(
              qLine.LengthValue ?? 
              qLine.AreaValue ?? 
              qLine.VolumeValue ?? 
              qLine.CountValue ?? 
              qLine.WeightValue ?? 
              qLine.TimeValue ?? 
              qLine.NominalValue
            );
            if (val !== undefined) {
              props[qName] = val;
            }
          }
        }

        return { psetName: String(psetName), props };
      } catch {
        return null;
      }
    };

    // Helper: Material name resolver
    const resolveMaterialName = (matId: number): string | null => {
      try {
        const mat = webIfc.GetLine(modelID, matId, false);
        if (!mat) return null;
        if (mat.Name) return String(unwrapIfcValue(mat.Name));
        if (mat.ForLayerSet) {
          const layerSet = webIfc.GetLine(modelID, unwrapIfcValue(mat.ForLayerSet), false);
          if (layerSet && layerSet.LayerSetName) return String(unwrapIfcValue(layerSet.LayerSetName));
        }
        if (mat.MaterialLayers && Array.isArray(mat.MaterialLayers)) {
          const names: string[] = [];
          for (const lRef of mat.MaterialLayers) {
            const layer = webIfc.GetLine(modelID, unwrapIfcValue(lRef), false);
            if (layer && layer.Material) {
              const subMat = webIfc.GetLine(modelID, unwrapIfcValue(layer.Material), false);
              if (subMat && subMat.Name) names.push(String(unwrapIfcValue(subMat.Name)));
            }
          }
          if (names.length > 0) return names.join(' / ');
        }
        return null;
      } catch {
        return null;
      }
    };

    // Helper: Spatial structure name resolver (Storey / Level)
    const resolveSpatialName = (structId: number): string | null => {
      try {
        const struct = webIfc.GetLine(modelID, structId, false);
        if (!struct) return null;
        return unwrapIfcValue(struct.Name ?? struct.LongName) || null;
      } catch {
        return null;
      }
    };

    // Pre-cache Type property sets so elements get their type parameters attached
    const typePsetsCache = new Map<number, { typeName: string; psets: Record<string, any> }>();
    for (const typeId of new Set(elementToTypeId.values())) {
      try {
        const typeEntity = webIfc.GetLine(modelID, typeId, false);
        if (!typeEntity) continue;
        const typeName = unwrapIfcValue(typeEntity.Name) || '';
        const typePsets: Record<string, any> = {};

        // Property sets directly on the type (HasPropertySets)
        if (typeEntity.HasPropertySets && Array.isArray(typeEntity.HasPropertySets)) {
          for (const psetRef of typeEntity.HasPropertySets) {
            const pId = unwrapIfcValue(psetRef);
            if (typeof pId === 'number') {
              const parsed = resolvePset(pId);
              if (parsed) typePsets[parsed.psetName] = parsed.props;
            }
          }
        }

        // Property sets associated via IFCRELDEFINESBYPROPERTIES on the type
        const associatedPsets = elementToPsetIds.get(typeId);
        if (associatedPsets) {
          for (const pId of associatedPsets) {
            const parsed = resolvePset(pId);
            if (parsed) typePsets[parsed.psetName] = parsed.props;
          }
        }

        typePsetsCache.set(typeId, { typeName, psets: typePsets });
      } catch {}
    }

    // 5. Query semantic entities directly without loading millions of geometric coordinate lines
    onProgress?.(88, 'Extrayendo parámetros y propiedades de los elementos IFC...');
    const result: Record<string, any> = {};
    const entityIdsToProcess = new Set<number>();

    // Target semantic entity categories
    const targetCategories = [
      { type: WEBIFC.IFCPRODUCT, inherited: true },
      { type: WEBIFC.IFCTYPEPRODUCT, inherited: true },
      { type: WEBIFC.IFCPROJECT, inherited: true },
      { type: WEBIFC.IFCSITE, inherited: true },
      { type: WEBIFC.IFCBUILDING, inherited: true },
      { type: WEBIFC.IFCBUILDINGSTOREY, inherited: true },
      { type: WEBIFC.IFCSPACE, inherited: true },
      { type: WEBIFC.IFCMATERIAL, inherited: true }
    ];

    for (const cat of targetCategories) {
      try {
        const vec = webIfc.GetLineIDsWithType(modelID, cat.type, cat.inherited);
        const sz = vec.size();
        for (let i = 0; i < sz; i++) {
          entityIdsToProcess.add(vec.get(i));
        }
        vec.delete?.();
      } catch {}
    }

    // Include referenced types, materials and storeys directly so their semantic metadata is preserved
    for (const t of elementToTypeId.values()) entityIdsToProcess.add(t);
    for (const s of elementToSpatialId.values()) entityIdsToProcess.add(s);
    for (const m of elementToMaterialId.values()) entityIdsToProcess.add(m);

    const idsArray = Array.from(entityIdsToProcess);
    const totalEntities = idsArray.length;

    for (let i = 0; i < totalEntities; i++) {
      const expressID = idsArray[i];
      try {
        const line = webIfc.GetLine(modelID, expressID, false);
        if (!line) continue;

        const typeCode = line.type;
        if (typeof typeCode !== 'number') continue;

        const typeName = webIfc.GetNameFromTypeCode(typeCode);
        if (!typeName || !shouldIncludeEntityType(typeName)) continue;

        const entityData: any = { ...line };
        entityData.typeCode = typeCode;
        entityData.type = typeName;
        entityData.ifcType = typeName;

        // Normalize common attributes
        if (line.Name !== undefined) entityData.Name = unwrapIfcValue(line.Name);
        if (line.GlobalId !== undefined) entityData.GlobalId = unwrapIfcValue(line.GlobalId);
        if (line.Description !== undefined) entityData.Description = unwrapIfcValue(line.Description);
        if (line.ObjectType !== undefined) entityData.ObjectType = unwrapIfcValue(line.ObjectType);
        if (line.Tag !== undefined) entityData.Tag = unwrapIfcValue(line.Tag);

        // A. Resolve Instance Property Sets & Quantities
        const psetIds = elementToPsetIds.get(expressID);
        const psetsMap: Record<string, any> = {};
        if (psetIds) {
          for (const pId of psetIds) {
            const parsed = resolvePset(pId);
            if (parsed) {
              psetsMap[parsed.psetName] = { ...(psetsMap[parsed.psetName] || {}), ...parsed.props };
            }
          }
        }

        // B. Resolve Type Parameters (via IFCRELDEFINESBYTYPE)
        const typeId = elementToTypeId.get(expressID);
        if (typeId) {
          entityData.typeId = typeId;
          const cachedType = typePsetsCache.get(typeId);
          if (cachedType) {
            if (cachedType.typeName) entityData.typeName = cachedType.typeName;
            for (const [psetName, props] of Object.entries(cachedType.psets)) {
              psetsMap[psetName] = { ...(psetsMap[psetName] || {}), ...props };
            }
          }
        }

        // Attach resolved psets if any exist
        if (Object.keys(psetsMap).length > 0) {
          entityData.psets = psetsMap;

          // Flatten all pset properties directly onto entityData for immediate top-level access
          for (const psetProps of Object.values(psetsMap)) {
            if (psetProps && typeof psetProps === 'object') {
              for (const [propKey, propVal] of Object.entries(psetProps as Record<string, any>)) {
                if (entityData[propKey] === undefined && propVal !== undefined && propVal !== null) {
                  entityData[propKey] = propVal;
                }
              }
            }
          }
        }

        // C. Spatial Structure (Storey / Level)
        const spatialId = elementToSpatialId.get(expressID);
        if (spatialId) {
          entityData.spatialStructureId = spatialId;
          const spatialName = resolveSpatialName(spatialId);
          if (spatialName) {
            entityData.level = spatialName;
            entityData.storey = spatialName;
            if (entityData['NIVEL INTEGRADO'] === undefined) {
              entityData['NIVEL INTEGRADO'] = spatialName;
            }
          }
        }

        // D. Material
        const materialId = elementToMaterialId.get(expressID);
        if (materialId) {
          entityData.materialId = materialId;
          const matName = resolveMaterialName(materialId);
          if (matName) {
            entityData.material = matName;
            if (entityData['MATERIAL INTEGRADO'] === undefined) {
              entityData['MATERIAL INTEGRADO'] = matName;
            }
          }
        }

        result[String(expressID)] = entityData;
      } catch {}

      if (i % 150 === 0 && onProgress) {
        const pct = 88 + Math.floor((i / Math.max(1, totalEntities)) * 10);
        onProgress(pct, `Extrayendo parámetros (${i}/${totalEntities})...`);
      }
    }

    return result;
  } finally {
    webIfc.CloseModel(modelID);
  }
}

export default function App() {
  const [state, setState] = useState<ConversionState>({
    status: 'idle',
    message: 'Ready to convert your IFC file.'
  });

  const componentsRef = useRef<OBC.Components | null>(null);
  const fragmentsRef = useRef<OBC.FragmentsManager | null>(null);
  const loaderRef = useRef<OBC.IfcLoader | null>(null);

  useEffect(() => {
    // Initialize That Open Components
    const components = new OBC.Components();
    componentsRef.current = components;

    const fragments = components.get(OBC.FragmentsManager);
    fragmentsRef.current = fragments;

    try {
      fragments.init(getWorkerUrl());
    } catch (e) {
      console.warn("Error initializing fragments worker:", e);
    }

    const loader = components.get(OBC.IfcLoader);
    loaderRef.current = loader;

    // Prevent autoSetWasm from overwriting wasm path with incompatible unpkg semver (>=0.0.74 -> 0.0.78)
    loader.settings.autoSetWasm = false;
    loader.settings.wasm = {
      path: "https://unpkg.com/web-ifc@0.0.77/",
      absolute: true
    };

    // Clean up
    return () => {
      try {
        components.dispose();
      } catch {}
    };
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setState({
        status: 'error',
        message: 'Please select a valid .ifc file.'
      });
      return;
    }

    const baseName = file.name.replace(/\.ifc$/i, '');

    setState({
      status: 'loading',
      message: 'Reading file...',
      fileName: baseName
    });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          if (!buffer) return;

          setState(prev => ({ ...prev, status: 'converting', message: 'Converting IFC to Fragments...' }));

          const components = componentsRef.current!;
          const fragments = fragmentsRef.current!;
          const loader = loaderRef.current!;

          // Ensure fragments manager is initialized
          if (!fragments.initialized) {
            fragments.init(getWorkerUrl());
          }

          // Determine wasm path (prefer local wasm, fallback to unpkg 0.0.77)
          loader.settings.autoSetWasm = false;
          let wasmPath = "https://unpkg.com/web-ifc@0.0.77/";
          try {
            const localBase = new URL('./', window.location.href).href;
            const testRes = await fetch(new URL('web-ifc.wasm', localBase).href, { method: 'HEAD' });
            if (testRes.ok) {
              wasmPath = localBase;
            }
          } catch {}

          loader.settings.wasm = {
            path: wasmPath,
            absolute: true
          };

          // Initialize webIfc with forceSingleThread=true to prevent crossOriginIsolated MT worker crashes
          try {
            loader.webIfc.SetWasmPath(loader.settings.wasm.path, loader.settings.wasm.absolute);
            await loader.webIfc.Init(undefined, true);
          } catch (initErr) {
            console.warn("Manual webIfc init warning:", initErr);
          }

          // 1. Load IFC and convert to fragments (importing attributes)
          setState(prev => ({ ...prev, message: 'Convirtiendo geometría IFC a Fragments...' }));
          const model = await loader.load(new Uint8Array(buffer), true, file.name, {
            instanceCallback: (importer: any) => {
              if (typeof importer.addAllAttributes === 'function') importer.addAllAttributes();
            }
          });
          
          // 2. Export Fragments to .frag
          setState(prev => ({ ...prev, message: 'Exportando geometría a .frag...' }));
          let fragBuffer: ArrayBuffer | Uint8Array;
          if (typeof (model as any).getBuffer === 'function') {
            fragBuffer = await (model as any).getBuffer();
          } else if (typeof (fragments as any).export === 'function') {
            fragBuffer = (fragments as any).export(model);
          } else {
            throw new Error("No fragment export method found on model or manager.");
          }
          const fragBlob = new Blob([fragBuffer], { type: 'application/octet-stream' });

          // 3. Extract complete properties, parameters, Psets, Qsets, and relations to JSON
          setState(prev => ({ ...prev, message: 'Extrayendo todos los datos y parámetros IFC a JSON...' }));
          
          let properties: any = null;
          try {
            properties = await extractCompleteIfcProperties(
              loader.webIfc,
              new Uint8Array(buffer),
              (_pct, msg) => {
                setState(prev => ({ ...prev, message: msg }));
              }
            );
          } catch (extractErr) {
            console.warn("Complete extraction warning, attempting fallback:", extractErr);
          }

          if (!properties || Object.keys(properties).length === 0) {
            try {
              if (typeof (model as any).getLocalIds === 'function' && typeof (model as any).getItemsData === 'function') {
                const localIds = await (model as any).getLocalIds();
                const itemsData = await (model as any).getItemsData(localIds, {
                  attributesDefault: true,
                  relationsDefault: { attributes: true, relations: true }
                });
                properties = {};
                for (let i = 0; i < localIds.length; i++) {
                  const id = localIds[i];
                  properties[id] = itemsData[i] || { expressID: id };
                }
              }
            } catch (fallbackErr) {
              console.warn("Fallback getItemsData failed:", fallbackErr);
            }
          }

          if (!properties) {
            properties = {};
          }

          // 3b. Map ThatOpen fragment localIds directly to IFC entities so the JSON is indexed by BOTH localId and expressID!
          try {
            if (typeof (model as any).getLocalIds === 'function') {
              setState(prev => ({ ...prev, message: 'Vinculando elementos 3D con parámetros...' }));
              const localIds: number[] = await (model as any).getLocalIds();
              
              // Build lookups from IFC properties
              const byGuid = new Map<string, any>();
              const byTag = new Map<string, any>();
              const byName = new Map<string, any>();

              for (const [idStr, entity] of Object.entries(properties)) {
                if (!entity || typeof entity !== 'object') continue;
                if (entity.GlobalId) byGuid.set(String(entity.GlobalId).trim(), entity);
                if (entity.Tag) byTag.set(String(entity.Tag).trim(), entity);
                if (entity.Name) byName.set(String(entity.Name).trim(), entity);
              }

              // Get fragment items data or guids
              let fragmentItems: any[] = [];
              if (typeof (model as any).getItemsData === 'function') {
                try {
                  fragmentItems = await (model as any).getItemsData(localIds, { attributesDefault: true });
                } catch {}
              }

              let fragmentGuids: any[] = [];
              if (typeof (model as any).getGuidsByLocalIds === 'function') {
                try {
                  fragmentGuids = await (model as any).getGuidsByLocalIds(localIds);
                } catch {}
              }

              let matchedCount = 0;
              for (let i = 0; i < localIds.length; i++) {
                const localId = localIds[i];
                const item = fragmentItems[i] || {};
                const guid = String(fragmentGuids[i] || item._guid?.value || item.GlobalId?.value || item.GlobalId || '').trim();
                const tag = String(item.Tag?.value || item.Tag || '').trim();
                const name = String(item.Name?.value || item.Name || '').trim();

                const matchedEntity = (guid && byGuid.get(guid)) || 
                                     (tag && byTag.get(tag)) || 
                                     properties[String(localId)] || 
                                     (name && byName.get(name));

                if (matchedEntity) {
                  matchedEntity.localId = localId;
                  properties[String(localId)] = matchedEntity;
                  matchedCount++;
                }
              }
              console.log(`[FRAG_SIMPLE] Mapped ${matchedCount} / ${localIds.length} localIds directly to IFC entities.`);
            }
          } catch (mapErr) {
            console.warn('[FRAG_SIMPLE] Error mapping localIds to IFC properties:', mapErr);
          }

          const jsonBlob = new Blob([JSON.stringify(properties, null, 2)], { type: 'application/json' });

          // 4. Descarga automática por navegador (interceptada nativamente por WebView2 sin límites de memoria)
          try {
            const aFrag = document.createElement('a');
            aFrag.href = URL.createObjectURL(fragBlob);
            aFrag.download = `${baseName}.frag`;
            document.body.appendChild(aFrag);
            aFrag.click();
            aFrag.remove();

            setTimeout(() => {
              const aJson = document.createElement('a');
              aJson.href = URL.createObjectURL(jsonBlob);
              aJson.download = `${baseName}.json`;
              document.body.appendChild(aJson);
              aJson.click();
              aJson.remove();
            }, 300);
          } catch (dlErr) {
            console.warn("Auto-download warning:", dlErr);
          }

          // 5. Enviar señal de conversión a C# (con Base64 ligero si es pequeño)
          const fragBytes = new Uint8Array(fragBuffer);
          let fragBase64 = '';
          if (fragBytes.length < 5 * 1024 * 1024) {
            let binaryStr = '';
            const chunkSize = 8192;
            for (let i = 0; i < fragBytes.length; i += chunkSize) {
              binaryStr += String.fromCharCode.apply(null, Array.from(fragBytes.subarray(i, i + chunkSize)));
            }
            fragBase64 = btoa(binaryStr);
          }

          const jsonStr = JSON.stringify(properties, null, 2);
          let jsonBase64 = '';
          if (jsonStr.length < 5 * 1024 * 1024) {
            const jsonUtf8Bytes = new TextEncoder().encode(jsonStr);
            let jsonBinaryStr = '';
            const chunkSize = 8192;
            for (let i = 0; i < jsonUtf8Bytes.length; i += chunkSize) {
              jsonBinaryStr += String.fromCharCode.apply(null, Array.from(jsonUtf8Bytes.subarray(i, i + chunkSize)));
            }
            jsonBase64 = btoa(jsonBinaryStr);
          }

          if ((window as any).chrome && (window as any).chrome.webview) {
            (window as any).chrome.webview.postMessage({
              tipo: "CONVERSION_COMPLETA",
              nombreBase: baseName,
              fragBase64: fragBase64,
              jsonBase64: jsonBase64
            });
          }

          setState(prev => ({
            ...prev,
            status: 'success',
            message: 'Conversion complete!',
            fragBlob,
            jsonBlob
          }));

          // Clean up the model from memory to avoid leaks
          try {
            if (typeof (model as any).dispose === 'function') {
              await (model as any).dispose();
            } else if (typeof (fragments as any).disposeGroup === 'function') {
              (fragments as any).disposeGroup(model);
            }
          } catch (cleanupErr) {
            console.warn("Cleanup warning:", cleanupErr);
          }
        } catch (error) {
          console.error("Conversion error:", error);
          setState({
            status: 'error',
            message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      };

      reader.onerror = () => {
        setState({
          status: 'error',
          message: 'Error reading file.'
        });
      };

      reader.readAsArrayBuffer(file);

    } catch (error) {
      console.error(error);
      setState({
        status: 'error',
        message: `Conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  };

  const downloadFile = (blob: Blob, ext: string) => {
    if (!state.fileName) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.fileName}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleIniciarDescarga = () => {
    if (state.fragBlob) downloadFile(state.fragBlob, '.frag');
    setTimeout(() => {
      if (state.jsonBlob) downloadFile(state.jsonBlob, '.json');
    }, 250);
  };

  return (
    <div className="min-h-screen w-full bg-white text-[#141414] font-sans flex flex-col m-0 p-0">
      {/* Header con Logo de Nora BIM centrado */}
      <header className="w-full py-8 md:py-12 flex justify-center items-center bg-white shrink-0">
        <img 
          src="https://i.postimg.cc/SsS0K3Yn/LOGO-NORA-NEGRO.png" 
          alt="Nora BIM" 
          className="h-20 sm:h-24 md:h-28 w-auto object-contain"
        />
      </header>

      {/* Main Interface: La parte negra ocupa todo el espacio disponible de esa línea para abajo */}
      <main className="w-full flex-1 flex flex-col items-center justify-center bg-[#141414] text-[#E4E3E0] p-6 relative">
        <AnimatePresence mode="wait">
          {state.status === 'success' ? (
            <motion.div 
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full flex flex-col items-center justify-center"
            >
              <button 
                onClick={handleIniciarDescarga}
                className="w-full max-w-sm border border-[#2a2a2a] bg-[#1a1a1a] hover:bg-[#222222] hover:border-[#383838] text-white py-4 px-8 flex items-center justify-center font-bold tracking-widest text-base uppercase transition-all duration-300 shadow-xl cursor-pointer"
              >
                <span>INICIAR CARGA</span>
              </button>
            </motion.div>
          ) : state.status === 'loading' || state.status === 'converting' ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center text-center py-8"
            >
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-white" />
              <p className="text-sm font-mono uppercase tracking-wider text-white/80">{state.message}</p>
            </motion.div>
          ) : state.status === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center text-center py-8 text-rose-400"
            >
              <AlertCircle className="w-10 h-10 mb-4" />
              <p className="text-sm font-mono max-w-md mb-6">{state.message}</p>
              <button 
                onClick={() => setState({ status: 'idle', message: 'Ready to convert your IFC file.' })}
                className="border border-rose-400/60 hover:bg-rose-400 hover:text-[#141414] text-rose-400 px-6 py-2 text-xs font-mono uppercase transition-colors cursor-pointer"
              >
                Intentar de nuevo
              </button>
            </motion.div>
          ) : (
            /* Estado idle: La hojita sola y en el centro */
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex-1 flex items-center justify-center cursor-pointer group relative min-h-[300px]"
            >
              <input 
                type="file" 
                accept=".ifc" 
                onChange={handleFileUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                title="Seleccionar archivo IFC"
              />
              <FileUp className="w-10 h-10 text-white/40 group-hover:text-white group-hover:scale-110 transition-all duration-300 pointer-events-none" />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
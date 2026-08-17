# Cómo ver todos los tipos de archivo 3D

## Problema
Actualmente solo ves archivos `.frag` en el panel de modelos. Los otros 26+ tipos de archivo (.ifc, .rvt, .rfa, etc.) no aparecen aunque estén en tu carpeta o Drive.

## Solución

### Opción 1: Archivos locales en la carpeta `Models/`

1. **Copia tus archivos 3D** a la carpeta `Models/` (en el mismo directorio que `models.json`)
   - `Models/19_ZI_ALL_Arquitectura.ifc`
   - `Models/proyecto.rvt`
   - `Models/nube_puntos.e57`
   - etc.

2. **Regenera `models.json`** usando el script generador:
   - Abre la consola del navegador (F12)
   - Copia y pega el contenido de `generate-models-json.js`
   - Ejecuta: `generateModelsJson()`
   - Se descargará un archivo `models.json` actualizado
   - Reemplaza el archivo actual con el nuevo

3. **Recarga la página** (Ctrl + F5)

### Opción 2: Archivos en Google Drive

1. **Sube tus archivos 3D** a Google Drive en la carpeta de tu proyecto:
   - Debe estar en: `[DRIVE_ROOT]/[TU_PROYECTO]/`
   - Tipos soportados: .ifc, .rvt, .rfa, .rte, .pln, .pla, .mod, .imodel, .vwx, .ndw, .cyp, .nwc, .nwf, .nwd, .smc, .e57, .pts, .xyz, .las, .laz, .rcp, .rcs

2. **El backend detectará automáticamente** todos los tipos de archivo

3. **Regenera `models.json`** desde el backend:
   ```javascript
   // En la consola del navegador:
   const response = await fetch('https://script.google.com/macros/d/{DEPLOYMENT_ID}/usercallback', {
     method: 'POST',
     body: JSON.stringify({
       action: 'list',
       folderId: '1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H'
     })
   });
   const data = await response.json();
   console.log(JSON.stringify(data.allModels, null, 2));
   ```

### Opción 3: Actualizar models.json manualmente

Si tienes archivos en otra ubicación, puedes editar `models.json` manualmente:

```json
[
  {
    "name": "Mi modelo IFC",
    "path": "ruta/al/archivo.ifc",
    "folder": "Auto"
  },
  {
    "name": "Mi proyecto Revit",
    "path": "ruta/al/archivo.rvt",
    "folder": "Auto"
  },
  {
    "name": "Nube de puntos",
    "path": "ruta/al/archivo.e57",
    "folder": "Auto"
  }
]
```

## Verificación

Después de realizar los cambios:

1. Recarga la página (Ctrl + F5 para limpiar caché)
2. Abre la consola del navegador (F12)
3. Deberías ver en la consola:
   ```
   [Enhanced Loader] Loaded 27 files
   [Enhanced Loader] Successfully organized 10 file type categories
   ```

4. En el panel lateral, deberías ver grupos organizados por tipo:
   - ✅ Fragmentos (FRAG)
   - ✅ Modelos IFC
   - ✅ Datos JSON
   - ✅ Revit (RVT)
   - etc.

## Troubleshooting

### No aparecen los archivos nuevos

**Causa**: El caché del navegador está guardando la versión antigua de models.json

**Solución**:
- Limpia el caché (Ctrl + Shift + Delete)
- Recarga con Ctrl + F5
- Abre en modo incógnito

### El archivo models.json no se actualiza

**Causa**: El archivo está read-only o en una carpeta protegida

**Solución**:
- Verifica que tengas permiso de escritura
- Descarga el nuevo JSON desde el navegador (generate-models-json.js)
- Reemplaza el archivo manualmente

### El backend no detecta los nuevos archivos

**Causa**: Los archivos no están en la carpeta correcta o no tienen extensión compatible

**Solución**:
- Verifica que los archivos tengan la extensión correcta (.ifc, .rvt, etc.)
- Asegúrate de que estén en la carpeta del proyecto
- Recarga la página

## Tipos de archivo soportados (26+)

| Tipo | Extensiones | Uso |
|------|-------------|-----|
| **Fragmentos** | .frag | Modelos pre-compilados |
| **BIM/Arquitectura** | .ifc, .rvt, .rfa, .rte, .pln, .pla | Modelos de construcción |
| **CAD** | .dwg, .dxf, .mod, .ndw, .cyp | Dibujos CAD 2D/3D |
| **Web3D** | .imodel, .vwx, .citygml, .landxml | Modelos web y GIS |
| **Navisworks** | .nwc, .nwf, .nwd | Coordinación BIM |
| **Otros** | .smc, .json | SketchUp, datos |
| **Nubes de puntos** | .e57, .pts, .xyz, .las, .laz, .rcp, .rcs | Escaneos láser |

## Notas técnicas

- **Backend**: `google_script.js` detecta automáticamente todos los tipos
- **Frontend**: `enhanced-model-loader.js` agrupa por tipo y muestra en la UI
- **Generador**: `generate-models-json.js` crea modelos.json dinámicamente
- **Cache**: Se usa `?t=Date.now()` para evitar caché en desarrollo

## Más información

Véase también:
- [ENHANCED_LOADER_README.md](ENHANCED_LOADER_README.md)
- [google_script.js](../../google_script.js) - Backend

---

**¿Aún tienes problemas?**

1. Abre la consola del navegador (F12)
2. Recarga la página
3. Busca mensajes de error en la consola
4. Verifica los logs: `[Enhanced Loader]`

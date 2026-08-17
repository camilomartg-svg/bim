# Enhanced Model Loader - Agrupación por Tipo de Archivo

## Descripción

El script `enhanced-model-loader.js` reemplaza la funcionalidad de carga de modelos estándar para agrupar los archivos por **tipo de archivo** en lugar de por carpeta.

### Características

✅ **Agrupa archivos por tipo**: .frag, .ifc, .json, .landxml, .citygml, .rvt, .rfa, etc.  
✅ **Iconos por tipo**: Cada tipo de archivo tiene un icono distintivo  
✅ **Secciones expandibles/colapsibles**: Expande/contrae grupos de archivos  
✅ **Contador de archivos**: Muestra cuántos archivos hay en cada categoría  
✅ **Interfaz mejorada**: Mejor visualización y navegación  

---

## Tipos de archivo soportados

| Extensión | Tipo | Orden |
|-----------|------|-------|
| `.frag` | Fragmentos (FRAG) | 1 |
| `.ifc` | Modelos IFC | 2 |
| `.json` | Datos JSON | 3 |
| `.landxml` | LandXML | 4 |
| `.citygml` | CityGML | 5 |
| `.rvt` | Revit (RVT) | 6 |
| `.rfa` | Revit Family (RFA) | 7 |
| `.rte` | Revit Template (RTE) | 8 |
| `.pln` | ArchiCAD (PLN) | 9 |
| `.pla` | Planar | 10 |
| `.mod` | Modelos (MOD) | 11 |
| `.imodel` | iModel | 12 |
| `.vwx` | Vectorworks (VWX) | 13 |
| `.ndw` | Microstation (NDW) | 14 |
| `.cyp` | Cyclone (CYP) | 15 |
| `.nwc` | Navisworks Cache (NWC) | 16 |
| `.nwf` | Navisworks File (NWF) | 17 |
| `.nwd` | Navisworks Dataset (NWD) | 18 |
| `.smc` | Sketch-Up Modelo | 19 |
| `.e57` | E57 (Nube de puntos) | 20 |
| `.pts` | PTS (Nube de puntos) | 21 |
| `.xyz` | XYZ (Nube de puntos) | 22 |
| `.las` | LAS (Nube de puntos) | 23 |
| `.laz` | LAZ (Nube de puntos comprimida) | 24 |
| `.rcp` | ReCap Project (RCP) | 25 |
| `.rcs` | ReCap Scan (RCS) | 26 |

---

## Instalación

El script ya está integrado en el `index.html` y se carga automáticamente.

### Si necesitas instalarlo manualmente:

1. Coloca `enhanced-model-loader.js` en el mismo directorio que `index.html`
2. Añade esta línea antes de `</head>` en tu HTML:

```html
<script defer src="./enhanced-model-loader.js"></script>
```

---

## Estructura de datos (models.json)

El formato esperado de `models.json` debe tener:

```json
[
  {
    "name": "Nombre del archivo",
    "path": "ruta/relativa/archivo.frag",
    "folder": "Carpeta original (opcional)"
  },
  ...
]
```

---

## Funcionalidad

### Expandir/Contraer grupos

Haz clic en el encabezado del grupo para expandir/contraer todos los archivos de ese tipo.

### Cargar un modelo

Haz clic en un archivo para cargarlo en el visor. El icono de ojo cambiará de `👁‍🗨️` (no visible) a `👁️` (visible).

### Ocultar un modelo

Haz clic nuevamente en el archivo para ocultarlo.

---

## Personalización

### Agregar un nuevo tipo de archivo

Edita `FILE_TYPE_CONFIG` en `enhanced-model-loader.js`:

```javascript
const FILE_TYPE_CONFIG = {
  '.nuevo': { name: 'Descripción', icon: 'fa-icon-name', order: 27 },
  // ... otros tipos
};
```

### Cambiar iconos

Usa cualquier icono de [Font Awesome 6](https://fontawesome.com/):

```javascript
'.nwc': { name: 'Navisworks', icon: 'fa-cubes', order: 16 }
```

---

## Solución de problemas

### Los modelos no se cargan

Verifica que `models.json` esté en el mismo directorio que `index.html`.

### El script no se ejecuta

Comprueba la consola del navegador (F12) para mensajes de error.

### Los iconos no aparecen

Asegúrate de que Font Awesome 6 esté cargado en el HTML:

```html
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
```

---

## Notas técnicas

- El script se ejecuta después de que el DOM esté listo
- Los grupos se ordenan automáticamente por la propiedad `order`
- Los archivos dentro de cada grupo se ordenan alfabéticamente
- El contador de archivos se actualiza automáticamente

---

## Autor

Creado para mejorar la visualización de modelos 3D en el visor NORA.

**Última actualización**: 2026-08-17

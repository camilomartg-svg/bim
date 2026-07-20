export interface CdeFeature {
  id: string;
  title: string;
  shortDesc: string;
  category: string;
}

export const cdeBimProperties: CdeFeature[] = [
  { 
    id: "3d", 
    title: "Visualización 3D IFC", 
    shortDesc: "Modelado geométrico federado y visualización espacial completa de disciplinas.",
    category: "Modelo 3D"
  },
  { 
    id: "4d", 
    title: "Planificación Temporal 4D", 
    shortDesc: "Sincronización del cronograma de obra con los componentes tridimensionales del modelo.",
    category: "Simulación 4D"
  },
  { 
    id: "5d", 
    title: "Costos y Presupuestos 5D", 
    shortDesc: "Estimación financiera dinámica vinculada en tiempo real a los cambios de diseño.",
    category: "Presupuestos 5D"
  },
  { 
    id: "viewer", 
    title: "Visor de Modelos IFC", 
    shortDesc: "Lectura rápida de archivos IFC bajo estándar abierto e interoperable (ISO 16739).",
    category: "Interoperabilidad"
  },
  { 
    id: "quantities", 
    title: "Extracción de Cantidades", 
    shortDesc: "Generación automatizada de volumetrías, áreas y conteos de materiales sin error humano.",
    category: "Cómputos Métricos"
  },
  { 
    id: "tracking", 
    title: "Seguimiento de Proyectos", 
    shortDesc: "Monitoreo del avance físico real y marcación visual del estado de obra en campo.",
    category: "Control de Obra"
  },
  { 
    id: "offline", 
    title: "Carga y Acceso Offline", 
    shortDesc: "Consulta y anotación local en el modelo sin conexión a internet (sótanos o zonas rurales).",
    category: "Sincronización"
  },
  { 
    id: "sections", 
    title: "Cortes de Obra Interactivos", 
    shortDesc: "Planos de sección dinámicos e instantáneos sobre cualquier eje del gemelo digital.",
    category: "Análisis Seccional"
  },
  { 
    id: "incidences", 
    title: "Incidencias Personalizadas", 
    shortDesc: "Reporte colaborativo y georreferenciado de hallazgos mediante el estándar BCF.",
    category: "Gestión de Cambios"
  },
  { 
    id: "coaching", 
    title: "Acompañamiento en Procesos BIM", 
    shortDesc: "Estructuración estratégica del Entorno Común de Datos (CDE) bajo norma ISO 19650.",
    category: "Implementación"
  },
  { 
    id: "colombia", 
    title: "Enfoque en Colombia", 
    shortDesc: "Alineación total con las directrices de Camacol, el IDU, la ANI y el Mandato Nacional.",
    category: "Normativa Nacional"
  }
];

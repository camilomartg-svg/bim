export interface DepartmentBimData {
  id: string;
  name: string;
  adoptionRate: number; // Percentage
  maturityLevel: string; // e.g. "Nivel 2: Colaborativo"
  activeProjects: number;
  specialistsCount: number;
  publicSectorInvolvement: "Alta" | "Media" | "Inicial";
  keyUse: string;
  projects: {
    name: string;
    description: string;
  }[];
  overview: string;
}

export const colombiaBimOverview = {
  strategy2026: "El año 2026 marca el hito definitivo de la Estrategia Nacional BIM de Colombia, estableciendo el mandato del 100% para el uso de BIM en proyectos de construcción públicos. Coordinado por el DNP, Camacol y el BIM Forum Colombia, el país lidera la transformación digital de la infraestructura en la región.",
  pillars: [
    { title: "Mandato Público", desc: "Exigencia del 100% en licitaciones públicas de infraestructura y edificación para 2026." },
    { title: "Estandarización", desc: "Uso de estándares nacionales e internacionales (ISO 19650) alineados con el BIM Kit de Colombia." },
    { title: "Talento Humano", desc: "Capacitación masiva de ingenieros, arquitectos y gestores públicos en tecnologías de modelado." }
  ]
};

export const bimDataByDepartment: Record<string, DepartmentBimData> = {
  dc: {
    id: "dc",
    name: "Bogotá D.C.",
    adoptionRate: 88,
    maturityLevel: "Nivel 2+: Colaborativo Avanzado",
    activeProjects: 142,
    specialistsCount: 3800,
    publicSectorInvolvement: "Alta",
    keyUse: "Coordinación 3D, Planificación 4D y Estimación de Costos 5D",
    projects: [
      { name: "Primera Línea del Metro de Bogotá", description: "Uso de modelos BIM federados para la coordinación de la infraestructura ferroviaria, viaductos y estaciones." },
      { name: "Regiotram de Occidente", description: "Modelado BIM para la integración del tren ligero de cercanías conectando Bogotá con la sabana." },
      { name: "Ampliación Aeropuerto El Dorado", description: "BIM aplicado al mantenimiento preventivo y optimización de flujos de pasajeros." }
    ],
    overview: "Como epicentro administrativo, Bogotá lidera la adopción BIM en Colombia. Cuenta con el mayor ecosistema de firmas consultoras, constructoras y entidades públicas que aplican el estándar nacional de forma rigurosa."
  },
  ant: {
    id: "ant",
    name: "Antioquia",
    adoptionRate: 85,
    maturityLevel: "Nivel 2: Colaborativo",
    activeProjects: 115,
    specialistsCount: 2900,
    publicSectorInvolvement: "Alta",
    keyUse: "Simulación Constructiva, Sostenibilidad (6D) y Prefabricación",
    projects: [
      { name: "Túnel de Oriente", description: "Modelado estructural avanzado para la excavación y sistemas electromecánicos del túnel vial." },
      { name: "Parques del Río Medellín", description: "Coordinación paisajística y de redes subterráneas mediante modelos tridimensionales." },
      { name: "Puerto Antioquia", description: "Desarrollo del complejo portuario en Urabá utilizando gemelos digitales." }
    ],
    overview: "Antioquia se destaca por una sinergia excepcional entre la academia (EAFIT, UPB, UNAL), el gremio constructor (Camacol Antioquia) y el sector público, convirtiéndose en pionero de la digitalización constructiva."
  },
  vac: {
    id: "vac",
    name: "Valle del Cauca",
    adoptionRate: 74,
    maturityLevel: "Nivel 2: Colaborativo",
    activeProjects: 68,
    specialistsCount: 1400,
    publicSectorInvolvement: "Alta",
    keyUse: "Detección de Interferencias y Coordinación de Redes MEPT",
    projects: [
      { name: "Tren de Cercanías del Valle", description: "Fase de pre-construcción coordinada digitalmente para asegurar trazados urbanos eficientes." },
      { name: "Nueva Terminal de Pasajeros de Cali", description: "Modelado detallado de estructuras de gran luz y redes de ventilación complejas." }
    ],
    overview: "El Valle del Cauca ha acelerado su adopción BIM enfocándose en proyectos de infraestructura logística y de transporte multimodal, impulsando la competitividad de la región suroccidental."
  },
  atl: {
    id: "atl",
    name: "Atlántico",
    adoptionRate: 71,
    maturityLevel: "Nivel 2: Colaborativo",
    activeProjects: 52,
    specialistsCount: 1100,
    publicSectorInvolvement: "Alta",
    keyUse: "Gestión Ambiental, Interventoría Digital y Control de Obra",
    projects: [
      { name: "Gran Malecón del Río", description: "Coordinación del espacio público, geotecnia frente al Río Magdalena y zonas comerciales." },
      { name: "Puerta de Oro Centro de Eventos", description: "Optimización estructural y diseño acústico modelado bajo estándares BIM." }
    ],
    overview: "La Costa Caribe, liderada por el Atlántico, ha integrado BIM para la modernización urbana y turística de Barranquilla, destacando el control de costos e interventoría digital."
  },
  san: {
    id: "san",
    name: "Santander",
    adoptionRate: 65,
    maturityLevel: "Nivel 2: Colaborativo Inicial",
    activeProjects: 39,
    specialistsCount: 750,
    publicSectorInvolvement: "Media",
    keyUse: "Planificación Vial e Ingeniería de Detalle",
    projects: [
      { name: "Ruta del Cacao", description: "Proyecto de cuarta generación vial con modelado de túneles, puentes y taludes inestables." },
      { name: "Modernización Aeropuerto Palonegro", description: "Ampliación de terminal y pistas coordinada tridimensionalmente para no interrumpir operaciones." }
    ],
    overview: "Santander posee una fuerte tradición en ingeniería civil que ha facilitado la transición a procesos BIM, especialmente en autopistas de montaña y obras hidráulicas."
  },
  cun: {
    id: "cun",
    name: "Cundinamarca",
    adoptionRate: 70,
    maturityLevel: "Nivel 2: Colaborativo",
    activeProjects: 48,
    specialistsCount: 950,
    publicSectorInvolvement: "Alta",
    keyUse: "Planificación del Territorio y Obras Civiles",
    projects: [
      { name: "Regiotram del Norte", description: "Planeación e integración territorial con modelos GIS-BIM interconectados." },
      { name: "Autopistas Conexión Sabana", description: "Modelado de intercambiadores viales y puentes para optimizar la movilidad periférica." }
    ],
    overview: "Trabajando en conjunto con el Distrito Capital, Cundinamarca adopta BIM con énfasis en la conexión de servicios, infraestructura de transporte intermunicipal y equipamientos educativos."
  },
  bol: {
    id: "bol",
    name: "Bolívar",
    adoptionRate: 58,
    maturityLevel: "Nivel 1-2: Transición Colaborativa",
    activeProjects: 28,
    specialistsCount: 520,
    publicSectorInvolvement: "Media",
    keyUse: "Restauración de Patrimonio e Infraestructura Portuaria",
    projects: [
      { name: "Viaducto Gran Manglar", description: "Modelado de alta precisión para minimizar el impacto ecológico en la ciénaga de la virgen." },
      { name: "Restauración del Centro Histórico", description: "Uso de escaneo láser (Point Clouds) integrado a BIM para conservar fachadas históricas." }
    ],
    overview: "Bolívar enfoca la metodología BIM en dos frentes singulares: el desarrollo de infraestructura marítima y portuaria, y la preservación digital de su invaluable arquitectura patrimonial en Cartagena."
  },
  boy: {
    id: "boy",
    name: "Boyacá",
    adoptionRate: 52,
    maturityLevel: "Nivel 1: Modelado 3D Inicial",
    activeProjects: 18,
    specialistsCount: 310,
    publicSectorInvolvement: "Media",
    keyUse: "Equipamientos Públicos y Hospitales",
    projects: [
      { name: "Hospital San Rafael de Tunja", description: "Modelado de instalaciones hospitalarias complejas y salas de alta especialidad médica." },
      { name: "Terminal de Transportes de Sogamoso", description: "Simulación de flujos de aire y eficiencia energética en cubiertas metálicas." }
    ],
    overview: "Boyacá avanza progresivamente gracias a los mandatos nacionales, capacitando a sus secretarías de infraestructura para la revisión de entregables BIM en obras públicas locales."
  },
  cal: {
    id: "cal",
    name: "Caldas",
    adoptionRate: 61,
    maturityLevel: "Nivel 2: Colaborativo Inicial",
    activeProjects: 22,
    specialistsCount: 410,
    publicSectorInvolvement: "Media",
    keyUse: "Infraestructura de Transporte y Topografía Compleja",
    projects: [
      { name: "Aeropuerto del Café (Aerocafé)", description: "Planificación de explanaciones y movimiento de tierras en topografía andina compleja." },
      { name: "Intercambiador Vial Manizales", description: "Optimización de redes de servicios públicos en zonas urbanas densas." }
    ],
    overview: "Caldas impulsa el BIM a través de la red de universidades de Manizales, priorizando proyectos de mitigación del riesgo geológico y movilidad de montaña."
  },
  ris: {
    id: "ris",
    name: "Risaralda",
    adoptionRate: 63,
    maturityLevel: "Nivel 2: Colaborativo Inicial",
    activeProjects: 25,
    specialistsCount: 440,
    publicSectorInvolvement: "Media",
    keyUse: "Edificación Sostenible y Logística de Obra",
    projects: [
      { name: "Clínica de Alta Complejidad Pereira", description: "Coordinación milimétrica de gases medicinales e instalaciones eléctricas críticas." },
      { name: "Sede Universidad Tecnológica", description: "Diseño bioclimático simulado digitalmente mediante modelos solares integrados." }
    ],
    overview: "Con un fuerte impulso de las constructoras privadas locales, Risaralda enfoca el uso de BIM en desarrollos residenciales de alta densidad y centros de salud modernos."
  },
  qui: {
    id: "qui",
    name: "Quindío",
    adoptionRate: 57,
    maturityLevel: "Nivel 1-2: Transición",
    activeProjects: 14,
    specialistsCount: 280,
    publicSectorInvolvement: "Media",
    keyUse: "Arquitectura Paisajística y Hotelería Sostenible",
    projects: [
      { name: "Túnel de la Línea (Conexión Quindío)", description: "Actualización de planos y as-built para la gestión del mantenimiento de los viaductos de acceso." },
      { name: "Ecoparques y Resorts del Quindío", description: "Modelado de estructuras de madera laminada y materiales vernáculos sostenibles." }
    ],
    overview: "El departamento del Quindío se apalanca en el auge del turismo sostenible y su infraestructura de transporte de conexión nacional para capacitar constructores locales en modelado 3D y análisis de costos."
  },
  tol: {
    id: "tol",
    name: "Tolima",
    adoptionRate: 54,
    maturityLevel: "Nivel 1: Modelado 3D",
    activeProjects: 19,
    specialistsCount: 330,
    publicSectorInvolvement: "Media",
    keyUse: "Distritos de Riego y Centros Educativos",
    projects: [
      { name: "Complejo Deportivo de Ibagué", description: "Modelado BIM para garantizar la precisión de estructuras metálicas de grandes luces." },
      { name: "Modernización Distrito de Riego Coello", description: "Planificación tridimensional de canales de conducción y compuertas automáticas." }
    ],
    overview: "En Tolima, la adopción se consolida en la edificación institucional y el desarrollo de distritos agrícolas tecnificados, guiados por lineamientos del Ministerio de Agricultura."
  },
  hui: {
    id: "hui",
    name: "Huila",
    adoptionRate: 51,
    maturityLevel: "Nivel 1: Modelado 3D",
    activeProjects: 12,
    specialistsCount: 210,
    publicSectorInvolvement: "Media",
    keyUse: "Proyectos Viales e Infraestructura de Servicios",
    projects: [
      { name: "Ruta de los Libertadores", description: "Planificación de puentes peatonales y vehiculares sobre la cuenca del Río Magdalena." }
    ],
    overview: "Huila fomenta talleres regionales junto con el SENA para formar modeladores locales, reduciendo la brecha técnica en la contratación de infraestructura vial secundaria."
  },
  ces: {
    id: "ces",
    name: "Cesar",
    adoptionRate: 48,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 11,
    specialistsCount: 190,
    publicSectorInvolvement: "Inicial",
    keyUse: "Vivienda de Interés Social (VIS) y Equipamientos Municipales",
    projects: [
      { name: "Centro Cultural de la Música Vallenata", description: "Modelado geométrico complejo de fachadas curvas y auditorios acústicos en Valledupar." }
    ],
    overview: "En el Cesar, la adopción de BIM está liderada por proyectos arquitectónicos emblemáticos en la capital y el diseño parametrizado de planes de vivienda masiva."
  },
  mag: {
    id: "mag",
    name: "Magdalena",
    adoptionRate: 55,
    maturityLevel: "Nivel 1-2: Transición",
    activeProjects: 18,
    specialistsCount: 320,
    publicSectorInvolvement: "Media",
    keyUse: "Infraestructura Hotelera e Intervenciones Urbanas Costeras",
    projects: [
      { name: "Remodelación Corredor Turístico de El Rodadero", description: "Modelado de redes de servicios subterráneos expuestos a la salinidad y marea." }
    ],
    overview: "Magdalena aprovecha las ventajas de BIM en la planificación del turismo frente al mar y la optimización de los sistemas de acueducto y alcantarillado de Santa Marta."
  },
  met: {
    id: "met",
    name: "Meta",
    adoptionRate: 53,
    maturityLevel: "Nivel 1: Modelado 3D",
    activeProjects: 15,
    specialistsCount: 250,
    publicSectorInvolvement: "Media",
    keyUse: "Infraestructura Vial y Sector Hidrocarburos",
    projects: [
      { name: "Doble Calzada Bogotá-Villavicencio", description: "Modelado de taludes, viaductos de gran altura y túneles en zonas de alta sismicidad." }
    ],
    overview: "Meta vincula los flujos de trabajo BIM a proyectos de vialidad de alta montaña para conectar los Llanos Orientales, además de aplicaciones en plantas de tratamiento industriales."
  },
  cor: {
    id: "cor",
    name: "Córdoba",
    adoptionRate: 46,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 10,
    specialistsCount: 160,
    publicSectorInvolvement: "Inicial",
    keyUse: "Obras Hidráulicas y Control de Inundaciones",
    projects: [
      { name: "Sistemas de Contención del Río Sinú", description: "Modelado BIM-GIS para simular y diseñar diques y malecones de protección en Montería." }
    ],
    overview: "Córdoba avanza en la digitalización de la infraestructura agrícola e hidráulica, buscando mitigar los impactos del cambio climático mediante diseños adaptativos en 3D."
  },
  nsa: {
    id: "nsa",
    name: "Norte de Santander",
    adoptionRate: 58,
    maturityLevel: "Nivel 1-2: Transición",
    activeProjects: 21,
    specialistsCount: 380,
    publicSectorInvolvement: "Media",
    keyUse: "Infraestructura de Frontera y Educación",
    projects: [
      { name: "Puente Internacional Atanasio Girardot", description: "Coordinación binacional del puente y edificios de control aduanero modelados digitalmente." }
    ],
    overview: "Ubicado estratégicamente en la frontera, Norte de Santander adopta BIM para optimizar proyectos de aduanas, centros logísticos de comercio y conectividad vial."
  },
  nar: {
    id: "nar",
    name: "Nariño",
    adoptionRate: 50,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 13,
    specialistsCount: 220,
    publicSectorInvolvement: "Media",
    keyUse: "Mitigación Volcánica y Conectividad Vial",
    projects: [
      { name: "Doble Calzada Pasto-Rumichaca", description: "Modelado estructural de puentes emblemáticos en la cordillera andina del sur del país." }
    ],
    overview: "Nariño implementa BIM en sus grandes desafíos de conectividad andina y fronteriza con Ecuador, promoviendo el desarrollo de estructuras sismorresistentes avanzadas."
  },
  cau: {
    id: "cau",
    name: "Cauca",
    adoptionRate: 45,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 8,
    specialistsCount: 140,
    publicSectorInvolvement: "Inicial",
    keyUse: "Edificación Institucional y Redes Comunitarias",
    projects: [
      { name: "Hospital de Alta Complejidad de Popayán", description: "Planificación espacial y de equipos biomédicos críticos con modelos BIM." }
    ],
    overview: "Cauca se enfoca en el fortalecimiento de capacidades locales para equipamientos comunitarios, colegios públicos y centros de salud de mediana complejidad."
  },
  lag: {
    id: "lag",
    name: "La Guajira",
    adoptionRate: 42,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 7,
    specialistsCount: 110,
    publicSectorInvolvement: "Inicial",
    keyUse: "Energías Renovables y Manejo de Recursos Hídricos",
    projects: [
      { name: "Parques Eólicos de la Alta Guajira", description: "Coordinación espacial de cimentaciones, líneas de transmisión e impacto territorial en comunidades." }
    ],
    overview: "La Guajira asume el reto BIM integrándolo a la revolución de las energías limpias (eólica y solar) y el diseño de microrredes de acueducto rural."
  },
  suc: {
    id: "suc",
    name: "Sucre",
    adoptionRate: 44,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 6,
    specialistsCount: 100,
    publicSectorInvolvement: "Inicial",
    keyUse: "Drenaje Urbano y Viviendas Rurales Palafíticas",
    projects: [
      { name: "Plan de Alcantarillado Pluvial de Sincelejo", description: "Simulación de flujos y colectores subterráneos integrados al terreno tridimensional." }
    ],
    overview: "Sucre aprovecha BIM para el diseño técnico de soluciones de saneamiento básico y la adaptación de infraestructuras en zonas inundables de la Mojana."
  },
  caq: {
    id: "caq",
    name: "Caquetá",
    adoptionRate: 40,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 5,
    specialistsCount: 80,
    publicSectorInvolvement: "Inicial",
    keyUse: "Infraestructura Educativa e Integración Amazónica",
    projects: [
      { name: "Sede de la Universidad de la Amazonia", description: "Modelado de bloques de laboratorios bioclimáticos para el trópico húmedo." }
    ],
    overview: "En la transición hacia la Amazonía, Caquetá empieza a incorporar BIM en licitaciones de colegios rurales y puentes de conexión veredal para asegurar la transparencia."
  },
  put: {
    id: "put",
    name: "Putumayo",
    adoptionRate: 38,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 4,
    specialistsCount: 70,
    publicSectorInvolvement: "Inicial",
    keyUse: "Puentes e Infraestructura Energética",
    projects: [
      { name: "Variante San Francisco-Mocoa", description: "Planificación tridimensional de viaductos en una de las geografías más inestables del país." }
    ],
    overview: "Putumayo adopta tecnologías digitales en obras de arte vial y puentes de gran envergadura para superar las difíciles condiciones geológicas del piedemonte amazónico."
  },
  cas: {
    id: "cas",
    name: "Casanare",
    adoptionRate: 49,
    maturityLevel: "Nivel 1: Modelado 3D",
    activeProjects: 9,
    specialistsCount: 150,
    publicSectorInvolvement: "Inicial",
    keyUse: "Silos de Almacenamiento e Infraestructura Vial Plana",
    projects: [
      { name: "Planta de Almacenamiento de Arroz Casanare", description: "Ingeniería de detalle y montaje industrial modelado en BIM para agilizar la prefabricación." }
    ],
    overview: "Casanare aplica BIM en su pujante sector agroindustrial y vial llano, impulsando la construcción eficiente de plantas de procesamiento y silos."
  },
  ara: {
    id: "ara",
    name: "Arauca",
    adoptionRate: 37,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 3,
    specialistsCount: 50,
    publicSectorInvolvement: "Inicial",
    keyUse: "Equipamientos Administrativos y Centros del SENA",
    projects: [
      { name: "Sede Regional SENA Arauca", description: "Modelado 3D de talleres de formación técnica en soldadura y construcción." }
    ],
    overview: "Arauca avanza hacia los estándares nacionales capacitando a instructores locales en herramientas de modelado de información para edificaciones."
  },
  cho: {
    id: "cho",
    name: "Chocó",
    adoptionRate: 35,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 4,
    specialistsCount: 60,
    publicSectorInvolvement: "Inicial",
    keyUse: "Sistemas Pluviales, Hospitales y Puertos Fluviales",
    projects: [
      { name: "Nuevo Hospital San Francisco de Asís de Quibdó", description: "Modelado de la estructura sismorresistente e instalaciones sanitarias de alta resistencia en clima pluvial." }
    ],
    overview: "Chocó enfrenta retos de alta pluviosidad e interconectividad. La metodología BIM se introduce en proyectos hospitalarios y puertos de cabotaje fluvial para garantizar mayor durabilidad y control de recursos."
  },
  gua: {
    id: "gua",
    name: "Guainía",
    adoptionRate: 31,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 2,
    specialistsCount: 30,
    publicSectorInvolvement: "Inicial",
    keyUse: "Energías Alternativas y Equipamientos de Salud Básicos",
    projects: [
      { name: "Centro de Salud de Inírida", description: "Diseño modular prefabricado adaptado para el transporte fluvial y ensamblaje rápido." }
    ],
    overview: "En la remota Guainía, BIM se convierte en un aliado para diseñar proyectos modulares livianos que optimicen el transporte por ríos y reduzcan los desperdicios en obra."
  },
  guv: {
    id: "guv",
    name: "Guaviare",
    adoptionRate: 33,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 2,
    specialistsCount: 40,
    publicSectorInvolvement: "Inicial",
    keyUse: "Ecoturismo y Centros de Acopio Sostenibles",
    projects: [
      { name: "Centro de Acopio de Frutos Amazónicos", description: "Planificación espacial tridimensional utilizando materiales de bajo impacto ecológico de la región." }
    ],
    overview: "Guaviare fomenta BIM en proyectos de infraestructura verde e instalaciones ecoturísticas cercanas a las pinturas rupestres, promoviendo la conservación."
  },
  vau: {
    id: "vau",
    name: "Vaupés",
    adoptionRate: 30,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 1,
    specialistsCount: 25,
    publicSectorInvolvement: "Inicial",
    keyUse: "Aulas Escolares Bioclimáticas e Infraestructura Sanitaria",
    projects: [
      { name: "Internado Escolar de Mitú", description: "Diseño arquitectónico modelado en 3D para maximizar la ventilación natural y recolección de aguas lluvias." }
    ],
    overview: "Vaupés inicia la adopción en edificaciones institucionales aisladas, buscando la máxima autosuficiencia energética y sanitaria con modelos paramétricos adaptados al entorno."
  },
  vid: {
    id: "vid",
    name: "Vichada",
    adoptionRate: 32,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 2,
    specialistsCount: 35,
    publicSectorInvolvement: "Inicial",
    keyUse: "Logística Fluvial e Infraestructura Productiva",
    projects: [
      { name: "Puerto Carreño Muelle Fluvial", description: "Diseño tridimensional de pontones flotantes e infraestructura logística de frontera fluvial." }
    ],
    overview: "En Vichada, BIM se perfila como solución para proyectos fluviales de gran envergadura sobre los ríos Orinoco y Meta, coordinando elementos mecánicos y civiles flotantes."
  },
  sap: {
    id: "sap",
    name: "San Andrés, Providencia y Santa Catalina",
    adoptionRate: 43,
    maturityLevel: "Nivel 1-2: Transición",
    activeProjects: 5,
    specialistsCount: 85,
    publicSectorInvolvement: "Media",
    keyUse: "Arquitectura Resiliente y Gestión de Riesgos Climáticos",
    projects: [
      { name: "Reconstrucción Resiliente de Providencia", description: "Modelado de viviendas unifamiliares con resistencia a vientos huracanados categoría 5 post-Iota." }
    ],
    overview: "El archipiélago aplica la metodología BIM para diseñar infraestructura de alta resiliencia frente a huracanes, integrando análisis de resistencia al viento y sostenibilidad hídrica insular."
  },
  ama: {
    id: "ama",
    name: "Amazonas",
    adoptionRate: 34,
    maturityLevel: "Nivel 1: Inicial",
    activeProjects: 3,
    specialistsCount: 45,
    publicSectorInvolvement: "Inicial",
    keyUse: "Equipamiento Cultural y Sostenibilidad Amazónica",
    projects: [
      { name: "Centro de Investigación de Leticia", description: "Modelado estructural en madera nativa certificada e integración de cubiertas verdes bioclimáticas." }
    ],
    overview: "Amazonas adopta la metodología BIM con miras a la sostenibilidad profunda, planificando proyectos públicos de bajo impacto ambiental integrados a la selva tropical."
  }
};;

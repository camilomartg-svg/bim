
export interface BIMFormState {
  tipoRequest: 'PUBLICAR' | 'ELIMINAR';
  responsable: string;
  proposito: 'ENTREGA PROYECTO' | 'ACTUALIZACIÓN O CAMBIO' | '';
  especialidad: string;
  observaciones: string;
  unidades: {
    [key: string]: {
      RVT: boolean;
      DWG: boolean;
      PDF: boolean;
      DOC: boolean;
      IFC: boolean;
      TRB: boolean;
    };
  };
}

export const ESPECIALIDADES = [
  "ARQUITECTURA",
  "AIRE ACONDICIONADO",
  "CCTV",
  "COMBOS",
  "DESAGÜES",
  "ELÉCTRICO",
  "ELEMENTOS NO ESTRUCTURALES",
  "ESTRUCTURA",
  "ACÚSTICO",
  "ESTUDIO BIOCLIMÁTICO",
  "ESTUDIO TRÁFICO VERTICAL",
  "ESTUDIO SEGURIDAD HUMANA",
  "ESTUDIO DE SUELOS",
  "DETECCIÓN DE INCENDIOS",
  "GAS",
  "PH",
  "TOPOGRAFÍA",
  "VIAS Y ANDENES",
  "SALA DE VENTAS",
  "SUMINISTRO",
  "RCI"
].sort();

export const UNIDADES_ESTRUCTURALES = [
  "IMPLANTACIÓN",
  "TORRE MODULO 1",
  "TORRE MODULO 2",
  "TORRE MODULO 3",
  "TORRE MODULO 4",
  "TORRE MODULO 4A",
  "COMUNAL",
  "TANQUE"
];

export const FILE_TYPES = ["RVT", "DWG", "PDF", "DOC", "IFC", "TRB"] as const;

export interface ProjectConfig {
  id: string;
  name: string;
  logo: string;
  company: 'nora' | 'Amarillo';
  unidades?: string[];
}

export const BRANDING = {
  nora: {
    name: 'nora',
    logo: 'https://i.postimg.cc/L4r0gSvV/LOGO-TEXTO-NORA-NEGRO.png',
    colors: {
      primary: '#003E52',
      secondary: '#024959',
      accent: '#F28705',
    }
  },
  Amarillo: {
    name: 'Amarillo S.A.',
    logo: 'https://i.postimg.cc/GmWLmfZZ/Logo-transparente_negro.png',
    colors: {
      primary: '#171717',
      secondary: '#B0034B',
      accent: '#605E62',
    }
  }
};

export const PROJECTS: ProjectConfig[] = [
  {
    id: 'green_i',
    name: "Green I",
    logo: "https://i.postimg.cc/J4Fy2Qsx/LOGO-(1).jpg",
    company: 'Amarillo'
  }
];

export const COLORS = {
  primary: '#003E52', 
  secondary: '#024959',
  accent: '#F28705', 
  highlight: '#333333', 
  black: '#0D0D0D',
  white: '#FFFFFF',
  lightGrey: '#F5F5F7',
  grey: '#A49FA6',
  darkGrey: '#827E84',
  deepGrey: '#605E62',
};

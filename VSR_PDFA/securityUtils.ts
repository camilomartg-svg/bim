export interface SecurityContext {
  currentUser: any;
  currentCompany: any;
  activeProject: any;
  statusMap: Record<string, any>;
  loaded: boolean;
}

const DRIVE_MODELS_API_URL = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';

const jsonpRequest = async <T,>(url: URL, timeoutMs = 30000): Promise<T> => {
  return await new Promise<T>((resolve, reject) => {
    const cb = `__jsonp_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
    url.searchParams.set('callback', cb);
    const script = document.createElement('script');
    let done = false;

    const cleanup = () => {
      if (done) return;
      done = true;
      try {
        delete (window as any)[cb];
      } catch {
        (window as any)[cb] = undefined;
      }
      if (script.parentNode) script.parentNode.removeChild(script);
    };

    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Tiempo de espera agotado (JSONP)'));
    }, timeoutMs);

    (window as any)[cb] = (data: T) => {
      window.clearTimeout(timer);
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      window.clearTimeout(timer);
      cleanup();
      reject(new Error('No se pudo cargar el script JSONP'));
    };

    script.src = url.toString();
    document.head.appendChild(script);
  });
};

export const loadSecurityContext = async (projectSlug: string, companyIdParam: string): Promise<SecurityContext> => {
  const currentUser = JSON.parse(sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount') || 'null');
  
  const context: SecurityContext = {
    currentUser,
    currentCompany: null,
    activeProject: null,
    statusMap: {},
    loaded: false
  };

  const companyId = companyIdParam || (currentUser ? currentUser.adminEmpresaId : '') || sessionStorage.getItem('empresa') || '';
  let configUrl = '../portal-config.json';
  if (companyId) {
    try {
      const empRes = await fetch(`../empresas.json?t=${Date.now()}`);
      if (empRes.ok) {
        const empresas = await empRes.json();
        const currentCompany = empresas.find((e: any) => e.id === companyId);
        if (currentCompany) {
          context.currentCompany = currentCompany;
          if (currentCompany.configUrl) {
            configUrl = `../${currentCompany.configUrl}`;
          }
        }
      }
    } catch (e) {
      console.warn('Error loading empresas.json', e);
    }
  }

  try {
    const configRes = await fetch(`${configUrl}?t=${Date.now()}`, { cache: 'no-store' });
    if (configRes.ok) {
      const config = await configRes.json();
      const projects = Array.isArray(config.projects) ? config.projects : [];
      const activeProject = projects.find((p: any) => p.slug === projectSlug) || projects[0];
      if (activeProject) {
        context.activeProject = activeProject;
      }
    }
  } catch (e) {
    console.warn('Error loading config', e);
  }

  try {
    const url = new URL(DRIVE_MODELS_API_URL);
    url.searchParams.set('action', 'listStatus');
    if (projectSlug) url.searchParams.set('project', projectSlug);
    url.searchParams.set('t', String(Date.now()));
    const sData = await jsonpRequest<{ entries?: any[] }>(url, 30000);
    const statusEntries = Array.isArray(sData?.entries) ? sData.entries : [];
    statusEntries.sort((a: any, b: any) => new Date(a.changedAt || 0).getTime() - new Date(b.changedAt || 0).getTime());
    const statusMap: Record<string, any> = {};
    statusEntries.forEach(entry => {
      if (entry.originalFileId) statusMap[entry.originalFileId] = entry;
      if (entry.fileId) statusMap[entry.fileId] = entry;
      if (entry.filename) statusMap[entry.filename.toLowerCase()] = entry;
    });
    context.statusMap = statusMap;
  } catch (e) {
    console.warn('Error loading status history', e);
  }

  context.loaded = true;
  return context;
};

export const cleanSpecialty = (folder?: string, filename?: string): string => {
  const nameLower = (filename || '').toLowerCase();
  
  // Clean folder prefix to avoid matching "estados" as "est" (Estructural)
  let folderClean = (folder || '').toLowerCase();
  folderClean = folderClean
    .replace(/^\.?estados\/?/i, '')
    .replace(/^\.?versiones\/?/i, '')
    .trim();
  
  const combined = `${folderClean} | ${nameLower}`;

  // 1. Arquitectura
  if (
    combined.includes('arquitectura') ||
    combined.includes('architecture') ||
    /(?:^|[^a-z])arq(?:[^a-z]|$)/i.test(combined)
  ) {
    return 'Arquitectura';
  }

  // 2. Estructural
  if (
    combined.includes('estructural') ||
    combined.includes('estructura') ||
    combined.includes('structural') ||
    combined.includes('structure') ||
    /(?:^|[^a-z])est(?:[^a-z]|$)/i.test(combined)
  ) {
    return 'Estructural';
  }

  // 3. Eléctrico
  if (
    combined.includes('electrico') ||
    combined.includes('eléctrico') ||
    combined.includes('electrical') ||
    /(?:^|[^a-z])elec(?:[^a-z]|$)/i.test(combined)
  ) {
    return 'Eléctrico';
  }

  // 4. Hidrosanitario
  if (
    combined.includes('hidrosanitario') ||
    combined.includes('hidraulico') ||
    combined.includes('hidráulico') ||
    combined.includes('plomeria') ||
    combined.includes('plomería') ||
    combined.includes('sanitario') ||
    combined.includes('desagues') ||
    combined.includes('desagües') ||
    combined.includes('plumbing') ||
    combined.includes('sanitary')
  ) {
    return 'Hidrosanitario';
  }

  // 5. Mecánico
  if (
    combined.includes('mecanico') ||
    combined.includes('mecánico') ||
    combined.includes('hvac') ||
    combined.includes('mechanical')
  ) {
    return 'Mecánico';
  }

  // 6. Gas
  if (/(?:^|[^a-z])gas(?:[^a-z]|$)/i.test(combined)) {
    return 'Gas';
  }

  // 7. Red Contra Incendio
  if (
    combined.includes('incendio') ||
    combined.includes('extincion') ||
    combined.includes('extinción') ||
    combined.includes('fire')
  ) {
    return 'Red Contra Incendio';
  }

  if (!folder) return 'General';
  const str = String(folder).replace(/^\.?estados\/?/i, '').replace(/^\.?versiones\/?/i, '').trim();
  if (!str || str.startsWith('.')) return 'General';
  const parts = str.split('/').filter(Boolean);
  if (parts.length === 0) return 'General';
  const last = parts[parts.length - 1];
  if (last.toLowerCase() === 'compartido' || last.toLowerCase() === 'publicado' || last.toLowerCase() === 'en_progreso') {
    return parts.length > 1 ? parts[0] : 'General';
  }
  return last.charAt(0).toUpperCase() + last.slice(1);
};

export const getUserDeliveryTeams = (email: string, activeProject: any): string[] => {
  if (!email || !activeProject) return [];
  const cleanEmail = email.toLowerCase().trim();
  const teams: string[] = [];

  const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];
  deliveryTeams.forEach((dt: any) => {
    const isMember = Array.isArray(dt.members) && dt.members.map((m: string) => m.toLowerCase().trim()).includes(cleanEmail);
    const isLead = dt.leadEmail && dt.leadEmail.toLowerCase().trim() === cleanEmail;
    if (isMember || isLead) {
      teams.push(dt.name.toUpperCase().trim());
    }
  });

  const equipos = activeProject.equiposDeTarea || [];
  equipos.forEach((eq: any) => {
    const isMember = Array.isArray(eq.members) && eq.members.map((m: string) => m.toLowerCase().trim()).includes(cleanEmail);
    if (isMember && !teams.includes(eq.name.toUpperCase().trim())) {
      teams.push(eq.name.toUpperCase().trim());
    }
  });

  return teams;
};

export const getFileDeliveryTeams = (file: any, activeProject: any): string[] => {
  if (!file || !activeProject) return [];
  const teams = new Set<string>();

  const parseStoredDeliveryTeams = (val: any): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
          return JSON.parse(trimmed);
        }
        return trimmed.split(',').map(s => s.trim()).filter(Boolean);
      }
    } catch (e) {
      console.warn('Error parsing delivery teams:', val, e);
    }
    return [];
  };

  parseStoredDeliveryTeams(file.deliveryTeams).forEach(team => {
    const clean = String(team || '').trim();
    if (clean) teams.add(clean.toUpperCase());
  });

  if (teams.size > 0) {
    return Array.from(teams);
  }

  const specialty = cleanSpecialty(file.folder, file.name || file.filename).toUpperCase().trim();
  if (specialty && specialty !== 'GENERAL') {
    const normalizeName = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const normSpecialty = normalizeName(specialty);

    const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];
    deliveryTeams.forEach((dt: any) => {
      if (normalizeName(dt.name) === normSpecialty) {
        teams.add(dt.name.toUpperCase().trim());
      }
    });

    const equipos = activeProject.equiposDeTarea || [];
    equipos.forEach((eq: any) => {
      if (normalizeName(eq.name) === normSpecialty) {
        teams.add(eq.name.toUpperCase().trim());
      }
    });
  }

  if (teams.size === 0) {
    const uEmail = (file.changedByEmail || '').toLowerCase().trim();
    if (uEmail && uEmail !== 'unassigned@nora.cde') {
      const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];
      deliveryTeams.forEach((dt: any) => {
        const isMember = Array.isArray(dt.members) && dt.members.map((m: string) => m.toLowerCase().trim()).includes(uEmail);
        const isLead = dt.leadEmail && dt.leadEmail.toLowerCase().trim() === uEmail;
        if (isMember || isLead) {
          teams.add(dt.name.toUpperCase().trim());
        }
      });

      const equipos = activeProject.equiposDeTarea || [];
      equipos.forEach((eq: any) => {
        const isMember = Array.isArray(eq.members) && eq.members.map((m: string) => m.toLowerCase().trim()).includes(uEmail);
        if (isMember) {
          teams.add(eq.name.toUpperCase().trim());
        }
      });
    }
  }

  return Array.from(teams);
};

export const isUserAuthorizedForFile = (
  currentUser: any,
  file: any,
  activeProject: any,
  currentCompany: any,
  companyId: string,
  action: string = 'view'
): boolean => {
  if (!activeProject) {
    console.log('[SECURITY] Permitido: Sin contexto de proyecto activo (modo desarrollador local)');
    return true;
  }
  if (!currentUser) {
    if (action === 'view' && file.status === 'PUBLICADO') {
      console.log(`[SECURITY] Permitido para invitado: Archivo "${file.name || file.filename}" está PUBLICADO`);
      return true;
    }
    console.log('[SECURITY] Denegado: No hay usuario autenticado');
    return false;
  }
  const email = (currentUser.username || currentUser.email || currentUser.userAccount || '').toLowerCase().trim();

  // Rule: If user is in a receiver team, they can ONLY access files with status === 'PUBLICADO'
  const receiverTeams = activeProject?.iso19650?.receiverTeams || [];
  const isInReceiverTeam = receiverTeams.some((rt: any) => {
    const isMember = Array.isArray(rt.members) && rt.members.map((m: string) => m.toLowerCase().trim()).includes(email);
    const isLead = rt.leadEmail && rt.leadEmail.toLowerCase().trim() === email;
    return isMember || isLead;
  });

  if (isInReceiverTeam && file.status !== 'PUBLICADO') {
    console.log(`[SECURITY] Denegado: Usuario ${email} está en un equipo receptor y el archivo "${file.name || file.filename}" no está PUBLICADO (status: ${file.status})`);
    return false;
  }

  const superAdmins = ['imagina3ddesign@gmail.com', 'mcmartinezg@unal.edu.co'];
  const isSuperAdmin = superAdmins.includes(email) || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'SUPER_ADMINISTRADOR';

  const companyAdmins = Array.isArray(currentCompany?.admins) ? currentCompany.admins.map((a: string) => a.toLowerCase().trim()) : [];
  const memberMatch = Array.isArray(currentCompany?.members) ? currentCompany.members.find((m: any) => m.email && m.email.toLowerCase().trim() === email) : null;
  const isMemberAdmin = memberMatch && (memberMatch.role === 'ADMINISTRADOR_EMPRESA' || memberMatch.role === 'ADMINISTRADOR');

  const isCompanyAdmin = isSuperAdmin || companyAdmins.includes(email) || isMemberAdmin || (currentUser.adminEmpresaId && currentUser.adminEmpresaId === companyId && (currentUser.role === 'ADMINISTRADOR_EMPRESA' || currentUser.role === 'SUPER_ADMINISTRADOR' || currentUser.role === 'SUPER_ADMIN'));

  const projectAdmins = Array.isArray(activeProject?.iso19650?.projectAdmins)
    ? activeProject.iso19650.projectAdmins.map((a: string) => a.toLowerCase().trim())
    : [];
  const isProjectAdmin = isCompanyAdmin || projectAdmins.includes(email);

  if (isProjectAdmin) {
    console.log(`[SECURITY] Permitido: Usuario ${email} es administrador del proyecto/empresa`);
    return true;
  }

  // El uploader siempre puede ver su propio archivo
  const fileUploader = (file.changedByEmail || '').toLowerCase().trim();
  if (fileUploader && fileUploader === email) {
    console.log(`[SECURITY] Permitido: El usuario ${email} es el uploader del archivo`);
    return true;
  }

  // Para visualizar archivos COMPARTIDOS o PUBLICADOS (no EN_PROGRESO), cualquier miembro del proyecto puede verlos
  if (action === 'view' && file.status !== 'EN_PROGRESO') {
    const isMember = (activeProject?.members || []).map((m: string) => m.toLowerCase().trim()).includes(email);
    if (isMember) {
      console.log(`[SECURITY] Permitido: Usuario ${email} es miembro del proyecto para archivo compartido/publicado`);
      return true;
    }
    
    const userTeams = getUserDeliveryTeams(email, activeProject);
    if (userTeams.length > 0) {
      console.log(`[SECURITY] Permitido: Usuario ${email} pertenece a algún equipo del proyecto para archivo compartido/publicado`);
      return true;
    }

    if (isInReceiverTeam) {
      console.log(`[SECURITY] Permitido: Usuario ${email} pertenece a un equipo receptor para archivo publicado`);
      return true;
    }
  }
  


  // Para archivos EN_PROGRESO (WIP) o para acciones de edición/gestión:
  // Se requiere que el usuario y el archivo compartan al menos un equipo de entrega (comparación insensible a acentos)
  const fileTeams = getFileDeliveryTeams(file, activeProject);
  const userTeams = getUserDeliveryTeams(email, activeProject);

  const normalizeName = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const normFileTeams = fileTeams.map(normalizeName);
  const normUserTeams = userTeams.map(normalizeName);

  console.log(`[SECURITY] Evaluando archivo: "${file.name || file.filename}" (${file.status})`);
  console.log('[SECURITY] Equipos normalizados del archivo:', normFileTeams);
  console.log('[SECURITY] Equipos normalizados del usuario:', normUserTeams);

  if (normFileTeams.length === 0) {
    console.log('[SECURITY] Denegado: Archivo sin equipos asociados y el usuario no es el uploader');
    return false;
  }

  const authorized = normFileTeams.some(team => normUserTeams.includes(team));
  console.log(`[SECURITY] Resultado de autorización por equipos: ${authorized}`);
  return authorized;
}

export interface SecurityContext {
  currentUser: any;
  currentCompany: any;
  activeProject: any;
  statusMap: Record<string, any>;
  statusEntries?: any[];
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

export const normalizeTeamName = (name: string): string => {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
};

export const getTeamVisibilityRule = (type: string, teamName: string, activeProject: any) => {
  const norm = normalizeTeamName(teamName);
  const key = `${type}:${norm}`;
  const cfg = activeProject?.fileVisibilityConfig?.[key] ||
              activeProject?.fileVisibilityConfig?.[norm] ||
              activeProject?.fileVisibilityConfig?.[teamName];

  if (cfg && typeof cfg === 'object') {
    return {
      canViewProgreso: typeof cfg.canViewProgreso === 'boolean' ? cfg.canViewProgreso : (type === 'task'),
      canViewCompartido: typeof cfg.canViewCompartido === 'boolean' ? cfg.canViewCompartido : (type === 'task'),
      canViewPublicado: typeof cfg.canViewPublicado === 'boolean' ? cfg.canViewPublicado : true
    };
  }

  // Defaults ISO 19650
  if (type === 'task') {
    return { canViewProgreso: true, canViewCompartido: true, canViewPublicado: true };
  } else {
    return { canViewProgreso: false, canViewCompartido: false, canViewPublicado: true };
  }
};

export const getUserReceiverTeams = (email: string, activeProject: any): string[] => {
  if (!email || !activeProject) return [];
  const cleanEmail = email.toLowerCase().trim();
  const receiverTeams = activeProject.iso19650?.receiverTeams || [];
  const teams: string[] = [];
  receiverTeams.forEach((rt: any) => {
    const isMember = Array.isArray(rt.members) && rt.members.map((m: string) => m.toLowerCase().trim()).includes(cleanEmail);
    const isLead = rt.leadEmail && rt.leadEmail.toLowerCase().trim() === cleanEmail;
    if (isMember || isLead) {
      teams.push(rt.name);
    }
  });
  return teams;
};

export const getUserEffectivePermissions = (
  currentUser: any,
  activeProject: any,
  currentCompany: any,
  companyId: string
): {
  canViewProgreso: boolean;
  canViewCompartido: boolean;
  canViewPublicado: boolean;
  isAdmin: boolean;
} => {
  if (!activeProject) {
    return { canViewProgreso: true, canViewCompartido: true, canViewPublicado: true, isAdmin: true };
  }
  if (!currentUser) {
    return { canViewProgreso: false, canViewCompartido: false, canViewPublicado: false, isAdmin: false };
  }
  const email = (currentUser.username || currentUser.email || currentUser.userAccount || '').toLowerCase().trim();

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
    return { canViewProgreso: true, canViewCompartido: true, canViewPublicado: true, isAdmin: true };
  }

  const userTaskTeams = getUserDeliveryTeams(email, activeProject);
  const userReceiverTeams = getUserReceiverTeams(email, activeProject);

  // If unassigned project member
  if (userTaskTeams.length === 0 && userReceiverTeams.length === 0) {
    const isMember = (activeProject?.members || []).map((m: string) => m.toLowerCase().trim()).includes(email);
    if (isMember) {
      return { canViewProgreso: false, canViewCompartido: true, canViewPublicado: true, isAdmin: false };
    }
  }

  let canViewProgreso = false;
  let canViewCompartido = false;
  let canViewPublicado = false;

  for (const tt of userTaskTeams) {
    const rule = getTeamVisibilityRule('task', tt, activeProject);
    if (rule.canViewProgreso) canViewProgreso = true;
    if (rule.canViewCompartido) canViewCompartido = true;
    if (rule.canViewPublicado) canViewPublicado = true;
  }

  for (const rt of userReceiverTeams) {
    const rule = getTeamVisibilityRule('receiver', rt, activeProject);
    if (rule.canViewProgreso) canViewProgreso = true;
    if (rule.canViewCompartido) canViewCompartido = true;
    if (rule.canViewPublicado) canViewPublicado = true;
  }

  return { canViewProgreso, canViewCompartido, canViewPublicado, isAdmin: false };
};

export const getStatusMatchesForFile = (fid: string, fname: string, statusEntries: any[]) => {
  const matches: {
    EN_PROGRESO: any | null;
    COMPARTIDO: any | null;
    PUBLICADO: any | null;
  } = {
    EN_PROGRESO: null,
    COMPARTIDO: null,
    PUBLICADO: null
  };

  const cleanFname = String(fname || '').trim().toLowerCase();
  const extMatch = cleanFname.match(/\.([^.]+)$/);
  const ext = extMatch ? extMatch[1] : '';
  const baseName = cleanFname.replace(/\.[^/.]+$/, '');

  (statusEntries || []).forEach(entry => {
    if (!entry || !entry.status) return;
    const status = entry.status;
    const entryFn = String(entry.filename || '').trim().toLowerCase();
    const entryExtMatch = entryFn.match(/\.([^.]+)$/);
    const entryExt = entryExtMatch ? entryExtMatch[1] : '';
    const entryBase = entryFn.replace(/\.[^/.]+$/, '');

    const matchesId = (fid && entry.originalFileId && entry.originalFileId === fid) ||
                      (fid && entry.fileId && entry.fileId === fid);
    const matchesExactName = entryFn && entryFn === cleanFname;
    const matchesIfcFrag = (ext === 'ifc' || ext === 'frag' || ext === 'rvt') &&
                           (entryExt === 'ifc' || entryExt === 'frag' || entryExt === 'rvt') &&
                           (baseName === entryBase);

    let matchWeight = 0;
    if (matchesId && matchesExactName) matchWeight = 4;
    else if (matchesExactName) matchWeight = 3;
    else if (matchesId) matchWeight = 2;
    else if (matchesIfcFrag) matchWeight = 1;

    if (matchWeight > 0) {
      if (status === 'COMPARTIDO') {
        matches.COMPARTIDO = entry;
      } else if (status === 'DESCOMPARTIDO' || (entry.comments && entry.comments.includes('Descompartido'))) {
        matches.COMPARTIDO = null;
      } else if (status === 'PUBLICADO') {
        matches.PUBLICADO = entry;
      } else if (status === 'DESPUBLICADO' || (entry.comments && entry.comments.includes('Despublicado'))) {
        matches.PUBLICADO = null;
      } else if (status === 'EN_PROGRESO') {
        const current = matches.EN_PROGRESO;
        if (!current || matchWeight > (current.weight || 0) || (matchWeight === (current.weight || 0) && new Date(entry.changedAt || 0).getTime() >= new Date(current.entry?.changedAt || current.changedAt || 0).getTime())) {
          matches.EN_PROGRESO = { entry, weight: matchWeight };
        }
      }
    }
  });

  return {
    EN_PROGRESO: matches.EN_PROGRESO ? (matches.EN_PROGRESO.entry || matches.EN_PROGRESO) : null,
    COMPARTIDO: matches.COMPARTIDO,
    PUBLICADO: matches.PUBLICADO
  };
};

export const loadSecurityContext = async (projectSlug: string, companyIdParam: string): Promise<SecurityContext> => {
  const currentUser = JSON.parse(sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount') || 'null');
  
  const context: SecurityContext = {
    currentUser,
    currentCompany: null,
    activeProject: null,
    statusMap: {},
    statusEntries: [],
    loaded: false
  };

  if (!currentUser) return context;

  const companyId = companyIdParam || currentUser.adminEmpresaId || sessionStorage.getItem('empresa') || '';
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
        // Overlay locally saved file visibility config if present
        const pSlug = activeProject.slug || projectSlug || 'general';
        const storageKey = `nora_file_visibility_${companyId || 'default'}_${pSlug}`;
        try {
          const raw = localStorage.getItem(storageKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
              activeProject.fileVisibilityConfig = {
                ...(activeProject.fileVisibilityConfig || {}),
                ...parsed
              };
            }
          }
        } catch (_) {}
        context.activeProject = activeProject;
      }
    }
  } catch (e) {
    console.warn('Error loading config', e);
  }

  const dsScript = context.activeProject?.dataSources?.driveScriptUrl || DRIVE_MODELS_API_URL;
  const targetScriptUrl = String(dsScript || DRIVE_MODELS_API_URL).trim();

  try {
    let sData: { entries?: any[] } | null = null;
    try {
      const resp = await fetch(targetScriptUrl, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'listStatus',
          project: projectSlug
        })
      });
      if (resp.ok) {
        sData = await resp.json();
      }
    } catch (_) {}

    if (!sData) {
      const url = new URL(targetScriptUrl);
      url.searchParams.set('action', 'listStatus');
      if (projectSlug) url.searchParams.set('project', projectSlug);
      url.searchParams.set('t', String(Date.now()));
      sData = await jsonpRequest<{ entries?: any[] }>(url, 30000);
    }

    const statusEntries = Array.isArray(sData?.entries) ? sData.entries : [];
    statusEntries.sort((a: any, b: any) => new Date(a.changedAt || 0).getTime() - new Date(b.changedAt || 0).getTime());
    context.statusEntries = statusEntries;

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

export const cleanSpecialty = (folder?: string): string => {
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

  const specialty = cleanSpecialty(file.folder).toUpperCase().trim();
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
    console.log('[SECURITY] Denegado: No hay usuario autenticado. Se requiere inicio de sesión en nora BIM.');
    return false;
  }
  const email = (currentUser.username || currentUser.email || currentUser.userAccount || '').toLowerCase().trim();

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

  // 1. Administrators have full visibility across all states and files
  if (isProjectAdmin) {
    console.log(`[SECURITY] Permitido: Usuario ${email} es administrador del proyecto/empresa`);
    return true;
  }

  // 2. The original uploader can always view their file
  const fileUploader = (file.changedByEmail || '').toLowerCase().trim();
  if (fileUploader && fileUploader === email) {
    console.log(`[SECURITY] Permitido: El usuario ${email} es el uploader del archivo`);
    return true;
  }

  // 3. Check authorization by lifecycle status and team visibility rules
  const userTaskTeams = getUserDeliveryTeams(email, activeProject);
  const userReceiverTeams = getUserReceiverTeams(email, activeProject);
  const status = file.status || 'EN_PROGRESO';

  // Check A: EN_PROGRESO (WIP)
  if (status === 'EN_PROGRESO') {
    const fileTeams = getFileDeliveryTeams(file, activeProject);
    const normalizeName = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const normFileTeams = fileTeams.map(normalizeName);
    const normUserTeams = userTaskTeams.map(normalizeName);

    if (normUserTeams.length > 0) {
      const hasMatchingTaskTeam = normUserTeams.some(t => {
        const rule = getTeamVisibilityRule('task', t, activeProject);
        if (rule.canViewProgreso === false) return false;
        if (normFileTeams.length > 0) {
          return normFileTeams.includes(t);
        }
        return rule.canViewProgreso === true;
      });
      if (hasMatchingTaskTeam) {
        console.log(`[SECURITY] Permitido: Usuario ${email} en equipo de tarea para archivo EN_PROGRESO`);
        return true;
      }
    }

    for (const rt of userReceiverTeams) {
      const rule = getTeamVisibilityRule('receiver', rt, activeProject);
      if (rule.canViewProgreso === true) {
        console.log(`[SECURITY] Permitido: Equipo receptor de ${email} habilitado para EN_PROGRESO`);
        return true;
      }
    }

    if (userTaskTeams.length === 0 && userReceiverTeams.length === 0 && normFileTeams.length === 0) {
      const isMember = (activeProject?.members || []).map((m: string) => m.toLowerCase().trim()).includes(email);
      if (isMember) return true;
    }

    console.log(`[SECURITY] Denegado: Usuario ${email} sin acceso a archivo EN_PROGRESO "${file.name || file.filename}"`);
    return false;
  }

  // Check B: COMPARTIDO (SHARED)
  if (status === 'COMPARTIDO') {
    for (const tt of userTaskTeams) {
      const rule = getTeamVisibilityRule('task', tt, activeProject);
      if (rule.canViewCompartido !== false) return true;
    }
    for (const rt of userReceiverTeams) {
      const rule = getTeamVisibilityRule('receiver', rt, activeProject);
      if (rule.canViewCompartido === true) return true;
    }
    if (userTaskTeams.length === 0 && userReceiverTeams.length === 0) {
      const isMember = (activeProject?.members || []).map((m: string) => m.toLowerCase().trim()).includes(email);
      if (isMember) return true;
    }
    console.log(`[SECURITY] Denegado: Usuario ${email} sin permiso para COMPARTIDO`);
    return false;
  }

  // Check C: PUBLICADO (PUBLISHED)
  if (status === 'PUBLICADO') {
    for (const tt of userTaskTeams) {
      const rule = getTeamVisibilityRule('task', tt, activeProject);
      if (rule.canViewPublicado !== false) return true;
    }
    for (const rt of userReceiverTeams) {
      const rule = getTeamVisibilityRule('receiver', rt, activeProject);
      if (rule.canViewPublicado !== false) return true;
    }
    if (userTaskTeams.length === 0 && userReceiverTeams.length === 0) {
      const isMember = (activeProject?.members || []).map((m: string) => m.toLowerCase().trim()).includes(email);
      if (isMember) return true;
    }
    console.log(`[SECURITY] Denegado: Usuario ${email} sin permiso para PUBLICADO`);
    return false;
  }

  return false;
};

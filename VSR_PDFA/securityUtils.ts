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

  if (!currentUser) return context;

  const companyId = companyIdParam || currentUser.adminEmpresaId || sessionStorage.getItem('empresa') || '';
  let configUrl = '../portal-config.json';
  if (companyId) {
    try {
      const empRes = await fetch('../empresas.json');
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
    const configRes = await fetch(configUrl, { cache: 'no-store' });
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
  if (!activeProject) return true; // Bypass security if no active project context exists (e.g. local developer mode)
  if (!currentUser) return false;
  
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

  if (isProjectAdmin) return true;

  if (action === 'view' && file.status !== 'EN_PROGRESO') {
    const isMember = (activeProject?.members || []).map((m: string) => m.toLowerCase().trim()).includes(email);
    if (isMember) return true;
    
    const userTeams = getUserDeliveryTeams(email, activeProject);
    if (userTeams.length > 0) return true;
  }

  const fileTeams = getFileDeliveryTeams(file, activeProject);
  const userTeams = getUserDeliveryTeams(email, activeProject);

  if (fileTeams.length === 0) {
    const fileUploader = (file.changedByEmail || '').toLowerCase().trim();
    if (fileUploader === email) return true;
    return false;
  }

  return fileTeams.some(team => userTeams.includes(team));
};

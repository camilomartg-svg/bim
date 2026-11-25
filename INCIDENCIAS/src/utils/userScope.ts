import { INCIDENCES_CONFIG_SCRIPT_URL, FILES_GATEWAY_URL, getHumanCompanyAndProject } from './googleDriveUtils';

export type UserBranchScope = 'ADMIN' | 'DELIVERY' | 'RECEIVER' | 'NONE' | 'ALL';

export type IssueTypeScope = 'GLOBAL' | 'DELIVERY' | 'RECEIVER';

/**
 * Returns cached active project data (including iso19650) from localStorage or sessionStorage.
 */
export function getActiveProjectData(): any | null {
  try {
    let proj: any = null;
    const rawProj = (typeof window !== 'undefined') ? (sessionStorage.getItem('activeProject') || localStorage.getItem('activeProject') || sessionStorage.getItem('currentProject') || localStorage.getItem('currentProject')) : null;
    if (rawProj) {
      try {
        proj = JSON.parse(rawProj);
      } catch (_) {}
    }
    const cachedIso = (typeof window !== 'undefined') ? localStorage.getItem('cached_project_iso_data') : null;
    if (cachedIso) {
      try {
        const parsedIso = JSON.parse(cachedIso);
        proj = {
          ...(proj || {}),
          ...parsedIso,
          iso19650: {
            ...(proj?.iso19650 || {}),
            ...(parsedIso?.iso19650 || parsedIso || {})
          }
        };
      } catch (_) {}
    }
    return proj;
  } catch (e) {
    console.warn('Error reading activeProject data:', e);
  }
  return null;
}

/**
 * Loads project ISO configuration from Google Drive and caches it.
 */
export async function loadAndCacheProjectIso(companyId?: string, projectId?: string): Promise<any> {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const compId = companyId || urlParams.get('empresa') || '';
    const projId = projectId || urlParams.get('project') || '';
    if (!compId || !projId) return null;

    const { companyName, projectName } = getHumanCompanyAndProject(compId, projId);
    const targetUrl = INCIDENCES_CONFIG_SCRIPT_URL || FILES_GATEWAY_URL;
    const url = new URL(targetUrl);
    url.searchParams.set('action', 'getProjectConfig');
    url.searchParams.set('empresa', companyName || compId);
    url.searchParams.set('companyId', compId);
    url.searchParams.set('proyecto', projId);
    url.searchParams.set('projectName', projectName || projId);
    url.searchParams.set('t', String(Date.now()));

    const res = await fetch(url.toString());
    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success' && data.data) {
        try {
          localStorage.setItem('cached_project_iso_data', JSON.stringify(data.data));
          localStorage.setItem('activeProject', JSON.stringify(data.data));
          sessionStorage.setItem('activeProject', JSON.stringify(data.data));
        } catch (_) {}
        return data.data;
      }
    }
  } catch (e) {
    console.warn('Could not load project ISO data from Drive:', e);
  }
  return getActiveProjectData();
}

/**
 * Determines whether a given team name belongs to DELIVERY or RECEIVER branch.
 */
export function getBranchForTeamName(teamName?: string, projectData?: any): 'DELIVERY' | 'RECEIVER' | 'NONE' {
  if (!teamName) return 'NONE';
  const cleanTeam = String(teamName).toUpperCase().trim();
  if (!cleanTeam) return 'NONE';

  const proj = projectData || getActiveProjectData();
  const iso = proj?.iso19650 || {};

  // 1. Check Delivery Teams & their Task Teams
  const deliveryTeams = Array.isArray(iso.deliveryTeams) ? iso.deliveryTeams : [];
  for (const dt of deliveryTeams) {
    if (String(dt.name || '').toUpperCase().trim() === cleanTeam) return 'DELIVERY';
    const tasks = Array.isArray(dt.taskTeams) ? dt.taskTeams : [];
    for (const tt of tasks) {
      if (String(tt.name || '').toUpperCase().trim() === cleanTeam) return 'DELIVERY';
    }
  }

  // 2. Check Receiver Teams & their Task Teams
  const receiverTeams = Array.isArray(iso.receiverTeams) ? iso.receiverTeams : [];
  for (const rt of receiverTeams) {
    if (String(rt.name || '').toUpperCase().trim() === cleanTeam) return 'RECEIVER';
    const tasks = Array.isArray(rt.taskTeams) ? rt.taskTeams : [];
    for (const tt of tasks) {
      if (String(tt.name || '').toUpperCase().trim() === cleanTeam) return 'RECEIVER';
    }
  }

  // 3. Normalized naming conventions
  if (
    cleanTeam.includes('ARQUITECTURA') ||
    cleanTeam.includes('ESTRUCTUR') ||
    cleanTeam.includes('DISENO') ||
    cleanTeam.includes('DISEÑO') ||
    cleanTeam.includes('MODELADO') ||
    cleanTeam.includes('MEP') ||
    cleanTeam.includes('ENTREGA')
  ) {
    return 'DELIVERY';
  }

  if (
    cleanTeam.includes('OBRA') ||
    cleanTeam.includes('RECEPTOR') ||
    cleanTeam.includes('RESIDENTE') ||
    cleanTeam.includes('SUPERVISION') ||
    cleanTeam.includes('SST')
  ) {
    return 'RECEIVER';
  }

  return 'NONE';
}

/**
 * Finds the team name assigned to a given user email in the project.
 */
export function getUserAssignedTeam(userEmail?: string, projectData?: any): string {
  if (!userEmail) return '';
  const cleanEmail = String(userEmail).toLowerCase().trim();
  if (!cleanEmail) return '';

  const proj = projectData || getActiveProjectData();
  const iso = proj?.iso19650 || {};

  // Check delivery teams
  for (const dt of (iso.deliveryTeams || [])) {
    if ((dt.leadEmail || '').toLowerCase().trim() === cleanEmail) return dt.name;
    if ((dt.members || []).some((m: any) => (typeof m === 'string' ? m : m.email || '').toLowerCase().trim() === cleanEmail)) return dt.name;
    for (const tt of (dt.taskTeams || [])) {
      if ((tt.members || []).some((m: any) => (typeof m === 'string' ? m : m.email || '').toLowerCase().trim() === cleanEmail)) return dt.name;
    }
  }

  // Check receiver teams
  for (const rt of (iso.receiverTeams || [])) {
    if ((rt.leadEmail || '').toLowerCase().trim() === cleanEmail) return rt.name;
    if ((rt.members || []).some((m: any) => (typeof m === 'string' ? m : m.email || '').toLowerCase().trim() === cleanEmail)) return rt.name;
    for (const tt of (rt.taskTeams || [])) {
      if ((tt.members || []).some((m: any) => (typeof m === 'string' ? m : m.email || '').toLowerCase().trim() === cleanEmail)) return rt.name;
    }
  }

  if (iso.liderEquipoEntrega && iso.liderEquipoEntrega.toLowerCase().trim() === cleanEmail) {
    const firstDelivery = (iso.deliveryTeams || [])[0];
    return firstDelivery?.name || 'ARQUITECTURA';
  }

  if (iso.directorDeObra && iso.directorDeObra.toLowerCase().trim() === cleanEmail) {
    const firstReceiver = (iso.receiverTeams || [])[0];
    return firstReceiver?.name || 'OBRA';
  }

  return '';
}

/**
 * Resolves the user's project branch:
 * - DELIVERY: Belongs to an Equipo de Entrega or tasked team.
 * - RECEIVER: Belongs to an Equipo de Recepción / Obra.
 * - ADMIN: Project or platform admin not bound to a specific team.
 * - NONE: Other participant without delivery/receiver team assignment.
 */
export function getUserProjectBranch(userEmail?: string, teamName?: string): UserBranchScope {
  try {
    // 1. If explicit teamName is provided, that team determines the active branch
    if (teamName) {
      const branchFromTeam = getBranchForTeamName(teamName);
      if (branchFromTeam !== 'NONE') {
        return branchFromTeam;
      }
    }

    const rawAcc = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount');
    const userAcc = rawAcc ? JSON.parse(rawAcc) : null;
    const email = (userEmail || userAcc?.username || userAcc?.email || userAcc?.userAccount || '').toLowerCase().trim();

    const proj = getActiveProjectData();
    const iso = proj?.iso19650 || {};

    // 2. Explicit member delimiter branch ISO 19650 (memberBranches)
    if (email && iso.memberBranches && typeof iso.memberBranches === 'object') {
      const br = String(iso.memberBranches[email] || '').toLowerCase().trim();
      if (br === 'delivery' || br === 'equipo-entrega') return 'DELIVERY';
      if (br === 'receiver' || br === 'equipo-receptor' || br === 'obra') return 'RECEIVER';
    }

    // 3. Principal Delivery Lead
    const deliveryLead = String(iso.liderEquipoEntrega || '').toLowerCase().trim();
    if (email && deliveryLead === email) return 'DELIVERY';

    // 4. Delivery Teams (Lead, Member, or Task Teams)
    const deliveryTeams = Array.isArray(iso.deliveryTeams) ? iso.deliveryTeams : [];
    for (const dt of deliveryTeams) {
      if (email && String(dt.leadEmail || '').toLowerCase().trim() === email) return 'DELIVERY';
      const members = Array.isArray(dt.members) ? dt.members.map((m: any) => String(typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim()) : [];
      if (email && members.includes(email)) return 'DELIVERY';
      const taskTeams = Array.isArray(dt.taskTeams) ? dt.taskTeams : [];
      for (const tt of taskTeams) {
        const ttMembers = Array.isArray(tt.members) ? tt.members.map((m: any) => String(typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim()) : [];
        if (email && ttMembers.includes(email)) return 'DELIVERY';
      }
    }

    // 5. Principal Obra / Receiver Lead
    const obraLead = String(iso.directorDeObra || '').toLowerCase().trim();
    if (email && obraLead === email) return 'RECEIVER';

    // 6. Receiver Teams (Lead, Member, or Task Teams)
    const receiverTeams = Array.isArray(iso.receiverTeams) ? iso.receiverTeams : [];
    for (const rt of receiverTeams) {
      if (email && String(rt.leadEmail || '').toLowerCase().trim() === email) return 'RECEIVER';
      const members = Array.isArray(rt.members) ? rt.members.map((m: any) => String(typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim()) : [];
      if (email && members.includes(email)) return 'RECEIVER';
      const taskTeams = Array.isArray(rt.taskTeams) ? rt.taskTeams : [];
      for (const tt of taskTeams) {
        const ttMembers = Array.isArray(tt.members) ? tt.members.map((m: any) => String(typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim()) : [];
        if (email && ttMembers.includes(email)) return 'RECEIVER';
      }
    }

    // 7. Check user assigned team if userAcc.team or position has a known team
    if (userAcc?.team) {
      const branchFromUserAccTeam = getBranchForTeamName(userAcc.team);
      if (branchFromUserAccTeam !== 'NONE') return branchFromUserAccTeam;
    }

    // 8. Super / Company / Project Admins (when viewing general oversight)
    const roleUpper = String(userAcc?.role || '').toUpperCase();
    const projectAdmins = Array.isArray(iso.projectAdmins) 
      ? iso.projectAdmins.map((a: string) => String(a || '').toLowerCase().trim()) 
      : [];
    if (
      roleUpper.includes('ADMIN') || 
      roleUpper.includes('SUPER') || 
      roleUpper.includes('GESTOR') || 
      (email && projectAdmins.includes(email)) ||
      email === 'imagina3ddesign@gmail.com'
    ) {
      return 'ADMIN';
    }

    // 9. Heuristic fallback based on user profile position / specialty
    const cargo = String(userAcc?.cargo || userAcc?.especialidad || '').toLowerCase();
    if (cargo.includes('residente') || cargo.includes('obra') || cargo.includes('receptor') || cargo.includes('seguridad y salud') || cargo.includes('sst')) {
      return 'RECEIVER';
    }
    if (cargo.includes('diseno') || cargo.includes('diseño') || cargo.includes('modelador') || cargo.includes('arquitectura') || cargo.includes('estructura') || cargo.includes('mep') || cargo.includes('entrega')) {
      return 'DELIVERY';
    }
  } catch (err) {
    console.warn('Error evaluating user project branch:', err);
  }
  return 'NONE';
}

/**
 * Checks whether an issue type is visible and creatable:
 * - GLOBAL: visible and creatable by EVERYONE.
 * - DELIVERY: only visible and creatable by users/teams in Delivery.
 * - RECEIVER: only visible and creatable by users/teams in Receiver.
 */
export function isTypeAllowedForBranch(
  typeScope: IssueTypeScope = 'GLOBAL',
  userBranch: UserBranchScope = 'NONE'
): boolean {
  // Las incidencias que son globales le salen a todos los usuarios
  if (typeScope === 'GLOBAL') {
    return true;
  }

  // Las que son de entrega solo usuarios que hacen parte de un equipo de entrega
  if (typeScope === 'DELIVERY') {
    return userBranch === 'DELIVERY';
  }

  // Y las que son recepción solo a usuarios que hacen parte de un equipo de recepción
  if (typeScope === 'RECEIVER') {
    return userBranch === 'RECEIVER';
  }

  return false;
}

/**
 * Filters assignable team members based on the issue scope:
 * - GLOBAL: returns all members.
 * - DELIVERY: only members of delivery teams (+ admins).
 * - RECEIVER: only members of receiver / obra teams (+ admins).
 */
export function filterMembersByScope(
  members: any[],
  scope: IssueTypeScope = 'GLOBAL'
): any[] {
  if (!Array.isArray(members)) return [];
  if (scope === 'GLOBAL') {
    return members;
  }
  if (scope === 'DELIVERY') {
    return members.filter(m => m.branch === 'DELIVERY' || m.branch === 'ADMIN' || (m.team && getBranchForTeamName(m.team) === 'DELIVERY'));
  }
  if (scope === 'RECEIVER') {
    return members.filter(m => m.branch === 'RECEIVER' || m.branch === 'ADMIN' || (m.team && getBranchForTeamName(m.team) === 'RECEIVER'));
  }
  return members;
}

/**
 * Evaluates whether the user is an Administrator (Super Admin, Empresa Admin, or Proyecto Admin).
 * Per project rules: Super Admin, Company Admin, and Project Admin (Rol A) have permission to configure.
 */
export function isIncidentsAdmin(user?: any): boolean {
  try {
    const rawAccount = typeof window !== 'undefined' ? (sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount')) : null;
    let u: any = null;
    if (rawAccount) {
      try {
        u = JSON.parse(rawAccount);
      } catch (_) {}
    }

    const email = String(user?.email || u?.email || u?.username || '').toLowerCase().trim();
    const uRole = String(u?.role || '').toUpperCase().trim();
    const userRole = String(user?.role || '').toUpperCase().trim();
    const systemRole = String(user?.systemRole || '').toUpperCase().trim();
    const combinedRoles = `${uRole} ${userRole} ${systemRole}`;
    const cargo = String(user?.cargo || u?.cargo || user?.position || u?.position || '').toUpperCase().trim();

    // 1. Super Administrador Global
    if (
      combinedRoles.includes('SUPER') ||
      Boolean(user?.isSuperAdmin) ||
      Boolean(u?.isSuperAdmin) ||
      email === 'imagina3ddesign@gmail.com' ||
      email === 'mcmartinezg@unal.edu.co'
    ) {
      return true;
    }

    // 2. Administrador de Empresa
    if (
      combinedRoles.includes('ADMINISTRADOR_EMPRESA') ||
      combinedRoles.includes('ADMIN_EMPRESA') ||
      combinedRoles.includes('EMPRESA') ||
      uRole === 'ADMINISTRADOR' ||
      userRole === 'ADMINISTRADOR' ||
      cargo.includes('ADMINISTRADOR DE EMPRESA') ||
      cargo.includes('ADMIN EMPRESA')
    ) {
      return true;
    }

    // En currentCompany o empresas en storage
    try {
      const rawComp = typeof window !== 'undefined' ? (sessionStorage.getItem('currentCompany') || localStorage.getItem('currentCompany')) : null;
      if (rawComp) {
        const c = JSON.parse(rawComp);
        if (Array.isArray(c.admins) && c.admins.some((a: string) => String(a).toLowerCase().trim() === email)) return true;
        if (Array.isArray(c.members) && c.members.some((m: any) => {
          const mEmail = String(m.email || m.username || '').toLowerCase().trim();
          const mRole = String(m.role || '').toUpperCase().trim();
          return mEmail === email && (mRole.includes('ADMIN') || mRole.includes('EMPRESA'));
        })) return true;
      }
    } catch (_) {}

    // 3. Administrador de Proyecto (Rol A según ISO 19650, creador o admins de proyecto)
    if (
      combinedRoles.includes('ADMINISTRADOR_PROYECTO') ||
      combinedRoles.includes('ADMIN_PROYECTO') ||
      combinedRoles.includes('ROL_A') ||
      combinedRoles.includes('PROYECTO') ||
      cargo.includes('ADMINISTRADOR DE PROYECTO') ||
      cargo.includes('ADMIN PROYECTO') ||
      cargo.includes('LIDER') ||
      cargo.includes('LÍDER')
    ) {
      return true;
    }

    try {
      const proj = getActiveProjectData();
      if (proj) {
        if (proj.creatorEmail && String(proj.creatorEmail).toLowerCase().trim() === email) return true;
        if (proj.creatorId && u?.id && String(proj.creatorId) === String(u.id)) return true;
        if (Array.isArray(proj.admins) && proj.admins.some((a: string) => String(a).toLowerCase().trim() === email)) return true;

        if (proj.iso19650) {
          if (Array.isArray(proj.iso19650.projectAdmins) &&
              proj.iso19650.projectAdmins.some((a: string) => String(a).toLowerCase().trim() === email)) {
            return true;
          }
          const leadA = proj.iso19650.adminProyecto ||
                        proj.iso19650.adjudicador ||
                        proj.iso19650.liderProyecto ||
                        (proj.iso19650.leaders && (proj.iso19650.leaders.adminProyecto || proj.iso19650.leaders.adjudicador || proj.iso19650.leaders.rolA || proj.iso19650.leaders.admin));
          if (leadA) {
            const leadEmail = typeof leadA === 'string' ? leadA : (leadA.email || leadA.username || '');
            if (String(leadEmail).toLowerCase().trim() === email) return true;
          }
        }

        if (Array.isArray(proj.members)) {
          const pMember = proj.members.find((m: any) => {
            const mEmail = (typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim();
            return mEmail === email;
          });
          if (pMember && typeof pMember === 'object') {
            const mRole = String(pMember.role || '').toUpperCase().trim();
            if (mRole.includes('ADMIN') || mRole.includes('PROYECTO') || mRole === 'ROL_A') {
              return true;
            }
          }
        }
      }
    } catch (_) {}

    // Check with WompiModule if available on window
    try {
      if (typeof (window as any).WompiModule?.isPaymentAdmin === 'function') {
        const proj = getActiveProjectData();
        const rawComp = sessionStorage.getItem('currentCompany') || localStorage.getItem('currentCompany');
        const comp = rawComp ? JSON.parse(rawComp) : null;
        if ((window as any).WompiModule.isPaymentAdmin(u || user, comp, proj)) {
          return true;
        }
      }
    } catch (_) {}

    // 4. Admin general
    if (role === 'ADMIN' || user?.role === 'admin' || user?.role === 'super admin') {
      return true;
    }
  } catch (err) {
    console.warn('Error in isIncidentsAdmin check:', err);
  }

  return false;
}


export interface UserStatusInfo {
  isSuspendedFromCompany: boolean;
  isRemovedFromProject: boolean;
  isActiveInProject: boolean;
  label?: string;
  badgeType?: 'suspended' | 'removed_from_project' | 'active';
}

/**
 * Returns whether a given user is suspended from the company, removed from the project, or active.
 */
export function getUserProjectStatus(
  emailOrName?: string,
  projectData?: any,
  allCompaniesData?: any[]
): UserStatusInfo {
  if (!emailOrName) {
    return { isSuspendedFromCompany: false, isRemovedFromProject: false, isActiveInProject: true, badgeType: 'active' };
  }
  const clean = String(emailOrName).toLowerCase().trim();
  if (!clean || clean === 'ninguna' || clean === 'sin asignar') {
    return { isSuspendedFromCompany: false, isRemovedFromProject: false, isActiveInProject: true, badgeType: 'active' };
  }

  // 1. Super Admins are always active
  if (
    clean === 'imagina3ddesign@gmail.com' ||
    clean === 'mcmartinezg@unal.edu.co'
  ) {
    return { isSuspendedFromCompany: false, isRemovedFromProject: false, isActiveInProject: true, badgeType: 'active' };
  }

  // 2. Check allCompanies
  let companies: any[] = allCompaniesData || [];
  if (!companies || companies.length === 0) {
    try {
      const rawAll = typeof window !== 'undefined' ? (sessionStorage.getItem('allCompanies') || localStorage.getItem('allCompanies')) : null;
      if (rawAll) {
        const parsed = JSON.parse(rawAll);
        if (Array.isArray(parsed)) companies = parsed;
      }
    } catch (_) {}
  }
  if (!companies || companies.length === 0) {
    try {
      const rawComp = typeof window !== 'undefined' ? (sessionStorage.getItem('currentCompany') || localStorage.getItem('currentCompany')) : null;
      if (rawComp) {
        const c = JSON.parse(rawComp);
        if (c) companies = [c];
      }
    } catch (_) {}
  }

  let foundInAnyCompany = false;
  if (companies.length > 0) {
    for (const comp of companies) {
      if (!comp || comp.deleted) continue;
      if (Array.isArray(comp.admins) && comp.admins.some((a: string) => String(a).toLowerCase().trim() === clean)) {
        foundInAnyCompany = true;
        break;
      }
      if (Array.isArray(comp.members)) {
        const found = comp.members.find((m: any) => {
          const mEmail = String(m?.email || m?.username || '').toLowerCase().trim();
          const mName = String(m?.name || m?.nombre || '').toLowerCase().trim();
          return mEmail === clean || (clean.length > 3 && mName === clean);
        });
        if (found) {
          foundInAnyCompany = true;
          break;
        }
      }
    }
  } else {
    // If companies not loaded, fallback to active
    foundInAnyCompany = true;
  }

  // 3. Check activeProject
  const proj = projectData || getActiveProjectData();
  let inProject = false;
  if (proj) {
    if (proj.creatorEmail && String(proj.creatorEmail).toLowerCase().trim() === clean) inProject = true;
    if (proj.creatorName && String(proj.creatorName).toLowerCase().trim() === clean) inProject = true;

    if (Array.isArray(proj.members)) {
      if (proj.members.some((m: any) => {
        const mEmail = (typeof m === 'string' ? m : m?.email || m?.username || '').toLowerCase().trim();
        const mName = (typeof m === 'object' ? (m?.name || m?.nombre || '') : '').toLowerCase().trim();
        return mEmail === clean || (clean.length > 3 && mName === clean);
      })) {
        inProject = true;
      }
    }

    const iso = proj.iso19650 || {};
    if (Array.isArray(iso.projectAdmins)) {
      if (iso.projectAdmins.some((a: any) => {
        const aEmail = (typeof a === 'string' ? a : a?.email || a?.username || '').toLowerCase().trim();
        return aEmail === clean;
      })) {
        inProject = true;
      }
    }

    const teams = [
      ...(Array.isArray(iso.deliveryTeams) ? iso.deliveryTeams : []),
      ...(Array.isArray(iso.receiverTeams) ? iso.receiverTeams : [])
    ];
    for (const t of teams) {
      if (t.leadEmail && String(t.leadEmail).toLowerCase().trim() === clean) { inProject = true; break; }
      if (Array.isArray(t.members) && t.members.some((m: any) => (typeof m === 'string' ? m : m?.email || '').toLowerCase().trim() === clean)) { inProject = true; break; }
      if (Array.isArray(t.taskTeams)) {
        for (const tt of t.taskTeams) {
          if (Array.isArray(tt.members) && tt.members.some((m: any) => (typeof m === 'string' ? m : m?.email || '').toLowerCase().trim() === clean)) {
            inProject = true;
            break;
          }
        }
      }
      if (inProject) break;
    }
  }

  // 4. Determinar estado:
  // Si el usuario ESTÁ en el proyecto activo (en activeProject.members o equipos ISO),
  // es un miembro ACTIVO y plenamente autorizado del proyecto (incluyendo invitados y externos)
  if (inProject) {
    return {
      isSuspendedFromCompany: false,
      isRemovedFromProject: false,
      isActiveInProject: true,
      badgeType: 'active'
    };
  }

  if (!foundInAnyCompany) {
    return {
      isSuspendedFromCompany: true,
      isRemovedFromProject: true,
      isActiveInProject: false,
      label: 'Usuario Suspendido / Inactivo',
      badgeType: 'suspended'
    };
  }

  return {
    isSuspendedFromCompany: false,
    isRemovedFromProject: true,
    isActiveInProject: false,
    label: 'Ya no hace parte del proyecto',
    badgeType: 'removed_from_project'
  };
}

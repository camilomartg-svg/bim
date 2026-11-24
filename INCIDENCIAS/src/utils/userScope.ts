import { INCIDENCES_CONFIG_SCRIPT_URL, FILES_GATEWAY_URL, getHumanCompanyAndProject } from './googleDriveUtils';

export type UserBranchScope = 'ADMIN' | 'DELIVERY' | 'RECEIVER' | 'NONE' | 'ALL';

export type IssueTypeScope = 'GLOBAL' | 'DELIVERY' | 'RECEIVER';

/**
 * Returns cached active project data (including iso19650) from localStorage or sessionStorage.
 */
export function getActiveProjectData(): any | null {
  try {
    const rawProj = sessionStorage.getItem('activeProject') || localStorage.getItem('activeProject');
    if (rawProj) {
      const parsed = JSON.parse(rawProj);
      if (parsed?.iso19650) return parsed;
    }
    const cachedIso = localStorage.getItem('cached_project_iso_data');
    if (cachedIso) {
      return JSON.parse(cachedIso);
    }
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
    const cached = getActiveProjectData();
    if (cached?.iso19650) return cached;

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
  return null;
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
export function isIncidentsAdmin(user: any): boolean {
  if (!user) return false;
  const email = String(user.email || '').toLowerCase().trim();
  const role = String(user.role || '').toUpperCase().trim();

  // 1. Super Administrador
  if (role.includes('SUPER') || email === 'imagina3ddesign@gmail.com' || email === 'mcmartinezg@unal.edu.co') {
    return true;
  }

  // 2. Administrador de Empresa / Proyecto en userAccount
  try {
    const rawAccount = typeof window !== 'undefined' ? (sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount')) : null;
    if (rawAccount) {
      const u = JSON.parse(rawAccount);
      const uEmail = String(u.email || u.username || '').toLowerCase().trim();
      const uRole = String(u.role || '').toUpperCase().trim();
      if (uRole.includes('SUPER') || uEmail === 'imagina3ddesign@gmail.com' || uEmail === 'mcmartinezg@unal.edu.co') return true;
      if (uRole === 'ADMINISTRADOR_EMPRESA' || uRole === 'ADMIN_EMPRESA' || uRole === 'ADMINISTRADOR') return true;
      if (uRole === 'ADMINISTRADOR_PROYECTO' || uRole === 'ADMIN_PROYECTO') return true;
    }
  } catch (_) {}

  // 3. Administrador de Proyecto (Rol A en ISO 19650 o creador del proyecto)
  try {
    const proj = getActiveProjectData();
    if (proj) {
      if (proj.creatorEmail && String(proj.creatorEmail).toLowerCase().trim() === email) return true;
      if (Array.isArray(proj.admins) && proj.admins.some((a: string) => String(a).toLowerCase().trim() === email)) return true;
      if (Array.isArray(proj.iso19650?.projectAdmins) && proj.iso19650.projectAdmins.some((a: string) => String(a).toLowerCase().trim() === email)) return true;
      const leadA = proj.iso19650?.adminProyecto || proj.iso19650?.adjudicador || (proj.iso19650?.leaders && (proj.iso19650.leaders.adminProyecto || proj.iso19650.leaders.adjudicador || proj.iso19650.leaders.rolA));
      if (leadA) {
        const leadEmail = typeof leadA === 'string' ? leadA : (leadA.email || leadA.username || '');
        if (String(leadEmail).toLowerCase().trim() === email) return true;
      }
    }
  } catch (_) {}

  // 4. Administrador de Empresa en currentCompany
  try {
    const rawComp = typeof window !== 'undefined' ? (sessionStorage.getItem('currentCompany') || localStorage.getItem('currentCompany')) : null;
    if (rawComp) {
      const c = JSON.parse(rawComp);
      if (Array.isArray(c.admins) && c.admins.some((a: string) => String(a).toLowerCase().trim() === email)) return true;
    }
  } catch (_) {}

  if (role === 'ADMIN' || user.role === 'admin' || user.role === 'super admin' || Boolean(user.isSuperAdmin)) {
    return true;
  }

  return false;
}

export type UserBranchScope = 'ADMIN' | 'DELIVERY' | 'RECEIVER' | 'ALL';

export type IssueTypeScope = 'GLOBAL' | 'DELIVERY' | 'RECEIVER';

/**
 * Resolves the active user's branch within the project based on ISO 19650 governance:
 * - ADMIN: Super Admin, Company Admin, Project Admin.
 * - DELIVERY: Delivery Lead, Delivery Team Leader, Delivery Team Member, or tagged with delivery branch.
 * - RECEIVER: Obra/Receiver Director, Receiver Team Leader, Receiver Team Member, or tagged with receiver branch.
 * - ALL: Fallback when no restrictions apply.
 */
export function getUserProjectBranch(userEmail?: string): UserBranchScope {
  try {
    const rawAcc = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount');
    const userAcc = rawAcc ? JSON.parse(rawAcc) : null;
    const email = (userEmail || userAcc?.username || userAcc?.email || userAcc?.userAccount || '').toLowerCase().trim();

    // 1. Super / Company / System Admins
    const roleUpper = String(userAcc?.role || '').toUpperCase();
    if (
      roleUpper.includes('ADMIN') || 
      roleUpper.includes('SUPER') || 
      roleUpper.includes('GESTOR') || 
      email === 'imagina3ddesign@gmail.com'
    ) {
      return 'ADMIN';
    }

    // 2. Active Project ISO 19650 checks
    const rawProj = sessionStorage.getItem('activeProject') || localStorage.getItem('activeProject');
    if (rawProj) {
      const activeProj = JSON.parse(rawProj);
      const iso = activeProj?.iso19650 || {};

      // 2a. Project Administrators
      const projectAdmins = Array.isArray(iso.projectAdmins) 
        ? iso.projectAdmins.map((a: string) => String(a || '').toLowerCase().trim()) 
        : [];
      if (email && projectAdmins.includes(email)) {
        return 'ADMIN';
      }

      // 2b. Explicit member delimiter branch ISO 19650
      if (email && iso.memberBranches && typeof iso.memberBranches === 'object') {
        const br = String(iso.memberBranches[email] || '').toLowerCase().trim();
        if (br === 'delivery' || br === 'equipo-entrega') return 'DELIVERY';
        if (br === 'receiver' || br === 'equipo-receptor' || br === 'obra') return 'RECEIVER';
      }

      // 2c. Principal Delivery Lead
      const deliveryLead = String(iso.liderEquipoEntrega || '').toLowerCase().trim();
      if (email && deliveryLead === email) return 'DELIVERY';

      // 2d. Delivery Teams (Lead, Member, or Task Teams)
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

      // 2e. Principal Obra / Receiver Lead
      const obraLead = String(iso.directorDeObra || '').toLowerCase().trim();
      if (email && obraLead === email) return 'RECEIVER';

      // 2f. Receiver Teams (Lead, Member, or Task Teams)
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
    }

    // 3. Heuristic fallback based on user profile position / specialty
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
  return 'ALL';
}

/**
 * Checks whether an issue type is visible and creatable for a given user branch:
 * - GLOBAL: visible and creatable by EVERYONE.
 * - DELIVERY: only visible and creatable by Delivery members (and Admins).
 * - RECEIVER: only visible and creatable by Receiver members (and Admins).
 */
export function isTypeAllowedForBranch(
  typeScope: IssueTypeScope = 'GLOBAL',
  userBranch: UserBranchScope = 'ALL'
): boolean {
  if (userBranch === 'ADMIN' || userBranch === 'ALL') return true;
  if (typeScope === 'GLOBAL') return true;
  if (typeScope === 'DELIVERY') return userBranch === 'DELIVERY';
  if (typeScope === 'RECEIVER') return userBranch === 'RECEIVER';
  return true;
}

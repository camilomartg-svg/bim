import { getProjectAndCompany } from '../services/firebaseService';

export interface ProjectLicenseStatus {
  canAccess: boolean;
  isSuspended: boolean;
  status: 'ACTIVE' | 'GRACE_PERIOD' | 'SUSPENDED' | 'EXPIRED' | 'UNPAID';
  overdueDays: number;
  message?: string;
}

let cachedStatus: { key: string; result: ProjectLicenseStatus; timestamp: number } | null = null;

export async function checkIncidenciasLicense(): Promise<ProjectLicenseStatus> {
  try {
    const userAccountStr = sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount') || '{}';
    let userAccount: any = {};
    try {
      userAccount = JSON.parse(userAccountStr);
    } catch (_) {}

    const isSuperAdmin = userAccount.role === 'SUPER_ADMINISTRADOR' ||
      userAccount.username === 'imagina3ddesign@gmail.com' ||
      userAccount.email === 'imagina3ddesign@gmail.com';

    if (isSuperAdmin) {
      return { canAccess: true, isSuspended: false, status: 'ACTIVE', overdueDays: 0 };
    }

    const { projectId, companyId } = getProjectAndCompany();
    if (!projectId || projectId === 'default') {
      return { canAccess: true, isSuspended: false, status: 'ACTIVE', overdueDays: 0 };
    }

    const cacheKey = `${companyId}_${projectId}`;
    if (cachedStatus && cachedStatus.key === cacheKey && (Date.now() - cachedStatus.timestamp < 30000)) {
      return cachedStatus.result;
    }

    let project: any = null;

    // 1. Fetch company config if companyId is present
    if (companyId && companyId !== 'default') {
      try {
        const empRes = await fetch(`../empresas.json?t=${Date.now()}`);
        if (empRes.ok) {
          const empresas = await empRes.json();
          const currentCompany = empresas.find((e: any) => e.id === companyId);
          if (currentCompany && currentCompany.configUrl) {
            const cfgRes = await fetch(`../${currentCompany.configUrl}?t=${Date.now()}`);
            if (cfgRes.ok) {
              const cfg = await cfgRes.json();
              project = cfg.projects?.find((p: any) => p.slug === projectId || p.id === projectId || p.name === projectId);
            }
          }
        }
      } catch (_) {}
    }

    // 2. Fallback to portal-config.json
    if (!project) {
      try {
        const portalRes = await fetch(`../portal-config.json?t=${Date.now()}`);
        if (portalRes.ok) {
          const portalCfg = await portalRes.json();
          project = portalCfg.projects?.find((p: any) => p.slug === projectId || p.id === projectId || p.name === projectId);
        }
      } catch (_) {}
    }

    // 3. Fallback to minimal project object
    if (!project) {
      project = { id: projectId, slug: projectId };
    }

    // Check with global WompiModule if available
    if (typeof (window as any).WompiModule !== 'undefined') {
      const res = (window as any).WompiModule.canAccessProject(project, 3);
      const output: ProjectLicenseStatus = {
        canAccess: res.canAccess,
        isSuspended: !res.canAccess,
        status: res.status,
        overdueDays: res.overdueDays,
        message: res.message
      };
      cachedStatus = { key: cacheKey, result: output, timestamp: Date.now() };
      return output;
    }

    // Direct calculation matching WompiModule
    const paymentStatus = (project.paymentStatus || '').toUpperCase();
    if (paymentStatus === 'PAID') {
      const output: ProjectLicenseStatus = { canAccess: true, isSuspended: false, status: 'ACTIVE', overdueDays: 0 };
      cachedStatus = { key: cacheKey, result: output, timestamp: Date.now() };
      return output;
    }

    const today = new Date();
    let refDate: Date;
    if (project.paidUntil) {
      refDate = new Date(project.paidUntil);
    } else {
      const rawEmission = project.paymentIssuedAt || project.invoiceIssuedAt || project.createdAt;
      if (rawEmission) {
        refDate = new Date(rawEmission);
      } else {
        const idOrSlug = String(project.id || project.slug || '');
        const match = idOrSlug.match(/(\d{10,13})/);
        if (match) {
          const parsed = parseInt(match[1], 10);
          const candidate = new Date(parsed);
          refDate = !isNaN(candidate.getTime()) ? candidate : new Date(today.getFullYear(), today.getMonth(), 3);
        } else {
          refDate = new Date(today.getFullYear(), today.getMonth(), 3);
        }
      }
    }

    const diffTime = today.getTime() - refDate.getTime();
    const overdueDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (overdueDays <= 5) {
      const output: ProjectLicenseStatus = {
        canAccess: true,
        isSuspended: false,
        status: overdueDays > 0 ? 'GRACE_PERIOD' : 'ACTIVE',
        overdueDays: Math.max(0, overdueDays)
      };
      cachedStatus = { key: cacheKey, result: output, timestamp: Date.now() };
      return output;
    }

    const output: ProjectLicenseStatus = {
      canAccess: false,
      isSuspended: true,
      status: 'SUSPENDED',
      overdueDays,
      message: `El proyecto presenta ${overdueDays} días de mora en su mensualidad (+5 días). Servicio suspendido.`
    };
    cachedStatus = { key: cacheKey, result: output, timestamp: Date.now() };
    return output;
  } catch (err) {
    console.warn('Error checking incidencias license:', err);
    return { canAccess: true, isSuspended: false, status: 'ACTIVE', overdueDays: 0 };
  }
}

/**
 * wompi-integration.js - Módulo de Integración con Pasarela Wompi (Colombia)
 * Soporta Sandbox / Producción, Cobro Unificado (Días 3 o 18), Firma SHA-256 de Integridad,
 * Preaviso de 5 días hábiles colombianos y gestión de estados de gracia y retención de 90 días.
 */

window.WompiModule = (function () {
  const TOTAL_PRICE_PER_PROJECT_COP = 137564; // Precio total por proyecto por mes

  // Festivos Oficiales Colombia (2026 y 2027) en formato YYYY-MM-DD
  const COLOMBIAN_HOLIDAYS = [
    // 2026
    "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03", "2026-05-01",
    "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29", "2026-07-20", "2026-08-07",
    "2026-08-17", "2026-10-12", "2026-11-02", "2026-11-16", "2026-12-08", "2026-12-25",
    // 2027
    "2027-01-01", "2027-01-11", "2027-03-22", "2027-03-25", "2027-03-26", "2027-05-01",
    "2027-05-10", "2027-05-31", "2027-06-07", "2027-07-05", "2027-07-20", "2027-08-07",
    "2027-08-16", "2027-10-18", "2027-11-01", "2027-11-15", "2027-12-08", "2027-12-25"
  ];

  /**
   * Verifica si una fecha dada es día hábil en Colombia (Lunes a Viernes no festivo)
   */
  function isColombianBusinessDay(date) {
    const d = new Date(date);
    const dayOfWeek = d.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false; // Domingo o Sábado
    const isoDate = d.toISOString().split('T')[0];
    return !COLOMBIAN_HOLIDAYS.includes(isoDate);
  }

  /**
   * Calcula el número de días hábiles entre dos fechas (exclusivo inicio, inclusivo fin)
   */
  function countBusinessDays(startDate, endDate) {
    let current = new Date(startDate);
    current.setHours(0,0,0,0);
    const end = new Date(endDate);
    end.setHours(0,0,0,0);

    let count = 0;
    while (current < end) {
      current.setDate(current.getDate() + 1);
      if (isColombianBusinessDay(current)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Obtiene la próxima fecha de corte de la empresa (fija el día 3 del mes)
   */
  function getNextCutoffDate(cutoffDay = 3, fromDate = new Date()) {
    const day = 3; // Fecha fija unificada: Día 3
    const now = new Date(fromDate);
    let cutoff = new Date(now.getFullYear(), now.getMonth(), day);
    cutoff.setHours(0, 0, 0, 0);

    if (now >= cutoff) {
      cutoff = new Date(now.getFullYear(), now.getMonth() + 1, day);
      cutoff.setHours(0, 0, 0, 0);
    }
    return cutoff;
  }

  /**
   * Obtiene el número de días restantes hasta la próxima fecha de corte (Día 3)
   */
  function getDaysRemainingUntilCutoff(cutoffDay = 3, fromDate = new Date()) {
    const now = new Date(fromDate);
    const nextCutoff = getNextCutoffDate(cutoffDay, now);
    const diffTime = nextCutoff - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.min(30, diffDays));
  }

  /**
   * Planes de prepago y descuentos por adelantado:
   * - mensual: 1 mes (0% descuento)
   * - trimestre: 3 meses (5% descuento)
   * - semestre: 6 meses (7% descuento)
   * - anualidad: 12 meses (10% descuento)
   */
  const PREPAY_PLANS = {
    monthly: { months: 1, discount: 0, label: 'Mes a mes' },
    trimestre: { months: 3, discount: 0.05, label: 'Trimestre (5% desc.)' },
    semestre: { months: 6, discount: 0.07, label: 'Semestre (7% desc.)' },
    anualidad: { months: 12, discount: 0.10, label: 'Anualidad (10% desc.)' }
  };

  /**
   * Calcula el monto a cobrar para un proyecto.
   * Soporta planes con descuento adelantado: 'trimestre' (-5%), 'semestre' (-7%), 'anualidad' (-10%).
   * Si es mensual y es nuevo/sin pago previo activado antes del día de corte (día 3),
   * el cobro es proporcional a los días que faltan para el corte: (Costo Total / 30) * Días Faltantes.
   */
  function getProjectBillingAmount(project, cutoffDay = 3, fromDate = new Date(), planType = 'monthly') {
    const monthlyRate = TOTAL_PRICE_PER_PROJECT_COP;

    if (project.customTrialExpiry && new Date() <= new Date(project.customTrialExpiry)) {
      return {
        isProrated: false,
        isTrial: true,
        daysRemaining: 0,
        amountCOP: 0,
        monthlyRate: monthlyRate,
        planType: planType,
        discountPercent: 0
      };
    }

    const plan = PREPAY_PLANS[planType] || PREPAY_PLANS.monthly;

    // Si es un plan adelantado (trimestre, semestre, anualidad)
    if (plan.months > 1) {
      const baseSubtotal = monthlyRate * plan.months;
      const discountAmount = Math.round(baseSubtotal * plan.discount);
      const finalAmount = baseSubtotal - discountAmount;
      return {
        isProrated: false,
        isTrial: false,
        daysRemaining: plan.months * 30,
        amountCOP: finalAmount,
        baseAmountCOP: baseSubtotal,
        discountAmountCOP: discountAmount,
        discountPercent: Math.round(plan.discount * 100),
        monthlyRate: monthlyRate,
        planType: planType,
        planMonths: plan.months,
        planLabel: plan.label
      };
    }

    // Plan mensual regular
    if (!project.paidUntil) {
      const daysRemaining = getDaysRemainingUntilCutoff(cutoffDay, fromDate);
      if (daysRemaining < 30) {
        const proratedAmount = Math.round((monthlyRate / 30) * daysRemaining);
        return {
          isProrated: true,
          isTrial: false,
          daysRemaining: daysRemaining,
          amountCOP: proratedAmount,
          monthlyRate: monthlyRate,
          planType: 'monthly',
          discountPercent: 0
        };
      }
    }

    return {
      isProrated: false,
      isTrial: false,
      daysRemaining: 30,
      amountCOP: monthlyRate,
      monthlyRate: monthlyRate,
      planType: 'monthly',
      discountPercent: 0
    };
  }

  /**
   * Verifica si la solicitud de cancelación se hace con al menos 5 días hábiles colombianos
   * antes de la próxima fecha de corte (día 3 del mes).
   */
  function canCancelBeforeNextCycle(cutoffDay = 3) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextCutoff = getNextCutoffDate(3, today);
    const businessDaysUntilCutoff = countBusinessDays(today, nextCutoff);

    return {
      canCancelWithoutCharge: businessDaysUntilCutoff >= 5,
      businessDaysUntilCutoff: businessDaysUntilCutoff,
      nextCutoffDate: nextCutoff.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })
    };
  }

  /**
   * Genera la firma SHA-256 de integridad para Wompi
   * Fórmula: SHA256(reference + amountInCents + currency + integritySecret)
   */
  async function generateIntegritySignature(reference, amountInCents, currency, integritySecret) {
    const rawString = `${reference}${amountInCents}${currency}${integritySecret}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(rawString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Calcula el estado detallado de la licencia de un proyecto:
   * - ACTIVE: Licencia al día
   * - GRACE_PERIOD: En mora o recién activado sin pago (Días 1 a 5). Acceso continuo.
   * - SUSPENDED: Sin pago pasados 5 días. Servicio interrumpido / Inactivo.
   * - EXPIRED_PURGE: Superados 90 días de mora.
   */
  function isTesterProject(project) {
    if (!project) return false;
    
    // Si se desactivó explícitamente el estado de tester, NO es tester
    if (project.isTester === false) return false;

    // Si tiene fecha de expiración de prueba/tester personalizada
    if (project.customTrialExpiry) {
      const trialEnd = new Date(project.customTrialExpiry);
      const now = Date.now();
      if (!isNaN(trialEnd.getTime()) && now <= trialEnd.getTime()) {
        return true;
      }
      return false; // Venció el periodo de tester!
    }

    // Si tiene la bandera de tester activa explícitamente sin expiración
    if (project.isTester === true || project.tester === true || project.isTrial === true || project.trial === true) {
      return true;
    }

    // Tipo explícito de plan tester
    const tipo = String(project.tipo || project.plan || project.type || '').toLowerCase().trim();
    if (tipo === 'tester' || tipo === 'trial') {
      return true;
    }

    return false;
  }

  function isPaymentAdmin(userAccount, companyData, projectData) {
    if (!userAccount) return false;
    const email = String(userAccount.email || userAccount.username || '').toLowerCase().trim();
    const role = String(userAccount.role || '').toUpperCase().trim();

    // 1. Súper Administrador Global
    if (role === 'SUPER_ADMINISTRADOR' || role === 'SUPERADMIN' ||
        email === 'imagina3ddesign@gmail.com' || email === 'mcmartinezg@unal.edu.co') {
      return true;
    }

    // 2. Administrador de Proyecto (Rol A en ISO 19650, creador o admins de proyecto)
    if (projectData) {
      if (projectData.creatorEmail && String(projectData.creatorEmail).toLowerCase().trim() === email) return true;
      if (projectData.creatorId && projectData.creatorId === userAccount.id) return true;
      if (Array.isArray(projectData.admins) && projectData.admins.some(a => String(a).toLowerCase().trim() === email)) return true;

      // ISO 19650: projectAdmins (Rol A)
      if (projectData.iso19650) {
        if (Array.isArray(projectData.iso19650.projectAdmins) &&
            projectData.iso19650.projectAdmins.some(a => String(a).toLowerCase().trim() === email)) {
          return true;
        }
        const singleLeadA = projectData.iso19650.adminProyecto ||
                            projectData.iso19650.adjudicador ||
                            projectData.iso19650.liderProyecto ||
                            (projectData.iso19650.leaders && (projectData.iso19650.leaders.adminProyecto || projectData.iso19650.leaders.adjudicador || projectData.iso19650.leaders.rolA || projectData.iso19650.leaders.admin));
        if (singleLeadA) {
          const leadEmail = typeof singleLeadA === 'string' ? singleLeadA : (singleLeadA.email || singleLeadA.username || '');
          if (String(leadEmail).toLowerCase().trim() === email) return true;
        }
      }

      // Miembros del proyecto con rol explícito de administrador de proyecto
      if (Array.isArray(projectData.members)) {
        const pMember = projectData.members.find(m => {
          const mEmail = (typeof m === 'string' ? m : m.email || m.username || '').toLowerCase().trim();
          return mEmail === email;
        });
        if (pMember && typeof pMember === 'object') {
          const mRole = String(pMember.role || '').toUpperCase().trim();
          if (mRole === 'ADMINISTRADOR_PROYECTO' || mRole === 'ADMIN_PROYECTO' || mRole === 'ADMIN_PROYECTO_A' || mRole === 'ROL_A' || mRole === 'ADMINISTRADOR') {
            return true;
          }
        }
      }
    }

    if (role === 'ADMINISTRADOR_PROYECTO' || role === 'ADMIN_PROYECTO') {
      return true;
    }

    // 3. Administrador de Empresa
    // A) Si el rol del usuario en sesión es administrador de empresa
    if (role === 'ADMINISTRADOR_EMPRESA' || role === 'ADMIN_EMPRESA' || role === 'ADMINISTRADOR') {
      return true;
    }

    // B) Si figura en los administradores o miembros admin de la empresa del proyecto
    if (companyData) {
      if (Array.isArray(companyData.admins) && companyData.admins.some(a => String(a).toLowerCase().trim() === email)) {
        return true;
      }
      if (Array.isArray(companyData.members) && companyData.members.some(m => {
        const mEmail = String(m.email || m.username || '').toLowerCase().trim();
        const mRole = String(m.role || '').toUpperCase().trim();
        return mEmail === email && (mRole === 'ADMIN_EMPRESA' || mRole === 'ADMINISTRADOR_EMPRESA' || mRole === 'ADMINISTRADOR');
      })) {
        return true;
      }
    }

    // C) Si figura como administrador de alguna empresa en el directorio global
    if (typeof window !== 'undefined') {
      const allCompanies = window.allEmpresasGlobal || window.gCompanies || [];
      if (Array.isArray(allCompanies)) {
        for (const emp of allCompanies) {
          if (Array.isArray(emp.admins) && emp.admins.some(a => String(a).toLowerCase().trim() === email)) {
            return true;
          }
          const mAdmin = Array.isArray(emp.members) && emp.members.find(m => {
            const mEmail = String(m.email || m.username || '').toLowerCase().trim();
            const mRole = String(m.role || '').toUpperCase().trim();
            return mEmail === email && (mRole === 'ADMIN_EMPRESA' || mRole === 'ADMINISTRADOR_EMPRESA' || mRole === 'ADMINISTRADOR');
          });
          if (mAdmin) return true;
        }
      }
    }

    return false;
  }

  function getProjectLicenseStatus(project, cutoffDay = 3) {
    if (!project) return { status: 'ACTIVE', badgeText: 'Licencia Activa', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300', canAccess: true };

    if (isTesterProject(project)) {
      return {
        status: 'CUSTOM_TRIAL',
        badgeText: '🎁 Proyecto Tester / Ensayo',
        badgeColor: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
        message: 'Proyecto de prueba / tester con acceso libre habilitado permanentemente.',
        canAccess: true
      };
    }

    if (project.hasLicense === false) {
      return {
        status: 'DISABLED',
        badgeText: 'Desactivado',
        badgeColor: 'bg-slate-200 text-slate-700',
        message: 'Proyecto desactivado manualmente.'
      };
    }

    // Verificar si el proyecto tiene un periodo de gracia / tester personalizado activo otorgado por el Super Admin
    if (project.customTrialExpiry) {
      const trialEnd = new Date(project.customTrialExpiry);
      const now = new Date();
      if (now <= trialEnd) {
        const diffTime = trialEnd - now;
        const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        let label = `${totalDays} día(s)`;
        if (totalDays > 30) {
          const months = Math.round(totalDays / 30);
          label = `${months} mes(es)`;
        } else if (totalDays > 7) {
          const weeks = Math.round(totalDays / 7);
          label = `${weeks} semana(s)`;
        }

        return {
          status: 'CUSTOM_TRIAL',
          trialEnd: trialEnd,
          badgeText: `🎁 Tester Gratuito (${label})`,
          badgeColor: 'bg-purple-100 text-purple-900 border-purple-300 font-bold',
          message: `Licencia Gratuita / Tester otorgada por Súper Admin activa hasta el ${trialEnd.toLocaleDateString('es-CO')}.`
        };
      }
    }

    if (project.cancelledAt) {
      return {
        status: 'CANCELLED',
        badgeText: 'Cancelado (Activo hasta corte)',
        badgeColor: 'bg-amber-100 text-amber-800 border-amber-300',
        message: 'Licencia cancelada. Mantendrá acceso hasta el final del periodo ya pagado.'
      };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const paidUntil = project.paidUntil ? new Date(project.paidUntil) : null;

    if (paidUntil && today <= paidUntil) {
      const nextCutoff = getNextCutoffDate(3, today);
      return {
        status: 'ACTIVE',
        badgeText: 'Licencia Activa',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300',
        message: `Próximo cobro unificado: ${nextCutoff.toLocaleDateString('es-CO')}`
      };
    }

    // Determinar fecha de referencia (paidUntil, fecha de emisión de cobro o creación del proyecto)
    let refDate = null;
    if (paidUntil) {
      refDate = new Date(paidUntil);
    } else if (project.paymentIssuedAt) {
      refDate = new Date(project.paymentIssuedAt);
    } else if (project.invoiceIssuedAt) {
      refDate = new Date(project.invoiceIssuedAt);
    } else if (project.createdAt) {
      refDate = new Date(project.createdAt);
    } else {
      // Extraer timestamp numérico del slug o id (ej: nuevo-proyecto-1794667104070)
      const idOrSlug = String(project.id || project.slug || '');
      const match = idOrSlug.match(/(\d{10,13})/);
      if (match) {
        const ts = parseInt(match[1], 10);
        const d = new Date(ts);
        if (d.getFullYear() >= 2020 && d.getFullYear() <= 2030) {
          refDate = d;
        }
      }
    }

    // Si aún no se determina fecha de emisión previa, tomar la fecha de corte unificada del mes (día 3)
    if (!refDate) {
      const day = 3;
      if (today.getDate() >= day) {
        refDate = new Date(today.getFullYear(), today.getMonth(), day);
      } else {
        refDate = new Date(today.getFullYear(), today.getMonth() - 1, day);
      }
    }
    refDate.setHours(0, 0, 0, 0);

    const diffTime = today - refDate;
    const overdueDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    if (overdueDays <= 5) {
      const remainingGraceDays = Math.max(1, 5 - overdueDays);
      return {
        status: 'GRACE_PERIOD',
        overdueDays: overdueDays,
        graceDaysLeft: remainingGraceDays,
        badgeText: `Gracia de Pago (${remainingGraceDays} días de 5)`,
        badgeColor: 'bg-amber-100 text-amber-900 border-amber-400 font-bold',
        message: `El cobro no se ha procesado. Dispones de ${remainingGraceDays} días de gracia para efectuar el pago antes de que el proyecto sea bloqueado.`
      };
    }

    // Pasados los 5 días de gracia: BLOQUEO TOTAL (SUSPENDED)
    // Periodo de retención de 6 meses (180 días) antes de eliminación definitiva
    const daysInSuspension = overdueDays - 5;
    const daysLeftToPurge = Math.max(0, 180 - daysInSuspension);

    if (daysLeftToPurge === 0) {
      return {
        status: 'EXPIRED_PURGE',
        overdueDays: overdueDays,
        daysLeftToPurge: 0,
        badgeText: 'Eliminado por Mora (>6 meses)',
        badgeColor: 'bg-red-200 text-red-950 border-red-500 font-bold',
        message: '⚠️ El proyecto ha superado 6 meses sin pago y ha sido marcado para eliminación definitiva.'
      };
    }

    return {
      status: 'SUSPENDED',
      overdueDays: overdueDays,
      daysLeftToPurge: daysLeftToPurge,
      badgeText: `Bloqueado por Falta de Pago (${daysLeftToPurge}d retención)`,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-400 font-bold',
      message: `🚫 Proyecto BLOQUEADO por falta de pago. Visualización, carga y descarga deshabilitadas. Se eliminará definitivamente en ${daysLeftToPurge} días si no se cancela la mensualidad.`
    };
  }

  /**
   * Determina si los usuarios tienen permiso de ingresar/operar el proyecto.
   * Regla de negocio:
   * - Proyectos con licencia activa o periodo de gracia (días 1 a 5) o Tester: ACCESO PERMITIDO (canAccess: true).
   * - Proyectos con mora > 5 días (SUSPENDED o EXPIRED_PURGE) o DISABLED: BLOQUEADO (canAccess: false).
   */
  function canAccessProject(project, cutoffDay = 3) {
    if (isTesterProject(project)) {
      return {
        canAccess: true,
        status: 'CUSTOM_TRIAL',
        overdueDays: 0,
        graceDaysLeft: 5,
        daysLeftToPurge: 180,
        message: 'Proyecto de prueba / tester con acceso libre habilitado permanentemente.'
      };
    }
    const lic = getProjectLicenseStatus(project, cutoffDay);
    const isAllowed = (lic.status === 'ACTIVE' || lic.status === 'CUSTOM_TRIAL' || lic.status === 'GRACE_PERIOD' || lic.status === 'CANCELLED');
    return {
      canAccess: isAllowed,
      status: lic.status,
      badgeText: lic.badgeText,
      badgeColor: lic.badgeColor,
      message: lic.message,
      daysLeftToPurge: lic.daysLeftToPurge || 0,
      graceDaysLeft: lic.graceDaysLeft || 0
    };
  }

  /**
   * Inicia el Checkout Widget de Wompi
   */
  async function launchCheckout({
    publicKey,
    integritySecret,
    reference,
    amountInCents,
    currency = 'COP',
    redirectUrl = window.location.href,
    customerEmail = '',
    customerName = ''
  }) {
    if (!publicKey) {
      throw new Error('Llave pública de Wompi no configurada.');
    }

    const signature = await generateIntegritySignature(reference, amountInCents, currency, integritySecret);

    const checkoutConfig = {
      currency: currency,
      amountInCents: amountInCents,
      reference: reference,
      publicKey: publicKey,
      signature: { integrity: signature },
      redirectUrl: redirectUrl
    };

    if (customerEmail) {
      checkoutConfig.customerData = {
        email: customerEmail,
        fullName: customerName || customerEmail.split('@')[0]
      };
    }

    if (window.WidgetCheckout) {
      const checkout = new window.WidgetCheckout(checkoutConfig);
      checkout.open(function (result) {
        console.log('Resultado del pago Wompi Widget:', result);
      });
    } else {
      const params = new URLSearchParams({
        'public-key': publicKey,
        'currency': currency,
        'amount-in-cents': amountInCents,
        'reference': reference,
        'signature:integrity': signature,
        'redirect-url': redirectUrl,
        'customer-data:email': customerEmail
      });
      window.location.href = `https://checkout.wompi.co/p/?${params.toString()}`;
    }
  }

  /**
   * Renderiza una pantalla de bloqueo total con diseño oscuro/blur sobre cualquier contenedor o página
   * cuando el proyecto se encuentra suspendido por falta de pago (mora > 5 días).
   */
  function renderSuspensionOverlay(targetContainer, options = {}) {
    const container = targetContainer || document.body;
    if (document.getElementById('nora-suspension-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'nora-suspension-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.zIndex = '2147483647';
    overlay.style.backgroundColor = 'rgba(8, 10, 15, 0.96)';
    overlay.style.backdropFilter = 'blur(16px)';
    overlay.style.webkitBackdropFilter = 'blur(16px)';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '20px';
    overlay.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    overlay.style.color = '#ffffff';
    overlay.style.boxSizing = 'border-box';

    const moduleName = options.moduleName || 'esta herramienta';
    const moduleDesc = options.moduleDescription || 'La consulta, visualización y operación de este módulo se encuentran bloqueadas.';
    const daysLeft = options.daysLeftToPurge || 175;
    const projectSlug = options.projectSlug || '';
    const companyId = options.companyId || '';
    const backUrl = options.backUrl || (projectSlug ? `../project-landing.html?project=${encodeURIComponent(projectSlug)}&empresa=${encodeURIComponent(companyId)}` : '../home.html');
    const payUrl = options.payUrl || '../super-admin.html';

    let isPayAdmin = options.isAdmin;
    if (typeof isPayAdmin === 'undefined') {
      try {
        const uAcc = JSON.parse(sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount') || '{}');
        isPayAdmin = isPaymentAdmin(uAcc, options.companyData || (typeof window !== 'undefined' ? window.currentCompanyData : null), options.projectData, options.representedCompany);
      } catch (e) {
        isPayAdmin = false;
      }
    }

    if (!isPayAdmin) {
      overlay.innerHTML = `
        <div style="max-width: 520px; width: 100%; background: #18181b; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 24px; padding: 36px 32px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); text-align: center; box-sizing: border-box;">
          <div style="width: 72px; height: 72px; background: rgba(255, 255, 255, 0.06); border: 2px solid rgba(255, 255, 255, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; color: #f1f5f9;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 10px 0; letter-spacing: -0.02em;">
            Proyecto Bloqueado
          </h2>
          <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6; margin: 0 0 24px 0;">
            El acceso a las funciones, modelos y herramientas de este proyecto se encuentra temporalmente inhabilitado. Si necesitas acceso, contacta al administrador del proyecto.
          </p>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <a href="${backUrl}" style="background: rgba(255, 255, 255, 0.12); color: #ffffff; text-decoration: none; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 24px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.25); display: inline-flex; align-items: center; gap: 8px;">
              Volver al Portal
            </a>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      return;
    } else {
      overlay.innerHTML = `
        <div style="max-width: 560px; width: 100%; background: #18181b; border: 2px solid #f43f5e; border-radius: 24px; padding: 36px 32px; box-shadow: 0 25px 50px -12px rgba(244, 63, 94, 0.35); text-align: center; box-sizing: border-box;">
          <div style="width: 72px; height: 72px; background: rgba(244, 63, 94, 0.15); border: 2px solid #f43f5e; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px auto; color: #f43f5e;">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
          </div>
          <h2 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 10px 0; letter-spacing: -0.02em;">
            Proyecto Suspendido por Falta de Pago
          </h2>
          <p style="font-size: 13px; color: #cbd5e1; line-height: 1.6; margin: 0 0 20px 0;">
            El periodo de gracia de <strong>5 días posteriores a la fecha de corte</strong> ha finalizado sin registrar el pago de la mensualidad del proyecto.
          </p>
          <div style="background: rgba(244, 63, 94, 0.12); border: 1px solid rgba(244, 63, 94, 0.35); border-radius: 14px; padding: 14px 18px; margin-bottom: 22px; text-align: left;">
            <p style="font-size: 12px; font-weight: 700; color: #fda4af; margin: 0 0 4px 0;">🚫 Restricción Activa en ${moduleName}:</p>
            <p style="font-size: 12px; color: #f1f5f9; margin: 0; line-height: 1.5;">${moduleDesc} Para reactivar el servicio inmediatamente, efectúa el pago correspondiente.</p>
          </div>
          <div style="font-size: 11px; color: #94a3b8; margin-bottom: 24px;">
            Retención de datos antes de eliminación definitiva: <strong style="color: #f43f5e;">${daysLeft} días</strong>
          </div>
          <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
            <a href="${payUrl}" style="background: #f43f5e; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 24px; border-radius: 12px; box-shadow: 0 4px 12px rgba(244, 63, 94, 0.4); display: inline-flex; align-items: center; gap: 8px;">
              Pagar Licencia en Pasarela Wompi
            </a>
            <a href="${backUrl}" style="background: rgba(255, 255, 255, 0.08); color: #e2e8f0; text-decoration: none; font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; padding: 12px 20px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.15); display: inline-flex; align-items: center; gap: 8px;">
              Volver al Portal
            </a>
          </div>
        </div>
      `;
    }

    container.appendChild(overlay);
  }

  return {
    TOTAL_PRICE_PER_PROJECT_COP,
    PREPAY_PLANS,
    isColombianBusinessDay,
    countBusinessDays,
    getNextCutoffDate,
    getDaysRemainingUntilCutoff,
    getProjectBillingAmount,
    canCancelBeforeNextCycle,
    generateIntegritySignature,
    getProjectLicenseStatus,
    canAccessProject,
    renderSuspensionOverlay,
    launchCheckout,
    isTesterProject,
    isPaymentAdmin
  };
})();

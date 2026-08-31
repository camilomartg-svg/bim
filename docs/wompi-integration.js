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
   * Calcula el monto a cobrar para un proyecto.
   * Si es un proyecto nuevo (o sin pago previo) activado antes de la fecha de corte (día 3),
   * el cobro es proporcional a los días que faltan para el corte: (Costo Total / 30) * Días Faltantes.
   */
  function getProjectBillingAmount(project, cutoffDay = 3, fromDate = new Date()) {
    const monthlyRate = TOTAL_PRICE_PER_PROJECT_COP;

    if (project.customTrialExpiry && new Date() <= new Date(project.customTrialExpiry)) {
      return {
        isProrated: false,
        isTrial: true,
        daysRemaining: 0,
        amountCOP: 0,
        monthlyRate: monthlyRate
      };
    }

    if (!project.paidUntil) {
      const daysRemaining = getDaysRemainingUntilCutoff(cutoffDay, fromDate);
      if (daysRemaining < 30) {
        const proratedAmount = Math.round((monthlyRate / 30) * daysRemaining);
        return {
          isProrated: true,
          daysRemaining: daysRemaining,
          amountCOP: proratedAmount,
          monthlyRate: monthlyRate
        };
      }
    }
    return {
      isProrated: false,
      daysRemaining: 30,
      amountCOP: monthlyRate,
      monthlyRate: monthlyRate
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
  function getProjectLicenseStatus(project, cutoffDay = 3) {
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

    // Determinar fecha de referencia (paidUntil o fecha de creación/activación del proyecto)
    const refDate = paidUntil || (project.createdAt ? new Date(project.createdAt) : today);
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
        message: `El cobro no se ha procesado. Dispones de ${remainingGraceDays} días de gracia para efectuar el pago.`
      };
    }

    const daysInSuspension = overdueDays - 5;
    const daysLeftToPurge = Math.max(0, 90 - daysInSuspension);

    return {
      status: 'SUSPENDED',
      overdueDays: overdueDays,
      daysLeftToPurge: daysLeftToPurge,
      badgeText: `Inactivo (Sin Pago - ${daysLeftToPurge}d retención)`,
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-400 font-bold',
      message: `⚠️ Servicio inactivo por falta de pago. Tus datos se conservarán por ${daysLeftToPurge} días calendario antes de su eliminación permanente.`
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

  return {
    TOTAL_PRICE_PER_PROJECT_COP,
    isColombianBusinessDay,
    countBusinessDays,
    getNextCutoffDate,
    getDaysRemainingUntilCutoff,
    getProjectBillingAmount,
    canCancelBeforeNextCycle,
    generateIntegritySignature,
    getProjectLicenseStatus,
    launchCheckout
  };
})();

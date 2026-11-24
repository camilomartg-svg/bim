/**
 * nora-user-header.js - Componente Unificado de Usuario y Representación
 * Muestra el avatar con inicial, nombre del usuario, indicador de empresa representada
 * y menú desplegable de sesión activa con opción de cambiar de empresa en el proyecto.
 */

(function () {
  'use strict';

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getQueryParam(name) {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get(name) || '';
    } catch (_) {
      return '';
    }
  }

  function getActiveUser() {
    try {
      return JSON.parse(sessionStorage.getItem('userAccount') || localStorage.getItem('userAccount') || 'null');
    } catch (_) {
      return null;
    }
  }

  async function loadAllEmpresas() {
    if (Array.isArray(window.allEmpresasGlobal) && window.allEmpresasGlobal.length) {
      return window.allEmpresasGlobal;
    }
    try {
      const res = await fetch('empresas.json');
      if (res.ok) {
        const data = await res.json();
        window.allEmpresasGlobal = data;
        return data;
      }
    } catch (_) {}
    return [];
  }

  function getProjectRepCompany(projectSlug, projectId, userEmail) {
    const cleanEmail = String(userEmail || '').toLowerCase().trim();
    if (projectSlug) {
      const saved = localStorage.getItem(`project_rep_company_${projectSlug}_${cleanEmail}`);
      if (saved) return saved;
    }
    if (projectId) {
      const saved = localStorage.getItem(`project_rep_company_${projectId}_${cleanEmail}`);
      if (saved) return saved;
    }
    return '';
  }

  function saveProjectRepCompany(projectSlug, projectId, userEmail, companyName) {
    const cleanEmail = String(userEmail || '').toLowerCase().trim();
    if (projectSlug) {
      localStorage.setItem(`project_rep_company_${projectSlug}_${cleanEmail}`, companyName);
    }
    if (projectId) {
      localStorage.setItem(`project_rep_company_${projectId}_${cleanEmail}`, companyName);
    }
  }

  function ensureModalExists(userCompanies, currentRep, onSave) {
    let modal = document.getElementById('rep-company-modal-global');
    if (modal) {
      modal.remove();
    }

    modal = document.createElement('div');
    modal.id = 'rep-company-modal-global';
    modal.className = 'fixed inset-0 z-[10000] hidden items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200';
    modal.style.zIndex = '10000';

    modal.innerHTML = `
      <div class="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl border border-zinc-200/80 dark:border-zinc-800 p-6 space-y-5 animate-in zoom-in-95 duration-200 text-left">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <span class="material-symbols-outlined text-2xl">domain</span>
          </div>
          <div>
            <h3 class="text-base font-black text-slate-900 dark:text-white leading-tight">¿Qué Empresa Representas?</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Selecciona con qué empresa interactúas en este proyecto:</p>
          </div>
        </div>

        <div id="rep-company-options-list-global" class="space-y-2 max-h-60 overflow-y-auto pr-1">
          <!-- Opciones dinámicas -->
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <button type="button" id="rep-modal-cancel-btn" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">Cancelar</button>
          <button type="button" id="rep-modal-save-btn" class="px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-black text-white dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 text-xs font-black uppercase tracking-wider shadow-lg transition-all">Guardar Representación</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const optionsContainer = document.getElementById('rep-company-options-list-global');
    optionsContainer.innerHTML = '';

    let selectedCompany = currentRep || (userCompanies[0] ? userCompanies[0].name : '');

    userCompanies.forEach(comp => {
      const isSelected = comp.name.toLowerCase() === selectedCompany.toLowerCase();
      const item = document.createElement('label');
      item.className = `flex items-center justify-between p-3.5 rounded-2xl border cursor-pointer transition-all ${
        isSelected
          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-slate-700 dark:text-slate-300'
      }`;
      item.innerHTML = `
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs font-bold uppercase text-zinc-600 dark:text-zinc-400">
            ${escapeHtml((comp.code || comp.name.substring(0, 2)).toUpperCase())}
          </div>
          <span class="text-xs font-bold">${escapeHtml(comp.name)}</span>
        </div>
        <input type="radio" name="rep-company-radio-global" value="${escapeHtml(comp.name)}" ${isSelected ? 'checked' : ''} class="w-4 h-4 text-indigo-600 border-zinc-300 dark:border-zinc-700 focus:ring-indigo-500">
      `;

      item.querySelector('input').addEventListener('change', (e) => {
        selectedCompany = e.target.value;
        optionsContainer.querySelectorAll('label').forEach(lbl => {
          lbl.classList.remove('border-indigo-600', 'bg-indigo-50/50', 'dark:bg-indigo-950/20', 'text-indigo-900', 'dark:text-indigo-200');
          lbl.classList.add('border-zinc-200', 'dark:border-zinc-800', 'text-slate-700', 'dark:text-slate-300');
        });
        item.classList.remove('border-zinc-200', 'dark:border-zinc-800', 'text-slate-700', 'dark:text-slate-300');
        item.classList.add('border-indigo-600', 'bg-indigo-50/50', 'dark:bg-indigo-950/20', 'text-indigo-900', 'dark:text-indigo-200');
      });

      optionsContainer.appendChild(item);
    });

    document.getElementById('rep-modal-cancel-btn').addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });

    document.getElementById('rep-modal-save-btn').addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      if (typeof onSave === 'function') {
        onSave(selectedCompany);
      }
    });

    return modal;
  }

  async function renderUserHeader(targetContainer) {
    if (!targetContainer) return;

    const userAccount = getActiveUser();
    if (!userAccount) {
      targetContainer.classList.add('hidden');
      return;
    }

    const userName = userAccount.name || userAccount.nombre || userAccount.username || 'Usuario';
    const userEmail = userAccount.email || userAccount.username || '';
    const userInitial = (userName.trim()[0] || 'U').toUpperCase();

    const empParamVal = getQueryParam('empresa');
    const projectSlug = getQueryParam('project');

    // Determinar empresa de representación
    const allEmpresas = await loadAllEmpresas();
    const cleanEmail = userEmail.toLowerCase().trim();

    // Empresas a las que pertenece el usuario
    const userCompanies = (Array.isArray(allEmpresas) ? allEmpresas : []).filter(c => {
      const inAdmins = Array.isArray(c.admins) && c.admins.some(a => String(a).toLowerCase().trim() === cleanEmail);
      const inMembers = Array.isArray(c.members) && c.members.some(m => String(m.email || m.username || '').toLowerCase().trim() === cleanEmail);
      return inAdmins || inMembers;
    });

    let currentRep = getProjectRepCompany(projectSlug, '', cleanEmail);

    if (!currentRep) {
      if (userAccount.empresaRepresentada) {
        currentRep = userAccount.empresaRepresentada;
      } else if (empParamVal) {
        const found = allEmpresas.find(e => e.id === empParamVal || (e.name && e.name.toLowerCase() === empParamVal.toLowerCase()));
        if (found) currentRep = found.name;
      } else if (userAccount.empresaUsuario || userAccount.empresa) {
        currentRep = userAccount.empresaUsuario || userAccount.empresa;
      } else if (userCompanies.length > 0) {
        currentRep = userCompanies[0].name;
      }
    }

    targetContainer.classList.remove('hidden');
    targetContainer.className = 'relative flex items-center gap-2';
    targetContainer.innerHTML = `
      <div id="nora-header-user-btn" class="flex items-center gap-2 bg-white/90 dark:bg-zinc-800/90 border border-slate-200/90 dark:border-zinc-700/80 rounded-full py-1 px-3 shadow-sm hover:shadow transition-all cursor-pointer select-none">
        <div class="w-6 h-6 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 flex items-center justify-center text-[10px] font-black uppercase shadow-inner shrink-0">
          ${escapeHtml(userInitial)}
        </div>
        <div class="flex flex-col text-left">
          <span class="text-xs font-bold text-slate-800 dark:text-white leading-tight truncate max-w-[140px] sm:max-w-[180px]">${escapeHtml(userName)}</span>
          <span class="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-1 truncate max-w-[140px] sm:max-w-[180px]">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
            <span id="nora-header-rep-badge">${escapeHtml(currentRep || 'Representación')}</span>
          </span>
        </div>
        <span class="material-symbols-outlined text-[16px] text-zinc-400 dark:text-zinc-500 ml-0.5">expand_more</span>
      </div>

      <!-- Dropdown Menú de Usuario -->
      <div id="nora-header-dropdown-menu" class="hidden absolute right-0 top-full mt-2 w-72 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-3 z-[9999] animate-in fade-in zoom-in-95 duration-150 text-left" style="z-index: 9999;">
        <div class="px-2.5 py-2 border-b border-zinc-100 dark:border-zinc-800">
          <p class="text-[9px] font-bold uppercase tracking-wider text-zinc-400">Sesión Activa</p>
          <p class="text-xs font-bold text-zinc-900 dark:text-white truncate">${escapeHtml(userName)}</p>
          <p class="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">${escapeHtml(userEmail)}</p>
        </div>

        <!-- Empresa que representa -->
        <div class="p-2.5 my-2 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200/60 dark:border-zinc-700/60 space-y-1">
          <div class="flex items-center justify-between">
            <span class="text-[9px] font-black uppercase tracking-wider text-zinc-400">En este proyecto:</span>
            ${userCompanies.length > 1 ? '<button id="nora-btn-change-rep" type="button" class="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline">Cambiar</button>' : ''}
          </div>
          <p class="text-xs font-extrabold text-zinc-800 dark:text-zinc-100 flex items-center gap-1.5 truncate">
            <span class="material-symbols-outlined text-[14px] text-emerald-500 shrink-0">domain</span>
            <span id="nora-dropdown-rep-badge">${escapeHtml(currentRep || 'Sin definir')}</span>
          </p>
        </div>

        <div class="pt-1 flex flex-col gap-1">
          <a href="${window.location.pathname.includes('/INCIDENCIAS') || window.location.pathname.includes('/VSR_') ? '../perfil.html' : 'perfil.html'}${empParamVal ? `?empresa=${encodeURIComponent(empParamVal)}` : ''}${projectSlug ? `&project=${encodeURIComponent(projectSlug)}` : ''}" class="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
            <span class="material-symbols-outlined text-[16px] text-zinc-400">badge</span>
            <span>Mi Perfil de Usuario</span>
          </a>
          <button id="nora-btn-logout" type="button" class="flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors text-left w-full">
            <span class="material-symbols-outlined text-[16px]">logout</span>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </div>
    `;

    const userBtn = document.getElementById('nora-header-user-btn');
    const dropdown = document.getElementById('nora-header-dropdown-menu');
    const changeRepBtn = document.getElementById('nora-btn-change-rep');
    const logoutBtn = document.getElementById('nora-btn-logout');

    if (userBtn && dropdown) {
      userBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('hidden');
      });

      document.addEventListener('click', (e) => {
        if (!targetContainer.contains(e.target)) {
          dropdown.classList.add('hidden');
        }
      });
    }

    if (changeRepBtn) {
      changeRepBtn.addEventListener('click', () => {
        dropdown.classList.add('hidden');
        const modal = ensureModalExists(userCompanies, currentRep, (newRep) => {
          currentRep = newRep;
          saveProjectRepCompany(projectSlug, '', cleanEmail, newRep);
          const badge1 = document.getElementById('nora-header-rep-badge');
          const badge2 = document.getElementById('nora-dropdown-rep-badge');
          if (badge1) badge1.textContent = newRep;
          if (badge2) badge2.textContent = newRep;
        });
        modal.classList.remove('hidden');
        modal.classList.add('flex');
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        sessionStorage.removeItem('userAccount');
        localStorage.removeItem('userAccount');
        window.location.reload();
      });
    }
  }

  window.NoraUserHeader = {
    init: function (containerSelector) {
      let target = null;
      if (containerSelector) {
        target = typeof containerSelector === 'string' ? document.querySelector(containerSelector) : containerSelector;
      }
      if (!target) {
        target = document.getElementById('auth-container') ||
                 document.getElementById('user-header-container') ||
                 document.getElementById('user-role-badge') ||
                 document.querySelector('.nora-user-header-slot');
      }
      if (target) {
        renderUserHeader(target);
      }
    }
  };

  // Auto-inicialización si el elemento estándar existe
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.NoraUserHeader.init());
  } else {
    window.NoraUserHeader.init();
  }

})();

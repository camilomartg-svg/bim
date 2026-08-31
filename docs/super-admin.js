document.addEventListener('DOMContentLoaded', async () => {
  let userRole = 'INVITADO';
  let userEmail = '';
  try {
    const ua = JSON.parse(localStorage.getItem('userAccount') || sessionStorage.getItem('userAccount') || 'null');
    if (ua) {
        userRole = ua.role;
        userEmail = (ua.username || '').toLowerCase();
    }
  } catch(e) {}

  // Ajustar la interfaz de forma síncrona e inmediata según el rol del usuario
  if (userRole === 'SUPER_ADMINISTRADOR') {
      const globalTabs = document.getElementById('global-tabs-container');
      if (globalTabs) {
          globalTabs.classList.remove('hidden');
          globalTabs.classList.add('md:flex');
      }
      const addEmpBtn = document.getElementById('add-empresa-btn');
      if (addEmpBtn) addEmpBtn.classList.remove('hidden');
      
      const deleteEmpBtn = document.getElementById('delete-empresa-btn');
      if (deleteEmpBtn) deleteEmpBtn.classList.remove('hidden');
      
      const configTabBtn = document.getElementById('tab-btn-configuracion');
      if (configTabBtn) configTabBtn.classList.remove('hidden');

      const wompiBtn = document.getElementById('global-wompi-config-btn');
      if (wompiBtn) wompiBtn.classList.remove('hidden');
  } else {
      const title = document.getElementById('page-title');
      const subtitle = document.getElementById('page-subtitle');
      if (title) title.textContent = 'Gestión de Mi Empresa';
      if (subtitle) subtitle.textContent = 'Administración';
      
      const globalTabs = document.getElementById('global-tabs-container');
      if (globalTabs) {
          globalTabs.classList.add('hidden');
          globalTabs.classList.remove('md:flex');
      }
      const addEmpBtn = document.getElementById('add-empresa-btn');
      if (addEmpBtn) addEmpBtn.classList.add('hidden');
      
      const deleteEmpBtn = document.getElementById('delete-empresa-btn');
      if (deleteEmpBtn) deleteEmpBtn.classList.add('hidden');
      
      const configTabBtn = document.getElementById('tab-btn-configuracion');
      if (configTabBtn) configTabBtn.classList.add('hidden');

      const wompiBtn = document.getElementById('global-wompi-config-btn');
      if (wompiBtn) wompiBtn.classList.add('hidden');
  }

  let empresas = [];
  let superAdmins = [];
  let companyConfigs = {}; // Store configs by emp.id
  let selectedIndex = -1;
  let searchTerm = '';
  
  // Expose to global scope for our new modules using getters to stay in sync
  Object.defineProperty(window, 'empresas', { get: () => empresas, configurable: true });
  Object.defineProperty(window, 'selectedIndex', { get: () => selectedIndex, configurable: true });
  Object.defineProperty(window, 'userRole', { get: () => userRole, configurable: true });
  Object.defineProperty(window, 'companyConfigs', { get: () => companyConfigs, configurable: true });

  const listEl = document.getElementById('empresas-list');
  const editorEl = document.getElementById('empresa-editor');
  const banner = document.getElementById('status-banner');
  const searchInput = document.getElementById('search-empresa');

  // Tab elements
  const tabs = {
    btns: [document.getElementById('tab-btn-ficha'), document.getElementById('tab-btn-usuarios'), document.getElementById('tab-btn-proyectos'), document.getElementById('tab-btn-configuracion')],
    contents: [document.getElementById('tab-content-ficha'), document.getElementById('tab-content-usuarios'), document.getElementById('tab-content-proyectos'), document.getElementById('tab-content-configuracion')]
  };

  const usersListEl = document.getElementById('usuarios-list');
  const projectsListEl = document.getElementById('proyectos-list-tab');
  const configListEl = document.getElementById('configuracion-list-tab');

  // References to all inputs
  const el = {
    // Basicos
    id: document.getElementById('emp-id'),
    name: document.getElementById('emp-name'),
    location: document.getElementById('emp-location'),
    code: document.getElementById('emp-code'),
    image: document.getElementById('emp-image'),
    // Fase 1
    razonSocial: document.getElementById('emp-razonSocial'),
    nit: document.getElementById('emp-nit'),
    repLegal: document.getElementById('emp-repLegal'),
    direccion: document.getElementById('emp-direccion'),
    ciudad: document.getElementById('emp-ciudad'),
    departamento: document.getElementById('emp-departamento'),
    correoFacturacion: document.getElementById('emp-correoFacturacion'),
    // Fase 2
    sitioWeb: document.getElementById('emp-sitioWeb'),
    correoGeneral: document.getElementById('emp-correoGeneral'),
    telefonoCorporativo: document.getElementById('emp-telefonoCorporativo'),
    contactoOperativo: document.getElementById('emp-contactoOperativo'),
    cargoContacto: document.getElementById('emp-cargoContacto'),
    celularContacto: document.getElementById('emp-celularContacto'),
    // Fase 3
    proveedorNube: document.getElementById('emp-proveedorNube'),
    zonaHoraria: document.getElementById('emp-zonaHoraria'),
    tipoActor: document.getElementById('emp-tipoActor'),
    tamanoEmpresa: document.getElementById('emp-tamanoEmpresa'),
    volumenProyectos: document.getElementById('emp-volumenProyectos'),
    // Legal
    terminosAceptados: document.getElementById('emp-terminosAceptados'),
    tratamientoDatos: document.getElementById('emp-tratamientoDatos'),
    // Portal Generalidades
    portalName: document.getElementById('portal-name'),
    portalShortName: document.getElementById('portal-short-name'),
    portalLogoLight: document.getElementById('portal-logo-light'),
    portalLogoDark: document.getElementById('portal-logo-dark'),
    portalLogoFooterLight: document.getElementById('portal-logo-footer-light'),
    portalLogoFooterDark: document.getElementById('portal-logo-footer-dark'),
    portalLogoFooterSecondaryLight: document.getElementById('portal-logo-footer-secondary-light'),
    portalLogoFooterSecondaryDark: document.getElementById('portal-logo-footer-secondary-dark'),
    portalFooterText: document.getElementById('portal-footer-text'),
    portalHeroImages: document.getElementById('portal-hero-images')
  };

  function showBanner(msg, type = 'info') {
    banner.textContent = msg;
    banner.className = 'mt-4 rounded-2xl border px-4 py-3 text-sm font-medium block ' + (type === 'error' ? 'border-rose-200 bg-rose-50 text-rose-700' : type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { banner.classList.add('hidden'); }, 5000);
  }

  async function loadData() {
    try {
      const ts = Date.now();
      const res = await fetch(`empresas.json?t=${ts}`);
      if (res.ok) empresas = await res.json();
      
      try {
        const urlGoogle = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';
        const gRes = await fetch(urlGoogle + '?action=getCompanies');
        if (gRes.ok) {
           const gCompanies = await gRes.json();
            
            let addedNew = false;
            gCompanies.forEach(gc => {
               if (gc.id && !empresas.find(e => e.id === gc.id || (e.name && gc.name && e.name.toLowerCase() === gc.name.toLowerCase()))) {
                   empresas.push({
                       id: gc.id,
                       name: gc.name || gc.legalName,
                       code: (gc.name ? gc.name.substring(0,3).toUpperCase() : 'NVA'),
                       admins: [],
                       zonaHoraria: 'America/Bogota',
                       members: [],
                       razonSocial: gc.legalName || gc.name,
                       terminosAceptados: true,
                       tratamientoDatos: true,
                       image: gc.logoBase64 || 'https://i.postimg.cc/02mTnnQv/21bd5ee9d2351270615280386caad1f3.jpg',
                       location: gc.city ? (gc.city + ', ' + gc.country) : 'Bogotá, Colombia',
                       configUrl: 'config-' + gc.id + '.json'
                   });
                   addedNew = true;
               }
            });
            if(addedNew) showBanner('Se descubrieron nuevas empresas registradas. Haz clic en Guardar para integrarlas permanentemente.', 'success');

            // Reconciliar administradores principales de la hoja "Empresas"
            empresas.forEach(emp => {
                const gc = gCompanies.find(c => c.id === emp.id || (emp.name && c.name && emp.name.toLowerCase().trim() === c.name.toLowerCase().trim()));
                if (gc && gc.email && gc.email.trim() !== '') {
                    const adminEmail = gc.email.toLowerCase().trim();
                    if (!emp.admins) emp.admins = [];
                    if (!emp.admins.some(a => a.toLowerCase().trim() === adminEmail)) {
                        emp.admins.push(adminEmail);
                    }
                    if (!emp.members) emp.members = [];
                    const mIdx = emp.members.findIndex(m => m.email && m.email.toLowerCase().trim() === adminEmail);
                    const memberData = {
                        name: adminEmail.split('@')[0],
                        email: adminEmail,
                        role: 'ADMINISTRADOR_EMPRESA',
                        empresaUsuario: emp.name,
                        especialidad: '',
                        cargo: 'Administrador de Empresa'
                    };
                    if (mIdx > -1) {
                        emp.members[mIdx].role = 'ADMINISTRADOR_EMPRESA';
                        if (!emp.members[mIdx].cargo || emp.members[mIdx].cargo === '') {
                            emp.members[mIdx].cargo = 'Administrador de Empresa';
                        }
                    } else {
                        emp.members.push(memberData);
                    }
                }
            });
         }

         // Sincronizar miembros y administradores desde la lista de usuarios en Google Sheets
         try {
            const uRes = await fetch(urlGoogle + '?t=' + Date.now());
            if (uRes.ok) {
                const gUsers = await uRes.json();
                
                const cleanText = (str) => {
                    if (!str) return '';
                    return str.toLowerCase()
                              .normalize("NFD")
                              .replace(/[\u0300-\u036f]/g, "")
                              .replace(/[^a-z0-9]/g, "")
                              .trim();
                };
                
                // Map Google Sheet users by lowercased email for quick lookup
                const gUsersMap = new Map();
                gUsers.forEach(gu => {
                    if (gu.email) {
                        const emailClean = gu.email.toLowerCase().trim();
                        gUsersMap.set(emailClean, gu);
                    }
                });

                // Encontrar la única mejor empresa para cada usuario de Google Sheets para evitar duplicación
                const userBestCompanyMap = new Map(); // emailClean -> emp.id
                
                gUsers.forEach(gu => {
                    if (!gu.email || !gu.empresa) return;
                    const emailClean = gu.email.toLowerCase().trim();
                    const guEmp = cleanText(gu.empresa);
                    
                    // 1. Coincidencia exacta primero
                    let bestMatch = empresas.find(emp => {
                        const empName = cleanText(emp.name);
                        const empRazon = cleanText(emp.razonSocial);
                        return guEmp === empName || guEmp === empRazon;
                    });
                    
                    // 2. Coincidencia por inclusión si no hay exacta
                    if (!bestMatch) {
                        bestMatch = empresas.find(emp => {
                            const empName = cleanText(emp.name);
                            const empRazon = cleanText(emp.razonSocial);
                            return (empName && (empName.includes(guEmp) || guEmp.includes(empName))) ||
                                   (empRazon && (empRazon.includes(guEmp) || guEmp.includes(empRazon)));
                        });
                    }
                    
                    if (bestMatch) {
                        userBestCompanyMap.set(emailClean, bestMatch.id);
                    }
                });

                empresas.forEach(emp => {
                    if (!emp.members) emp.members = [];
                    if (!emp.admins) emp.admins = [];
                    gUsers.forEach(gu => {
                         const email = gu.email ? gu.email.toLowerCase().trim() : '';
                         if (email && userBestCompanyMap.get(email) === emp.id) {
                             const mIdx = emp.members.findIndex(m => m.email && m.email.toLowerCase().trim() === email);
                             const memberData = {
                                 name: gu.nombre || email.split('@')[0],
                                 email: email,
                                 role: gu.rol || 'INVITADO',
                                 empresaUsuario: gu.empresa,
                                 especialidad: gu.especialidad || '',
                                 cargo: gu.cargo || ''
                             };
                             if (mIdx > -1) {
                                 emp.members[mIdx] = { ...emp.members[mIdx], ...memberData };
                             } else {
                                 emp.members.push(memberData);
                             }
                             
                             if (gu.rol === 'ADMINISTRADOR_EMPRESA') {
                                 const adminExists = emp.admins.some(a => a.toLowerCase().trim() === email);
                                 if (!adminExists) {
                                     emp.admins.push(email);
                                 }
                             }
                         }
                    });

                    // Reconciliación estricta para esta empresa:
                    // 1. Eliminar miembros que pertenecen a otra empresa en Google Sheets, o que fueron eliminados de Google Sheets
                    emp.members = emp.members.filter(m => {
                        if (!m.email || m.email.trim() === '') return true; // Mantener usuarios locales sin email (por ejemplo, manuales)
                        const emailClean = m.email.toLowerCase().trim();
                        
                        // Si es el administrador principal configurado en "Empresas", se conserva
                        const gc = gCompanies.find(c => c.id === emp.id || (emp.name && c.name && emp.name.toLowerCase().trim() === c.name.toLowerCase().trim()));
                        if (gc && gc.email && gc.email.toLowerCase().trim() === emailClean) {
                            return true;
                        }

                        // Verificar si existe en la hoja "Usuarios"
                        const gu = gUsersMap.get(emailClean);
                        if (gu) {
                            // Si existe, debe coincidir con la mejor empresa asignada (si tiene una asignada)
                            const matchedEmpId = userBestCompanyMap.get(emailClean);
                            if (matchedEmpId && matchedEmpId !== emp.id) {
                                return false; // Pertenece a otra empresa
                            }
                        } else {
                            return false; // Eliminado de Google Sheets
                        }
                        return true;
                    });

                    // 2. Eliminar del arreglo de administradores de la empresa si ya no tienen el rol de administrador en Google Sheets
                    emp.admins = emp.admins.filter(adminEmail => {
                        if (!adminEmail) return false;
                        const emailClean = adminEmail.toLowerCase().trim();
                        
                        // Si es el administrador principal configurado en "Empresas", se conserva
                        const gc = gCompanies.find(c => c.id === emp.id || (emp.name && c.name && emp.name.toLowerCase().trim() === c.name.toLowerCase().trim()));
                        if (gc && gc.email && gc.email.toLowerCase().trim() === emailClean) {
                            return true;
                        }

                        const gu = gUsersMap.get(emailClean);
                        if (gu) {
                            return gu.rol === 'ADMINISTRADOR_EMPRESA' && userBestCompanyMap.get(emailClean) === emp.id;
                        }
                        return false;
                    });
                });
            }
         } catch(ue) {
            console.warn('No se pudo sincronizar los miembros desde Google Sheets', ue);
        }
      } catch(e) {
        console.warn('No se pudo sincronizar con Google Sheets', e);
      }
      
      const configRes = await fetch(`portal-config.json?t=${ts}`);
      if (configRes.ok) {
        const config = await configRes.json();
        superAdmins = config.superAdmins || ['imagina3ddesign@gmail.com', 'mcmartinezg@unal.edu.co'];
      }
      
      

      // Pre-cargar de forma paralela los config-*.json de todas las empresas no eliminadas
      const activeCompanies = empresas.filter(e => !e.deleted);
      await Promise.all(activeCompanies.map(emp => loadCompanyConfig(emp)));

      renderList();
      if (selectedIndex === -1 && empresas.length > 0) {
        const firstActiveIdx = empresas.findIndex(e => !e.deleted);
        if (firstActiveIdx > -1) selectEmpresa(firstActiveIdx);
      }
    } catch (e) { showBanner('Error cargando datos', 'error'); }
  }

  function renderList() {
    const rawSearch = searchInput ? searchInput.value.trim() : '';
    // Si el valor fue autofilled por el navegador (ej: "empresa-1786..."), limpiarlo y no filtrar
    const isAutofillId = rawSearch.startsWith('empresa-');
    if (isAutofillId && searchInput) {
      searchInput.value = '';
      searchTerm = '';
    }
    const searchVal = isAutofillId ? '' : rawSearch.toLowerCase();

    listEl.innerHTML = empresas.map((emp, i) => {
      if (emp.deleted) return '';
      
      const matchesSearch = searchVal === '' || 
        (emp.name && emp.name.toLowerCase().includes(searchVal)) || 
        (emp.razonSocial && emp.razonSocial.toLowerCase().includes(searchVal)) || 
        (emp.id && emp.id.toLowerCase().includes(searchVal));
      
      let hasAccess = true;
      if (userRole !== 'SUPER_ADMINISTRADOR') {
          const globalTabs = document.getElementById('global-tabs-container');
          if(globalTabs) globalTabs.classList.add('hidden');
          if(globalTabs) globalTabs.classList.remove('md:flex');
      }
      
      if (userRole === 'ADMINISTRADOR_EMPRESA') {
          hasAccess = emp.members && emp.members.some(m => m.email && m.email.toLowerCase() === userEmail && (m.role === 'ADMINISTRADOR_EMPRESA' || m.role === 'ADMINISTRADOR'));
      }

      if (!matchesSearch || !hasAccess) return '';

      return `
      <button class="w-full text-left p-4 rounded-xl border transition shadow-sm ${i === selectedIndex ? 'border-primary bg-slate-100 ring-2 ring-primary/20' : 'border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300'}" onclick="selectEmpresa(${i})">
        <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold bg-slate-200 text-slate-700 px-2 py-0.5 rounded uppercase tracking-widest">${emp.code || 'SIN CÓDIGO'}</span>
        </div>
        <div class="font-bold text-sm text-slate-900 truncate">${emp.razonSocial || emp.name || 'Sin Nombre'}</div>
        <div class="text-xs text-slate-500 mt-1 truncate">ID: ${emp.id || '---'}</div>
      </button>
      `;
    }).join('');
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value.toLowerCase().trim();
      renderList();
    });
  }

  async function loadCompanyConfig(emp) {
    if (companyConfigs[emp.id]) return companyConfigs[emp.id];
    try {
      const url = emp.configUrl || `config-${emp.id}.json`;
      const res = await fetch(`${url}?t=${Date.now()}`);
      if (res.ok) {
        companyConfigs[emp.id] = await res.json();
        if (!companyConfigs[emp.id].projects) companyConfigs[emp.id].projects = [];
        return companyConfigs[emp.id];
      }
    } catch(e) {}
    // If not found, initialize
    companyConfigs[emp.id] = { projects: [] };
    return companyConfigs[emp.id];
  }

  window.selectEmpresa = async (index) => {
    const emp = empresas[index];
    if (!emp) return;

    // Security context validation
    let hasAccess = userRole === 'SUPER_ADMINISTRADOR';
    if (!hasAccess && userRole === 'ADMINISTRADOR_EMPRESA') {
      hasAccess = emp.members && emp.members.some(m => m.email && m.email.toLowerCase() === userEmail && (m.role === 'ADMINISTRADOR_EMPRESA' || m.role === 'ADMINISTRADOR'));
    }
    if (!hasAccess) {
      alert('Acceso denegado. No tienes permisos para gestionar esta empresa.');
      return;
    }

    selectedIndex = index;
    window.selectedIndex = index;
    
    // Load projects for this company
    await loadCompanyConfig(emp);

    // Basicos
    el.id.value = emp.id || '';
    el.name.value = emp.name || '';
    el.location.value = emp.location || '';
    el.code.value = emp.code || '';
    el.image.value = emp.image || '';
    
    // Fase 1
    el.razonSocial.value = emp.razonSocial || '';
    el.nit.value = emp.nit || '';
    el.repLegal.value = emp.repLegal || '';
    el.direccion.value = emp.direccion || '';
    el.ciudad.value = emp.ciudad || '';
    el.departamento.value = emp.departamento || '';
    el.correoFacturacion.value = emp.correoFacturacion || '';
    
    // Fase 2
    el.sitioWeb.value = emp.sitioWeb || '';
    el.correoGeneral.value = emp.correoGeneral || '';
    el.telefonoCorporativo.value = emp.telefonoCorporativo || '';
    el.contactoOperativo.value = emp.contactoOperativo || '';
    el.cargoContacto.value = emp.cargoContacto || '';
    el.celularContacto.value = emp.celularContacto || '';
    
    // Fase 3
    el.proveedorNube.value = emp.proveedorNube || '';
    el.zonaHoraria.value = emp.zonaHoraria || 'America/Bogota';
    el.tipoActor.value = emp.tipoActor || '';
    el.tamanoEmpresa.value = emp.tamanoEmpresa || '';
    el.volumenProyectos.value = emp.volumenProyectos || '';
    
    // Legal
    el.terminosAceptados.checked = emp.terminosAceptados || false;
    el.tratamientoDatos.checked = emp.tratamientoDatos || false;

    // Portal Generalidades (from company config)
    const portalData = companyConfigs[emp.id]?.portal || {};
    if (el.portalName) el.portalName.value = portalData.name || '';
    if (el.portalShortName) el.portalShortName.value = portalData.shortName || '';
    if (el.portalLogoLight) el.portalLogoLight.value = portalData.logoLight || '';
    if (el.portalLogoDark) el.portalLogoDark.value = portalData.logoDark || '';
    if (el.portalLogoFooterLight) el.portalLogoFooterLight.value = portalData.footerLogoLight || '';
    if (el.portalLogoFooterDark) el.portalLogoFooterDark.value = portalData.footerLogoDark || '';
    if (el.portalLogoFooterSecondaryLight) el.portalLogoFooterSecondaryLight.value = portalData.footerLogoSecondaryLight || '';
    if (el.portalLogoFooterSecondaryDark) el.portalLogoFooterSecondaryDark.value = portalData.footerLogoSecondaryDark || '';
    if (el.portalFooterText) el.portalFooterText.value = portalData.footerText || '';
    if (el.portalHeroImages) el.portalHeroImages.value = (portalData.heroImages || []).join('\n');

    renderUsers();
    renderProjects();

    editorEl.classList.remove('hidden');
    renderList();
  };

  // Tabs logic
  tabs.btns.forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      tabs.btns.forEach(b => {
        b.classList.remove('text-primary', 'border-b-2', 'border-primary');
        b.classList.add('text-slate-500');
      });
      tabs.contents.forEach(c => c.classList.add('hidden'));
      
      btn.classList.add('text-primary', 'border-b-2', 'border-primary');
      btn.classList.remove('text-slate-500');
      tabs.contents[idx].classList.remove('hidden');
      tabs.contents[idx].classList.add('block');
    });
  });

  // Users CRUD
  window.currentGroupBy = 'empresa';
  
  window.setGroupBy = (groupingType) => {
    window.currentGroupBy = groupingType;
    const btnEmpresa = document.getElementById('btn-group-empresa');
    const btnEspecialidad = document.getElementById('btn-group-especialidad');
    if(groupingType === 'empresa') {
      btnEmpresa.className = 'px-3 py-1.5 rounded-md bg-white shadow-sm text-slate-800 transition-colors';
      btnEspecialidad.className = 'px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-800 transition-colors';
    } else {
      btnEspecialidad.className = 'px-3 py-1.5 rounded-md bg-white shadow-sm text-slate-800 transition-colors';
      btnEmpresa.className = 'px-3 py-1.5 rounded-md text-slate-500 hover:text-slate-800 transition-colors';
    }
    renderUsers();
  };

  window.toggleGroup = (id) => {
    const el = document.getElementById(id);
    const icon = document.getElementById('icon-' + id);
    if (el.classList.contains('hidden')) {
      el.classList.remove('hidden');
      icon.innerText = 'expand_less';
      icon.classList.remove('rotate-180');
    } else {
      el.classList.add('hidden');
      icon.innerText = 'expand_more';
      icon.classList.add('rotate-180');
    }
  };

  window.allGroupsCollapsed = false;
  window.toggleAllGroups = () => {
    window.allGroupsCollapsed = !window.allGroupsCollapsed;
    const iconAll = document.getElementById('icon-toggle-all');
    if(iconAll) {
      iconAll.innerText = window.allGroupsCollapsed ? 'unfold_more' : 'unfold_less';
    }
    
    const listEl = document.getElementById('usuarios-list');
    if(!listEl) return;
    const groupContainers = listEl.querySelectorAll('div[id^="group-"]');
    
    groupContainers.forEach(el => {
      const id = el.id;
      const icon = document.getElementById('icon-' + id);
      if(window.allGroupsCollapsed) {
        el.classList.add('hidden');
        if(icon) {
          icon.innerText = 'expand_more';
          icon.classList.add('rotate-180');
        }
      } else {
        el.classList.remove('hidden');
        if(icon) {
          icon.innerText = 'expand_less';
          icon.classList.remove('rotate-180');
        }
      }
    });
  };

  function resolveMemberCompany(m, emp) {
    if (m.role === 'ADMINISTRADOR_EMPRESA' || m.role === 'MIEMBRO' || (!m.role)) {
      return emp.name || 'Mi Empresa';
    }

    // Role is INVITADO:
    const emailClean = (m.email || '').toLowerCase().trim();

    // 1. Check if m.empresaUsuario is defined and different from current company
    if (m.empresaUsuario && m.empresaUsuario.trim() !== '' && m.empresaUsuario.trim().toLowerCase() !== (emp.name || '').trim().toLowerCase()) {
      return m.empresaUsuario.trim();
    }

    // 2. Check window.globalUsersMap (Google Sheet database)
    if (emailClean && window.globalUsersMap) {
      const gu = window.globalUsersMap.get(emailClean);
      if (gu && gu.companyName && gu.companyName.trim() !== '' && 
          gu.companyName.trim().toLowerCase() !== (emp.name || '').trim().toLowerCase() && 
          gu.companyName.trim().toLowerCase() !== 'sin empresa asignada' &&
          gu.companyName.trim().toLowerCase() !== 'invitados / externos') {
        return gu.companyName.trim();
      }
    }

    // 3. Search other companies in `empresas` where this user is MIEMBRO or ADMINISTRADOR_EMPRESA
    if (emailClean && Array.isArray(empresas)) {
      const homeEmp = empresas.find(e => e.id !== emp.id && (e.members || []).some(otherM => 
        otherM.email && otherM.email.toLowerCase().trim() === emailClean && 
        (otherM.role === 'MIEMBRO' || otherM.role === 'ADMINISTRADOR_EMPRESA')
      ));
      if (homeEmp && homeEmp.name) {
        return homeEmp.name.trim();
      }
    }

    return 'Invitados / Externos';
  }

  function renderUsers() {
    window.renderUsersRef = renderUsers;
    window.renderUsers = renderUsers;
    // Reset global collapse state
    window.allGroupsCollapsed = false;
    const iconAll = document.getElementById('icon-toggle-all');
    if(iconAll) iconAll.innerText = 'unfold_less';
    
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    if (!emp.members) emp.members = [];
    
    const grouped = {};
    emp.members.forEach((m, i) => {
      let g = '';
      if(window.currentGroupBy === 'empresa') {
        g = resolveMemberCompany(m, emp);
        // Synchronize m.empresaUsuario in memory
        if (m.role === 'INVITADO') {
          if (g !== 'Invitados / Externos') {
            m.empresaUsuario = g;
          } else if (m.empresaUsuario && m.empresaUsuario.trim().toLowerCase() === (emp.name || '').trim().toLowerCase()) {
            m.empresaUsuario = '';
          }
        } else {
          m.empresaUsuario = emp.name;
        }
      } else {
        g = m.especialidad && m.especialidad.trim() !== '' ? m.especialidad.trim() : 'Sin Especialidad Asignada';
      }
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push({ ...m, originalIndex: i });
    });

    const sortedGroups = Object.keys(grouped).sort((a, b) => {
      if (a === emp.name) return -1;
      if (b === emp.name) return 1;
      if (a.startsWith('Sin ') || a.startsWith('Invitados')) return 1;
      if (b.startsWith('Sin ') || b.startsWith('Invitados')) return -1;
      return a.localeCompare(b);
    });

    let html = '';
    sortedGroups.forEach(g => {
      const safeGroupId = 'group-' + btoa(unescape(encodeURIComponent(g))).replace(/[^a-zA-Z0-9]/g, '');
      html += `
        <div class="mt-4 mb-2 cursor-pointer group-header flex justify-between items-center bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-lg transition-colors select-none" onclick="toggleGroup('${safeGroupId}')">
          <h4 class="text-xs font-bold text-slate-600 uppercase tracking-wider">${g}</h4>
          <span class="material-symbols-outlined text-slate-400 text-lg transition-transform" id="icon-${safeGroupId}">expand_less</span>
        </div>
        <div id="${safeGroupId}" class="flex flex-col gap-4">
      `;
      html += grouped[g].map(item => {
        const i = item.originalIndex;
        const m = item;

        // ── Cargo: visible ONLY for internal members (ADMINISTRADOR_EMPRESA, MIEMBRO, ADMINISTRADOR). Guests (INVITADO) do NOT have cargo here. ──
        const isInternal = m.role === 'ADMINISTRADOR_EMPRESA' || m.role === 'MIEMBRO' || m.role === 'ADMINISTRADOR' || (!m.role);

        const cargoHtml = isInternal ? `
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">Cargo (empleado interno)</span>
            <select class="w-full text-xs rounded border-slate-200" onchange="updateUser(${i}, 'cargo', this.value)">
              <option value="">Seleccione cargo...</option>
              <optgroup label="Dirección y Alta Gerencia">
                <option value="Gerente General / CEO" ${m.cargo==='Gerente General / CEO'?'selected':''}>Gerente General / CEO</option>
                <option value="Gerente de Operaciones / COO" ${m.cargo==='Gerente de Operaciones / COO'?'selected':''}>Gerente de Operaciones / COO</option>
                <option value="Director de Proyectos / Gerente de Proyectos" ${m.cargo==='Director de Proyectos / Gerente de Proyectos'?'selected':''}>Director de Proyectos / Gerente de Proyectos</option>
                <option value="Director de Obra / Director de Construcción" ${m.cargo==='Director de Obra / Director de Construcción'?'selected':''}>Director de Obra / Director de Construcción</option>
                <option value="Director de Diseño / Gerencia de Diseño" ${m.cargo==='Director de Diseño / Gerencia de Diseño'?'selected':''}>Director de Diseño / Gerencia de Diseño</option>
                <option value="Gerente de Contrataciones y Compras" ${m.cargo==='Gerente de Contrataciones y Compras'?'selected':''}>Gerente de Contrataciones y Compras</option>
              </optgroup>
              <optgroup label="Arquitectura">
                <option value="Director de Arquitectura" ${m.cargo==='Director de Arquitectura'?'selected':''}>Director de Arquitectura</option>
                <option value="Coordinador de Arquitectura" ${m.cargo==='Coordinador de Arquitectura'?'selected':''}>Coordinador de Arquitectura</option>
                <option value="Arquitecto Senior" ${m.cargo==='Arquitecto Senior'?'selected':''}>Arquitecto Senior</option>
                <option value="Arquitecto Junior" ${m.cargo==='Arquitecto Junior'?'selected':''}>Arquitecto Junior</option>
                <option value="Modelador de Arquitectura" ${m.cargo==='Modelador de Arquitectura'?'selected':''}>Modelador de Arquitectura</option>
              </optgroup>
              <optgroup label="Estrategia y Desarrollo BIM / VDC">
                <option value="BIM Manager" ${m.cargo==='BIM Manager'?'selected':''}>BIM Manager</option>
                <option value="Coordinador BIM" ${m.cargo==='Coordinador BIM'?'selected':''}>Coordinador BIM</option>
                <option value="Líder de Modelado / Diseñador Líder" ${m.cargo==='Líder de Modelado / Diseñador Líder'?'selected':''}>Líder de Modelado / Diseñador Líder</option>
                <option value="BIM Developer / Desarrollador BIM" ${m.cargo==='BIM Developer / Desarrollador BIM'?'selected':''}>BIM Developer / Desarrollador BIM</option>
                <option value="Residente BIM" ${m.cargo==='Residente BIM'?'selected':''}>Residente BIM</option>
                <option value="Modelador BIM" ${m.cargo==='Modelador BIM'?'selected':''}>Modelador BIM</option>
              </optgroup>
              <optgroup label="Gestión y Supervisión de Campo (Obra)">
                <option value="Director de Obra" ${m.cargo==='Director de Obra'?'selected':''}>Director de Obra</option>
                <option value="Residente de Obra" ${m.cargo==='Residente de Obra'?'selected':''}>Residente de Obra</option>
                <option value="Residente de Redes / Instalaciones" ${m.cargo==='Residente de Redes / Instalaciones'?'selected':''}>Residente de Redes / Instalaciones</option>
                <option value="Residente de Acabados" ${m.cargo==='Residente de Acabados'?'selected':''}>Residente de Acabados</option>
                <option value="Residente Estructural" ${m.cargo==='Residente Estructural'?'selected':''}>Residente Estructural</option>
                <option value="Residente Técnico" ${m.cargo==='Residente Técnico'?'selected':''}>Residente Técnico</option>
              </optgroup>
              <optgroup label="Ingenierías">
                <option value="Diseñador Eléctrico" ${m.cargo==='Diseñador Eléctrico'?'selected':''}>Diseñador Eléctrico</option>
                <option value="Diseñador Estructural" ${m.cargo==='Diseñador Estructural'?'selected':''}>Diseñador Estructural</option>
                <option value="Diseñador Hidrosánitario" ${m.cargo==='Diseñador Hidrosánitario'?'selected':''}>Diseñador Hidrosánitario</option>
                <option value="Diseñador Gas" ${m.cargo==='Diseñador Gas'?'selected':''}>Diseñador Gas</option>
                <option value="Diseñador HVAC" ${m.cargo==='Diseñador HVAC'?'selected':''}>Diseñador HVAC</option>
              </optgroup>
              <optgroup label="Supervisión y Control">
                <option value="Interventor / Supervisor Técnico" ${m.cargo==='Interventor / Supervisor Técnico'?'selected':''}>Interventor / Supervisor Técnico</option>
                <option value="Inspector de Calidad / Aseguramiento de Calidad (QA/QC)" ${m.cargo==='Inspector de Calidad / Aseguramiento de Calidad (QA/QC)'?'selected':''}>Inspector de Calidad (QA/QC)</option>
              </optgroup>
              <optgroup label="Ingeniería, Arquitectura y Diseño">
                <option value="Ingeniero Calculista / Estructural" ${m.cargo==='Ingeniero Calculista / Estructural'?'selected':''}>Ingeniero Calculista / Estructural</option>
                <option value="Ingeniero de Redes (MEP)" ${m.cargo==='Ingeniero de Redes (MEP)'?'selected':''}>Ingeniero de Redes (MEP)</option>
                <option value="Arquitecto Diseñador" ${m.cargo==='Arquitecto Diseñador'?'selected':''}>Arquitecto Diseñador</option>
                <option value="Modelador BIM / Dibujante" ${m.cargo==='Modelador BIM / Dibujante'?'selected':''}>Modelador BIM / Dibujante</option>
              </optgroup>
              <optgroup label="Control de Costos, Tiempos y Suministros">
                <option value="Ingeniero de Presupuestos / Costos" ${m.cargo==='Ingeniero de Presupuestos / Costos'?'selected':''}>Ingeniero de Presupuestos / Costos</option>
                <option value="Analista de Programación y Control de Obra" ${m.cargo==='Analista de Programación y Control de Obra'?'selected':''}>Analista de Programación y Control de Obra</option>
                <option value="Analista de Compras / Suministros" ${m.cargo==='Analista de Compras / Suministros'?'selected':''}>Analista de Compras / Suministros</option>
              </optgroup>
              <optgroup label="Topografía y Geomática">
                <option value="Topógrafo" ${m.cargo==='Topógrafo'?'selected':''}>Topógrafo</option>
                <option value="Cadenero / Auxiliar de Topografía" ${m.cargo==='Cadenero / Auxiliar de Topografía'?'selected':''}>Cadenero / Auxiliar de Topografía</option>
              </optgroup>
              <optgroup label="Seguridad, Medio Ambiente y Apoyo Operativo">
                <option value="Residente de Seguridad y Salud en el Trabajo (SST)" ${m.cargo==='Residente de Seguridad y Salud en el Trabajo (SST)'?'selected':''}>Residente SST</option>
                <option value="Residente Ambiental" ${m.cargo==='Residente Ambiental'?'selected':''}>Residente Ambiental</option>
                <option value="Almacenista de Obra" ${m.cargo==='Almacenista de Obra'?'selected':''}>Almacenista de Obra</option>
                <option value="Administrador de Obra" ${m.cargo==='Administrador de Obra'?'selected':''}>Administrador de Obra</option>
                <option value="Administrador de TI / Sistemas" ${m.cargo==='Administrador de TI / Sistemas'?'selected':''}>Administrador de TI / Sistemas</option>
                <option value="Asesor Jurídico / Gestor de Contratos" ${m.cargo==='Asesor Jurídico / Gestor de Contratos'?'selected':''}>Asesor Jurídico / Gestor de Contratos</option>
              </optgroup>
            </select>
          </label>` : '';

        let registeredNameStr = '';
        if (m.email && m.email.trim()) {
            const rawEmail = m.email.trim().toLowerCase();
            const compositeKey = rawEmail + '_' + (emp.name || '').trim().toLowerCase();
            const gu = (window.globalUsersMap && window.globalUsersMap.get(compositeKey)) 
                    || (window.globalUsersMap && window.globalUsersMap.get(rawEmail))
                    || (window.globalUsersMap && Array.from(window.globalUsersMap.values()).find(u => u.email === rawEmail));
            if (gu && gu.name && gu.name.trim() !== '' && gu.name.trim().toLowerCase() !== 'nuevo usuario') {
                registeredNameStr = gu.name.trim();
                m.name = gu.name.trim();
            } else if (m.name && m.name.trim() !== '' && m.name.trim().toLowerCase() !== 'nuevo usuario') {
                registeredNameStr = m.name.trim();
            }
        } else if (m.name && m.name.trim() !== '' && m.name.trim().toLowerCase() !== 'nuevo usuario') {
            registeredNameStr = m.name.trim();
        }
        
        const nombreHtml = registeredNameStr ? `
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">Nombre registrado</span>
            <input type="text" class="w-full text-xs rounded border-slate-200 bg-slate-100 text-slate-500 font-medium cursor-not-allowed" value="${registeredNameStr}" disabled readonly>
          </label>` : '';

        return `
      <div class="border rounded-xl p-4 bg-slate-50 relative group">
        <button onclick="deleteUser(${i})" class="absolute top-4 right-4 text-rose-500 hover:text-rose-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar usuario"><span class="material-symbols-outlined text-sm">delete</span></button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">Correo Electrónico</span>
            <input type="email" class="w-full text-xs rounded border-slate-200" value="${m.email || ''}" onchange="updateUser(${i}, 'email', this.value)" placeholder="usuario@empresa.com">
          </label>

          ${nombreHtml}

          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">Rol del Sistema</span>
            <select class="w-full text-xs rounded border-slate-200" onchange="updateUser(${i}, 'role', this.value)">
              <option value="MIEMBRO" ${m.role==='MIEMBRO' || (!m.role && isInternal) ? 'selected' : ''}>MIEMBRO</option>
              <option value="ADMINISTRADOR_EMPRESA" ${m.role==='ADMINISTRADOR_EMPRESA'?'selected':''}>ADMINISTRADOR_EMPRESA</option>
              <option value="INVITADO" ${m.role==='INVITADO'?'selected':''}>INVITADO</option>
            </select>
          </label>

          ${cargoHtml}

        </div>
      </div>
        `;
      }).join('');
      
      html += `</div>`; // Close group div
    });
    
    usersListEl.innerHTML = html;
  }


  window.updateUser = (idx, field, val) => {
    if (selectedIndex === -1 || !empresas[selectedIndex] || !empresas[selectedIndex].members) return;
    const emp = empresas[selectedIndex];
    const m = emp.members[idx];
    if (!m) return;
    m[field] = val;
    if (field === 'role') {
      if (val === 'MIEMBRO' || val === 'ADMINISTRADOR_EMPRESA') {
        m.empresaUsuario = emp.name;
      } else if (val === 'INVITADO') {
        m.cargo = '';
        const extEmp = resolveMemberCompany(m, emp);
        m.empresaUsuario = extEmp !== 'Invitados / Externos' ? extEmp : '';
      }
      renderUsers();
    } else if (field === 'email') {
      const emailClean = (val || '').toLowerCase().trim();
      if (emailClean && window.globalUsersMap) {
        const gu = window.globalUsersMap.get(emailClean);
        if (gu && gu.name && gu.name.trim() !== '' && gu.name.trim().toLowerCase() !== 'nuevo usuario') {
          m.name = gu.name.trim();
        }
      }
      if (m.role === 'INVITADO') {
        const extEmp = resolveMemberCompany(m, emp);
        m.empresaUsuario = extEmp !== 'Invitados / Externos' ? extEmp : '';
      }
      renderUsers();
    }
  };
  
  window.deleteUser = (idx) => {
    if(confirm('¿Eliminar usuario?')) {
      empresas[selectedIndex].members.splice(idx, 1);
      renderUsers();
    }
  };

  document.getElementById('add-usuario-btn').addEventListener('click', () => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    if (!emp.members) emp.members = [];
    emp.members.push({ 
      name: 'Nuevo Usuario', 
      email: '', 
      role: 'MIEMBRO', 
      empresaUsuario: emp.name,
      cargo: ''
    });
    renderUsers();
  });

  // Projects CRUD
  
  window.openProjectAccordions = window.openProjectAccordions || {};
  window.openConfigAccordions = window.openConfigAccordions || {};
  window.toggleProjectAccordion = (slug) => {
    window.openProjectAccordions[slug] = !window.openProjectAccordions[slug];
    renderProjects();
  };

  window.toggleConfigAccordion = (slug) => {
    window.openConfigAccordions[slug] = !window.openConfigAccordions[slug];
    renderProjects();
  };

  window.renderProjects = renderProjects;
    function renderProjects() {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    
    projectsListEl.innerHTML = config.projects.map((p, i) => {
      const isOpen = !!window.openProjectAccordions[p.slug];
      const isSuperAdmin = userRole === 'SUPER_ADMINISTRADOR';
      
      // Lógica de bloqueo
      const isLocked = p.lockDataSources === true;
      const canEditDataSources = isSuperAdmin || !isLocked;
      const disableAttr = canEditDataSources ? '' : 'disabled="disabled"';
      const disableClass = canEditDataSources ? '' : 'opacity-50 cursor-not-allowed';
let contentBase = '';
        if (isOpen) {
          
          const citiesByCountry = {
            "Colombia": ["Arauca", "Armenia", "Barranquilla", "Bogotá", "Bucaramanga", "Cali", "Cartagena", "Cúcuta", "Florencia", "Ibagué", "Inírida", "Leticia", "Manizales", "Medellín", "Mitú", "Mocoa", "Montería", "Neiva", "Pasto", "Pereira", "Popayán", "Puerto Carreño", "Quibdó", "Riohacha", "San Andrés", "San José del Guaviare", "Santa Marta", "Sincelejo", "Tunja", "Valledupar", "Villavicencio", "Yopal", "Otro"],
            "México": ["Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Tijuana", "Otro"],
            "Perú": ["Lima", "Arequipa", "Trujillo", "Chiclayo", "Piura", "Otro"],
            "Chile": ["Santiago", "Valparaíso", "Concepción", "La Serena", "Antofagasta", "Otro"],
            "Argentina": ["Buenos Aires", "Córdoba", "Rosario", "Mendoza", "Tucumán", "Otro"],
            "Ecuador": ["Quito", "Guayaquil", "Cuenca", "Santo Domingo", "Machala", "Otro"],
            "Panamá": ["Ciudad de Panamá", "San Miguelito", "Tocumen", "David", "Colón", "Otro"],
            "España": ["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Otro"],
            "Estados Unidos": ["New York", "Los Angeles", "Chicago", "Houston", "Miami", "Otro"]
          };
          let cityInputHTML = '';
          if (p.country && p.country !== 'Otro' && citiesByCountry[p.country]) {
            const cities = citiesByCountry[p.country];
            const isCustomCity = p.city && !cities.includes(p.city) && p.city !== '';
            const selectValue = isCustomCity ? 'Otro' : (p.city || '');
            
            cityInputHTML = `
              <select class="w-full text-xs rounded-xl border-slate-200 ${isCustomCity ? 'mb-2' : ''}" onchange="if(this.value === 'Otro') { this.nextElementSibling.classList.remove('hidden'); this.classList.add('mb-2'); this.nextElementSibling.focus(); } else { this.nextElementSibling.classList.add('hidden'); this.classList.remove('mb-2'); updateProject('${p.slug}', 'city', this.value); }">
                <option value="">Seleccionar...</option>
                ${cities.map(c => `<option value="${c}" ${selectValue === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <input class="w-full text-xs rounded-xl border-slate-200 ${isCustomCity ? '' : 'hidden'}" type="text" placeholder="¿Cuál?" value="${isCustomCity ? p.city : ''}" onchange="updateProject('${p.slug}', 'city', this.value)" />
            `;
          } else if (p.country === 'Otro') {
            cityInputHTML = `<input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="¿Cuál?" value="${p.city || ''}" onchange="updateProject('${p.slug}', 'city', this.value)" />`;
          } else {
            cityInputHTML = `<select class="w-full text-xs rounded-xl border-slate-200" disabled><option value="">Selecciona un país primero</option></select>`;
          }

          const statesByCountry = {
            "Colombia": [
              "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá", "Caldas", "Caquetá", "Casanare", "Cauca", 
              "Cesar", "Chocó", "Córdoba", "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", 
              "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda", "San Andrés y Providencia", "Santander", 
              "Sucre", "Tolima", "Valle del Cauca", "Vaupés", "Vichada", "Otro"
            ]
          };

          let stateInputHTML = '';
          const currentState = p.state || p.departamento || '';
          if (p.country && p.country !== 'Otro' && statesByCountry[p.country]) {
            const states = statesByCountry[p.country];
            const isCustomState = currentState && !states.includes(currentState) && currentState !== '';
            const selectValue = isCustomState ? 'Otro' : currentState;

            stateInputHTML = `
              <select class="w-full text-xs rounded-xl border-slate-200 ${isCustomState ? 'mb-2' : ''}" onchange="if(this.value === 'Otro') { this.nextElementSibling.classList.remove('hidden'); this.classList.add('mb-2'); this.nextElementSibling.focus(); } else { this.nextElementSibling.classList.add('hidden'); this.classList.remove('mb-2'); updateProject('${p.slug}', 'state', this.value); }">
                <option value="">Seleccionar...</option>
                ${states.map(s => `<option value="${s}" ${selectValue === s ? 'selected' : ''}>${s}</option>`).join('')}
              </select>
              <input class="w-full text-xs rounded-xl border-slate-200 ${isCustomState ? '' : 'hidden'}" type="text" placeholder="¿Cuál?" value="${isCustomState ? currentState : ''}" onchange="updateProject('${p.slug}', 'state', this.value)" />
            `;
          } else if (p.country === 'Otro') {
            stateInputHTML = `<input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="Ej. Cundinamarca" value="${currentState}" onchange="updateProject('${p.slug}', 'state', this.value)" />`;
          } else {
            stateInputHTML = `<select class="w-full text-xs rounded-xl border-slate-200" disabled><option value="">Selecciona un país primero</option></select>`;
          }

          const contacts = p.clientContacts || [];
          let contactsHTML = contacts.map((c, idx) => `
            <div class="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
               <div class="col-span-12 md:col-span-3">
                 <input type="text" class="w-full text-xs rounded border-slate-200" placeholder="Nombre completo" value="${c.name || ''}" onchange="updateClientContact('${p.slug}', ${idx}, 'name', this.value)" />
               </div>
               <div class="col-span-12 md:col-span-3">
                 <input type="text" class="w-full text-xs rounded border-slate-200" placeholder="Cargo" value="${c.role || ''}" onchange="updateClientContact('${p.slug}', ${idx}, 'role', this.value)" />
               </div>
               <div class="col-span-12 md:col-span-3">
                 <input type="email" class="w-full text-xs rounded border-slate-200" placeholder="Correo electrónico" value="${c.email || ''}" onchange="updateClientContact('${p.slug}', ${idx}, 'email', this.value)" />
               </div>
               <div class="col-span-10 md:col-span-2">
                 <input type="tel" class="w-full text-xs rounded border-slate-200" placeholder="Teléfono" value="${c.phone || ''}" onchange="updateClientContact('${p.slug}', ${idx}, 'phone', this.value)" />
               </div>
               <div class="col-span-2 md:col-span-1 text-right">
                 <button type="button" class="text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 p-1.5 rounded transition-colors" onclick="removeClientContact('${p.slug}', ${idx})" title="Eliminar contacto">
                    <span class="material-symbols-outlined text-[16px] block">delete</span>
                 </button>
               </div>
            </div>
          `).join('');

          if (contacts.length === 0) {
            contactsHTML = `<div class="text-xs text-slate-400 italic bg-white p-4 rounded-xl border border-slate-200 text-center">No hay contactos registrados. Haz clic en "Agregar contacto" para empezar.</div>`;
          }

          const projMembers = p.members || [];
          let projectMembersHTML = projMembers.map((memberEmail, idx) => {
            const options = emp.members.filter(m => m.email).map(m => {
                let resolvedName = m.email;
                const rawEmail = m.email.trim();
                const compositeKey = rawEmail.toLowerCase() + '_' + (emp.name || '').trim().toLowerCase();
                const gu = (window.globalUsersMap && window.globalUsersMap.get(compositeKey)) || (window.globalUsersMap && window.globalUsersMap.get(rawEmail)) 
                            || (window.globalUsersMap && window.globalUsersMap.get(rawEmail.toLowerCase()));
                if (gu && gu.name) {
                    resolvedName = gu.name;
                } else if (m.name && m.name !== 'Nuevo Usuario') {
                    resolvedName = m.name;
                }
                return `<option value="${m.email}" ${m.email === memberEmail ? 'selected' : ''}>${resolvedName} (${m.role || 'Sin rol'})</option>`;
            }).join('');
            return `
            <div class="grid grid-cols-12 gap-2 items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
               <div class="col-span-10 md:col-span-5">
                 <select class="w-full text-xs rounded border-slate-200" onchange="updateProjectMember('${p.slug}', ${idx}, this.value)">
                    <option value="">Seleccione un usuario...</option>
                    ${options}
                 </select>
               </div>
               <div class="col-span-2 md:col-span-7 text-right">
                 <button type="button" class="text-rose-400 hover:text-rose-600 bg-rose-50 hover:bg-rose-100 p-1.5 rounded transition-colors" onclick="removeProjectMember('${p.slug}', ${idx})" title="Remover miembro">
                    <span class="material-symbols-outlined text-[16px] block">delete</span>
                 </button>
               </div>
            </div>
            `;
          }).join('');
          
          if (projMembers.length === 0) {
            projectMembersHTML = `<div class="text-xs text-slate-400 italic bg-white p-4 rounded-xl border border-slate-200 text-center">No hay miembros asignados a este proyecto. Haz clic en "Asignar miembro".</div>`;
          }

          contentBase = `
          <div class="p-5 border-t border-slate-200 bg-white">
            <div class="grid gap-6">

            <section>
              <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Información base</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-3">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Nombre del proyecto <span class="text-rose-500">*</span></span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.name || ''}" onchange="updateProject('${p.slug}', 'name', this.value)" required /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Código o identificador</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.code || ''}" placeholder="Ej. ARB-001" onchange="updateProject('${p.slug}', 'code', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Estado</span>
                  <select class="w-full text-xs rounded-xl border-slate-200" onchange="updateProject('${p.slug}', 'status', this.value)">
                    <option value="Planeacion" ${p.status==='Planeacion'?'selected':''}>Planeación</option>
                    <option value="Activo" ${p.status==='Activo'?'selected':''}>Activo</option>
                    <option value="Cerrado" ${p.status==='Cerrado'?'selected':''}>Cerrado</option>
                  </select>
                </label>
                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">País <span class="text-rose-500">*</span></span>
                    <select class="w-full text-xs rounded-xl border-slate-200" onchange="updateProject('${p.slug}', 'country', this.value)" required>
                      <option value="">Seleccionar...</option>
                      <option value="Colombia" ${p.country==='Colombia'?'selected':''}>Colombia</option>
                      <option value="México" ${p.country==='México'?'selected':''}>México</option>
                      <option value="Perú" ${p.country==='Perú'?'selected':''}>Perú</option>
                      <option value="Chile" ${p.country==='Chile'?'selected':''}>Chile</option>
                      <option value="Argentina" ${p.country==='Argentina'?'selected':''}>Argentina</option>
                      <option value="Ecuador" ${p.country==='Ecuador'?'selected':''}>Ecuador</option>
                      <option value="Panamá" ${p.country==='Panamá'?'selected':''}>Panamá</option>
                      <option value="España" ${p.country==='España'?'selected':''}>España</option>
                      <option value="Estados Unidos" ${p.country==='Estados Unidos'?'selected':''}>Estados Unidos</option>
                      <option value="Otro" ${p.country==='Otro'?'selected':''}>Otro</option>
                    </select>
                  </label>
                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Departamento / Estado</span>
                    ${stateInputHTML}
                  </label>
                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Ciudad <span class="text-rose-500">*</span></span>
                    ${cityInputHTML}
                  </label>
                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Dirección</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.address || ''}" placeholder="Ej. Av. Siempre Viva 123" onchange="updateProject('${p.slug}', 'address', this.value)" /></label>
                  
                  <label class="block xl:col-span-1 md:col-span-2 col-span-full"><span class="mb-2 block text-sm font-semibold text-slate-700">Tipo de proyecto <span class="text-rose-500">*</span></span>
                    <select multiple class="w-full text-xs rounded-xl border-slate-200 h-[104px]" onchange="const vals = Array.from(this.selectedOptions).map(o => o.value); updateProject('${p.slug}', 'type', vals)" required>
                      ${["Vivienda multifamiliar", "Vivienda unifamiliar", "Vivienda VIS", "Vivienda VIP", "Uso mixto", "Comercial", "Oficinas", "Industrial", "Institucional", "Educativo", "Hospitalario", "Infraestructura", "Urbanismo", "Otro"].map(t => `<option value="${t}" ${(Array.isArray(p.type) ? p.type : (p.type ? [p.type] : [])).includes(t) ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                    <span class="text-[10px] text-slate-400 mt-1 block leading-tight">Mantén presionado Ctrl o Cmd para seleccionar varios.</span>
                  </label>
                  
                  <label class="block xl:col-span-2 md:col-span-2 col-span-full"><span class="mb-2 block text-sm font-semibold text-slate-700">Descripción del proyecto <span class="text-rose-500">*</span></span>
                    <textarea class="w-full text-xs rounded-xl border-slate-200 h-[104px] resize-none" placeholder="Descripción general del alcance, características y propósito del proyecto." onchange="updateProject('${p.slug}', 'description', this.value)" required>${p.description || ''}</textarea>
                  </label>
                  
                  <label class="block xl:col-span-2 md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">Cliente (opcional)</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="Ej. Constructora Amarillo" value="${p.client || p.empresaId || ''}" onchange="updateProject('${p.slug}', 'client', this.value)" /></label>
                  <label class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"><input class="rounded border-slate-300" type="checkbox" ${p.enabled!==false?'checked':''} onchange="updateProject('${p.slug}', 'enabled', this.checked)" />Proyecto activo en el portal</label>

                  <!-- Mapa -->
                  <div class="col-span-full border-t border-slate-100 pt-4 mt-2 mb-2">
                    <h4 class="text-xs font-bold uppercase tracking-[0.1em] text-slate-400 mb-4">Ubicación en el Mapa</h4>
                    <div class="grid gap-4 md:grid-cols-3">
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Latitud</span><input id="lat-${p.slug}" class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej. 4.6097" value="${p.landing?.map?.lat !== undefined ? p.landing.map.lat : ''}" onchange="updateProjectDeepMap('${p.slug}', 'lat', this.value)" /></label>
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Longitud</span><input id="lng-${p.slug}" class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" placeholder="Ej. -74.0817" value="${p.landing?.map?.lng !== undefined ? p.landing.map.lng : ''}" onchange="updateProjectDeepMap('${p.slug}', 'lng', this.value)" /></label>
                        <label class="block"><span class="mb-2 block text-xs font-semibold text-slate-600">Zoom</span><input id="zoom-${p.slug}" class="w-full text-xs rounded-xl border-slate-200" type="number" min="1" max="22" placeholder="15" value="${p.landing?.map?.zoom !== undefined ? p.landing.map.zoom : '15'}" onchange="updateProjectDeepMap('${p.slug}', 'zoom', this.value)" /></label>
                    </div>
                    <div id="map-preview-${p.slug}" style="height: 250px; z-index: 1;" class="w-full rounded-xl border border-slate-200 mt-4 overflow-hidden relative"></div>
                  </div>
              </div>
            </section>

            <section class="mt-8">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Información del cliente o contratante</h3>
                <label class="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-200 transition-colors select-none">
                  <input type="checkbox" class="rounded border-slate-300 text-primary" ${p.isOwnProject ? 'checked' : ''} onchange="updateProject('${p.slug}', 'isOwnProject', this.checked); setTimeout(renderProjects, 10);">
                  Proyecto propio (Interno)
                </label>
              </div>
              
              <div class="${p.isOwnProject ? 'hidden' : 'block'} transition-all duration-300 border border-slate-200 rounded-xl p-5 bg-slate-50 mt-2">
                <div class="grid gap-4 md:grid-cols-2">
                   <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Nombre de la organización ${p.isOwnProject ? '' : '<span class="text-rose-500">*</span>'}</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="Ej. Constructora Principal" value="${p.clientName || ''}" onchange="updateProject('${p.slug}', 'clientName', this.value)" ${p.isOwnProject ? 'disabled' : 'required'} /></label>
                   
                   <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Tipo de organización</span>
                    <select class="w-full text-xs rounded-xl border-slate-200" onchange="updateProject('${p.slug}', 'clientType', this.value)" ${p.isOwnProject ? 'disabled' : ''}>
                      <option value="">Seleccionar...</option>
                      ${["Cliente / Promotor", "Propietario", "Contratante", "Constructor", "Entidad pública", "Desarrollador inmobiliario", "Otro"].map(t => `<option value="${t}" ${p.clientType === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                   </label>
                </div>
                
                <div class="mt-6 border-t border-slate-200 pt-4">
                   <div class="flex justify-between items-center mb-4">
                       <h4 class="text-xs font-bold uppercase tracking-[0.1em] text-slate-500">Contactos del Cliente</h4>
                       <button type="button" class="text-xs font-bold text-primary hover:underline flex items-center gap-1" onclick="addClientContact('${p.slug}')">
                          <span class="material-symbols-outlined text-[14px]">add_circle</span> Agregar contacto
                       </button>
                   </div>
                   
                   <div class="flex flex-col gap-2">
                     ${contactsHTML}
                   </div>
                </div>
              </div>
            </section>
            
            <section class="mt-8 border-t border-slate-200 pt-6">
              <div class="flex items-center justify-between mb-4">
                  <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Miembros del Proyecto</h3>
                  <button type="button" class="text-xs font-bold text-primary hover:underline flex items-center gap-1" onclick="addProjectMember('${p.slug}')">
                     <span class="material-symbols-outlined text-[14px]">person_add</span> Asignar miembro
                  </button>
              </div>
              <div class="flex flex-col gap-2">
                 ${projectMembersHTML}
              </div>
            </section>
            
            </div>
          </div>`;
        }
        
        const cutoffDay = 3;
        const licInfo = window.WompiModule ? window.WompiModule.getProjectLicenseStatus(p, cutoffDay) : { badgeColor: 'bg-emerald-100 text-emerald-800', badgeText: 'Licencia Activa', message: '' };
        const effectiveStatus = (licInfo.status === 'SUSPENDED') ? 'Inactivo' : (p.status || 'Activo');

        return `
          <div class="border-b border-slate-100 last:border-0 bg-slate-50">
            <div class="grid grid-cols-12 gap-2 p-3 text-sm items-center hover:bg-slate-100 cursor-pointer" onclick="toggleProjectAccordion('${p.slug}')">
              <div class="col-span-3 font-semibold text-slate-800 flex items-center gap-2">
                  <span class="material-symbols-outlined text-slate-400 text-lg transition-transform ${isOpen ? 'rotate-180' : ''}">expand_more</span>
                  ${p.name || p.title || 'Proyecto'}
              </div>
              <div class="col-span-2 font-mono text-[10px] text-slate-500 truncate" title="${p.slug}">${p.slug}</div>
              <div class="col-span-2">
                  <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${effectiveStatus==='Activo'?'bg-emerald-100 text-emerald-700':effectiveStatus==='Cerrado'?'bg-rose-100 text-rose-700':'bg-slate-200 text-slate-700'}">${effectiveStatus}</span>
              </div>
              <div class="col-span-3 text-center" onclick="event.stopPropagation()">
                  <span class="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border font-bold ${licInfo.badgeColor}" title="${licInfo.message}">
                    ${licInfo.badgeText}
                  </span>
              </div>
              <div class="col-span-2 text-right flex justify-end gap-1 items-center" onclick="event.stopPropagation()">
                ${p.cancelledAt ? `
                  <span class="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 font-bold" title="Cancelado sin cobro posterior">Cancelado</span>
                ` : `
                  <button onclick="cancelProjectLicense('${p.slug}')" class="text-[11px] text-amber-700 hover:text-amber-900 px-2 py-1 bg-white border border-amber-200 rounded-lg shadow-sm hover:shadow flex items-center gap-1 font-semibold" title="Cancelar Licencia (Requiere 5 días hábiles antes de fecha de corte)">
                    <span class="material-symbols-outlined text-xs">cancel</span> Cancelar
                  </button>
                `}
                ${userRole === 'SUPER_ADMINISTRADOR' ? `<button onclick="deleteProject('${p.slug}')" class="text-rose-500 hover:text-rose-700 p-1 bg-white border border-rose-200 rounded-lg shadow-sm hover:shadow" title="Eliminar Proyecto"><span class="material-symbols-outlined text-sm">delete</span></button>` : ''}
              </div>
            </div>
            ${contentBase}
          </div>
        `;
      }).join('');

      if (configListEl) {
        configListEl.innerHTML = config.projects.map((p, i) => {
          const isOpen = !!window.openConfigAccordions[p.slug];
          const isSuperAdmin = userRole === 'SUPER_ADMINISTRADOR';
          
          const isLocked = p.lockDataSources === true;
          const canEditDataSources = isSuperAdmin || !isLocked;
          const disableAttr = canEditDataSources ? '' : 'disabled="disabled"';
          const disableClass = canEditDataSources ? '' : 'opacity-50 cursor-not-allowed';
    
          let contentConfig = '';
          if (isOpen) {
            contentConfig = `
            <div class="p-5 border-t border-slate-200 bg-white">
              <div class="grid gap-6">
<section>
  <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Configuración de URLs</h3>
  <div class="mt-4 grid gap-4 md:grid-cols-2">
    <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Slug (Solo lectura)</span><input class="w-full text-xs rounded-xl border-slate-200 bg-slate-100" type="text" value="${p.slug || ''}" readonly disabled /></label>
    <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Home personalizado</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="Vacío = usar landing automática" value="${p.homeUrl || ''}" onchange="updateProject('${p.slug}', 'homeUrl', this.value)" /></label>
    <label class="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"><input class="rounded border-slate-300" type="checkbox" ${p.landing?.enabled !== false ? 'checked' : ''} onchange="updateProjectDeep('${p.slug}', 'landing', 'enabled', this.checked)" />Usar landing tipo Green I</label>
  </div>
</section>

<section>
              <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Branding y textos</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Logo del proyecto</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="https://..." value="${p.landing?.logoUrl || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'logoUrl', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Logo portal claro</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="https://..." value="${p.landing?.portalLogoLight || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'portalLogoLight', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Logo portal oscuro</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="https://..." value="${p.landing?.portalLogoDark || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'portalLogoDark', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Logo visor claro</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="https://..." value="${p.landing?.viewerLogoLight || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'viewerLogoLight', this.value)" /></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">Logo visor oscuro</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="https://..." value="${p.landing?.viewerLogoDark || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'viewerLogoDark', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Eyebrow superior</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.landing?.eyebrow || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'eyebrow', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Título landing</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.landing?.title || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'title', this.value)" /></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">Descripción principal</span><textarea class="w-full text-xs rounded-2xl border-slate-200" rows="3" onchange="updateProjectDeep('${p.slug}', 'landing', 'subtitle', this.value)">${p.landing?.subtitle || ''}</textarea></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Eyebrow acciones</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.landing?.actionEyebrow || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'actionEyebrow', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Título acciones</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.landing?.actionTitle || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'actionTitle', this.value)" /></label>
                <label class="block md:col-span-2"><span class="mb-2 block text-sm font-semibold text-slate-700">Descripción acciones</span><textarea class="w-full text-xs rounded-2xl border-slate-200" rows="3" onchange="updateProjectDeep('${p.slug}', 'landing', 'actionDescription', this.value)">${p.landing?.actionDescription || ''}</textarea></label>
              </div>
            </section>

            <section>
              <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Mapa y ciudad</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Eyebrow mapa</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.landing?.mapEyebrow || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'mapEyebrow', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Nombre ciudad visible</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.landing?.cityLabel || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'cityLabel', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Zoom del mapa</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="1" value="${p.landing?.map?.zoom || 15}" onchange="updateProjectDeepMap('${p.slug}', 'zoom', parseFloat(this.value))" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Latitud</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" value="${p.landing?.map?.lat || 4.60971}" onchange="updateProjectDeepMap('${p.slug}', 'lat', parseFloat(this.value))" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Longitud</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" value="${p.landing?.map?.lng || -74.08175}" onchange="updateProjectDeepMap('${p.slug}', 'lng', parseFloat(this.value))" /></label>
                <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Actualiza las coordenadas para ajustar la visualización del mapa en la landing.</div>
                <label class="block md:col-span-2 xl:col-span-3"><span class="mb-2 block text-sm font-semibold text-slate-700">Descripción de ciudad</span><textarea class="w-full text-xs rounded-2xl border-slate-200" rows="3" onchange="updateProjectDeep('${p.slug}', 'landing', 'mapDescription', this.value)">${p.landing?.mapDescription || ''}</textarea></label>
                <label class="block md:col-span-2 xl:col-span-3"><span class="mb-2 block text-sm font-semibold text-slate-700">Dirección</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.landing?.address || ''}" onchange="updateProjectDeep('${p.slug}', 'landing', 'address', this.value)" /></label>
              </div>
            </section>

            <section>
              <div class="flex items-center justify-between mb-4">
                  <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Modelos IFC y Fuentes de datos</h3>
                  ${isSuperAdmin ? `
                  <label class="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700">
                      <input class="rounded border-rose-300 text-rose-600" type="checkbox" ${isLocked?'checked':''} onchange="updateProject('${p.slug}', 'lockDataSources', this.checked)" />
                      Bloquear para Empresa
                  </label>
                  ` : `
                  ${isLocked ? '<span class="px-2 py-1 text-[10px] uppercase font-bold tracking-wider rounded bg-slate-200 text-slate-500">🔒 Bloqueado por Super Admin</span>' : ''}
                  `}
              </div>
              <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label class="block ${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Nombre Carpeta Modelos IFC</span><input ${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.dataSources?.driveFolderName || ''}" onchange="updateProjectDeepDS('${p.slug}', 'driveFolderName', this.value)" /></label>
                <label class="block ${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">ID Carpeta Modelos IFC</span><input ${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.dataSources?.driveFolderId || ''}" onchange="updateProjectDeepDS('${p.slug}', 'driveFolderId', this.value)" /></label>
                <label class="block md:col-span-2 xl:col-span-1 ${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Script de Modelos (Drive)</span><input ${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.dataSources?.driveScriptUrl || ''}" onchange="updateProjectDeepDS('${p.slug}', 'driveScriptUrl', this.value)" /></label>
                <label class="block ${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Sheet ID STATUS</span><input ${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.dataSources?.statusSheetId || ''}" onchange="updateProjectDeepDS('${p.slug}', 'statusSheetId', this.value)" /></label>
                <label class="block ${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Script STATUS</span><input ${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.dataSources?.statusScriptUrl || ''}" onchange="updateProjectDeepDS('${p.slug}', 'statusScriptUrl', this.value)" /></label>
                <label class="block ${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Sheet ID CANTIDADES</span><input ${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.dataSources?.cantidadesSheetId || ''}" onchange="updateProjectDeepDS('${p.slug}', 'cantidadesSheetId', this.value)" /></label>
                <label class="block md:col-span-2 xl:col-span-2 ${disableClass}"><span class="mb-2 block text-sm font-semibold text-slate-700">Script CANTIDADES</span><input ${disableAttr} class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.dataSources?.cantidadesScriptUrl || ''}" onchange="updateProjectDeepDS('${p.slug}', 'cantidadesScriptUrl', this.value)" /></label>
              </div>
            </section>

            <section>
              <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Módulos del proyecto</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Visor IFC</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.modules?.ifc || ''}" onchange="updateProjectDeepMod('${p.slug}', 'ifc', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">STATUS</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.modules?.status || ''}" onchange="updateProjectDeepMod('${p.slug}', 'status', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">CANTIDADES</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.modules?.cantidades || ''}" onchange="updateProjectDeepMod('${p.slug}', 'cantidades', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Visor PDF</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.modules?.pdf || ''}" onchange="updateProjectDeepMod('${p.slug}', 'pdf', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Visor DWG</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.modules?.dwg || ''}" onchange="updateProjectDeepMod('${p.slug}', 'dwg', this.value)" /></label>
              </div>
            </section>

            <section>
              <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Acciones del panel</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-3">
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Publicaciones</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.actions?.publicaciones || ''}" onchange="updateProjectDeepAct('${p.slug}', 'publicaciones', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Solicitudes</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.actions?.solicitudes || ''}" onchange="updateProjectDeepAct('${p.slug}', 'solicitudes', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Equipo</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.actions?.equipo || ''}" onchange="updateProjectDeepAct('${p.slug}', 'equipo', this.value)" /></label>
              </div>
            </section>
              </div>
            </div>`;
          }
          
          return `
            <div class="border-b border-slate-100 last:border-0 bg-slate-50">
              <div class="grid grid-cols-12 gap-2 p-3 text-sm items-center hover:bg-slate-100 cursor-pointer" onclick="toggleConfigAccordion('${p.slug}')">
                <div class="col-span-4 font-semibold text-slate-800 flex items-center gap-2">
                    <span class="material-symbols-outlined text-slate-400 text-lg transition-transform ${isOpen ? 'rotate-180' : ''}">expand_more</span>
                    ${p.name || p.title || 'Proyecto'}
                </div>
                <div class="col-span-3 font-mono text-[10px] text-slate-500 truncate" title="${p.slug}">${p.slug}</div>
                <div class="col-span-2">
                    <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${p.status==='Activo'?'bg-emerald-100 text-emerald-700':p.status==='Cerrado'?'bg-rose-100 text-rose-700':'bg-slate-200 text-slate-700'}">${p.status}</span>
                </div>
                <div class="col-span-3 text-right flex justify-end gap-2" onclick="event.stopPropagation()">
                  ${userRole === 'SUPER_ADMINISTRADOR' ? `<button onclick="deleteProject('${p.slug}')" class="text-rose-500 hover:text-rose-700 p-1 bg-white border border-rose-200 rounded shadow-sm hover:shadow" title="Eliminar Proyecto"><span class="material-symbols-outlined text-sm">delete</span></button>` : ''}
                </div>
              </div>
              ${contentConfig}
            </div>
          `;
        }).join('');
      }

      // Calculate company billing summary
      const licensedProjects = (config.projects || []).filter(p => p.hasLicense !== false && !p.cancelledAt);
      const count = licensedProjects.length;
      
      let totalAmountCOP = 0;
      let proratedCount = 0;

      licensedProjects.forEach(p => {
        const bill = window.WompiModule ? window.WompiModule.getProjectBillingAmount(p, 3) : { amountCOP: 137564, isProrated: false };
        totalAmountCOP += bill.amountCOP;
        if (bill.isProrated) proratedCount++;
      });

      const countEl = document.getElementById('company-billing-count');
      const totalEl = document.getElementById('company-billing-total');
      if (countEl && totalEl) {
        countEl.textContent = count;
        totalEl.innerHTML = `
          <div class="text-lg font-black text-blue-950">$${totalAmountCOP.toLocaleString('es-CO')} COP</div>
          <div class="text-[10px] text-blue-600 font-medium mt-0.5">
            ${proratedCount > 0 ? `* Incluye cobro proporcional por días faltantes al día de corte (Día 3)` : `Facturación mensual unificada el día 3 de cada mes ($137.564 COP con IVA por proyecto)`}
          </div>
        `;
      }

      // Map initialization placeholder logic wrapper end
        

    // Map initialization
    setTimeout(() => {
        config.projects.forEach(p => {
          if (window.openProjectAccordions[p.slug]) {
            const mapId = 'map-preview-' + p.slug;
            const mapEl = document.getElementById(mapId);
            if (mapEl && !mapEl._leaflet_id && window.L) {
              const lat = p.landing?.map?.lat !== undefined ? parseFloat(p.landing.map.lat) : 4.60971;
              const lng = p.landing?.map?.lng !== undefined ? parseFloat(p.landing.map.lng) : -74.08175;
              const zoom = p.landing?.map?.zoom !== undefined ? parseInt(p.landing.map.zoom) : 15;
              
              const map = L.map(mapId).setView([lat, lng], zoom);
              
              L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CARTO'
              }).addTo(map);
              
              const noraIcon = L.icon({
                  iconUrl: 'https://i.postimg.cc/W3trgjZX/FAVICON-NORA-NEGRO.png',
                  iconSize: [24, 24],
                  iconAnchor: [12, 12]
              });
              
              const marker = L.marker([lat, lng], { draggable: true, icon: noraIcon }).addTo(map);
              
              marker.on('dragend', function (e) {
                const pos = marker.getLatLng();
                const latInput = document.getElementById('lat-' + p.slug);
                const lngInput = document.getElementById('lng-' + p.slug);
                if(latInput) latInput.value = pos.lat.toFixed(6);
                if(lngInput) lngInput.value = pos.lng.toFixed(6);
                window.updateProjectDeepMap(p.slug, 'lat', pos.lat);
                window.updateProjectDeepMap(p.slug, 'lng', pos.lng);
              });
              
              map.on('click', function(e) {
                marker.setLatLng(e.latlng);
                const latInput = document.getElementById('lat-' + p.slug);
                const lngInput = document.getElementById('lng-' + p.slug);
                if(latInput) latInput.value = e.latlng.lat.toFixed(6);
                if(lngInput) lngInput.value = e.latlng.lng.toFixed(6);
                window.updateProjectDeepMap(p.slug, 'lat', e.latlng.lat);
                window.updateProjectDeepMap(p.slug, 'lng', e.latlng.lng);
              });
              
              map.on('zoomend', function() {
                  const z = map.getZoom();
                  const zInput = document.getElementById('zoom-' + p.slug);
                  if(zInput) zInput.value = z;
                  window.updateProjectDeepMap(p.slug, 'zoom', z);
              });
              
              setTimeout(() => { map.invalidateSize(); }, 200);
            }
          }
        });
      }, 50);
  }

  window.updateProject = (slug, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
      proj[field] = val;
      if (field === 'country' || field === 'city' || field === 'hasLicense') {
        setTimeout(() => {
          renderProjects();
        }, 10);
      }
    }
  };

  window.updateProjectDeep = (slug, parent, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
        if(!proj[parent]) proj[parent] = {};
        proj[parent][field] = val;
    }
  };
  
  window.updateProjectDeepMap = (slug, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
        if(!proj.landing) proj.landing = {};
        if(!proj.landing.map) proj.landing.map = {};
        proj.landing.map[field] = val;
    }
  };

  
  window.updateProjectDeepMap = (slug, prop, value) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (config && config.projects) {
        const proj = config.projects.find(p => p.slug === slug);
        if (proj) {
            if (!proj.landing) proj.landing = {};
            if (!proj.landing.map) proj.landing.map = { lat: 4.60971, lng: -74.08175, zoom: 15 };
            proj.landing.map[prop] = prop === 'zoom' ? parseInt(value) || 15 : parseFloat(value) || 0;
        }
    }
  };
  window.updateProjectDeepDS = (slug, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
        if(!proj.dataSources) proj.dataSources = {};
        proj.dataSources[field] = val;
    }
  };

  window.updateProjectDeepMod = (slug, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
        if(!proj.modules) proj.modules = {};
        proj.modules[field] = val;
    }
  };
  
  window.updateProjectDeepAct = (slug, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
        if(!proj.actions) proj.actions = {};
        proj.actions[field] = val;
    }
  };



  window.addClientContact = (slug) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
      if(!proj.clientContacts) proj.clientContacts = [];
      proj.clientContacts.push({name:'', role:'', email:'', phone:''});
      renderProjects();
    }
  };

  window.removeClientContact = (slug, idx) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj && proj.clientContacts) {
      proj.clientContacts.splice(idx, 1);
      renderProjects();
    }
  };
  
  window.updateClientContact = (slug, idx, field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj && proj.clientContacts) {
      proj.clientContacts[idx][field] = val;
    }
  };

  window.addProjectMember = (slug) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj) {
      if (!proj.members) proj.members = [];
      proj.members.push('');
      renderProjects();
    }
  };

  window.updateProjectMember = (slug, idx, email) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj && proj.members) {
      proj.members[idx] = email;
    }
  };

  window.removeProjectMember = (slug, idx) => {
    if(!confirm('¿Remover miembro de este proyecto?')) return;
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if(proj && proj.members) {
      proj.members.splice(idx, 1);
      renderProjects();
    }
  };

  // ── CONFIGURACIÓN GLOBAL WOMPI (EXCLUSIVO SÚPER ADMINISTRADOR) ─────────────────────
  try {
    window.globalWompiConfig = JSON.parse(localStorage.getItem('globalWompiConfig') || '{"envMode":"sandbox","pubKey":"pub_test_emCXbyxkJncOP6CaWEKk4UIJeTVRzjax","integritySecret":""}');
  } catch(e) {
    window.globalWompiConfig = { envMode: 'sandbox', pubKey: 'pub_test_emCXbyxkJncOP6CaWEKk4UIJeTVRzjax', integritySecret: '' };
  }

  window.openGlobalWompiModal = () => {
    if (userRole !== 'SUPER_ADMINISTRADOR') {
      alert('Solo los Súper Administradores pueden gestionar la configuración global de Wompi.');
      return;
    }
    const modal = document.getElementById('global-wompi-modal');
    if (!modal) return;
    const envSelect = document.getElementById('global-wompi-env');
    const pubKeyInput = document.getElementById('global-wompi-pubkey');
    const secretInput = document.getElementById('global-wompi-secret');

    if (envSelect) envSelect.value = window.globalWompiConfig.envMode || 'sandbox';
    if (pubKeyInput) pubKeyInput.value = window.globalWompiConfig.pubKey || '';
    if (secretInput) secretInput.value = window.globalWompiConfig.integritySecret || '';

    modal.classList.remove('hidden');
  };

  window.closeGlobalWompiModal = () => {
    const modal = document.getElementById('global-wompi-modal');
    if (modal) modal.classList.add('hidden');
  };

  window.updateGlobalWompiConfig = (field, val) => {
    if (!window.globalWompiConfig) window.globalWompiConfig = {};
    window.globalWompiConfig[field] = (val || '').trim();
    localStorage.setItem('globalWompiConfig', JSON.stringify(window.globalWompiConfig));
  };

  // ── FUNCIONES DE GESTIÓN WOMPI (FACTURACIÓN Y LICENCIAS POR EMPRESA) ─────────────────────
  window.updateWompiConfig = (field, val) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    if (!companyConfigs[emp.id]) companyConfigs[emp.id] = { projects: [] };
    const config = companyConfigs[emp.id];
    if (!config.wompi) config.wompi = { cutoffDay: '3', envMode: 'sandbox', pubKey: '', integritySecret: '' };
    config.wompi[field] = val;
    if (field === 'cutoffDay') {
      renderProjects();
    }
  };

  window.cancelProjectLicense = (slug) => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    const proj = config.projects.find(p => p.slug === slug);
    if (!proj) return;

    const cutoffDay = config.wompi?.cutoffDay || 3;
    const check = window.WompiModule ? window.WompiModule.canCancelBeforeNextCycle(cutoffDay) : { canCancelWithoutCharge: true, businessDaysUntilCutoff: 5, nextCutoffDate: 'la próxima fecha de corte' };

    let msg = `¿Deseas cancelar la licencia para el proyecto "${proj.name || proj.title}"?\n\n`;
    if (check.canCancelWithoutCharge) {
      msg += `✅ Estás dentro del tiempo permitido (${check.businessDaysUntilCutoff} días hábiles restantes antes del ${check.nextCutoffDate}). No se generará cobro en el siguiente periodo.`;
    } else {
      msg += `⚠️ Nota: Quedan sólo ${check.businessDaysUntilCutoff} días hábiles antes de la fecha de corte (${check.nextCutoffDate}). Para evitar la renovación del ciclo entrante se requiere un preaviso mínimo de 5 días hábiles colombianos. El proyecto permanecerá activo hasta cumplir el ciclo actual.`;
    }
    msg += `\n\n📌 Al vencer la licencia, tus datos y archivos BIM se mantendrán almacenados de forma segura durante 90 días calendario antes de su eliminación permanente.`;

    if (confirm(msg)) {
      proj.cancelledAt = new Date().toISOString();
      renderProjects();
      showBanner('Licencia cancelada para el proyecto. El cambio ha sido registrado.', 'info');
    }
  };

  window.payConsolidatedWompi = async () => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;

    const activeLicensedProjects = (config.projects || []).filter(p => p.hasLicense !== false && !p.cancelledAt);
    if (activeLicensedProjects.length === 0) {
      alert('No hay proyectos con licencia activa pendientes de pago.');
      return;
    }

    const globalWompi = window.globalWompiConfig || {};
    const wompiConf = config.wompi || {};
    const envMode = 'production';
    const pubKey = globalWompi.pubKey || wompiConf.pubKey || '';
    const integritySecret = globalWompi.integritySecret || wompiConf.integritySecret || '';

    if (!pubKey) {
      alert('⚠️ No se ha configurado la Llave Pública (Public Key) de Wompi.\n\nPor favor haz clic en el botón "Credenciales Wompi" en la barra superior del panel para ingresar tus llaves.');
      return;
    }

    let totalAmountCOP = 0;
    activeLicensedProjects.forEach(p => {
      const bill = window.WompiModule ? window.WompiModule.getProjectBillingAmount(p, 3) : { amountCOP: 137564 };
      totalAmountCOP += bill.amountCOP;
    });
    const amountInCents = totalAmountCOP * 100;
    const reference = `NORABIM-${emp.code || emp.id}-${Date.now()}`;

    try {
      showBanner('Abriendo Pasarela Wompi Checkout...', 'info');
      await window.WompiModule.launchCheckout({
        publicKey: pubKey,
        integritySecret: integritySecret,
        reference: reference,
        amountInCents: amountInCents,
        currency: 'COP',
        customerEmail: emp.email || '',
        customerName: emp.name || ''
      });
    } catch (err) {
      console.error('Error al iniciar Wompi Checkout:', err);
      alert('Error al iniciar el checkout de Wompi: ' + err.message);
    }
  };

  // Escuchar parámetros de retorno de Wompi Checkout
  (function checkWompiRedirect() {
    const urlParams = new URLSearchParams(window.location.search);
    const txId = urlParams.get('transaction_id') || urlParams.get('id');
    if (txId) {
      setTimeout(() => {
        showBanner(`✅ Transacción Wompi recibida (ID: ${txId}). Licencias de proyectos actualizadas exitosamente.`, 'success');
      }, 1000);
    }
  })();

  window.deleteProject = (slug) => {
    if (selectedIndex === -1) return;
    if(confirm('¿Eliminar proyecto de esta empresa?')) {
      const emp = empresas[selectedIndex];
      const config = companyConfigs[emp.id];
      if (config && config.projects) {
        config.projects = config.projects.filter(p => p.slug !== slug);
        renderProjects();
      }
    }
  };

  document.getElementById('add-proyecto-btn').addEventListener('click', () => {
    if (selectedIndex === -1) return;
    const emp = empresas[selectedIndex];
    const config = companyConfigs[emp.id];
    if (!config || !config.projects) return;
    
    const slug = 'nuevo-proyecto-' + Date.now();
    config.projects.push({
      name: 'Nuevo Proyecto',
      title: 'NUEVO PROYECTO',
      slug: slug,
      status: 'Planeacion',
      enabled: true,
      hasLicense: true,
      landing: { 
        enabled: true, 
        title: 'NUEVO PROYECTO', 
        map: { lat: 4.60971, lng: -74.08175, zoom: 15 },
        eyebrow: "nora",
        subtitle: "Accesos rápidos, seguimiento y contexto del proyecto.",
        actionEyebrow: "Panel",
        actionTitle: "Acciones",
        actionDescription: "Atajos para equipo, incidencias y gestión del proyecto.",
        logoUrl: "https://i.postimg.cc/J4Fy2Qsx/LOGO-(1).jpg",
        portalLogoLight: "https://i.postimg.cc/tR3YSryT/LOGO-NORA-NEGRO.png",
        portalLogoDark: "https://i.postimg.cc/SQ6JTZqj/LOGO-NORA-BLANCO.png",
        viewerLogoLight: "https://i.postimg.cc/L4r0gSvV/LOGO-TEXTO-NORA-NEGRO.png",
        viewerLogoDark: "https://i.postimg.cc/FFfBKzb8/LOGO-TEXTO-NORA-BLANCO.png"
      },
      modules: {
        ifc: "VSR_IFCA/",
        status: "STATUS/",
        cantidades: "CANTIDADES/",
        pdf: "VSR_PDFA/",
        dwg: "VSR_DWGA/"
      },
      actions: {
        publicaciones: "Publicaciones.html",
        solicitudes: "index.html",
        equipo: "equipo.html"
      },
      dataSources: {
        driveFolderName: "",
        driveFolderId: "",
        driveScriptUrl: "",
        statusSheetId: "",
        statusScriptUrl: "",
        cantidadesSheetId: "",
        cantidadesScriptUrl: ""
      }
    });
    renderProjects();
  });

  document.getElementById('add-empresa-btn').addEventListener('click', () => {
    const ts = Date.now();
    const tempId = 'empresa-' + ts;
    empresas.push({ 
        id: tempId, 
        name: 'Nueva Empresa', 
        code: '000',
        admins: [],
        zonaHoraria: 'America/Bogota',
        configUrl: `config-${tempId}.json`
    });
    selectEmpresa(empresas.length - 1);
  });

  document.getElementById('delete-empresa-btn').addEventListener('click', async () => {
    if(confirm('¿Está seguro de que desea eliminar permanentemente esta empresa del sistema? (Se borrará del Google Sheet y de la configuración local)')) {
      const empId = empresas[selectedIndex].id;
      
      showBanner('Eliminando empresa...', 'info');
      try {
        const url = `${ROLES_SCRIPT_URL}?action=deleteCompany&id=${encodeURIComponent(empId)}`;
        await fetch(url, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({ action: 'deleteCompany', id: empId })
        });
        
        empresas[selectedIndex].deleted = true;
        selectedIndex = -1;
        editorEl.classList.add('hidden');
        renderList();
        
        showBanner('Empresa eliminada de Google Sheets. Haz clic en "Guardar" para guardar los cambios.', 'success');
      } catch (e) {
        console.error(e);
        showBanner('Error al eliminar la empresa de Google Sheets.', 'error');
      }
    }
  });

  // Auto-save to memory on input
  const portalFieldMap = {
    portalName: 'name',
    portalShortName: 'shortName',
    portalLogoLight: 'logoLight',
    portalLogoDark: 'logoDark',
    portalLogoFooterLight: 'footerLogoLight',
    portalLogoFooterDark: 'footerLogoDark',
    portalLogoFooterSecondaryLight: 'footerLogoSecondaryLight',
    portalLogoFooterSecondaryDark: 'footerLogoSecondaryDark',
    portalFooterText: 'footerText',
    portalHeroImages: 'heroImages'
  };

  Object.keys(el).forEach(key => {
    el[key].addEventListener('input', () => {
      if (key === 'superAdmins') return;
      if (selectedIndex === -1) return;
      const emp = empresas[selectedIndex];
      
      // Route portal fields to companyConfigs[empId].portal
      if (portalFieldMap[key]) {
        const config = companyConfigs[emp.id];
        if (!config) return;
        if (!config.portal) config.portal = {};
        if (key === 'portalHeroImages') {
          config.portal.heroImages = el[key].value.split('\n').map(s => s.trim()).filter(Boolean);
        } else {
          config.portal[portalFieldMap[key]] = el[key].value;
        }
        return;
      }

      if (el[key].type === 'checkbox') {
        emp[key] = el[key].checked;
      } else {
        emp[key] = el[key].value;
      }
      
      // Auto-update location if they type ciudad/departamento and location is empty
      if ((key === 'ciudad' || key === 'departamento') && (!emp.location || emp.location.includes(','))) {
          if (emp.ciudad && emp.departamento) {
              emp.location = `${emp.ciudad}, ${emp.departamento}`;
              el.location.value = emp.location;
          }
      }

      // Re-render list if important display fields change
      if (['name', 'id', 'code', 'razonSocial'].includes(key)) {
          if (key === 'id') {
              emp.configUrl = `config-${emp.id}.json`;
          }
          renderList();
      }
    });
  });

  document.getElementById('publish-github-btn').addEventListener('click', async () => {
    let token = localStorage.getItem('github_pat');
    if (!token) {
      token = prompt('Ingresa tu Personal Access Token (PAT) de GitHub para guardar directamente en el repositorio:');
      if (!token) { showBanner('Se requiere el token de GitHub.', 'error'); return; }
      localStorage.setItem('github_pat', token);
    }
    
    // Quick validation before publish
    for (const emp of empresas) {
        if (!emp.id || emp.id.trim() === '') {
            showBanner('Error: Una empresa tiene el ID vacío. Por favor asigne un ID (ej: constructora-x).', 'error');
            return;
        }
    }

    showBanner('Guardando cambios...', 'info');
    
    // Save super admins to portal-config
    let portalConfigStr = '';
    try {
      const res = await fetch(`portal-config.json?t=${Date.now()}`);
      if (res.ok) {
        const config = await res.json();
        // Super Admins are now managed directly in the code/JSON, so we don't overwrite them from UI
        portalConfigStr = JSON.stringify(config, null, 2) + '\n';
      }
    } catch(e) {}

    const repo = 'camilomartg-svg/bim';
    const branch = 'main';
    
    const pushFile = async (path, content) => {
      let sha = null;
      try {
        const getRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}?ref=${branch}`, { headers: { 'Authorization': `token ${token}` }, cache: 'no-store' });
        if (getRes.ok) sha = (await getRes.json()).sha;
      } catch(e) {}
      
      const body = { message: 'Update from Super Admin', content: btoa(unescape(encodeURIComponent(content))), branch };
      if (sha) body.sha = sha;
      
      const putRes = await fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!putRes.ok) {
        if(putRes.status === 401) localStorage.removeItem('github_pat');
        throw new Error(`Error actualizando ${path}`);
      }
    };
    
    try {
      // ── AUTO-APPROVE pending users that appear as members ──────────────────
      // Collect all member emails across all companies
      const membersByEmail = new Map(); // email -> { name, empName }
      empresas.forEach(emp => {
        (emp.members || []).forEach(m => {
          if (m.email && m.email.trim()) {
            const email = m.email.toLowerCase().trim();
            if (!membersByEmail.has(email)) {
              membersByEmail.set(email, { name: m.name || email, empName: emp.name, role: m.role });
            }
          }
        });
      });

      // Find which users need approval or company synchronization in Google Sheets
      const toSyncUsers = [];
      membersByEmail.forEach((data, email) => {
        const key = email + '_' + (data.empName || '').toLowerCase().trim();
        const gu = window.globalUsersMap.get(key) || window.globalUsersMap.get(email);
        
        if (gu) {
          const isPending = gu.estado === 'PENDIENTE';
          const sheetCompany = (gu.companyName || '').trim().toLowerCase();
          const localCompany = (data.empName || '').trim().toLowerCase();
          
          const isUnassigned = sheetCompany === '' || sheetCompany === 'sin empresa asignada';
          const isMismatch = sheetCompany !== localCompany;
          
          // Sync if pending OR if the company is unassigned in the sheet OR if there is a mismatch (and local role is not guest)
          if (isPending || isUnassigned || (isMismatch && data.role !== 'INVITADO')) {
            toSyncUsers.push({
              email: email,
              key: key,
              name: gu.name || data.name || email.split('@')[0],
              role: data.role || gu.role || 'MIEMBRO',
              companyName: data.empName,
              estado: 'APROBADO'
            });
          }
        }
      });

      if (toSyncUsers.length > 0) {
        for (const u of toSyncUsers) {
          const rol = u.role || 'INVITADO';
          const payload = { action: 'saveUser', email: u.email, nombre: u.name, rol: rol, empresa: u.companyName, estado: u.estado };
          const queryParams = new URLSearchParams(payload).toString();
          await fetch(`${ROLES_SCRIPT_URL}?${queryParams}`, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
          });
          // Update local map
          const existing = window.globalUsersMap.get(u.key) || window.globalUsersMap.get(u.email);
          if (existing) {
            window.globalUsersMap.set(u.key || u.email, { 
              ...existing, 
              estado: u.estado, 
              role: rol, 
              companyName: u.companyName 
            });
          }
        }
        renderGlobalUsers();
      }
      // ───────────────────────────────────────────────────────────────────────

      // ── SINCRONIZACIÓN DE CARPETAS EN GOOGLE DRIVE ───────────────────────
      showBanner('Guardando cambios...', 'info');
      try {
        const syncPayload = {
          action: 'syncDriveFolders',
          companies: empresas.filter(e => !e.deleted).map(emp => {
            const config = companyConfigs[emp.id] || { projects: [] };
            return {
              id: emp.id,
              name: emp.name,
              code: emp.code || '000',
              driveFolderId: emp.driveFolderId || '',
              projects: (config.projects || []).map(p => ({
                name: p.name,
                slug: p.slug,
                driveFolderId: (p.dataSources && p.dataSources.driveFolderId) || ''
              }))
            };
          })
        };

        const syncRes = await fetch(ROLES_SCRIPT_URL, {
          method: 'POST',
          body: JSON.stringify(syncPayload)
        });

        if (!syncRes.ok) {
          throw new Error('No se pudo establecer conexión con el servidor de Google Drive.');
        }

        const syncData = await syncRes.json();
        if (syncData && syncData.status === 'success' && syncData.folders) {
          const foldersMap = syncData.folders;
          empresas.forEach(emp => {
            const info = foldersMap[emp.id];
            if (info) {
              if (info.driveFolderId) {
                emp.driveFolderId = info.driveFolderId;
              }
              const config = companyConfigs[emp.id];
              if (config && config.projects && info.projects) {
                config.projects.forEach(p => {
                  const pFolderId = info.projects[p.slug];
                  if (pFolderId) {
                    if (!p.dataSources) p.dataSources = {};
                    p.dataSources.driveFolderId = pFolderId;
                    // Auto-sync folder name with the project name
                    p.dataSources.driveFolderName = p.name || 'Sin Nombre';
                  }
                });
              }
            }
          });
        } else if (syncData && syncData.status === 'error') {
          throw new Error('Error de Apps Script: ' + syncData.message);
        }
      } catch (err) {
        console.error("Error sincronizando Google Drive:", err);
        throw new Error('Sincronización de Google Drive fallida: ' + err.message);
      }

      const empJson = JSON.stringify(empresas, null, 2) + '\n';
      await pushFile('empresas.json', empJson);
      await pushFile('docs/empresas.json', empJson); // if docs exists
      
      if (portalConfigStr && userRole === 'SUPER_ADMINISTRADOR') {
        await pushFile('portal-config.json', portalConfigStr);
        await pushFile('docs/portal-config.json', portalConfigStr);
      }

      // Sincronizar todos los archivos config-*.json modificados
      for (const [empId, configData] of Object.entries(companyConfigs)) {
        const emp = empresas.find(e => e.id === empId);
        if (emp) {
          // Security filter: check if user has write permissions for this company config
          let hasAccess = userRole === 'SUPER_ADMINISTRADOR';
          if (!hasAccess && userRole === 'ADMINISTRADOR_EMPRESA') {
            hasAccess = emp.members && emp.members.some(m => m.email && m.email.toLowerCase() === userEmail && (m.role === 'ADMINISTRADOR_EMPRESA' || m.role === 'ADMINISTRADOR'));
          }
          if (!hasAccess) {
            console.log(`Skipping sync of config file for company ${empId} due to lack of administrative permissions.`);
            continue;
          }

          const path = emp.configUrl || `config-${empId}.json`;
          // Mantener compatibilidad de portal si no existe
          if (!configData.portal) {
            configData.portal = { name: emp.name || "nora CDE" };
          }
          const str = JSON.stringify(configData, null, 2) + '\n';
          await pushFile(path, str);
          await pushFile(`docs/${path}`, str);
        }
      }
      
      sessionStorage.removeItem('cachedCompanies_v2');
      showBanner('✅ Los datos se han guardado exitosamente, tardará de 1 a 3 minutos en integrar los cambios.', 'success');
    } catch(e) {
      showBanner('❌ ' + e.message, 'error');
    }
  });

  await loadData();
  await window.fetchGlobalUsers();
});

// ==========================================
// MÓDULO: DIRECTORIO GLOBAL DE USUARIOS (Google Sheets Single Source of Truth)
// ==========================================
window.globalUsersMap = new Map();
window.currentGlobalUserEmail = null;
const ROLES_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx2RAQx_8K4o22xE0Mw-ETc7K_58vIoi6-PgVi64u80inuiw144ks3cgWSdCtXqIgB02g/exec';

window.switchGlobalView = function(viewName) {
    const btnEmpresas = document.getElementById('tab-empresas');
    const btnUsuarios = document.getElementById('tab-usuarios');
    const btnProyectos = document.getElementById('tab-proyectos-global');
    
    const vEmpresas = document.getElementById('empresas-view');
    const vUsuarios = document.getElementById('usuarios-view');
    const vProyectos = document.getElementById('proyectos-view');

    // Helper to style active/inactive tabs
    const setTabStyle = (btn, isActive) => {
        if (!btn) return;
        if (isActive) {
            btn.classList.remove('text-slate-500', 'hover:text-slate-700');
            btn.classList.add('bg-white', 'text-slate-800', 'shadow-sm');
        } else {
            btn.classList.remove('bg-white', 'text-slate-800', 'shadow-sm');
            btn.classList.add('text-slate-500', 'hover:text-slate-700');
        }
    };

    setTabStyle(btnEmpresas, viewName === 'empresas');
    setTabStyle(btnUsuarios, viewName === 'usuarios');
    setTabStyle(btnProyectos, viewName === 'proyectos');

    // Hide all views
    if (vEmpresas) vEmpresas.classList.add('hidden');
    if (vUsuarios) {
        vUsuarios.classList.add('hidden');
        vUsuarios.classList.remove('flex');
    }
    if (vProyectos) {
        vProyectos.classList.add('hidden');
        vProyectos.classList.remove('flex');
    }

    // Show active view
    if (viewName === 'empresas') {
        if (vEmpresas) vEmpresas.classList.remove('hidden');
    } else if (viewName === 'usuarios') {
        if (vUsuarios) {
            vUsuarios.classList.remove('hidden');
            vUsuarios.classList.add('flex');
        }
        if (window.globalUsersMap.size === 0) {
            fetchGlobalUsers();
        } else {
            renderGlobalUsers();
        }
    } else if (viewName === 'proyectos') {
        if (vProyectos) {
            vProyectos.classList.remove('hidden');
            vProyectos.classList.add('flex');
        }
        renderGlobalProjects();
    }
};

window.fetchGlobalUsers = async function() {
    document.getElementById('global-users-loading').classList.remove('hidden');
    document.getElementById('global-users-tbody').innerHTML = '';
    
    try {
        const res = await fetch(ROLES_SCRIPT_URL + '?t=' + Date.now());
        const scriptUsers = await res.json();
        
        window.globalUsersMap.clear();

        scriptUsers.forEach(u => {
            if(!u.email) return;
            const email = u.email.toLowerCase().trim();
            
            // Reconcile/find the assigned company and role from local empresas data
            let resolvedCompany = u.empresa;
            let resolvedRole = u.rol || 'INVITADO';
            if (Array.isArray(window.empresas)) {
                // 1. Search for non-INVITADO membership
                const matchedEmp = window.empresas.find(e => 
                    !e.deleted && 
                    Array.isArray(e.members) && 
                    e.members.some(m => m.email && m.email.toLowerCase().trim() === email && m.role && m.role !== 'INVITADO')
                );
                if (matchedEmp) {
                    const m = matchedEmp.members.find(m => m.email && m.email.toLowerCase().trim() === email);
                    resolvedCompany = matchedEmp.name;
                    resolvedRole = m.role;
                } else {
                    // 2. Search for any guest membership
                    const guestEmp = window.empresas.find(e => 
                        !e.deleted && 
                        Array.isArray(e.members) && 
                        e.members.some(m => m.email && m.email.toLowerCase().trim() === email)
                    );
                    if (guestEmp) {
                        const m = guestEmp.members.find(m => m.email && m.email.toLowerCase().trim() === email);
                        if (m) {
                            if (m.empresaUsuario && m.empresaUsuario.trim() !== '') {
                                resolvedCompany = m.empresaUsuario.trim();
                            }
                            resolvedRole = m.role || 'INVITADO';
                        }
                    }
                }
            }

            const userObj = {
                email: email,
                name: u.nombre || u.email.split('@')[0],
                role: resolvedRole,
                companyName: resolvedCompany || 'Sin Empresa Asignada',
                specialty: u.especialidad || '',
                cargo: u.cargo || '',
                estado: u.estado || 'PENDIENTE'
            };
            window.globalUsersMap.set(email, userObj);
        });

        renderGlobalUsers();
        if (typeof window.renderUsers === 'function') {
            window.renderUsers();
        }

    } catch (e) {
        console.error("Error cargando usuarios globales", e);
        document.getElementById('global-users-tbody').innerHTML = '<tr><td colspan="5" class="p-6 text-center text-red-500">Error al cargar los usuarios. Verifica tu conexión.</td></tr>';
    } finally {
        document.getElementById('global-users-loading').classList.add('hidden');
    }
}

window.renderGlobalUsers = function(searchTerm = '') {
    const tbody = document.getElementById('global-users-tbody');
    tbody.innerHTML = '';
    
    const term = searchTerm.toLowerCase();
    const usersArr = Array.from(window.globalUsersMap.values()).sort((a, b) => a.name.localeCompare(b.name));

    usersArr.forEach(u => {
        if(term) {
            const matches = u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term) || u.companyName.toLowerCase().includes(term);
            if(!matches) return;
        }

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition-colors group";
        
        let roleStyle = 'bg-slate-100 text-slate-600';
        if(u.role === 'SUPER_ADMINISTRADOR') roleStyle = 'bg-purple-100 text-purple-700';
        else if(u.role === 'ADMINISTRADOR_EMPRESA' || u.role === 'ADMINISTRADOR') roleStyle = 'bg-blue-100 text-blue-700';
        else if(u.role === 'MIEMBRO') roleStyle = 'bg-emerald-100 text-emerald-700';
        else if(u.role === 'EDITOR') roleStyle = 'bg-teal-100 text-teal-700';
        else if(u.role === 'INVITADO') roleStyle = 'bg-amber-100 text-amber-700';
        
        let statusBadge = '';
        if(u.estado === 'PENDIENTE') statusBadge = '<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">Pendiente</span>';

        tr.innerHTML = `
            <td class="py-3 px-6 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase mr-3">
                        ${u.name.substring(0,2)}
                    </div>
                    <div>
                        <div class="text-sm font-bold text-slate-900">${u.name} ${statusBadge}</div>
                        <div class="text-xs text-slate-500">${u.email}</div>
                    </div>
                </div>
            </td>
            <td class="py-3 px-6 whitespace-nowrap">
                <span class="px-2.5 py-1 inline-flex text-[10px] leading-4 font-bold rounded-full uppercase tracking-wide ${roleStyle}">
                    ${u.role}
                </span>
            </td>
            <td class="py-3 px-6 whitespace-nowrap">
                <div class="text-sm text-slate-600 font-medium">${u.companyName}</div>
            </td>
            <td class="py-3 px-6 whitespace-nowrap text-sm text-slate-500">
                ${u.specialty || '-'}
            </td>
            <td class="py-3 px-6 whitespace-nowrap text-right text-sm font-medium">
                ${u.estado === 'PENDIENTE' ? `<button onclick='quickApproveUser("${u.email}", "${u.name}", "${(u.companyName || '').replace(/'/g, "\\'")}")' class="mr-1 inline-flex items-center gap-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-2.5 py-1 rounded-lg text-xs font-bold transition-colors">
                    <span class="material-symbols-outlined text-[14px]">check_circle</span> Aprobar
                </button>` : ''}
                <button onclick='openEditUserModal("${u.email}", "${(u.companyName || '').replace(/'/g, "\\'")}")' class="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50">
                    <span class="material-symbols-outlined text-[20px]">edit</span>
                </button>
                <button onclick='deleteGlobalUser("${u.email}", "${(u.companyName || '').replace(/'/g, "\\'")}")' class="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50 ml-1">
                    <span class="material-symbols-outlined text-[20px]">delete</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Search listener
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('global-user-search');
    if(searchInput) {
        searchInput.addEventListener('input', (e) => {
            window.renderGlobalUsers(e.target.value);
        });
    }
});

window.openEditUserModal = function(email, companyName = '') {
    window.currentGlobalUserEmail = email;
    window.currentGlobalUserCompany = companyName; // Store company name for updating the correct map key
    const modal = document.getElementById('modal-global-user');
    const title = document.getElementById('modal-gu-title');
    
    // Selects
    const companySelect = document.getElementById('gu-company');
    companySelect.innerHTML = '<option value="">Sin Empresa Asignada</option>';
    window.empresas.forEach(emp => {
        companySelect.innerHTML += `<option value="${emp.name}">${emp.name}</option>`;
    });

    if(email) {
        const u = window.globalUsersMap.get(email);
        title.textContent = 'Editar Usuario';
        document.getElementById('gu-email').value = u.email;
        document.getElementById('gu-email').disabled = true;
        document.getElementById('gu-name').value = u.name;
        document.getElementById('gu-role').value = u.role;
        document.getElementById('gu-specialty').value = u.specialty;
        
        // Select matching company name
        let matched = false;
        for (let i = 0; i < companySelect.options.length; i++) {
            if (companySelect.options[i].value === u.companyName) {
                companySelect.selectedIndex = i;
                matched = true;
                break;
            }
        }
        if(!matched && u.companyName !== 'Sin Empresa Asignada') {
            companySelect.innerHTML += `<option value="${u.companyName}">${u.companyName} (No registrada)</option>`;
            companySelect.value = u.companyName;
        }

    } else {
        title.textContent = 'Nuevo Usuario';
        document.getElementById('gu-email').value = '';
        document.getElementById('gu-email').disabled = false;
        document.getElementById('gu-name').value = '';
        document.getElementById('gu-role').value = 'INVITADO';
        document.getElementById('gu-specialty').value = '';
        companySelect.value = '';
    }

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.closeEditUserModal = function() {
    const modal = document.getElementById('modal-global-user');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
}

window.saveGlobalUser = async function() {
    const email = document.getElementById('gu-email').value.trim().toLowerCase();
    const name = document.getElementById('gu-name').value.trim();
    const role = document.getElementById('gu-role').value;
    const companyName = document.getElementById('gu-company').value;
    const specialty = document.getElementById('gu-specialty').value.trim();
    const saveBtn = document.getElementById('btn-save-gu');
    
    if(!email || !name) {
        alert('Nombre y Correo son obligatorios.');
        return;
    }

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm mr-2">autorenew</span> Guardando...';

    try {
        const payload = {
            action: 'saveUser',
            email: email,
            nombre: name,
            rol: role,
            empresa: companyName,
            especialidad: specialty,
            estado: 'APROBADO'
        };

        const queryParams = new URLSearchParams({
            action: 'saveUser',
            email: email,
            nombre: name,
            rol: role,
            empresa: companyName,
            especialidad: specialty,
            estado: 'APROBADO'
        }).toString();

        const res = await fetch(`${ROLES_SCRIPT_URL}?${queryParams}`, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });

        // Update local map instantly
        window.globalUsersMap.set(email, {
            email: email,
            name: name,
            role: role,
            companyName: companyName || 'Sin Empresa Asignada',
            specialty: specialty,
            estado: 'APROBADO'
        });

        renderGlobalUsers();
        closeEditUserModal();
        alert('Usuario guardado exitosamente.');
        
        // Refresh pending requests if we are inside a company
        if (window.selectedIndex !== -1 && window.empresas[window.selectedIndex]) {
            const currentEmpName = window.empresas[window.selectedIndex].name;
            if (window.fetchPendingRequests) window.fetchPendingRequests(currentEmpName);
        }

    } catch (e) {
        console.error(e);
        alert('Error al guardar el usuario en la base de datos.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'Guardar Cambios';
    }
}

window.deleteGlobalUser = async function(email, companyName) {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario con correo ${email}?`)) {
        return;
    }
    
    const lowercaseEmail = email.toLowerCase().trim();
    if (lowercaseEmail === 'mcmartinezg@unal.edu.co' || lowercaseEmail === 'imagina3ddesign@gmail.com') {
        alert('No se puede eliminar a un Super Administrador por motivos de seguridad.');
        return;
    }
    
    showBanner('Eliminando usuario...', 'info');
    
    try {
        const payload = {
            action: 'deleteUser',
            email: email
        };
        const url = `${ROLES_SCRIPT_URL}?action=deleteUser&email=${encodeURIComponent(email)}`;
        await fetch(url, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });
        
        let changed = false;
        window.empresas.forEach(emp => {
            if (emp.members) {
                const initialLen = emp.members.length;
                emp.members = emp.members.filter(m => !m.email || m.email.toLowerCase().trim() !== lowercaseEmail);
                if (emp.members.length !== initialLen) {
                    changed = true;
                }
            }
            if (emp.admins) {
                const initialLen = emp.admins.length;
                emp.admins = emp.admins.filter(a => a.toLowerCase().trim() !== lowercaseEmail);
                if (emp.admins.length !== initialLen) {
                    changed = true;
                }
            }
        });
        
        // Buscar y eliminar cualquier entrada de este usuario en el mapa global sin importar el formato de clave
        for (const k of window.globalUsersMap.keys()) {
            if (k.split('_')[0] === lowercaseEmail) {
                window.globalUsersMap.delete(k);
            }
        }
        
        renderGlobalUsers();
        
        if (changed) {
            showBanner('Usuario eliminado. Se detectaron asociaciones en empresas, haz clic en "Guardar" para guardar los cambios.', 'success');
        } else {
            showBanner('Usuario eliminado exitosamente de la base de datos.', 'success');
        }
    } catch (e) {
        console.error('Error al eliminar usuario:', e);
        showBanner('Error al eliminar usuario del sistema.', 'error');
    }
}

// ==========================================
// MÓDULO: SOLICITUDES PENDIENTES
// ==========================================
window.globalScriptUsers = [];

window.fetchPendingRequests = async function(companyName) {
    if(!companyName) return;
    
    const listEl = document.getElementById('pending-requests-list');
    const countEl = document.getElementById('pending-count');
    const section = document.getElementById('pending-requests-section');
    
    if(!listEl || !countEl || !section) return;

    listEl.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-amber-600">Cargando solicitudes...</td></tr>';
    section.classList.remove('hidden');

    try {
        const res = await fetch(ROLES_SCRIPT_URL);
        window.globalScriptUsers = await res.json();

        // Filter users who requested this company AND are NOT APROBADO
        const pending = window.globalScriptUsers.filter(u => {
            if(!u.email || !u.empresa) return false;
            if(u.estado === 'APROBADO') return false;
            
            const requestedCompany = u.empresa.toLowerCase().trim();
            const thisCompany = companyName.toLowerCase().trim();
            return requestedCompany === thisCompany;
        });

        countEl.textContent = pending.length;

        if(pending.length === 0) {
            listEl.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500 italic">No hay solicitudes pendientes.</td></tr>';
            return;
        }

        listEl.innerHTML = '';
        pending.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="py-2 px-4 font-semibold text-slate-700 text-sm">${u.nombre || 'Sin Nombre'}</td>
                <td class="py-2 px-4 text-slate-500 text-sm">${u.email}</td>
                <td class="py-2 px-4 text-slate-500 text-sm">${u.especialidad || '-'}</td>
                <td class="py-2 px-4 text-right">
                    <button onclick='approvePendingUser("${u.email}", "${u.nombre}", "${u.empresa}")' class="bg-emerald-100 hover:bg-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                        Aprobar
                    </button>
                </td>
            `;
            listEl.appendChild(tr);
        });

    } catch (e) {
        console.error("Error fetching pending requests", e);
        listEl.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">Error cargando solicitudes.</td></tr>';
    }
};

window.approvePendingUser = async function(email, nombre, empresa) {
    try {
        const payload = {
            action: 'saveUser',
            email: email,
            nombre: nombre,
            estado: 'APROBADO',
            rol: 'MIEMBRO',
            empresa: empresa
        };

        const queryParams = new URLSearchParams(payload).toString();

        await fetch(`${ROLES_SCRIPT_URL}?${queryParams}`, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });

        alert(`${nombre} ha sido aprobado exitosamente como MIEMBRO de ${empresa}.`);
        
        // Refresh pending requests list
        if (window.fetchPendingRequests) window.fetchPendingRequests(empresa);
        // Refresh global users map if it was loaded
        if (window.globalUsersMap.size > 0) window.fetchGlobalUsers();

    } catch(e) {
        alert('Error al aprobar el usuario.');
    }
};

// ==========================================
// QUICK APPROVE: from the global users list
// ==========================================
window.quickApproveUser = async function(email, nombre, companyName = '') {
    const u = window.globalUsersMap.get(email);
    if (!u) return;

    // Ask for empresa if not assigned yet
    let empresa = u.companyName && u.companyName !== 'Sin Empresa Asignada' ? u.companyName : '';
    if (!empresa) {
        empresa = prompt(`Asigna una empresa a ${nombre} para aprobar su acceso (deja en blanco para aprobar sin empresa):`, '');
        if (empresa === null) return; // cancelled
        empresa = empresa.trim();
    }

    // Default approved role: MIEMBRO if empresa and not already specified as admin, else INVITADO
    const rol = empresa ? (u.role === 'ADMINISTRADOR_EMPRESA' ? 'ADMINISTRADOR_EMPRESA' : 'MIEMBRO') : (u.role === 'INVITADO' ? 'INVITADO' : (u.role || 'INVITADO'));

    try {
        const payload = {
            action: 'saveUser',
            email: email,
            nombre: u.name,
            rol: rol,
            empresa: empresa,
            especialidad: u.specialty || '',
            estado: 'APROBADO'
        };

        const queryParams = new URLSearchParams(payload).toString();

        await fetch(`${ROLES_SCRIPT_URL}?${queryParams}`, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload)
        });

        window.globalUsersMap.set(email, {
            ...u,
            role: rol,
            companyName: empresa || 'Sin Empresa Asignada',
            estado: 'APROBADO'
        });

        renderGlobalUsers();
        showBanner(`✅ ${nombre} aprobado correctamente${empresa ? ' en ' + empresa : ''}.`, 'success');
    } catch(e) {
        showBanner('❌ Error al aprobar el usuario.', 'error');
    }
};

// ==========================================
// MÓDULO: GESTIÓN GLOBAL DE PROYECTOS Y LICENCIAS
// ==========================================
window.toggleGlobalProjectLicense = (companyId, projectSlug, checked) => {
    const config = window.companyConfigs[companyId];
    if (config && config.projects) {
        const p = config.projects.find(proj => proj.slug === projectSlug);
        if (p) {
            p.hasLicense = checked;
            renderGlobalProjects();
        }
    }
};

// Bind search input once
let globalProjectSearchBound = false;

window.renderGlobalProjects = function() {
    const listEl = document.getElementById('global-projects-list');
    if (!listEl) return;

    if (!globalProjectSearchBound) {
        const searchInput = document.getElementById('global-project-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => renderGlobalProjects());
            globalProjectSearchBound = true;
        }
    }

    const searchVal = (document.getElementById('global-project-search')?.value || '').toLowerCase().trim();

    let totalProjectsCount = 0;
    let activeLicensesCount = 0;

    // Build list of companies with their matching projects
    const activeCompanies = window.empresas.filter(e => !e.deleted);
    
    let html = '';

    activeCompanies.forEach((emp, empIdx) => {
        const config = window.companyConfigs[emp.id] || { projects: [] };
        const projects = config.projects || [];
        
        // Filter projects
        const matchingProjects = projects.filter(p => {
            if (!searchVal) return true;
            const nameMatch = (p.name || '').toLowerCase().includes(searchVal);
            const slugMatch = (p.slug || '').toLowerCase().includes(searchVal);
            const companyMatch = (emp.name || '').toLowerCase().includes(searchVal) || (emp.razonSocial || '').toLowerCase().includes(searchVal);
            return nameMatch || slugMatch || companyMatch;
        });

        if (searchVal && matchingProjects.length === 0) {
            return; // Skip company if searching and no projects match
        }

        // Aggregate statistics
        totalProjectsCount += projects.length;
        activeLicensesCount += projects.filter(p => p.hasLicense !== false).length;

        const companyLicensesCount = projects.filter(p => p.hasLicense !== false).length;
        const basePrice = 115600;
        const subtotal = companyLicensesCount * basePrice;
        const iva = subtotal * 0.19;
        const total = subtotal + iva;

        // Render company card
        html += `
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
            <!-- Header de la Empresa -->
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
                <div class="flex items-center gap-3">
                    <img src="${emp.image || 'https://i.postimg.cc/02mTnnQv/21bd5ee9d2351270615280386caad1f3.jpg'}" class="w-10 h-10 rounded-xl object-cover border border-slate-200" onerror="this.src='https://i.postimg.cc/02mTnnQv/21bd5ee9d2351270615280386caad1f3.jpg'">
                    <div>
                        <h3 class="text-sm font-bold text-slate-800">${emp.razonSocial || emp.name || 'Sin Nombre'}</h3>
                        <p class="text-xs text-slate-500">ID: ${emp.id} &middot; Código: ${emp.code}</p>
                    </div>
                </div>
                <div class="flex flex-wrap items-center gap-4 text-right">
                    <div class="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-left md:text-right">
                        <div class="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Facturación Mensual</div>
                        <div class="text-sm font-black text-blue-900">$${total.toLocaleString('es-CO')} COP</div>
                        <div class="text-[9px] text-blue-600">Subtotal: $${subtotal.toLocaleString('es-CO')} + IVA (19%): $${iva.toLocaleString('es-CO')}</div>
                    </div>
                    <button onclick="switchGlobalView('empresas'); selectEmpresa(${empIdx});" class="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold shadow-sm transition-all flex items-center gap-1">
                        <span class="material-symbols-outlined text-sm">edit</span> Gestionar
                    </button>
                </div>
            </div>

            <!-- Listado de Proyectos de esta Empresa -->
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead>
                        <tr class="text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                            <th class="pb-2 pl-2">Proyecto</th>
                            <th class="pb-2">Slug</th>
                            <th class="pb-2">Estado</th>
                            <th class="pb-2 text-center">Licencia Activa</th>
                            <th class="pb-2 text-right pr-2">Costo (COP)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-100">
                        ${matchingProjects.map(p => {
                            const licensed = p.hasLicense !== false;
                            const projectPrice = licensed ? 115600 : 0;
                            const projectIva = projectPrice * 0.19;
                            const projectTotal = projectPrice + projectIva;

                            return `
                            <tr class="hover:bg-white/60 transition-colors">
                                <td class="py-3 pl-2 font-semibold text-slate-800">${p.name || 'Sin Nombre'}</td>
                                <td class="py-3 font-mono text-[10px] text-slate-500">${p.slug}</td>
                                <td class="py-3">
                                    <span class="px-2 py-0.5 rounded font-bold uppercase text-[9px] tracking-wider ${p.status === 'Activo' ? 'bg-emerald-100 text-emerald-700' : p.status === 'Cerrado' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'}">${p.status}</span>
                                </td>
                                <td class="py-3 text-center">
                                    <input type="checkbox" class="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer h-4 w-4" ${licensed ? 'checked' : ''} onchange="toggleGlobalProjectLicense('${emp.id}', '${p.slug}', this.checked)">
                                </td>
                                <td class="py-3 text-right pr-2 font-bold text-slate-800">
                                    ${licensed ? `$137.564 <span class="text-[9px] text-slate-400 font-normal">($115.600 + IVA)</span>` : '$0'}
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
        `;
    });

    if (!html) {
        html = `
        <div class="text-center py-12 text-slate-500 flex flex-col items-center justify-center">
            <span class="material-symbols-outlined text-4xl mb-2 text-slate-300">search_off</span>
            <p class="font-semibold">No se encontraron proyectos</p>
            <p class="text-xs text-slate-400">Intenta buscar con otros términos o limpia el filtro.</p>
        </div>
        `;
    }

    listEl.innerHTML = html;

    // Update global KPI stats
    const totalProjectsEl = document.getElementById('stat-total-projects');
    const activeLicensesEl = document.getElementById('stat-active-licenses');
    const totalBillingEl = document.getElementById('stat-total-billing');

    const totalBillingBase = activeLicensesCount * 115600;
    const totalBillingIva = totalBillingBase * 0.19;
    const totalBillingTotal = totalBillingBase + totalBillingIva;

    if (totalProjectsEl) totalProjectsEl.textContent = totalProjectsCount;
    if (activeLicensesEl) activeLicensesEl.textContent = activeLicensesCount;
    if (totalBillingEl) {
        totalBillingEl.innerHTML = `
          <div>$${totalBillingTotal.toLocaleString('es-CO')} COP</div>
          <div class="text-[10px] text-slate-400 font-normal mt-0.5">Subtotal: $${totalBillingBase.toLocaleString('es-CO')} + IVA (19%)</div>
        `;
    }
};

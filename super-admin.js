document.addEventListener('DOMContentLoaded', async () => {
  let userRole = 'SUPER_ADMINISTRADOR';
  let userEmail = '';
  try {
    const ua = JSON.parse(localStorage.getItem('userAccount') || sessionStorage.getItem('userAccount') || 'null');
    if (ua) {
        userRole = ua.role;
        userEmail = (ua.username || '').toLowerCase();
    }
  } catch(e) {}

  let empresas = [];
  let superAdmins = [];
  let companyConfigs = {}; // Store configs by emp.id
  let selectedIndex = -1;
  let searchTerm = '';
  
  // Expose to global scope for our new modules
  window.empresas = empresas;
  window.selectedIndex = selectedIndex;
  window.userRole = userRole;

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
    superAdmins: document.getElementById('super-admins-input'),
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
    tratamientoDatos: document.getElementById('emp-tratamientoDatos')
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
      
      const configRes = await fetch(`portal-config.json?t=${ts}`);
      if (configRes.ok) {
        const config = await configRes.json();
        superAdmins = config.superAdmins || ['imagina3ddesign@gmail.com', 'mcmartinezg@unal.edu.co'];
      }
      
      el.superAdmins.value = superAdmins.join(',\n');
      
      if (userRole !== 'SUPER_ADMINISTRADOR') {
          const globalTabs = document.getElementById('global-tabs-container');
          if(globalTabs) globalTabs.classList.add('hidden');
          if(globalTabs) globalTabs.classList.remove('md:flex');
      }
      
      if (userRole === 'ADMINISTRADOR_EMPRESA') {
          // Hide Super Admins section
          document.getElementById('super-admins-input').closest('section').classList.add('hidden');
          // Hide Add/Delete Empresa buttons
          document.getElementById('add-empresa-btn').classList.add('hidden');
          document.getElementById('delete-empresa-btn').classList.add('hidden');
          // Change Title
          const title = document.getElementById('page-title');
          const subtitle = document.getElementById('page-subtitle');
          if (title) title.textContent = 'Gestión de Mi Empresa';
          if (subtitle) subtitle.textContent = 'Administración';
      }

      if (userRole !== 'SUPER_ADMINISTRADOR') {
          const configTabBtn = document.getElementById('tab-btn-configuracion');
          if (configTabBtn) configTabBtn.classList.add('hidden');
      }

      renderList();
    } catch (e) { showBanner('Error cargando datos', 'error'); }
  }

  function renderList() {
    listEl.innerHTML = empresas.map((emp, i) => {
      const matchesSearch = searchTerm === '' || 
        (emp.name && emp.name.toLowerCase().includes(searchTerm)) || 
        (emp.razonSocial && emp.razonSocial.toLowerCase().includes(searchTerm)) || 
        (emp.id && emp.id.toLowerCase().includes(searchTerm));
      
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
    }).join('');    }

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
    selectedIndex = index;
      window.selectedIndex = index;
    const emp = empresas[index];
    
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

    if(window.renderUsersRef) window.renderUsersRef();
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
    if(window.renderUsersRef) window.renderUsersRef();
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

  function renderUsers() {
    window.renderUsersRef = renderUsers;
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
        g = m.empresaUsuario && m.empresaUsuario.trim() !== '' ? m.empresaUsuario.trim() : 'Sin Empresa Asignada';
      } else {
        g = m.especialidad && m.especialidad.trim() !== '' ? m.especialidad.trim() : 'Sin Especialidad Asignada';
      }
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push({ ...m, originalIndex: i });
    });

    const sortedGroups = Object.keys(grouped).sort((a, b) => {
      if (a.startsWith('Sin ')) return 1;
      if (b.startsWith('Sin ')) return -1;
      return a.localeCompare(b);
    });

    let html = '';
    sortedGroups.forEach(g => {
      // Use btoa to create a safe ID for the group even with spaces and special chars
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
        return `
      <div class="border rounded-xl p-4 bg-slate-50 relative group">
        <button onclick="deleteUser(${i})" class="absolute top-4 right-4 text-rose-500 hover:text-rose-700 p-1 opacity-0 group-hover:opacity-100 transition-opacity" title="Eliminar usuario"><span class="material-symbols-outlined text-sm">delete</span></button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">Nombre Completo</span>
            <input type="text" class="w-full text-xs rounded border-slate-200" value="${m.name || ''}" onchange="updateUser(${i}, 'name', this.value)" placeholder="Ej. Juan Pérez">
          </label>
          
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">Correo Electrónico</span>
            <input type="email" class="w-full text-xs rounded border-slate-200" value="${m.email || ''}" onchange="updateUser(${i}, 'email', this.value)" placeholder="usuario@empresa.com">
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">Empresa (Contratista/Firma)</span>
            <input type="text" class="w-full text-xs rounded border-slate-200" value="${m.empresaUsuario || ''}" onchange="updateUser(${i}, 'empresaUsuario', this.value)" placeholder="Ej. Constructora ABC">
          </label>
          
          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">Rol del Sistema</span>
            <select class="w-full text-xs rounded border-slate-200" onchange="updateUser(${i}, 'role', this.value)">
              <option value="INVITADO" ${m.role==='INVITADO'?'selected':''}>INVITADO</option>
              <option value="ADMINISTRADOR_EMPRESA" ${m.role==='ADMINISTRADOR_EMPRESA'?'selected':''}>ADMINISTRADOR_EMPRESA</option>
            </select>
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">Especialidad Técnica</span>
            <select class="w-full text-xs rounded border-slate-200" onchange="updateUser(${i}, 'especialidad', this.value)">
              <option value="">Seleccione especialidad...</option>
              <option value="Ambiental" ${m.especialidad==='Ambiental'?'selected':''}>Ambiental</option>
              <option value="Arquitectura" ${m.especialidad==='Arquitectura'?'selected':''}>Arquitectura</option>
              <option value="BIM" ${m.especialidad==='BIM'?'selected':''}>BIM</option>
              <option value="CCTV" ${m.especialidad==='CCTV'?'selected':''}>CCTV</option>
              <option value="Estructura" ${m.especialidad==='Estructura'?'selected':''}>Estructura</option>
              <option value="Elementos no estructurales" ${m.especialidad==='Elementos no estructurales'?'selected':''}>Elementos no estructurales</option>
              <option value="Suministro" ${m.especialidad==='Suministro'?'selected':''}>Suministro</option>
              <option value="Desagües" ${m.especialidad==='Desagües'?'selected':''}>Desagües</option>
              <option value="Lluvias" ${m.especialidad==='Lluvias'?'selected':''}>Lluvias</option>
              <option value="Gas" ${m.especialidad==='Gas'?'selected':''}>Gas</option>
              <option value="Eléctrico" ${m.especialidad==='Eléctrico'?'selected':''}>Eléctrico</option>
              <option value="Climatización y Ventilación (HVAC)" ${m.especialidad==='Climatización y Ventilación (HVAC)'?'selected':''}>Climatización y Ventilación (HVAC)</option>
              <option value="Vías e Infraestructura" ${m.especialidad==='Vías e Infraestructura'?'selected':''}>Vías e Infraestructura</option>
              <option value="Seguridad humana" ${m.especialidad==='Seguridad humana'?'selected':''}>Seguridad humana</option>
              <option value="Presupuestos" ${m.especialidad==='Presupuestos'?'selected':''}>Presupuestos</option>
              <option value="Propiedad horizontal" ${m.especialidad==='Propiedad horizontal'?'selected':''}>Propiedad horizontal</option>
              <option value="Geotecnia y Suelos" ${m.especialidad==='Geotecnia y Suelos'?'selected':''}>Geotecnia y Suelos</option>
            </select>
          </label>

          <label class="block">
            <span class="mb-1 block text-xs font-semibold text-slate-600">Cargo</span>
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
              <optgroup label="Ingenierias">
                <option value="Diseñador Eléctrico" ${m.cargo==='Diseñador Eléctrico'?'selected':''}>Diseñador Eléctrico</option>
                <option value="Diseñador Estructural" ${m.cargo==='Diseñador Estructural'?'selected':''}>Diseñador Estructural</option>
                <option value="Diseñador Hidrosánitario" ${m.cargo==='Diseñador Hidrosánitario'?'selected':''}>Diseñador Hidrosánitario</option>
                <option value="Diseñador Gas" ${m.cargo==='Diseñador Gas'?'selected':''}>Diseñador Gas</option>
                <option value="Diseñador HVAC" ${m.cargo==='Diseñador HVAC'?'selected':''}>Diseñador HVAC</option>
              </optgroup>
              <optgroup label="Supervisión y Control (Supervisión)">
                <option value="Interventor / Supervisor Técnico" ${m.cargo==='Interventor / Supervisor Técnico'?'selected':''}>Interventor / Supervisor Técnico</option>
                <option value="Inspector de Calidad / Aseguramiento de Calidad (QA/QC)" ${m.cargo==='Inspector de Calidad / Aseguramiento de Calidad (QA/QC)'?'selected':''}>Inspector de Calidad / Aseguramiento de Calidad (QA/QC)</option>
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
                <option value="Residente de Seguridad y Salud en el Trabajo (SST)" ${m.cargo==='Residente de Seguridad y Salud en el Trabajo (SST)'?'selected':''}>Residente de Seguridad y Salud en el Trabajo (SST)</option>
                <option value="Residente Ambiental" ${m.cargo==='Residente Ambiental'?'selected':''}>Residente Ambiental</option>
                <option value="Almacenista de Obra" ${m.cargo==='Almacenista de Obra'?'selected':''}>Almacenista de Obra</option>
                <option value="Administrador de Obra" ${m.cargo==='Administrador de Obra'?'selected':''}>Administrador de Obra</option>
                <option value="Administrador de TI / Sistemas" ${m.cargo==='Administrador de TI / Sistemas'?'selected':''}>Administrador de TI / Sistemas</option>
                <option value="Asesor Jurídico / Gestor de Contratos" ${m.cargo==='Asesor Jurídico / Gestor de Contratos'?'selected':''}>Asesor Jurídico / Gestor de Contratos</option>
              </optgroup>
            </select>
          </label>

        </div>
      </div>
        `;
      }).join('');
      
      html += `</div>`; // Close group div
    });
    
    usersListEl.innerHTML = html;
  }

  window.updateUser = (idx, field, val) => {
    empresas[selectedIndex].members[idx][field] = val;
  };
  
  window.deleteUser = (idx) => {
    if(confirm('¿Eliminar usuario?')) {
      empresas[selectedIndex].members.splice(idx, 1);
      if(window.renderUsersRef) window.renderUsersRef();
    }
  };

  document.getElementById('add-usuario-btn').addEventListener('click', () => {
    if (selectedIndex === -1) return;
    if (!empresas[selectedIndex].members) empresas[selectedIndex].members = [];
    empresas[selectedIndex].members.push({ name: 'Nuevo Usuario', email: '', role: 'INVITADO' });
    if(window.renderUsersRef) window.renderUsersRef();
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
                   <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Nombre de la organización ${p.isOwnProject ? '' : '<span class="text-rose-500">*</span>'}</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="Ej. Constructora Alcabama" value="${p.clientName || ''}" onchange="updateProject('${p.slug}', 'clientName', this.value)" ${p.isOwnProject ? 'disabled' : 'required'} /></label>
                   
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
            
            </div>
          </div>`;
        }
        
        return `
          <div class="border-b border-slate-100 last:border-0 bg-slate-50">
            <div class="grid grid-cols-12 gap-2 p-3 text-sm items-center hover:bg-slate-100 cursor-pointer" onclick="toggleProjectAccordion('${p.slug}')">
              <div class="col-span-4 font-semibold text-slate-800 flex items-center gap-2">
                  <span class="material-symbols-outlined text-slate-400 text-lg transition-transform ${isOpen ? 'rotate-180' : ''}">expand_more</span>
                  ${p.name || p.title || 'Proyecto'}
              </div>
              <div class="col-span-3 font-mono text-[10px] text-slate-500 truncate" title="${p.slug}">${p.slug}</div>
              <div class="col-span-2">
                  <span class="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider ${p.status==='Activo'?'bg-emerald-100 text-emerald-700':p.status==='Cerrado'?'bg-rose-100 text-rose-700':'bg-slate-200 text-slate-700'}">${p.status}</span>
              </div>
              <div class="col-span-3 text-right flex justify-end gap-2" onclick="event.stopPropagation()">
                <button onclick="deleteProject('${p.slug}')" class="text-rose-500 hover:text-rose-700 p-1 bg-white border border-rose-200 rounded shadow-sm hover:shadow"><span class="material-symbols-outlined text-sm">delete</span></button>
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
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Eyebrow mapa</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.landing?.map?.eyebrow || ''}" onchange="updateProjectDeepMap('${p.slug}', 'eyebrow', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Nombre ciudad visible</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.landing?.map?.cityLabel || ''}" onchange="updateProjectDeepMap('${p.slug}', 'cityLabel', this.value)" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Zoom del mapa</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="1" value="${p.landing?.map?.zoom || 15}" onchange="updateProjectDeepMap('${p.slug}', 'zoom', parseFloat(this.value))" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Latitud</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" value="${p.landing?.map?.lat || 4.60971}" onchange="updateProjectDeepMap('${p.slug}', 'lat', parseFloat(this.value))" /></label>
                <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Longitud</span><input class="w-full text-xs rounded-xl border-slate-200" type="number" step="any" value="${p.landing?.map?.lng || -74.08175}" onchange="updateProjectDeepMap('${p.slug}', 'lng', parseFloat(this.value))" /></label>
                <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">Actualiza las coordenadas para ajustar la visualización del mapa en la landing.</div>
                <label class="block md:col-span-2 xl:col-span-3"><span class="mb-2 block text-sm font-semibold text-slate-700">Descripción de ciudad</span><textarea class="w-full text-xs rounded-2xl border-slate-200" rows="3" onchange="updateProjectDeepMap('${p.slug}', 'description', this.value)">${p.landing?.map?.description || ''}</textarea></label>
                <label class="block md:col-span-2 xl:col-span-3"><span class="mb-2 block text-sm font-semibold text-slate-700">Dirección</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" value="${p.landing?.map?.address || ''}" onchange="updateProjectDeepMap('${p.slug}', 'address', this.value)" /></label>
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
                  <button onclick="deleteProject('${p.slug}')" class="text-rose-500 hover:text-rose-700 p-1 bg-white border border-rose-200 rounded shadow-sm hover:shadow"><span class="material-symbols-outlined text-sm">delete</span></button>
                </div>
              </div>
              ${contentConfig}
            </div>
          `;
        }).join('');
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
      if (field === 'country' || field === 'city') {
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
      landing: { enabled: true, title: 'NUEVO PROYECTO', map: { lat: 4.60971, lng: -74.08175, zoom: 15 } }
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

  document.getElementById('delete-empresa-btn').addEventListener('click', () => {
    if(confirm('¿Está seguro de eliminar esta empresa? Esta acción no se puede deshacer.')) {
      empresas.splice(selectedIndex, 1);
      selectedIndex = -1;
      editorEl.classList.add('hidden');
      renderList();
    }
  });

  // Auto-save to memory on input
  Object.keys(el).forEach(key => {
    el[key].addEventListener('input', () => {
      if (key === 'superAdmins') return;
      if (selectedIndex === -1) return;
      const emp = empresas[selectedIndex];
      
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
      token = prompt('Ingresa tu Personal Access Token (PAT) de GitHub para publicar directamente en el repositorio:');
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

    showBanner('Sincronizando con GitHub, por favor espere...', 'info');
    
    // Save super admins to portal-config
    let portalConfigStr = '';
    try {
      const res = await fetch(`portal-config.json?t=${Date.now()}`);
      if (res.ok) {
        const config = await res.json();
        config.superAdmins = el.superAdmins.value.split(',').map(s=>s.trim()).filter(Boolean);
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
      const empJson = JSON.stringify(empresas, null, 2) + '\n';
      await pushFile('empresas.json', empJson);
      await pushFile('docs/empresas.json', empJson); // if docs exists
      
      if (portalConfigStr) {
        await pushFile('portal-config.json', portalConfigStr);
        await pushFile('docs/portal-config.json', portalConfigStr);
      }

      // Sincronizar todos los archivos config-*.json modificados
      for (const [empId, configData] of Object.entries(companyConfigs)) {
        const emp = empresas.find(e => e.id === empId);
        if (emp) {
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

      showBanner('✅ Todos los datos se han publicado exitosamente en la nube.', 'success');
    } catch(e) {
      showBanner('❌ ' + e.message, 'error');
    }
  });

  loadData();
});




// ==========================================
// MÓDULO: DIRECTORIO GLOBAL DE USUARIOS (Google Sheets Single Source of Truth)
// ==========================================
window.globalUsersMap = new Map();
window.currentGlobalUserEmail = null;
const ROLES_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx266o-ea0OAT-xE_9kKSKChRk7MJo0sthjwWI7WUCbFzq3Y578sbD8HgZpWSb7v8H8Fw/exec';

window.switchGlobalView = function(viewName) {
    const btnEmpresas = document.getElementById('tab-empresas');
    const btnUsuarios = document.getElementById('tab-usuarios');
    const vEmpresas = document.getElementById('empresas-view');
    const vUsuarios = document.getElementById('usuarios-view');

    if (viewName === 'empresas') {
        btnEmpresas.classList.replace('text-slate-500', 'text-slate-800');
        btnEmpresas.classList.replace('hover:text-slate-700', 'bg-white');
        btnEmpresas.classList.add('shadow-sm');

        btnUsuarios.classList.replace('text-slate-800', 'text-slate-500');
        btnUsuarios.classList.replace('bg-white', 'hover:text-slate-700');
        btnUsuarios.classList.remove('shadow-sm');

        vUsuarios.classList.add('hidden');
        vEmpresas.classList.remove('hidden');
    } else {
        btnUsuarios.classList.replace('text-slate-500', 'text-slate-800');
        btnUsuarios.classList.replace('hover:text-slate-700', 'bg-white');
        btnUsuarios.classList.add('shadow-sm');

        btnEmpresas.classList.replace('text-slate-800', 'text-slate-500');
        btnEmpresas.classList.replace('bg-white', 'hover:text-slate-700');
        btnEmpresas.classList.remove('shadow-sm');

        vEmpresas.classList.add('hidden');
        vUsuarios.classList.remove('hidden');
        
        if (window.globalUsersMap.size === 0) {
            fetchGlobalUsers();
        } else {
            renderGlobalUsers();
        }
    }
}

window.fetchGlobalUsers = async function() {
    document.getElementById('global-users-loading').classList.remove('hidden');
    document.getElementById('global-users-tbody').innerHTML = '';
    
    try {
        const res = await fetch(ROLES_SCRIPT_URL);
        const scriptUsers = await res.json();
        
        window.globalUsersMap.clear();

        scriptUsers.forEach(u => {
            if(!u.email) return;
            const email = u.email.toLowerCase().trim();
            window.globalUsersMap.set(email, {
                email: email,
                name: u.nombre || u.email.split('@')[0],
                role: u.rol || 'INVITADO',
                companyName: u.empresa || 'Sin Empresa Asignada',
                specialty: u.especialidad || '',
                cargo: u.cargo || '',
                estado: u.estado || 'PENDIENTE'
            });
        });

        renderGlobalUsers();

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
        else if(u.role === 'ADMINISTRADOR_EMPRESA') roleStyle = 'bg-blue-100 text-blue-700';
        else if(u.role === 'EDITOR') roleStyle = 'bg-emerald-100 text-emerald-700';
        
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
                <button onclick='openEditUserModal("${u.email}")' class="text-slate-400 hover:text-blue-600 transition-colors p-1.5 rounded-lg hover:bg-blue-50">
                    <span class="material-symbols-outlined text-[20px]">edit</span>
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

window.openEditUserModal = function(email) {
    window.currentGlobalUserEmail = email;
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
            email: email,
            nombre: name,
            rol: role,
            empresa: companyName,
            especialidad: specialty,
            estado: 'APROBADO'
        };

        const res = await fetch(ROLES_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
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
            email: email,
            estado: 'APROBADO',
            rol: 'VISOR',
            empresa: empresa
        };

        await fetch(ROLES_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        alert(`${nombre} ha sido aprobado exitosamente.`);
        
        // Refresh pending requests list
        if (window.fetchPendingRequests) window.fetchPendingRequests(empresa);
        // Refresh global users map if it was loaded
        if (window.globalUsersMap.size > 0) window.fetchGlobalUsers();

    } catch(e) {
        alert('Error al aprobar el usuario.');
    }
};

const fs = require('fs');
let html = fs.readFileSync('super-admin.html', 'utf8');

const headerRegex = /<header[\s\S]*?<\/header>/;
const correctHeader = `<header class="border-b border-slate-200 bg-white sticky top-0 z-50 shadow-sm">
      <div class="mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div class="flex items-center gap-3 w-full md:w-1/3">
          <a href="empresas.html"
            class="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"><span
              class="material-symbols-outlined">arrow_back</span></a>
          <div>
            <p id="page-subtitle" class="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Súper Administración</p>
            <h1 id="page-title" class="text-xl font-bold text-slate-900">Panel de Control</h1>
          </div>
        </div>
        
        <!-- Pestañas Centrales -->
        <div class="hidden md:flex bg-slate-100 p-1 rounded-xl w-1/3 justify-center">
            <button id="tab-empresas" onclick="switchGlobalView('empresas')" class="px-6 py-2 rounded-lg text-sm font-bold bg-white text-slate-800 shadow-sm transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-sm">domain</span> Empresas
            </button>
            <button id="tab-usuarios" onclick="switchGlobalView('usuarios')" class="px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-700 transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-sm">group</span> Usuarios
            </button>
        </div>

        <div class="w-full md:w-1/3 flex justify-end">
          <button id="publish-github-btn"
            class="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white hover:bg-blue-700 shadow-md">Publicar en
            la Nube</button>
        </div>
      </div>
    </header>`;

html = html.replace(headerRegex, correctHeader);
fs.writeFileSync('super-admin.html', html);
console.log('Fixed header');

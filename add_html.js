const fs = require('fs');
let html = fs.readFileSync('super-admin.html', 'utf8');

const tabBtns = '<button id="tab-btn-proyectos" class="font-bold text-slate-500 hover:text-primary px-2 pb-2 transition-colors">Proyectos</button>\n              <button id="tab-btn-configuracion" class="font-bold text-slate-500 hover:text-primary px-2 pb-2 transition-colors">Configuración</button>';
html = html.replace('<button id="tab-btn-proyectos" class="font-bold text-slate-500 hover:text-primary px-2 pb-2 transition-colors">Proyectos</button>', tabBtns);

const tabContent = `              <div id="tab-content-configuracion" class="hidden">
                <div class="flex justify-between items-center mb-4">
                  <h3 class="text-xl font-bold text-slate-800">Configuración de Proyectos</h3>
                </div>
                <div class="mb-4">
                  <p class="text-xs text-slate-500">Haz clic sobre un proyecto para desplegar sus configuraciones avanzadas (Branding, IFC, Módulos).</p>
                </div>
                <div class="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div class="grid grid-cols-12 gap-2 bg-slate-100 p-3 text-xs font-bold text-slate-600 uppercase tracking-wider border-b">
                    <div class="col-span-4">Nombre</div>
                    <div class=\"col-span-3\">Slug</div>
                    <div class=\"col-span-2\">Estado</div>
                    <div class=\"col-span-3 text-right\">Acciones</div>
                  </div>
                  <div id="configuracion-list-tab" class="divide-y divide-slate-100">
                    <!-- Proyectos Config Injected via JS -->
                  </div>
                </div>
              </div>
`;
html = html.replace('<!-- PROYECTOS TAB -->', tabContent + '\n              <!-- PROYECTOS TAB -->');

fs.writeFileSync('super-admin.html', html, 'utf8');

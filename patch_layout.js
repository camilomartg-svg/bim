const fs = require('fs');

// 1. Fix empresas.html
let eHtml = fs.readFileSync('empresas.html', 'utf8');
eHtml = eHtml.replace(
    '<div id="companies-list" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 px-4">',
    '<div id="companies-list" class="flex flex-wrap justify-center gap-8 lg:gap-12 px-4">'
);
eHtml = eHtml.replace(/<a href="home\.html\?empresa=\$\{c\.id\}" class="card-hover flex-none w-full group transition-transform duration-500 block">/g, '<a href="home.html?empresa=${c.id}" class="card-hover flex-none w-[260px] md:w-[320px] lg:w-[360px] group transition-transform duration-500 block">');
fs.writeFileSync('empresas.html', eHtml);

// 2. Fix home.html config fallback
let hHtml = fs.readFileSync('home.html', 'utf8');
const oldFallback = `                } catch (error) {
                    console.warn('Error al cargar configuración central de red. Usando default...', error);
                    // 2. Fallback final por defecto
                    applyPortalConfig(DEFAULT_PORTAL_CONFIG);
                }`;

const newFallback = `                } catch (error) {
                    console.warn('Error al cargar configuración central de red. Usando default...', error);
                    // 2. Fallback final por defecto
                    if (empresaId) {
                         applyPortalConfig({ ...DEFAULT_PORTAL_CONFIG, projects: [] });
                    } else {
                         applyPortalConfig(DEFAULT_PORTAL_CONFIG);
                    }
                }`;
hHtml = hHtml.replace(oldFallback, newFallback);
fs.writeFileSync('home.html', hHtml);
console.log('Both files fixed');

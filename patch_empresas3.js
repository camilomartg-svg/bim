const fs = require('fs');
let html = fs.readFileSync('empresas.html', 'utf8');

// 1. Modificar Layout a Grid
html = html.replace(
    /<div id="scroll-container" class="w-full flex overflow-x-auto no-scrollbar pb-8 cursor-grab active:cursor-grabbing px-4 max-w-\[95%\] mx-auto">/,
    '<div id="scroll-container" class="w-full max-w-[95%] mx-auto pb-8">'
);
html = html.replace(
    /<div id="companies-list" class="flex gap-8 lg:gap-12 pl-4">/,
    '<div id="companies-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 px-4">'
);

// 2. Remover Drag Logic & Custom Cursor Logic
const dragLogicStart = html.indexOf('// --- Drag to Scroll Logic ---');
if (dragLogicStart !== -1) {
    const endScript = html.indexOf('</script>', dragLogicStart);
    html = html.substring(0, dragLogicStart) + '});\n    ' + html.substring(endScript);
}

// Limpiar HTML de Custom Cursor
html = html.replace(/<!-- Custom DRAG cursor -->\s*<div id="custom-cursor">DRAG<\/div>/, '');

// 3. Fix Image and Config mapping in Javascript
const oldMapping = `                            image: c.logoBase64 || 'https://i.postimg.cc/fbwgkrDd/r-ciien.png',
                            code: (c.name ? c.name.substring(0,3).toUpperCase() : 'BIM'),
                            configUrl: 'portal-config.json'`;

// Create a function string to replace it with dynamic mappings
const newMapping = `                            image: c.logoBase64 || 'https://i.postimg.cc/t4mFvCyb/default-company.jpg',
                            code: (c.name ? c.name.substring(0,3).toUpperCase() : 'BIM'),
                            configUrl: (c.name && c.name.includes('Amarillo')) ? 'config-amarillo.json' : ((c.name && c.name.includes('desarrollada')) ? 'config-empresa3.json' : 'portal-config.json')`;

html = html.replace(new RegExp(oldMapping.replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&'), 'g'), newMapping);

const oldDynamicMapping = `                                image: myComp.logoBase64 || 'https://i.postimg.cc/fbwgkrDd/r-ciien.png',
                                code: (myComp.name ? myComp.name.substring(0,3).toUpperCase() : 'BIM'),
                                configUrl: 'portal-config.json'`;

const newDynamicMapping = `                                image: myComp.logoBase64 || 'https://i.postimg.cc/t4mFvCyb/default-company.jpg',
                                code: (myComp.name ? myComp.name.substring(0,3).toUpperCase() : 'BIM'),
                                configUrl: (myComp.name && myComp.name.includes('Amarillo')) ? 'config-amarillo.json' : ((myComp.name && myComp.name.includes('desarrollada')) ? 'config-empresa3.json' : 'portal-config.json')`;

html = html.replace(new RegExp(oldDynamicMapping.replace(/[.*+?^$()|[\\]\\\\]/g, '\\\\$&'), 'g'), newDynamicMapping);

// Also replace the dynamic NEW company fallback mapping
const fallbackMapping = `                                image: 'https://i.postimg.cc/fbwgkrDd/r-ciien.png',
                                code: 'NEW',
                                configUrl: 'portal-config.json'`;
const newFallbackMapping = `                                image: 'https://i.postimg.cc/t4mFvCyb/default-company.jpg',
                                code: 'NEW',
                                configUrl: 'portal-config.json'`;
html = html.replace(fallbackMapping, newFallbackMapping);


// 4. Implement LocalStorage caching for companies to remove visual loading delay
const cacheLogic = `
            let companies = [];
            
            try {
                const url = 'https://script.google.com/macros/s/AKfycbzdclwrLaL7k30waIlgoWhQMc4toeaomWFeHBXi5HLhnfPPrpHJFIOSveGa_oavtmqV5w/exec';
                
                // --- ADDED CACHE LOGIC TO AVOID LOADING DELAYS ---
                let cachedCompanies = null;
                try {
                    cachedCompanies = JSON.parse(sessionStorage.getItem('cachedCompanies'));
                } catch(e) {}
                
                let allCompanies;
                let users;
                
                if (cachedCompanies) {
                    allCompanies = cachedCompanies.companies;
                    users = cachedCompanies.users;
                    // Fire background fetch silently to update next time
                    Promise.all([
                        fetch(url + '?action=getCompanies'),
                        fetch(url)
                    ]).then(async ([cRes, uRes]) => {
                        const newC = await cRes.json();
                        const newU = await uRes.json();
                        sessionStorage.setItem('cachedCompanies', JSON.stringify({companies: newC, users: newU}));
                    }).catch(console.error);
                } else {
                    // Fetch ALL companies and users concurrently for max speed
                    const [compRes, userRes] = await Promise.all([
                        fetch(url + '?action=getCompanies'),
                        fetch(url)
                    ]);
                    allCompanies = await compRes.json();
                    users = await userRes.json();
                    sessionStorage.setItem('cachedCompanies', JSON.stringify({companies: allCompanies, users: users}));
                }
                // ---------------------------------------------------
`;

html = html.replace(/let companies = \[\];\s*try \{\s*const url = 'https:\/\/script\.google\.com\/macros\/s\/AKfycbzdclwrLaL7k30waIlgoWhQMc4toeaomWFeHBXi5HLhnfPPrpHJFIOSveGa_oavtmqV5w\/exec';\s*\/\/ Fetch ALL companies and users concurrently for max speed\s*const \[compRes, userRes\] = await Promise\.all\(\[\s*fetch\(url \+ '\?action=getCompanies'\),\s*fetch\(url\)\s*\]\);\s*const allCompanies = await compRes\.json\(\);\s*const users = await userRes\.json\(\);/, cacheLogic);

// Write file
fs.writeFileSync('empresas.html', html);
console.log("empresas.html modified successfully!");

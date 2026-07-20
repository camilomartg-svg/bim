const fs = require('fs');
let html = fs.readFileSync('empresas.html', 'utf8');

// 1. Layout
html = html.replace(
    '<div id="scroll-container" class="w-full flex overflow-x-auto no-scrollbar pb-8 cursor-grab active:cursor-grabbing px-4 max-w-[95%] mx-auto">',
    '<div id="scroll-container" class="w-full max-w-[95%] mx-auto pb-8">'
);
html = html.replace(
    '<div id="companies-list" class="flex gap-8 lg:gap-12 pl-4">',
    '<div id="companies-list" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8 px-4">'
);
html = html.replace(/w-\[260px\] md:w-\[320px\] lg:w-\[360px\]/g, 'w-full');

// 2. Drag Logic
const dragStart = html.indexOf('let isDown = false;');
const dragEnd = html.indexOf('</script>', dragStart);
if (dragStart !== -1) {
    html = html.substring(0, dragStart) + '        });\n    ' + html.substring(dragEnd);
}
// Remove custom cursor div
html = html.replace(/<!-- Custom DRAG cursor -->\s*<div id="custom-cursor">DRAG<\/div>/, '');

// 3. Update mappings for config and images
const replacer1 = (str) => {
    return str
        .replace(/'https:\/\/i\.postimg\.cc\/fbwgkrDd\/r-ciien\.png'/g, "'https://i.postimg.cc/t4mFvCyb/default-company.jpg'")
        .replace(/configUrl: 'portal-config.json'/g, "configUrl: (c.name && c.name.includes('Amarillo')) ? 'config-amarillo.json' : ((c.name && c.name.includes('desarrollada')) ? 'config-empresa3.json' : 'portal-config.json')");
}
const replacer2 = (str) => {
    return str
        .replace(/'https:\/\/i\.postimg\.cc\/fbwgkrDd\/r-ciien\.png'/g, "'https://i.postimg.cc/t4mFvCyb/default-company.jpg'")
        .replace(/configUrl: 'portal-config.json'/g, "configUrl: (myComp.name && myComp.name.includes('Amarillo')) ? 'config-amarillo.json' : ((myComp.name && myComp.name.includes('desarrollada')) ? 'config-empresa3.json' : 'portal-config.json')");
}

let mapStart = html.indexOf('companies = uniqueCompanies.map(c => ({');
let mapEnd = html.indexOf('}));', mapStart) + 4;
if (mapStart !== -1) {
    let block1 = html.substring(mapStart, mapEnd);
    html = html.replace(block1, replacer1(block1));
}

let push1Start = html.indexOf('companies.push({');
let push1End = html.indexOf('});', push1Start) + 3;
if (push1Start !== -1) {
    let block2 = html.substring(push1Start, push1End);
    html = html.replace(block2, replacer2(block2));
}

// For the fallback NEW push block
let push2Start = html.indexOf('companies.push({', push1End);
if (push2Start !== -1) {
    let push2End = html.indexOf('});', push2Start) + 3;
    let block3 = html.substring(push2Start, push2End);
    block3 = block3.replace(/'https:\/\/i\.postimg\.cc\/fbwgkrDd\/r-ciien\.png'/g, "'https://i.postimg.cc/t4mFvCyb/default-company.jpg'");
    html = html.replace(html.substring(push2Start, push2End), block3);
}

// 4. Cache
const cacheCode = `
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
                // ---------------------------------------------------`;

const fetchBlock = `                // Fetch ALL companies and users concurrently for max speed
                const [compRes, userRes] = await Promise.all([
                    fetch(url + '?action=getCompanies'),
                    fetch(url)
                ]);
                
                const allCompanies = await compRes.json();
                const users = await userRes.json();`;

html = html.replace(fetchBlock, cacheCode);

fs.writeFileSync('empresas.html', html);
console.log('Success');

const fs = require('fs');

let js = fs.readFileSync('super-admin.js', 'utf8');

const slugStr = '                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Slug (Solo lectura)</span><input class="w-full text-xs rounded-xl border-slate-200 bg-slate-100" type="text" value="${p.slug || \'\'}" readonly disabled /></label>\n';
const homeStr = '                  <label class="block"><span class="mb-2 block text-sm font-semibold text-slate-700">Home personalizado</span><input class="w-full text-xs rounded-xl border-slate-200" type="text" placeholder="Vacío = usar landing automática" value="${p.homeUrl || \'\'}" onchange="updateProject(\'${p.slug}\', \'homeUrl\', this.value)" /></label>\n';

let newJs = js;

// Some string variations might exist due to encoding or spacing.
// Let's use regex to find and remove them.
const slugRegex = /\s*<label class="block"><span[^>]*>Slug \(Solo lectura\)<\/span>.*?<\/label>\s*/;
const homeRegex = /\s*<label class="block"><span[^>]*>Home personalizado<\/span>.*?<\/label>\s*/;

let extractedSlug = "";
let extractedHome = "";

newJs = newJs.replace(slugRegex, (match) => {
    extractedSlug = match;
    return "\n"; // keep a newline so layout doesn't break entirely
});

newJs = newJs.replace(homeRegex, (match) => {
    extractedHome = match;
    return "\n";
});

if (extractedSlug && extractedHome) {
    const sectionToInject = `
<section>
  <h3 class="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Configuración de URLs</h3>
  <div class="mt-4 grid gap-4 md:grid-cols-2">
    ${extractedSlug.trim()}
    ${extractedHome.trim()}
  </div>
</section>
`;

    // We want to inject this at the top of contentConfig
    // Search for contentConfig = `
    const contentConfigRegex = /(contentConfig\s*=\s*`[\s\S]*?<div class="grid gap-6">)/;
    if (contentConfigRegex.test(newJs)) {
        newJs = newJs.replace(contentConfigRegex, (match) => {
            return match + sectionToInject;
        });
        fs.writeFileSync('super-admin.js', newJs, 'utf8');
        console.log("Successfully moved fields!");
    } else {
        console.log("Failed to find contentConfig string.");
    }
} else {
    console.log("Failed to extract one or both fields.", !!extractedSlug, !!extractedHome);
}

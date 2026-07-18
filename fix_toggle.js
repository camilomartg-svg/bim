const fs = require('fs');
let js = fs.readFileSync('super-admin.js', 'utf8');

js = js.replace(
    /window\.toggleProjectAccordion\s*=\s*\(slug\)\s*=>\s*\{\s*window\.openProjectAccordions\[slug\]\s*=\s*!window\.openProjectAccordions\[slug\];\s*renderProjects\(\);\s*\};/,
    "window.toggleProjectAccordion = (slug) => {\n    window.openProjectAccordions[slug] = !window.openProjectAccordions[slug];\n    renderProjects();\n  };\n\n  window.toggleConfigAccordion = (slug) => {\n    window.openConfigAccordions[slug] = !window.openConfigAccordions[slug];\n    renderProjects();\n  };"
);

fs.writeFileSync('super-admin.js', js, 'utf8');

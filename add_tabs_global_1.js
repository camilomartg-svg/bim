const fs = require('fs');
let js = fs.readFileSync('super-admin.js', 'utf8');

// Update tabs initialization
js = js.replace(
    /const tabs = \{\s*btns: \[document\.getElementById\('tab-btn-ficha'\), document\.getElementById\('tab-btn-usuarios'\), document\.getElementById\('tab-btn-proyectos'\)\],\s*contents: \[document\.getElementById\('tab-content-ficha'\), document\.getElementById\('tab-content-usuarios'\), document\.getElementById\('tab-content-proyectos'\)\]\s*\};/,
    `const tabs = {
    btns: [document.getElementById('tab-btn-ficha'), document.getElementById('tab-btn-usuarios'), document.getElementById('tab-btn-proyectos'), document.getElementById('tab-btn-configuracion')],
    contents: [document.getElementById('tab-content-ficha'), document.getElementById('tab-content-usuarios'), document.getElementById('tab-content-proyectos'), document.getElementById('tab-content-configuracion')]
  };`
);

// Add configuracion-list-tab variable
js = js.replace(
    "const projectsListEl = document.getElementById('proyectos-list-tab');",
    "const projectsListEl = document.getElementById('proyectos-list-tab');\n  const configListEl = document.getElementById('configuracion-list-tab');"
);

// Add window.openConfigAccordions
js = js.replace(
    "window.openProjectAccordions = window.openProjectAccordions || {};",
    "window.openProjectAccordions = window.openProjectAccordions || {};\n  window.openConfigAccordions = window.openConfigAccordions || {};"
);

// Add toggleConfigAccordion
js = js.replace(
    "window.toggleProjectAccordion = (slug) => {\n    window.openProjectAccordions[slug] = !window.openProjectAccordions[slug];\n    renderProjects();\n  };",
    "window.toggleProjectAccordion = (slug) => {\n    window.openProjectAccordions[slug] = !window.openProjectAccordions[slug];\n    renderProjects();\n  };\n\n  window.toggleConfigAccordion = (slug) => {\n    window.openConfigAccordions[slug] = !window.openConfigAccordions[slug];\n    renderProjects();\n  };"
);

fs.writeFileSync('super-admin.js', js, 'utf8');

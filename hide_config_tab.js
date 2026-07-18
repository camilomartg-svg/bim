const fs = require('fs');
let js = fs.readFileSync('super-admin.js', 'utf8');

const targetStr = "if (subtitle) subtitle.textContent = 'Administración';\n      }";
const replacement = "if (subtitle) subtitle.textContent = 'Administración';\n      }\n      \n      if (userRole !== 'SUPER_ADMINISTRADOR') {\n          const configTabBtn = document.getElementById('tab-btn-configuracion');\n          if (configTabBtn) configTabBtn.classList.add('hidden');\n      }";

if (js.includes("if (subtitle) subtitle.textContent = 'Administración';\n      }")) {
    js = js.replace(targetStr, replacement);
} else {
    // try different spacing or Windows CRLF
    const targetStr2 = "if (subtitle) subtitle.textContent = 'Administracin';\n      }";
    const searchStr = "if (subtitle) subtitle.textContent = 'Administraci\\xf3n';\r\n      }";
    
    // Better way: use regex to match it
    const regex = /if\s*\(subtitle\)\s*subtitle\.textContent\s*=\s*['"]Administraci[oó]n['"];\s*\}/;
    if (regex.test(js)) {
        js = js.replace(regex, (match) => {
            return match + "\n\n      if (userRole !== 'SUPER_ADMINISTRADOR') {\n          const configTabBtn = document.getElementById('tab-btn-configuracion');\n          if (configTabBtn) configTabBtn.classList.add('hidden');\n      }";
        });
    }
}

fs.writeFileSync('super-admin.js', js, 'utf8');

const fs = require('fs');

const wrongFavicon = 'https://i.postimg.cc/W3trgjZX/FAVICON-NORA-NEGRO.png';
const correctLogo = 'https://i.postimg.cc/tR3YSryT/LOGO-NORA-NEGRO.png';
const faviconTag = '<link rel="icon" type="image/png" href="https://i.postimg.cc/W3trgjZX/FAVICON-NORA-NEGRO.png">';

['index.html', 'home.html', 'super-admin.html'].forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // 1. Revert the accidental logo replacement
    content = content.replace(wrongFavicon, correctLogo);
    content = content.replace(wrongFavicon, correctLogo); // Just in case there were multiple

    // 2. Add the actual favicon link tag to the head if it's not there
    if (!content.includes('rel="icon"')) {
        content = content.replace('<meta charset="utf-8"/>', '<meta charset="utf-8"/>\n    ' + faviconTag);
        content = content.replace('<meta charset="utf-8" />', '<meta charset="utf-8" />\n  ' + faviconTag);
    }
    
    fs.writeFileSync(file, content, 'utf8');
});

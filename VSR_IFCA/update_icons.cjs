const fs = require('fs');
const path = require('path');

const map = {
  'fa-arrow-left': 'arrow_back',
  'fa-bars': 'menu',
  'fa-moon': 'dark_mode',
  'fa-cube': 'view_in_ar',
  'fa-cubes': 'inventory_2',
  'fa-chevron-down': 'expand_more',
  'fa-compress-arrows-alt': 'fit_screen',
  'fa-eye-slash': 'visibility_off',
  'fa-filter': 'filter_alt',
  'fa-eye': 'visibility',
  'fa-ruler': 'straighten',
  'fa-vector-square': 'architecture',
  'fa-bezier-curve': 'polyline',
  'fa-chart-line': 'trending_up',
  'fa-location-crosshairs': 'my_location',
  'fa-trash': 'delete',
  'fa-border-all': 'grid_on',
  'fa-scissors': 'content_cut',
  'fa-calculator': 'calculate',
  'fa-tasks': 'task_alt',
  'fa-circle-info': 'info',
  'fa-terminal': 'terminal',
  'fa-file-csv': 'description',
  'fa-xmark': 'close',
  'fa-tags': 'sell',
  'fa-camera': 'photo_camera',
  'fa-plus-circle': 'add_circle',
  'fa-upload': 'upload'
};

const indexPath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Replace stylesheet link
html = html.replace(
  '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">',
  '<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" rel="stylesheet" />\n    <style>\n      .material-symbols-outlined {\n        font-variation-settings:\n        \'FILL\' 0,\n        \'wght\' 400,\n        \'GRAD\' 0,\n        \'opsz\' 24;\n        font-size: 20px;\n        display: inline-flex;\n        vertical-align: middle;\n      }\n    </style>'
);

// Replace icons
for (const [fa, mat] of Object.entries(map)) {
  const regex = new RegExp(`<i class="fa-solid ${fa}"><\\/i>`, 'g');
  html = html.replace(regex, `<span class="material-symbols-outlined">${mat}</span>`);
  
  // also handle cases where there might be extra classes or style
  const regex2 = new RegExp(`<i class="fa-solid ${fa}"([^>]*)><\\/i>`, 'g');
  html = html.replace(regex2, `<span class="material-symbols-outlined"$1>${mat}</span>`);
}

fs.writeFileSync(indexPath, html);
console.log('Icons updated successfully.');

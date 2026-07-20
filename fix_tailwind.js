const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      if (!file.includes('node_modules') && !file.includes('.git') && !file.includes('.gemini')) {
        results = results.concat(walk(file));
      }
    } else {
      results.push(file);
    }
  });
  return results;
}

const noraGrayPalette = `nora: {
          DEFAULT: '#171717',
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },`;

const files = walk(__dirname);

files.forEach(file => {
  if (file.endsWith('tailwind.config.js')) {
    let content = fs.readFileSync(file, 'utf8');
    
    // regex to match the nora color object
    const regex = /nora:\s*\{[\s\S]*?\},/g;
    if (regex.test(content)) {
      content = content.replace(regex, noraGrayPalette);
      fs.writeFileSync(file, content, 'utf8');
      console.log('Fixed nora palette in ' + file);
    }
  }
});

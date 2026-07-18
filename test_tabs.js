const fs = require('fs');
let js = fs.readFileSync('super-admin.js', 'utf8');
const search = '        return `\\n          <div class="border-b border-slate-100 last:border-0 bg-slate-50">';
const replaceEnd = js.indexOf(search);
console.log('exact replaceEnd:', replaceEnd);

const alternative = '        return `';
console.log('alternative index:', js.indexOf(alternative, 27743));

if (replaceEnd === -1) {
    const fallback = js.substring(27743, 27743 + 35000);
    const returnIdx = fallback.indexOf('        return `');
    console.log("Found return at relative idx:", returnIdx);
    console.log("Surrounding context:");
    console.log(fallback.substring(returnIdx, returnIdx + 100));
}

const fs = require('fs');

let content = fs.readFileSync('super-admin.html', 'utf8');

content = content.replace(
  'class="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4"',
  'class="mx-auto flex w-full items-center justify-between gap-4 px-4 py-4 md:px-8"'
);

content = content.replace(
  'class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6"',
  'class="mx-auto flex w-full flex-col gap-6 px-4 py-6 md:px-8"'
);

fs.writeFileSync('super-admin.html', content, 'utf8');

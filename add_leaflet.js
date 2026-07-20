const fs = require('fs');

let html = fs.readFileSync('super-admin.html', 'utf8');

const leafletTags = `
  <!-- Leaflet for maps -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>`;

html = html.replace('<style>', leafletTags);

fs.writeFileSync('super-admin.html', html, 'utf8');

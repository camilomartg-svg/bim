const fs = require('fs');
let html = fs.readFileSync('google_script.js', 'utf8');

const replacement = `    if (data.action === 'createUserAndCompany') {
      let companySheet = doc.getSheetByName('Empresas');
      if (!companySheet) {
        companySheet = doc.insertSheet('Empresas');
        companySheet.appendRow(['fecha', 'id', 'name', 'legalName', 'type', 'website', 'email', 'phone', 'country', 'state', 'city', 'zip', 'address', 'sectors', 'specialties', 'logoBase64']);
      }
      companySheet.appendRow([
        fecha,
        'empresa-' + Date.now(),
        data.companyData.name,
        data.companyData.legalName,
        data.companyData.type,
        data.companyData.website || '',
        data.companyData.email || '',
        data.companyData.phone || '',
        data.companyData.country,
        data.companyData.state || '',
        data.companyData.city,
        data.companyData.zip || '',
        data.companyData.address || '',
        data.companyData.sectors || '',
        data.companyData.specialties || '',
        data.companyData.logoBase64 || ''
      ]);
      
      let userSheet = doc.getSheetByName('Usuarios');
      if (!userSheet) {
        userSheet = doc.insertSheet('Usuarios');
        userSheet.appendRow(['fecha', 'nombre', 'email', 'telefono', 'empresa', 'especialidad', 'cargo', 'rol', 'estado']);
      }
      userSheet.appendRow([
        fecha,
        data.userData.nombre || '',
        data.userData.email,
        data.userData.telefono || '',
        data.userData.empresa || '',
        data.userData.especialidad || '',
        data.userData.cargo || '',
        data.userData.rol || 'INVITADO',
        data.userData.estado || 'PENDIENTE'
      ]);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Empresa y usuario creados exitosamente" })).setMimeType(ContentService.MimeType.JSON);
    } else if (data.action === 'createCompany') {`;

html = html.replace(/if \(data\.action === 'createCompany'\) \{/, replacement);
fs.writeFileSync('google_script.js', html);
console.log('patched google_script.js');

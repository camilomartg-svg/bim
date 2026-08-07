// =========================================================================
// SCRIPT DE GOOGLE APPS SCRIPT PARA NORA (USUARIOS Y EMPRESAS + GOOGLE DRIVE)
// =========================================================================

const DRIVE_ROOT_FOLDER_ID = "1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H";
const SPREADSHEET_ID = "1OczWRlaefMY5RQon8K3va91H8TInJlp9RuBJeTPLiiA";

const COMPANY_HEADERS = ['fecha', 'id', 'name', 'legalName', 'type', 'website', 'email', 'phone', 'country', 'state', 'city', 'zip', 'address', 'sectors', 'specialties', 'logoBase64', 'code', 'driveFolderId'];
const USER_HEADERS = ['fecha', 'nombre', 'email', 'telefono', 'empresa', 'especialidad', 'cargo', 'rol', 'estado'];

function ensureHeaders(sheet, expectedHeaders) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(expectedHeaders);
    return;
  }
  const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const headersToAdd = [];
  expectedHeaders.forEach(h => {
    if (existingHeaders.indexOf(h) === -1) {
      headersToAdd.push(h);
    }
  });
  if (headersToAdd.length > 0) {
    sheet.getRange(1, existingHeaders.length + 1, 1, headersToAdd.length).setValues([headersToAdd]);
  }
}

function getOrCreateFolder(parentFolder, name) {
  const folders = parentFolder.getFoldersByName(name);
  if (folders.hasNext()) {
    return folders.next();
  }
  return parentFolder.createFolder(name);
}

function findProjectFolder(parentFolder, slug, name, driveFolderName) {
  const folders = parentFolder.getFolders();
  const list = [];
  while (folders.hasNext()) {
    const f = folders.next();
    const fName = f.getName().trim();
    // 1. Check if name contains the unique slug in brackets/parentheses or exactly
    if (fName.includes("[" + slug + "]") || fName.includes("(" + slug + ")") || fName === slug) {
      return f;
    }
    list.push(f);
  }
  
  // 2. Fallback: exact match on name or driveFolderName (case insensitive)
  const cleanName = String(name || '').trim().toLowerCase();
  const cleanDFN = String(driveFolderName || '').trim().toLowerCase();
  
  for (let i = 0; i < list.length; i++) {
    const fName = list[i].getName().trim().toLowerCase();
    // Do not match generic names to avoid wrong association
    if (cleanName && fName === cleanName && cleanName !== 'nuevo proyecto' && cleanName !== 'sin nombre') {
      return list[i];
    }
    if (cleanDFN && fName === cleanDFN && cleanDFN !== 'nuevo proyecto' && cleanDFN !== 'sin nombre') {
      return list[i];
    }
  }
  
  return null;
}

function findProjectFolderRecursively(parentFolder, slug, driveFolderName) {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  const cleanDFN = String(driveFolderName || '').trim().toLowerCase();
  
  // 1. First pass: try to find a folder matching/containing the slug in the current folder
  const subFolders = parentFolder.getFolders();
  const list = [];
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    const name = sub.getName().trim().toLowerCase();
    if (cleanSlug && (name.includes("[" + cleanSlug + "]") || name.includes("(" + cleanSlug + ")") || name === cleanSlug)) {
      return sub;
    }
    list.push(sub);
  }
  
  // 2. Second pass: check for exact match on driveFolderName, but IGNORE generic names like 'nuevo proyecto'
  if (cleanDFN && cleanDFN !== 'nuevo proyecto' && cleanDFN !== 'sin nombre') {
    for (let i = 0; i < list.length; i++) {
      const name = list[i].getName().trim().toLowerCase();
      if (name === cleanDFN) {
        return list[i];
      }
    }
  }
  
  // 3. Third pass: recurse into subfolders
  for (let i = 0; i < list.length; i++) {
    const found = findProjectFolderRecursively(list[i], slug, driveFolderName);
    if (found) return found;
  }
  
  return null;
}

function doPost(e) {
  try {
    let data = null;
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = null;
      }
    }
    
    let action = '';
    if (data && data.action) action = String(data.action).trim();
    if (!action && e && e.parameter && e.parameter.action) action = String(e.parameter.action).trim();

    const callback = String(e && e.parameter && e.parameter.callback || '').trim();

    if (action === 'list') {
      return output_(listModels_(e, data), callback);
    }
    if (action === 'chunk') {
      return output_(chunkFile_(e, data), callback);
    }
    if (action === 'text') {
      return output_(textFile_(e, data), callback);
    }
    if (action === 'uploadFile') {
      return output_(uploadFile_(e, data), callback);
    }

    const doc = SpreadsheetApp.openById(SPREADSHEET_ID);
    const fecha = new Date().toISOString();

    if (data && data.action === 'createUserAndCompany') {
      let companySheet = doc.getSheetByName('Empresas');
      if (!companySheet) {
        companySheet = doc.insertSheet('Empresas');
      }
      ensureHeaders(companySheet, COMPANY_HEADERS);
      
      const companyId = 'empresa-' + Date.now();
      
      // Auto-generate code
      let name = data.companyData.name || "Nueva Empresa";
      const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      let code = cleanName.substring(0, 3);
      if (code.length < 3) {
        code = (code + "EMP").substring(0, 3);
      }
      
      // Create Google Drive Folder
      let driveFolderId = "";
      try {
        const rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
        const folderName = `${code} - ${name}`;
        const folder = getOrCreateFolder(rootFolder, folderName);
        driveFolderId = folder.getId();
      } catch (err) {
        Logger.log("Error creating Drive folder: " + err);
      }

      // Map values to expected headers
      const headers = companySheet.getRange(1, 1, 1, companySheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const row = new Array(headers.length).fill("");
      
      const setVal = (headerName, value) => {
        const idx = headers.indexOf(headerName);
        if (idx !== -1) row[idx] = value;
      };
      
      setVal('fecha', fecha);
      setVal('id', companyId);
      setVal('name', name);
      setVal('legalName', data.companyData.legalName || name);
      setVal('type', data.companyData.type || '');
      setVal('website', data.companyData.website || '');
      setVal('email', data.companyData.email || '');
      setVal('phone', data.companyData.phone || '');
      setVal('country', data.companyData.country || '');
      setVal('state', data.companyData.state || '');
      setVal('city', data.companyData.city || '');
      setVal('zip', data.companyData.zip || '');
      setVal('address', data.companyData.address || '');
      setVal('sectors', Array.isArray(data.companyData.sectors) ? data.companyData.sectors.join(', ') : (data.companyData.sectors || ''));
      setVal('specialties', Array.isArray(data.companyData.specialties) ? data.companyData.specialties.join(', ') : (data.companyData.specialties || ''));
      setVal('logoBase64', data.companyData.logoBase64 || '');
      setVal('code', code);
      setVal('driveFolderId', driveFolderId);
      
      companySheet.appendRow(row);
      
      let userSheet = doc.getSheetByName('Usuarios');
      if (!userSheet) {
        userSheet = doc.insertSheet('Usuarios');
      }
      ensureHeaders(userSheet, USER_HEADERS);
      
      const uHeaders = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const uRow = new Array(uHeaders.length).fill("");
      const setUVal = (headerName, value) => {
        const idx = uHeaders.indexOf(headerName);
        if (idx !== -1) uRow[idx] = value;
      };
      
      setUVal('fecha', fecha);
      setUVal('nombre', data.userData.nombre || '');
      setUVal('email', data.userData.email);
      setUVal('telefono', data.userData.telefono || '');
      setUVal('empresa', data.userData.empresa || '');
      setUVal('especialidad', data.userData.especialidad || '');
      setUVal('cargo', data.userData.cargo || '');
      setUVal('rol', data.userData.rol || 'INVITADO');
      setUVal('estado', data.userData.estado || 'PENDIENTE');
      
      userSheet.appendRow(uRow);
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Empresa y usuario creados exitosamente",
        driveFolderId: driveFolderId,
        code: code
      })).setMimeType(ContentService.MimeType.JSON);

    } else if (data.action === 'createCompany') {
      let companySheet = doc.getSheetByName('Empresas');
      if (!companySheet) {
        companySheet = doc.insertSheet('Empresas');
      }
      ensureHeaders(companySheet, COMPANY_HEADERS);
      
      let name = data.name || "Nueva Empresa";
      const cleanName = name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      let code = cleanName.substring(0, 3);
      if (code.length < 3) {
        code = (code + "EMP").substring(0, 3);
      }
      
      let driveFolderId = "";
      try {
        const rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
        const folderName = `${code} - ${name}`;
        const folder = getOrCreateFolder(rootFolder, folderName);
        driveFolderId = folder.getId();
      } catch (err) {
        Logger.log("Error creating Drive folder: " + err);
      }
      
      const headers = companySheet.getRange(1, 1, 1, companySheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const row = new Array(headers.length).fill("");
      const setVal = (headerName, value) => {
        const idx = headers.indexOf(headerName);
        if (idx !== -1) row[idx] = value;
      };
      
      setVal('fecha', fecha);
      setVal('id', 'empresa-' + Date.now());
      setVal('name', name);
      setVal('legalName', data.legalName || name);
      setVal('type', data.type || '');
      setVal('website', data.website || '');
      setVal('email', data.email || '');
      setVal('phone', data.phone || '');
      setVal('country', data.country || '');
      setVal('state', data.state || '');
      setVal('city', data.city || '');
      setVal('zip', data.zip || '');
      setVal('address', data.address || '');
      setVal('sectors', Array.isArray(data.sectors) ? data.sectors.join(', ') : (data.sectors || ''));
      setVal('specialties', Array.isArray(data.specialties) ? data.specialties.join(', ') : (data.specialties || ''));
      setVal('logoBase64', data.logoBase64 || '');
      setVal('code', code);
      setVal('driveFolderId', driveFolderId);
      
      companySheet.appendRow(row);
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Empresa creada exitosamente",
        driveFolderId: driveFolderId,
        code: code
      })).setMimeType(ContentService.MimeType.JSON);
      
    } else if (data.action === 'syncDriveFolders') {
      const rootFolder = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
      const companySheet = doc.getSheetByName('Empresas');
      if (companySheet) {
        ensureHeaders(companySheet, COMPANY_HEADERS);
      }
      
      const responseFolders = {};
      const sheetData = companySheet ? companySheet.getDataRange().getValues() : [];
      const headers = sheetData.length > 0 ? sheetData[0].map(h => String(h).trim()) : [];
      const idColIdx = headers.indexOf('id');
      const codeColIdx = headers.indexOf('code');
      const folderColIdx = headers.indexOf('driveFolderId');
      
      const requestedCompanies = data.companies || [];
      
      requestedCompanies.forEach(comp => {
        let code = comp.code || '000';
        let name = comp.name || 'Sin Nombre';
        
        // 1. Get or create company folder
        let companyFolder = null;
        if (comp.driveFolderId) {
          try {
            companyFolder = DriveApp.getFolderById(comp.driveFolderId);
          } catch (e) {
            Logger.log("Error getting folder by ID: " + e.toString());
          }
        }
        
        if (!companyFolder) {
          const companyFolderName = `${code} - ${name}`;
          try {
            companyFolder = getOrCreateFolder(rootFolder, companyFolderName);
          } catch (e) {
            responseFolders[comp.id] = {
              error: e.toString()
            };
            return;
          }
        }
        
        const compFolderId = companyFolder.getId();
        responseFolders[comp.id] = {
          driveFolderId: compFolderId,
          projects: {}
        };
        
        // Update Spreadsheet row for this company if spreadsheet exists
        if (companySheet && idColIdx !== -1) {
          for (let r = 1; r < sheetData.length; r++) {
            if (sheetData[r][idColIdx] === comp.id) {
              if (codeColIdx !== -1 && !sheetData[r][codeColIdx]) {
                companySheet.getRange(r + 1, codeColIdx + 1).setValue(code);
              }
              if (folderColIdx !== -1) {
                companySheet.getRange(r + 1, folderColIdx + 1).setValue(compFolderId);
              }
              break;
            }
          }
        }
        
        // 2. Sync projects
        const projects = comp.projects || [];
        projects.forEach(proj => {
          let projFolderId = proj.driveFolderId || "";
          let projFolder = null;
          
          if (projFolderId) {
            // Verify it exists, else recreate
            try {
              projFolder = DriveApp.getFolderById(projFolderId);
              // Ensure name is correct and contains slug
              const expectedName = proj.name + " [" + proj.slug + "]";
              if (projFolder.getName() !== expectedName) {
                projFolder.setName(expectedName);
              }
            } catch (err) {
              projFolder = null;
            }
          }
          
          if (!projFolder) {
            try {
              // Try finding by slug or name in the company folder
              projFolder = findProjectFolder(companyFolder, proj.slug, proj.name, proj.name);
              if (projFolder) {
                const expectedName = proj.name + " [" + proj.slug + "]";
                if (projFolder.getName() !== expectedName) {
                  projFolder.setName(expectedName);
                }
              } else {
                // Create folder with unique format
                const folderName = proj.name + " [" + proj.slug + "]";
                projFolder = getOrCreateFolder(companyFolder, folderName);
              }
              projFolderId = projFolder.getId();
            } catch (e) {
              responseFolders[comp.id].projects[proj.slug] = "error: " + e.toString();
            }
          }
          
          if (projFolderId) {
            responseFolders[comp.id].projects[proj.slug] = projFolderId;
          }
        });
      });
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        folders: responseFolders 
      })).setMimeType(ContentService.MimeType.JSON);
      
    } else {
      // Guardar Usuario (Comportamiento por defecto)
      if (!data.email) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "El correo es obligatorio." })).setMimeType(ContentService.MimeType.JSON);
      }
      
      let userSheet = doc.getSheetByName('Usuarios');
      if (!userSheet) {
        userSheet = doc.insertSheet('Usuarios');
      }
      ensureHeaders(userSheet, USER_HEADERS);
      
      const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const row = new Array(headers.length).fill("");
      const setVal = (headerName, value) => {
        const idx = headers.indexOf(headerName);
        if (idx !== -1) row[idx] = value;
      };
      
      setVal('fecha', fecha);
      setVal('nombre', data.nombre || '');
      setVal('email', data.email);
      setVal('telefono', data.telefono || '');
      setVal('empresa', data.empresa || '');
      setVal('especialidad', data.especialidad || '');
      setVal('cargo', data.cargo || '');
      setVal('rol', data.rol || 'INVITADO');
      setVal('estado', data.estado || 'PENDIENTE');
      
      userSheet.appendRow(row);
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Usuario creado exitosamente" })).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || '').trim();
    const callback = String(e && e.parameter && e.parameter.callback || '').trim();

    if (action === 'list') {
      return output_(listModels_(e, null), callback);
    }
    if (action === 'chunk') {
      return output_(chunkFile_(e, null), callback);
    }
    if (action === 'text') {
      return output_(textFile_(e, null), callback);
    }

    const doc = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    if (action === 'getCompanies') {
      const sheet = doc.getSheetByName('Empresas');
      if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
      ensureHeaders(sheet, COMPANY_HEADERS);
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());
      const empresas = [];
      
      for (let i = 1; i < data.length; i++) {
        let obj = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = data[i][j];
        }
        empresas.push(obj);
      }
      return ContentService.createTextOutput(JSON.stringify(empresas)).setMimeType(ContentService.MimeType.JSON);
      
    } else {
      const sheet = doc.getSheetByName('Usuarios');
      if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
      ensureHeaders(sheet, USER_HEADERS);
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim());
      const usuarios = [];
      
      for (let i = 1; i < data.length; i++) {
        let obj = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = data[i][j];
        }
        usuarios.push(obj);
      }
      return ContentService.createTextOutput(JSON.stringify(usuarios)).setMimeType(ContentService.MimeType.JSON);
    }
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

function autorizarDrive() {
  const root = DriveApp.getFolderById("1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H");
  const temp = root.createFolder("TEMPORAL_BORRAR_LUEGO");
  temp.setTrashed(true);
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function findFolderRecursively(parentFolder, targetName) {
  const cleanTarget = String(targetName).trim().toLowerCase();
  
  // Try exact/case-insensitive match in current folder
  const subFolders = parentFolder.getFolders();
  const list = [];
  while (subFolders.hasNext()) {
    const sub = subFolders.next();
    const name = sub.getName().trim().toLowerCase();
    if (name === cleanTarget) {
      return sub;
    }
    list.push(sub);
  }
  
  // Recursively search subfolders
  for (let i = 0; i < list.length; i++) {
    const found = findFolderRecursively(list[i], targetName);
    if (found) return found;
  }
  
  return null;
}

function listModels_(e, body) {
  let folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  if (!folderId) return { error: 'Falta folderId' };
  
  let root = DriveApp.getFolderById(folderId);
  
  // Dynamic resolution if we are at the root level or default
  if (folderId === '1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H' || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
    const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
    const projectSlug = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
    
    let targetFolder = findProjectFolderRecursively(root, projectSlug, driveFolderName);
    
    if (targetFolder) {
      root = targetFolder;
    } else if (driveFolderName || projectSlug) {
      return { models: [], dwgs: [], pdfs: [] };
    }
  }

  const frags = [];
  const jsonByBase = {};
  const dwgs = [];
  const pdfs = [];

  const normalizeBase_ = (name) => String(name || '').trim().toLowerCase();

  const walk_ = (folder, currentRelativePath) => {
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const name = f.getName();
      const lower = String(name).toLowerCase();

      if (lower.endsWith('.frag')) {
        frags.push({ 
          name: name, 
          fragId: f.getId(), 
          folder: currentRelativePath || '',
          lastUpdated: f.getLastUpdated().toISOString()
        });
        continue;
      }

      if (lower.endsWith('.json')) {
        const base = normalizeBase_(name.slice(0, -5));
        jsonByBase[base] = f.getId();
        continue;
      }

      if (lower.endsWith('.dwg') || lower.endsWith('.dxf')) {
        dwgs.push({ 
          name: name, 
          fileId: f.getId(), 
          folder: currentRelativePath || '',
          lastUpdated: f.getLastUpdated().toISOString()
        });
        continue;
      }

      if (lower.endsWith('.pdf')) {
        pdfs.push({ 
          name: name, 
          fileId: f.getId(), 
          folder: currentRelativePath || '',
          lastUpdated: f.getLastUpdated().toISOString()
        });
        continue;
      }
    }

    const sub = folder.getFolders();
    while (sub.hasNext()) {
      const subFolder = sub.next();
      const nextRelativePath = currentRelativePath 
        ? currentRelativePath + '/' + subFolder.getName() 
        : subFolder.getName();
      walk_(subFolder, nextRelativePath);
    }
  };

  walk_(root, '');

  const models = frags
    .map((m) => {
      const base = normalizeBase_(m.name.slice(0, -5));
      const jsonId = jsonByBase[base] || null;
      return { 
        name: m.name, 
        fragId: m.fragId, 
        jsonId: jsonId, 
        folder: m.folder,
        lastUpdated: m.lastUpdated
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

  const sortedDwgs = dwgs.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  const sortedPdfs = pdfs.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

  return { 
    models: models,
    dwgs: sortedDwgs,
    pdfs: sortedPdfs
  };
}

function chunkFile_(e, body) {
  const id = String(((body && body.id) || (e && e.parameter && e.parameter.id) || '') ?? '').trim();
  if (!id) return { error: 'Falta id' };

  const offset = Math.max(0, Number(((body && body.offset) || (e && e.parameter && e.parameter.offset) || 0) ?? 0) || 0);
  const limit = Math.min(
    2 * 1024 * 1024,
    Math.max(1, Number(((body && body.limit) || (e && e.parameter && e.parameter.limit) || (2 * 1024 * 1024)) ?? (2 * 1024 * 1024)) || (2 * 1024 * 1024)),
  );

  const file = DriveApp.getFileById(id);
  const bytes = file.getBlob().getBytes();
  const total = bytes.length;

  const end = Math.min(total, offset + limit);
  const slice = bytes.slice(offset, end);

  const nextOffset = end;
  const done = nextOffset >= total;

  return {
    total: total,
    nextOffset: nextOffset,
    done: done,
    data: Utilities.base64Encode(slice)
  };
}

function textFile_(e, body) {
  const id = String(((body && body.id) || (e && e.parameter && e.parameter.id) || '') ?? '').trim();
  if (!id) return { error: 'Falta id' };

  const file = DriveApp.getFileById(id);
  const text = file.getBlob().getDataAsString('UTF-8');
  return { text: text };
}

function uploadFile_(e, body) {
  let folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  if (!folderId) return { error: 'Falta folderId' };
  
  let root = DriveApp.getFolderById(folderId);
  
  // Dynamic resolution if we are at the root level or default
  if (folderId === '1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H' || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
    const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
    const projectSlug = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
    
    let targetFolder = findProjectFolderRecursively(root, projectSlug, driveFolderName);
    if (targetFolder) {
      root = targetFolder;
    }
  }
  
  const filename = String(((body && body.filename) || (e && e.parameter && e.parameter.filename) || '') ?? '').trim();
  if (!filename) return { error: 'Falta filename' };
  
  // Strip whitespace and newlines from base64 content (browsers can inject them)
  const rawContent = String(((body && body.content) || (e && e.parameter && e.parameter.content) || '') ?? '');
  const content = rawContent.replace(/[\s\n\r]/g, '');
  if (!content) return { error: 'Falta content' };
  
  const contentType = String(((body && body.contentType) || (e && e.parameter && e.parameter.contentType) || 'application/octet-stream') ?? '').trim();
  
  try {
    // Trash existing files with the same name to avoid duplicates
    const existingFiles = root.getFilesByName(filename);
    while (existingFiles.hasNext()) {
      existingFiles.next().setTrashed(true);
    }
    
    // Create new file
    const decoded = Utilities.base64Decode(content);
    const blob = Utilities.newBlob(decoded, contentType, filename);
    const file = root.createFile(blob);
    
    return { status: 'success', fileId: file.getId(), name: file.getName() };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function wipeAndInitDatabase() {
  const doc = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Clear Empresas
  let companySheet = doc.getSheetByName('Empresas');
  if (companySheet) {
    companySheet.clearContents();
    ensureHeaders(companySheet, COMPANY_HEADERS);
  }
  
  // Clear Usuarios and add the two superAdmins
  let userSheet = doc.getSheetByName('Usuarios');
  if (userSheet) {
    userSheet.clearContents();
    ensureHeaders(userSheet, USER_HEADERS);
    
    // Append the two super admins
    const uHeaders = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const fecha = new Date().toISOString();
    
    const admins = [
      { nombre: "Super Administrador", email: "mcmartinezg@unal.edu.co", rol: "SUPER_ADMINISTRADOR", estado: "APROBADO" },
      { nombre: "Super Administrador", email: "imagina3ddesign@gmail.com", rol: "SUPER_ADMINISTRADOR", estado: "APROBADO" }
    ];
    
    admins.forEach(admin => {
      const row = new Array(uHeaders.length).fill("");
      const setVal = (headerName, value) => {
        const idx = uHeaders.indexOf(headerName);
        if (idx !== -1) row[idx] = value;
      };
      setVal('fecha', fecha);
      setVal('nombre', admin.nombre);
      setVal('email', admin.email);
      setVal('rol', admin.rol);
      setVal('estado', admin.estado);
      userSheet.appendRow(row);
    });
  }
  
  Logger.log("Base de datos limpia e inicializada con los Super Administradores.");
}


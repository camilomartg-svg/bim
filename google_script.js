// =========================================================================
// SCRIPT DE GOOGLE APPS SCRIPT PARA NORA (USUARIOS Y EMPRESAS + GOOGLE DRIVE)
// =========================================================================

const DRIVE_ROOT_FOLDER_ID = "1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H";
const SPREADSHEET_ID = "1OczWRlaefMY5RQon8K3va91H8TInJlp9RuBJeTPLiiA";

const COMPANY_HEADERS = ['fecha', 'id', 'name', 'legalName', 'type', 'website', 'email', 'phone', 'country', 'state', 'city', 'zip', 'address', 'sectors', 'specialties', 'logoBase64', 'code', 'driveFolderId'];
const USER_HEADERS = ['fecha', 'nombre', 'email', 'telefono', 'empresa', 'especialidad', 'cargo', 'rol', 'estado'];
const TEAM_HEADERS = ['fecha', 'empresa', 'proyecto', 'nombreEquipo', 'miembros'];
const FILE_STATUS_HEADERS = ['rowId', 'fecha', 'fileId', 'jsonId', 'filename', 'project', 'status', 'changedAt', 'changedBy', 'changedByEmail', 'originalFileId', 'type', 'version', 'comments', 'deliveryTeams'];
const FILE_VERSION_HEADERS = ['versionId', 'fecha', 'fileId', 'jsonId', 'filename', 'project', 'status', 'version', 'comments', 'createdBy', 'createdByEmail', 'originalFileId', 'type', 'isCurrent', 'backupFileId'];

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

function serializeDeliveryTeams_(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    const clean = value.map(function(team) {
      return String(team || '').trim();
    }).filter(Boolean);
    return clean.length ? JSON.stringify(clean) : '';
  }
  const str = String(value || '').trim();
  return str || '';
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
    if (action === 'initResumableUpload') {
      return output_(initResumableUpload_(e, data), callback);
    }
    if (action === 'uploadResumableChunk') {
      return output_(uploadResumableChunk_(e, data), callback);
    }
    if (action === 'deleteFile' || action === 'deleteFiles') {
      return output_(deleteFile_(e, data), callback);
    }
    if (action === 'changeFileStatus') {
      return output_(changeFileStatus_(e, data), callback);
    }
    if (action === 'listStatus') {
      return output_(listStatus_(e, data), callback);
    }
    if (action === 'createVersion') {
      return output_(createVersion_(e, data), callback);
    }
    if (action === 'listVersions') {
      return output_(listVersions_(e, data), callback);
    }
    if (action === 'restoreVersion') {
      return output_(restoreVersion_(e, data), callback);
    }
    if (action === 'wompiWebhook' || (data && data.event === 'transaction.updated')) {
      return output_(handleWompiWebhook_(e, data), callback);
    }

    let doc;
    try {
      doc = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (err) {
      doc = SpreadsheetApp.getActiveSpreadsheet();
    }
    const fecha = new Date().toISOString();

    if (action === 'deleteUser') {
      const email = String((data && data.email) || (e && e.parameter && e.parameter.email) || '').toLowerCase().trim();
      if (!email) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "El correo es obligatorio." })).setMimeType(ContentService.MimeType.JSON);
      }
      
      let userSheet = doc.getSheetByName('Usuarios');
      if (userSheet) {
        ensureHeaders(userSheet, USER_HEADERS);
        const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
        const emailColIdx = headers.map(h => h.toLowerCase()).indexOf('email');
        if (emailColIdx !== -1) {
          const numRows = userSheet.getLastRow();
          if (numRows > 1) {
            const values = userSheet.getRange(2, emailColIdx + 1, numRows - 1, 1).getValues();
            let deletedAny = false;
            for (let i = values.length - 1; i >= 0; i--) {
              if (String(values[i][0]).toLowerCase().trim() === email) {
                userSheet.deleteRow(i + 2);
                deletedAny = true;
              }
            }
            if (deletedAny) {
              return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Usuario eliminado exitosamente" })).setMimeType(ContentService.MimeType.JSON);
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Usuario no encontrado" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'deleteCompany') {
      const companyId = String((data && data.id) || (e && e.parameter && e.parameter.id) || '').trim();
      if (!companyId) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "El ID de la empresa es obligatorio." })).setMimeType(ContentService.MimeType.JSON);
      }
      
      let companySheet = doc.getSheetByName('Empresas');
      if (companySheet) {
        ensureHeaders(companySheet, COMPANY_HEADERS);
        const headers = companySheet.getRange(1, 1, 1, companySheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
        const idColIdx = headers.map(h => h.toLowerCase()).indexOf('id');
        const nameColIdx = headers.map(h => h.toLowerCase()).indexOf('name');
        if (idColIdx !== -1) {
          const numRows = companySheet.getLastRow();
          if (numRows > 1) {
            const values = companySheet.getRange(2, idColIdx + 1, numRows - 1, 1).getValues();
            let companyName = "";
            let rowToDelete = -1;
            for (let i = 0; i < values.length; i++) {
              if (String(values[i][0]).trim() === companyId) {
                rowToDelete = i + 2;
                if (nameColIdx !== -1) {
                  companyName = String(companySheet.getRange(rowToDelete, nameColIdx + 1).getValue()).trim();
                }
                break;
              }
            }
            if (rowToDelete !== -1) {
              companySheet.deleteRow(rowToDelete);
              
              // Also update Users sheet to clear association
              if (companyName) {
                let userSheet = doc.getSheetByName('Usuarios');
                if (userSheet) {
                  ensureHeaders(userSheet, USER_HEADERS);
                  const uHeaders = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
                  const empColIdx = uHeaders.map(h => h.toLowerCase()).indexOf('empresa');
                  if (empColIdx !== -1) {
                    const uNumRows = userSheet.getLastRow();
                    if (uNumRows > 1) {
                      const uValues = userSheet.getRange(2, empColIdx + 1, uNumRows - 1, 1).getValues();
                      for (let j = 0; j < uValues.length; j++) {
                        if (String(uValues[j][0]).trim().toLowerCase() === companyName.toLowerCase()) {
                          userSheet.getRange(j + 2, empColIdx + 1).setValue("");
                        }
                      }
                    }
                  }
                }
              }
              return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Empresa eliminada exitosamente" })).setMimeType(ContentService.MimeType.JSON);
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Empresa no encontrada" })).setMimeType(ContentService.MimeType.JSON);
    }

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
      
      const emailColIdx = uHeaders.indexOf('email');
      let existingRowIdx = -1;
      if (emailColIdx !== -1) {
        const numRows = userSheet.getLastRow();
        if (numRows > 1) {
          const values = userSheet.getRange(2, emailColIdx + 1, numRows - 1, 1).getValues();
          const targetEmail = String(data.userData.email).toLowerCase().trim();
          for (let i = 0; i < values.length; i++) {
            if (String(values[i][0]).toLowerCase().trim() === targetEmail) {
              existingRowIdx = i + 2;
              break;
            }
          }
        }
      }

      if (existingRowIdx !== -1) {
        const rowRange = userSheet.getRange(existingRowIdx, 1, 1, uHeaders.length);
        const currentRow = rowRange.getValues()[0];
        const setValExist = (headerName, value) => {
          const idx = uHeaders.indexOf(headerName);
          if (idx !== -1 && value !== undefined && value !== null && value !== '') {
            currentRow[idx] = value;
          }
        };
        setValExist('nombre', data.userData.nombre);
        setValExist('telefono', data.userData.telefono);
        setValExist('empresa', data.userData.empresa);
        setValExist('especialidad', data.userData.especialidad);
        setValExist('cargo', data.userData.cargo);
        setValExist('rol', data.userData.rol);
        setValExist('estado', data.userData.estado);
        rowRange.setValues([currentRow]);
      } else {
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
      }
      
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
      
    } else if (data && data.action === 'saveTeams') {
      let teamSheet = doc.getSheetByName('EquiposDeTarea');
      if (!teamSheet) {
        teamSheet = doc.insertSheet('EquiposDeTarea');
      }
      ensureHeaders(teamSheet, TEAM_HEADERS);
      
      const targetEmpresa = String(data.empresa || '').trim();
      const targetProyecto = String(data.proyecto || '').trim();
      const teams = Array.isArray(data.teams) ? data.teams : [];
      
      const tHeaders = teamSheet.getRange(1, 1, 1, teamSheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
      const empCol = tHeaders.indexOf('empresa');
      const projCol = tHeaders.indexOf('proyecto');
      
      const numRows = teamSheet.getLastRow();
      if (numRows > 1 && empCol !== -1 && projCol !== -1) {
        const values = teamSheet.getRange(2, 1, numRows - 1, tHeaders.length).getValues();
        for (let i = values.length - 1; i >= 0; i--) {
          const rowEmp = String(values[i][empCol]).trim();
          const rowProj = String(values[i][projCol]).trim();
          if (rowEmp.toLowerCase() === targetEmpresa.toLowerCase() && rowProj.toLowerCase() === targetProyecto.toLowerCase()) {
            teamSheet.deleteRow(i + 2);
          }
        }
      }
      
      teams.forEach(team => {
        const row = new Array(tHeaders.length).fill("");
        const setTVal = (headerName, value) => {
          const idx = tHeaders.indexOf(headerName.toLowerCase());
          if (idx !== -1) row[idx] = value;
        };
        setTVal('fecha', fecha);
        setTVal('empresa', targetEmpresa);
        setTVal('proyecto', targetProyecto);
        setTVal('nombreequipo', team.name || '');
        setTVal('miembros', Array.isArray(team.members) ? team.members.join(', ') : String(team.members || ''));
        teamSheet.appendRow(row);
      });
      
      return ContentService.createTextOutput(JSON.stringify({ 
        status: "success", 
        message: "Equipos de tarea guardados exitosamente",
        count: teams.length 
      })).setMimeType(ContentService.MimeType.JSON);
      
    } else {
      // Guardar Usuario (Comportamiento por defecto)
      const email = String((data && data.email) || (e && e.parameter && e.parameter.email) || '').toLowerCase().trim();
      if (!email) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "El correo es obligatorio." })).setMimeType(ContentService.MimeType.JSON);
      }
      
      let userSheet = doc.getSheetByName('Usuarios');
      if (!userSheet) {
        userSheet = doc.insertSheet('Usuarios');
      }
      ensureHeaders(userSheet, USER_HEADERS);
      
      const headers = userSheet.getRange(1, 1, 1, userSheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
      const lowerHeaders = headers.map(h => h.toLowerCase());
      
      const emailColIdx = lowerHeaders.indexOf('email');
      let existingRowIdx = -1;
      if (emailColIdx !== -1) {
        const numRows = userSheet.getLastRow();
        if (numRows > 1) {
          const values = userSheet.getRange(2, emailColIdx + 1, numRows - 1, 1).getValues();
          for (let i = 0; i < values.length; i++) {
            if (String(values[i][0]).toLowerCase().trim() === email) {
              existingRowIdx = i + 2;
              break;
            }
          }
        }
      }

      const getVal = (field) => {
        return (data && data[field] !== undefined) ? data[field] : (e && e.parameter && e.parameter[field] !== undefined ? e.parameter[field] : '');
      };

      if (existingRowIdx !== -1) {
        const rowRange = userSheet.getRange(existingRowIdx, 1, 1, headers.length);
        const currentRow = rowRange.getValues()[0];
        const setValExist = (headerName, value) => {
          const idx = lowerHeaders.indexOf(headerName.toLowerCase());
          if (idx !== -1 && value !== undefined && value !== null && value !== '') {
            currentRow[idx] = value;
          }
        };
        setValExist('nombre', getVal('nombre'));
        setValExist('telefono', getVal('telefono'));
        setValExist('empresa', getVal('empresa'));
        setValExist('especialidad', getVal('especialidad'));
        setValExist('cargo', getVal('cargo'));
        setValExist('rol', getVal('rol'));
        setValExist('estado', getVal('estado'));
        rowRange.setValues([currentRow]);
      } else {
        const row = new Array(headers.length).fill("");
        const setVal = (headerName, value) => {
          const idx = lowerHeaders.indexOf(headerName.toLowerCase());
          if (idx !== -1) row[idx] = value;
        };
        setVal('fecha', fecha);
        setVal('nombre', getVal('nombre'));
        setVal('email', email);
        setVal('telefono', getVal('telefono'));
        setVal('empresa', getVal('empresa'));
        setVal('especialidad', getVal('especialidad'));
        setVal('cargo', getVal('cargo'));
        setVal('rol', getVal('rol') || 'INVITADO');
        setVal('estado', getVal('estado') || 'PENDIENTE');
        userSheet.appendRow(row);
      }
      
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Usuario guardado exitosamente" })).setMimeType(ContentService.MimeType.JSON);
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
    if (action === 'deleteFile' || action === 'deleteFiles') {
      return output_(deleteFile_(e, null), callback);
    }
    if (action === 'changeFileStatus') {
      return output_(changeFileStatus_(e, null), callback);
    }
    if (action === 'listStatus') {
      return output_(listStatus_(e, null), callback);
    }

    let doc;
    try {
      doc = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (err) {
      doc = SpreadsheetApp.getActiveSpreadsheet();
    }
    
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
      
    } else if (action === 'getTeams') {
      const sheet = doc.getSheetByName('EquiposDeTarea');
      if (!sheet) return ContentService.createTextOutput("[]").setMimeType(ContentService.MimeType.JSON);
      ensureHeaders(sheet, TEAM_HEADERS);
      
      const targetEmpresa = String(e && e.parameter && (e.parameter.empresa || e.parameter.companyId) || '').trim();
      const targetProyecto = String(e && e.parameter && (e.parameter.proyecto || e.parameter.project) || '').trim();
      
      const data = sheet.getDataRange().getValues();
      const headers = data[0].map(h => String(h).trim().toLowerCase());
      const teams = [];
      
      for (let i = 1; i < data.length; i++) {
        let obj = {};
        for (let j = 0; j < headers.length; j++) {
          obj[headers[j]] = data[i][j];
        }
        const rowEmp = String(obj.empresa || '').trim();
        const rowProj = String(obj.proyecto || '').trim();
        
        if ((!targetEmpresa || rowEmp.toLowerCase() === targetEmpresa.toLowerCase()) && (!targetProyecto || rowProj.toLowerCase() === targetProyecto.toLowerCase())) {
          let membersList = [];
          if (obj.miembros) {
            membersList = String(obj.miembros).split(',').map(m => m.trim()).filter(Boolean);
          }
          teams.push({
            name: obj.nombreequipo || '',
            empresa: rowEmp,
            proyecto: rowProj,
            members: membersList,
            fecha: obj.fecha || ''
          });
        }
      }
      return ContentService.createTextOutput(JSON.stringify(teams)).setMimeType(ContentService.MimeType.JSON);
      
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

// Ejecutar una vez desde el editor de Apps Script tras incorporar la carga reanudable.
// Solicita el permiso externo requerido por UrlFetchApp para enviar fragmentos a Drive.
function autorizarCargaReanudable() {
  UrlFetchApp.fetch('https://www.googleapis.com/discovery/v1/apis/drive/v3/rest', {
    method: 'get',
    muteHttpExceptions: true
  });
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
  const allModels = []; // All 3D file types combined

  const normalizeBase_ = (name) => String(name || '').trim().toLowerCase();

  // List of all supported 3D file extensions (case-insensitive)
  const SUPPORTED_EXTENSIONS = [
    '.frag', '.ifc', '.json', '.landxml', '.citygml',
    '.rvt', '.rfa', '.rte', '.pln', '.pla', '.mod',
    '.imodel', '.vwx', '.ndw', '.cyp',
    '.nwc', '.nwf', '.nwd', '.smc',
    '.e57', '.pts', '.xyz', '.las', '.laz',
    '.rcp', '.rcs', '.dwg', '.dxf'
  ];

  const isSupportedFile_ = (filename) => {
    const lower = String(filename || '').toLowerCase();
    return SUPPORTED_EXTENSIONS.some(ext => lower.endsWith(ext));
  };

  const getFileExtension_ = (filename) => {
    const lower = String(filename || '').toLowerCase();
    for (const ext of SUPPORTED_EXTENSIONS) {
      if (lower.endsWith(ext)) return ext;
    }
    return '';
  };

  const walk_ = (folder, currentRelativePath) => {
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const name = f.getName();
      const lower = String(name).toLowerCase();
      const fileId = f.getId();
      const lastUpdated = f.getLastUpdated().toISOString();

      let ownerEmail = '';
      let ownerName = '';
      try {
        const owner = f.getOwner();
        if (owner) {
          ownerEmail = owner.getEmail() || '';
          ownerName = owner.getName() || '';
        }
      } catch (e) {
        // ignore
      }

      if (lower.endsWith('.frag')) {
        frags.push({ 
          name: name, 
          fragId: fileId, 
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
        allModels.push({
          name: name,
          fileId: fileId,
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          extension: '.frag',
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
        continue;
      }

      if (lower.endsWith('.json')) {
        const base = normalizeBase_(name.slice(0, -5));
        jsonByBase[base] = fileId;
        allModels.push({
          name: name,
          fileId: fileId,
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          extension: '.json',
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
        continue;
      }

      if (lower.endsWith('.dwg') || lower.endsWith('.dxf')) {
        dwgs.push({ 
          name: name, 
          fileId: fileId, 
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
        continue;
      }

      if (lower.endsWith('.pdf')) {
        pdfs.push({ 
          name: name, 
          fileId: fileId, 
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
        continue;
      }

      // Check for other supported 3D file types
      if (isSupportedFile_(name)) {
        const ext = getFileExtension_(name);
        allModels.push({
          name: name,
          fileId: fileId,
          folder: currentRelativePath || '',
          lastUpdated: lastUpdated,
          extension: ext,
          ownerEmail: ownerEmail,
          ownerName: ownerName
        });
      }
    }

    const sub = folder.getFolders();
    while (sub.hasNext()) {
      const subFolder = sub.next();
      const sName = subFolder.getName();
      // Skip hidden / internal system directories like .estados, .versiones
      if (sName.startsWith('.')) {
        continue;
      }
      const nextRelativePath = currentRelativePath 
        ? currentRelativePath + '/' + sName 
        : sName;
      walk_(subFolder, nextRelativePath);
    }
  };

  walk_(root, '');

  // Helper to deduplicate files by path + name so only the latest/current active version is returned
  const dedupeByLatest_ = function(list) {
    const map = {};
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = ((item.folder ? item.folder + '/' : '') + String(item.name || '').toLowerCase()).trim();
      if (!map[key] || new Date(item.lastUpdated).getTime() > new Date(map[key].lastUpdated).getTime()) {
        map[key] = item;
      }
    }
    const result = [];
    for (let k in map) {
      if (map.hasOwnProperty(k)) {
        result.push(map[k]);
      }
    }
    return result;
  };

  const uniqueFrags = dedupeByLatest_(frags);
  const uniqueDwgs = dedupeByLatest_(dwgs);
  const uniquePdfs = dedupeByLatest_(pdfs);

  const models = uniqueFrags
    .map((m) => {
      const base = normalizeBase_(m.name.slice(0, -5));
      const jsonId = jsonByBase[base] || null;
      return { 
        name: m.name, 
        fragId: m.fragId, 
        jsonId: jsonId, 
        folder: m.folder,
        lastUpdated: m.lastUpdated,
        ownerEmail: m.ownerEmail,
        ownerName: m.ownerName
      };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

  const sortedDwgs = uniqueDwgs.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  const sortedPdfs = uniquePdfs.sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

  // Deduplicate and format all 3D models for unified display
  const dedupeAllModels_ = function(list) {
    const map = {};
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const key = ((item.folder ? item.folder + '/' : '') + String(item.name || '').toLowerCase()).trim();
      if (!map[key] || new Date(item.lastUpdated).getTime() > new Date(map[key].lastUpdated).getTime()) {
        map[key] = item;
      }
    }
    const result = [];
    for (let k in map) {
      if (map.hasOwnProperty(k)) {
        result.push(map[k]);
      }
    }
    return result;
  };

  const uniqueAllModels = dedupeAllModels_(allModels).sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));
  
  return { 
    models: models,
    dwgs: sortedDwgs,
    pdfs: sortedPdfs,
    // Includes every supported 3D/geospatial/point-cloud source with its Drive id.
    allModels: uniqueAllModels
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

function resolveUploadFolder_(e, body) {
  let folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  if (!folderId) throw new Error('Falta folderId');
  let root = DriveApp.getFolderById(folderId);
  if (folderId === DRIVE_ROOT_FOLDER_ID || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
    const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
    const projectSlug = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
    const targetFolder = findProjectFolderRecursively(root, projectSlug, driveFolderName);
    if (targetFolder) root = targetFolder;
  }
  return root;
}

function initResumableUpload_(e, body) {
  const filename = String((body && body.filename) || '').trim();
  const contentType = String((body && body.contentType) || 'application/octet-stream').trim();
  const totalBytes = Number((body && body.totalBytes) || 0);
  if (!filename || !totalBytes) return { status: 'error', message: 'Faltan nombre o tamaño del archivo.' };

  try {
    const folder = resolveUploadFolder_(e, body);
    const token = ScriptApp.getOAuthToken();
    const response = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + token,
        'X-Upload-Content-Type': contentType,
        'X-Upload-Content-Length': String(totalBytes)
      },
      payload: JSON.stringify({ name: filename, parents: [folder.getId()], mimeType: contentType }),
      muteHttpExceptions: true
    });
    const status = response.getResponseCode();
    const headers = response.getAllHeaders();
    const sessionUrl = headers.Location || headers.location;
    if ((status < 200 || status >= 300) || !sessionUrl) {
      return { status: 'error', message: 'No se pudo iniciar la carga reanudable: ' + status + ' ' + response.getContentText() };
    }
    return { status: 'success', sessionUrl: sessionUrl };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function uploadResumableChunk_(e, body) {
  const sessionUrl = String((body && body.sessionUrl) || '').trim();
  const content = String((body && body.content) || '').replace(/[\s\n\r]/g, '');
  const start = Number((body && body.start) || 0);
  const totalBytes = Number((body && body.totalBytes) || 0);
  const contentType = String((body && body.contentType) || 'application/octet-stream').trim();
  if (!sessionUrl || !content || !totalBytes) return { status: 'error', message: 'Fragmento de carga incompleto.' };

  try {
    const bytes = Utilities.base64Decode(content);
    const end = start + bytes.length - 1;
    const response = UrlFetchApp.fetch(sessionUrl, {
      method: 'put',
      contentType: contentType,
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
        'Content-Range': 'bytes ' + start + '-' + end + '/' + totalBytes
      },
      payload: Utilities.newBlob(bytes, contentType),
      muteHttpExceptions: true
    });
    const code = response.getResponseCode();
    if (code !== 308 && (code < 200 || code >= 300)) {
      return { status: 'error', message: 'Drive rechazó el fragmento: ' + code + ' ' + response.getContentText() };
    }

    const complete = code >= 200 && code < 300;
    let fileId = '';
    if (complete) {
      try { fileId = JSON.parse(response.getContentText()).id || ''; } catch (ignore) {}
      if (fileId) {
        try {
          const targetFolder = resolveUploadFolder_(e, body);
          const existingFiles = targetFolder.getFilesByName(String(body.filename || '').trim());
          while (existingFiles.hasNext()) {
            const extFile = existingFiles.next();
            if (extFile.getId() !== fileId) {
              extFile.setTrashed(true);
            }
          }
        } catch (trashErr) {
          // non-fatal
        }
        try {
          registerFileStatus_(fileId, String(body.jsonId || ''), String(body.filename || ''), String(body.project || ''), 'EN_PROGRESO', String(body.changedBy || ''), String(body.changedByEmail || ''), fileId, String(body.fileType || ''), '', '', body.deliveryTeams);
        } catch (statusErr) {
          // Trash the completed file to avoid orphaning it in Drive
          try {
            DriveApp.getFileById(fileId).setTrashed(true);
          } catch (trashErr) {}
          return { status: 'error', message: 'No se pudo registrar el estado en el Spreadsheet: ' + statusErr.toString() };
        }
      }
    }
    return { status: 'success', complete: complete, nextOffset: end + 1, fileId: fileId };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
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
  
  let newFileId;
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
    newFileId = file.getId();
  } catch (createErr) {
    return { status: 'error', message: 'No se pudo crear el archivo en Drive: ' + createErr.toString() };
  }

  try {
    const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
    const changedBy = String(((body && body.changedBy) || (e && e.parameter && e.parameter.changedBy) || '') ?? '').trim();
    const changedByEmail = String(((body && body.changedByEmail) || (e && e.parameter && e.parameter.changedByEmail) || '') ?? '').trim();
    const fileType = String(((body && body.fileType) || (e && e.parameter && e.parameter.fileType) || '') ?? '').trim();
    const jsonId = String(((body && body.jsonId) || (e && e.parameter && e.parameter.jsonId) || '') ?? '').trim();
    if (project) {
      registerFileStatus_(newFileId, jsonId, filename, project, 'EN_PROGRESO', changedBy, changedByEmail, newFileId, fileType, '', '', body && body.deliveryTeams);
    }
  } catch(statusErr) {
    // Trash the uploaded file to avoid orphaning it in Drive
    try {
      if (newFileId) {
        DriveApp.getFileById(newFileId).setTrashed(true);
      }
    } catch (trashErr) {}
    return { status: 'error', message: 'No se pudo registrar el estado en el Spreadsheet: ' + statusErr.toString() };
  }

  return { status: 'success', fileId: newFileId, name: filename };
}

function registerFileStatus_(fileId, jsonId, filename, project, status, changedBy, changedByEmail, originalFileId, type, version, comments, deliveryTeams) {
  let doc;
  try {
    doc = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    doc = SpreadsheetApp.getActiveSpreadsheet();
  }
  if (!doc) {
    throw new Error("No se pudo abrir la hoja de cálculo de configuración (ID: " + SPREADSHEET_ID + "). Verifica que el script de Google tenga permisos y que la hoja exista.");
  }
  let sheet = doc.getSheetByName('EstadosArchivos');
  if (!sheet) sheet = doc.insertSheet('EstadosArchivos');
  ensureHeaders(sheet, FILE_STATUS_HEADERS);
  const rowId = 'sr-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  const now = new Date().toISOString();
  const rowData = FILE_STATUS_HEADERS.map(function(h) {
    if (h === 'rowId') return rowId;
    if (h === 'fecha') return now;
    if (h === 'fileId') return fileId || '';
    if (h === 'jsonId') return jsonId || '';
    if (h === 'filename') return filename || '';
    if (h === 'project') return project || '';
    if (h === 'status') return status || 'EN_PROGRESO';
    if (h === 'changedAt') return now;
    if (h === 'changedBy') return changedBy || '';
    if (h === 'changedByEmail') return changedByEmail || '';
    if (h === 'originalFileId') return originalFileId || fileId || '';
    if (h === 'type') return type || '';
    if (h === 'version') return version || 'v1.0';
    if (h === 'comments') return comments || '';
    if (h === 'deliveryTeams') return serializeDeliveryTeams_(deliveryTeams);
    return '';
  });
  sheet.appendRow(rowData);
  return rowId;
}

function listStatus_(e, body) {
  const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  let doc;
  try { doc = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (err) { doc = SpreadsheetApp.getActiveSpreadsheet(); }
  const sheet = doc.getSheetByName('EstadosArchivos');
  if (!sheet || sheet.getLastRow() <= 1) return { entries: [] };
  ensureHeaders(sheet, FILE_STATUS_HEADERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const idx = {};
  FILE_STATUS_HEADERS.forEach(function(h) { idx[h] = headers.indexOf(h); });
  const entries = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowProject = String(row[idx['project']] || '').trim();
    if (project && rowProject !== project) continue;
    var changedAt = row[idx['changedAt']];
    entries.push({
      rowId: String(row[idx['rowId']] || '').trim(),
      fileId: String(row[idx['fileId']] || '').trim(),
      jsonId: String(row[idx['jsonId']] || '').trim(),
      filename: String(row[idx['filename']] || '').trim(),
      project: rowProject,
      status: String(row[idx['status']] || 'EN_PROGRESO').trim(),
      changedAt: (changedAt instanceof Date) ? changedAt.toISOString() : String(changedAt || ''),
      changedBy: String(row[idx['changedBy']] || '').trim(),
      changedByEmail: String(row[idx['changedByEmail']] || '').trim(),
      originalFileId: String(row[idx['originalFileId']] || '').trim(),
      type: String(row[idx['type']] || '').trim(),
      version: String(row[idx['version']] || 'v1.0').trim(),
      comments: String(row[idx['comments']] || '').trim(),
      deliveryTeams: String(row[idx['deliveryTeams']] || '').trim()
    });
  }
  return { entries: entries };
}

function changeFileStatus_(e, body) {
  const fileId = String(((body && body.fileId) || (e && e.parameter && e.parameter.fileId) || '') ?? '').trim();
  const jsonId = String(((body && body.jsonId) || (e && e.parameter && e.parameter.jsonId) || '') ?? '').trim();
  const filename = String(((body && body.filename) || (e && e.parameter && e.parameter.filename) || '') ?? '').trim();
  const newStatus = String(((body && body.newStatus) || (e && e.parameter && e.parameter.newStatus) || '') ?? '').trim().toUpperCase();
  const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  var folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
  const originalFileId = String(((body && body.originalFileId) || (e && e.parameter && e.parameter.originalFileId) || fileId) ?? '').trim();
  const type = String(((body && body.type) || (e && e.parameter && e.parameter.type) || '') ?? '').trim();
  const changedBy = String(((body && body.changedBy) || (e && e.parameter && e.parameter.changedBy) || '') ?? '').trim();
  const changedByEmail = String(((body && body.changedByEmail) || (e && e.parameter && e.parameter.changedByEmail) || '') ?? '').trim();
  const version = String(((body && body.version) || (e && e.parameter && e.parameter.version) || 'v1.0') ?? '').trim();
  const comments = String(((body && body.comments) || (e && e.parameter && e.parameter.comments) || ('Promovido a ' + newStatus)) ?? '').trim();
  const deliveryTeams = (body && body.deliveryTeams) || (e && e.parameter && e.parameter.deliveryTeams) || '';

  if (!fileId) return { status: 'error', message: 'Falta fileId' };
  if (['COMPARTIDO', 'PUBLICADO'].indexOf(newStatus) === -1) return { status: 'error', message: 'Estado invalido' };

  try {
    var root = DriveApp.getFolderById(folderId);
    if (folderId === DRIVE_ROOT_FOLDER_ID || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
      var targetFolder = findProjectFolderRecursively(root, project, driveFolderName);
      if (targetFolder) root = targetFolder;
    }
    // Get/create .estados/{status} subfolder
    var estadosFolder;
    var ef = root.getFoldersByName('.estados');
    estadosFolder = ef.hasNext() ? ef.next() : root.createFolder('.estados');
    var subFolderName = newStatus.toLowerCase();
    var sf = estadosFolder.getFoldersByName(subFolderName);
    var subFolder = sf.hasNext() ? sf.next() : estadosFolder.createFolder(subFolderName);
    // Copy main file
    var sourceFile = DriveApp.getFileById(fileId);
    var copiedFile = sourceFile.makeCopy(filename, subFolder);
    var copiedFileId = copiedFile.getId();
    // Copy json if present
    var copiedJsonId = '';
    if (jsonId) {
      try {
        var sourceJson = DriveApp.getFileById(jsonId);
        var jsonFilename = filename.replace(/\.frag$/i, '.json');
        copiedJsonId = sourceJson.makeCopy(jsonFilename, subFolder).getId();
      } catch(je) { /* non-fatal */ }
    }
    var now = new Date().toISOString();
    registerFileStatus_(copiedFileId, copiedJsonId, filename, project, newStatus, changedBy, changedByEmail, originalFileId, type, version, comments, deliveryTeams);
    
    // Mark previous versions as not current in VersionesArchivos
    try {
      let doc;
      try { doc = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (err) { doc = SpreadsheetApp.getActiveSpreadsheet(); }
      let vSheet = doc.getSheetByName('VersionesArchivos');
      if (!vSheet) vSheet = doc.insertSheet('VersionesArchivos');
      ensureHeaders(vSheet, FILE_VERSION_HEADERS);
      markPreviousVersionsNotCurrent_(vSheet, project, filename, originalFileId);

      const vId = 'ver-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
      const vRow = FILE_VERSION_HEADERS.map(function(h) {
        if (h === 'versionId') return vId;
        if (h === 'fecha') return now;
        if (h === 'fileId') return copiedFileId;
        if (h === 'jsonId') return copiedJsonId;
        if (h === 'filename') return filename;
        if (h === 'project') return project;
        if (h === 'status') return newStatus;
        if (h === 'version') return version;
        if (h === 'comments') return comments;
        if (h === 'createdBy') return changedBy;
        if (h === 'createdByEmail') return changedByEmail;
        if (h === 'originalFileId') return originalFileId;
        if (h === 'type') return type;
        if (h === 'isCurrent') return 'true';
        if (h === 'backupFileId') return copiedFileId;
        return '';
      });
      vSheet.appendRow(vRow);
    } catch(vErr) { /* non-fatal */ }

    return { status: 'success', newStatus: newStatus, copiedFileId: copiedFileId, copiedJsonId: copiedJsonId, filename: filename, changedAt: now, changedBy: changedBy, version: version };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function markPreviousVersionsNotCurrent_(vSheet, project, filename, originalFileId) {
  if (!vSheet || vSheet.getLastRow() <= 1) return;
  ensureHeaders(vSheet, FILE_VERSION_HEADERS);
  const headers = vSheet.getRange(1, 1, 1, vSheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
  const isCurrentIdx = headers.indexOf('isCurrent');
  const projectIdx = headers.indexOf('project');
  const filenameIdx = headers.indexOf('filename');
  const origIdIdx = headers.indexOf('originalFileId');
  if (isCurrentIdx === -1) return;

  const numRows = vSheet.getLastRow() - 1;
  const range = vSheet.getRange(2, 1, numRows, vSheet.getLastColumn());
  const values = range.getValues();
  let modified = false;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowProj = String(row[projectIdx] || '').trim();
    const rowFile = String(row[filenameIdx] || '').trim();
    const rowOrig = String(row[origIdIdx] || '').trim();

    if ((!project || rowProj === project) && (rowFile === filename || (originalFileId && rowOrig === originalFileId))) {
      if (String(row[isCurrentIdx]).trim() === 'true') {
        values[i][isCurrentIdx] = 'false';
        modified = true;
      }
    }
  }

  if (modified) {
    range.setValues(values);
  }
}

function createVersion_(e, body) {
  const fileId = String(((body && body.fileId) || (e && e.parameter && e.parameter.fileId) || '') ?? '').trim();
  const jsonId = String(((body && body.jsonId) || (e && e.parameter && e.parameter.jsonId) || '') ?? '').trim();
  const filename = String(((body && body.filename) || (e && e.parameter && e.parameter.filename) || '') ?? '').trim();
  const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  const status = String(((body && body.status) || (e && e.parameter && e.parameter.status) || 'EN_PROGRESO') ?? '').trim().toUpperCase();
  const version = String(((body && body.version) || (e && e.parameter && e.parameter.version) || 'v1.0') ?? '').trim();
  const comments = String(((body && body.comments) || (e && e.parameter && e.parameter.comments) || '') ?? '').trim();
  const createdBy = String(((body && body.changedBy) || (body && body.createdBy) || (e && e.parameter && e.parameter.changedBy) || '') ?? '').trim();
  const createdByEmail = String(((body && body.changedByEmail) || (body && body.createdByEmail) || (e && e.parameter && e.parameter.changedByEmail) || '') ?? '').trim();
  const originalFileId = String(((body && body.originalFileId) || (e && e.parameter && e.parameter.originalFileId) || fileId) ?? '').trim();
  const type = String(((body && body.type) || (e && e.parameter && e.parameter.type) || '') ?? '').trim();
  var folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
  
  // Optional new file upload content
  const content = String(((body && body.content) || (e && e.parameter && e.parameter.content) || '') ?? '').trim();
  const contentType = String(((body && body.contentType) || (e && e.parameter && e.parameter.contentType) || 'application/octet-stream') ?? '').trim();
  const uploadedFileId = String(((body && body.uploadedFileId) || (e && e.parameter && e.parameter.uploadedFileId) || '') ?? '').trim();

  if (!fileId && !content && !uploadedFileId) return { status: 'error', message: 'Falta fileId, contenido o ID del archivo cargado' };

  try {
    var root = DriveApp.getFolderById(folderId);
    if (folderId === DRIVE_ROOT_FOLDER_ID || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
      var targetFolder = findProjectFolderRecursively(root, project, driveFolderName);
      if (targetFolder) root = targetFolder;
    }

    // Destination for backup: root/.versiones/{cleanFilename}/
    var cleanBaseName = filename.replace(/\.[^/.]+$/, "");
    var versionesFolder;
    var vf = root.getFoldersByName('.versiones');
    versionesFolder = vf.hasNext() ? vf.next() : root.createFolder('.versiones');
    
    var fileVersFolder;
    var fvf = versionesFolder.getFoldersByName(cleanBaseName);
    fileVersFolder = fvf.hasNext() ? fvf.next() : versionesFolder.createFolder(cleanBaseName);

    var backupFileId = '';
    var activeFileId = fileId;

    // 1. Copy the current file into the backup version folder
    if (fileId) {
      try {
        var sourceFile = DriveApp.getFileById(fileId);
        var backupName = version + '_' + filename;
        var backupFile = sourceFile.makeCopy(backupName, fileVersFolder);
        backupFileId = backupFile.getId();
      } catch (be) { /* non-fatal */ }
    }

    // 2. If an already uploaded file ID is provided, use it, otherwise check content
    if (uploadedFileId) {
      activeFileId = uploadedFileId;
      var destFolder = root;
      if (status === 'COMPARTIDO' || status === 'PUBLICADO') {
        var ef = root.getFoldersByName('.estados');
        var estadosFolder = ef.hasNext() ? ef.next() : root.createFolder('.estados');
        var sf = estadosFolder.getFoldersByName(status.toLowerCase());
        destFolder = sf.hasNext() ? sf.next() : estadosFolder.createFolder(status.toLowerCase());
      }

      // Ensure the file is in the destFolder
      try {
        var fileToMove = DriveApp.getFileById(uploadedFileId);
        var parents = fileToMove.getParents();
        var alreadyInDest = false;
        while (parents.hasNext()) {
          if (parents.next().getId() === destFolder.getId()) {
            alreadyInDest = true;
            break;
          }
        }
        if (!alreadyInDest) {
          destFolder.addFile(fileToMove);
          try {
            root.removeFile(fileToMove);
          } catch (e) {}
        }
      } catch (moveErr) {}

      // Trash older copies in destFolder
      var existing = destFolder.getFilesByName(filename);
      while (existing.hasNext()) {
        var oldF = existing.next();
        if (oldF.getId() !== backupFileId && oldF.getId() !== activeFileId) {
          oldF.setTrashed(true);
        }
      }
    } else if (content) {
      var destFolder = root;
      if (status === 'COMPARTIDO' || status === 'PUBLICADO') {
        var ef = root.getFoldersByName('.estados');
        var estadosFolder = ef.hasNext() ? ef.next() : root.createFolder('.estados');
        var sf = estadosFolder.getFoldersByName(status.toLowerCase());
        destFolder = sf.hasNext() ? sf.next() : estadosFolder.createFolder(status.toLowerCase());
      }

      var existing = destFolder.getFilesByName(filename);
      while (existing.hasNext()) {
        var oldF = existing.next();
        if (oldF.getId() !== backupFileId) {
          oldF.setTrashed(true);
        }
      }

      const decoded = Utilities.base64Decode(content);
      const blob = Utilities.newBlob(decoded, contentType, filename);
      const newActive = destFolder.createFile(blob);
      activeFileId = newActive.getId();
    }

    // 3. Register in VersionesArchivos
    let doc;
    try { doc = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (err) { doc = SpreadsheetApp.getActiveSpreadsheet(); }
    let vSheet = doc.getSheetByName('VersionesArchivos');
    if (!vSheet) vSheet = doc.insertSheet('VersionesArchivos');
    ensureHeaders(vSheet, FILE_VERSION_HEADERS);

    markPreviousVersionsNotCurrent_(vSheet, project, filename, originalFileId);

    const versionId = 'ver-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
    const now = new Date().toISOString();

    const rowData = FILE_VERSION_HEADERS.map(function(h) {
      if (h === 'versionId') return versionId;
      if (h === 'fecha') return now;
      if (h === 'fileId') return activeFileId || '';
      if (h === 'jsonId') return jsonId || '';
      if (h === 'filename') return filename || '';
      if (h === 'project') return project || '';
      if (h === 'status') return status || 'EN_PROGRESO';
      if (h === 'version') return version || 'v1.0';
      if (h === 'comments') return comments || '';
      if (h === 'createdBy') return createdBy || '';
      if (h === 'createdByEmail') return createdByEmail || '';
      if (h === 'originalFileId') return originalFileId || activeFileId || '';
      if (h === 'type') return type || '';
      if (h === 'isCurrent') return 'true';
      if (h === 'backupFileId') return backupFileId || activeFileId || '';
      return '';
    });
    vSheet.appendRow(rowData);

    // Also register state in EstadosArchivos
    registerFileStatus_(activeFileId, jsonId, filename, project, status, createdBy, createdByEmail, originalFileId, type, version, comments);

    return {
      status: 'success',
      versionId: versionId,
      version: version,
      fileId: activeFileId,
      backupFileId: backupFileId,
      comments: comments,
      createdAt: now
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function listVersions_(e, body) {
  const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  const filename = String(((body && body.filename) || (e && e.parameter && e.parameter.filename) || '') ?? '').trim();
  const originalFileId = String(((body && body.originalFileId) || (e && e.parameter && e.parameter.originalFileId) || '') ?? '').trim();

  let doc;
  try { doc = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (err) { doc = SpreadsheetApp.getActiveSpreadsheet(); }
  const sheet = doc.getSheetByName('VersionesArchivos');
  if (!sheet || sheet.getLastRow() <= 1) return { versions: [] };
  ensureHeaders(sheet, FILE_VERSION_HEADERS);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(h) { return String(h).trim(); });
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
  const idx = {};
  FILE_VERSION_HEADERS.forEach(function(h) { idx[h] = headers.indexOf(h); });

  const versions = [];
  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    var rowProject = String(row[idx['project']] || '').trim();
    if (project && rowProject !== project) continue;

    var rowFilename = String(row[idx['filename']] || '').trim();
    var rowOrigId = String(row[idx['originalFileId']] || '').trim();
    var rowFileId = String(row[idx['fileId']] || '').trim();

    if (filename && rowFilename !== filename && rowOrigId !== originalFileId && rowFileId !== originalFileId) {
      continue;
    }

    var fecha = row[idx['fecha']];
    versions.push({
      versionId: String(row[idx['versionId']] || '').trim(),
      fecha: (fecha instanceof Date) ? fecha.toISOString() : String(fecha || ''),
      fileId: rowFileId,
      jsonId: String(row[idx['jsonId']] || '').trim(),
      filename: rowFilename,
      project: rowProject,
      status: String(row[idx['status']] || 'EN_PROGRESO').trim(),
      version: String(row[idx['version']] || 'v1.0').trim(),
      comments: String(row[idx['comments']] || '').trim(),
      createdBy: String(row[idx['createdBy']] || '').trim(),
      createdByEmail: String(row[idx['createdByEmail']] || '').trim(),
      originalFileId: rowOrigId,
      type: String(row[idx['type']] || '').trim(),
      isCurrent: String(row[idx['isCurrent']] || '').trim() === 'true',
      backupFileId: String(row[idx['backupFileId']] || rowFileId || '').trim()
    });
  }

  versions.sort(function(a, b) {
    return new Date(b.fecha) - new Date(a.fecha);
  });

  return { versions: versions };
}

function restoreVersion_(e, body) {
  const backupFileId = String(((body && body.backupFileId) || (e && e.parameter && e.parameter.backupFileId) || '') ?? '').trim();
  const filename = String(((body && body.filename) || (e && e.parameter && e.parameter.filename) || '') ?? '').trim();
  const targetVersion = String(((body && body.version) || (e && e.parameter && e.parameter.version) || '') ?? '').trim();
  const project = String(((body && body.project) || (e && e.parameter && e.parameter.project) || '') ?? '').trim();
  const status = String(((body && body.status) || (e && e.parameter && e.parameter.status) || 'EN_PROGRESO') ?? '').trim().toUpperCase();
  var folderId = String(((body && body.folderId) || (e && e.parameter && e.parameter.folderId) || DRIVE_ROOT_FOLDER_ID) ?? '').trim();
  const driveFolderName = String(((body && body.driveFolderName) || (e && e.parameter && e.parameter.driveFolderName) || '') ?? '').trim();
  const originalFileId = String(((body && body.originalFileId) || (e && e.parameter && e.parameter.originalFileId) || '') ?? '').trim();
  const changedBy = String(((body && body.changedBy) || (e && e.parameter && e.parameter.changedBy) || '') ?? '').trim();
  const changedByEmail = String(((body && body.changedByEmail) || (e && e.parameter && e.parameter.changedByEmail) || '') ?? '').trim();
  const type = String(((body && body.type) || (e && e.parameter && e.parameter.type) || '') ?? '').trim();
  const deliveryTeams = (body && body.deliveryTeams) || (e && e.parameter && e.parameter.deliveryTeams) || '';

  if (!backupFileId) return { status: 'error', message: 'Falta backupFileId para restaurar' };

  try {
    var root = DriveApp.getFolderById(folderId);
    if (folderId === DRIVE_ROOT_FOLDER_ID || folderId === '1fn1umYzIYsxymmwbmap6YbjTB33XJrG8') {
      var targetFolder = findProjectFolderRecursively(root, project, driveFolderName);
      if (targetFolder) root = targetFolder;
    }

    var destFolder = root;
    if (status === 'COMPARTIDO' || status === 'PUBLICADO') {
      var ef = root.getFoldersByName('.estados');
      var estadosFolder = ef.hasNext() ? ef.next() : root.createFolder('.estados');
      var sf = estadosFolder.getFoldersByName(status.toLowerCase());
      destFolder = sf.hasNext() ? sf.next() : estadosFolder.createFolder(status.toLowerCase());
    }

    // Trash any existing active files with same name in destFolder to avoid duplicate file items in Drive
    var existing = destFolder.getFilesByName(filename);
    while (existing.hasNext()) {
      var oldF = existing.next();
      if (oldF.getId() !== backupFileId) {
        oldF.setTrashed(true);
      }
    }

    var backupFile = DriveApp.getFileById(backupFileId);
    var restoredCopy = backupFile.makeCopy(filename, destFolder);
    var newActiveFileId = restoredCopy.getId();

    var restoredVersionLabel = targetVersion ? (targetVersion + ' (Restaurada)') : 'Restaurada';
    var comment = 'Versión restaurada desde ' + targetVersion;

    let doc;
    try { doc = SpreadsheetApp.openById(SPREADSHEET_ID); } catch (err) { doc = SpreadsheetApp.getActiveSpreadsheet(); }
    let vSheet = doc.getSheetByName('VersionesArchivos');
    if (!vSheet) vSheet = doc.insertSheet('VersionesArchivos');
    ensureHeaders(vSheet, FILE_VERSION_HEADERS);

    markPreviousVersionsNotCurrent_(vSheet, project, filename, originalFileId);

    const newVersionId = 'ver-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
    const now = new Date().toISOString();

    const rowData = FILE_VERSION_HEADERS.map(function(h) {
      if (h === 'versionId') return newVersionId;
      if (h === 'fecha') return now;
      if (h === 'fileId') return newActiveFileId || '';
      if (h === 'jsonId') return '';
      if (h === 'filename') return filename || '';
      if (h === 'project') return project || '';
      if (h === 'status') return status || 'EN_PROGRESO';
      if (h === 'version') return restoredVersionLabel;
      if (h === 'comments') return comment;
      if (h === 'createdBy') return changedBy || '';
      if (h === 'createdByEmail') return changedByEmail || '';
      if (h === 'originalFileId') return originalFileId || newActiveFileId;
      if (h === 'type') return type || '';
      if (h === 'isCurrent') return 'true';
      if (h === 'backupFileId') return backupFileId;
      return '';
    });
    vSheet.appendRow(rowData);

    registerFileStatus_(newActiveFileId, '', filename, project, status, changedBy, changedByEmail, originalFileId || newActiveFileId, type, restoredVersionLabel, comment, deliveryTeams);

    return {
      status: 'success',
      restoredFileId: newActiveFileId,
      version: restoredVersionLabel,
      message: 'Versión restaurada con éxito.'
    };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

function deleteFile_(e, body) {
  let fileIds = [];
  if (body && Array.isArray(body.fileIds)) {
    fileIds = body.fileIds.map(function(id) { return String(id || '').trim(); }).filter(Boolean);
  }
  
  const singleId = String(((body && (body.fileId || body.id)) || (e && e.parameter && (e.parameter.fileId || e.parameter.id))) ?? '').trim();
  if (singleId && fileIds.indexOf(singleId) === -1) {
    fileIds.push(singleId);
  }

  const fragId = String(((body && body.fragId) || (e && e.parameter && e.parameter.fragId)) ?? '').trim();
  const jsonId = String(((body && body.jsonId) || (e && e.parameter && e.parameter.jsonId)) ?? '').trim();
  if (fragId && fileIds.indexOf(fragId) === -1) fileIds.push(fragId);
  if (jsonId && fileIds.indexOf(jsonId) === -1) fileIds.push(jsonId);

  if (fileIds.length === 0) {
    return { status: 'error', message: 'Faltan IDs de archivo para eliminar.' };
  }

  const deleted = [];
  const errors = [];

  for (let i = 0; i < fileIds.length; i++) {
    const id = fileIds[i];
    try {
      const file = DriveApp.getFileById(id);
      const name = file.getName();
      file.setTrashed(true);
      deleted.push({ id: id, name: name });
    } catch (err) {
      errors.push({ id: id, error: err.toString() });
    }
  }

  if (deleted.length > 0) {
    return { status: 'success', message: 'Archivo(s) eliminado(s) exitosamente.', deleted: deleted, errors: errors };
  } else {
    return { status: 'error', message: 'No se pudo eliminar el archivo.', errors: errors };
  }
}

function wipeAndInitDatabase() {
  let doc;
  try {
    doc = SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (err) {
    doc = SpreadsheetApp.getActiveSpreadsheet();
  }
  
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

// ─────────────────────────────────────────────────────────────────────────────
// CONTROL Y REGISTRO DE WEBHOOKS WOMPI (PASARELA DE PAGOS)
// ─────────────────────────────────────────────────────────────────────────────
const WOMPI_HEADERS = ['fecha', 'transactionId', 'reference', 'status', 'amountInCents', 'currency', 'paymentMethod', 'customerEmail'];

function handleWompiWebhook_(e, data) {
  try {
    let doc;
    try {
      doc = SpreadsheetApp.openById(SPREADSHEET_ID);
    } catch (err) {
      doc = SpreadsheetApp.getActiveSpreadsheet();
    }

    let sheet = doc.getSheetByName('TransaccionesWompi');
    if (!sheet) {
      sheet = doc.insertSheet('TransaccionesWompi');
    }
    ensureHeaders(sheet, WOMPI_HEADERS);

    const payload = data || {};
    const tx = (payload.data && payload.data.transaction) ? payload.data.transaction : payload;
    const fecha = new Date().toISOString();

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const row = new Array(headers.length).fill("");

    const setVal = (headerName, value) => {
      const idx = headers.indexOf(headerName);
      if (idx !== -1) row[idx] = value;
    };

    setVal('fecha', fecha);
    setVal('transactionId', tx.id || tx.transactionId || '');
    setVal('reference', tx.reference || '');
    setVal('status', tx.status || '');
    setVal('amountInCents', tx.amount_in_cents || tx.amountInCents || 0);
    setVal('currency', tx.currency || 'COP');
    setVal('paymentMethod', tx.payment_method_type || '');
    setVal('customerEmail', tx.customer_email || (tx.customer_data ? tx.customer_data.email : ''));

    sheet.appendRow(row);

    return {
      status: "success",
      message: "Notificación de transacción Wompi registrada correctamente",
      transactionId: tx.id || tx.reference
    };
  } catch (err) {
    return {
      status: "error",
      message: err.toString()
    };
  }
}

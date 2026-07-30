// =========================================================================
// SCRIPT DE GOOGLE APPS SCRIPT PARA NORA (USUARIOS Y EMPRESAS + GOOGLE DRIVE)
// =========================================================================

const DRIVE_ROOT_FOLDER_ID = "1aWUNnLgjWBkA6wdCM99XMY9SU7eSDP-H";

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

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    const fecha = new Date().toISOString();

    if (data.action === 'createUserAndCompany') {
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
      setVal('sectors', data.companyData.sectors || '');
      setVal('specialties', data.companyData.specialties || '');
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
      setVal('sectors', data.sectors || '');
      setVal('specialties', data.specialties || '');
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
        const companyFolderName = `${code} - ${name}`;
        let companyFolder;
        try {
          companyFolder = getOrCreateFolder(rootFolder, companyFolderName);
        } catch (e) {
          responseFolders[comp.id] = {
            error: e.toString()
          };
          return;
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
          let projFolder;
          
          if (projFolderId) {
            // Verify it exists, else recreate
            try {
              projFolder = DriveApp.getFolderById(projFolderId);
            } catch (err) {
              projFolder = null;
            }
          }
          
          if (!projFolder) {
            try {
              projFolder = getOrCreateFolder(companyFolder, proj.name);
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
    const action = e.parameter.action;
    const doc = SpreadsheetApp.getActiveSpreadsheet();
    
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

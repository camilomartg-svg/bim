/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - SINCRONIZACIÓN DE PROYECTOS NORA CDE EN GOOGLE DRIVE
 * =========================================================================
 * 
 * Carpeta Raíz de Proyectos en Google Drive:
 * https://drive.google.com/drive/u/0/folders/1ZyW39yfyecmD-G8cfb6UrhN9jsoL7rEx
 * ID: 1ZyW39yfyecmD-G8cfb6UrhN9jsoL7rEx
 * 
 * Estructura automática generada:
 * [Carpeta Raíz] (1ZyW39yfyecmD-G8cfb6UrhN9jsoL7rEx)
 *   └── [Nombre de la Empresa] (ej: "MESH ESTUDIO")
 *         └── [Nombre del Proyecto] (ej: "HOSPITAL MATERNO INFANTIL", "UNUM")
 *               └── proyecto.json (JSON completo con participantes, equipos y roles ISO 19650)
 * 
 * INSTRUCCIONES DE DESPLIEGUE:
 * 1. Abre https://script.google.com/ e ingresa a tu proyecto existente o crea uno nuevo.
 * 2. Copia y pega este código (o agrégalo a tu script existente "Directorio Global noraCDE.js").
 * 3. Haz clic en "Implementar" (Deploy) -> "Nueva implementación" (New deployment).
 * 4. Tipo: "Aplicación web" (Web App).
 *    - Descripción: "Nora CDE - Google Drive Proyectos Sync"
 *    - Ejecutar como: "Yo" (tu cuenta de Google)
 *    - Quién tiene acceso: "Cualquier persona" (Anyone)
 * 5. Haz clic en "Implementar", autoriza los permisos de DriveApp y copia la URL proporcionada.
 */

const PROJECTS_DRIVE_ROOT_FOLDER_ID = "1ZyW39yfyecmD-G8cfb6UrhN9jsoL7rEx";

function doGet(e) {
  try {
    const action = String(e && e.parameter && e.parameter.action || '').trim();
    const callback = String(e && e.parameter && e.parameter.callback || '').trim();

    if (action === 'getProjectConfig' || action === 'getProject') {
      return output_(getProjectConfigFromDrive_(e.parameter || {}, null), callback);
    }
    if (action === 'getCompanyProjects') {
      return output_(getCompanyProjectsFromDrive_(e.parameter || {}, null), callback);
    }
    if (action === 'saveProjectConfig' || action === 'saveProject') {
      return output_(saveProjectConfigToDrive_(e.parameter || {}), callback);
    }
    if (action === 'ping') {
      return output_({ status: 'success', message: 'Nora CDE Projects Drive API activa.', timestamp: new Date().toISOString() }, callback);
    }

    return output_({ status: 'error', message: 'Acción no válida o no especificada.' }, callback);
  } catch (err) {
    return output_({ status: 'error', message: err.toString() }, String(e && e.parameter && e.parameter.callback || ''));
  }
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

    if (action === 'saveProjectConfig' || action === 'saveProject') {
      return output_(saveProjectConfigToDrive_(data || e.parameter || {}), callback);
    }
    if (action === 'getProjectConfig' || action === 'getProject') {
      return output_(getProjectConfigFromDrive_(e.parameter || {}, data), callback);
    }
    if (action === 'getCompanyProjects') {
      return output_(getCompanyProjectsFromDrive_(e.parameter || {}, data), callback);
    }

    return output_({ status: 'error', message: 'Acción POST no reconocida.' }, callback);
  } catch (err) {
    return output_({ status: 'error', message: err.toString() }, '');
  }
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');').setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSubfolder_(parentFolder, targetName) {
  const cleanTarget = String(targetName || '').trim();
  if (!cleanTarget) return parentFolder;

  const folders = parentFolder.getFolders();
  while (folders.hasNext()) {
    const f = folders.next();
    if (f.getName().trim().toLowerCase() === cleanTarget.toLowerCase()) {
      return f;
    }
  }
  return parentFolder.createFolder(cleanTarget);
}

function findProjectFolderInCompany_(companyFolder, projectName, projectSlug) {
  const cleanName = String(projectName || '').trim().toLowerCase();
  const cleanSlug = String(projectSlug || '').trim().toLowerCase();

  const folders = companyFolder.getFolders();
  const list = [];
  while (folders.hasNext()) {
    const f = folders.next();
    const fName = f.getName().trim().toLowerCase();
    // 1. Coincidencia exacta o insensible a mayúsculas
    if (cleanName && fName === cleanName) return f;
    if (cleanSlug && fName === cleanSlug) return f;
    // 2. Contiene el slug o corchetes
    if (cleanSlug && (fName.includes(cleanSlug) || fName.includes("[" + cleanSlug + "]") || fName.includes("(" + cleanSlug + ")"))) {
      return f;
    }
    list.push(f);
  }

  // 3. Inspeccionar proyecto.json dentro de subcarpetas candidatas
  for (let i = 0; i < list.length; i++) {
    const candidate = list[i];
    const files = candidate.getFilesByName("proyecto.json");
    if (files.hasNext()) {
      try {
        const content = files.next().getBlob().getDataAsString();
        const json = JSON.parse(content);
        if (json) {
          const pName = String(json.name || json.title || '').trim().toLowerCase();
          const pSlug = String(json.slug || '').trim().toLowerCase();
          if ((cleanName && pName === cleanName) || (cleanSlug && pSlug === cleanSlug)) {
            return candidate;
          }
        }
      } catch (err) {}
    }
  }

  return null;
}

function saveProjectConfigToDrive_(payload) {
  try {
    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    if (!rootFolder) {
      return { status: 'error', message: 'No se encontró la carpeta raíz de proyectos en Google Drive (ID: ' + PROJECTS_DRIVE_ROOT_FOLDER_ID + ').' };
    }

    const companyName = String(payload.companyName || payload.empresa || payload.companyId || 'Empresa').trim();
    const projectData = payload.projectData || payload.config || payload.data || {};
    const projectName = String(payload.projectName || projectData.name || projectData.title || payload.proyecto || payload.projectSlug || 'Nuevo Proyecto').trim();
    const projectSlug = String(payload.projectSlug || projectData.slug || '').trim();

    if (!companyName || !projectName) {
      return { status: 'error', message: 'Se requiere especificar el nombre de la empresa y del proyecto.' };
    }

    // 1. Carpeta de la Empresa en Google Drive
    const companyFolder = getOrCreateSubfolder_(rootFolder, companyName);

    // 2. Carpeta del Proyecto al interior de la Empresa
    let projectFolder = findProjectFolderInCompany_(companyFolder, projectName, projectSlug);
    if (!projectFolder) {
      projectFolder = companyFolder.createFolder(projectName);
    } else {
      const currentFName = projectFolder.getName().trim();
      if (currentFName.toLowerCase() !== projectName.toLowerCase() && projectName.toLowerCase() !== 'nuevo proyecto') {
        try { projectFolder.setName(projectName); } catch(e) {}
      }
    }

    // 3. Guardar o actualizar proyecto.json
    if (!projectData.name && projectName) projectData.name = projectName;
    if (!projectData.slug && projectSlug) projectData.slug = projectSlug;

    const jsonString = JSON.stringify(projectData, null, 2);
    const files = projectFolder.getFilesByName('proyecto.json');
    let jsonFile;

    if (files.hasNext()) {
      jsonFile = files.next();
      jsonFile.setContent(jsonString);
    } else {
      jsonFile = projectFolder.createFile('proyecto.json', jsonString, MimeType.PLAIN_TEXT);
    }

    // Compartir por enlace para visualización rápida
    try {
      jsonFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {}

    return {
      status: 'success',
      message: 'Configuración guardada en Google Drive exitosamente.',
      fileId: jsonFile.getId(),
      fileUrl: jsonFile.getUrl(),
      projectFolderId: projectFolder.getId(),
      companyFolderId: companyFolder.getId(),
      projectName: projectName,
      companyName: companyName,
      updatedAt: new Date().toISOString()
    };
  } catch (err) {
    return {
      status: 'error',
      message: 'Error al guardar en Google Drive: ' + err.toString()
    };
  }
}

function getProjectConfigFromDrive_(params, postData) {
  try {
    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    if (!rootFolder) {
      return { status: 'error', message: 'Carpeta raíz no encontrada.' };
    }

    const p = Object.assign({}, params || {}, postData || {});
    const companyName = String(p.companyName || p.empresa || p.companyId || '').trim();
    const projectName = String(p.projectName || p.proyecto || p.projectSlug || '').trim();
    const projectSlug = String(p.projectSlug || p.slug || p.proyecto || '').trim();

    if (!projectName && !projectSlug) {
      return { status: 'error', message: 'Se requiere especificar el proyecto.' };
    }

    let companyFolder = null;
    if (companyName) {
      const folders = rootFolder.getFolders();
      while (folders.hasNext()) {
        const f = folders.next();
        if (f.getName().trim().toLowerCase() === companyName.toLowerCase()) {
          companyFolder = f;
          break;
        }
      }
    }

    let projectFolder = null;
    if (companyFolder) {
      projectFolder = findProjectFolderInCompany_(companyFolder, projectName, projectSlug);
    } else {
      const allComp = rootFolder.getFolders();
      while (allComp.hasNext()) {
        const cFolder = allComp.next();
        const found = findProjectFolderInCompany_(cFolder, projectName, projectSlug);
        if (found) {
          companyFolder = cFolder;
          projectFolder = found;
          break;
        }
      }
    }

    if (!projectFolder) {
      return { status: 'not_found', message: 'No se encontró la carpeta del proyecto en Google Drive.' };
    }

    const files = projectFolder.getFilesByName('proyecto.json');
    if (!files.hasNext()) {
      return { status: 'not_found', message: 'El archivo proyecto.json no existe aún en la carpeta.' };
    }

    const file = files.next();
    const content = file.getBlob().getDataAsString();
    const data = JSON.parse(content);

    return {
      status: 'success',
      data: data,
      fileId: file.getId(),
      folderId: projectFolder.getId(),
      companyFolderId: companyFolder ? companyFolder.getId() : null,
      updatedAt: file.getLastUpdated().toISOString()
    };
  } catch (err) {
    return {
      status: 'error',
      message: 'Error al consultar Google Drive: ' + err.toString()
    };
  }
}

function getCompanyProjectsFromDrive_(params, postData) {
  try {
    const rootFolder = DriveApp.getFolderById(PROJECTS_DRIVE_ROOT_FOLDER_ID);
    const p = Object.assign({}, params || {}, postData || {});
    const companyName = String(p.companyName || p.empresa || p.companyId || '').trim();

    if (!companyName) {
      return { status: 'error', message: 'Se requiere el nombre o ID de la empresa.' };
    }

    let companyFolder = null;
    const folders = rootFolder.getFolders();
    while (folders.hasNext()) {
      const f = folders.next();
      if (f.getName().trim().toLowerCase() === companyName.toLowerCase()) {
        companyFolder = f;
        break;
      }
    }

    if (!companyFolder) {
      return { status: 'success', projects: [] };
    }

    const pFolders = companyFolder.getFolders();
    const projects = [];
    while (pFolders.hasNext()) {
      const pf = pFolders.next();
      const files = pf.getFilesByName('proyecto.json');
      if (files.hasNext()) {
        try {
          const content = files.next().getBlob().getDataAsString();
          const json = JSON.parse(content);
          if (json && typeof json === 'object') {
            projects.push(json);
          }
        } catch (e) {}
      }
    }

    return { status: 'success', projects: projects };
  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

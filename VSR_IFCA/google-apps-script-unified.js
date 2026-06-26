// ==========================================
// UNIFIED GOOGLE APPS SCRIPT FOR VSR_IFC & VSR_IFCA
// VERSION: 1.6.0 (Unified Viewpoints + Models Chunking + Dynamic Folder)
// ==========================================
// INSTRUCCIONES DE DESPLIEGUE:
// 1. Ve a https://script.google.com/home
// 2. Abre tu proyecto existente.
// 3. Borra todo el código en el editor (Code.gs) y pega este contenido UNIFICADO.
// 4. Guarda el proyecto (Ctrl+S).
// 5. Haz clic en el botón azul "Implementar" (arriba derecha) > "Gestionar implementaciones".
// 6. Haz clic en el icono de "Lápiz" (Editar) en la implementación activa.
// 7. En "Versión", selecciona "Nueva versión".
// 8. En "Quién tiene acceso", selecciona "Cualquier persona" (Anyone). 
//    (IMPORTANTE: Si dice "Solo yo", fallará con error CORS).
// 9. Haz clic en "Implementar".
// 10. Copia la URL de la web app y configúrala en el PBA.
// ==========================================

// ID de las carpetas por defecto en Google Drive
const FOLDER_ID = "1ylvuOsv0zzWCthbGT1IwsCSD5nEBM8Kl"; // VSR_VIEWPOINTS_STORAGE (Viewpoints JSON)
const MODELS_FOLDER_ID = "1QGMfnBl8bXCAGbQXd0DPR2a56IyiZNVq"; // Carpeta de Modelos por defecto
const API_VERSION = "1.6.0";
const USERS_SHEET_ID = "1Jcxc9SwtbDrExyGeS_zy0BVnEER64iEEvzCnzCo5OCg";

function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  // Esperar hasta 30 segundos a que otros procesos terminen
  lock.tryLock(30000);

  try {
    let action = (e && e.parameter && e.parameter.action) || "";
    let callback = (e && e.parameter && e.parameter.callback) || "";
    let payload = null;

    // Intentar parsear el cuerpo del POST si existe
    if (e && e.postData && e.postData.contents) {
      try {
        const body = JSON.parse(e.postData.contents);
        if (body.action) action = body.action;
        if (body.data) payload = body.data;
        // Compatibilidad de campos directos en el body
        if (!payload && body && typeof body === 'object') {
          payload = {};
          if (body.id) payload.id = body.id;
          if (body.userId) payload.userId = body.userId;
          if (body.sharedWith !== undefined) payload.sharedWith = body.sharedWith;
        }
      } catch (err) {
        // Ignorar si no es JSON
      }
    }

    let result = { status: "error", message: "Invalid action" };

    // Detectar si la petición viene del visor nuevo y tiene un folderId/driveFolderId
    const folderIdParam = (e && e.parameter && (e.parameter.folderId || e.parameter.driveFolderId)) || "";

    // ==========================================
    // ENRUTAMIENTO DE ACCIONES
    // ==========================================
    if (action === "ping") {
      result = { ok: true };
    }
    else if (action === "list") {
      if (folderIdParam) {
        // Petición de modelos de VSR_IFCA (nuevo visor)
        result = listModelsChunks(folderIdParam);
        return output(result, callback);
      } else {
        // Petición de viewpoints tradicional
        const userId = (e && e.parameter && e.parameter.userId) || (payload ? payload.userId : null);
        result = listViewpoints(userId);
      }
    } 
    else if (action === "get") {
      const id = (e && e.parameter && e.parameter.id) || (payload ? payload.id : null);
      const userId = (e && e.parameter && e.parameter.userId) || (payload ? payload.userId : null);
      if (id) {
        result = getViewpoint(id, userId);
      } else {
        result = { error: "Missing ID" };
      }
    } 
    else if (action === "save") {
      const data = (e && e.parameter && e.parameter.data) || (payload ? payload : null);
      const requesterUserId = (e && e.parameter && e.parameter.requesterUserId) || (payload ? payload.requesterUserId : null);
      if (data) {
        result = saveViewpoint(data, requesterUserId);
      } else {
        result = { status: "error", message: "Missing data" };
      }
    } 
    else if (action === "delete") {
      const id = (e && e.parameter && e.parameter.id) || (payload ? payload.id : null);
      if (id) {
        result = deleteViewpoint(id);
      } else {
        result = { status: "error", message: "Missing ID for deletion" };
      }
    } 
    else if (action === "share") {
      const id = (e && e.parameter && e.parameter.id) || (payload ? payload.id : null);
      const userId = (e && e.parameter && e.parameter.userId) || (payload ? payload.userId : null);
      const sharedWith = (e && e.parameter && e.parameter.sharedWith) || (payload ? payload.sharedWith : null);
      if (!id || !userId) {
        result = { status: "error", message: "Missing id/userId" };
      } else {
        result = shareViewpoint(id, userId, sharedWith);
      }
    } 
    else if (action === "users") {
      result = listActiveUsers();
    } 
    // ---- NUEVAS ACCIONES COMPATIBLES CON VSR_IFCA (CHUNKS DE .FRAG) ----
    else if (action === "chunk") {
      result = chunkFile(e, payload);
      return output(result, callback);
    } 
    else if (action === "text") {
      result = textFile(e, payload);
      return output(result, callback);
    }
    // ---- COMPATIBILIDAD CON VISORES ANTIGUOS ----
    else if (action === "list_models") {
      result = listModels();
    } 
    else if (action === "get_model") {
      const fileId = (e && e.parameter && e.parameter.id) || (payload ? payload.id : null);
      if (fileId) {
        return serveModelFile(fileId); // Retorna directamente el flujo binario/texto del archivo
      } else {
        result = { error: "Missing Model File ID" };
      }
    } 
    else {
      result = { status: "error", message: "Invalid action: " + action };
    }
    
    // Agregar versión para depuración
    if (result && typeof result === 'object' && !Array.isArray(result)) {
      result._version = API_VERSION;
    }

    return output(result, callback);

  } catch (err) {
    return output({
      status: "error",
      message: err.toString(),
      _stack: err.stack
    }, (e && e.parameter && e.parameter.callback) || "");
  } finally {
    lock.releaseLock();
  }
}

function output(data, callback) {
  const jsonString = JSON.stringify(data);
  if (callback) {
    const outputText = callback + "(" + jsonString + ");";
    const out = ContentService.createTextOutput(outputText);
    out.setMimeType(ContentService.MimeType.JAVASCRIPT);
    return out;
  }
  const out = ContentService.createTextOutput(jsonString);
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function getFolder() {
  return DriveApp.getFolderById(FOLDER_ID);
}

function getModelsFolder() {
  return DriveApp.getFolderById(MODELS_FOLDER_ID);
}

// ==========================================
// LÓGICA DE MODELOS (VSR_IFCA CHUNKS Y DYNAMIC FOLDER)
// ==========================================
function listModelsChunks(folderId) {
  const actualFolderId = String(folderId || MODELS_FOLDER_ID).trim();
  if (!actualFolderId) return { error: 'Falta folderId' };
  const root = DriveApp.getFolderById(actualFolderId);

  const frags = [];
  const jsonByBase = {};

  const normalizeBase_ = (name) => String(name || '').trim().toLowerCase();

  const walk_ = (folder) => {
    const it = folder.getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const name = f.getName();
      const lower = String(name).toLowerCase();

      if (lower.endsWith('.frag')) {
        frags.push({ name: name, fragId: f.getId() });
        continue;
      }

      if (lower.endsWith('.json')) {
        const base = normalizeBase_(name.slice(0, -5));
        jsonByBase[base] = f.getId();
      }
    }

    const sub = folder.getFolders();
    while (sub.hasNext()) {
      walk_(sub.next());
    }
  };

  walk_(root);

  const models = frags
    .map((m) => {
      const base = normalizeBase_(m.name.slice(0, -5));
      const jsonId = jsonByBase[base] || null;
      return { name: m.name, fragId: m.fragId, jsonId: jsonId };
    })
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'es'));

  return { models: models };
}

function chunkFile(e, body) {
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

function textFile(e, body) {
  const id = String(((body && body.id) || (e && e.parameter && e.parameter.id) || '') ?? '').trim();
  if (!id) return { error: 'Falta id' };

  const file = DriveApp.getFileById(id);
  const text = file.getBlob().getDataAsString('UTF-8');
  return { text: text };
}

// ==========================================
// LÓGICA COMPATIBILIDAD ANTERIOR (PLANOS)
// ==========================================

/**
 * Escanea la carpeta de modelos y devuelve un arreglo con metadatos básicos y su URL de descarga indirecta
 */
function listModels() {
  const folder = getModelsFolder();
  const files = folder.getFiles();
  const modelList = [];
  const scriptUrl = ScriptApp.getService().getUrl();

  while (files.hasNext()) {
    const file = files.next();
    if (!file.isTrashed()) {
      const name = file.getName();
      // Filtrar formatos comunes de arquitectura/BIM
      if (name.toLowerCase().endsWith(".ifc") || name.toLowerCase().endsWith(".obj") || name.toLowerCase().endsWith(".gltf") || name.toLowerCase().endsWith(".glb")) {
        modelList.push({
          id: file.getId(),
          name: name,
          size: file.getSize(),
          mimeType: file.getMimeType(),
          lastUpdated: new Date(file.getLastUpdated()).getTime(),
          url: `${scriptUrl}?action=get_model&id=${file.getId()}`
        });
      }
    }
  }

  modelList.sort((a, b) => a.name.localeCompare(b.name));
  return modelList;
}

/**
 * Descarga el archivo de Drive y lo transmite al cliente simulando una descarga de archivo estático
 */
function serveModelFile(fileId) {
  try {
    const file = DriveApp.getFileById(fileId);
    if (file.isTrashed()) {
      return ContentService.createTextOutput(JSON.stringify({ error: "Model file is in trash" })).setMimeType(ContentService.MimeType.JSON);
    }
    
    const blob = file.getBlob();
    return ContentService.createTextOutput("") // Base obligatoria
      .append(blob.getDataAsString()) 
      .setMimeType(ContentService.MimeType.TEXT); // Transferir contenido plano
      
  } catch (e) {
    return ContentService.createTextOutput(JSON.stringify({ error: "Error serving file: " + e.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

// ==========================================
// LÓGICA EXISTENTE DE VIEWPOINTS
// ==========================================
function listViewpoints(requestUserId) {
  const folder = getFolder();
  const files = folder.getFiles();
  const list = [];
  const scriptUrl = ScriptApp.getService().getUrl();

  while (files.hasNext()) {
    const file = files.next();
    if ((file.getMimeType() === "application/json" || file.getName().endsWith(".json")) && !file.isTrashed()) {
      try {
        const content = file.getBlob().getDataAsString();
        const data = JSON.parse(content);

        if (requestUserId && !canAccessViewpoint(data, requestUserId)) {
          continue;
        }

        const userQuery = requestUserId ? `&userId=${encodeURIComponent(requestUserId)}` : "";
        
        list.push({
          id: data.id,
          title: data.title,
          description: data.description || "",
          category: data.category || "General",
          userId: data.userId || "anonymous",
          date: data.date || new Date(file.getLastUpdated()).getTime(),
          sharedWith: data.sharedWith || [],
          sharedAccess: data.sharedAccess || [],
          file: `${scriptUrl}?action=get&id=${data.id}${userQuery}`
        });
      } catch (e) {
        // Archivo corrupto o no válido, ignorar
      }
    }
  }
  
  list.sort((a, b) => b.date - a.date);
  return list;
}

function getViewpoint(id, requestUserId) {
  const folder = getFolder();
  const fileName = `${id}.json`;
  const files = folder.getFilesByName(fileName);
  
  if (files.hasNext()) {
    const file = files.next();
    if (file.isTrashed()) return { error: "Viewpoint is deleted" };

    const content = file.getBlob().getDataAsString();
    const data = JSON.parse(content);
    if (requestUserId && !canAccessViewpoint(data, requestUserId)) {
      return { error: "Unauthorized" };
    }
    return data;
  }
  
  return { error: "Not found" };
}

function canEditViewpoint(data, userId) {
  if (!userId) return false;
  if (!data) return false;
  const me = String(userId).trim().toLowerCase();
  if (!me) return false;
  if (data.userId && String(data.userId).trim().toLowerCase() === me) return true;
  const sharedAccess = data.sharedAccess;
  if (Array.isArray(sharedAccess)) {
    for (let i = 0; i < sharedAccess.length; i++) {
      const entry = sharedAccess[i] || {};
      const targetUser = String(entry.userId || "").trim().toLowerCase();
      const permission = String(entry.permission || "view").trim().toLowerCase();
      if (targetUser && targetUser === me && permission === "edit") return true;
    }
  }
  return false;
}

function saveViewpoint(data, requesterUserId) {
  const folder = getFolder();
  const id = data.id;
  const fileName = `${id}.json`;
  
  const files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    const file = files.next();
    if (file.isTrashed()) {
       file.setTrashed(false);
    }
    const currentContent = file.getBlob().getDataAsString();
    const currentData = JSON.parse(currentContent);
    if (!canEditViewpoint(currentData, requesterUserId || data.userId)) {
      return { status: "error", message: "Unauthorized to edit viewpoint", id: id };
    }
    file.setContent(JSON.stringify(data, null, 2));
    return { status: "success", action: "updated", id: id };
  } else {
    folder.createFile(fileName, JSON.stringify(data, null, 2), "application/json");
    return { status: "success", action: "created", id: id };
  }
}

function deleteViewpoint(id) {
  const folder = getFolder();
  const fileName = `${id}.json`;
  const files = folder.getFilesByName(fileName);
  let deletedCount = 0;
  
  while (files.hasNext()) {
    const file = files.next();
    try {
      if (!file.isTrashed()) {
        file.setTrashed(true);
        deletedCount++;
      }
    } catch (e) {}
  }

  if (deletedCount === 0) {
    const filesNoExt = folder.getFilesByName(id);
    while (filesNoExt.hasNext()) {
        const file = filesNoExt.next();
        try {
          if (!file.isTrashed()) {
            file.setTrashed(true);
            deletedCount++;
          }
        } catch (e) {}
    }
  }

  if (deletedCount > 0) {
    return { status: "success", action: "deleted", id: id, count: deletedCount };
  } else {
    return { status: "error", message: "Viewpoint file not found in Drive", id: id };
  }
}

function canAccessViewpoint(data, userId) {
  if (!userId) return true;
  if (!data) return false;
  if (data.userId && String(data.userId).toLowerCase() === String(userId).toLowerCase()) return true;
  const sharedAccess = data.sharedAccess;
  if (Array.isArray(sharedAccess)) {
    for (let i = 0; i < sharedAccess.length; i++) {
      const entry = sharedAccess[i] || {};
      const v = String(entry.userId || "").trim().toLowerCase();
      if (v && v === String(userId).trim().toLowerCase()) return true;
    }
  }
  const sharedWith = data.sharedWith;
  if (Array.isArray(sharedWith)) {
    const set = {};
    for (let i = 0; i < sharedWith.length; i++) {
      const v = String(sharedWith[i] || "").trim().toLowerCase();
      if (v) set[v] = true;
    }
    return !!set[String(userId).trim().toLowerCase()];
  }
  return false;
}

function shareViewpoint(id, requesterUserId, sharedWith) {
  const folder = getFolder();
  const fileName = `${id}.json`;
  const files = folder.getFilesByName(fileName);
  if (!files.hasNext()) return { status: "error", message: "Viewpoint not found", id };

  const file = files.next();
  if (file.isTrashed()) return { status: "error", message: "Viewpoint is deleted", id };

  const content = file.getBlob().getDataAsString();
  const data = JSON.parse(content);
  const owner = String(data.userId || "").trim().toLowerCase();
  const requester = String(requesterUserId || "").trim().toLowerCase();
  
  if (!owner || owner !== requester) {
    return { status: "error", message: "Only the owner can share this viewpoint", id };
  }

  let recipients = [];
  if (Array.isArray(sharedWith)) {
    recipients = sharedWith;
  } else if (typeof sharedWith === "string") {
    recipients = sharedWith.split(/[,;\n]+/g);
  }

  const normalized = [];
  const seen = {};
  for (let i = 0; i < recipients.length; i++) {
    const email = String(recipients[i] || "").trim().toLowerCase();
    if (!email || email === requester || seen[email]) continue;
    seen[email] = true;
    normalized.push(email);
  }

  data.sharedWith = normalized;
  file.setContent(JSON.stringify(data, null, 2));
  return { status: "success", action: "shared", id, sharedWith: normalized };
}

function listActiveUsers() {
  try {
    const ss = SpreadsheetApp.openById(USERS_SHEET_ID);
    const sheet = ss.getSheets()[0];
    const values = sheet.getDataRange().getValues();

    if (!values || values.length === 0) return [];

    const header = values[0].map(v => String(v || "").trim().toLowerCase());
    const findCol = (candidates) => {
      for (let i = 0; i < candidates.length; i++) {
        const idx = header.indexOf(candidates[i]);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const colId = findCol(["id", "userid", "user_id", "uid", "usuario id", "identificador"]);
    const colEmail = findCol(["email", "correo", "correo electronico", "correo electrónico", "mail", "e-mail"]);
    const colName = findCol(["name", "nombre", "displayname", "display_name", "usuario", "user", "nombre completo"]);
    const colActive = findCol(["activo", "active", "estado", "status", "habilitado", "enabled"]);

    const result = [];
    const seen = {};
    const isActiveValue = function(value) {
      if (colActive === -1) return true;
      const raw = String(value || "").trim().toLowerCase();
      if (!raw) return false;
      return raw === "true" || raw === "1" || raw === "si" || raw === "sí" || raw === "yes" || raw === "activo" || raw === "active" || raw === "habilitado";
    };

    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (!row || !isActiveValue(row[colActive])) continue;

      const rawId = colId !== -1 ? String(row[colId] || "").trim() : "";
      const rawEmail = colEmail !== -1 ? String(row[colEmail] || "").trim() : "";
      const rawName = colName !== -1 ? String(row[colName] || "").trim() : "";

      let id = rawId || rawEmail || rawName;
      if (!id) continue;
      id = String(id).trim();

      const email = rawEmail ? String(rawEmail).trim().toLowerCase() : "";
      const name = rawName ? String(rawName).trim() : (email || id);
      const key = String(id).trim().toLowerCase();
      if (seen[key]) continue;
      seen[key] = true;

      result.push({
        id: String(id).trim(),
        name: String(name).trim(),
        email: email || undefined
      });
    }

    if (result.length === 0) {
      const emails = [];
      const flatSeen = {};
      for (let r = 0; r < values.length; r++) {
        for (let c = 0; c < values[r].length; c++) {
          const cell = String(values[r][c] || "").trim();
          if (!cell || cell.indexOf("@") === -1) continue;
          const normalized = cell.toLowerCase();
          if (flatSeen[normalized]) continue;
          flatSeen[normalized] = true;
          emails.push({ id: normalized, name: normalized, email: normalized });
        }
      }
      emails.sort((a, b) => a.id.localeCompare(b.id));
      return emails;
    }

    result.sort((a, b) => String(a.name || a.id).localeCompare(String(b.name || b.id)));
    return result;
  } catch (e) {
    return {
      users: [],
      warning: "No se pudo leer la hoja de usuarios. Error: " + e.toString()
    };
  }
}

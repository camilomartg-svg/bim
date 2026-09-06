/**
 * Apps Script independiente para Configuración de Incidencias.
 *
 * Despliega este proyecto como Web App. No comparte código ni URL con el
 * gateway general de archivos del portal.
 */
const INCIDENCIAS_ROOT_FOLDER_ID = '1-9SumRefiih81mc_eASsswy_W_U0-qe5';
const SPREADSHEET_NAME = 'Configuración de Incidencias';

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function readBody_(e) {
  try {
    return JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (_) {
    return {};
  }
}

function projectContext_(data) {
  const company = data.company || {};
  const project = data.project || {};
  const companyName = String(company.name || company.id || '').trim();
  const projectName = String(project.name || project.slug || project.id || '').trim();
  if (!companyName || !projectName) throw new Error('Empresa y proyecto son obligatorios.');
  return { companyName: companyName, projectName: projectName };
}

function folder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function spreadsheet_(data) {
  const context = projectContext_(data);
  const root = DriveApp.getFolderById(INCIDENCIAS_ROOT_FOLDER_ID);
  const projectFolder = folder_(folder_(root, context.companyName), context.projectName);
  const files = projectFolder.getFilesByName(SPREADSHEET_NAME);
  if (files.hasNext()) return SpreadsheetApp.open(files.next());

  const book = SpreadsheetApp.create(SPREADSHEET_NAME);
  const file = DriveApp.getFileById(book.getId());
  projectFolder.addFile(file);
  const parents = file.getParents();
  while (parents.hasNext()) {
    const parent = parents.next();
    if (parent.getId() !== projectFolder.getId()) parent.removeFile(file);
  }
  return book;
}

function settingsSheet_(book) {
  let sheet = book.getSheetByName('Configuración');
  if (sheet) return sheet;
  const sheets = book.getSheets();
  sheet = sheets.length === 1 ? sheets[0] : book.insertSheet('Configuración');
  sheet.setName('Configuración');
  return sheet;
}

function locationsSheet_(book) {
  let sheet = book.getSheetByName('Ubicaciones');
  if (!sheet) sheet = book.insertSheet('Ubicaciones');
  return sheet;
}

function writeLocations_(book, units) {
  const sheet = locationsSheet_(book);
  const valid = Array.isArray(units) ? units.filter(function(unit) { return unit && unit.id && unit.name; }) : [];
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 2).setValues([['ID de unidad', 'Ubicación JSON']]);
  if (valid.length) {
    sheet.getRange(2, 1, valid.length, 2).setValues(valid.map(function(unit) {
      return [String(unit.id), JSON.stringify(unit)];
    }));
  }
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
}

function saveConfiguration_(data) {
  const book = spreadsheet_(data);
  const context = projectContext_(data);
  const config = Object.assign({}, data.config || {});
  const locations = config.locations;
  delete config.locations;
  const sheet = settingsSheet_(book);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, 2).setValues([['Campo', 'Valor']]);
  sheet.getRange(2, 1, 4, 2).setValues([
    ['Actualizado', new Date().toISOString()],
    ['Empresa', context.companyName],
    ['Proyecto', context.projectName],
    ['Configuración JSON', JSON.stringify(config)]
  ]);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, 2);
  if (Array.isArray(locations)) writeLocations_(book, locations);
  return { status: 'success', storage: { spreadsheetId: book.getId(), spreadsheetUrl: book.getUrl() } };
}

function saveLocation_(data) {
  const unit = data.unit || {};
  if (!unit.id) throw new Error('La unidad no tiene ID.');
  const book = spreadsheet_(data);
  const sheet = locationsSheet_(book);
  if (sheet.getLastRow() === 0) writeLocations_(book, []);
  const lastRow = sheet.getLastRow();
  const ids = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(function(row) { return String(row[0]); }) : [];
  const index = ids.indexOf(String(unit.id));
  if (data.operation === 'delete') {
    if (index >= 0) sheet.deleteRow(index + 2);
  } else {
    const row = [[String(unit.id), JSON.stringify(unit)]];
    if (index >= 0) sheet.getRange(index + 2, 1, 1, 2).setValues(row);
    else sheet.getRange(lastRow + 1, 1, 1, 2).setValues(row);
  }
  return { status: 'success', storage: { spreadsheetId: book.getId(), spreadsheetUrl: book.getUrl() } };
}

function getLocations_(data) {
  const sheet = locationsSheet_(spreadsheet_(data));
  if (sheet.getLastRow() <= 1) return { status: 'success', units: [] };
  const units = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues()
    .map(function(row) { try { return JSON.parse(String(row[1] || '')); } catch (_) { return null; } })
    .filter(function(unit) { return unit && unit.id && unit.name; });
  return { status: 'success', units: units };
}

function doPost(e) {
  try {
    const data = readBody_(e);
    if (data.action === 'saveIncidentsProjectConfig') return json_(saveConfiguration_(data));
    if (data.action === 'saveIncidentsLocation') return json_(saveLocation_(data));
    return json_({ status: 'error', message: 'Acción no soportada.' });
  } catch (error) {
    return json_({ status: 'error', message: String(error) });
  }
}

function doGet(e) {
  try {
    const params = (e && e.parameter) || {};
    if (params.action === 'getIncidentsLocations') {
      return json_(getLocations_({ company: { id: params.empresa, name: params.empresa }, project: { id: params.proyecto, name: params.proyecto } }));
    }
    return json_({ status: 'error', message: 'Acción no soportada.' });
  } catch (error) {
    return json_({ status: 'error', message: String(error) });
  }
}

/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - REGISTRO DE ESTUDIANTES DIPLOMADO DESARROLLADOR BIM
 * =========================================================================
 * 
 * Hoja de Cálculo Vinculada Oficial:
 * https://docs.google.com/spreadsheets/d/1RweFnE2uHa9rqws8BmtEAQsh0hxV934207ivZ-7QMsU/edit?usp=sharing
 * ID: 1RweFnE2uHa9rqws8BmtEAQsh0hxV934207ivZ-7QMsU
 * 
 * INSTRUCCIONES DE DESPLIEGUE RÁPIDO (EN 1 MINUTO):
 * 1. Abre tu hoja de cálculo: https://docs.google.com/spreadsheets/d/1RweFnE2uHa9rqws8BmtEAQsh0hxV934207ivZ-7QMsU/edit
 * 2. En el menú superior de Google Sheets, haz clic en: Extensiones > Apps Script.
 * 3. Si hay código anterior en el editor (ej. myFunction), bórralo y pega TODO este código.
 * 4. Haz clic en "Guardar" (icono de disquete o Ctrl + S).
 * 5. Haz clic en el botón azul "Implementar" (arriba a la derecha) > "Nueva implementación".
 * 6. En el selector de tipo (icono de engranaje ⚙️), elige: "Aplicación web".
 *    - Descripción: "Registro Inscripciones Diplomado BIM nora"
 *    - Ejecutar como: "Yo" (tu cuenta de Google)
 *    - Quién tiene acceso: "Cualquier persona" (Anyone / Anyone even anonymous)  <-- ¡IMPORTANTE!
 * 7. Haz clic en "Implementar", autoriza los permisos de Google Sheets si te los solicita.
 * 8. Copia la URL de la aplicación web generada (termina en /exec) y ¡listo!
 * =========================================================================
 */

const SPREADSHEET_ID = "1RweFnE2uHa9rqws8BmtEAQsh0hxV934207ivZ-7QMsU";

const COLUMNS_HEADERS = [
  'Fecha y Hora',
  'Nombre y Apellidos',
  'País',
  'Ciudad',
  'Edad',
  'Profesión / Ocupación',
  'Teléfono de Contacto / WhatsApp',
  'Correo Electrónico',
  'Curso al que se Inscribe',
  'Documento de Identidad',
  'Empresa o Universidad',
  'Referencia Wompi',
  'Monto COP',
  'Estado de Inscripción'
];

function doGet(e) {
  try {
    const p = (e && e.parameter) ? e.parameter : {};
    const callback = p.callback || '';

    if (p.action === 'inscribirEstudiante' || p.nombre) {
      return response_(registrarEstudiante_(p), callback);
    }

    if (p.action === 'actualizarPagoEstudiante') {
      return response_(actualizarPagoEstudiante_(p), callback);
    }

    return response_({
      status: 'success',
      message: 'API de Inscripciones Diplomado BIM activa y en línea.',
      spreadsheetId: SPREADSHEET_ID,
      timestamp: new Date().toISOString()
    }, callback);
  } catch (err) {
    return response_({ status: 'error', message: err.toString() }, '');
  }
}

function doPost(e) {
  try {
    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (err) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    const action = String(data.action || (e && e.parameter && e.parameter.action) || 'inscribirEstudiante');

    if (action === 'actualizarPagoEstudiante') {
      return response_(actualizarPagoEstudiante_(data), null);
    }

    return response_(registrarEstudiante_(data), null);
  } catch (err) {
    return response_({ status: 'error', message: err.toString() }, null);
  }
}

function getSpreadsheet_(customId) {
  const targetId = customId || SPREADSHEET_ID;
  try {
    return SpreadsheetApp.openById(targetId);
  } catch (err) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function getOrCreateInscripcionesSheet_(doc) {
  let sheet = doc.getSheetByName('Inscripciones');
  if (!sheet) {
    const sheets = doc.getSheets();
    if (sheets.length > 0 && sheets[0].getLastRow() === 0) {
      sheet = sheets[0];
      sheet.setName('Inscripciones');
    } else {
      sheet = doc.insertSheet('Inscripciones');
    }
  }

  // Verificar y asegurar encabezados con formato
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(COLUMNS_HEADERS);
    const headerRange = sheet.getRange(1, 1, 1, COLUMNS_HEADERS.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#047857'); // Verde Esmeralda corporativo
    headerRange.setFontColor('#ffffff');
    headerRange.setHorizontalAlignment('center');
    sheet.setFrozenRows(1);
    sheet.setRowHeight(1, 35);
  } else {
    // Si ya existen datos, asegurar que no falten columnas
    const existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
    const missing = COLUMNS_HEADERS.filter(h => existing.indexOf(h) === -1);
    if (missing.length > 0) {
      sheet.getRange(1, existing.length + 1, 1, missing.length).setValues([missing]);
      sheet.getRange(1, existing.length + 1, 1, missing.length).setFontWeight('bold');
    }
  }

  return sheet;
}

function registrarEstudiante_(data) {
  const doc = getSpreadsheet_(data.spreadsheetId);
  if (!doc) {
    throw new Error('No se pudo abrir la hoja de cálculo con ID: ' + (data.spreadsheetId || SPREADSHEET_ID));
  }

  const sheet = getOrCreateInscripcionesSheet_(doc);

  const fecha = data.fecha || new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const nombre = String(data.nombre || '').trim();
  const pais = String(data.pais || '').trim();
  const ciudad = String(data.ciudad || '').trim();
  const edad = String(data.edad || '').trim();
  const profesion = String(data.profesion || '').trim();
  const telefono = String(data.telefono || '').trim();
  const correo = String(data.correo || data.email || '').trim();
  const curso = String(data.curso || 'MÓDULO 1: Automatización BIM I – Lógica Computacional, Dynamo, Python e IA').trim();
  const documento = String(data.documento || data.doc || '').trim();
  const empresa = String(data.empresa || '').trim();
  const referencia = String(data.referencia || data.reference || '').trim();
  const monto = data.montoCOP || 980000;
  const estado = data.estado || 'Pendiente Pago Wompi';

  const newRow = [
    fecha,
    nombre,
    pais,
    ciudad,
    edad,
    profesion,
    telefono,
    correo,
    curso,
    documento,
    empresa,
    referencia,
    monto,
    estado
  ];

  sheet.appendRow(newRow);

  // Autoajuste de columnas para visualización clara
  try {
    for (let c = 1; c <= COLUMNS_HEADERS.length; c++) {
      sheet.autoResizeColumn(c);
    }
  } catch (e) {}

  return {
    status: 'success',
    message: 'Estudiante registrado correctamente en Google Sheets',
    estudiante: {
      nombre: nombre,
      pais: pais,
      ciudad: ciudad,
      edad: edad,
      profesion: profesion,
      telefono: telefono,
      correo: correo,
      curso: curso,
      referencia: referencia
    }
  };
}

function actualizarPagoEstudiante_(data) {
  const doc = getSpreadsheet_(data.spreadsheetId);
  if (!doc) throw new Error('No se pudo acceder a la hoja de cálculo');

  const sheet = getOrCreateInscripcionesSheet_(doc);
  const refBuscada = String(data.referencia || data.reference || '').trim();
  if (!refBuscada) return { status: 'ignored', message: 'Sin referencia especificada' };

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  const refColIdx = headers.indexOf('Referencia Wompi');
  const estadoColIdx = headers.indexOf('Estado de Inscripción');

  if (refColIdx === -1 || estadoColIdx === -1) {
    return { status: 'error', message: 'Columnas requeridas no encontradas' };
  }

  for (let r = 1; r < values.length; r++) {
    if (String(values[r][refColIdx]).trim() === refBuscada) {
      sheet.getRange(r + 1, estadoColIdx + 1).setValue('PAGADO - APROBADO WOMPI');
      sheet.getRange(r + 1, estadoColIdx + 1).setBackground('#d1fae5'); // Verde claro
      sheet.getRange(r + 1, estadoColIdx + 1).setFontColor('#065f46');
      return { status: 'success', message: 'Estado de pago actualizado a PAGADO' };
    }
  }

  return { status: 'not_found', message: 'No se encontró la referencia ' + refBuscada };
}

function response_(payload, callback) {
  const jsonStr = JSON.stringify(payload);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonStr + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}

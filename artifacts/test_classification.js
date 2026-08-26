// Scratch test for refined cleanSpecialty classification logic
const cleanSpecialty = (folder, filename) => {
  const nameLower = (filename || '').toLowerCase();
  
  // Clean folder prefix to avoid matching "estados" as "est" (Estructural)
  let folderClean = (folder || '').toLowerCase();
  folderClean = folderClean
    .replace(/^\.?estados\/?/i, '')
    .replace(/^\.?versiones\/?/i, '')
    .trim();
  
  const combined = `${folderClean} | ${nameLower}`;

  // 1. Arquitectura
  if (
    combined.includes('arquitectura') ||
    combined.includes('architecture') ||
    /(?:^|[^a-z])arq(?:[^a-z]|$)/i.test(combined)
  ) {
    return 'Arquitectura';
  }

  // 2. Estructural
  if (
    combined.includes('estructural') ||
    combined.includes('estructura') ||
    combined.includes('structural') ||
    combined.includes('structure') ||
    /(?:^|[^a-z])est(?:[^a-z]|$)/i.test(combined)
  ) {
    return 'Estructural';
  }

  // 3. Eléctrico
  if (
    combined.includes('electrico') ||
    combined.includes('eléctrico') ||
    combined.includes('electrical') ||
    /(?:^|[^a-z])elec(?:[^a-z]|$)/i.test(combined)
  ) {
    return 'Eléctrico';
  }

  // 4. Hidrosanitario
  if (
    combined.includes('hidrosanitario') ||
    combined.includes('hidraulico') ||
    combined.includes('hidráulico') ||
    combined.includes('plomeria') ||
    combined.includes('plomería') ||
    combined.includes('sanitario') ||
    combined.includes('desagues') ||
    combined.includes('desagües') ||
    combined.includes('plumbing') ||
    combined.includes('sanitary')
  ) {
    return 'Hidrosanitario';
  }

  // 5. Mecánico
  if (
    combined.includes('mecanico') ||
    combined.includes('mecánico') ||
    combined.includes('hvac') ||
    combined.includes('mechanical')
  ) {
    return 'Mecánico';
  }

  // 6. Gas
  if (/(?:^|[^a-z])gas(?:[^a-z]|$)/i.test(combined)) {
    return 'Gas';
  }

  // 7. Red Contra Incendio
  if (
    combined.includes('incendio') ||
    combined.includes('extincion') ||
    combined.includes('extinción') ||
    combined.includes('fire')
  ) {
    return 'Red Contra Incendio';
  }

  if (!folder) return 'General';
  const str = String(folder).replace(/^\.?estados\/?/i, '').replace(/^\.?versiones\/?/i, '').trim();
  if (!str || str.startsWith('.')) return 'General';
  const parts = str.split('/').filter(Boolean);
  if (parts.length === 0) return 'General';
  const last = parts[parts.length - 1];
  if (last.toLowerCase() === 'compartido' || last.toLowerCase() === 'publicado' || last.toLowerCase() === 'en_progreso') {
    return parts.length > 1 ? parts[0] : 'General';
  }
  return last.charAt(0).toUpperCase() + last.slice(1);
};

const testCases = [
  { folder: "ARQ", filename: "plano.pdf", expected: "Arquitectura" },
  { folder: "Diseno", filename: "EST-01.pdf", expected: "Estructural" },
  { folder: "Eléctrico", filename: "plano.pdf", expected: "Eléctrico" },
  { folder: "plomería", filename: "plano.pdf", expected: "Hidrosanitario" },
  { folder: "HVAC", filename: "mecanico.pdf", expected: "Mecánico" },
  { folder: "red de gas", filename: "gas_01.pdf", expected: "Gas" },
  { folder: "extinción", filename: "fire-system.pdf", expected: "Red Contra Incendio" },
  { folder: "General", filename: "documento.pdf", expected: "General" },
  { folder: "estados/compartido/arquitectura", filename: "arq.pdf", expected: "Arquitectura" },
  { folder: "estados/compartido/Redes", filename: "plano_elec.pdf", expected: "Eléctrico" },
  { folder: "versiones/en_progreso/Estructuras", filename: "est-02.pdf", expected: "Estructural" },
  
  // Edge cases to prevent false positives:
  { folder: "estados/compartido", filename: "fachada_oeste.pdf", expected: "General" }, // "oeste" shouldn't match "est"
  { folder: "estados/compartido", filename: "parque_infantil.pdf", expected: "General" }, // "parque" shouldn't match "arq"
  { folder: "estados/compartido", filename: "seleccionar_equipos.pdf", expected: "General" }, // "seleccionar" shouldn't match "elec"
  { folder: "estados/compartido", filename: "plano_este.pdf", expected: "General" }, // "este" shouldn't match "est"
  { folder: "estados/compartido", filename: "forestal_zonas.pdf", expected: "General" }, // "forestal" shouldn't match "est"
];

let failed = 0;
testCases.forEach((tc, idx) => {
  const result = cleanSpecialty(tc.folder, tc.filename);
  if (result === tc.expected) {
    console.log(`PASS [${idx + 1}]: folder="${tc.folder}", filename="${tc.filename}" => "${result}"`);
  } else {
    console.error(`FAIL [${idx + 1}]: folder="${tc.folder}", filename="${tc.filename}". Expected "${tc.expected}", got "${result}"`);
    failed++;
  }
});

if (failed === 0) {
  console.log("All classification tests passed successfully!");
  process.exit(0);
} else {
  console.error(`${failed} test(s) failed.`);
  process.exit(1);
}

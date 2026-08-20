// test_silo.js
// Mock testing of CDE NORA RBAC logic

const activeProject = {
  "name": "UNUM",
  "slug": "nuevo-proyecto-1786128516688",
  "members": [
    "info@meshestudio.com",
    "camilo.martinez@meshestudio.com",
    "camilomartg@gmail.com",
    "alc.spk.2@gmail.com"
  ],
  "equiposDeTarea": [
    {
      "name": "HIDROSANITÁRIO",
      "members": [
        "camilomartg@gmail.com"
      ]
    },
    {
      "name": "ARQUITECTURA",
      "members": [
        "info@meshestudio.com",
        "camilo.martinez@meshestudio.com",
        "alc.spk.2@gmail.com"
      ]
    }
  ],
  "iso19650": {
    "projectAdmins": [
      "alc.spk.2@gmail.com"
    ],
    "deliveryTeams": [
      {
        "name": "HIDROSANITÁRIO",
        "leadEmail": "camilomartg@gmail.com",
        "members": [
          "camilomartg@gmail.com"
        ]
      },
      {
        "name": "ARQUITECTURA",
        "leadEmail": "info@meshestudio.com",
        "members": [
          "info@meshestudio.com",
          "camilo.martinez@meshestudio.com",
          "alc.spk.2@gmail.com"
        ]
      }
    ]
  }
};

const currentCompany = {
  admins: [],
  members: []
};

const companyId = "empresa-1786128422720";

const cleanSpecialty = (folder) => {
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

function getUserDeliveryTeams(email) {
  if (!email || !activeProject) return [];
  const cleanEmail = email.toLowerCase().trim();
  const teams = [];

  const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];
  deliveryTeams.forEach(dt => {
    const isMember = Array.isArray(dt.members) && dt.members.map(m => m.toLowerCase().trim()).includes(cleanEmail);
    const isLead = dt.leadEmail && dt.leadEmail.toLowerCase().trim() === cleanEmail;
    if (isMember || isLead) {
      teams.push(dt.name.toUpperCase().trim());
    }
  });

  const equipos = activeProject.equiposDeTarea || [];
  equipos.forEach(eq => {
    const isMember = Array.isArray(eq.members) && eq.members.map(m => m.toLowerCase().trim()).includes(cleanEmail);
    if (isMember && !teams.includes(eq.name.toUpperCase().trim())) {
      teams.push(eq.name.toUpperCase().trim());
    }
  });

  return teams;
}

function getFileDeliveryTeams(file) {
  if (!file || !activeProject) return [];
  const teams = new Set();

  // 1. Try folder specialty first (Primary source of truth)
  const specialty = cleanSpecialty(file.folder).toUpperCase().trim();
  if (specialty && specialty !== 'GENERAL') {
    const normalizeName = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    const normSpecialty = normalizeName(specialty);

    const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];
    deliveryTeams.forEach(dt => {
      if (normalizeName(dt.name) === normSpecialty) {
        teams.add(dt.name.toUpperCase().trim());
      }
    });

    const equipos = activeProject.equiposDeTarea || [];
    equipos.forEach(eq => {
      if (normalizeName(eq.name) === normSpecialty) {
        teams.add(eq.name.toUpperCase().trim());
      }
    });
  }

  // 2. Fallback / Secondary source: check by uploader/changedByEmail
  if (teams.size === 0) {
    const uEmail = (file.changedByEmail || '').toLowerCase().trim();
    if (uEmail && uEmail !== 'unassigned@nora.cde') {
      const deliveryTeams = activeProject.iso19650?.deliveryTeams || [];
      deliveryTeams.forEach(dt => {
        const isMember = Array.isArray(dt.members) && dt.members.map(m => m.toLowerCase().trim()).includes(uEmail);
        const isLead = dt.leadEmail && dt.leadEmail.toLowerCase().trim() === uEmail;
        if (isMember || isLead) {
          teams.add(dt.name.toUpperCase().trim());
        }
      });

      const equipos = activeProject.equiposDeTarea || [];
      equipos.forEach(eq => {
        const isMember = Array.isArray(eq.members) && eq.members.map(m => m.toLowerCase().trim()).includes(uEmail);
        if (isMember) {
          teams.add(eq.name.toUpperCase().trim());
        }
      });
    }
  }

  return Array.from(teams);
}

function isUserAuthorizedForFile(currentUser, file, action = 'view') {
  if (!currentUser) return false;
  const email = (currentUser.username || currentUser.email || currentUser.userAccount || '').toLowerCase().trim();

  const superAdmins = ['imagina3ddesign@gmail.com', 'mcmartinezg@unal.edu.co'];
  const isSuperAdmin = superAdmins.includes(email) || currentUser.role === 'SUPER_ADMIN' || currentUser.role === 'SUPER_ADMINISTRADOR';

  const companyAdmins = Array.isArray(currentCompany?.admins) ? currentCompany.admins.map(a => a.toLowerCase().trim()) : [];
  const memberMatch = Array.isArray(currentCompany?.members) ? currentCompany.members.find(m => m.email && m.email.toLowerCase().trim() === email) : null;
  const isMemberAdmin = memberMatch && (memberMatch.role === 'ADMINISTRADOR_EMPRESA' || memberMatch.role === 'ADMINISTRADOR');

  const isCompanyAdmin = isSuperAdmin || companyAdmins.includes(email) || isMemberAdmin || (currentUser.adminEmpresaId && currentUser.adminEmpresaId === companyId && (currentUser.role === 'ADMINISTRADOR_EMPRESA' || currentUser.role === 'SUPER_ADMINISTRADOR' || currentUser.role === 'SUPER_ADMIN'));

  const projectAdmins = Array.isArray(activeProject?.iso19650?.projectAdmins)
    ? activeProject.iso19650.projectAdmins.map(a => a.toLowerCase().trim())
    : [];
  const isProjectAdmin = isCompanyAdmin || projectAdmins.includes(email);

  if (isProjectAdmin) return true;

  // El uploader siempre puede ver su propio archivo
  const fileUploader = (file.changedByEmail || '').toLowerCase().trim();
  if (fileUploader && fileUploader === email) return true;

  // Para visualizar archivos COMPARTIDOS o PUBLICADOS (no EN_PROGRESO), cualquier miembro del proyecto puede verlos
  if (action === 'view' && file.status !== 'EN_PROGRESO') {
    const isMember = (activeProject?.members || []).map(m => m.toLowerCase().trim()).includes(email);
    if (isMember) return true;
    
    const userTeams = getUserDeliveryTeams(email);
    if (userTeams.length > 0) return true;
  }

  // Para archivos EN_PROGRESO (WIP) o para acciones de edición/gestión:
  // Se requiere que el usuario y el archivo compartan al menos un equipo de entrega (comparación insensible a acentos)
  const fileTeams = getFileDeliveryTeams(file);
  const userTeams = getUserDeliveryTeams(email);

  const normalizeName = str => String(str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
  const normFileTeams = fileTeams.map(normalizeName);
  const normUserTeams = userTeams.map(normalizeName);

  if (normFileTeams.length === 0) return false;

  return normFileTeams.some(team => normUserTeams.includes(team));
}

// TEST CASES

const users = {
  hidrosanitario: { name: 'Camilo Martinez', email: 'camilomartg@gmail.com', role: 'COLABORADOR' },
  arquitectura: { name: 'Arquitecto', email: 'camilo.martinez@meshestudio.com', role: 'COLABORADOR' },
  admin: { name: 'Admin', email: 'alc.spk.2@gmail.com', role: 'COLABORADOR' }
};

const testFiles = [
  {
    desc: "1. Raw Drive file in ARQUITECTURA folder (not in status sheet, owner email missing)",
    file: {
      folder: "ARQUITECTURA",
      status: "EN_PROGRESO",
      changedByEmail: "unassigned@nora.cde",
      ownerEmail: ""
    }
  },
  {
    desc: "2. Raw Drive file in ARQUITECTURA folder (not in status sheet, owner email is Arquitectura member)",
    file: {
      folder: "ARQUITECTURA",
      status: "EN_PROGRESO",
      changedByEmail: "camilo.martinez@meshestudio.com"
    }
  },
  {
    desc: "3. Raw Drive file in General folder (no status sheet entry, owner email unassigned)",
    file: {
      folder: "General",
      status: "EN_PROGRESO",
      changedByEmail: "unassigned@nora.cde"
    }
  },
  {
    desc: "4. Raw Drive file in General folder (no status entry, but owned by Hidrosanitario user)",
    file: {
      folder: "General",
      status: "EN_PROGRESO",
      changedByEmail: "camilomartg@gmail.com"
    }
  },
  {
    desc: "5. Shared file in ARQUITECTURA folder (not EN_PROGRESO status)",
    file: {
      folder: "ARQUITECTURA",
      status: "COMPARTIDO",
      changedByEmail: "camilo.martinez@meshestudio.com"
    }
  }
];

testFiles.forEach(tc => {
  console.log(`\n--- Test case: ${tc.desc}`);
  console.log(`Resolved File Teams:`, getFileDeliveryTeams(tc.file));
  
  for (const [key, user] of Object.entries(users)) {
    const auth = isUserAuthorizedForFile(user, tc.file, 'view');
    console.log(`  User ${user.email} (${key.toUpperCase()}): Authorized? ${auth ? 'YES ✅' : 'NO ❌'}`);
  }
});

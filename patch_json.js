const fs = require('fs');
let empresas = JSON.parse(fs.readFileSync('empresas.json', 'utf8'));
empresas.push({
    "id": "empresa-1784504221822",
    "name": "Constructora Horizonte",
    "code": "005",
    "admins": [],
    "zonaHoraria": "America/Bogota",
    "members": [],
    "razonSocial": "Constructora Horizonte SAS",
    "terminosAceptados": true,
    "tratamientoDatos": true,
    "image": "https://i.postimg.cc/02mTnnQv/21bd5ee9d2351270615280386caad1f3.jpg",
    "location": "Bogota DC, Colombia"
});
fs.writeFileSync('empresas.json', JSON.stringify(empresas, null, 2));
console.log('Appended Constructora Horizonte');

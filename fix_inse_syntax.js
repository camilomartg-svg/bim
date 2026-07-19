const fs = require('fs');
let html = fs.readFileSync('inse.html', 'utf8');

const searchRegex = /picture: window\.tempGoogleUser\?\.picture \|\| ''\s*\};/g;

html = html.replace(searchRegex, `picture: window.tempGoogleUser?.picture || ''
                        };
                    } catch (error) {
                        console.error('Error validando el usuario:', error);
                        alert('Error de conexión con la base de datos de usuarios.');
                        return;
                    }`);

fs.writeFileSync('inse.html', html);
console.log('Fixed syntax error in inse.html');

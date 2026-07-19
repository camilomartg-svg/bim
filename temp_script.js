
        // --- ROTACIÓN DE IMAGEN DE FONDO ---
        const bgImages = [
            'https://i.postimg.cc/gjdf4ybv/1bed16470705aeff4a1bf5c9d6a4d92d.jpg',
            'https://i.postimg.cc/Y0kJ8NBF/6fe9d33bfb28fcbe8acc5d8450198ace.jpg',
            'https://i.postimg.cc/br8KL0fS/9ac65d507569e6a578661338b7cf711c.jpg',
            'https://i.postimg.cc/WzjQSmcm/a4914f0568cbc13fb185237cab88c64e.jpg',
            'https://i.postimg.cc/x8YWgGVJ/d603ef667ae6d6d62abfa6e52e31e819.jpg',
            'https://i.postimg.cc/nrZ6TKfG/dfde730b8f85a5ed6a558a6d216008a3.jpg',
            'https://i.postimg.cc/T1GZQjvW/e1c05af2d2065ca689c71c6a36dae203.jpg'
        ];

        document.addEventListener('DOMContentLoaded', () => {
            const leftPanel = document.getElementById('left-panel-bg');
            if (leftPanel) {
                const randomImg = bgImages[Math.floor(Math.random() * bgImages.length)];
                leftPanel.style.backgroundImage = `url('${randomImg}')`;
            }

            // GESTIÓN DEL TEMA (MODO OSCURO/CLARO)
            const htmlEl = document.documentElement;
            const savedTheme = localStorage.getItem('theme') || 'light';
            if (savedTheme === 'dark') {
                htmlEl.classList.add('dark');
            }
        });

        // --- LÓGICA DE INICIO DE SESIÓN CON MICROSOFT (MSAL) ---
        const loginButton = document.getElementById('login-button');
        const switchUserButton = document.getElementById('switch-user-button');
        const errorMessage = document.getElementById('error-message');
        const keepSignedInCheckbox = document.getElementById('keep-signed-in');

        async function handleLogin(forceAccountSelection = false) {
            try {
                errorMessage.textContent = "";
                const cacheLocation = keepSignedInCheckbox.checked ? "localStorage" : "sessionStorage";
                
                const msalConfig = {
                    auth: {
                        clientId: "084a9828-6166-4fef-b012-b2bafbececdf", 
                        authority: "https://login.microsoftonline.com/common",
                        redirectUri: window.location.href,
                    },
                    cache: {
                        cacheLocation: cacheLocation,
                        storeAuthStateInCookie: false,
                    }
                };

                const msalInstance = new msal.PublicClientApplication(msalConfig);

                if (forceAccountSelection) {
                    sessionStorage.removeItem('userAccount');
                    localStorage.removeItem('userAccount');
                }

                await msalInstance.loginPopup({
                    scopes: ["User.Read"],
                    prompt: forceAccountSelection ? "select_account" : undefined
                });

                const account = msalInstance.getAllAccounts()[0];

                if (account) {
                    const ROLES_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx266o-ea0OAT-xE_9kKSKChRk7MJo0sthjwWI7WUCbFzq3Y578sbD8HgZpWSb7v8H8Fw/exec';
                    const normalizedAccountEmail = account.username.trim().toLowerCase();
                    
                    let userProfile = null;
                    try {
                        const response = await fetch(ROLES_SCRIPT_URL);
                        const usersList = await response.json();
                        const dbUser = usersList.find(u => u.email === normalizedAccountEmail);
                        
                        if (!dbUser) {
                            alert('Tu correo no está registrado en el sistema. Por favor, crea una cuenta primero.');
                            sessionStorage.removeItem('userAccount');
                            localStorage.removeItem('userAccount');
                            return;
                        }
                        
                        if (dbUser.estado !== 'APROBADO' && dbUser.rol !== 'SUPER_ADMINISTRADOR') {
                            alert('Tu cuenta está en estado ' + (dbUser.estado || 'PENDIENTE') + '. Espera a que un administrador te apruebe el acceso.');
                            sessionStorage.removeItem('userAccount');
                            localStorage.removeItem('userAccount');
                            return;
                        }
                        
                        userProfile = {
                            name: dbUser.nombre || account.name,
                            username: dbUser.email,
                            role: dbUser.rol || 'INVITADO',
                            empresa: dbUser.empresa || '',
                            especialidad: dbUser.especialidad || '',
                            cargo: dbUser.cargo || '',
                            picture: window.tempGoogleUser?.picture || ''
                        };
                    } catch(e) {
                        console.error('Error de base de datos:', e);
                        alert('Error al conectar con la base de datos de usuarios.');
                        return;
                    }                    

                    if (keepSignedInCheckbox.checked) {
                        localStorage.setItem('userAccount', JSON.stringify(userProfile));
                    } else {
                        sessionStorage.setItem('userAccount', JSON.stringify(userProfile));
                    }

                    window.location.href = 'https://norabim.com/empresas.html';
                }
            } catch (error) {
                console.error(error);
                errorMessage.textContent = "Error al iniciar sesión. Por favor, inténtalo de nuevo.";
            }
        }

        if (loginButton) loginButton.addEventListener('click', () => handleLogin(false));
        if (switchUserButton) switchUserButton.addEventListener('click', () => handleLogin(true));

        // --- LÓGICA DE REGISTRO / GOOGLE ---
        let googleTokenClient;

        window.initGoogleAuth = function() {
            googleTokenClient = google.accounts.oauth2.initTokenClient({
                client_id: '698220967048-e8ngjos8dml5soanb2dup9r5966lpsmm.apps.googleusercontent.com',
                scope: 'email profile openid',
                callback: (tokenResponse) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        // Obtener perfil del usuario con el token
                        fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                            headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
                        })
                        .then(res => res.json())
                        .then(async profile => {
                            const normalizedAccountEmail = profile.email.trim().toLowerCase();
                            let userRole = null;
                            const ROLES_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx4NEpE6EyrC2ggk8To0F0TP5P9y0YnaxiWzCbcIhSR7-KRSy4Wu0PM9hYyNY5y72Q/exec';

                            try {
                                const configRes = await fetch('portal-config.json');
                                if (configRes.ok) {
                                    const portalConfig = await configRes.json();
                                    const superAdmins = portalConfig.superAdmins || ['imagina3ddesign@gmail.com', 'mcmartinezg@unal.edu.co'];
                                    if (superAdmins.some(email => email.toLowerCase() === normalizedAccountEmail)) {
                                        userRole = 'SUPER_ADMINISTRADOR';
                                    }
                                }
                            } catch (e) {
                                const fallbackSuperAdmins = ['imagina3ddesign@gmail.com', 'mcmartinezg@unal.edu.co'];
                                if (fallbackSuperAdmins.includes(normalizedAccountEmail)) {
                                    userRole = 'SUPER_ADMINISTRADOR';
                                }
                            }

                            if (!userRole) {
                                try {
                                    const empRes = await fetch('empresas.json');
                                    if (empRes.ok) {
                                        const empresas = await empRes.json();
                                        for (const empresa of empresas) {
                                            if (empresa.admins && empresa.admins.some(email => email.toLowerCase() === normalizedAccountEmail)) {
                                                userRole = 'ADMINISTRADOR_EMPRESA';
                                                window.adminEmpresaId = empresa.id;
                                                break;
                                            }
                                            if (empresa.members) {
                                                const member = empresa.members.find(m => m.email.toLowerCase() === normalizedAccountEmail);
                                                if (member) {
                                                    userRole = member.role || 'INVITADO';
                                                    window.adminEmpresaId = empresa.id;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                } catch (e) {}
                            }

                            if (!userRole) {
                                try {
                                    const response = await fetch(ROLES_SCRIPT_URL);
                                    const rolesList = await response.json();
                                    const userData = rolesList.find(u => u.email && u.email.trim().toLowerCase() === normalizedAccountEmail);
                                    if (userData) {
                                        userRole = userData.rol;
                                    }
                                } catch (error) {
                                    console.error("Error al obtener la lista de roles:", error);
                                }
                            }

                            if (userRole) {
                                const userProfile = {
                                    name: profile.name,
                                    username: profile.email,
                                    role: userRole,
                                    adminEmpresaId: window.adminEmpresaId || null,
                                    picture: profile.picture
                                };
                                const cacheLocation = document.getElementById('keep-signed-in').checked ? "localStorage" : "sessionStorage";
                                window[cacheLocation].setItem('userAccount', JSON.stringify(userProfile));
                                window.location.href = 'https://norabim.com/empresas.html';
                            } else {
                                window.showRegistrationForm({
                                    name: profile.name,
                                    email: profile.email,
                                    picture: profile.picture
                                });
                            }
                        })
                        .catch(err => {
                            console.error(err);
                            errorMessage.textContent = "Error al obtener perfil de Google.";
                        });
                    }
                },
            });
        };

        const googleLoginButton = document.getElementById('google-login-button');
        if (googleLoginButton) {
            googleLoginButton.addEventListener('click', () => {
                if (googleTokenClient) {
                    googleTokenClient.requestAccessToken();
                } else {
                    errorMessage.textContent = "El servicio de Google aún está cargando...";
                }
            });
        }

        const loginSection = document.getElementById('login-section');
        const registrationSection = document.getElementById('registration-section');
        const backToLoginButton = document.getElementById('back-to-login');
        
        const registerLink = document.getElementById('register-link');
        const regEmailInput = document.getElementById('reg-email');
        const regPasswordContainer = document.getElementById('reg-password-container');
        const regPasswordInput = document.getElementById('reg-password');
        let isFirebaseRegistration = false;

        window.showRegistrationForm = function(googleProfile) {
            // Ocultar login, mostrar registro
            loginSection.classList.add('hidden');
            registrationSection.classList.remove('hidden');
            if (window.empresasList.length === 0) fetchEmpresas();
            if (errorMessage) errorMessage.textContent = "";
            
            if (googleProfile) {
                // Registro desde Google (no requiere contraseña nueva)
                isFirebaseRegistration = false;
                regPasswordContainer.classList.add('hidden');
                regPasswordInput.required = false;
                
                document.getElementById('reg-name').value = googleProfile.name || '';
                regEmailInput.value = googleProfile.email || '';
                regEmailInput.readOnly = true;
                regEmailInput.classList.add('bg-gray-200', 'dark:bg-gray-700', 'cursor-not-allowed', 'text-gray-500');
                
                const photoEl = document.getElementById('reg-photo');
                const photoContainer = document.getElementById('profile-photo-container');
                if (googleProfile.picture) {
                    photoEl.src = googleProfile.picture;
                    photoContainer.classList.remove('hidden');
                } else {
                    photoContainer.classList.add('hidden');
                }
                
                window.tempGoogleUser = googleProfile;
            } else {
                // Registro nuevo desde Firebase (requiere contraseña)
                isFirebaseRegistration = true;
                regPasswordContainer.classList.remove('hidden');
                regPasswordInput.required = true;
                
                const form = document.getElementById('registration-form');
                if (form) form.reset();
                regEmailInput.readOnly = false;
                regEmailInput.classList.remove('bg-gray-200', 'dark:bg-gray-700', 'cursor-not-allowed', 'text-gray-500');
                document.getElementById('profile-photo-container').classList.add('hidden');
                window.tempGoogleUser = null;
            }
        }

        // The inline onclick handles the back-to-login button logic

        // The inline onclick handles the register-link logic

        
        // --- LOGICA DE ORGANIZACIÓN ---
        window.empresasList = [];
        window.newCompanyData = null;

        async function fetchEmpresas() {
            try {
                const res = await fetch('empresas.json');
                if(res.ok) {
                    window.empresasList = await res.json();
                }
            } catch(e) {
                console.error("Error fetching empresas", e);
            }
        }

        const orgSearchInput = document.getElementById('reg-organization-search');
        const orgResults = document.getElementById('org-autocomplete-results');
        const orgIdInput = document.getElementById('reg-organization-id');

        if(orgSearchInput) {
            orgSearchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase();
                orgResults.innerHTML = '';
                
                if (query.length > 0) {
                    const matches = window.empresasList.filter(emp => emp.name.toLowerCase().includes(query));
                    
                    matches.forEach(emp => {
                        const div = document.createElement('div');
                        div.className = 'px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm text-gray-700 dark:text-gray-200 border-b border-gray-100 dark:border-gray-700';
                        div.textContent = emp.name;
                        div.onclick = () => {
                            orgSearchInput.value = emp.name;
                            orgIdInput.value = emp.id;
                            orgResults.classList.add('hidden');
                            window.newCompanyData = null; // Clear if an existing one is selected
                        };
                        orgResults.appendChild(div);
                    });

                    // Add 'Crear empresa' option at the end
                    const createDiv = document.createElement('div');
                    createDiv.className = 'px-4 py-3 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-sm font-semibold text-primary dark:text-white border-t border-gray-200 dark:border-gray-600 flex items-center';
                    createDiv.innerHTML = '<span class="material-symbols-outlined text-sm mr-2">add_circle</span> Crear empresa';
                    createDiv.onclick = () => {
                        orgResults.classList.add('hidden');
                        showCreateCompanyForm(orgSearchInput.value);
                    };
                    orgResults.appendChild(createDiv);
                    
                    orgResults.classList.remove('hidden');
                } else {
                    orgResults.classList.add('hidden');
                    orgIdInput.value = '';
                }
            });

            // Hide dropdown when clicking outside
            document.addEventListener('click', (e) => {
                if (!orgSearchInput.contains(e.target) && !orgResults.contains(e.target)) {
                    orgResults.classList.add('hidden');
                }
            });
        }

        window.showCreateCompanyForm = function(initialName = '') {
            document.getElementById('registration-section').classList.add('hidden');
            document.getElementById('create-company-section').classList.remove('hidden');
            
            const nameInput = document.getElementById('new-org-name');
            if(nameInput && initialName && !nameInput.value) {
                nameInput.value = initialName;
            }
        }

        window.hideCreateCompanyForm = function() {
            document.getElementById('create-company-section').classList.add('hidden');
            document.getElementById('registration-section').classList.remove('hidden');
        }

        window.handleCreateCompany = async function() {
            // Get multiselect / checkbox values
            const selectedSectors = Array.from(document.querySelectorAll('input[name="org-sector"]:checked')).map(cb => cb.value);
            const selectedSpecialties = Array.from(document.querySelectorAll('input[name="org-specialty"]:checked')).map(cb => cb.value);
            
            window.newCompanyData = {
                name: document.getElementById('new-org-name').value.trim(),
                legalName: document.getElementById('new-org-legal-name').value.trim(),
                type: document.getElementById('new-org-type').value,
                website: document.getElementById('new-org-website').value.trim(),
                email: document.getElementById('new-org-email').value.trim(),
                phone: document.getElementById('new-org-phone').value.trim(),
                country: document.getElementById('new-org-country').value,
                state: document.getElementById('new-org-state').value.trim(),
                city: document.getElementById('new-org-city').value.trim(),
                zip: document.getElementById('new-org-zip').value.trim(),
                address: document.getElementById('new-org-address').value.trim(),
                sectors: selectedSectors,
                specialties: selectedSpecialties,
                // Note: file processing for logos can be complex without a backend API.
                // For now we will just note they exist, or convert to Base64 if needed.
            };

            // Process logos as base64 (if user selected any)
            const lightLogoFile = document.getElementById('new-org-logo-light').files[0];
            const darkLogoFile = document.getElementById('new-org-logo-dark').files[0];
            
            const toBase64 = file => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result);
                reader.onerror = error => reject(error);
            });

            if(lightLogoFile) window.newCompanyData.logoLightBase64 = await toBase64(lightLogoFile);
            if(darkLogoFile) window.newCompanyData.logoDarkBase64 = await toBase64(darkLogoFile);

            // Update registration form UI
            orgSearchInput.value = window.newCompanyData.name;
            orgIdInput.value = 'NEW_COMPANY';
            
            // Go back to registration
            hideCreateCompanyForm();
        }

        window.handleCompleteRegistration = async function() {
            // Validaciones
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const phone = document.getElementById('reg-phone').value.trim();
            const country = document.getElementById('reg-country').value;
            const city = document.getElementById('reg-city').value.trim();

            if (!name || !email || !country || !city) {
                alert("Por favor, completa todos los campos obligatorios.");
                return;
            }

            if (isFirebaseRegistration) {
                const password = regPasswordInput.value;
                if (!password || password.length < 6) {
                    alert("La contraseña debe tener al menos 6 caracteres.");
                    return;
                }
                
                if (!window.firebaseAuth || !window.createUserWithEmailAndPassword) {
                    alert("El sistema de registro aún se está cargando o fue bloqueado por tu navegador. Espera unos segundos o recarga la página (Ctrl + F5).");
                    return;
                }

                try {
                    const userCredential = await window.createUserWithEmailAndPassword(window.firebaseAuth, email, password);
                    console.log("Firebase user created:", userCredential.user.email);
                } catch (error) {
                    console.error("Firebase auth error", error);
                    let msg = "Error al crear la cuenta. Detalle: " + (error.message || error);
                    if (error.code === 'auth/email-already-in-use') msg = "El correo ya está registrado.";
                    if (error.code === 'auth/weak-password') msg = "La contraseña es muy débil.";
                    if (error.code === 'auth/operation-not-allowed') msg = "Falta habilitar Correo/Contraseña en la consola de Firebase.";
                    alert(msg);
                    return;
                }
            }

            const NEW_REGISTRATION_SCRIPT = 'https://script.google.com/macros/s/AKfycbx266o-ea0OAT-xE_9kKSKChRk7MJo0sthjwWI7WUCbFzq3Y578sbD8HgZpWSb7v8H8Fw/exec';
            
            try {
                // Post to Google Apps Script
                await fetch(NEW_REGISTRATION_SCRIPT, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        nombre: name, 
                        email: email, 
                        telefono: phone,
                        empresa: document.getElementById('reg-organization-search').value,
                        especialidad: '',
                        cargo: '',
                        rol: 'INVITADO',
                        estado: 'PENDIENTE'
                    })
                });
                
                // Login immediately as INVITADO
                const userProfile = {
                    name: name,
                    username: email,
                    role: 'INVITADO',
                    adminEmpresaId: null,
                    picture: window.tempGoogleUser?.picture || ''
                };
                const cacheLocation = document.getElementById('keep-signed-in').checked ? "localStorage" : "sessionStorage";
                window[cacheLocation].setItem('userAccount', JSON.stringify(userProfile));
                window.location.href = 'https://norabim.com/empresas.html';
                
            } catch (e) {
                console.error("Error saving registration", e);
            }

            const userProfile = {
                name: name,
                username: email,
                role: 'INVITADO',
                phone: phone,
                country: country,
                city: city,
                organizationId: document.getElementById('reg-organization-id').value,
                organizationName: document.getElementById('reg-organization-search').value,
                picture: window.tempGoogleUser?.picture || ''
            };

            const cacheLocation = document.getElementById('keep-signed-in').checked ? "localStorage" : "sessionStorage";
            if (cacheLocation === "localStorage") {
                localStorage.setItem('userAccount', JSON.stringify(userProfile));
            } else {
                sessionStorage.setItem('userAccount', JSON.stringify(userProfile));
            }

            // Redirigir directamente al CDE
            window.location.href = 'https://norabim.com/empresas.html';
        };

    
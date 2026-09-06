# Configuración de Incidencias — Apps Script independiente

1. Crea un proyecto independiente en [Google Apps Script](https://script.google.com/home/projects/create).
2. Copia `Code.gs` y el contenido de `appsscript.json` de esta carpeta.
3. Despliega como **Aplicación web**, ejecutando como la cuenta propietaria de la carpeta y con acceso para los usuarios de la aplicación.
4. Copia la URL terminada en `/exec` en `INCIDENCIAS/.env`:

```dotenv
VITE_INCIDENCIAS_CONFIG_SCRIPT_URL=https://script.google.com/macros/s/TU_DESPLIEGUE/exec
```

Esta integración crea una hoja llamada **Configuración de Incidencias** dentro de `empresa/proyecto`, con las pestañas `Configuración` y `Ubicaciones`. No utiliza ni modifica el Apps Script general del portal.

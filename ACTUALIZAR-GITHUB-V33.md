# ACTUALIZAR JEZERO A V33 EN GITHUB

Esta actualización parte de **JEZERO V32**.

## Reemplaza estos archivos

- `index.html`
- `style.css`
- `script.js`
- `modules/i18n.js`
- `modules/module-shell.js`

No necesitas cambiar `server.mjs`, `mars-elevation.js`, `mars-data.json`, `elevations.mjs`, `pdf-report.mjs` ni la carpeta `assets`.

## Después de subirlos

1. Espera a que GitHub/tu despliegue publique los archivos.
2. Abre JEZERO.
3. Haz **Ctrl + F5** para evitar que el navegador reutilice V32.
4. Comprueba que en la esquina superior aparezca `JEZERO / EVA MISSION SYSTEM / V33`.
5. Prueba las flechas laterales para ocultar cada panel.
6. Pulsa **Mapa** para entrar/salir de vista cartográfica completa.
7. Pulsa **Capas** y prueba las cuatro vistas cartográficas y los interruptores de capas.

## Compatibilidad

V33 conserva el motor de planificación y el formato de datos de V32. El PDF con análisis del terreno sigue funcionando con `pdf-report.mjs` de V32.

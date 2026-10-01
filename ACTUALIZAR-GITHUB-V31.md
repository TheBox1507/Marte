# JEZERO V31 — actualización para GitHub

Sube estos archivos conservando exactamente las mismas rutas del repositorio:

## Reemplazar
- `index.html`
- `style.css`
- `script.js`
- `pdf-report.mjs`
- `modules/i18n.js`
- `modules/module-shell.js`

## Agregar
- `modules/theme.js`

No es necesario cambiar `server.mjs`, `mars-elevation.js`, `mars-data.json`, `elevations.mjs` ni los assets.

## Qué cambia
En **Configuración > Interfaz** ahora puedes seleccionar idioma y tema visual. La paleta se aplica de inmediato, se guarda en el navegador y también se registra en el PDF de misión.

Temas incluidos:
1. NASA Clásico
2. Artemis Lunar
3. Espacio Profundo
4. Ciencia Marciana
5. Aurora Teal
6. EVA Alto Contraste

La selección de tema también actualiza colores de rutas, base, objetivos y referencias del mapa.

## Después de subir
Haz una recarga forzada del navegador (`Ctrl + F5`) para evitar que Chrome conserve CSS o JavaScript de V30 en caché.

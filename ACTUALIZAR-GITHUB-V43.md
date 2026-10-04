# Actualizar JEZERO a V43

Reemplaza estos archivos en tu proyecto:

- `index.html`
- `style.css`
- `script.js`
- `modules/i18n.js`

No es necesario reemplazar `server.mjs`, `pdf-report.mjs`, `mars-elevation.js`, datos ni assets.

## Después de subir
Haz `Ctrl + F5` para evitar que el navegador reutilice archivos V42 desde caché.

## Qué cambia
- Ruta activa mucho más fina y limpia.
- Se eliminan las flechas blancas grandes y repetitivas.
- Tres indicadores vectoriales pequeños se desplazan sobre cada tramo siguiendo el sentido real de marcha.
- La animación funciona a una frecuencia moderada para reducir costo gráfico.
- En Configuración se puede activar o desactivar `Flujo animado de la ruta`.
- JEZERO respeta `prefers-reduced-motion` del sistema.
- La preferencia se guarda localmente y también se incluye en exportaciones JSON V43.

La lógica de A*, estrategias, optimización del orden, terreno, Resultados y PDF no cambia.

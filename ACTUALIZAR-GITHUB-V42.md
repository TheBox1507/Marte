# JEZERO V42 — Command Bar + Estrategias diferenciadas

## Archivos a reemplazar
- `index.html`
- `style.css`
- `script.js`
- `modules/i18n.js`

No es necesario reemplazar `server.mjs`, `pdf-report.mjs`, `mars-elevation.js`, datos ni assets.

## Cambios principales
1. Toolbar superior rediseñada como una command bar segmentada con SVG.
2. Se eliminó el aspecto de botones grandes independientes.
3. Estrategias de ruta rediseñadas como tarjetas instrumentales con iconos SVG propios.
4. Más directa: costo de A* basado en distancia; el terreno solo bloquea cuando viola límites duros.
5. Equilibrada: pondera distancia, tiempo, pendiente, transitabilidad, rugosidad y confianza.
6. Menor exposición: penalizaciones de terreno mucho más fuertes y corredor de búsqueda más amplio.
7. El orden de visita también usa objetivos distintos para cada estrategia.
8. Cada tarjeta muestra `distancia · pendiente máxima · TRV` después de calcular.
9. Si las tres rutas son prácticamente equivalentes, JEZERO lo informa en vez de aparentar diferencias inexistentes.
10. Flechas de ruta reemplazadas por símbolos vectoriales OpenLayers; desaparece el carácter `➤`.
11. Patrón visual de la ruta activa cambia según la estrategia.

## Después de subir
Haz `Ctrl + F5` para forzar la carga de `?v=42`.

# JEZERO V36 — Actualización para GitHub

## Archivos que debes reemplazar

Reemplaza estos archivos en la raíz del proyecto:

- `index.html`
- `style.css`
- `script.js`
- `pdf-report.mjs`

Reemplaza dentro de `modules/`:

- `i18n.js`
- `module-shell.js`
- `theme.js`

No es necesario reemplazar `server.mjs`, `mars-data.json`, `mars-elevation.js`, `elevations.mjs` ni los assets de mapas de V34/V35.

## Qué cambia en V36

- El orden en que agregas puntos ya no obliga al recorrido.
- `Optimizar automáticamente el orden de visita` está activo por defecto.
- Para hasta 10 puntos se usa Held-Karp sobre la geometría marciana como semilla exacta, seguido de refinamiento con las rutas A* y sus métricas de terreno.
- Para misiones mayores se usa una heurística geodésica y refinamiento A* para evitar crecimiento combinatorio excesivo.
- Puedes desactivar la optimización y respetar el orden manual.
- La numeración del mapa se asigna después del cálculo según el orden de visita resultante.
- Solo la ruta activa se dibuja sobre el mapa; las estrategias alternativas se comparan en RESULTADOS.
- Se elimina el módulo CIENCIA y el valor científico del flujo de cálculo e interfaz.
- La navegación principal queda: MAPA · MISIÓN · EVA · RESULTADOS · CONFIG.
- Todos los gráficos se concentran en RESULTADOS y reaccionan a hover/clic.
- El PDF V36 elimina métricas científicas heredadas y conserva todo el análisis de ruta, terreno, EVA, orden, estrategias, fuentes y nodos.

## Después de subir

Haz `Ctrl + F5` en el navegador para descartar archivos V35 de caché.

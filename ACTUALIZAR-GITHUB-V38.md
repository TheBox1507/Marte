# JEZERO V38 — Actualización para GitHub

V38 se instala sobre JEZERO V36/V37 y se concentra en la lectura visual de la caminata.

## Reemplazar
- `index.html`
- `script.js`
- `style.css`
- `modules/i18n.js`

No es necesario reemplazar el motor del servidor, `pdf-report.mjs`, `mars-elevation.js`, el DEM ni los assets.

## Cambios
- Flechas direccionales sobre cada tramo de la ruta activa.
- BASE rediseñada como estación/hábitat hexagonal JEZERO.
- Puntos de misión rediseñados como nodos hexagonales con el número de visita dentro.
- El último punto se identifica como FIN cuando la misión no regresa a base.
- Cuando existe retorno, la base muestra `BASE · HOME`.
- Nueva banda de secuencia: `BASE → 01 → 02 → ... → HOME`.
- Leyenda renovada para explicar base, punto, fin y sentido de marcha.
- Los números continúan siguiendo el orden optimizado calculado por JEZERO, no el orden de colocación.

## Después de subir
Use `Ctrl + F5` para eliminar la caché de V36/V37.

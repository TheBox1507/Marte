# V16 — Elevación global estable

- Eliminada la dependencia de `/ImageServer/getSamples`, que estaba devolviendo HTTP 404 en el servicio público MDEM200M.
- Añadido `mars-elevation.js` con `ElevationLayer.queryElevation()` usando MDEM200M.
- Pendiente y rugosidad derivadas de la misma fuente global de elevación.
- Se eliminó el backend de elevaciones obsoleto.
- Se mantiene el servidor Node únicamente para servir la aplicación y health check.
- THEMIS Día/Noche no forma parte de esta versión.
- Se actualizó la nomenclatura para no presentar MDEM200M como una segunda capa visual.

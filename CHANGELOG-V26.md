# Mars Explorer V26 — Modular Shell

## Interfaz
- Nuevo rail lateral de módulos.
- El mapa permanece visible al cambiar entre módulos.
- Mission Planner conserva las funciones de creación y cálculo existentes.
- Explorer concentra referencias y sitios de aterrizaje.
- Terrain & Hazards concentra las capas topográficas.
- Reports concentra historial y exportación PDF.
- Se agregaron vistas preparadas para Science, EVA Navigator, Mission Control y Analysis.
- El mapa pasa a ser el elemento visual dominante.
- La leyenda inicia contraída para reducir saturación.
- Nuevo comportamiento responsive para pantallas pequeñas.

## Motor de rutas
- Corregida la construcción de la malla A*.
- La malla ahora forma un corredor 2D orientado al tramo.
- Los recorridos casi norte-sur ya no colapsan las columnas sobre la misma longitud.
- Se mantiene compatibilidad con las estrategias distance / balanced / risk.

## Cartografía
- Las coordenadas ahora se muestran correctamente como N/S y E/W.
- La escala inferior deja de quedar fija en `0 km` y muestra el ancho aproximado de la vista.

## Compatibilidad
- Sin cambios en `server.mjs`.
- Sin cambios en `pdf-report.mjs`.
- Sin cambios en `mars-elevation.js`.
- Sin cambios requeridos en `mars-data.json`.
- Las misiones guardadas de V25 siguen usando el mismo esquema local.

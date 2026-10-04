# JEZERO V40 — Profundidad visual + franja inferior corregida

## Archivos que debes reemplazar

- `index.html`
- `style.css`
- `script.js`

No es necesario reemplazar `server.mjs`, `pdf-report.mjs`, `mars-elevation.js`, `mars-data.json`, `modules/i18n.js`, `modules/theme.js` ni `modules/module-shell.js` para esta actualización.

## Qué cambia

### Franja inferior
- Se eliminan los tres textos flotantes que competían entre sí en la parte baja del mapa.
- La ayuda de edición, las coordenadas y la escala se agrupan en un único `mapBottomDock`.
- La secuencia `BASE → 01 → ... → HOME` queda en una fila independiente encima del dock.
- La navegación inferior conserva su propio plano y ya no comparte espacio con esos datos.
- Las fuentes cartográficas permanecen dentro de `CAPAS / LEYENDA`, por lo que dejan de repetirse sobre el mapa.

### Profundidad visual
- Paneles principales con sombra profunda, blur y borde interior sutil.
- Tarjetas internas con un nivel de elevación menor para crear jerarquía.
- Controles del mapa, HUD, secuencia y drawer de capas con efecto de consola flotante.
- Botones con estados normal, hover y pulsado.
- Navegación inferior con mayor separación visual respecto al mapa.
- Ruta activa con cuerpo multicapa y sombra adicional.
- Flechas direccionales con sombra corta para destacar sobre Viking/MOLA.
- Marcadores BASE/FIN/Puntos con una capa de sombra adicional.

## Compatibilidad

V40 conserva la lógica de optimización V36/V39, A*, terreno, capas, gráficos interactivos y generación del PDF.

## Después de subir

Haz `Ctrl + F5` para forzar la recarga de `style.css?v=40` y `script.js?v=40`.

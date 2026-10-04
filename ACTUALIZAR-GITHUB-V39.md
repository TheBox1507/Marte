# JEZERO V39 — Safe Layout + Integrated Legend

## Reemplazar
- `index.html`
- `style.css`

No es necesario reemplazar `script.js`, `server.mjs`, el motor A*, los datos de Marte ni el generador PDF si ya estás en V38.

## Cambios
- Se crea una zona segura dinámica entre los paneles laterales.
- HUD, secuencia, toolbar, coordenadas, norte y escala respetan esa zona.
- Los textos dejan de quedar debajo de las barras laterales.
- La leyenda ya no flota sobre el mapa.
- La simbología se integra dentro de `CAPAS / LEYENDA` como sección plegable.
- Mejor wrapping de textos y métricas dentro de paneles.
- En anchos reducidos se oculta primero el panel derecho para preservar el mapa.

Después de subir los archivos, usa `Ctrl + F5`.

# JEZERO V42

## Command Bar
Los controles `+`, `−`, Centro, Capas y Mapa se agrupan en dos controles segmentados. Los iconos son SVG, con hover/activo integrados al lenguaje visual de JEZERO.

## Estrategias de ruta
Las estrategias dejan de ser variaciones demasiado cercanas:

- **Más directa:** minimiza distancia entre trayectorias viables.
- **Equilibrada:** combina recorrido y calidad del terreno.
- **Menor exposición:** admite desvíos mayores para reducir pendiente, rugosidad, baja transitabilidad e incertidumbre.

Los corredores de búsqueda A* también cambian por estrategia, permitiendo que Menor exposición explore alternativas más alejadas de la línea directa.

## Iconografía de ruta
Las flechas textuales se sustituyen por marcadores vectoriales triangulares. Las tarjetas de estrategia incluyen pictogramas SVG propios y métricas reales después del cálculo.

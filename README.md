# Mars Explorer — Planificador global de travesías científicas

Aplicación web en español para planificar travesías científicas sobre la superficie completa de Marte. La interfaz utiliza cartografía planetaria de NASA Mars Trek y un modelo global de elevación MOLA para calcular alternativas de ruta con A*.

## Alcance de V11

- Cobertura planetaria completa: -90° a 90° de latitud y -180° a 180° de longitud.
- Mapa base global MOLA + Mars Express HRSC a 200 m/píxel mediante NASA Mars Trek.
- Capa opcional de relieve MOLA global a 463 m/píxel.
- Capa opcional de inercia térmica TES global mediante NASA Mars Trek.
- Selección de base y múltiples objetivos en cualquier punto del planeta.
- Misiones multi-punto con objetivos obligatorios y opcionales, desvíos y regreso a base.
- Tres estrategias: más directa, equilibrada y menor exposición.
- Cálculo A* por tramo sobre el DEM global MOLA de 463 m/píxel.
- Distancia, duración, pendiente, desnivel, riesgo topográfico y margen operacional.
- Historial de misiones almacenado localmente en el navegador.

## Datos y limitaciones

El DEM global MOLA de 463 m/píxel es un producto público de NASA/USGS basado en más de 600 millones de mediciones y cubre todo Marte. El archivo GeoTIFF global publicado por USGS tiene aproximadamente 2 GB; el servidor usa lectura parcial/remota para consultar solamente las ventanas necesarias para cada cálculo.

La resolución de 463 m/píxel es apropiada para planificación experimental a escala planetaria, pero no equivale a una evaluación de seguridad de una EVA. En una misión real se necesitarían productos locales de mayor resolución, análisis de obstáculos, incertidumbre, navegación, comunicaciones y otras restricciones operacionales.

Las capas de alta resolución orbital (CTX/HiRISE) no se consideran cobertura global continua: aparecen como productos regionales o mosaicos concretos. La V11 prioriza un mapa global coherente y deja la incorporación de detalle local como una ampliación posterior cuando exista cobertura para la zona seleccionada.

## Fuentes principales

- NASA Mars Trek: https://trek.nasa.gov/mars/
- NASA Mars Trek API / WMTS: https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars
- USGS Astrogeology — Mars MGS MOLA DEM 463m: https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m
- NASA Perseverance Location Map: https://science.nasa.gov/mission/mars-2020-perseverance/location-map/

## Ejecución

```bash
npm install
npm start
```

Abrir `http://localhost:8000`.

En Render:

- Runtime: Node
- Root Directory: vacío
- Build Command: `npm install`
- Start Command: `npm start`


## V13 — arquitectura global de capas

La interfaz separa base cartográfica, ciencia, análisis del terreno, referencia y operación. Para evitar redundancia, el DEM global MOLA de 463 m se usa como fuente numérica interna del motor y no como una segunda capa visual. Las capas científicas visuales se apoyan en mosaicos THEMIS IR de 100 m/píxel de USGS para ±60° de latitud; la pendiente y la rugosidad se derivan dinámicamente del DEM MOLA.

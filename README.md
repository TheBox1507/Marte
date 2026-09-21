# MARS EXPLORER — versión final del prototipo

Aplicación web en español para planificar travesías científicas sobre Marte, con foco inicial en el cráter Jezero. La aplicación sustituye el mapa dibujado del prototipo por una cartografía geoespacial real de NASA Mars Trek y calcula alternativas de ruta a partir de elevaciones públicas de MOLA.

## Qué cambió

- Se eliminó el mapa simulado con CSS y los valores de demostración.
- El mapa usa la proyección equirectangular de Marte y capas WMTS/XYZ de NASA Mars Trek.
- Se añadieron capas de relieve MOLA/HRSC, rugosidad MOLA y polvo TES.
- Se incorporó selección A → B directamente sobre el mapa.
- Se implementó una malla local y búsqueda A* con tres criterios: directa, equilibrada y menor exposición.
- Las elevaciones de la malla se consultan al servicio público de MOLA mediante el backend local para evitar depender de CORS del navegador.
- El riesgo se expresa como un índice experimental basado en pendiente máxima y desnivel acumulado.
- La duración se recalcula con velocidad nominal, tiempo máximo de EVA y margen de retorno.
- La interfaz y las explicaciones están en español.
- Se incorporó trazabilidad de las fuentes de NASA/USGS y una advertencia explícita: el índice no es una certificación de seguridad para una misión tripulada.

## Ejecutar localmente

Requiere Node.js 18 o superior.

```bash
npm start
```

Después abrir:

```text
http://localhost:8000
```

## Publicar en Netlify

Esta versión incluye una función serverless en `netlify/functions/elevations.mjs`, por lo que ya no depende de `server.mjs` para el servicio de elevación. La carpeta raíz del proyecto está preparada para desplegarse directamente en Netlify.

- Publicar el contenido de esta carpeta como sitio.
- Netlify detectará `netlify.toml`.
- No hace falta ejecutar `npm start` en Netlify.
- El frontend consulta `/.netlify/functions/elevations`, que funciona como proxy hacia el servicio público de MOLA.

La aplicación necesita conexión a Internet para cargar las capas de NASA Mars Trek y consultar el servicio público de MOLA.

## Flujo de uso

1. Pulsa **Usar lugar de aterrizaje** para fijar A en las coordenadas de aterrizaje de Perseverance.
2. Pulsa **Seleccionar A → B en el mapa**.
3. Haz clic en el destino.
4. Pulsa **Calcular rutas**.
5. Cambia entre **Equilibrada**, **Menor exposición** y **Más directa**.
6. Ajusta velocidad, tiempo máximo de EVA y margen de retorno y recalcula.

## Datos y fuentes

- NASA Mars Trek: capas cartográficas de Marte y herramientas de análisis.
- NASA MOLA: modelo de elevación global utilizado para el muestreo automático de la aplicación.
- NASA/USGS HiRISE DTM de Jezero: producto de alta resolución de referencia para una futura versión que use la topografía local a escala métrica.
- NASA Perseverance Location Map / Mars 2020 PDS: contexto y productos cartográficos de la misión.

## Limitaciones científicas importantes

La versión actual usa MOLA para el cálculo automático de rutas. Aunque la aplicación enlaza el HiRISE DTM de Jezero como fuente de mayor resolución, todavía no convierte ese GeoTIFF de alta resolución en una malla de navegación dentro del navegador.

Por eso, el **índice de riesgo** debe interpretarse como una herramienta experimental para comparar trayectorias, no como aprobación de una caminata humana. Para una versión de investigación más avanzada conviene incorporar el DTM HiRISE/CTX local, clasificación de obstáculos, incertidumbre del terreno y restricciones operacionales de la misión.

## Archivos principales

- `index.html`: interfaz.
- `style.css`: diseño.
- `script.js`: mapa, selección y algoritmo A*.
- `server.mjs`: servidor local y proxy de muestreo MOLA.
- `data/mars-data.json`: configuración y fuentes.
- `package.json`: arranque del servidor.


## Elevación usada por el motor de rutas (versión Render)

El cálculo de rutas dentro de Jezero utiliza el **Mars 2020 Science Investigation CTX DEM Mosaic**, un DEM de 20 m/píxel publicado por el USGS Astrogeology Science Center. El producto cubre el cráter Jezero y fue localizado verticalmente al conjunto MOLA. El servidor lee el GeoTIFF remoto y muestrea los valores necesarios para la malla A*.

Fuente: https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic

# JEZERO V34 — Real Mars + Nomenclatura + UI adaptable

JEZERO V34 mejora la cartografía y corrige los problemas de legibilidad observados al abrir los paneles laterales, sin cambiar el motor A*, el DEM ni el análisis de terreno/PDF incorporado en V32.

## Novedades principales

- Nuevo mapa base **Marte real · Viking VIS**, servido desde NASA Mars Trek.
- Se conserva **MOLA + HRSC** y se agrega un modo **Híbrido imagen + relieve**.
- Nomenclatura marciana oficial **IAU / USGS** cargada progresivamente según la zona visible y el zoom.
- 49 referencias globales locales como respaldo cuando no hay conexión con el Gazetteer.
- 10 aterrizajes operacionales de referencia: los nueve sitios exitosos de NASA presentes en la cartografía de NASA más Zhurong/Tianwen-1.
- Paneles laterales con scrollbar temático oscuro.
- HUD y toolbar adaptables al espacio real entre paneles.
- Textos y métricas permiten salto de línea para evitar superposición.
- Los botones inferiores también abren/cerran las opciones laterales del módulo activo.
- Se mantiene el botón MAPA para ocultar ambos paneles de una sola vez.

## Capas

El menú CAPAS permite elegir el mapa base:

- **Marte real · Viking VIS**
- **Topografía MOLA + HRSC**
- **Híbrido imagen + relieve**

Además permite activar o desactivar:

- pendiente;
- rugosidad;
- rutas EVA;
- objetivos;
- nombres oficiales IAU / USGS;
- aterrizajes.

## Nombres de Marte sin inflar la aplicación

V34 no incrusta un archivo enorme con toda la nomenclatura. Cuando el usuario se acerca, el servidor consulta el Gazetteer of Planetary Nomenclature para la ventana cartográfica visible. A escala global solo se muestran referencias mayores; al aumentar el zoom se incorporan accidentes geográficos cada vez más pequeños.

Si la consulta externa falla, JEZERO conserva las referencias globales locales y muestra el estado `BASE LOCAL`.

## Compatibilidad

V34 mantiene:

- motor A* y estrategias de ruta;
- MDEM200M para elevación;
- análisis de pendiente, rugosidad, transitabilidad e incertidumbre;
- PDF con análisis del terreno y perfil de elevación;
- temas configurables;
- interfaz Español / English;
- JSON de misión e historial.

Consulta `ACTUALIZAR-GITHUB-V34.md` antes de reemplazar archivos.

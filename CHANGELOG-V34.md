# CHANGELOG — JEZERO V34

## Cartografía

- Se añadió la capa global **Viking VIS, Global Color Mosaic** como opción `Marte real`.
- MOLA + HRSC continúa disponible como base científica.
- Se añadió modo híbrido Viking VIS + MOLA.
- El cambio de mapa base no modifica el motor de rutas ni los datos de elevación.

## Nomenclatura IAU / USGS

- Nuevo endpoint del servidor: `/api/mars-nomenclature`.
- Consulta por ventana visible y zoom para evitar cargar miles de etiquetas simultáneamente.
- Filtrado progresivo por diámetro del accidente geográfico según nivel de zoom.
- Cache temporal del lado servidor para evitar consultas repetidas.
- 49 referencias marcianas importantes permanecen disponibles como respaldo local.
- La capa usa decluttering para evitar que nombres cercanos se dibujen unos encima de otros.

## Aterrizajes

- Se conservan los nueve sitios de aterrizaje exitosos de NASA del conjunto existente.
- Se añadió **Zhurong / Tianwen-1**, Utopia Planitia, 25.066° N, 109.925° E.

## Interfaz

- Scrollbars laterales rediseñados con la paleta activa de JEZERO.
- Se corrigió el ancho útil de tarjetas, filas y valores largos.
- HUD central ahora usa el espacio comprendido entre los paneles visibles.
- En pantallas de aproximadamente 1366 px el HUD usa dos filas para no chocar con la toolbar.
- Toolbar y botones permiten wrap controlado.
- Los botones inferiores funcionan como interruptores de paneles:
  - seleccionar otro módulo lo activa y abre sus opciones;
  - pulsar de nuevo el módulo activo cierra los paneles;
  - volver a pulsarlo los abre de nuevo.
- El botón `MAPA` superior continúa ocultando/mostrando ambos paneles.

## Persistencia

- Estado de módulo: `jezero-active-module-v34` con migración desde versiones anteriores.
- Estado de paneles: `jezero-panel-state-v34` con migración desde V33.
- Mapa base: `jezero-base-map-v34`.
- Vista visual: `jezero-map-view-v34`.
- Idioma: `jezero-language-v34` con migración desde V31/V30.

## Sin cambios en

- A* y lógica multicriterio.
- MDEM200M.
- cálculo científico.
- PDF de terreno de V32.
- sistema de temas de V31.

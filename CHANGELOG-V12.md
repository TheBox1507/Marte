# V12 — Base cartográfica sin redundancia

- Eliminada la capa visual separada «Relieve MOLA 463 m» del panel.
- El DEM MOLA 463 m queda tratado como fuente interna del motor de cálculo, no como una segunda capa cartográfica visible.
- Se mantiene «Relieve MOLA + HRSC» como única base cartográfica visual global.
- Actualizada la leyenda y los textos para diferenciar visualización cartográfica de fuente numérica para rutas.
- Eliminada la configuración `molaDemTile` que ya no se usa en el frontend.

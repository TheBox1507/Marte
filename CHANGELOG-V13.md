# V13 — Arquitectura global de capas

- Se elimina la capa visual redundante “Relieve MOLA 463 m”; MOLA DEM queda como fuente interna de cálculo.
- Se agregan THEMIS IR de día y noche como capas científicas visuales globales a ~100 m/píxel para 60°S–60°N.
- Se agrega nomenclatura IAU/USGS mediante WMS.
- Se agregan capas derivadas de Pendiente y Rugosidad calculadas desde el DEM MOLA del área visible.
- La proyección de visualización se normaliza a EPSG:4326 para compatibilidad con WMS USGS y coordenadas lon/lat.
- Los estados de capa se basan en eventos de carga de la imagen o en el cálculo DEM; un error en una sola tesela ya no bloquea una capa completa.

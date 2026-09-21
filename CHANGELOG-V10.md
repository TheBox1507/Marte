# V10

- Sustituidas las capas WMTS MOLA Roughness/TES Dust que estaban devolviendo errores en el navegador.
- Rugosidad MOLA: raster global único de Mars Global Data Sets / ASU (8 ppd, 7,5 kmpp).
- Polvo TES: TES Dust Cover Index de Mars Global Data Sets / ASU (16 ppd, 3,5 kmpp).
- Ambas capas usan ImageStatic con extensión global -180..180 / -90..90 y estados de carga reales.
- Se aclaró en la interfaz que son capas analíticas globales, mientras que el cálculo de rutas sigue usando el DEM de Jezero.

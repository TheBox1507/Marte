# Mars Explorer V9

- Capas analíticas MOLA Roughness y TES Dust migradas a URLs WMTS directas de NASA Mars Trek.
- Eliminada la verificación por proxy que podía provocar estados de error sin impedir la visualización real.
- Añadido respaldo visual TES Global Dust Index si TES Global Dust no responde tras varios intentos.
- Estados de capa ahora distinguen LISTA, CARGANDO, ACTIVA y ERROR DE DATOS.
- Mayor opacidad para rugosidad y polvo para facilitar su lectura sobre el relieve base.
- Texto de metodología actualizado para describir correctamente la fuente WMTS.

- El respaldo TES ahora respeta el estado del interruptor principal y se reactiva correctamente después de volver a habilitar la capa.

# CHANGELOG — JEZERO V33

## Legibilidad

- Aumento de tamaño en títulos, etiquetas técnicas, textos descriptivos, botones, formularios, HUD, leyenda, métricas de terreno y navegación inferior.
- Mejora del interlineado.
- Wrapping controlado para evitar que estados, valores y textos largos se monten entre sí.
- Ajustes específicos para 1366×768, 1280 px, tablet y móvil.

## Paneles retráctiles

- Nuevo control lateral izquierdo.
- Nuevo control lateral derecho.
- Nuevo modo **Mapa** para ocultar/restaurar ambos paneles.
- Persistencia local del estado de paneles.
- Reajuste automático del viewport de OpenLayers después de cada cambio.

## Capas y vistas del mapa

- Nuevo drawer **Capas** accesible desde el mapa.
- Control rápido de mapa base MOLA/HRSC, pendiente, rugosidad, rutas EVA, objetivos, referencias y sitios de aterrizaje.
- Sincronización entre los controles rápidos y los controles del panel Mapa.
- Nuevas vistas visuales: Geología, Relieve, Monocromo científico y EVA de baja luminosidad.
- Las vistas usan filtros de renderizado sobre el raster base y no modifican el motor científico.

## Rendimiento

- Sin librerías nuevas.
- Sin imágenes adicionales.
- Sin duplicar capas raster.
- Los nuevos estilos visuales se aplican con CSS al mismo mapa base.

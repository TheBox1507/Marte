# JEZERO V43 — Animated Traverse Flow

## Ruta
- Reducción importante del grosor visual del corredor y línea activa.
- Eliminación de flechas triangulares grandes estáticas.
- Nuevo flujo direccional animado con marcadores vectoriales pequeños.
- Color del flujo hereda la estrategia activa: directa, equilibrada o menor exposición.

## Rendimiento y accesibilidad
- Render aproximado de la animación a 14 fps, suficiente para lectura direccional sin exigir un refresco completo a 60 fps.
- No se redibuja la ruta cuando no existe geometría activa.
- No se anima con la pestaña oculta.
- Compatibilidad con `prefers-reduced-motion`.
- Interruptor de animación dentro de Configuración.

## Compatibilidad
No modifica el motor de planificación, el DEM, PDF ni backend.

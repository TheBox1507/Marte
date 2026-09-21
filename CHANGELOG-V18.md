# Mars Explorer V18 - Exportacion de informes PDF

## Nuevo
- Guardar mision ahora genera y descarga automaticamente un informe PDF.
- El PDF incluye resumen de la mision, estrategia seleccionada, parametros operacionales y margen de retorno.
- Incluye las tres alternativas de ruta: mas directa, equilibrada y menor exposicion.
- Incluye distancia, duracion estimada, riesgo, pendiente maxima/media, desnivel y segmentos evaluados.
- Incluye secuencia de visita, estado obligatorio/opcional y tiempo de parada programado por objetivo.
- Incluye tiempo minimo de EVA necesario para conservar el margen configurado.
- Incluye detalle de cada tramo y el tiempo de parada en el destino.
- Incluye opcionales omitidos por restricciones.

## Tecnico
- Nuevo endpoint POST `/api/mission-pdf`.
- Generador PDF sin dependencias externas para que funcione en Render.
- El informe se descarga desde el mismo dominio de la aplicacion.

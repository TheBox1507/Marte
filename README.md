# Mars Explorer Global V16

Planificador web de travesías científicas sobre Marte.

## Elevación global
La aplicación usa el servicio `MDEM200M` de Marte como `ElevationLayer` mediante ArcGIS Maps SDK for JavaScript. La documentación y el ejemplo oficial de ArcGIS usan este mismo servicio para el terreno de Marte. El muestreo numérico se realiza con `ElevationLayer.queryElevation()` en el navegador, evitando llamadas REST directas a `/ImageServer/getSamples`.

## Capas principales
- Relieve MOLA + HRSC
- Pendiente calculada
- Rugosidad calculada
- Rutas calculadas
- Puntos de misión

THEMIS Día/Noche y otras capas que estaban fallando no se cargan en esta versión.

## V18 - Exportacion PDF
Al usar **Guardar mision + PDF**, la mision se almacena en el historial del navegador y se genera un informe PDF con:
- resumen y estado operacional;
- parametros de velocidad, EVA y margen;
- tiempo minimo de EVA necesario;
- secuencia de visita, obligatorio/opcional y paradas;
- comparacion de las tres estrategias;
- detalle por tramo con distancia, duracion, pendiente, desnivel y riesgo;
- objetivos opcionales omitidos.

La generacion se realiza en el backend local mediante `POST /api/mission-pdf`, por lo que no depende de una libreria PDF externa en el navegador.

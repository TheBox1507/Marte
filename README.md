# Mars Explorer V26 — Arquitectura modular

Mars Explorer es una plataforma web experimental para planificar y analizar travesías científicas sobre Marte. V26 reorganiza la aplicación alrededor de un mapa persistente y módulos especializados, conservando el motor de rutas y el backend existentes.

## Módulos

- **Explorer:** exploración global, referencias marcianas y sitios de aterrizaje.
- **Mission Planner:** base, objetivos, secuencia, estrategias y parámetros de EVA.
- **Science:** espacio desacoplado para valor científico, observaciones y muestras.
- **Terrain & Hazards:** pendiente, rugosidad y futura transitabilidad/hazard map.
- **EVA Navigator:** vista simplificada de navegación y retorno a base en modo simulación.
- **Mission Control:** estructura para tripulación, telemetría, alertas y eventos.
- **Analysis:** métricas y futura comparación plan vs. recorrido real.
- **Reports:** historial local y exportación PDF.
- **Settings:** configuración futura de fuentes, unidades y paquetes offline.

## Cambio importante del motor V26

La malla del algoritmo A* ahora es un corredor **2D orientado al tramo**. En versiones anteriores, la longitud de las columnas dependía únicamente de la interpolación entre origen y destino; en recorridos casi norte-sur las columnas podían superponerse y limitar la capacidad del algoritmo para buscar desvíos laterales.

V26 genera un corredor perpendicular a la dirección del viaje, manteniendo un ancho adaptativo. Esto mejora la geometría de búsqueda sin cambiar el formato de las misiones guardadas.

## Elevación global

La aplicación usa `MDEM200M` como `ElevationLayer` mediante ArcGIS Maps SDK for JavaScript. El muestreo numérico se realiza con `ElevationLayer.queryElevation()` en el navegador.

Capas actuales:

- Relieve MOLA + HRSC.
- Pendiente calculada.
- Rugosidad calculada.
- Rutas calculadas.
- Puntos de misión.
- Sitios de aterrizaje y ubicaciones conocidas.

## Reportes PDF

`POST /api/mission-pdf` sigue generando el informe en el backend local. La migración modular no cambia `server.mjs`, `pdf-report.mjs`, `mars-elevation.js` ni el formato de datos.

## Ejecutar localmente

```bash
npm start
```

Después abre `http://localhost:8000`.

## Alcance de seguridad

Mars Explorer sigue siendo un prototipo de planificación y simulación. El índice topográfico y el modo EVA no certifican seguridad humana ni sustituyen un sistema de navegación xEVA validado.

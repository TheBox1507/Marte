# JEZERO V27 — Jezero Sand + interfaz en español + PDF completo

JEZERO es una plataforma web experimental para planificar y analizar travesías científicas EVA sobre Marte. V27 conserva la arquitectura modular y el motor de rutas de V26, pero mejora de forma importante la legibilidad de la interfaz y la documentación de misión.

## Módulos

- **Explorar:** cobertura global, referencias marcianas y sitios de aterrizaje.
- **Planificador de misión:** base, objetivos, secuencia, estrategias y parámetros EVA.
- **Ciencia:** espacio desacoplado para valor científico, observaciones y muestras.
- **Terreno y peligros:** pendiente, rugosidad y futura transitabilidad.
- **Navegador EVA:** vista simplificada de navegación y retorno a base en modo simulación.
- **Control de misión:** estructura para tripulación, telemetría, alertas y eventos.
- **Análisis:** métricas y futura comparación entre plan y recorrido real.
- **Informes:** historial local y exportación PDF.
- **Configuración:** fuentes, unidades y futuros paquetes sin conexión.

## Tema Jezero Sand

La interfaz usa una paleta cálida inspirada en el terreno marciano:

- Fondo principal: `#0D0C0B`
- Paneles: `#17120F`
- Panel secundario: `#211A16`
- Cobre principal: `#B95F3B`
- Arena: `#D4A574`
- Texto: `#EEE5D8`
- Verde de seguridad: `#70A684`
- Rojo de alerta: `#D15F4F`

Los colores de seguridad permanecen separados de los colores decorativos.

## Interfaz V27

Los botones principales, controles de formulario y navegación modular son más grandes. En escritorio, la barra de módulos muestra el nombre completo de cada sección en lugar de abreviaturas crípticas. En pantallas pequeñas vuelve a un formato compacto por iconos.

La interfaz visible está en español. Se mantienen sin traducir únicamente nombres propios, siglas técnicas y denominaciones oficiales como NASA, USGS, MOLA, HRSC, DEM, Mars Trek y EVA.

## PDF de misión V27

El informe PDF ahora recibe y documenta todos los datos disponibles que produce el motor actual, entre ellos:

- identificación del informe y versión de JEZERO;
- estrategia seleccionada;
- estado operacional;
- base, puntos obligatorios y opcionales;
- todos los puntos con coordenadas y tiempos de permanencia;
- parámetros de velocidad, duración EVA y margen de retorno;
- duración total, tiempo de desplazamiento y tiempo en objetivos;
- métricas topográficas completas;
- línea base de objetivos obligatorios;
- comparación de las tres estrategias;
- detalle de todos los tramos de la ruta seleccionada;
- objetivos opcionales omitidos;
- fuentes de datos y limitaciones;
- apéndice con cada nodo calculado de las tres rutas, incluyendo latitud, longitud y elevación disponible.

JEZERO no inventa valores todavía no modelados. Oxígeno, batería, control térmico, radiación, comunicaciones y recursos fisiológicos se indican como no modelados en V27.

## Cambio importante del motor heredado de V26

La malla A* usa un corredor bidimensional orientado al tramo, permitiendo desvíos laterales incluso en recorridos casi norte-sur. Se conserva esta corrección en V27.

## Ejecutar localmente

```bash
npm start
```

Después abre `http://localhost:8000`.

## Alcance de seguridad

JEZERO sigue siendo un prototipo de planificación y simulación. El índice topográfico y el modo EVA no certifican seguridad humana ni sustituyen un sistema de navegación xEVA validado.

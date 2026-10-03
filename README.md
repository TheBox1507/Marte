# JEZERO V32 - EVA Mission System

JEZERO V32 reorganiza la aplicación alrededor de la misión y del mapa, manteniendo el motor multicriterio desarrollado en las versiones anteriores.

## Arquitectura visible

La navegación principal queda reducida a:

- **MAPA** - cartografía, capas, terreno y exploración.
- **MISIÓN** - puntos, estrategia, parámetros EVA, timeline y planificación.
- **CIENCIA** - valor científico, obligatoriedad, categoría, permanencia y costo operacional de los objetivos.
- **EVA** - navegación operacional, siguiente objetivo, alertas y retorno.
- **RESULTADOS** - métricas, terreno, perfil de elevación, historial y PDF.
- **CONFIG.** - misión, idioma, tema, valores predeterminados e importación/exportación.

## Identidad JEZERO

V32 deja el esquema de dashboard de columnas fijas. El mapa ocupa el área completa y los controles aparecen como paneles flotantes. Se incorporan:

- HUD de misión.
- Mission Timeline.
- Corredor EVA alrededor de la ruta seleccionada.
- Simbología diferenciada para base y objetivos científicos.
- Instrumentación de terreno.
- Perfil de elevación en Resultados.
- Indicadores de retorno científico, transitabilidad y reserva.

## PDF de misión

El informe V32 añade una sección específica de **Análisis del terreno de la misión**, incluyendo:

- elevación inicial y final;
- elevación mínima y máxima;
- relieve vertical;
- ascenso y descenso acumulado;
- pendiente media;
- máxima pendiente de subida y bajada;
- rugosidad;
- transitabilidad media y mínima;
- confianza cartográfica media y mínima;
- distancia con incertidumbre;
- sector más exigente;
- perfil gráfico de elevación;
- tabla de terreno por tramo.

El perfil se dibuja directamente en el PDF, por lo que no se añadió ninguna librería pesada.

## Rendimiento

V32 no incorpora frameworks nuevos. Los nuevos elementos visuales se construyen con CSS, SVG y el motor ya existente. Los paneles flotantes sustituyen la suma de columnas rígidas, evitando el recorte lateral observado en pantallas de 1366 px.

Consulta `ACTUALIZAR-GITHUB-V32.md` antes de reemplazar los archivos.

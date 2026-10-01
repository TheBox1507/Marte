# CHANGELOG V27

## Interfaz

- Se reemplaza la paleta anterior por **Jezero Sand**.
- Se amplía la barra lateral de módulos en escritorio.
- Los módulos muestran nombres completos en español.
- Se aumentan altura, área táctil y legibilidad de botones y controles.
- Se aumentan tamaños de campos, selectores, acciones de mapa y controles EVA.
- Se conserva un modo compacto para pantallas pequeñas.
- Se traduce la interfaz visible al español.
- La marca principal pasa a mostrarse como **JEZERO**.

## Informe PDF

- Nuevo informe completo de misión con identidad visual Jezero Sand.
- Soporte de tildes, ñ y símbolo de grados mediante WinAnsi.
- Se añade identificador de informe y versión del sistema.
- Se documentan todos los puntos planificados.
- Se documenta la secuencia seleccionada.
- Se incluyen todas las métricas de la ruta seleccionada.
- Se incluye la línea base de objetivos obligatorios.
- Se comparan las tres estrategias.
- Se detallan todos los tramos de la ruta seleccionada.
- Se incluyen objetivos opcionales omitidos.
- Se documentan fuentes, modelo de cálculo y limitaciones.
- Se añade un apéndice técnico con todos los nodos de las tres estrategias calculadas, incluyendo coordenadas y elevación cuando está disponible.
- Los recursos aún no calculados se muestran explícitamente como no modelados en lugar de inventar datos.

## Backend y exportación

- El nombre de archivo por defecto pasa a `jezero-mision`.
- El mensaje del servidor usa el nombre JEZERO.
- El paquete se identifica como `jezero` versión `2.1.0`.

## Compatibilidad

- Se conserva el formato general de misión e historial local.
- Se conserva la malla A* 2D corregida en V26.
- No se modifican `mars-elevation.js`, `mars-data.json`, `db-schema.sql` ni las capas cartográficas existentes.

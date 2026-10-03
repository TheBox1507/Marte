# CHANGELOG - JEZERO V32

## EVA Mission System

- Sustituido el layout de dashboard por un mapa inmersivo con paneles flotantes.
- Navegación reducida a MAPA, MISIÓN, CIENCIA, EVA, RESULTADOS y CONFIG.
- Terreno se integra dentro de MAPA/MISIÓN/RESULTADOS.
- El antiguo módulo CONTROL se absorbe en EVA.
- Eliminadas dependencias de ancho entre sidebar + mapa + detalles para evitar cortes laterales.

## Identidad cartográfica JEZERO

- Nuevo HUD sobre el mapa con plan, ciencia, transitabilidad y retorno.
- Mission Timeline para visualizar BASE -> objetivos -> HOME.
- Corredor EVA para la ruta seleccionada.
- Marcadores geométricos diferenciados para base, objetivo obligatorio y opcional.
- Resultados incorpora perfil de elevación de la ruta.
- Ciencia muestra el costo operacional estimado de cada objetivo opcional.

## PDF de misión

- Nueva sección: ANÁLISIS DEL TERRENO DE LA MISIÓN.
- Elevación inicial/final/mínima/máxima y relieve vertical.
- Ascenso y descenso acumulado.
- Pendiente media, máxima subida y máxima bajada.
- Rugosidad.
- Transitabilidad media/mínima.
- Confianza cartográfica media/mínima.
- Distancia incierta y difícil.
- Identificación del sector más exigente.
- Perfil vectorial de elevación integrado en el PDF.
- Tabla tramo por tramo con distancia, pendiente, desnivel, transitabilidad y confianza.

## Compatibilidad

- Se conserva el motor A* 2D.
- Se conserva pendiente direccional.
- Se conservan transitabilidad, límites duros e incertidumbre.
- Se conserva la optimización por valor científico.
- Se conservan idioma Español/English y temas configurables.
- Se conserva importación/exportación JSON e historial local.

## Rendimiento

- Sin frameworks nuevos.
- El perfil de terreno usa SVG en pantalla y dibujo vectorial dentro del PDF.
- Los cambios de V32 se concentran en archivos existentes y módulos ligeros.

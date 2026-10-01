# JEZERO V29 - Ciencia, configuración y resultados

## Correcciones de interfaz
- Ajustado el grid para 1366x768: navegación y paneles laterales reducen su ancho y el mapa gana espacio.
- El panel derecho ya no debe quedar fuera del viewport en equipos de 1366 px de ancho.
- Se mantiene el layout modular actual; el rediseño artístico pendiente no es requisito para instalar V29.

## Ciencia funcional
- El módulo Ciencia ahora permite editar cada objetivo científico.
- Valor científico 0-100.
- Tiempo de trabajo en el objetivo.
- Objetivo obligatorio u opcional.
- Categoría científica: geología, muestreo, imagen/documentación, instrumento u otro.
- Notas científicas.
- Los cambios de valor, tiempo y obligatoriedad invalidan el cálculo anterior y pueden recalcular la misión.
- Resumen de valor científico potencial, incluido y eficiencia científica.

## Resultados
- Se eliminaron los módulos separados Análisis e Informes.
- Ahora existe un único módulo RESULTADOS con métricas, historial y generación de PDF.

## Configuración funcional
- Nombre de misión, código/ID, tripulación y notas.
- Guardar los parámetros operacionales actuales como predeterminados.
- Restaurar parámetros predeterminados.
- Exportar misión a JSON.
- Importar misión desde JSON.
- Borrar historial local.

## PDF
- Reporte actualizado a V29.
- Incluye nombre, código, tripulación y notas del perfil de misión.
- Incluye categoría y notas científicas cuando están disponibles.

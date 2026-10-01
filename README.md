# JEZERO V29

Plataforma web modular para planificación de travesías científicas EVA sobre Marte.

## Módulos
- Explorar
- Planificar
- Ciencia
- Terreno y peligros
- Navegador EVA
- Control de misión
- Resultados
- Configuración

## Motor de rutas
El motor V29 conserva el A* multicriterio incorporado en V28: distancia, pendiente direccional, rugosidad, transitabilidad, confianza cartográfica, límites duros y valor científico.

## Ciencia
Los objetivos científicos disponen de valor 0-100, tiempo de trabajo, obligatoriedad, categoría y notas. Valor, tiempo y obligatoriedad afectan el cálculo de la misión.

## Configuración
Permite identificar la misión, conservar valores operacionales predeterminados, importar/exportar misiones JSON y administrar el historial local.

## Resultados y PDF
Análisis e Informes se unificaron en Resultados. Desde allí se consultan las métricas, se guarda la misión y se genera el informe PDF completo.

## Fuentes
La aplicación mantiene MOLA/HRSC/MDEM200M y las fuentes NASA/USGS configuradas en versiones anteriores.

> JEZERO sigue siendo una herramienta experimental de planificación y simulación. No certifica seguridad humana EVA.

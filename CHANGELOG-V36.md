# CHANGELOG — JEZERO V36

## Routing
- Optimización automática del orden de visita independiente del orden de inserción.
- Held-Karp geodésico para hasta 10 puntos como semilla del orden.
- Refinamiento terrain-aware usando evaluaciones A* por estrategia.
- Modo manual opcional.
- Numeración del mapa y timeline basada en el orden final calculado.
- Solo la estrategia activa se dibuja sobre el mapa para evitar líneas superpuestas.

## Simplificación
- Eliminado el módulo CIENCIA de la navegación principal.
- Eliminado el valor científico, Science Return y selección opcional por puntuación.
- Todos los puntos de misión forman parte del recorrido; su tiempo de parada sí afecta la duración EVA.
- Navegación principal: MAPA, MISIÓN, EVA, RESULTADOS y CONFIG.

## Mission Analytics
- Perfil multicapa sincronizado: elevación, pendiente, rugosidad, transitabilidad y confianza.
- Distribución interactiva de pendientes.
- Distribución interactiva de transitabilidad.
- Distribución interactiva de rugosidad.
- Distribución interactiva de confianza cartográfica.
- Presupuesto EVA interactivo.
- Ventana EVA restante por distancia.
- Ascenso y descenso acumulado.
- Dificultad del terreno por distancia.
- Comparación clicable de estrategias.
- Mission Health.
- Mini mapa analítico sincronizado.
- Tabla interactiva tramo por tramo.
- Hover/clic compartido entre gráficos y mapa analítico.

## PDF V36
- Informe completo sin métricas de valor científico.
- Identificación y parámetros operacionales.
- Todos los puntos y tiempos de parada.
- Secuencia optimizada.
- Mapa esquemático.
- Métricas completas y terreno por tramo.
- Perfil de elevación y perfil multicapa.
- Distribuciones de pendiente, transitabilidad, rugosidad y confianza.
- Presupuesto EVA y ventana de retorno.
- Ascenso/descenso acumulado y dificultad por distancia.
- Mission Health y comparación de estrategias.
- Detalle de la optimización del orden.
- Fuentes, configuración técnica, limitaciones y apéndice de nodos.

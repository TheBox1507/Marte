# Mars Explorer V5 — lógica operacional de misión

Esta versión corrige tres problemas funcionales de la planificación:

1. Los parámetros operacionales vuelven a formar parte del cálculo de la misión.
   - Velocidad nominal cambia la duración estimada y puede modificar el coste de búsqueda de las estrategias terreno/tiempo.
   - Tiempo máximo de EVA define la ventana operativa disponible.
   - Margen de retorno reserva una fracción de la EVA y se usa como restricción.
   - Al cambiar parámetros aparece `CAMBIOS PENDIENTES` y `Recalcular misión` vuelve a ejecutar la planificación.

2. Los puntos obligatorios y opcionales tienen distinto tratamiento.
   - El primer punto/base y todos los puntos marcados como OBLIGATORIO siempre deben permanecer en la secuencia.
   - Los puntos OPCIONALES son candidatos: se incorporan solamente si la misión completa sigue dentro del tiempo operativo disponible.
   - Los opcionales que no caben se muestran como omitidos por restricciones.
   - Si los puntos obligatorios por sí solos exceden el tiempo disponible, la misión queda marcada `FUERA DE LÍMITE`.

3. La estrategia forma parte del coste A*.
   - Más directa: minimiza distancia.
   - Equilibrada: combina distancia, pendiente y tiempo.
   - Menor exposición: penaliza fuertemente la pendiente y el tiempo de desplazamiento.
   - Las tres estrategias se calculan de forma independiente para cada tramo.

También se corrigió la carga de `mars-data.json` para que se sirva desde la raíz del proyecto.

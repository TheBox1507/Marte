# JEZERO V35 - Actualización GitHub

Esta actualización parte de JEZERO V34.

## Archivos a reemplazar

Reemplaza en tu repositorio:

- `index.html`
- `style.css`
- `script.js`
- `pdf-report.mjs`
- `server.mjs`
- `modules/module-shell.js`

No es necesario reemplazar `mars-data.json`, `mars-elevation.js`, `elevations.mjs`, los assets ni la base de nomenclatura de V34.

## Qué cambia

### Resultados / Mission Analytics

Al abrir **RESULTADOS**, el área central se convierte en un centro de análisis con:

- perfil multicapa de elevación, pendiente, transitabilidad y confianza;
- tooltip interactivo por distancia;
- distribución de pendientes;
- distribución de transitabilidad;
- presupuesto de tiempo EVA;
- Science Return acumulado;
- comparación de las tres estrategias;
- Mission Health.

Los gráficos se construyen con datos ya calculados por el motor. No se añaden estimaciones ficticias de oxígeno, batería, radiación o recursos que todavía no formen parte del modelo.

### HUD

El bloque de estado que tapaba parte del mapa inicia compacto. Puede expandirse o contraerse con el control del propio HUD y la preferencia queda guardada en el navegador.

### PDF V35

El PDF sigue siendo el informe técnico completo. Conserva todos los datos anteriores y añade:

- mapa esquemático de la misión;
- perfil multicapa;
- distribución de pendientes;
- distribución de transitabilidad;
- presupuesto EVA;
- Science Return acumulado;
- Mission Health;
- comparación visual de estrategias;
- tablas, parámetros, terreno por tramo, objetivos, fuentes, limitaciones y apéndice de nodos.

## Después de subir los archivos

1. Guarda los cambios en GitHub.
2. Despliega normalmente tu proyecto.
3. En el navegador usa `Ctrl + F5` para evitar que se conserven archivos V34 en caché.
4. Calcula una misión y entra a **RESULTADOS**.
5. Genera un PDF de prueba desde `Guardar misión y generar PDF completo`.

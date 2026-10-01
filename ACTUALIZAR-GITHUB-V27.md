# Actualizar JEZERO a V27 en GitHub

Este paquete está preparado para copiarse directamente sobre la raíz de tu proyecto JEZERO.

## Archivos que debes reemplazar

- `index.html`
- `style.css`
- `script.js`
- `pdf-report.mjs`
- `server.mjs`
- `package.json`
- `modules/module-shell.js`
- `README.md`

## Archivo nuevo recomendado

- `CHANGELOG-V27.md`

## No debes borrar ni cambiar

Mantén tus archivos y carpetas existentes que no aparecen en la lista anterior, especialmente:

- `assets/`
- `mars-elevation.js`
- `mars-data.json`
- `data/`
- `db-schema.sql`
- `elevations.mjs`
- `health.mjs`
- `render.yaml`

## Procedimiento rápido en GitHub

1. Descomprime este ZIP.
2. Copia su contenido en la raíz del repositorio.
3. Acepta el reemplazo de los archivos indicados.
4. Confirma que exista la carpeta `modules/` y dentro `module-shell.js`.
5. Haz commit de los cambios.
6. Si usas Render u otro despliegue automático, espera a que se complete el nuevo deploy.
7. Abre JEZERO y fuerza una recarga completa del navegador si todavía ves colores o textos de la versión anterior.

## Prueba recomendada después de actualizar

1. Abre el módulo **Planificador de misión**.
2. Crea una base y al menos dos objetivos.
3. Calcula la misión.
4. Cambia entre las tres estrategias.
5. Abre **Informes**.
6. Pulsa **Guardar misión + PDF**.
7. Comprueba que el PDF incluya puntos, parámetros, métricas, estrategias, tramos y el apéndice de nodos.

## Nota

El PDF crece en número de páginas según la cantidad de objetivos y nodos calculados. Esto es intencional: V27 prioriza conservar todos los datos disponibles de la misión.

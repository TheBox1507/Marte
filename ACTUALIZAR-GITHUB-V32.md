# ACTUALIZAR JEZERO A V32 EN GITHUB

Esta actualización está preparada para reemplazar archivos sin reconstruir el repositorio.

## 1. Reemplazar en la raíz del proyecto

Reemplaza estos archivos por los incluidos en este ZIP:

- `index.html`
- `style.css`
- `script.js`
- `pdf-report.mjs`
- `README.md`

## 2. Reemplazar dentro de `modules/`

- `modules/module-shell.js`
- `modules/i18n.js`
- `modules/theme.js`

`theme.js` se incluye para que V32 pueda aplicarse también si tu repositorio todavía no tenía completa la V31.

## 3. No borrar

No necesitas reemplazar ni eliminar:

- `server.mjs`
- `mars-elevation.js`
- datos cartográficos;
- assets existentes;
- archivos SQL;
- configuración del despliegue.

## 4. Después de subir a GitHub

Haz una recarga completa del navegador:

- Windows: `Ctrl + F5`
- macOS: `Cmd + Shift + R`

Esto evita que el navegador reutilice CSS/JS de V31.

## 5. Qué comprobar

1. El mapa debe ocupar todo el área central sin corte lateral.
2. Deben aparecer solo: MAPA, MISIÓN, CIENCIA, EVA, RESULTADOS y CONFIG.
3. En MISIÓN debe aparecer la línea de tiempo de la EVA después de calcular una ruta.
4. En CIENCIA deben verse los valores científicos y el costo operacional de objetivos opcionales.
5. En RESULTADOS debe aparecer el perfil de elevación cuando exista una ruta calculada.
6. En CONFIG. deben seguir funcionando idioma y tema visual.
7. Al generar el PDF debe aparecer `ANÁLISIS DEL TERRENO DE LA MISIÓN`.

## Nota sobre 1366 x 768

V32 ya no suma columnas rígidas a ambos lados del mapa. Los paneles flotan sobre el mapa y tienen scroll interno, por lo que el panel derecho no debería quedar fuera del viewport como en el layout anterior.

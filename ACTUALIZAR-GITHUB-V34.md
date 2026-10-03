# Actualizar JEZERO a V34

Esta actualización parte de JEZERO V33.

## 1. Reemplaza estos archivos

En la raíz del proyecto sustituye:

- `index.html`
- `style.css`
- `script.js`
- `server.mjs`
- `mars-data.json`

Dentro de `modules/` sustituye:

- `modules/module-shell.js`
- `modules/i18n.js`

No necesitas reemplazar `pdf-report.mjs`, `mars-elevation.js`, `modules/theme.js` ni la carpeta `assets` para aplicar V34.

## 2. Importante: server.mjs sí cambia

V34 agrega `/api/mars-nomenclature`, que consulta la nomenclatura IAU/USGS según el área visible. Si solo actualizas HTML/CSS/JS y dejas el servidor anterior, JEZERO seguirá funcionando con las 49 referencias locales, pero no podrá cargar la nomenclatura ampliada por zona.

## 3. Ejecuta el proyecto como antes

Ejemplo:

```bash
node server.mjs
```

Luego abre la dirección que indique el servidor.

## 4. Limpia la caché

Después de subir/reemplazar los archivos usa:

`Ctrl + F5`

Los recursos principales están versionados con `?v=34`.

## 5. Prueba rápida recomendada

1. Abre `MAPA`.
2. En `CAPAS`, cambia entre `Marte real`, `MOLA + HRSC` e `Híbrido`.
3. Activa `Nombres IAU / USGS` y acércate a una región para comprobar que aparecen más nombres.
4. Activa `Aterrizajes`.
5. Abre ambos paneles y verifica que HUD/textos no se superponen.
6. Pulsa un botón inferior; vuelve a pulsar el mismo y verifica que los paneles se cierran.
7. Comprueba que la barra de desplazamiento lateral usa el tema JEZERO.
8. Genera un PDF de misión para confirmar que el análisis de terreno continúa disponible.

## Comportamiento sin conexión externa

Si USGS no está disponible, la capa de nombres cambia a `BASE LOCAL` y mantiene las referencias principales incorporadas. El mapa, la planificación y el PDF continúan funcionando.

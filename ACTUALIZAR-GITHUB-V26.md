# Cómo actualizar el repositorio a V26

El ZIP de actualización contiene únicamente archivos nuevos o modificados. Copia su contenido sobre la carpeta `Marte` del repositorio respetando las rutas.

## Reemplazar

- `index.html`
- `style.css`
- `script.js`
- `README.md`
- `package.json`

## Agregar

- `modules/module-shell.js`
- `CHANGELOG-V26.md`
- `ACTUALIZAR-GITHUB-V26.md`

## No es necesario cambiar

- `server.mjs`
- `pdf-report.mjs`
- `mars-elevation.js`
- `elevations.mjs`
- `health.mjs`
- `db-schema.sql`
- `mars-data.json`
- `data/`
- `assets/`

## Git

Después de copiar los archivos:

```bash
git add index.html style.css script.js README.md package.json modules/module-shell.js CHANGELOG-V26.md ACTUALIZAR-GITHUB-V26.md
git commit -m "Mars Explorer V26 modular architecture"
git push
```

Si el despliegue está conectado a GitHub/Render, la aplicación seguirá usando el mismo comando `npm start`.

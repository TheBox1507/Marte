// Mars Explorer — elevación global estable mediante ArcGIS Maps SDK.
// MDEM200M se utiliza como ElevationLayer y se consulta con queryElevation().
// Esto evita el endpoint REST /getSamples que estaba devolviendo HTTP 404.
(function () {
  const ELEVATION_URL = 'https://astro.arcgis.com/arcgis/rest/services/OnMars/MDEM200M/ImageServer';
  const MARS_SR = { wkid: 104971 };
  let layer = null;

  const ready = new Promise((resolve, reject) => {
    if (typeof require !== 'function') {
      reject(new Error('No se pudo cargar ArcGIS Maps SDK for JavaScript.'));
      return;
    }

    require([
      'esri/layers/ElevationLayer',
      'esri/geometry/Multipoint'
    ], function (ElevationLayer, Multipoint) {
      layer = new ElevationLayer({
        url: ELEVATION_URL,
        copyright: 'NASA, ESA, HRSC, Goddard Space Flight Center, USGS Astrogeology Science Center, Esri'
      });

      layer.load().then(function () {
        window.marsElevationStatus = 'ready';
        window.marsElevationInfo = {
          url: ELEVATION_URL,
          source: 'MDEM200M · NASA / ESA / HRSC / USGS / Esri',
          resolution: 'aprox. 200 m',
          spatialReference: MARS_SR
        };

        window.queryMarsElevations = async function (points) {
          if (!Array.isArray(points) || !points.length) return [];

          const geometry = new Multipoint({
            points: points.map(function (p) { return [Number(p.lon), Number(p.lat)]; }),
            spatialReference: MARS_SR
          });

          const result = await layer.queryElevation(geometry, {
            demResolution: 'auto'
          });

          const sampled = result && result.geometry ? result.geometry.points : [];
          return points.map(function (p, i) {
            const z = Number(sampled && sampled[i] ? sampled[i][2] : NaN);
            return Object.assign({}, p, { elevationM: Number.isFinite(z) ? z : null });
          });
        };

        resolve(layer);
      }).catch(reject);
    }, reject);
  });

  window.marsElevationReady = ready.catch(function (error) {
    window.marsElevationStatus = 'error';
    window.marsElevationError = error;
    throw error;
  });
})();

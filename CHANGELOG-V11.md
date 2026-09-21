# Mars Explorer V11

## Cambio principal: cobertura global
- Se elimina la dependencia funcional del cráter Jezero.
- Las coordenadas A/B/waypoints pueden seleccionarse en cualquier zona de Marte.
- El mapa inicia con una vista planetaria global.
- El botón Centro vuelve a la vista global.
- El lugar de aterrizaje de Perseverance pasa a ser un punto de referencia opcional y no una restricción.

## Motor de terreno
- Se sustituye el DEM CTX de Jezero por el DEM global MOLA 463 m/píxel publicado por USGS Astrogeology.
- Se mantiene lectura remota por ventanas del GeoTIFF para evitar descargar el planeta completo.
- El índice de riesgo se interpreta explícitamente como experimental y de escala planetaria.

## Capas
- Base: MOLA + HRSC global 200 m/píxel.
- Relieve MOLA global 463 m/píxel.
- Inercia térmica TES global mediante Mars Trek.
- Se retiran de la interfaz las capas Rugosidad MOLA y Polvo TES que habían presentado fallos de carga y resolución insuficiente para el zoom de trabajo.

## Misiones
- Los puntos de misión ya no tienen límite geográfico de Jezero.
- Se mantienen objetivos obligatorios/opcionales, desvíos, regreso a base, estrategias, parámetros y recálculo.

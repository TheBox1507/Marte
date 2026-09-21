# Mars Explorer V15

- Se eliminan THEMIS Día/Noche del panel y del backend por no ser necesarios para la planificación actual.
- Se elimina la capa WMS de nomenclatura que producía errores de carga.
- El DEM MDEM200M se consulta en lotes pequeños para evitar HTTP 414.
- Pendiente y rugosidad dejan de mostrar error al zoom global; indican “Acerca para analizar” y se calculan en vista regional.
- Se mantienen rutas y puntos como capas operativas.
- Se hace la distancia marciana resistente al cruce del meridiano ±180°.

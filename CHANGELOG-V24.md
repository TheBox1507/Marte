# Mars Explorer V24

- Fixed the "Añadir punto por coordenadas" button: it now opens the coordinate dialog and supports closing with X, Cancel, click outside, and Escape.
- Added decimal coordinate parsing with comma or dot decimals.
- Added validation for latitude (-90..90) and longitude (-180..180).
- Adding a normal point appends it to the mission, updates the map markers and sequence, and recenters the map.
- Adding a base coordinate makes it P0/Base, forces it to mandatory, removes any previous base, preserves existing non-base objectives, resets mission results, and recenters on the new base.
- Coordinate point type automatically adjusts required/optional and dwell time controls for base vs objective.
- Enter key submits the coordinate form from the coordinate inputs.

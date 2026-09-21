# Mars Explorer V14

- Elevation sampling now uses ArcGIS ImageServer `getSamples` with the global MDEM200M Mars elevation service.
- Route metrics now expose maximum and average slope plus cumulative absolute elevation change.
- Fixed “Tiempo en objetivos” to use the mission dwell total.
- A* costs now differ by direct, balanced, and lower-exposure strategies.
- Optional waypoints are included only when operational constraints and strategy criteria allow them; required waypoints remain mandatory.

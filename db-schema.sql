-- Preparación para una futura versión PostgreSQL + PostGIS.
-- No es necesaria para ejecutar la versión actual.
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS mission_source (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reference_point (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  position geometry(Point, 4326) NOT NULL,
  description TEXT,
  source_id BIGINT REFERENCES mission_source(id)
);

CREATE TABLE IF NOT EXISTS planned_route (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  mode TEXT NOT NULL,
  path geometry(LineString, 4326) NOT NULL,
  distance_km DOUBLE PRECISION,
  duration_h DOUBLE PRECISION,
  max_slope_deg DOUBLE PRECISION,
  accumulated_gain_m DOUBLE PRECISION,
  risk_score INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- POI Mapping Platform - Initial Schema Migration
-- PostgreSQL Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- AREAS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS areas (
  area_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_name VARCHAR(200) NOT NULL,
  description TEXT,
  boundary_geojson JSONB,
  center_lat NUMERIC(10,7),
  center_lng NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_areas_area_name ON areas(area_name);

-- ============================================================================
-- GRIDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS grids (
  grid_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(area_id) ON DELETE CASCADE,
  grid_code VARCHAR(20) NOT NULL,
  row_index INTEGER NOT NULL,
  col_index INTEGER NOT NULL,
  center_lat NUMERIC(10,7),
  center_lng NUMERIC(10,7),
  min_lat NUMERIC(10,7),
  min_lng NUMERIC(10,7),
  max_lat NUMERIC(10,7),
  max_lng NUMERIC(10,7),
  status VARCHAR(20) DEFAULT 'pending',
  last_harvested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(area_id, grid_code),
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped'))
);

CREATE INDEX IF NOT EXISTS idx_grids_area_id ON grids(area_id);
CREATE INDEX IF NOT EXISTS idx_grids_status ON grids(status);
CREATE INDEX IF NOT EXISTS idx_grids_grid_code ON grids(grid_code);

-- ============================================================================
-- KEYWORD_SETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS keyword_sets (
  keyword_set_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword_set_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_keyword_sets_is_active ON keyword_sets(is_active);

-- ============================================================================
-- KEYWORD_SET_ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS keyword_set_items (
  keyword_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword_set_id UUID NOT NULL REFERENCES keyword_sets(keyword_set_id) ON DELETE CASCADE,
  keyword_text VARCHAR(200) NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_keyword_set_items_keyword_set_id ON keyword_set_items(keyword_set_id);
CREATE INDEX IF NOT EXISTS idx_keyword_set_items_keyword_text ON keyword_set_items(keyword_text);

-- ============================================================================
-- JOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobs (
  job_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  area_id UUID NOT NULL REFERENCES areas(area_id) ON DELETE RESTRICT,
  job_name VARCHAR(200) NOT NULL,
  job_description TEXT,
  created_by VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'pending',
  keyword_set_id UUID NOT NULL REFERENCES keyword_sets(keyword_set_id) ON DELETE RESTRICT,
  collection_type VARCHAR(30),
  include_rating BOOLEAN DEFAULT FALSE,
  include_reviews_count BOOLEAN DEFAULT FALSE,
  include_address BOOLEAN DEFAULT FALSE,
  total_grids INTEGER DEFAULT 0,
  done_grids INTEGER DEFAULT 0,
  failed_grids INTEGER DEFAULT 0,
  total_results INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  error_message TEXT,
  created_source VARCHAR(30),
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CHECK (status IN ('pending', 'processing', 'paused', 'completed', 'failed', 'cancelled')),
  CHECK (done_grids <= total_grids),
  CHECK (failed_grids <= total_grids),
  CHECK (done_grids + failed_grids <= total_grids)
);

CREATE INDEX IF NOT EXISTS idx_jobs_area_id ON jobs(area_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_keyword_set_id ON jobs(keyword_set_id);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);

-- ============================================================================
-- JOB_GRIDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_grids (
  job_grid_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  grid_id UUID NOT NULL REFERENCES grids(grid_id) ON DELETE CASCADE,
  grid_status VARCHAR(20) DEFAULT 'pending',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  records_collected INTEGER DEFAULT 0,
  requests_used INTEGER DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(job_id, grid_id),
  CHECK (grid_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  CHECK (retry_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_job_grids_job_id ON job_grids(job_id);
CREATE INDEX IF NOT EXISTS idx_job_grids_grid_id ON job_grids(grid_id);
CREATE INDEX IF NOT EXISTS idx_job_grids_grid_status ON job_grids(grid_status);
CREATE INDEX IF NOT EXISTS idx_job_grids_job_grid_status ON job_grids(job_id, grid_status);

-- ============================================================================
-- POI_RAW TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS poi_raw (
  poi_raw_id BIGSERIAL PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  grid_id UUID NOT NULL REFERENCES grids(grid_id) ON DELETE CASCADE,
  keyword_text VARCHAR(200),
  place_id VARCHAR(200),
  place_name VARCHAR(300),
  primary_category VARCHAR(150),
  address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  rating NUMERIC(3,2),
  reviews_count INTEGER,
  raw_payload_json JSONB,
  harvested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_poi_raw_job_id ON poi_raw(job_id);
CREATE INDEX IF NOT EXISTS idx_poi_raw_grid_id ON poi_raw(grid_id);
CREATE INDEX IF NOT EXISTS idx_poi_raw_place_id ON poi_raw(place_id);
CREATE INDEX IF NOT EXISTS idx_poi_raw_job_grid ON poi_raw(job_id, grid_id);
CREATE INDEX IF NOT EXISTS idx_poi_raw_harvested_at ON poi_raw(harvested_at DESC);

-- ============================================================================
-- POI_MASTER TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS poi_master (
  place_id VARCHAR(200) PRIMARY KEY,
  place_name VARCHAR(300) NOT NULL,
  primary_category VARCHAR(150),
  address TEXT,
  latitude NUMERIC(10,7),
  longitude NUMERIC(10,7),
  rating NUMERIC(3,2),
  reviews_count INTEGER,
  first_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_poi_master_place_name ON poi_master(place_name);
CREATE INDEX IF NOT EXISTS idx_poi_master_primary_category ON poi_master(primary_category);
CREATE INDEX IF NOT EXISTS idx_poi_master_latitude_longitude ON poi_master(latitude, longitude);

-- ============================================================================
-- POI_JOB_MAP TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS poi_job_map (
  poi_job_map_id BIGSERIAL PRIMARY KEY,
  place_id VARCHAR(200) NOT NULL REFERENCES poi_master(place_id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  grid_id UUID NOT NULL REFERENCES grids(grid_id) ON DELETE CASCADE,
  keyword_text VARCHAR(200),
  harvested_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(place_id, job_id, grid_id)
);

CREATE INDEX IF NOT EXISTS idx_poi_job_map_place_id ON poi_job_map(place_id);
CREATE INDEX IF NOT EXISTS idx_poi_job_map_job_id ON poi_job_map(job_id);
CREATE INDEX IF NOT EXISTS idx_poi_job_map_grid_id ON poi_job_map(grid_id);
CREATE INDEX IF NOT EXISTS idx_poi_job_map_job_grid ON poi_job_map(job_id, grid_id);

-- ============================================================================
-- EXPORTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS exports (
  export_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES jobs(job_id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  export_schema_type VARCHAR(50),
  filter_json JSONB,
  record_count INTEGER DEFAULT 0,
  file_path TEXT,
  created_by VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_exports_job_id ON exports(job_id);
CREATE INDEX IF NOT EXISTS idx_exports_created_at ON exports(created_at DESC);

-- ============================================================================
-- FINAL TIMESTAMP UPDATE TRIGGERS (optional, for automation)
-- ============================================================================
-- These are optional but recommended for auto-updating the updated_at column

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_areas_update_timestamp
BEFORE UPDATE ON areas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_grids_update_timestamp
BEFORE UPDATE ON grids
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_jobs_update_timestamp
BEFORE UPDATE ON jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_job_grids_update_timestamp
BEFORE UPDATE ON job_grids
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_poi_master_update_timestamp
BEFORE UPDATE ON poi_master
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- POI Mapping Platform - MySQL Initial Schema Migration

-- ============================================================================
-- AREAS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS areas (
  area_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  area_name VARCHAR(200) NOT NULL,
  description TEXT,
  boundary_geojson JSON,
  center_lat DECIMAL(10,7),
  center_lng DECIMAL(10,7),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_areas_area_name (area_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- GRIDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS grids (
  grid_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  area_id CHAR(36) NOT NULL,
  grid_code VARCHAR(20) NOT NULL,
  row_index INT NOT NULL,
  col_index INT NOT NULL,
  center_lat DECIMAL(10,7),
  center_lng DECIMAL(10,7),
  min_lat DECIMAL(10,7),
  min_lng DECIMAL(10,7),
  max_lat DECIMAL(10,7),
  max_lng DECIMAL(10,7),
  status VARCHAR(20) DEFAULT 'pending',
  last_harvested_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_area_grid (area_id, grid_code),
  INDEX idx_grids_area_id (area_id),
  INDEX idx_grids_status (status),
  INDEX idx_grids_grid_code (grid_code),
  CONSTRAINT fk_grids_areas FOREIGN KEY (area_id) REFERENCES areas(area_id) ON DELETE CASCADE,
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- KEYWORD_SETS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS keyword_sets (
  keyword_set_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  keyword_set_name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_keyword_sets_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- KEYWORD_SET_ITEMS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS keyword_set_items (
  keyword_item_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  keyword_set_id CHAR(36) NOT NULL,
  keyword_text VARCHAR(200) NOT NULL,
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_keyword_set_items_keyword_set_id (keyword_set_id),
  INDEX idx_keyword_set_items_keyword_text (keyword_text),
  CONSTRAINT fk_keyword_set_items_keyword_sets FOREIGN KEY (keyword_set_id) REFERENCES keyword_sets(keyword_set_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- JOBS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS jobs (
  job_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  area_id CHAR(36) NOT NULL,
  job_name VARCHAR(200) NOT NULL,
  job_description TEXT,
  created_by VARCHAR(150),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  finished_at DATETIME,
  status VARCHAR(20) DEFAULT 'pending',
  keyword_set_id CHAR(36) NOT NULL,
  collection_type VARCHAR(30),
  include_rating BOOLEAN DEFAULT FALSE,
  include_reviews_count BOOLEAN DEFAULT FALSE,
  include_address BOOLEAN DEFAULT FALSE,
  total_grids INT DEFAULT 0,
  done_grids INT DEFAULT 0,
  failed_grids INT DEFAULT 0,
  total_results INT DEFAULT 0,
  total_requests INT DEFAULT 0,
  error_message TEXT,
  created_source VARCHAR(30),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_jobs_area_id (area_id),
  INDEX idx_jobs_status (status),
  INDEX idx_jobs_keyword_set_id (keyword_set_id),
  INDEX idx_jobs_created_at (created_at DESC),
  CONSTRAINT fk_jobs_areas FOREIGN KEY (area_id) REFERENCES areas(area_id) ON DELETE RESTRICT,
  CONSTRAINT fk_jobs_keyword_sets FOREIGN KEY (keyword_set_id) REFERENCES keyword_sets(keyword_set_id) ON DELETE RESTRICT,
  CHECK (status IN ('pending', 'processing', 'paused', 'completed', 'failed', 'cancelled')),
  CHECK (done_grids <= total_grids),
  CHECK (failed_grids <= total_grids),
  CHECK (done_grids + failed_grids <= total_grids)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- JOB_GRIDS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS job_grids (
  job_grid_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  job_id CHAR(36) NOT NULL,
  grid_id CHAR(36) NOT NULL,
  grid_status VARCHAR(20) DEFAULT 'pending',
  started_at DATETIME,
  finished_at DATETIME,
  records_collected INT DEFAULT 0,
  requests_used INT DEFAULT 0,
  error_message TEXT,
  retry_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_job_grid (job_id, grid_id),
  INDEX idx_job_grids_job_id (job_id),
  INDEX idx_job_grids_grid_id (grid_id),
  INDEX idx_job_grids_grid_status (grid_status),
  INDEX idx_job_grids_job_grid_status (job_id, grid_status),
  CONSTRAINT fk_job_grids_jobs FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
  CONSTRAINT fk_job_grids_grids FOREIGN KEY (grid_id) REFERENCES grids(grid_id) ON DELETE CASCADE,
  CHECK (grid_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
  CHECK (retry_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- POI_RAW TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS poi_raw (
  poi_raw_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  job_id CHAR(36) NOT NULL,
  grid_id CHAR(36) NOT NULL,
  keyword_text VARCHAR(200),
  place_id VARCHAR(200),
  place_name VARCHAR(300),
  primary_category VARCHAR(150),
  address TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  rating DECIMAL(3,2),
  reviews_count INT,
  raw_payload_json JSON,
  harvested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_poi_raw_job_id (job_id),
  INDEX idx_poi_raw_grid_id (grid_id),
  INDEX idx_poi_raw_place_id (place_id),
  INDEX idx_poi_raw_job_grid (job_id, grid_id),
  INDEX idx_poi_raw_harvested_at (harvested_at DESC),
  CONSTRAINT fk_poi_raw_jobs FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
  CONSTRAINT fk_poi_raw_grids FOREIGN KEY (grid_id) REFERENCES grids(grid_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- POI_MASTER TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS poi_master (
  place_id VARCHAR(200) PRIMARY KEY,
  place_name VARCHAR(300) NOT NULL,
  primary_category VARCHAR(150),
  address TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  rating DECIMAL(3,2),
  reviews_count INT,
  first_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_poi_master_place_name (place_name),
  INDEX idx_poi_master_primary_category (primary_category),
  INDEX idx_poi_master_latitude_longitude (latitude, longitude)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- POI_JOB_MAP TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS poi_job_map (
  poi_job_map_id BIGINT AUTO_INCREMENT PRIMARY KEY,
  place_id VARCHAR(200) NOT NULL,
  job_id CHAR(36) NOT NULL,
  grid_id CHAR(36) NOT NULL,
  keyword_text VARCHAR(200),
  harvested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_poi_job_grid (place_id, job_id, grid_id),
  INDEX idx_poi_job_map_place_id (place_id),
  CONSTRAINT fk_poi_job_map_poi_master FOREIGN KEY (place_id) REFERENCES poi_master(place_id) ON DELETE CASCADE,
  CONSTRAINT fk_poi_job_map_jobs FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE,
  CONSTRAINT fk_poi_job_map_grids FOREIGN KEY (grid_id) REFERENCES grids(grid_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- EXPORTS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS exports (
  export_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  job_id CHAR(36) NOT NULL,
  export_name VARCHAR(200) NOT NULL,
  export_type VARCHAR(50),
  file_path TEXT,
  file_size BIGINT,
  status VARCHAR(20) DEFAULT 'pending',
  created_by VARCHAR(150),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_exports_job_id (job_id),
  INDEX idx_exports_status (status),
  CONSTRAINT fk_exports_jobs FOREIGN KEY (job_id) REFERENCES jobs(job_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
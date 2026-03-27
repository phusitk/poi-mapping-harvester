-- POI Mapping Platform - Seed Data for MVP Testing

-- ============================================================================
-- INSERT AREAS
-- ============================================================================
INSERT INTO areas (area_id, area_name, description, boundary_geojson, center_lat, center_lng)
VALUES (
  'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  'ตำบลต้นเปา',
  'Ton Pao Subdistrict, Chiang Mai Province, Thailand',
  '{"type": "Polygon", "coordinates": [[[98.25, 18.65], [98.32, 18.65], [98.32, 18.72], [98.25, 18.72], [98.25, 18.65]]]}',
  18.6833,
  98.2833
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT KEYWORD SETS
-- ============================================================================
INSERT INTO keyword_sets (keyword_set_id, keyword_set_name, description, is_active)
VALUES (
  'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  'Tourism Basic',
  'Basic tourism POI categories for Chiang Mai',
  TRUE
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT KEYWORD SET ITEMS
-- ============================================================================
INSERT INTO keyword_set_items (keyword_set_id, keyword_text, sort_order)
VALUES
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ร้านหัตถกรรม', 1),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'คาเฟ่', 2),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'วัด', 3),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'แหล่งท่องเที่ยว', 4),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ร้านอาหาร', 5),
  ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'ศูนย์การเรียนรู้', 6)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- INSERT GRIDS (2 rows x 6 columns = 12 grids)
-- Row A: A01-A06, Row B: B01-B06
-- Chiang Mai coordinates baseline: 18.6833, 98.2833
-- Grid spacing: ~0.01 degrees (approximately 1.1 km)
-- ============================================================================
INSERT INTO grids (grid_id, area_id, grid_code, row_index, col_index, center_lat, center_lng, min_lat, min_lng, max_lat, max_lng, status)
VALUES
  -- Row A (row_index = 0)
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a12', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'A01', 0, 0, 18.6833, 98.2533, 18.6783, 98.2483, 18.6883, 98.2583, 'pending'),
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a13', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'A02', 0, 1, 18.6833, 98.2633, 18.6783, 98.2583, 18.6883, 98.2683, 'pending'),
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a14', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'A03', 0, 2, 18.6833, 98.2733, 18.6783, 98.2683, 18.6883, 98.2783, 'pending'),
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a15', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'A04', 0, 3, 18.6833, 98.2833, 18.6783, 98.2783, 18.6883, 98.2883, 'pending'),
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a16', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'A05', 0, 4, 18.6833, 98.2933, 18.6783, 98.2883, 18.6883, 98.2983, 'pending'),
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a17', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'A06', 0, 5, 18.6833, 98.3033, 18.6783, 98.2983, 18.6883, 98.3083, 'pending'),
  
  -- Row B (row_index = 1)
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a18', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'B01', 1, 0, 18.6733, 98.2533, 18.6683, 98.2483, 18.6783, 98.2583, 'pending'),
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a19', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'B02', 1, 1, 18.6733, 98.2633, 18.6683, 98.2583, 18.6783, 98.2683, 'pending'),
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a1a', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'B03', 1, 2, 18.6733, 98.2733, 18.6683, 98.2683, 18.6783, 98.2783, 'pending'),
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a1b', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'B04', 1, 3, 18.6733, 98.2833, 18.6683, 98.2783, 18.6783, 98.2883, 'pending'),
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a1c', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'B05', 1, 4, 18.6733, 98.2933, 18.6683, 98.2883, 18.6783, 98.2983, 'pending'),
  ('b1e35d99-9c0b-4ef8-bb6d-6bb9bd380a1d', 'f47ac10b-58cc-4372-a567-0e02b2c3d479', 'B06', 1, 5, 18.6733, 98.3033, 18.6683, 98.2983, 18.6783, 98.3083, 'pending')
ON CONFLICT DO NOTHING;
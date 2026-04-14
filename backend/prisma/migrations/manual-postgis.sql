-- Manual PostGIS Migration for QuickFixU
-- Run this SQL manually AFTER the initial Prisma migration
-- Prisma doesn't support PostGIS geography columns directly

-- IMPORTANT: Ensure PostGIS extension is installed first
CREATE EXTENSION IF NOT EXISTS postgis;

-- Add geography column to users table
-- GEOGRAPHY(POINT, 4326) = WGS84 latitude/longitude coordinates
ALTER TABLE users ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);

-- Populate location from existing latitude/longitude columns
-- ST_MakePoint(longitude, latitude) - NOTE: longitude comes FIRST
-- ST_SetSRID(..., 4326) - Set Spatial Reference System to WGS84
UPDATE users 
SET location = ST_SetSRID(ST_MakePoint(longitude::float, latitude::float), 4326)::geography
WHERE location IS NULL;

-- Create GIST spatial index for fast radius queries
-- GIST (Generalized Search Tree) is optimized for geography/geometry types
-- This enables fast ST_DWithin queries (e.g., find professionals within 30km)
CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST(location);

-- Verify the migration
SELECT 
    column_name, 
    data_type, 
    udt_name 
FROM information_schema.columns 
WHERE table_name = 'users' AND column_name = 'location';

-- Example query: Find users within 30km of Buenos Aires (-34.603722, -58.381592)
-- ST_DWithin(geography1, geography2, distance_in_meters)
-- SELECT * FROM users 
-- WHERE ST_DWithin(
--     location, 
--     ST_SetSRID(ST_MakePoint(-58.381592, -34.603722), 4326)::geography, 
--     30000
-- );

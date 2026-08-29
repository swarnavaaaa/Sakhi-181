-- SQL for Sakhi 181 Supabase Table (CSV Compatible)
-- Run this in the Supabase SQL Editor

-- 1. Setup the table with EXACT names to match your CSV headers
DROP TABLE IF EXISTS centers;

CREATE TABLE centers (
    id BIGSERIAL PRIMARY KEY,
    "District" TEXT,
    "Name" TEXT NOT NULL,
    "Category" TEXT,
    "NGO/GOVT/Pvt" TEXT,
    "Phone Number" TEXT,
    "Cnter Admin Phone Number (OSC)" TEXT,
    "Address" TEXT,
    "Pincode" TEXT NOT NULL,
    "Location" TEXT,
    "Point of Contact" TEXT,
    "Email" TEXT,
    "Website" TEXT,
    "Services provided" TEXT,
    "Last verified date" TEXT,
    "Photo" TEXT,
    "Google link" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Index for faster search (using the quoted name)
CREATE INDEX IF NOT EXISTS idx_centers_pincode ON centers("Pincode");

-- 3. Enable Row Level Security (RLS)
ALTER TABLE centers ENABLE ROW LEVEL SECURITY;

-- 4. Create a policy to allow public read access
CREATE POLICY "Allow public read access" 
ON centers FOR SELECT 
TO anon 
USING (true);


-- ============================================================================
-- GOVERNMENT HELPLINES TABLE
-- ============================================================================

DROP TABLE IF EXISTS government_helplines;

CREATE TABLE government_helplines (
    id BIGSERIAL PRIMARY KEY,
    "Name" TEXT NOT NULL,
    "Number" TEXT NOT NULL,
    "National / State" TEXT,
    "Toll-Free (Y/N)" TEXT,
    "Category" TEXT,
    "Services Provided" TEXT,
    "Languages Supported" TEXT,
    "Website" TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for fast category and type filtering
CREATE INDEX IF NOT EXISTS idx_helplines_category ON government_helplines("Category");
CREATE INDEX IF NOT EXISTS idx_helplines_national_state ON government_helplines("National / State");

-- Enable Row Level Security (RLS)
ALTER TABLE government_helplines ENABLE ROW LEVEL SECURITY;

-- Policy to allow public read access
CREATE POLICY "Allow public read access on government_helplines" 
ON government_helplines FOR SELECT 
TO anon 
USING (true);




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




-- Migration script to add missing columns to existing tables
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/vvxwqxwcnorzmklylmkx/sql/new)

-- 1. Add 'prices' column to 'ncd_pharmacies' if it doesn't exist
ALTER TABLE ncd_pharmacies 
ADD COLUMN IF NOT EXISTS prices JSONB DEFAULT NULL;

-- 2. Add 'assigned_clinic_id' and 'assigned_pharmacy_id' columns to 'ncd_profiles' if they don't exist
ALTER TABLE ncd_profiles 
ADD COLUMN IF NOT EXISTS assigned_clinic_id UUID REFERENCES ncd_clinics(id) ON DELETE SET NULL;

ALTER TABLE ncd_profiles 
ADD COLUMN IF NOT EXISTS assigned_pharmacy_id UUID REFERENCES ncd_pharmacies(id) ON DELETE SET NULL;

-- 3. Add 'pharmacy_id' and 'prescription_details' columns to 'ncd_orders' if they don't exist
ALTER TABLE ncd_orders 
ADD COLUMN IF NOT EXISTS pharmacy_id UUID REFERENCES ncd_pharmacies(id) ON DELETE SET NULL;

ALTER TABLE ncd_orders 
ADD COLUMN IF NOT EXISTS prescription_details TEXT DEFAULT NULL;

-- 4. Create System Alerts Table
CREATE TABLE IF NOT EXISTS ncd_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES ncd_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'info', 'warning', 'critical', 'success'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Add 'phone' and 'address' columns to 'ncd_profiles' table if they don't exist
ALTER TABLE ncd_profiles 
ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE ncd_profiles 
ADD COLUMN IF NOT EXISTS address TEXT;

-- 6. Add 'is_premium' and 'premium_expiry' columns to 'ncd_profiles' table if they don't exist
ALTER TABLE ncd_profiles 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

ALTER TABLE ncd_profiles 
ADD COLUMN IF NOT EXISTS premium_expiry TEXT DEFAULT NULL;

-- 7. Add 'is_premium' and 'premium_expiry' columns to 'ncd_clinics' and 'ncd_pharmacies' tables if they don't exist
ALTER TABLE ncd_clinics 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

ALTER TABLE ncd_clinics 
ADD COLUMN IF NOT EXISTS premium_expiry TEXT DEFAULT NULL;

ALTER TABLE ncd_pharmacies 
ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

ALTER TABLE ncd_pharmacies 
ADD COLUMN IF NOT EXISTS premium_expiry TEXT DEFAULT NULL;



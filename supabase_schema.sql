-- 1. Create Clinics Table
CREATE TABLE IF NOT EXISTS ncd_clinics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL, -- e.g. "Abuja", "Kaduna"
  contact_phone TEXT NOT NULL,
  is_premium BOOLEAN DEFAULT false,
  premium_expiry TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Pharmacies Table
CREATE TABLE IF NOT EXISTS ncd_pharmacies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  prices JSONB DEFAULT NULL, -- Custom medication pricing dictionary per pharmacy
  is_premium BOOLEAN DEFAULT false,
  premium_expiry TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Create Patient Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS ncd_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age INT NOT NULL,
  weight DECIMAL NOT NULL,
  conditions TEXT[] NOT NULL,
  baseline_bp TEXT NOT NULL,
  target_glucose_range TEXT NOT NULL,
  streak_days INT DEFAULT 0,
  active_meds TEXT[] NOT NULL,
  assigned_clinic_id UUID REFERENCES ncd_clinics(id) ON DELETE SET NULL,
  assigned_pharmacy_id UUID REFERENCES ncd_pharmacies(id) ON DELETE SET NULL,
  phone TEXT DEFAULT NULL,
  address TEXT DEFAULT NULL,
  is_premium BOOLEAN DEFAULT false,
  premium_expiry TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Create Clinicians Table (Linked to Supabase Auth & Clinics)
CREATE TABLE IF NOT EXISTS ncd_clinicians (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  clinic_id UUID REFERENCES ncd_clinics(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('Doctor', 'Nurse', 'Admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Create Pharmacists Table (Linked to Supabase Auth & Pharmacies)
CREATE TABLE IF NOT EXISTS ncd_pharmacists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pharmacy_id UUID REFERENCES ncd_pharmacies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Create Vitals Logs Table (BP + Glucose)
CREATE TABLE IF NOT EXISTS ncd_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES ncd_profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  systolic INT NOT NULL,
  diastolic INT NOT NULL,
  glucose_level INT NOT NULL,
  glucose_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. Create Foot Scans Table
CREATE TABLE IF NOT EXISTS ncd_foot_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES ncd_profiles(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  has_hotspots BOOLEAN NOT NULL,
  hotspots JSONB NOT NULL, -- Array of {x, y, severity, description}
  risk_score INT NOT NULL,
  recommendations TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 8. Create Refill Orders Table
CREATE TABLE IF NOT EXISTS ncd_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES ncd_profiles(id) ON DELETE CASCADE,
  order_number TEXT UNIQUE NOT NULL, -- e.g. NCD-1234
  date TEXT NOT NULL,
  items TEXT[] NOT NULL,
  total_naira INT NOT NULL,
  status TEXT NOT NULL,
  prescription_required BOOLEAN NOT NULL,
  prescription_uploaded BOOLEAN NOT NULL,
  pharmacy_id UUID REFERENCES ncd_pharmacies(id) ON DELETE SET NULL,
  prescription_details TEXT DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 9. Create System Alerts Table
CREATE TABLE IF NOT EXISTS ncd_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID REFERENCES ncd_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'info', 'warning', 'critical', 'success'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

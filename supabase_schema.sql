-- 1. Create Patient Profiles Table
CREATE TABLE IF NOT EXISTS ncd_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  age INT NOT NULL,
  weight DECIMAL NOT NULL,
  conditions TEXT[] NOT NULL,
  baseline_bp TEXT NOT NULL,
  target_glucose_range TEXT NOT NULL,
  streak_days INT DEFAULT 0,
  active_meds TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Create Vitals Logs Table (BP + Glucose)
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

-- 3. Create Foot Scans Table
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

-- 4. Create Refill Orders Table
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

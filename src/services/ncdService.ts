import { supabase, isSupabaseConfigured } from './supabase';
import { createClient } from '@supabase/supabase-js';

export interface BpReading {
  date: string;
  systolic: number;
  diastolic: number;
}

export interface GlucoseReading {
  date: string;
  level: number; // mg/dL
  type: 'Fasting' | 'Post-Meal';
}

export interface FootHotspot {
  x: number; // percent from left (0-100)
  y: number; // percent from top (0-100)
  severity: 'low' | 'medium' | 'high';
  description: string;
}

export interface FootScanRecord {
  date: string;
  hasHotspots: boolean;
  hotspots: FootHotspot[];
  riskScore: number; // 0-100
  recommendations: string[];
}

export interface PatientNcdProfile {
  id?: string; // Links to auth user uuid
  name: string;
  age: number;
  weight: number; // kg
  conditions: string[];
  baselineBp: string;
  targetGlucoseRange: string; // e.g. "70-130 mg/dL"
  bpHistory: BpReading[];
  glucoseHistory: GlucoseReading[];
  footScanHistory: FootScanRecord[];
  streakDays: number;
  activeMeds: string[];
  assignedClinicId: string | null;
  assignedPharmacyId: string | null;
  phone?: string;
  address?: string;
  isPremium?: boolean;
  premiumExpiry?: string;
}

export interface NcdRefillOrder {
  id: string;
  date: string;
  items: string[];
  totalNaira: number;
  status: 'Pending Verification' | 'Approved' | 'Out for Delivery' | 'Delivered';
  prescriptionRequired: boolean;
  prescriptionUploaded: boolean;
  pharmacyId: string | null;
  patientId?: string;
  patientName?: string;
  prescriptionDetails?: string;
}

export interface NcdClinic {
  id: string;
  name: string;
  address: string;
  city: string;
  contactPhone: string;
  isPremium?: boolean;
  premiumExpiry?: string;
  subaccountId?: string;
}

export interface NcdPharmacy {
  id: string;
  name: string;
  address: string;
  city: string;
  contactPhone: string;
  isVerified: boolean;
  prices?: { [medId: string]: number };
  isPremium?: boolean;
  premiumExpiry?: string;
  subaccountId?: string;
}

export interface NcdAlert {
  id: string;
  patientId: string;
  patientName?: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'critical' | 'success';
  createdAt: string;
}

export const INITIAL_NCD_ALERTS: NcdAlert[] = [
  {
    id: "alert-1",
    patientId: "4cf427cf-0ec4-4fde-a623-76b9f148e8d4",
    patientName: "Chief Chinedu Eze",
    title: "SMS Dose Reminder Sent",
    message: "Nudge dispatched: 'Dear Chief Eze, please log your blood pressure today to continue your 8-day streak.'",
    type: "info",
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString()
  },
  {
    id: "alert-2",
    patientId: "4cf427cf-0ec4-4fde-a623-76b9f148e8d4",
    patientName: "Chief Chinedu Eze",
    title: "System Refill Check",
    message: "Auto-audit: Patient has logged 8 stable days. Prescription Refill eligibility is active.",
    type: "success",
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
  }
];

// Initial fallback mock datasets representing Chief Chinedu Eze
export const INITIAL_NCD_PATIENT: PatientNcdProfile = {
  name: "Chief Chinedu Eze",
  age: 58,
  phone: "+234 803 456 7890",
  address: "12 Link Rd, Wuse II, Abuja",
  weight: 88, // kg
  conditions: ["Type 2 Diabetes Mellitus", "Essential Hypertension"],
  baselineBp: "145/90 mmHg",
  targetGlucoseRange: "70 - 130 mg/dL (Fasting)",
  streakDays: 8,
  isPremium: false,
  activeMeds: [
    "Metformin 1000mg Twice Daily",
    "Amlodipine 10mg Daily",
    "Lisinopril 20mg Daily"
  ],
  bpHistory: [
    { date: "June 16", systolic: 142, diastolic: 88 },
    { date: "June 17", systolic: 145, diastolic: 92 },
    { date: "June 18", systolic: 138, diastolic: 85 },
    { date: "June 19", systolic: 148, diastolic: 94 },
    { date: "June 20", systolic: 155, diastolic: 98 }
  ],
  glucoseHistory: [
    { date: "June 16", level: 125, type: "Fasting" },
    { date: "June 17", level: 138, type: "Fasting" },
    { date: "June 18", level: 118, type: "Fasting" },
    { date: "June 19", level: 145, type: "Fasting" },
    { date: "June 20", level: 168, type: "Fasting" }
  ],
  footScanHistory: [
    {
      date: "Jun 10, 2026",
      hasHotspots: true,
      hotspots: [
        { x: 35, y: 72, severity: "medium", description: "Early friction hotspot on the left metatarsal head. High pressure detected." },
        { x: 48, y: 25, severity: "low", description: "Slight dry skin fissure under the second toe." }
      ],
      riskScore: 42,
      recommendations: [
        "Wear wide-toe diabetic shoes; avoid walking barefoot inside the house.",
        "Moisturize dry areas daily, but avoid moisturizing between toes.",
        "Pharmacist check-in recommended to audit peripheral sensation (monofilament check)."
      ]
    }
  ],
  assignedClinicId: null,
  assignedPharmacyId: null
};

export const INITIAL_NCD_ORDERS: NcdRefillOrder[] = [
  {
    id: "NCD-6088",
    date: "Jun 20, 2026",
    items: ["NCD Monthly Chronic Care Bundle (Metformin 500mg + Amlodipine 10mg + Lisinopril 20mg)"],
    totalNaira: 30000,
    status: "Pending Verification",
    prescriptionRequired: true,
    prescriptionUploaded: true,
    pharmacyId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
  }
];

export const MOCK_CLINICS: NcdClinic[] = [
  { id: "11111111-1111-1111-1111-111111111111", name: "Abuja Heart & Vascular Clinic", address: "Plot 1042, Constitution Ave, Wuse II", city: "Abuja", contactPhone: "+234 803 111 2222" },
  { id: "22222222-2222-2222-2222-222222222222", name: "National Hospital NCD Center", address: "Central Business District", city: "Abuja", contactPhone: "+234 809 333 4444" },
  { id: "33333333-3333-3333-3333-333333333333", name: "Kaduna Specialist Hospital", address: "Waff Road", city: "Kaduna", contactPhone: "+234 812 555 6666" }
];

export const MOCK_PHARMACIES: NcdPharmacy[] = [
  { 
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", 
    name: "H-Medix Pharmacy Wuse II", 
    address: "Adetokunbo Ademola Crescent", 
    city: "Abuja", 
    contactPhone: "+234 805 777 8888", 
    isVerified: true,
    prices: { bundle: 32000, metformin: 6500, amlodipine: 5500, lisinopril: 7000, lantus: 19000 }
  },
  { 
    id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", 
    name: "Net Pharmacy Kaduna", 
    address: "Yakubu Gowon Way", 
    city: "Kaduna", 
    contactPhone: "+234 802 999 0000", 
    isVerified: true,
    prices: { bundle: 29000, metformin: 5800, amlodipine: 4800, lisinopril: 6200, lantus: 17500 }
  },
  { 
    id: "cccccccc-cccc-cccc-cccc-cccccccccccc", 
    name: "Garki Community Chemist", 
    address: "Garki Area 11", 
    city: "Abuja", 
    contactPhone: "+234 803 444 5555", 
    isVerified: false,
    prices: { bundle: 27500, metformin: 5500, amlodipine: 4500, lisinopril: 5800, lantus: 16500 }
  }
];

export const NCD_MEDICATIONS = [
  { id: "bundle", name: "NCD Monthly Chronic Care Bundle", description: "Metformin 500mg (60 tabs) + Amlodipine 10mg (30 tabs) + Lisinopril 20mg (30 tabs)", price: 30000, rxRequired: true },
  { id: "metformin", name: "Metformin 500mg Tablet", description: "First-line glucose-lowering therapy. 60 tablets.", price: 6000, rxRequired: true },
  { id: "amlodipine", name: "Amlodipine 10mg Tablet", description: "Calcium Channel Blocker for high blood pressure. 30 tablets.", price: 5000, rxRequired: true },
  { id: "lisinopril", name: "Lisinopril 20mg Tablet", description: "ACE inhibitor for blood pressure & kidney protection. 30 tablets.", price: 6500, rxRequired: true },
  { id: "lantus", name: "Lantus Insulin Glargine Pen", description: "24-hour long-acting basal insulin. 1 pre-filled pen.", price: 18000, rxRequired: true }
];

// ==========================================
// DUAL-MODE PERSISTENCE LAYER
// ==========================================

const PROFILE_KEY = "diabp_patient_profile";
const ORDERS_KEY = "diabp_refill_orders";
const ALERTS_KEY = "diabp_system_alerts";

function isValidUuid(id: any): boolean {
  if (typeof id !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

// LocalStorage fallback helpers
function saveLocal(key: string, data: any) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error("LocalStorage write error:", err);
  }
}

function loadLocal(key: string, fallback: any) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (err) {
    console.error("LocalStorage read error:", err);
    return fallback;
  }
}

/**
 * Loads patient profile from Supabase with LocalStorage fallback
 */
export async function getPatientProfile(userId?: string, displayNameFallback?: string): Promise<PatientNcdProfile> {
  if (isSupabaseConfigured) {
    try {
      let targetId = userId;
      if (!targetId) {
        const { data: { user } } = await supabase.auth.getUser();
        targetId = user?.id;
      }

      if (!targetId) {
        return loadLocal(PROFILE_KEY, INITIAL_NCD_PATIENT);
      }

      // 1. Fetch main profile
      const { data: profileData, error: profileErr } = await supabase
        .from('ncd_profiles')
        .select('*')
        .eq('id', targetId)
        .single();
        
      if (profileErr) {
        // Table exists but is completely empty (PGRST116: no rows returned)
        if (profileErr.code === 'PGRST116') {
          if (!userId) {
            console.info("No profile found in Supabase. Initializing default profile...");
            // Use per-user localStorage key to avoid pulling another user's profile
            const perUserLocal = loadLocal(`diabp_profile_${targetId}`, null);
            const localProfile = perUserLocal || INITIAL_NCD_PATIENT;
            await savePatientProfile(localProfile, targetId);
            return { id: targetId, ...localProfile };
          }
        }
        // Table may not exist yet, fallback to LocalStorage
        if (profileErr.code === '42P01') {
          console.warn("Supabase tables not configured. Falling back to LocalStorage.");
        } else {
          throw profileErr;
        }
      }

      if (profileData) {
        // 2. Fetch history logs associated with this profile
        const { data: vitalsData } = await supabase
          .from('ncd_vitals')
          .select('*')
          .eq('patient_id', targetId)
          .order('created_at', { ascending: true });

        const { data: scansData } = await supabase
          .from('ncd_foot_scans')
          .select('*')
          .eq('patient_id', targetId)
          .order('created_at', { ascending: true });

        // Convert database logs to history arrays
        const bpHistory: BpReading[] = (vitalsData || []).map(v => ({
          date: v.date,
          systolic: v.systolic,
          diastolic: v.diastolic
        }));

        const glucoseHistory: GlucoseReading[] = (vitalsData || []).map(v => ({
          date: v.date,
          level: v.glucose_level,
          type: v.glucose_type as any
        }));

        const footScanHistory: FootScanRecord[] = (scansData || []).map(s => ({
          date: s.date,
          hasHotspots: s.has_hotspots,
          hotspots: s.hotspots as any,
          riskScore: s.risk_score,
          recommendations: s.recommendations
        }));

        return {
          id: targetId,
          name: profileData.name,
          age: profileData.age,
          weight: profileData.weight,
          conditions: profileData.conditions,
          baselineBp: profileData.baseline_bp,
          targetGlucoseRange: profileData.target_glucose_range,
          streakDays: profileData.streak_days,
          activeMeds: profileData.active_meds,
          assignedClinicId: profileData.assigned_clinic_id,
          assignedPharmacyId: profileData.assigned_pharmacy_id,
          phone: profileData.phone || undefined,
          address: profileData.address || undefined,
          isPremium: profileData.is_premium || false,
          premiumExpiry: profileData.premium_expiry || undefined,
          bpHistory: bpHistory.length > 0 ? bpHistory : INITIAL_NCD_PATIENT.bpHistory,
          glucoseHistory: glucoseHistory.length > 0 ? glucoseHistory : INITIAL_NCD_PATIENT.glucoseHistory,
          footScanHistory: footScanHistory.length > 0 ? footScanHistory : INITIAL_NCD_PATIENT.footScanHistory
        };
      }
    } catch (err) {
      console.error("Supabase load error, falling back to LocalStorage:", err);
    }
  }

  // Fallback local storage dictionary lookup
  let targetId = userId;
  if (!targetId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      targetId = user?.id;
    } catch {}
  }
  if (!targetId) {
    return loadLocal(PROFILE_KEY, INITIAL_NCD_PATIENT);
  }

  const allProfiles = loadLocal('diabp_profiles', {});
  // Check per-user specific key first (new method), then legacy dict
  const perUserProfile = loadLocal(`diabp_profile_${targetId}`, null);
  if (perUserProfile) {
    return { id: targetId, ...perUserProfile };
  }
  if (allProfiles[targetId]) {
    return { id: targetId, ...allProfiles[targetId] };
  }
  // No stored profile at all — return a CLEAN default with caller-provided name
  // NEVER fall back to INITIAL_NCD_PATIENT (has hardcoded 'Chief Chinedu Eze' demo data)
  return {
    id: targetId,
    name: displayNameFallback || 'New Patient',
    age: 40,
    weight: 70,
    conditions: [],
    baselineBp: '',
    targetGlucoseRange: '70-130 mg/dL',
    bpHistory: [],
    glucoseHistory: [],
    footScanHistory: [],
    streakDays: 0,
    activeMeds: [],
    assignedClinicId: null,
    assignedPharmacyId: null
  };
}

/**
 * Saves patient profile to Supabase with LocalStorage fallback
 */
export async function savePatientProfile(profile: PatientNcdProfile, userId?: string): Promise<void> {
  // Get targeted userId to use user-specific storage (avoid cross-user bleed)
  let earlyId = userId;
  if (!earlyId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      earlyId = user?.id;
    } catch {}
  }
  // Save to user-specific localStorage key (e.g. diabp_profile_<userId>)
  if (earlyId) {
    saveLocal(`diabp_profile_${earlyId}`, profile);
  }
  // Also keep legacy shared key updated for compatibility (will be migrated away)
  saveLocal(PROFILE_KEY, profile);

  let targetId = userId;
  if (!targetId) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      targetId = user?.id;
    } catch {}
  }

  if (targetId) {
    const allProfiles = loadLocal('diabp_profiles', {});
    allProfiles[targetId] = { ...profile, id: targetId };
    saveLocal('diabp_profiles', allProfiles);
  }

  if (isSupabaseConfigured && targetId) {
    try {
      const payload = {
        id: targetId,
        name: profile.name,
        age: profile.age,
        weight: profile.weight,
        conditions: profile.conditions,
        baseline_bp: profile.baselineBp,
        target_glucose_range: profile.targetGlucoseRange,
        streak_days: profile.streakDays,
        active_meds: profile.activeMeds,
        assigned_clinic_id: isValidUuid(profile.assignedClinicId) ? profile.assignedClinicId : null,
        assigned_pharmacy_id: isValidUuid(profile.assignedPharmacyId) ? profile.assignedPharmacyId : null,
        phone: profile.phone || null,
        address: profile.address || null,
        is_premium: profile.isPremium || false,
        premium_expiry: profile.premiumExpiry || null
      };

      const { data: existing, error: selectErr } = await supabase.from('ncd_profiles').select('id').eq('id', targetId).limit(1);
      if (selectErr) throw selectErr;

      if (existing && existing.length > 0) {
        const { error: updateErr } = await supabase
          .from('ncd_profiles')
          .update(payload)
          .eq('id', targetId);
        if (updateErr) throw updateErr;
      } else {
        const { error: insertErr } = await supabase
          .from('ncd_profiles')
          .insert([payload]);
        if (insertErr) throw insertErr;
      }
    } catch (err: any) {
      console.error("Supabase write error, using LocalStorage backup:", err);
      alert("Supabase profile save failed: " + (err.message || JSON.stringify(err)));
    }
  }
}

/**
 * Appends a new vital log to database
 */
export async function logVitalsEntry(
  systolic: number,
  diastolic: number,
  glucose: number,
  glucoseType: 'Fasting' | 'Post-Meal'
): Promise<void> {
  const profile = await getPatientProfile();
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  
  profile.bpHistory.push({ date: dateStr, systolic, diastolic });
  profile.glucoseHistory.push({ date: dateStr, level: glucose, type: glucoseType });
  profile.streakDays += 1;
  
  await savePatientProfile(profile);

  // Trigger automated system alert notifications based on vital risk logs
  const { strokeRisk, diabeticRisk, bpWarning, glucoseWarning } = evaluateNcdRisk(systolic, diastolic, glucose, glucoseType);
  const patientId = profile.id || '4cf427cf-0ec4-4fde-a623-76b9f148e8d4';
  
  if (strokeRisk === 'Emergency' || strokeRisk === 'High' || diabeticRisk === 'Emergency' || diabeticRisk === 'High') {
    const riskType = (strokeRisk === 'Emergency' || strokeRisk === 'High') ? 'Blood Pressure' : 'Blood Sugar';
    const warningMsg = (strokeRisk === 'Emergency' || strokeRisk === 'High') ? bpWarning : glucoseWarning;
    
    await createSystemAlert(
      patientId,
      `Critical ${riskType} Logged`,
      `Vitals warning: ${systolic}/${diastolic} mmHg, Glucose ${glucose} mg/dL. SMS alert nudged to patient. Clinical team notified.`,
      'critical'
    );
  } else {
    await createSystemAlert(
      patientId,
      'Stable Vitals Logged',
      `Vitals logged within safe limits: ${systolic}/${diastolic} mmHg, Glucose ${glucose} mg/dL. Streak is now ${profile.streakDays} days!`,
      'success'
    );
  }

  if (isSupabaseConfigured) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('ncd_vitals').insert([{
          patient_id: user.id,
          date: dateStr,
          systolic,
          diastolic,
          glucose_level: glucose,
          glucose_type: glucoseType
        }]);
      }
    } catch (err) {
      console.error("Supabase vitals logging failed:", err);
    }
  }
}

/**
 * Appends a vital log for a specific patient (used by doctors/pharmacists during check-in)
 */
export async function logVitalsForPatient(
  patientId: string,
  systolic: number,
  diastolic: number,
  glucose: number,
  glucoseType: 'Fasting' | 'Post-Meal'
): Promise<void> {
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const profile = await getPatientProfile(patientId);
  
  profile.bpHistory.push({ date: dateStr, systolic, diastolic });
  profile.glucoseHistory.push({ date: dateStr, level: glucose, type: glucoseType });
  profile.streakDays += 1;
  
  await savePatientProfile(profile, patientId);

  // Update in the patients list inside localStorage if applicable
  const patientsLocal = loadLocal<PatientNcdProfile[]>('diabp_patients', []);
  const updatedPatients = patientsLocal.map(p => 
    p.id === patientId 
      ? { ...p, bpHistory: profile.bpHistory, glucoseHistory: profile.glucoseHistory, streakDays: profile.streakDays } 
      : p
  );
  saveLocal('diabp_patients', updatedPatients);

  // Trigger automated system alert notifications based on vital risk logs
  const { strokeRisk, diabeticRisk, bpWarning, glucoseWarning } = evaluateNcdRisk(systolic, diastolic, glucose, glucoseType);
  
  if (strokeRisk === 'Emergency' || strokeRisk === 'High' || diabeticRisk === 'Emergency' || diabeticRisk === 'High') {
    const riskType = (strokeRisk === 'Emergency' || strokeRisk === 'High') ? 'Blood Pressure' : 'Blood Sugar';
    
    await createSystemAlert(
      patientId,
      `Critical ${riskType} Logged`,
      `Vitals warning: ${systolic}/${diastolic} mmHg, Glucose ${glucose} mg/dL. SMS alert nudged to patient. Clinical team notified.`,
      'critical'
    );
  } else {
    await createSystemAlert(
      patientId,
      'Stable Vitals Logged',
      `Vitals logged within safe limits: ${systolic}/${diastolic} mmHg, Glucose ${glucose} mg/dL. Streak is now ${profile.streakDays} days!`,
      'success'
    );
  }

  if (isSupabaseConfigured) {
    try {
      await supabase.from('ncd_vitals').insert([{
        patient_id: patientId,
        date: dateStr,
        systolic,
        diastolic,
        glucose_level: glucose,
        glucose_type: glucoseType
      }]);
    } catch (err) {
      console.error("Supabase vitals logging failed for patient:", err);
    }
  }
}

/**
 * Appends a new foot scan record to database
 */
export async function logFootScanRecord(record: FootScanRecord): Promise<void> {
  const profile = await getPatientProfile();
  profile.footScanHistory.push(record);
  await savePatientProfile(profile);

  if (isSupabaseConfigured) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('ncd_foot_scans').insert([{
          patient_id: user.id,
          date: record.date,
          has_hotspots: record.hasHotspots,
          hotspots: record.hotspots,
          risk_score: record.riskScore,
          recommendations: record.recommendations
        }]);
      }
    } catch (err) {
      console.error("Supabase foot scan logging failed:", err);
    }
  }
}

export async function getRefillOrders(): Promise<NcdRefillOrder[]> {
  if (isSupabaseConfigured) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase.from('ncd_orders').select('*, ncd_profiles(name)');
      
      if (user) {
        const role = user.user_metadata?.role;
        if (role === 'patient') {
          query = query.eq('patient_id', user.id);
        }
      }
      
      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return loadLocal(ORDERS_KEY, INITIAL_NCD_ORDERS);
        throw error;
      }

      if (data) {
        return data.map(o => ({
          id: o.order_number,
          date: o.date,
          items: o.items,
          totalNaira: o.total_naira,
          status: o.status as any,
          prescriptionRequired: o.prescription_required,
          prescriptionUploaded: o.prescription_uploaded,
          pharmacyId: o.pharmacy_id,
          patientId: o.patient_id,
          patientName: (o.ncd_profiles as any)?.name || "Unknown Patient",
          prescriptionDetails: o.prescription_details
        }));
      }
    } catch (err) {
      console.error("Supabase orders load failed, using local storage:", err);
    }
  }
  return loadLocal(ORDERS_KEY, INITIAL_NCD_ORDERS);
}

/**
 * Places a new Refill Order
 */
export async function placeRefillOrder(order: NcdRefillOrder): Promise<void> {
  // 1. Run Auto-Approval Rule Engine
  const patientId = order.patientId || '4cf427cf-0ec4-4fde-a623-76b9f148e8d4';
  const profile = await getPatientProfile(patientId);
  const bpHistory = profile.bpHistory || [];
  const glucoseHistory = profile.glucoseHistory || [];
  
  const latestBp = bpHistory[bpHistory.length - 1] || { systolic: 120, diastolic: 80 };
  const latestGlucose = glucoseHistory[glucoseHistory.length - 1] || { level: 100, type: 'Fasting' };
  
  const { strokeRisk, diabeticRisk } = evaluateNcdRisk(
    latestBp.systolic,
    latestBp.diastolic,
    latestGlucose.level,
    latestGlucose.type as any
  );
  
  const isStable = (strokeRisk !== 'High' && strokeRisk !== 'Emergency' && diabeticRisk !== 'High' && diabeticRisk !== 'Emergency');
  const hasPrescription = order.prescriptionUploaded;
  
  let finalStatus: NcdRefillOrder['status'] = 'Pending Verification';
  let logTitle = "Refill Held for Review";
  let logMsg = `Refill ${order.id} placed. Held for clinician audit: latest vitals (${latestBp.systolic}/${latestBp.diastolic} mmHg) are outside safe target bounds.`;
  let logType: NcdAlert['type'] = 'warning';
  
  const isAutoRefillEnabled = localStorage.getItem('diabp_auto_refill_automation') !== 'false';

  if (isAutoRefillEnabled && isStable && hasPrescription) {
    finalStatus = 'Approved';
    logTitle = "Refill Auto-Approved";
    logMsg = `Refill ${order.id} auto-approved. Vitals stable (${latestBp.systolic}/${latestBp.diastolic} mmHg). Dispatching SMS notification.`;
    logType = 'success';
  } else if (!hasPrescription) {
    logMsg = `Refill ${order.id} held. Missing verified prescription documents or details.`;
  }
  
  order.status = finalStatus;

  // 2. Save locally and log alert
  const currentOrders = await getRefillOrders();
  const updatedOrders = [order, ...currentOrders];
  saveLocal(ORDERS_KEY, updatedOrders);

  await createSystemAlert(patientId, logTitle, logMsg, logType);

  if (isSupabaseConfigured) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error } = await supabase.from('ncd_orders').insert([{
          patient_id: user.id,
          order_number: order.id,
          date: order.date,
          items: order.items,
          total_naira: order.totalNaira,
          status: order.status,
          prescription_required: order.prescriptionRequired,
          prescription_uploaded: order.prescriptionUploaded,
          pharmacy_id: isValidUuid(order.pharmacyId) ? order.pharmacyId : null,
          prescription_details: order.prescriptionDetails || null
        }]);
        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Supabase place order failed:", err);
      alert("Supabase place order failed: " + (err.message || JSON.stringify(err)));
    }
  }
}

/**
 * Updates status of an existing order
 */
export async function updateOrderStatus(orderId: string, status: NcdRefillOrder['status'], finalPrice?: number): Promise<void> {
  const currentOrders = await getRefillOrders();
  const updatedOrders = currentOrders.map(o => o.id === orderId ? { ...o, status, totalNaira: finalPrice !== undefined ? finalPrice : o.totalNaira } : o);
  saveLocal(ORDERS_KEY, updatedOrders);

  if (isSupabaseConfigured) {
    try {
      const payload: any = { status };
      if (finalPrice !== undefined) {
        payload.total_naira = finalPrice;
      }
      const { error } = await supabase
        .from('ncd_orders')
        .update(payload)
        .eq('order_number', orderId);
      if (error) throw error;
    } catch (err: any) {
      console.error("Supabase order status update failed:", err);
      alert("Supabase status update failed: " + (err.message || JSON.stringify(err)));
    }
  }
}

export async function getSystemAlerts(facilityId?: string | null, facilityType?: 'clinic' | 'pharmacy' | null): Promise<NcdAlert[]> {
  // Trigger background check for low refill supplies in a non-blocking way
  setTimeout(() => {
    runRefillTrackerAutomation().catch(err => console.error("Refill automation failed:", err));
  }, 100);

  if (isSupabaseConfigured) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let query = supabase.from('ncd_alerts').select('*, ncd_profiles!inner(name, assigned_clinic_id, assigned_pharmacy_id)');
      if (user) {
        const role = user.user_metadata?.role;
        if (role === 'patient') {
          query = query.eq('patient_id', user.id);
        } else if (facilityId && facilityType) {
          if (facilityType === 'clinic') {
            query = query.eq('ncd_profiles.assigned_clinic_id', facilityId);
          } else {
            query = query.eq('ncd_profiles.assigned_pharmacy_id', facilityId);
          }
        }
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P01') return loadLocal(ALERTS_KEY, INITIAL_NCD_ALERTS);
        throw error;
      }
      if (data) {
        return data.map(a => ({
          id: a.id,
          patientId: a.patient_id,
          patientName: (a.ncd_profiles as any)?.name || "Unknown Patient",
          title: a.title,
          message: a.message,
          type: a.type as any,
          createdAt: a.created_at
        }));
      }
    } catch (err) {
      console.error("Supabase alerts load failed, using local storage:", err);
    }
  }
  
  const currentAlerts = loadLocal(ALERTS_KEY, INITIAL_NCD_ALERTS);
  if (facilityId && facilityType) {
    const allProfiles = loadLocal('diabp_profiles', {});
    return currentAlerts.filter((alert: NcdAlert) => {
      const profile = allProfiles[alert.patientId] || (alert.patientId === '4cf427cf-0ec4-4fde-a623-76b9f148e8d4' ? INITIAL_NCD_PATIENT : null);
      if (!profile) return false;
      if (facilityType === 'clinic') {
        return profile.assignedClinicId === facilityId;
      } else {
        return profile.assignedPharmacyId === facilityId;
      }
    });
  }
  return currentAlerts;
}

export async function createSystemAlert(
  patientId: string,
  title: string,
  message: string,
  type: NcdAlert['type']
): Promise<void> {
  const currentAlerts = await getSystemAlerts();
  
  let patientName = "Chief Chinedu Eze";
  try {
    const profile = await getPatientProfile(patientId);
    if (profile?.name) patientName = profile.name;
  } catch {}

  const newAlert: NcdAlert = {
    id: `alert-${Math.random().toString(36).substr(2, 9)}`,
    patientId,
    patientName,
    title,
    message,
    type,
    createdAt: new Date().toISOString()
  };

  const updatedAlerts = [newAlert, ...currentAlerts];
  saveLocal(ALERTS_KEY, updatedAlerts);

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('ncd_alerts').insert([{
        patient_id: patientId,
        title,
        message,
        type
      }]);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase alert insertion failed:", err);
    }
  }
}

export async function dismissSystemAlert(alertId: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('ncd_alerts')
        .delete()
        .eq('id', alertId);
      if (error) throw error;
    } catch (err) {
      console.error("Failed to delete alert in Supabase:", err);
    }
  }
  // Local storage fallback
  const currentAlerts = loadLocal(ALERTS_KEY, INITIAL_NCD_ALERTS);
  const updated = currentAlerts.filter((a: NcdAlert) => a.id !== alertId);
  saveLocal(ALERTS_KEY, updated);
}

export async function dismissAlertsForPatient(patientId: string, type: NcdAlert['type']): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('ncd_alerts')
        .delete()
        .eq('patient_id', patientId)
        .eq('type', type);
      if (error) throw error;
    } catch (err) {
      console.error("Failed to delete alerts in Supabase:", err);
    }
  }
  // Local storage fallback
  const currentAlerts = loadLocal(ALERTS_KEY, INITIAL_NCD_ALERTS);
  const updated = currentAlerts.filter((a: NcdAlert) => !(a.patientId === patientId && a.type === type));
  saveLocal(ALERTS_KEY, updated);
}


// ==========================================
// CLINICAL ANALYTIC METRICS
// ==========================================

export function evaluateNcdRisk(
  systolic: number,
  diastolic: number,
  glucoseLevel: number,
  glucoseType: 'Fasting' | 'Post-Meal'
): {
  strokeRisk: 'Low' | 'Medium' | 'High' | 'Emergency';
  diabeticRisk: 'Low' | 'Medium' | 'High' | 'Emergency';
  bpWarning: string;
  glucoseWarning: string;
} {
  let strokeRisk: 'Low' | 'Medium' | 'High' | 'Emergency' = 'Low';
  let diabeticRisk: 'Low' | 'Medium' | 'High' | 'Emergency' = 'Low';
  let bpWarning = "Blood pressure is controlled.";
  let glucoseWarning = "Blood sugar is within target range.";

  if (systolic >= 180 || diastolic >= 120) {
    strokeRisk = 'Emergency';
    bpWarning = "HYPERTENSIVE CRISIS! Risk of stroke or organ damage is extremely high. Seek emergency medical attention immediately.";
  } else if (systolic >= 160 || diastolic >= 100) {
    strokeRisk = 'High';
    bpWarning = "Stage 2 Hypertension. Blood pressure is significantly elevated. Notify your clinic, wear loose clothing, and rest.";
  } else if (systolic >= 140 || diastolic >= 90) {
    strokeRisk = 'Medium';
    bpWarning = "Stage 1 Hypertension. Mild elevation. Limit salt intake and log readings twice daily.";
  }

  const isFasting = glucoseType === 'Fasting';
  if (glucoseLevel >= 300) {
    diabeticRisk = 'Emergency';
    glucoseWarning = "CRITICAL HYPERGLYCEMIA! Risk of Diabetic Ketoacidosis (DKA) or Hyperosmolar State. Go to the emergency room immediately.";
  } else if ((isFasting && glucoseLevel >= 180) || (!isFasting && glucoseLevel >= 250)) {
    diabeticRisk = 'High';
    glucoseWarning = "High Blood Sugar. Check your medication compliance, drink plenty of water, and avoid carbohydrates.";
  } else if ((isFasting && glucoseLevel >= 130) || (!isFasting && glucoseLevel >= 180)) {
    diabeticRisk = 'Medium';
    glucoseWarning = "Mild Hyperglycemia. Blood sugar is slightly above target. Log your next meal.";
  } else if (glucoseLevel < 70) {
    diabeticRisk = 'Emergency';
    glucoseWarning = "🚨 HYPOGLYCEMIA ALERT! Sugar is dangerously low (<70 mg/dL). Drink juice or eat 3 spoons of sugar immediately. Recheck in 15 minutes.";
  }

  return { strokeRisk, diabeticRisk, bpWarning, glucoseWarning };
}

export function auditNcdRegimen(
  age: number,
  weight: number,
  systolic: number,
  diastolic: number,
  glucoseLevel: number,
  glucoseType: 'Fasting' | 'Post-Meal',
  activeMeds: string[]
): {
  appropriate: boolean;
  notes: string[];
  recommendations: string[];
  warning: string | null;
} {
  const notes: string[] = [];
  const recommendations: string[] = [];
  let warning: string | null = null;
  let appropriate = true;

  notes.push(`Auditing regimen for ${age}yo patient, weight: ${weight}kg.`);
  
  const hasCCB = activeMeds.some(m => m.toLowerCase().includes("amlodipine") || m.toLowerCase().includes("nifedipine"));
  const hasACE = activeMeds.some(m => m.toLowerCase().includes("lisinopril") || m.toLowerCase().includes("captopril") || m.toLowerCase().includes("enalapril"));
  
  if (hasACE && !hasCCB) {
    notes.push("Clinical Insight: Patient is on an ACE-inhibitor without a Calcium Channel Blocker (CCB). For African descent populations, CCBs (Amlodipine) or Thiazide diuretics demonstrate superior efficacy as first-line agents.");
    recommendations.push("Consider shifting to or adding Amlodipine 5mg-10mg daily to optimize blood pressure control.");
  }

  if (systolic >= 160 || diastolic >= 100) {
    appropriate = false;
    warning = "Blood Pressure is uncontrolled (Stage 2 Hypertension) despite current regimen.";
    recommendations.push("Increase Amlodipine dose to 10mg daily (if currently at 5mg) or consider adding a low-dose Thiazide diuretic (Hydrochlorothiazide 12.5mg daily).");
    recommendations.push("Verify patient compliance and audit salt intake (common factor in Nigeria).");
  }

  const isFasting = glucoseType === 'Fasting';
  if (glucoseLevel >= 180 && isFasting) {
    appropriate = false;
    if (!warning) warning = "Blood glucose is poorly controlled.";
    
    const hasMetformin = activeMeds.some(m => m.toLowerCase().includes("metformin"));
    if (hasMetformin) {
      recommendations.push("Optimize Metformin to maximum tolerated dose (2000mg daily in divided doses).");
      recommendations.push("If Metformin is already optimized, consider adding an SGLT2 inhibitor (Empagliflozin 10mg) or a DPP-4 inhibitor, which also protect kidney function in hypertensive patients.");
    } else {
      recommendations.push("Initiate Metformin 500mg daily, titrating weekly by 500mg up to 2000mg daily as tolerated.");
    }
  }

  if (hasACE) {
    notes.push("Audit: Check serum creatinine and potassium levels within 1-2 weeks of initiating or adjusting Lisinopril to monitor renal clearance.");
    notes.push("Audit: Watch for dry cough (common Lisinopril side effect in Black patients due to bradykinin accumulation).");
  }
  
  const hasMetformin = activeMeds.some(m => m.toLowerCase().includes("metformin"));
  if (hasMetformin) {
    notes.push("Audit: Verify Estimated Glomerular Filtration Rate (eGFR). Metformin is contraindicated if eGFR < 30 mL/min/1.73m².");
  }

  return { appropriate, notes, recommendations, warning };
}

// ==========================================
// BROWSER-NATIVE COMPUTER VISION IMAGE PROCESSOR
// ==========================================

/**
 * Analyzes foot sole photo pixel-by-pixel for erythematous (redness) inflammation clusters.
 * This runs native image array processing on the client browser.
 */
export function analyzeFootImage(file: File): Promise<FootScanRecord> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Create an offscreen canvas to scale and inspect pixel channels
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Target scanning bounds (standardized size for pixel parsing)
        const width = 300;
        const height = 400;
        canvas.width = width;
        canvas.height = height;
        
        if (!ctx) {
          // Fallback if canvas context creation fails
          resolve(getHealthyFootRecord());
          return;
        }

        // Draw image onto analysis canvas
        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const pixels = imgData.data;

        // First pass: Calculate average color channels for skin pixels to calibrate against lighting/skin-tone
        let skinPixelCount = 0;
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let sumRgRatio = 0;
        let sumRbRatio = 0;

        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];

          // Filter out background: exclude too dark/too bright and ensure typical skin signature (R > G)
          if (r > 35 && g > 25 && b > 20 && r < 245 && g < 245 && b < 245 && r > g) {
            skinPixelCount++;
            sumR += r;
            sumG += g;
            sumB += b;
            sumRgRatio += r / (g + 1);
            sumRbRatio += r / (b + 1);
          }
        }

        // Validate image contains enough skin pixels (at least 10% of image size: 300 * 400 * 0.10 = 12000)
        // If not, they likely uploaded a non-skin / non-sole photo or a completely dark/blurry picture.
        if (skinPixelCount < 12000) {
          resolve({
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            hasHotspots: false,
            hotspots: [],
            riskScore: 0,
            recommendations: [
              "⚠️ Could not verify clear foot sole profile. Please ensure:",
              "1. You are photographing the bottom of a bare foot sole.",
              "2. The photo is taken under clear lighting without heavy shadows.",
              "3. Your foot sole fills most of the camera frame."
            ]
          });
          return;
        }

        // Calibrate baseline ratios for patient's skin-tone and ambient camera lighting
        const avgRg = sumRgRatio / skinPixelCount;
        const avgRb = sumRbRatio / skinPixelCount;
        
        // Outlier thresholds: pixels must be significantly redder (e.g. 26% higher R/G and R/B ratios) than their skin baseline
        const rgThreshold = Math.max(1.22, avgRg * 1.26);
        const rbThreshold = Math.max(1.25, avgRb * 1.26);

        // Grid-based clustering bounds (10x10 grid)
        const gridCols = 10;
        const gridRows = 10;
        const cellW = width / gridCols;
        const cellH = height / gridRows;
        
        // Matrix to track count of high-redness outlier pixels in each grid block
        const redCounts = Array(gridRows).fill(0).map(() => Array(gridCols).fill(0));
        const sumX = Array(gridRows).fill(0).map(() => Array(gridCols).fill(0));
        const sumY = Array(gridRows).fill(0).map(() => Array(gridCols).fill(0));

        // Second pass: Identify erythematous outlier pixels
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const r = pixels[index];
            const g = pixels[index + 1];
            const b = pixels[index + 2];

            const rgRatio = r / (g + 1);
            const rbRatio = r / (b + 1);

            // Outlier check: pixel is significantly redder than the foot's average skin baseline,
            // has typical skin signature, and is not extremely dark.
            if (r > 65 && r > g && r > b && rgRatio > rgThreshold && rbRatio > rbThreshold) {
              const col = Math.floor(x / cellW);
              const row = Math.floor(y / cellH);
              if (col >= 0 && col < gridCols && row >= 0 && row < gridRows) {
                redCounts[row][col]++;
                sumX[row][col] += x;
                sumY[row][col] += y;
              }
            }
          }
        }

        // Find clusters with high density of red outlier pixels (hotspots)
        const hotspots: FootHotspot[] = [];
        const threshold = (cellW * cellH) * 0.035; // at least 3.5% of cell pixels must be outlier red

        for (let r = 0; r < gridRows; r++) {
          for (let c = 0; c < gridCols; c++) {
            const count = redCounts[r][c];
            if (count > threshold) {
              const avgX = sumX[r][c] / count;
              const avgY = sumY[r][c] / count;
              
              // Map coordinates to percentage ranges (matching CSS sole layout positioning)
              const pctX = Math.round((avgX / width) * 100);
              const pctY = Math.round((avgY / height) * 100);

              const severity = count > threshold * 2.5 ? "high" : "medium";
              
              hotspots.push({
                x: pctX,
                y: pctY,
                severity: severity as any,
                description: `AI detected a high-density ${severity === 'high' ? 'erythematous' : 'inflammatory'} redness cluster (${count} pixels) near the sole coordinate. High risk of sensory ulceration.`
              });
            }
          }
        }

        // Generate clinical scan report
        if (hotspots.length > 0) {
          const riskScore = Math.min(100, Math.max(15, 30 + hotspots.length * 15));
          
          resolve({
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            hasHotspots: true,
            hotspots,
            riskScore,
            recommendations: [
              "⚠️ URGENT: Sensory inflammation hotspots detected. Inspect footwear immediately.",
              "Do not walk barefoot. Wear cushioned orthotic insoles.",
              "Check your daily glucose logs; hyperglycemia halts tissue/vascular healing.",
              "Consult your clinical nurse/pharmacist for a monofilament sensory audit."
            ]
          });
        } else {
          resolve(getHealthyFootRecord());
        }
      };
      
      img.src = event.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

function getHealthyFootRecord(): FootScanRecord {
  return {
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    hasHotspots: false,
    hotspots: [],
    riskScore: 8,
    recommendations: [
      "✓ Circulatory and tissue structure appears normal.",
      "Check soles daily for any cuts, punctures, or color changes.",
      "Apply moisturizing lotion to the dry areas, avoiding the spaces between toes."
    ]
  };
}

async function seedClinics() {
  try {
    await supabase.from('ncd_clinics').insert(MOCK_CLINICS.map(c => ({
      id: c.id,
      name: c.name,
      address: c.address,
      city: c.city,
      contact_phone: c.contactPhone
    })));
  } catch (err) {
    console.error("Failed to seed clinics:", err);
  }
}

async function seedPharmacies() {
  try {
    await supabase.from('ncd_pharmacies').insert(MOCK_PHARMACIES.map(p => ({
      id: p.id,
      name: p.name,
      address: p.address,
      city: p.city,
      contact_phone: p.contactPhone,
      is_verified: p.isVerified,
      prices: p.prices
    })));
  } catch (err) {
    console.error("Failed to seed pharmacies:", err);
  }
}

export async function getClinics(): Promise<NcdClinic[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('ncd_clinics').select('*');
      if (error) {
        if (error.code === '42P01') return loadLocal("diabp_clinics", MOCK_CLINICS);
        throw error;
      }
      if (data && data.length > 0) {
        return data.map(c => ({
          id: c.id,
          name: c.name,
          address: c.address,
          city: c.city,
          contactPhone: c.contact_phone,
          isPremium: c.is_premium || false,
          premiumExpiry: c.premium_expiry || undefined,
          subaccountId: c.subaccount_id || undefined
        }));
      } else {
        await seedClinics();
        return MOCK_CLINICS;
      }
    } catch (err) {
      console.error("Supabase clinics load failed, using mock data:", err);
    }
  }
  return loadLocal("diabp_clinics", MOCK_CLINICS);
}

export async function saveClinic(clinic: NcdClinic): Promise<void> {
  const current = await getClinics();
  const updated = current.map(c => c.id === clinic.id ? clinic : c);
  saveLocal("diabp_clinics", updated);

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('ncd_clinics')
        .update({
          name: clinic.name,
          address: clinic.address,
          city: clinic.city,
          contact_phone: clinic.contactPhone,
          is_premium: clinic.isPremium || false,
          premium_expiry: clinic.premiumExpiry || null,
          subaccount_id: clinic.subaccountId || null
        })
        .eq('id', clinic.id);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase clinic save failed:", err);
    }
  }
}

export async function getPharmacies(): Promise<NcdPharmacy[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('ncd_pharmacies').select('*');
      if (error) {
        if (error.code === '42P01') return loadLocal("diabp_pharmacies", MOCK_PHARMACIES);
        throw error;
      }
      if (data && data.length > 0) {
        return data.map(p => ({
          id: p.id,
          name: p.name,
          address: p.address,
          city: p.city,
          contactPhone: p.contact_phone,
          isVerified: p.is_verified,
          prices: p.prices,
          isPremium: p.is_premium || false,
          premiumExpiry: p.premium_expiry || undefined,
          subaccountId: p.subaccount_id || undefined
        }));
      } else {
        await seedPharmacies();
        return MOCK_PHARMACIES;
      }
    } catch (err) {
      console.error("Supabase pharmacies load failed, using mock data:", err);
    }
  }
  return loadLocal("diabp_pharmacies", MOCK_PHARMACIES);
}

export async function savePharmacy(pharmacy: NcdPharmacy): Promise<void> {
  const current = await getPharmacies();
  const updated = current.map(p => p.id === pharmacy.id ? pharmacy : p);
  saveLocal("diabp_pharmacies", updated);

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('ncd_pharmacies')
        .update({
          name: pharmacy.name,
          address: pharmacy.address,
          city: pharmacy.city,
          contact_phone: pharmacy.contactPhone,
          is_verified: pharmacy.isVerified,
          prices: pharmacy.prices,
          is_premium: pharmacy.isPremium || false,
          premium_expiry: pharmacy.premiumExpiry || null,
          subaccount_id: pharmacy.subaccountId || null
        })
        .eq('id', pharmacy.id);
      if (error) throw error;
    } catch (err) {
      console.error("Supabase pharmacy save failed:", err);
    }
  }
}

async function getBpHistoryForPatient(patientId: string): Promise<BpReading[]> {
  try {
    const { data } = await supabase
      .from('ncd_vitals')
      .select('date, systolic, diastolic')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });
    return (data || []).map(v => ({ date: v.date, systolic: v.systolic, diastolic: v.diastolic }));
  } catch {
    return [];
  }
}

async function getGlucoseHistoryForPatient(patientId: string): Promise<GlucoseReading[]> {
  try {
    const { data } = await supabase
      .from('ncd_vitals')
      .select('date, glucose_level, glucose_type')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });
    return (data || []).map(v => ({ date: v.date, level: v.glucose_level, type: v.glucose_type as any }));
  } catch {
    return [];
  }
}

async function getFootScanHistoryForPatient(patientId: string): Promise<FootScanRecord[]> {
  try {
    const { data } = await supabase
      .from('ncd_foot_scans')
      .select('date, has_hotspots, hotspots, risk_score, recommendations')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: true });
    return (data || []).map(s => ({
      date: s.date,
      hasHotspots: s.has_hotspots,
      hotspots: s.hotspots as any,
      riskScore: s.risk_score,
      recommendations: s.recommendations
    }));
  } catch {
    return [];
  }
}

export async function getPatientsForClinic(clinicId: string): Promise<PatientNcdProfile[]> {
  if (isSupabaseConfigured) {
    try {
      if (!isValidUuid(clinicId)) return [];
      const { data: profiles, error } = await supabase
        .from('ncd_profiles')
        .select('*')
        .eq('assigned_clinic_id', clinicId);
        
      if (error) {
        if (error.code === '42P01') {
          // Fallback to local storage
        } else {
          throw error;
        }
      }
      
      if (profiles && profiles.length > 0) {
        const patients: PatientNcdProfile[] = [];
        for (const p of profiles) {
          const bpHistory = await getBpHistoryForPatient(p.id);
          const glucoseHistory = await getGlucoseHistoryForPatient(p.id);
          const footScanHistory = await getFootScanHistoryForPatient(p.id);
          patients.push({
            id: p.id,
            name: p.name,
            age: p.age,
            weight: p.weight,
            conditions: p.conditions,
            baselineBp: p.baseline_bp,
            targetGlucoseRange: p.target_glucose_range,
            streakDays: p.streak_days,
            activeMeds: p.active_meds,
            assignedClinicId: p.assigned_clinic_id,
            assignedPharmacyId: p.assigned_pharmacy_id,
            phone: p.phone || undefined,
            address: p.address || undefined,
            bpHistory: bpHistory.length > 0 ? bpHistory : INITIAL_NCD_PATIENT.bpHistory,
            glucoseHistory: glucoseHistory.length > 0 ? glucoseHistory : INITIAL_NCD_PATIENT.glucoseHistory,
            footScanHistory: footScanHistory.length > 0 ? footScanHistory : INITIAL_NCD_PATIENT.footScanHistory
          });
        }
        return patients;
      }
    } catch (err) {
      console.error("Failed to fetch clinic patients from Supabase:", err);
    }
  }

  // Local storage fallback filter
  const allProfiles = loadLocal('diabp_profiles', {});
  const clinicPatients = Object.values(allProfiles).filter((p: any) => p.assignedClinicId === clinicId) as PatientNcdProfile[];
  return clinicPatients.length > 0 ? clinicPatients : [{ ...INITIAL_NCD_PATIENT, id: 'mock-patient-default' }];
}

export async function getPatientsForPharmacy(pharmacyId: string): Promise<PatientNcdProfile[]> {
  if (isSupabaseConfigured) {
    try {
      if (!isValidUuid(pharmacyId)) return [];
      const { data: profiles, error } = await supabase
        .from('ncd_profiles')
        .select('*')
        .eq('assigned_pharmacy_id', pharmacyId);
        
      if (error) {
        if (error.code === '42P01') {
          // Fallback to local storage
        } else {
          throw error;
        }
      }
      
      if (profiles && profiles.length > 0) {
        const patients: PatientNcdProfile[] = [];
        for (const p of profiles) {
          const bpHistory = await getBpHistoryForPatient(p.id);
          const glucoseHistory = await getGlucoseHistoryForPatient(p.id);
          const footScanHistory = await getFootScanHistoryForPatient(p.id);
          patients.push({
            id: p.id,
            name: p.name,
            age: p.age,
            weight: p.weight,
            conditions: p.conditions,
            baselineBp: p.baseline_bp,
            targetGlucoseRange: p.target_glucose_range,
            streakDays: p.streak_days,
            activeMeds: p.active_meds,
            assignedClinicId: p.assigned_clinic_id,
            assignedPharmacyId: p.assigned_pharmacy_id,
            phone: p.phone || undefined,
            address: p.address || undefined,
            bpHistory: bpHistory.length > 0 ? bpHistory : INITIAL_NCD_PATIENT.bpHistory,
            glucoseHistory: glucoseHistory.length > 0 ? glucoseHistory : INITIAL_NCD_PATIENT.glucoseHistory,
            footScanHistory: footScanHistory.length > 0 ? footScanHistory : INITIAL_NCD_PATIENT.footScanHistory
          });
        }
        return patients;
      }
    } catch (err) {
      console.error("Failed to fetch pharmacy patients from Supabase:", err);
    }
  }

  // Local storage fallback filter
  const allProfiles = loadLocal('diabp_profiles', {});
  const pharmacyPatients = Object.values(allProfiles).filter((p: any) => p.assignedPharmacyId === pharmacyId) as PatientNcdProfile[];
  return pharmacyPatients.length > 0 ? pharmacyPatients : [{ ...INITIAL_NCD_PATIENT, id: 'mock-patient-default' }];
}

export async function getAllPatients(): Promise<PatientNcdProfile[]> {
  if (isSupabaseConfigured) {
    try {
      const { data: profiles, error } = await supabase
        .from('ncd_profiles')
        .select('*');
        
      if (error) {
        if (error.code !== '42P01') throw error;
      }
      
      if (profiles && profiles.length > 0) {
        const patients: PatientNcdProfile[] = [];
        for (const p of profiles) {
          const bpHistory = await getBpHistoryForPatient(p.id);
          const glucoseHistory = await getGlucoseHistoryForPatient(p.id);
          const footScanHistory = await getFootScanHistoryForPatient(p.id);
          patients.push({
            id: p.id,
            name: p.name,
            age: p.age,
            weight: p.weight,
            conditions: p.conditions,
            baselineBp: p.baseline_bp,
            targetGlucoseRange: p.target_glucose_range,
            streakDays: p.streak_days,
            activeMeds: p.active_meds,
            assignedClinicId: p.assigned_clinic_id,
            assignedPharmacyId: p.assigned_pharmacy_id,
            phone: p.phone || undefined,
            address: p.address || undefined,
            isPremium: p.is_premium,
            premiumExpiry: p.premium_expiry,
            bpHistory: bpHistory.length > 0 ? bpHistory : INITIAL_NCD_PATIENT.bpHistory,
            glucoseHistory: glucoseHistory.length > 0 ? glucoseHistory : INITIAL_NCD_PATIENT.glucoseHistory,
            footScanHistory: footScanHistory.length > 0 ? footScanHistory : INITIAL_NCD_PATIENT.footScanHistory
          });
        }
        return patients;
      }
    } catch (err) {
      console.error("Failed to fetch all patients from Supabase:", err);
    }
  }

  // Local storage fallback
  const allProfiles = loadLocal('diabp_profiles', {});
  const patientsList = Object.values(allProfiles) as PatientNcdProfile[];
  return patientsList.length > 0 ? patientsList : [{ ...INITIAL_NCD_PATIENT, id: 'mock-patient-default' }];
}

export async function registerClinic(name: string, address: string, city: string, phone: string): Promise<NcdClinic> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('ncd_clinics')
        .insert([{ name, address, city, contact_phone: phone }])
        .select()
        .single();
      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        address: data.address,
        city: data.city,
        contactPhone: data.contact_phone
      };
    } catch (err) {
      console.error("Clinic registration failed:", err);
      throw err;
    }
  }
  const newClinic: NcdClinic = { id: `clinic-${Math.random().toString(36).substr(2, 9)}`, name, address, city, contactPhone: phone };
  const clinics = loadLocal("diabp_clinics", MOCK_CLINICS);
  const updatedClinics = [...clinics, newClinic];
  saveLocal("diabp_clinics", updatedClinics);
  return newClinic;
}

export async function registerPharmacy(name: string, address: string, city: string, phone: string): Promise<NcdPharmacy> {
  const defaultPrices = { bundle: 30000, metformin: 6000, amlodipine: 5000, lisinopril: 6500, lantus: 18000 };
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('ncd_pharmacies')
        .insert([{ name, address, city, contact_phone: phone, is_verified: true, prices: defaultPrices }])
        .select()
        .single();
      if (error) throw error;
      return {
        id: data.id,
        name: data.name,
        address: data.address,
        city: data.city,
        contactPhone: data.contact_phone,
        isVerified: data.is_verified,
        prices: data.prices || defaultPrices
      };
    } catch (err) {
      console.error("Pharmacy registration failed:", err);
      throw err;
    }
  }
  const newPharmacy: NcdPharmacy = { 
    id: `pharmacy-${Math.random().toString(36).substr(2, 9)}`, 
    name, 
    address, 
    city, 
    contactPhone: phone, 
    isVerified: true,
    prices: defaultPrices
  };
  const pharmacies = loadLocal("diabp_pharmacies", MOCK_PHARMACIES);
  const updatedPharmacies = [...pharmacies, newPharmacy];
  saveLocal("diabp_pharmacies", updatedPharmacies);
  return newPharmacy;
}

export async function updatePharmacyPrices(pharmacyId: string, prices: { [medId: string]: number }): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('ncd_pharmacies')
        .update({ prices })
        .eq('id', pharmacyId);
      if (error) throw error;
      return;
    } catch (err) {
      console.error("Failed to update pharmacy prices in Supabase:", err);
    }
  }
  // Local storage fallback
  const localPharmacies = loadLocal("diabp_pharmacies", MOCK_PHARMACIES);
  const updated = localPharmacies.map((p: NcdPharmacy) => 
    p.id === pharmacyId ? { ...p, prices } : p
  );
  saveLocal("diabp_pharmacies", updated);
}

export async function associateClinician(userId: string, clinicId: string, role: 'Doctor' | 'Nurse' | 'Admin', email?: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('ncd_clinicians').insert([{ user_id: userId, clinic_id: clinicId, role, email }]);
      if (error) throw error;
    } catch (err) {
      console.error("Clinician association failed:", err);
      throw err;
    }
  } else {
    const associations = JSON.parse(localStorage.getItem('diabp_mock_clinicians') || '[]');
    associations.push({ user_id: userId, clinic_id: clinicId, role, email });
    localStorage.setItem('diabp_mock_clinicians', JSON.stringify(associations));
  }
}

export async function associatePharmacist(userId: string, pharmacyId: string, role: 'Owner' | 'Staff' = 'Owner', email?: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('ncd_pharmacists').insert([{ user_id: userId, pharmacy_id: pharmacyId, role, email }]);
      if (error) throw error;
    } catch (err) {
      console.error("Pharmacist association failed:", err);
      throw err;
    }
  } else {
    const associations = JSON.parse(localStorage.getItem('diabp_mock_pharmacists') || '[]');
    associations.push({ user_id: userId, pharmacy_id: pharmacyId, role, email });
    localStorage.setItem('diabp_mock_pharmacists', JSON.stringify(associations));
  }
}

export interface FacilityStaffMember {
  id: string;
  userId: string;
  role: string;
  email: string | null;
  createdAt: string;
}

export async function getFacilityStaff(facilityId: string, facilityType: 'clinic' | 'pharmacy'): Promise<FacilityStaffMember[]> {
  if (isSupabaseConfigured) {
    if (facilityType === 'clinic') {
      const { data, error } = await supabase
        .from('ncd_clinicians')
        .select('id, user_id, role, email, created_at')
        .eq('clinic_id', facilityId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        userId: d.user_id,
        role: d.role,
        email: d.email,
        createdAt: d.created_at
      }));
    } else {
      const { data, error } = await supabase
        .from('ncd_pharmacists')
        .select('id, user_id, role, email, created_at')
        .eq('pharmacy_id', facilityId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []).map(d => ({
        id: d.id,
        userId: d.user_id,
        role: d.role,
        email: d.email,
        createdAt: d.created_at
      }));
    }
  } else {
    if (facilityType === 'clinic') {
      const list = JSON.parse(localStorage.getItem('diabp_mock_clinicians') || '[]');
      return list
        .filter((c: any) => c.clinic_id === facilityId)
        .map((c: any, index: number) => ({
          id: `assoc-${index}`,
          userId: c.user_id,
          role: c.role || 'Doctor',
          email: c.email || `${c.user_id.substring(0, 8)}@facility.com`,
          createdAt: new Date().toISOString()
        }));
    } else {
      const list = JSON.parse(localStorage.getItem('diabp_mock_pharmacists') || '[]');
      return list
        .filter((p: any) => p.pharmacy_id === facilityId)
        .map((p: any, index: number) => ({
          id: `assoc-${index}`,
          userId: p.user_id,
          role: p.role || 'Owner',
          email: p.email || `${p.user_id.substring(0, 8)}@facility.com`,
          createdAt: new Date().toISOString()
        }));
    }
  }
}

export async function addFacilityStaff(
  email: string,
  password: string,
  fullName: string,
  role: string,
  facilityId: string,
  facilityType: 'clinic' | 'pharmacy'
): Promise<void> {
  if (isSupabaseConfigured) {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
    const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
    
    // Create a temporary client with persistSession: false to avoid overwriting the logged in admin's session.
    const tempSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });

    const { data: authData, error: authError } = await tempSupabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          role: facilityType === 'clinic' ? 'doctor' : 'pharmacist',
          full_name: fullName,
          clinic_id: facilityType === 'clinic' ? facilityId : undefined,
          pharmacy_id: facilityType === 'pharmacy' ? facilityId : undefined,
          facility_role: role
        }
      }
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error("Failed to register staff account.");

    if (facilityType === 'clinic') {
      await associateClinician(authData.user.id, facilityId, role as any, email);
    } else {
      await associatePharmacist(authData.user.id, facilityId, role as any, email);
    }
  } else {
    const mockUserId = `user-staff-${Math.random().toString(36).substr(2, 9)}`;
    const associations = JSON.parse(localStorage.getItem('diabp_mock_users') || '[]');
    associations.push({ id: mockUserId, email, role: facilityType === 'clinic' ? 'doctor' : 'pharmacist', full_name: fullName });
    localStorage.setItem('diabp_mock_users', JSON.stringify(associations));

    if (facilityType === 'clinic') {
      await associateClinician(mockUserId, facilityId, role as any, email);
    } else {
      await associatePharmacist(mockUserId, facilityId, role as any, email);
    }
  }
}

export interface RefillTrackerInfo {
  lastRefillDate: string | null;
  daysRemaining: number;
  nextRefillDate: string | null;
  status: 'No Refill Logged' | 'Overdue' | 'Low Supply' | 'Active Supply';
  latestOrderId?: string;
}

export function getRefillTracker(patientId: string, patientOrders: NcdRefillOrder[]): RefillTrackerInfo {
  const relevantOrders = patientOrders.filter(o => 
    o.patientId === patientId && 
    (o.status === 'Delivered' || o.status === 'Approved' || o.status === 'Out for Delivery')
  );
  
  if (relevantOrders.length === 0) {
    return {
      lastRefillDate: null,
      daysRemaining: 0,
      nextRefillDate: null,
      status: 'No Refill Logged'
    };
  }
  
  // Sort by date (newest first)
  const sorted = [...relevantOrders].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latestOrder = sorted[0];
  const lastDate = new Date(latestOrder.date);
  
  const nextDate = new Date(lastDate);
  nextDate.setDate(lastDate.getDate() + 30);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextDateClear = new Date(nextDate);
  nextDateClear.setHours(0, 0, 0, 0);
  
  const diffTime = nextDateClear.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return {
    lastRefillDate: latestOrder.date,
    daysRemaining: Math.max(0, diffDays),
    nextRefillDate: nextDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status: diffDays <= 0 ? 'Overdue' : diffDays <= 7 ? 'Low Supply' : 'Active Supply',
    latestOrderId: latestOrder.id
  };
}

export async function runRefillTrackerAutomation(): Promise<void> {
  const currentOrders = await getRefillOrders();
  const currentAlerts = await getSystemAlertsOnly(); // Query alerts without infinite recursion
  
  let patientsList: PatientNcdProfile[] = [];
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.from('ncd_profiles').select('*');
      if (data) {
        patientsList = data.map(p => ({
          id: p.id,
          name: p.name,
          age: p.age,
          weight: p.weight,
          conditions: p.conditions,
          baselineBp: p.baseline_bp,
          targetGlucoseRange: p.target_glucose_range,
          streakDays: p.streak_days,
          activeMeds: p.active_meds,
          assignedClinicId: p.assigned_clinic_id,
          assignedPharmacyId: p.assigned_pharmacy_id,
          phone: p.phone,
          address: p.address,
          bpHistory: [],
          glucoseHistory: [],
          footScanHistory: []
        }));
      }
    } catch {}
  }
  
  if (patientsList.length === 0) {
    const allProfiles = loadLocal('diabp_profiles', {});
    patientsList = Object.values(allProfiles);
    if (patientsList.length === 0) {
      patientsList = [{ ...INITIAL_NCD_PATIENT, id: 'mock-patient-default' }];
    }
  }

  const allPharmacies = await getPharmacies();

  for (const patient of patientsList) {
    const pId = patient.id || 'mock-patient-default';
    const tracker = getRefillTracker(pId, currentOrders);
    
    if (tracker.status === 'Low Supply' || tracker.status === 'Overdue') {
      const alreadyAlerted = currentAlerts.some(a => 
        a.patientId === pId && 
        a.title === 'Refill Reminder Alert' &&
        (new Date().getTime() - new Date(a.createdAt).getTime()) < 15 * 24 * 60 * 60 * 1000
      );
      
      if (!alreadyAlerted) {
        const pharmName = allPharmacies.find(ph => ph.id === patient.assignedPharmacyId)?.name || 'H-Medix Pharmacy Wuse II';
        const message = `Automated nudge dispatched: Patient's chronic supply is running low (${tracker.daysRemaining} days left). Assigned refill partner: ${pharmName}.`;
        
        await createSystemAlert(pId, 'Refill Reminder Alert', message, 'info');
      }
    }
  }
}

// Internal alerts query helper to bypass automated cron recursions
async function getSystemAlertsOnly(): Promise<NcdAlert[]> {
  if (isSupabaseConfigured) {
    try {
      const { data } = await supabase.from('ncd_alerts').select('*, ncd_profiles(name)').order('created_at', { ascending: false });
      if (data) {
        return data.map(a => ({
          id: a.id,
          patientId: a.patient_id,
          patientName: (a.ncd_profiles as any)?.name || "Unknown Patient",
          title: a.title,
          message: a.message,
          type: a.type as any,
          createdAt: a.created_at
        }));
      }
    } catch {}
  }
  return loadLocal(ALERTS_KEY, INITIAL_NCD_ALERTS);
}

export async function deleteClinic(clinicId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('ncd_clinics').delete().eq('id', clinicId);
    if (error) throw error;
  } else {
    const clinics = loadLocal("diabp_clinics", MOCK_CLINICS);
    const updated = clinics.filter((c: any) => c.id !== clinicId);
    saveLocal("diabp_clinics", updated);
  }
}

export async function deletePharmacy(pharmacyId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('ncd_pharmacies').delete().eq('id', pharmacyId);
    if (error) throw error;
  } else {
    const pharmacies = loadLocal("diabp_pharmacies", MOCK_PHARMACIES);
    const updated = pharmacies.filter((p: any) => p.id !== pharmacyId);
    saveLocal("diabp_pharmacies", updated);
  }
}

export async function deletePatientProfile(patientId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('ncd_profiles').delete().eq('id', patientId);
    if (error) throw error;
  } else {
    const profiles = loadLocal("diabp_profiles", {});
    delete profiles[patientId];
    saveLocal("diabp_profiles", profiles);
  }
}

export async function deleteRefillOrder(orderId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const { error } = await supabase.from('ncd_orders').delete().eq('order_number', orderId);
    if (error) throw error;
  } else {
    const orders = loadLocal(ORDERS_KEY, INITIAL_NCD_ORDERS);
    const updated = orders.filter((o: any) => o.id !== orderId);
    saveLocal(ORDERS_KEY, updated);
  }
}

// =============================================
// WEB PUSH SUBSCRIPTION MANAGEMENT
// =============================================

/**
 * Save a browser push subscription to Supabase so the server can push to this device.
 * Called after the user grants notification permission.
 */
export async function savePushSubscription(
  subscription: PushSubscription,
  userRole: string
): Promise<void> {
  if (!isSupabaseConfigured) return; // Requires server-side Supabase

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sub = subscription.toJSON();
    const payload = {
      user_id: user.id,
      user_role: userRole,
      endpoint: sub.endpoint,
      p256dh: sub.keys?.p256dh || '',
      auth: sub.keys?.auth || ''
    };

    // Upsert: if same endpoint exists, update the role
    const { error } = await supabase
      .from('push_subscriptions')
      .upsert(payload, { onConflict: 'endpoint' });

    if (error) {
      console.error('Failed to save push subscription:', error);
    }
  } catch (err) {
    console.error('Push subscription save error:', err);
  }
}

/**
 * Trigger the server-side send-push Edge Function to send real background push notifications
 * to all subscribed devices matching the target role (patients/clinicians/all).
 */
export async function triggerServerPush(
  title: string,
  body: string,
  target: 'patients' | 'clinicians' | 'all',
  tag?: string
): Promise<{ sent: number; total: number } | null> {
  if (!isSupabaseConfigured) {
    console.info('Server push requires Supabase — skipped in offline mode');
    return null;
  }

  try {
    const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
    const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

    const response = await fetch(`${supabaseUrl}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify({ title, body, target, tag: tag || 'diabp-copilot' })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('send-push function error:', response.status, text);
      return null;
    }

    const result = await response.json();
    console.log(`Server push result: ${result.sent}/${result.total} sent`);
    return result;
  } catch (err) {
    console.error('Failed to trigger server push:', err);
    return null;
  }
}

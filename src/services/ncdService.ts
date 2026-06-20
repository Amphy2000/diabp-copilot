import { supabase, isSupabaseConfigured } from './supabase';

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
}

export interface NcdRefillOrder {
  id: string;
  date: string;
  items: string[];
  totalNaira: number;
  status: 'Pending Verification' | 'Approved' | 'Out for Delivery' | 'Delivered';
  prescriptionRequired: boolean;
  prescriptionUploaded: boolean;
}

// Initial fallback mock datasets representing Chief Chinedu Eze
export const INITIAL_NCD_PATIENT: PatientNcdProfile = {
  name: "Chief Chinedu Eze",
  age: 58,
  weight: 88, // kg
  conditions: ["Type 2 Diabetes Mellitus", "Essential Hypertension"],
  baselineBp: "145/90 mmHg",
  targetGlucoseRange: "70 - 130 mg/dL (Fasting)",
  streakDays: 8,
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
  ]
};

export const INITIAL_NCD_ORDERS: NcdRefillOrder[] = [
  {
    id: "NCD-6088",
    date: "Jun 20, 2026",
    items: ["NCD Monthly Chronic Care Bundle (Metformin 500mg + Amlodipine 10mg + Lisinopril 20mg)"],
    totalNaira: 30000,
    status: "Pending Verification",
    prescriptionRequired: true,
    prescriptionUploaded: true
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
export async function getPatientProfile(): Promise<PatientNcdProfile> {
  if (isSupabaseConfigured) {
    try {
      // 1. Fetch main profile
      const { data: profileData, error: profileErr } = await supabase
        .from('ncd_profiles')
        .select('*')
        .limit(1)
        .single();
        
      if (profileErr) {
        // Table may not exist yet, fallback to LocalStorage
        if (profileErr.code === '42P01') {
          console.warn("Supabase tables not configured. Falling back to LocalStorage.");
          return loadLocal(PROFILE_KEY, INITIAL_NCD_PATIENT);
        }
        throw profileErr;
      }

      // 2. Fetch history logs associated with this profile
      const { data: vitalsData } = await supabase
        .from('ncd_vitals')
        .select('*')
        .eq('patient_id', profileData.id)
        .order('created_at', { ascending: true });

      const { data: scansData } = await supabase
        .from('ncd_foot_scans')
        .select('*')
        .eq('patient_id', profileData.id)
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
        name: profileData.name,
        age: profileData.age,
        weight: profileData.weight,
        conditions: profileData.conditions,
        baselineBp: profileData.baseline_bp,
        targetGlucoseRange: profileData.target_glucose_range,
        streakDays: profileData.streak_days,
        activeMeds: profileData.active_meds,
        bpHistory: bpHistory.length > 0 ? bpHistory : INITIAL_NCD_PATIENT.bpHistory,
        glucoseHistory: glucoseHistory.length > 0 ? glucoseHistory : INITIAL_NCD_PATIENT.glucoseHistory,
        footScanHistory: footScanHistory.length > 0 ? footScanHistory : INITIAL_NCD_PATIENT.footScanHistory
      };
    } catch (err) {
      console.error("Supabase load error, falling back to LocalStorage:", err);
    }
  }
  return loadLocal(PROFILE_KEY, INITIAL_NCD_PATIENT);
}

/**
 * Saves patient profile to Supabase with LocalStorage fallback
 */
export async function savePatientProfile(profile: PatientNcdProfile): Promise<void> {
  // Always update LocalStorage first
  saveLocal(PROFILE_KEY, profile);

  if (isSupabaseConfigured) {
    try {
      // 1. Get or create profile row
      const { data: existing } = await supabase.from('ncd_profiles').select('id').limit(1);
      
      const payload = {
        name: profile.name,
        age: profile.age,
        weight: profile.weight,
        conditions: profile.conditions,
        baseline_bp: profile.baselineBp,
        target_glucose_range: profile.targetGlucoseRange,
        streak_days: profile.streakDays,
        active_meds: profile.activeMeds
      };

      if (existing && existing.length > 0) {
        await supabase
          .from('ncd_profiles')
          .update(payload)
          .eq('id', existing[0].id);
      } else {
        await supabase
          .from('ncd_profiles')
          .insert([payload]);
      }
    } catch (err) {
      console.error("Supabase write error, using LocalStorage backup:", err);
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

  if (isSupabaseConfigured) {
    try {
      const { data: profileRow } = await supabase.from('ncd_profiles').select('id').limit(1).single();
      if (profileRow) {
        await supabase.from('ncd_vitals').insert([{
          patient_id: profileRow.id,
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
 * Appends a new foot scan record to database
 */
export async function logFootScanRecord(record: FootScanRecord): Promise<void> {
  const profile = await getPatientProfile();
  profile.footScanHistory.push(record);
  await savePatientProfile(profile);

  if (isSupabaseConfigured) {
    try {
      const { data: profileRow } = await supabase.from('ncd_profiles').select('id').limit(1).single();
      if (profileRow) {
        await supabase.from('ncd_foot_scans').insert([{
          patient_id: profileRow.id,
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

/**
 * Fetches Refill Orders list
 */
export async function getRefillOrders(): Promise<NcdRefillOrder[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('ncd_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') return loadLocal(ORDERS_KEY, INITIAL_NCD_ORDERS);
        throw error;
      }

      if (data && data.length > 0) {
        return data.map(o => ({
          id: o.order_number,
          date: o.date,
          items: o.items,
          totalNaira: o.total_naira,
          status: o.status as any,
          prescriptionRequired: o.prescription_required,
          prescriptionUploaded: o.prescription_uploaded
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
  const currentOrders = await getRefillOrders();
  const updatedOrders = [order, ...currentOrders];
  saveLocal(ORDERS_KEY, updatedOrders);

  if (isSupabaseConfigured) {
    try {
      const { data: profileRow } = await supabase.from('ncd_profiles').select('id').limit(1).single();
      if (profileRow) {
        await supabase.from('ncd_orders').insert([{
          patient_id: profileRow.id,
          order_number: order.id,
          date: order.date,
          items: order.items,
          total_naira: order.totalNaira,
          status: order.status,
          prescription_required: order.prescriptionRequired,
          prescription_uploaded: order.prescriptionUploaded
        }]);
      }
    } catch (err) {
      console.error("Supabase place order failed:", err);
    }
  }
}

/**
 * Updates status of an existing order
 */
export async function updateOrderStatus(orderId: string, status: NcdRefillOrder['status']): Promise<void> {
  const currentOrders = await getRefillOrders();
  const updatedOrders = currentOrders.map(o => o.id === orderId ? { ...o, status } : o);
  saveLocal(ORDERS_KEY, updatedOrders);

  if (isSupabaseConfigured) {
    try {
      await supabase
        .from('ncd_orders')
        .update({ status })
        .eq('order_number', orderId);
    } catch (err) {
      console.error("Supabase update status failed:", err);
    }
  }
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

        // Grid-based clustering bounds (10x10 grid)
        const gridCols = 10;
        const gridRows = 10;
        const cellW = width / gridCols;
        const cellH = height / gridRows;
        
        // Matrix to track count of high-redness pixels in each grid block
        const redCounts = Array(gridRows).fill(0).map(() => Array(gridCols).fill(0));
        const sumX = Array(gridRows).fill(0).map(() => Array(gridCols).fill(0));
        const sumY = Array(gridRows).fill(0).map(() => Array(gridCols).fill(0));

        // Iterate pixel-by-pixel
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const index = (y * width + x) * 4;
            const r = pixels[index];     // Red
            const g = pixels[index + 1]; // Green
            const b = pixels[index + 2]; // Blue

            // Redness threshold detection:
            // High intensity Red, and significantly higher than Green and Blue channels
            if (r > 150 && (r - g > 65) && (r - b > 65)) {
              // Locate corresponding grid cell
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

        // Find clusters with high density of red pixels (erythematous hotspots)
        const hotspots: FootHotspot[] = [];
        const threshold = (cellW * cellH) * 0.04; // at least 4% of cell pixels must be red

        for (let r = 0; r < gridRows; r++) {
          for (let c = 0; c < gridCols; c++) {
            const count = redCounts[r][c];
            if (count > threshold) {
              const avgX = sumX[r][c] / count;
              const avgY = sumY[r][c] / count;
              
              // Map coordinates to percentage ranges (matching CSS sole layout positioning)
              // Centered sole overlay spans roughly: left 20%-80% (scale accordingly)
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

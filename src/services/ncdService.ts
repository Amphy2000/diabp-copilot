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

// Initial mock datasets representing a typical senior chronic care patient in Nigeria
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
    { date: "June 20", systolic: 155, diastolic: 98 } // Rising BP trend
  ],
  glucoseHistory: [
    { date: "June 16", level: 125, type: "Fasting" },
    { date: "June 17", level: 138, type: "Fasting" },
    { date: "June 18", level: 118, type: "Fasting" },
    { date: "June 19", level: 145, type: "Fasting" },
    { date: "June 20", level: 168, type: "Fasting" } // Rising Blood Sugar
  ],
  footScanHistory: [
    {
      date: "May 10, 2026",
      hasHotspots: false,
      hotspots: [],
      riskScore: 12,
      recommendations: ["Skin hydration is good.", "No pressure ulcers or sensory loss detected."]
    },
    {
      date: "June 10, 2026",
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
    id: "NCD-5521",
    date: "May 22, 2026",
    items: ["NCD Chronic Care Bundle (Metformin 500mg + Amlodipine 10mg + Lisinopril 20mg)"],
    totalNaira: 30000,
    status: "Delivered",
    prescriptionRequired: true,
    prescriptionUploaded: true
  },
  {
    id: "NCD-6088",
    date: "June 20, 2026",
    items: ["NCD Chronic Care Bundle (Metformin 500mg + Amlodipine 10mg + Lisinopril 20mg)"],
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

/**
 * Calculates current clinical risk status based on BP and Glucose logs
 */
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

  // 1. Blood Pressure Audit (Stroke Risk)
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

  // 2. Glucose Audit (Diabetic Ketoacidosis / Complication Risk)
  const isFasting = glucoseType === 'Fasting';
  if (glucoseLevel >= 300) {
    diabeticRisk = 'Emergency';
    glucoseWarning = "CRITICAL HYPERGLYCEMIA! Risk of Diabetic Ketoacidosis (DKA) or Hyperosmolar State. Go to the emergency room immediately.";
  } else if (
    (isFasting && glucoseLevel >= 180) || 
    (!isFasting && glucoseLevel >= 250)
  ) {
    diabeticRisk = 'High';
    glucoseWarning = "High Blood Sugar. Check your medication compliance, drink plenty of water, and avoid carbohydrates.";
  } else if (
    (isFasting && glucoseLevel >= 130) || 
    (!isFasting && glucoseLevel >= 180)
  ) {
    diabeticRisk = 'Medium';
    glucoseWarning = "Mild Hyperglycemia. Blood sugar is slightly above target. Log your next meal.";
  } else if (glucoseLevel < 70) {
    diabeticRisk = 'Emergency'; // Hypoglycemia is an immediate killer!
    glucoseWarning = "🚨 HYPOGLYCEMIA ALERT! Sugar is dangerously low (<70 mg/dL). Drink juice or eat 3 spoons of sugar immediately. Recheck in 15 minutes.";
  }

  return { strokeRisk, diabeticRisk, bpWarning, glucoseWarning };
}

/**
 * AI Titration & Regimen Auditor for Clinicians
 */
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

  // 1. Demographic & Clinical Audits (African Population Specific Guidelines)
  notes.push(`Auditing regimen for ${age}yo patient, weight: ${weight}kg.`);
  
  // High-value clinical detail: Calcium channel blockers (CCBs like Amlodipine) or Thiazides 
  // are preferred first-line anti-hypertensives in patients of African descent over ACE inhibitors (Lisinopril) monotherapy.
  const hasCCB = activeMeds.some(m => m.toLowerCase().includes("amlodipine") || m.toLowerCase().includes("nifedipine"));
  const hasACE = activeMeds.some(m => m.toLowerCase().includes("lisinopril") || m.toLowerCase().includes("captopril") || m.toLowerCase().includes("enalapril"));
  
  if (hasACE && !hasCCB) {
    notes.push("Clinical Insight: Patient is on an ACE-inhibitor without a Calcium Channel Blocker (CCB). For African descent populations, CCBs (Amlodipine) or Thiazide diuretics demonstrate superior efficacy as first-line agents.");
    recommendations.push("Consider shifting to or adding Amlodipine 5mg-10mg daily to optimize blood pressure control.");
  }

  // 2. BP Titration Audit
  if (systolic >= 160 || diastolic >= 100) {
    appropriate = false;
    warning = "Blood Pressure is uncontrolled (Stage 2 Hypertension) despite current regimen.";
    recommendations.push("Increase Amlodipine dose to 10mg daily (if currently at 5mg) or consider adding a low-dose Thiazide diuretic (Hydrochlorothiazide 12.5mg daily).");
    recommendations.push("Verify patient compliance and audit salt intake (common factor in Nigeria).");
  }

  // 3. Glucose & Metformin Audit
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

  // 4. Safety Audits (Renal, Liver, Side Effects)
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

/**
 * Simulates AI Computer Vision foot ulcer detection
 */
export function simulateFootScan(fileName: string): FootScanRecord {
  // Mock image evaluation
  const hasHotspots = fileName.toLowerCase().includes("ulcer") || Math.random() > 0.4;
  
  if (hasHotspots) {
    return {
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      hasHotspots: true,
      hotspots: [
        { 
          x: 38, 
          y: 74, 
          severity: "high", 
          description: "Active high-pressure neuropathic hotspot at the 1st metatarsal head. High risk of ulceration." 
        },
        { 
          x: 44, 
          y: 35, 
          severity: "medium", 
          description: "Moderate friction inflammation on the medial arch. Check shoe fitting." 
        }
      ],
      riskScore: 68,
      recommendations: [
        "URGENT: Consult a podiatrist or nurse immediately for wound-debridement check.",
        "Do not walk barefoot. Use custom molded pressure-relieving orthotics.",
        "Check feet daily using a mirror or the AI scanner.",
        "Ensure blood sugar is kept strictly within range to promote tissue healing."
      ]
    };
  } else {
    return {
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      hasHotspots: false,
      hotspots: [],
      riskScore: 8,
      recommendations: [
        "Sensory and circulatory health appears normal.",
        "Continue moisturizing heels daily.",
        "Wash feet daily with lukewarm water and dry thoroughly, especially between toes."
      ]
    };
  }
}

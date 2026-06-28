import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { 
  ShieldAlert, 
  Users, 
  Building2, 
  TrendingUp, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Crown, 
  RefreshCw, 
  Sliders, 
  FileSpreadsheet,
  Search
} from 'lucide-react';
import type { PatientNcdProfile, NcdClinic, NcdPharmacy, NcdRefillOrder, ClinicEarning } from '../services/ncdService';
import { triggerServerPush, getAllPayoutRequests, updatePayoutStatus } from '../services/ncdService';
import { Banknote } from 'lucide-react';

const superAdminPitchCopy = `DiaBP-Copilot: B2B Clinician & Pharmacy Partnership Pitch

1. The Core Elevator Pitch
DiaBP-Copilot is an integrated, patient-centered remote care coordinator for chronic hypertension and diabetes. By linking clinicians, local community pharmacies, and patients into a single, closed-loop treatment registry, DiaBP-Copilot improves patient outcomes, stabilizes daily vitals, and guarantees recurring revenue for healthcare providers.

2. Zero-Friction Patient Engagement
- The WhatsApp bot connects patients instantly without requiring any native app downloads or smartphone upgrades.
- Patients log blood pressure, blood glucose, and receive adherence rewards via a chat interface they already use daily.
- Streaks and automated check-in alerts reduce compliance default rates by up to 60%.

3. Automated Clinician Oversight
- Priority Triage Queue: Clinic staff focus only on patients flagged with out-of-bounds vitals, eliminating manual logs.
- Care Team Handover Notice Board: Prevents communication gaps between doctors, nurses, and pharmacists.
- AI Foot Scanner: Computer-vision algorithms run self-calibrating erythema screening to detect silent ulcer risks early.

4. Guaranteed Predictable Revenue
- SafeMeds Refills: Refill orders are tracked and confirmed on WhatsApp, then dispatched automatically to community pharmacies.
- Instant Paystack Splits: Direct payouts distribute 95% of prescription fees instantly to the pharmacy/facility bank account.
- White-Labeled Presence: Serves the app under custom domain diabpcopilot.com, building local clinical credibility.`;

const adminPitchSlides = [
  {
    title: "DiaBP-Copilot Overview",
    subtitle: "Unifying Chronic NCD Care in Nigeria",
    bullets: [
      "Hospital-to-Pharmacy Bridge: Single loop for doctors, patients, and pharmacies.",
      "Zero App Friction: Patients log BP/glucose and request refills on WhatsApp.",
      "AI-Assisted Oversight: Early diabetic foot screening and triage queues."
    ]
  },
  {
    title: "The Chronic Care Crisis",
    subtitle: "Why silent NCDs cost facilities and families",
    bullets: [
      "Invisible Data: Log sheets are lost; clinics can only react during emergencies.",
      "Medication Default: Over 65% of patients miss chronic medication refills.",
      "Escalating Costs: Stroke, amputation, and failure exhaust family savings."
    ]
  },
  {
    title: "The Frictionless Solution",
    subtitle: "A unified ecosystem built for local realities",
    bullets: [
      "Unified Database: Connect doctors, staff, pharmacies, and patients.",
      "60-Second Onboarding: Patients text a keyword to link their profile.",
      "Triage Priority: High-risk patient trends flag clinic staff immediately."
    ]
  },
  {
    title: "Zero-Install Patient Engagement",
    subtitle: "Leveraging the messaging app they use daily",
    bullets: [
      "WhatsApp Logging: Send vitals in simple chat text (e.g. '130/80').",
      "Streak Rewards: Interactive motivation streaks keep patients logging.",
      "Adherence Reminders: Auto-prompts prompt patients when readings slip."
    ]
  },
  {
    title: "The Clinician Dashboard",
    subtitle: "Organized oversight with less admin overhead",
    bullets: [
      "Automatic Triaging: Algorithmic color-coding flags critical patient readings.",
      "Notice Board: Shift-to-shift memos coordinate clinic notice handovers.",
      "Text Nudges: Send SMS check-ins directly from the console."
    ]
  },
  {
    title: "SafeMeds Automated Refills",
    subtitle: "Refill Countdowns: Automatically alerts the patient when drugs are low.",
    bullets: [
      "Direct Refill Approvals: Patients approve monthly quotes inside WhatsApp.",
      "Community Dispatch: Refills route directly to preferred community pharmacies."
    ]
  },
  {
    title: "AI Diabetic Foot Screening",
    subtitle: "Preventing amputations via computer vision",
    bullets: [
      "Hotspot Detection: AI analyzes foot sole photos for silent erythema risk.",
      "Self-Calibrating Scan: Normalizes lighting/skin tones to limit false alarms.",
      "Podiatry Referrals: Automatically alerts doctors to schedule clinical visits."
    ]
  },
  {
    title: "Instant Split Payouts",
    subtitle: "Aligning profits with patient compliance",
    bullets: [
      "Integrated Billing: Collects subscription and drug fees securely online.",
      "95% Instant Splits: Fees split immediately to your facility's bank account.",
      "Zero Billing Admin: Auto-payouts clear on Paystack/Flutterwave billing rails."
    ]
  },
  {
    title: "Professional Branding & PWA",
    subtitle: "Sleek, custom, and offline-resilient",
    bullets: [
      "Custom Domain: Runs under diabpcopilot.com for facility credibility.",
      "Installable PWA: Installs on mobile home screens for fast operational access.",
      "Offline Sync: Service workers cache records, auto-syncing when online."
    ]
  },
  {
    title: "Launch Plan",
    subtitle: "Zero upfront friction setup",
    bullets: [
      "Instant Register: Setup your clinic/pharmacy in under 60 seconds.",
      "Staff invites: Link doctors, pharmacists, and rosters easily.",
      "Patient Rollout: Print the onboarding card and begin patient enrollment."
    ]
  }
];

interface SuperAdminDashboardProps {
  patients: PatientNcdProfile[];
  clinics: NcdClinic[];
  pharmacies: NcdPharmacy[];
  orders: NcdRefillOrder[];
  onUpdateClinic: (clinic: NcdClinic) => Promise<void>;
  onUpdatePharmacy: (pharmacy: NcdPharmacy) => Promise<void>;
  onUpdatePatientProfile: (patient: PatientNcdProfile) => Promise<void>;
  onDeleteClinic?: (clinicId: string) => Promise<void>;
  onDeletePharmacy?: (pharmacyId: string) => Promise<void>;
  onDeletePatient?: (patientId: string) => Promise<void>;
  onDeleteOrder?: (orderId: string) => Promise<void>;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  patients,
  clinics,
  pharmacies,
  orders,
  onUpdateClinic,
  onUpdatePharmacy,
  onUpdatePatientProfile,
  onDeleteClinic,
  onDeletePharmacy,
  onDeletePatient,
  onDeleteOrder
}) => {
  const [activeTab, setActiveTab] = useState<'facilities' | 'patients' | 'audits' | 'pitchdeck' | 'broadcast' | 'payouts'>('facilities');
  const [pitchSlide, setPitchSlide] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Payout states
  const [payoutRequests, setPayoutRequests] = useState<ClinicEarning[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(false);
  const [payoutActionFeedback, setPayoutActionFeedback] = useState<string | null>(null);

  // Load payout requests when payouts tab is active
  const loadPayoutRequests = async () => {
    setPayoutsLoading(true);
    const data = await getAllPayoutRequests();
    setPayoutRequests(data);
    setPayoutsLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'payouts') {
      loadPayoutRequests();
    }
  }, [activeTab]);

  // Broadcast Hub state variables
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'clinicians' | 'patients'>('all');
  const [broadcastStatus, setBroadcastStatus] = useState<string | null>(null);

  const handleDispatchBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastBody.trim()) return;

    // Post to Service Worker to broadcast system-wide notifications
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'DISPATCH_SYSTEM_BROADCAST',
        payload: {
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
          target: broadcastTarget
        }
      });
    }

    // Post to BroadcastChannel as fallback for active browser tabs
    const channel = new BroadcastChannel('diabp-copilot-channel');
    channel.postMessage({
      type: 'SYSTEM_BROADCAST',
      payload: {
        title: broadcastTitle.trim(),
        body: broadcastBody.trim(),
        target: broadcastTarget
      }
    });
    channel.close();

    // CROSS-DEVICE: Send via Supabase Realtime so ALL connected devices receive it
    if (isSupabaseConfigured) {
      supabase.channel('diabp-realtime-broadcasts').send({
        type: 'broadcast',
        event: 'SYSTEM_BROADCAST',
        payload: {
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
          target: broadcastTarget
        }
      });
    }

    setBroadcastStatus("🚀 Custom push broadcast dispatched successfully!");
    setBroadcastTitle("");
    setBroadcastBody("");
    setTimeout(() => setBroadcastStatus(null), 4000);
  };

  const handleSendTestClinicianAlert = () => {
    // Post to Service Worker and BroadcastChannel to trigger simulated clinician vitals log
    const payload = {
      patientId: 'simulated-test-patient-id',
      patientName: 'Simulated Test Patient',
      systolic: 178,
      diastolic: 106,
      glucose: 250,
      glucoseType: 'Post-Meal' as const,
      streakDays: 14
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'PATIENT_LOGGED_VITALS',
        payload
      });
    }

    // Same-device BroadcastChannel
    const channel = new BroadcastChannel('diabp-copilot-channel');
    channel.postMessage({ type: 'VITALS_LOGGED', payload });
    channel.close();

    // CROSS-DEVICE: Send via Supabase Realtime so ALL connected devices receive it
    if (isSupabaseConfigured) {
      supabase.channel('diabp-realtime-broadcasts').send({
        type: 'broadcast',
        event: 'VITALS_LOGGED',
        payload
      });
    }

    // Admin confirmation toast (same-device broadcast with target: all)
    const previewChannel = new BroadcastChannel('diabp-copilot-channel');
    previewChannel.postMessage({
      type: 'SYSTEM_BROADCAST',
      payload: {
        title: '🚨 TEST: Vitals Alert Sent',
        body: 'Simulated high-risk vitals (178/106 mmHg, 250 mg/dL) dispatched to all clinician dashboards.',
        target: 'all'
      }
    });
    previewChannel.close();

    // SERVER PUSH: Reach clinicians on ALL devices (background-capable)
    triggerServerPush(
      '🚨 HIGH RISK: Simulated Patient Vitals',
      'BP: 178/106 mmHg | Glucose: 250 mg/dL (Post-Meal) — Immediate review required.',
      'clinicians',
      'test-clinician-alert'
    );

    setBroadcastStatus("🚨 Sent test clinician alert (High risk vitals: 178/106 mmHg, 250 mg/dL)!");
    setTimeout(() => setBroadcastStatus(null), 4000);
  };

  const handleSendTestPatientReminder = () => {
    const payload = {
      title: "⏰ Daily Health Check-in (Test)",
      body: "Time to log your blood pressure and glucose readings to keep your 15-day care streak active!",
      target: 'patients' as const
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'DISPATCH_SYSTEM_BROADCAST',
        payload
      });
    }

    // Same-device BroadcastChannel
    const channel = new BroadcastChannel('diabp-copilot-channel');
    channel.postMessage({ type: 'SYSTEM_BROADCAST', payload });
    channel.close();

    // CROSS-DEVICE: Send via Supabase Realtime so ALL connected devices receive it
    if (isSupabaseConfigured) {
      supabase.channel('diabp-realtime-broadcasts').send({
        type: 'broadcast',
        event: 'SYSTEM_BROADCAST',
        payload
      });
    }

    // Admin confirmation toast
    const previewChannel = new BroadcastChannel('diabp-copilot-channel');
    previewChannel.postMessage({
      type: 'SYSTEM_BROADCAST',
      payload: {
        title: '⏰ TEST: Patient Reminder Sent',
        body: 'Daily health check-in reminder dispatched to all patient dashboards and devices.',
        target: 'all'
      }
    });
    previewChannel.close();

    // SERVER PUSH: Reach patients on ALL devices (background-capable)
    triggerServerPush(
      '⏰ Daily Health Check-in Reminder',
      'Time to log your blood pressure and glucose readings to keep your care streak active!',
      'patients',
      'daily-reminder-test'
    );

    setBroadcastStatus("⏰ Sent test patient daily reminder push notification!");
    setTimeout(() => setBroadcastStatus(null), 4000);
  };

  const [commissionRate, setCommissionRate] = useState<number>(() => {
    const stored = localStorage.getItem('diabp_system_commission_rate');
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) return parsed;
    }
    return 0.05; // 5% default
  });

  const handleSaveCommission = (rate: number) => {
    localStorage.setItem('diabp_system_commission_rate', rate.toString());
    setCommissionRate(rate);
  };

  // --- REVENUE ANALYTICS CALCULATIONS ---
  
  // 1. Refills Transaction Volume (Only orders that are Approved, Out for Delivery, or Delivered)
  const successfulOrders = orders.filter(o => 
    o.status === 'Approved' || o.status === 'Out for Delivery' || o.status === 'Delivered'
  );
  const totalRefillVolume = successfulOrders.reduce((sum, o) => sum + o.totalNaira, 0);

  // 2. Admin Split Commission
  const adminCommissions = totalRefillVolume * commissionRate;

  // 3. B2B SaaS Subscriptions Revenue (Clinic: N25,000/mo, Pharmacy: N15,000/mo)
  const premiumClinicsCount = clinics.filter(c => c.isPremium).length;
  const premiumPharmaciesCount = pharmacies.filter(p => p.isPremium).length;
  
  const clinicSubRevenue = premiumClinicsCount * 25000;
  const pharmacySubRevenue = premiumPharmaciesCount * 15000;
  const totalSaaSRevenue = clinicSubRevenue + pharmacySubRevenue;

  // 4. Patient Premium Subscriptions Revenue (N1,500/mo)
  const premiumPatientsCount = patients.filter(p => p.isPremium).length;
  const patientSubRevenue = premiumPatientsCount * 1500;

  // 5. Total Admin Platform Revenue
  const totalAdminRevenue = adminCommissions + totalSaaSRevenue + patientSubRevenue;

  // 6. Active vs Inactive Patients Registry Metrics
  const totalPatients = patients.length;
  const activePatientsCount = patients.filter(p => 
    (p.bpHistory && p.bpHistory.length > 0) || 
    (p.glucoseHistory && p.glucoseHistory.length > 0) || 
    (p.streakDays && p.streakDays > 0)
  ).length;
  const inactivePatientsCount = totalPatients - activePatientsCount;

  // --- OVERRIDE TOGGLE HANDLERS ---

  const getPlanOption = (isPremium?: boolean, premiumExpiry?: string): string => {
    if (!isPremium) return 'basic';
    if (premiumExpiry === 'Lifetime') return 'lifetime';
    if (!premiumExpiry) return 'premium_1y'; // fallback
    
    // parse expiry to calculate remaining time
    const expiryDate = new Date(premiumExpiry);
    const diffTime = expiryDate.getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0 && diffDays <= 7) return 'trial_7';
    if (diffDays > 7 && diffDays <= 30) return 'trial_30';
    if (diffDays > 30 && diffDays <= 365) return 'premium_1y';
    return 'lifetime';
  };

  const handlePlanChange = async (
    type: 'clinic' | 'pharmacy' | 'patient',
    item: any,
    planKey: string
  ) => {
    setUpdatingId(item.id);
    try {
      let isPremium = false;
      let premiumExpiry: string | undefined = undefined;

      if (planKey === 'trial_7') {
        isPremium = true;
        premiumExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
      } else if (planKey === 'trial_30') {
        isPremium = true;
        premiumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();
      } else if (planKey === 'premium_1y') {
        isPremium = true;
        premiumExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString();
      } else if (planKey === 'lifetime') {
        isPremium = true;
        premiumExpiry = 'Lifetime';
      }

      if (type === 'clinic') {
        await onUpdateClinic({
          ...item,
          isPremium,
          premiumExpiry
        });
      } else if (type === 'pharmacy') {
        await onUpdatePharmacy({
          ...item,
          isPremium,
          premiumExpiry
        });
      } else if (type === 'patient') {
        await onUpdatePatientProfile({
          ...item,
          isPremium,
          premiumExpiry
        });
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const getPlanBadge = (isPremium?: boolean, premiumExpiry?: string) => {
    if (!isPremium) {
      return (
        <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem' }}>
          Basic Plan
        </span>
      );
    }
    if (premiumExpiry === 'Lifetime') {
      return (
        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
          ♾️ Lifetime
        </span>
      );
    }
    const planKey = getPlanOption(isPremium, premiumExpiry);
    if (planKey === 'trial_7' || planKey === 'trial_30') {
      return (
        <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
          ⏳ Trial ({premiumExpiry})
        </span>
      );
    }
    return (
      <span style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
        👑 Premium ({premiumExpiry})
      </span>
    );
  };

  const handleUpdateSubaccountId = async (type: 'clinic' | 'pharmacy', facility: any, subId: string) => {
    if (type === 'clinic') {
      await onUpdateClinic({
        ...facility,
        subaccountId: subId.trim() || undefined
      });
    } else {
      await onUpdatePharmacy({
        ...facility,
        subaccountId: subId.trim() || undefined
      });
    }
  };

  // --- FILTERS ---
  const filteredClinics = clinics.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPharmacies = pharmacies.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.phone && p.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6 animate-fade-in" style={{ paddingBottom: '30px' }}>
      
      {/* 1. Header Row */}
      <div className="glass-panel" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.4) 0%, rgba(20, 20, 20, 0.6) 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert className="text-teal-400 w-6 h-6 animate-pulse" /> 
              DiaBP System Administrator Control Center
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Live B2B Facility Overrides, Core Subaccount Verification, and Global Commission & SaaS Metrics
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '8px 14px', fontSize: '0.75rem', color: 'white', fontWeight: 'bold',
              cursor: 'pointer', transition: 'background 0.2s'
            }}
          >
            <RefreshCw size={12} /> Sync State
          </button>
        </div>
      </div>

      {/* System Settings & Commission Control */}
      <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders className="text-teal-400 w-4 h-4" />
          System Platform Split Configuration
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span>Platform Commission Rate</span>
              <span style={{ color: 'var(--color-teal-light)', fontWeight: 'bold' }}>{(commissionRate * 100).toFixed(1)}%</span>
            </div>
            <input 
              type="range"
              min="0.01"
              max="0.20"
              step="0.005"
              value={commissionRate}
              onChange={(e) => handleSaveCommission(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#14b8a6', cursor: 'pointer' }}
            />
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', flex: 2, minWidth: '200px', lineHeight: '1.4' }}>
            Adjusting this commission percentage dynamically updates the payout calculation across all clinics and pharmacies. Custom split parameters are routed to Flutterwave checkout payloads in real-time.
          </p>
        </div>
      </div>

      {/* 2. Global Revenue Analytics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Total Admin commissions */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #14b8a6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Total Platform Revenue
            </span>
            <DollarSign className="text-teal-400 w-4 h-4" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>
            ₦{totalAdminRevenue.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            Comm. + SaaS subscriptions + Patients
          </span>
        </div>

        {/* Refills Commission volume */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Refills Split Comm. ({(commissionRate * 100).toFixed(0)}%)
            </span>
            <TrendingUp className="text-blue-400 w-4 h-4" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#60a5fa' }}>
            ₦{adminCommissions.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            From ₦{totalRefillVolume.toLocaleString()} total refills volume
          </span>
        </div>

        {/* SaaS Subscriptions volume */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #eab308' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              B2B SaaS Revenue
            </span>
            <Crown className="text-yellow-400 w-4 h-4" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#facc15' }}>
            ₦{totalSaaSRevenue.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {premiumClinicsCount} Clinics | {premiumPharmaciesCount} Pharmacies active
          </span>
        </div>

        {/* Patient Subscriptions */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Patient Premium Revenue
            </span>
            <Users className="text-emerald-400 w-4 h-4" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34d399' }}>
            ₦{patientSubRevenue.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            From {premiumPatientsCount} premium-tier active users
          </span>
        </div>

        {/* App Patients Registry */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Patients Registry
            </span>
            <Users className="text-purple-400 w-4 h-4" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#c084fc' }}>
            {totalPatients} Total Patients
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            🟢 {activePatientsCount} Active | 🔴 {inactivePatientsCount} Inactive
          </span>
        </div>

      </div>

      {/* 3. Section Control Tabs & Search */}
      <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' as any, flexShrink: 0, maxWidth: '100%', paddingBottom: '4px' }}>
          <button
            onClick={() => setActiveTab('facilities')}
            className={`tab-btn ${activeTab === 'facilities' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '8px 16px' }}
          >
            <Building2 size={12} /> B2B Facilities ({clinics.length + pharmacies.length})
          </button>
          <button
            onClick={() => setActiveTab('patients')}
            className={`tab-btn ${activeTab === 'patients' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '8px 16px' }}
          >
            <Users size={12} /> Patient Overrides ({patients.length})
          </button>
          <button
            onClick={() => setActiveTab('audits')}
            className={`tab-btn ${activeTab === 'audits' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '8px 16px' }}
          >
            <FileSpreadsheet size={12} /> System split Audits ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('pitchdeck')}
            className={`tab-btn ${activeTab === 'pitchdeck' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '8px 16px' }}
          >
            📢 Pitch Deck & Promo
          </button>
          <button
            onClick={() => setActiveTab('broadcast')}
            className={`tab-btn ${activeTab === 'broadcast' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '8px 16px' }}
          >
            📢 Broadcast Hub
          </button>
          <button
            onClick={() => setActiveTab('payouts')}
            className={`tab-btn ${activeTab === 'payouts' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '8px 16px' }}
          >
            💳 Payout Requests
          </button>
        </div>

        {activeTab !== 'pitchdeck' && activeTab !== 'broadcast' && (
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px 8px 30px', background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white',
                fontSize: '0.75rem', outline: 'none'
              }}
            />
          </div>
        )}
      </div>

      {/* 4. Tab Contents */}
      {activeTab === 'facilities' && (
        <div className="space-y-6">
          
          {/* Clinic Overrides Table */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🏥 Clinic Subscriptions & Overrides
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px' }}>Clinic Name</th>
                    <th style={{ padding: '12px' }}>City</th>
                    <th style={{ padding: '12px' }}>Flutterwave Subaccount ID</th>
                    <th style={{ padding: '12px' }}>Plan Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClinics.map(clinic => {
                    const cleanSubaccount = clinic.subaccountId?.split('|||')[0] || '';
                    return (
                      <tr key={clinic.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'white' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{clinic.name}</td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{clinic.city}</td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            type="text"
                            defaultValue={cleanSubaccount}
                            placeholder="Link manually..."
                            onBlur={(e) => handleUpdateSubaccountId('clinic', clinic, e.target.value)}
                            style={{
                              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '6px', padding: '4px 8px', color: '#60a5fa', fontSize: '0.7rem', width: '150px', outline: 'none'
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          {getPlanBadge(clinic.isPremium, clinic.premiumExpiry)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <select
                              disabled={updatingId === clinic.id}
                              value={getPlanOption(clinic.isPremium, clinic.premiumExpiry)}
                              onChange={(e) => handlePlanChange('clinic', clinic, e.target.value)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'white',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                outline: 'none',
                                cursor: 'pointer',
                                minWidth: '130px'
                              }}
                            >
                              <option value="basic" style={{ background: '#111827', color: 'var(--text-muted)' }}>Basic Plan</option>
                              <option value="trial_7" style={{ background: '#111827', color: '#60a5fa' }}>Free Trial (7d)</option>
                              <option value="trial_30" style={{ background: '#111827', color: '#3b82f6' }}>Free Trial (30d)</option>
                              <option value="premium_1y" style={{ background: '#111827', color: '#facc15' }}>Standard (1y)</option>
                              <option value="lifetime" style={{ background: '#111827', color: '#34d399' }}>Lifetime Premium</option>
                            </select>
                            {onDeleteClinic && (
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete clinic "${clinic.name}"? This action cannot be undone.`)) {
                                    onDeleteClinic(clinic.id);
                                  }
                                }}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pharmacy Overrides Table */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🏪 Pharmacy Subscriptions & Overrides
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px' }}>Pharmacy Name</th>
                    <th style={{ padding: '12px' }}>City</th>
                    <th style={{ padding: '12px' }}>Flutterwave Subaccount ID</th>
                    <th style={{ padding: '12px' }}>Plan Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPharmacies.map(pharmacy => {
                    const cleanSubaccount = pharmacy.subaccountId?.split('|||')[0] || '';
                    return (
                      <tr key={pharmacy.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'white' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{pharmacy.name}</td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{pharmacy.city}</td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            type="text"
                            defaultValue={cleanSubaccount}
                            placeholder="Link manually..."
                            onBlur={(e) => handleUpdateSubaccountId('pharmacy', pharmacy, e.target.value)}
                            style={{
                              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '6px', padding: '4px 8px', color: '#60a5fa', fontSize: '0.7rem', width: '150px', outline: 'none'
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          {getPlanBadge(pharmacy.isPremium, pharmacy.premiumExpiry)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <select
                              disabled={updatingId === pharmacy.id}
                              value={getPlanOption(pharmacy.isPremium, pharmacy.premiumExpiry)}
                              onChange={(e) => handlePlanChange('pharmacy', pharmacy, e.target.value)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'white',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                outline: 'none',
                                cursor: 'pointer',
                                minWidth: '130px'
                              }}
                            >
                              <option value="basic" style={{ background: '#111827', color: 'var(--text-muted)' }}>Basic Plan</option>
                              <option value="trial_7" style={{ background: '#111827', color: '#60a5fa' }}>Free Trial (7d)</option>
                              <option value="trial_30" style={{ background: '#111827', color: '#3b82f6' }}>Free Trial (30d)</option>
                              <option value="premium_1y" style={{ background: '#111827', color: '#facc15' }}>Standard (1y)</option>
                              <option value="lifetime" style={{ background: '#111827', color: '#34d399' }}>Lifetime Premium</option>
                            </select>
                            {onDeletePharmacy && (
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete pharmacy "${pharmacy.name}"? This action cannot be undone.`)) {
                                    onDeletePharmacy(pharmacy.id);
                                  }
                                }}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'patients' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            👑 Patient Account Overrides
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Patient Name</th>
                  <th style={{ padding: '12px' }}>Conditions</th>
                  <th style={{ padding: '12px' }}>Phone</th>
                  <th style={{ padding: '12px' }}>Gold Status</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(patient => (
                  <tr key={patient.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'white' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{patient.name}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {(patient.conditions || []).join(', ')}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{patient.phone || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>
                      {getPlanBadge(patient.isPremium, patient.premiumExpiry)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <select
                          disabled={updatingId === patient.id}
                          value={getPlanOption(patient.isPremium, patient.premiumExpiry)}
                          onChange={(e) => handlePlanChange('patient', patient, e.target.value)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            outline: 'none',
                            cursor: 'pointer',
                            minWidth: '130px'
                          }}
                        >
                          <option value="basic" style={{ background: '#111827', color: 'var(--text-muted)' }}>Basic Plan</option>
                          <option value="trial_7" style={{ background: '#111827', color: '#60a5fa' }}>Free Trial (7d)</option>
                          <option value="trial_30" style={{ background: '#111827', color: '#3b82f6' }}>Free Trial (30d)</option>
                          <option value="premium_1y" style={{ background: '#111827', color: '#facc15' }}>Standard (1y)</option>
                          <option value="lifetime" style={{ background: '#111827', color: '#34d399' }}>Lifetime Premium</option>
                        </select>
                        {onDeletePatient && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete patient "${patient.name}"? This action cannot be undone.`)) {
                                onDeletePatient(patient.id);
                              }
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audits' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 Master System Refills Split Audit Log
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Order ID</th>
                  <th style={{ padding: '12px' }}>Patient</th>
                  <th style={{ padding: '12px' }}>Medications</th>
                  <th style={{ padding: '12px' }}>Total Amount</th>
                  <th style={{ padding: '12px' }}>Subaccount Payout ({((1 - commissionRate) * 100).toFixed(0)}%)</th>
                  <th style={{ padding: '12px' }}>Platform Fee ({(commissionRate * 100).toFixed(0)}%)</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const resolvedPatient = patients.find(p => p.id === order.patientId);
                  const isSuccess = order.status === 'Approved' || order.status === 'Out for Delivery' || order.status === 'Delivered';
                  
                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'white' }}>
                      <td style={{ padding: '12px' }}><code style={{ color: '#60a5fa' }}>{order.id.slice(0, 8)}</code></td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{order.patientName || resolvedPatient?.name || 'Unknown Patient'}</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{order.items.join(', ')}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>₦{order.totalNaira.toLocaleString()}</td>
                      <td style={{ padding: '12px', color: isSuccess ? '#34d399' : 'var(--text-muted)' }}>
                        ₦{(order.totalNaira * (1 - commissionRate)).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', color: isSuccess ? '#60a5fa' : 'var(--text-muted)' }}>
                        ₦{(order.totalNaira * commissionRate).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: order.status === 'Delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: order.status === 'Delivered' ? '#10b981' : '#f59e0b',
                          border: order.status === 'Delivered' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem'
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {onDeleteOrder && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete refill order "${order.id}"? This action cannot be undone.`)) {
                                onDeleteOrder(order.id);
                              }
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'pitchdeck' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Left Column: Skimmable Persuasive Pitch Copy */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'white', fontWeight: 'bold' }}>
                  📢 Partner & Clinic Pitch Material
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Persuasive B2B copy optimized to onboard clinics and pharmacies.
                </p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(superAdminPitchCopy);
                  alert("Partnership pitch copy copied to clipboard!");
                }}
                style={{
                  background: 'rgba(20, 184, 166, 0.15)',
                  border: '1px solid rgba(20, 184, 166, 0.25)',
                  color: 'var(--color-teal-light)',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(20, 184, 166, 0.25)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(20, 184, 166, 0.15)'}
              >
                📋 Copy Pitch Copy
              </button>
            </div>

            {/* Skimmable Pitch copy */}
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.6', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <strong style={{ color: 'white', fontSize: '0.85rem', display: 'block', marginBottom: '4px' }}>
                  🏥 The Core Proposition (For Clinical Partners)
                </strong>
                DiaBP-Copilot is an integrated, patient-centered remote care coordinator for chronic hypertension and diabetes. By linking clinicians, local community pharmacies, and patients into a single, closed-loop treatment registry, DiaBP-Copilot improves patient outcomes, stabilizes daily vitals, and guarantees recurring revenue for healthcare providers.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px' }}>
                  <strong style={{ color: 'var(--color-teal-light)', display: 'block', marginBottom: '4px' }}>
                    💬 Frictionless Patient Tracking
                  </strong>
                  No apps to download. Patients log vitals and request monthly refills by chatting on WhatsApp, which 98% of target patients already use daily. Streaks and automated check-ins reduce compliance default rates by up to 60%.
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px' }}>
                  <strong style={{ color: 'var(--color-teal-light)', display: 'block', marginBottom: '4px' }}>
                    ⚡ Zero Clinician Data Entry
                  </strong>
                  Clinic staff focus only on patients flagged with out-of-bounds vitals, eliminating manual logs. The WhatsApp bot processes inputs, checks bounds, and pushes clean logs to the clinician dashboard automatically.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px' }}>
                  <strong style={{ color: 'var(--color-teal-light)', display: 'block', marginBottom: '4px' }}>
                    💊 SafeMeds Refill Revenue
                  </strong>
                  Refill orders are tracked and confirmed on WhatsApp, then dispatched automatically to community pharmacies. Payout splits route 95% of prescription fees instantly to the pharmacy/facility bank account.
                </div>
                <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px' }}>
                  <strong style={{ color: 'var(--color-teal-light)', display: 'block', marginBottom: '4px' }}>
                    📸 AI Foot Ulcer Diagnostics
                  </strong>
                  Computer-vision algorithms run self-calibrating erythema screening to detect silent ulcer risks early, compensating for dark skin tones and variable lighting to refer patients for podiatry consults.
                </div>
              </div>

              {/* Objection Handling Cards */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <strong style={{ color: 'white', fontSize: '0.85rem', display: 'block', marginBottom: '10px' }}>
                  🎯 Direct Objection Handlers (To close deals)
                </strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ borderLeft: '3px solid #14b8a6', paddingLeft: '10px' }}>
                    <span style={{ color: 'white', fontWeight: 'bold', display: 'block' }}>Q: "Why would a busy clinic spend time setting this up?"</span>
                    <span style={{ color: 'var(--text-muted)' }}>A: Setting up takes 60 seconds. It immediately filters out the stable 80% of patients and alerts clinicians to the 20% in critical need, drastically reducing workload.</span>
                  </div>
                  <div style={{ borderLeft: '3px solid #14b8a6', paddingLeft: '10px' }}>
                    <span style={{ color: 'white', fontWeight: 'bold', display: 'block' }}>Q: "How do we guarantee pharmacies fill orders correctly?"</span>
                    <span style={{ color: 'var(--text-muted)' }}>A: Pharmacies receive direct notifications, locked in pre-calculated refills, and 95% split payouts on Paystack instantly, removing billing friction.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Slide Viewer Preview & Downloads */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Slide Preview Container */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase' }}>
                  📊 Slide Preview
                </span>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                  Slide {pitchSlide + 1} of {adminPitchSlides.length}
                </span>
              </div>

              <div style={{
                background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '24px',
                minHeight: '200px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                textAlign: 'left'
              }}>
                <h5 style={{ margin: 0, fontSize: '1rem', color: 'white', fontWeight: 'bold' }}>
                  {adminPitchSlides[pitchSlide].title}
                </h5>
                <p style={{ margin: '4px 0 12px 0', fontSize: '0.7rem', color: 'var(--color-teal-light)', fontWeight: 'bold' }}>
                  {adminPitchSlides[pitchSlide].subtitle}
                </p>
                <ul style={{ margin: 0, paddingLeft: '14px', fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {adminPitchSlides[pitchSlide].bullets.map((b, i) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>

              {/* Slider controls */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  disabled={pitchSlide === 0}
                  onClick={() => setPitchSlide(p => Math.max(0, p - 1))}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: pitchSlide === 0 ? 'rgba(255,255,255,0.2)' : 'white',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    cursor: pitchSlide === 0 ? 'not-allowed' : 'pointer'
                  }}
                >
                  ◀ Back
                </button>
                <div style={{ display: 'flex', gap: '4px' }}>
                  {adminPitchSlides.map((_, idx) => (
                    <div
                      key={idx}
                      onClick={() => setPitchSlide(idx)}
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: pitchSlide === idx ? 'var(--color-teal-light)' : 'rgba(255,255,255,0.15)',
                        cursor: 'pointer'
                      }}
                    />
                  ))}
                </div>
                <button
                  disabled={pitchSlide === adminPitchSlides.length - 1}
                  onClick={() => setPitchSlide(p => Math.min(adminPitchSlides.length - 1, p + 1))}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: pitchSlide === adminPitchSlides.length - 1 ? 'rgba(255,255,255,0.2)' : 'white',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '0.65rem',
                    fontWeight: 'bold',
                    cursor: pitchSlide === adminPitchSlides.length - 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  Next ▶
                </button>
              </div>
            </div>

            {/* Download and Print Options */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', textTransform: 'uppercase' }}>
                📥 Presentation Assets
              </span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => window.open('/diabp_pitch_deck.html', '_blank')}
                  style={{
                    background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                    border: 'none',
                    color: 'white',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)'
                  }}
                >
                  🖥️ Open Presentation & Export to PDF
                </button>

                <button
                  onClick={() => {
                    const markdownText = `# DiaBP-Copilot Pitch Deck\n\n` + 
                      `## 📢 Partnership Copy\n\n` +
                      superAdminPitchCopy + `\n\n` +
                      `---\n\n` +
                      `## 📊 Slide Presentation\n\n` +
                      adminPitchSlides.map((s, idx) => `### Slide ${idx + 1}: ${s.title}\n**${s.subtitle}**\n${s.bullets.map(b => `- ${b}`).join('\n')}`).join('\n\n---\n\n');
                    
                    const element = document.createElement("a");
                    const file = new Blob([markdownText], { type: 'text/markdown' });
                    element.href = URL.createObjectURL(file);
                    element.download = "diabp_pitch_deck.md";
                    document.body.appendChild(element);
                    element.click();
                    document.body.removeChild(element);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  📥 Download Markdown Slides (.md)
                </button>
              </div>
            </div>

          </div>

        </div>
      )}

      {activeTab === 'broadcast' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px', alignItems: 'start' }}>
          
          {/* Left Column: Custom Broadcast Composer */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                📢 Custom Push Message Composer
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Dispatch a real-time system-wide push notification to active or offline users.
              </p>
            </div>

            {broadcastStatus && (
              <div style={{
                background: 'rgba(20, 184, 166, 0.12)',
                border: '1px solid rgba(20, 184, 166, 0.3)',
                borderRadius: '8px',
                padding: '12px',
                color: 'var(--color-teal-light)',
                fontSize: '0.75rem',
                fontWeight: 'bold'
              }}>
                {broadcastStatus}
              </div>
            )}

            <form onSubmit={handleDispatchBroadcast} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  Target Audience
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['all', 'clinicians', 'patients'] as const).map((tgt) => (
                    <button
                      key={tgt}
                      type="button"
                      onClick={() => setBroadcastTarget(tgt)}
                      style={{
                        flex: 1,
                        background: broadcastTarget === tgt ? 'rgba(20, 184, 166, 0.2)' : 'rgba(255,255,255,0.03)',
                        border: broadcastTarget === tgt ? '1px solid rgba(20, 184, 166, 0.5)' : '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        color: broadcastTarget === tgt ? 'white' : 'var(--text-secondary)',
                        fontSize: '0.7rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        textTransform: 'capitalize'
                      }}
                    >
                      {tgt === 'all' ? '🌐 Everyone' : tgt === 'clinicians' ? '🥼 Clinicians Only' : '👤 Patients Only'}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="broadcast-title" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  Notification Title
                </label>
                <input
                  id="broadcast-title"
                  type="text"
                  placeholder="e.g., Scheduled Maintenance Nudge"
                  value={broadcastTitle}
                  onChange={(e) => setBroadcastTitle(e.target.value)}
                  required
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.75rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label htmlFor="broadcast-body" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  Notification Message Body
                </label>
                <textarea
                  id="broadcast-body"
                  rows={4}
                  placeholder="Type the message contents here... e.g., Reminder: Vitals registry server will undergo a 10 min upgrade at 11 PM."
                  value={broadcastBody}
                  onChange={(e) => setBroadcastBody(e.target.value)}
                  required
                  style={{
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.75rem',
                    outline: 'none',
                    resize: 'none'
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  boxShadow: '0 4px 12px rgba(20, 184, 166, 0.25)',
                  marginTop: '8px'
                }}
              >
                🚀 Dispatch Custom Push Notification
              </button>
            </form>
          </div>

          {/* Right Column: QA Alert Simulation Suite */}
          <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🛠️ QA Alert Simulation Suite
              </h4>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Simulate production alert events instantly to test notification logic.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', display: 'block' }}>
                  🥼 Clinician Alert Simulation
                </span>
                <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Simulates a patient logging critical, high-risk vitals via WhatsApp. This will immediately trigger the clinician's audible alarm chime and slide-in toast notification, as well as a native OS notification.
                </p>
                <button
                  onClick={handleSendTestClinicianAlert}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#f87171',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                >
                  🚨 Trigger Test Clinician Vitals Alarm
                </button>
              </div>

              <div style={{
                background: 'rgba(255,255,255,0.01)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', display: 'block' }}>
                  👤 Patient Check-in Simulation
                </span>
                <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Simulates the daily NCD tracking reminder nudge sent to patients who forgot to submit readings. This tests the Service Worker interval routine.
                </p>
                <button
                  onClick={handleSendTestPatientReminder}
                  style={{
                    background: 'rgba(59, 130, 246, 0.12)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    color: '#60a5fa',
                    borderRadius: '8px',
                    padding: '10px',
                    fontSize: '0.7rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    textAlign: 'center'
                  }}
                >
                  ⏰ Trigger Test Patient Daily Nudge
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'payouts' && (
        <div className="space-y-6">
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  💳 System Payout Requests
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  Approve and record clinic payout withdrawals. Execute bank transfers via Paystack/Flutterwave dashboard or manually, then mark as Paid.
                </p>
              </div>
              <button 
                onClick={loadPayoutRequests} 
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', padding: '6px 12px', borderRadius: '8px', fontSize: '0.7rem', cursor: 'pointer', fontWeight: 'bold' }}
              >
                🔄 Refresh Ledger
              </button>
            </div>

            {payoutActionFeedback && (
              <div style={{ marginBottom: '16px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80', fontSize: '0.75rem', fontWeight: 600 }}>
                {payoutActionFeedback}
              </div>
            )}

            {payoutsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>Loading requests...</div>
            ) : payoutRequests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '12px' }}>
                <span style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>💳</span>
                <span style={{ fontSize: '0.8rem' }}>No clinic payout requests recorded in the system.</span>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '12px' }}>Requested Date</th>
                      <th style={{ padding: '12px' }}>Clinic Name</th>
                      <th style={{ padding: '12px' }}>Amount (₦)</th>
                      <th style={{ padding: '12px' }}>Bank Payout Details</th>
                      <th style={{ padding: '12px' }}>Status</th>
                      <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutRequests.map(req => {
                      const requestClinic = clinics.find(c => c.id === req.clinicId);
                      const isPending = req.status === 'pending' || req.status === 'requested';
                      
                      // Extract Bank Details from Description
                      // Description format: "Payout request → AccountName | BankName | AccountNumber"
                      const descParts = req.description.split('→');
                      const rawDetails = descParts[1] || req.description;
                      const details = rawDetails.trim();

                      return (
                        <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'white' }}>
                          <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                            {new Date(req.createdAt).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td style={{ padding: '12px', fontWeight: 'bold' }}>
                            {requestClinic?.name || 'Unknown Clinic'}
                            <span style={{ fontSize: '8px', color: 'var(--text-muted)', display: 'block' }}>ID: {req.clinicId}</span>
                          </td>
                          <td style={{ padding: '12px', color: '#f87171', fontWeight: 'bold' }}>
                            ₦{Math.abs(req.amount).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {details}
                          </td>
                          <td style={{ padding: '12px' }}>
                            <span style={{ 
                              padding: '2px 8px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold',
                              background: isPending ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)',
                              border: `1px solid ${isPending ? 'rgba(249,115,22,0.2)' : 'rgba(34,197,94,0.2)'}`,
                              color: isPending ? '#fb923c' : '#4ade80'
                            }}>
                              {req.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'right' }}>
                            {isPending ? (
                              <button
                                onClick={async () => {
                                  const ok = await updatePayoutStatus(req.clinicId, req.id, 'paid');
                                  if (ok) {
                                    setPayoutActionFeedback(`Successfully marked request from ${requestClinic?.name || 'Clinic'} as PAID.`);
                                    loadPayoutRequests();
                                    setTimeout(() => setPayoutActionFeedback(null), 4000);
                                  }
                                }}
                                style={{
                                  background: 'rgba(34,197,94,0.12)',
                                  border: '1px solid rgba(34,197,94,0.25)',
                                  color: '#4ade80',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '0.7rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer'
                                }}
                              >
                                Mark as Paid
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Disbursed ✓</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

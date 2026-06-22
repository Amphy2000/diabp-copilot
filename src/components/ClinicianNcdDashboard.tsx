import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Calculator, 
  ClipboardList, 
  CheckCircle, 
  MessageSquare, 
  ShieldAlert,
  ArrowRight,
  Search,
  Activity,
  Heart,
  FileText,
  X,
  ShieldCheck,
  Phone,
  MapPin,
  Eye,
  ShoppingBag,
  Lock,
  CreditCard,
  Sparkles,
  Circle
} from 'lucide-react';
import { 
  auditNcdRegimen,
  evaluateNcdRisk,
  NCD_MEDICATIONS,
  getSystemAlerts,
  dismissSystemAlert,
  dismissAlertsForPatient,
  getRefillTracker,
  getFacilityStaff,
  addFacilityStaff
} from '../services/ncdService';
import type { PatientNcdProfile, NcdRefillOrder, NcdClinic, NcdPharmacy, NcdAlert } from '../services/ncdService';
import { supabase, isSupabaseConfigured } from '../services/supabase';

const NIGERIAN_BANKS = [
  { code: '058', name: 'GTBank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '044', name: 'Access Bank' },
  { code: '100004', name: 'OPay' },
  { code: '090405', name: 'Moniepoint MFB' },
  { code: '100033', name: 'PalmPay' },
  { code: '090267', name: 'Kuda Bank' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '232', name: 'Sterling Bank' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '030', name: 'Heritage Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '050', name: 'Ecobank' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '101', name: 'Providus Bank' },
  { code: '305', name: 'Union Bank' }
];


const getRiskClass = (risk: 'Low' | 'Medium' | 'High' | 'Emergency') => {
  return risk.toLowerCase();
};

interface ClinicianNcdDashboardProps {
  orders: NcdRefillOrder[];
  onUpdateOrderStatus: (orderId: string, status: NcdRefillOrder['status']) => void;
  patients: PatientNcdProfile[];
  clinics: NcdClinic[];
  pharmacies: NcdPharmacy[];
  userRole?: 'doctor' | 'pharmacist' | null;
  facilityId?: string | null;
  onUpdatePharmacyPrices?: (pharmacyId: string, prices: { [medId: string]: number }) => void;
  onUpdateClinic?: (updated: NcdClinic) => void;
  onUpdatePharmacy?: (updated: NcdPharmacy) => void;
  facilityUserRole?: 'admin' | 'staff';
  onRefreshData?: () => void;
}

const pitchSlides = [
  {
    title: "DiaBP-Copilot",
    subtitle: "Reimagining Chronic Disease Care in Nigeria & Beyond",
    bullets: [
      "📢 Connecting Clinicians, Community Pharmacies, and Patients",
      "🤖 Driven by WhatsApp AI bot and computer-vision diagnostics",
      "🌐 Custom branded deployment at diabpcopilot.com"
    ]
  },
  {
    title: "The Silent Epidemic",
    subtitle: "Nigeria's NCD Challenge",
    bullets: [
      "💔 Hypertension & Diabetes cause millions of avoidable strokes & amputations.",
      "📉 Patient adherence is low (<35%) due to complex tracking requirements.",
      "⚠️ Facilities lack continuous home patient data, resulting in reactive emergency care."
    ]
  },
  {
    title: "The Solution: DiaBP-Copilot",
    subtitle: "A Zero-Barrier Connected Care Loop",
    bullets: [
      "📲 WhatsApp Bot: Patients log readings & request refills on their existing messaging app.",
      "🥼 Clinician Dashboard: Real-time patient triage queues & AI foot scan alerts.",
      "💊 Pharmacy network: Automated monthly drug refill fulfillment with split payments."
    ]
  },
  {
    title: "Zero-Install WhatsApp Assistant",
    subtitle: "Engaging patients where they already are",
    bullets: [
      "💬 98% of patients already use WhatsApp daily. No app download is required.",
      "⚡ Self-onboard in 60 seconds by texting 'join bet-sense' to +1 415 523 8886.",
      "📈 Automated nudge schedules check in on patients when they forget to track."
    ]
  },
  {
    title: "Clinician Workspace",
    subtitle: "Real-time oversight with less admin overhead",
    bullets: [
      "🚨 Automated Triage: Priority queue flags patients with critical blood pressure/glucose.",
      "📝 Care Team Notice Board: Shift-to-shift handover notes prevent critical errors.",
      "👥 Roster Management: Invite doctors, nurses, and staff with secure role limitations."
    ]
  },
  {
    title: "SafeMeds Refills",
    subtitle: "Securing medication adherence & predictable revenue",
    bullets: [
      "🔄 Subscription-based tracking automatically calculates drug depletion cycles.",
      "💳 Refill Quotes: Patients approve monthly quotes directly inside WhatsApp.",
      "📦 Community dispatch: Fulfillments routed directly to community pharmacies."
    ]
  },
  {
    title: "AI Diabetic Foot Screening",
    subtitle: "Early neuropathy detection preventing amputations",
    bullets: [
      "📸 Patients upload foot sole photos via WhatsApp or dashboard camera.",
      "🔬 AI Hotspot Detection: Screens image for high-friction zones and early ulcer risk.",
      "🥼 Auto-Flagging: Instantly alerts the clinic to schedule podiatry consults."
    ]
  },
  {
    title: "Instant Split Payouts",
    subtitle: "Sustainable monetization for health partners",
    bullets: [
      "💳 Integrated Paystack/Flutterwave billing rails.",
      "⚡ Instant Splits: 95% of customer subscription/drug fees sent straight to your bank.",
      "🔒 5% Platform Fee: Covers automated SMS bundles, hosting, and AI compute."
    ]
  },
  {
    title: "Branding & PWA Capabilities",
    subtitle: "Enterprise-grade presentation",
    bullets: [
      "🏷️ White-Labeled: Fully branded on custom domain diabpcopilot.com.",
      "📱 Progressive Web App: Installable on Home Screen for Android & iOS.",
      "🔌 Offline Synchronization: Access database and log consults without internet."
    ]
  },
  {
    title: "Transform Your Facility",
    subtitle: "Launch in under 60 seconds",
    bullets: [
      "🏥 Setup your clinic/pharmacy on diabpcopilot.com.",
      "📈 Improve patient retention, increase revenue, and prevent NCD complications.",
      "🚀 Contact: support@diabpcopilot.com | Start today."
    ]
  }
];

export const ClinicianNcdDashboard: React.FC<ClinicianNcdDashboardProps> = ({ 
  orders, 
  onUpdateOrderStatus, 
  patients,
  clinics,
  pharmacies,
  userRole,
  facilityId,
  onUpdatePharmacyPrices,
  onUpdateClinic,
  onUpdatePharmacy,
  facilityUserRole = 'admin',
  onRefreshData
}) => {
  // Multi-Tenant Simulator State
  const [activeRole, setActiveRole] = useState<'clinic' | 'pharmacy'>(
    userRole === 'pharmacist' ? 'pharmacy' : 'clinic'
  );
  const [workspaceRole, setWorkspaceRole] = useState<'admin' | 'staff'>(
    userRole && facilityUserRole === 'staff' ? 'staff' : 'admin'
  );
  const [activeClinicId, setActiveClinicId] = useState<string | null>(
    userRole === 'doctor' && facilityId ? facilityId : (clinics[0]?.id || null)
  );
  const [activePharmacyId, setActivePharmacyId] = useState<string | null>(
    userRole === 'pharmacist' && facilityId ? facilityId : (pharmacies[0]?.id || null)
  );

  const activeClinic = clinics.find(c => c.id === activeClinicId);
  const activePharmacy = pharmacies.find(p => p.id === activePharmacyId);

  // Sync state if user logs in/changes facility dynamically
  useEffect(() => {
    if (userRole === 'doctor' && facilityId) {
      setActiveRole('clinic');
      setActiveClinicId(facilityId);
    } else if (userRole === 'pharmacist' && facilityId) {
      setActiveRole('pharmacy');
      setActivePharmacyId(facilityId);
    }
  }, [userRole, facilityId]);

  // Sync workspace role when facilityUserRole changes from App session
  useEffect(() => {
    if (userRole) {
      setWorkspaceRole(facilityUserRole === 'staff' ? 'staff' : 'admin');
    }
  }, [facilityUserRole, userRole]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientNcdProfile | null>(null);
  const [viewingPrescriptionOrder, setViewingPrescriptionOrder] = useState<NcdRefillOrder | null>(null);
  
  // Care Notes State (Shared Workspace Notice & Handover Memos)
  const [careNotes, setCareNotes] = useState<{ id: string; author: string; content: string; createdAt: string }[]>([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('Care Member');

  const currentFacilityId = activeRole === 'clinic' ? activeClinicId : activePharmacyId;

  // Load facility notice board notes
  useEffect(() => {
    if (!currentFacilityId) return;
    const stored = localStorage.getItem(`diabp_care_notes_${currentFacilityId}`);
    if (stored) {
      setCareNotes(JSON.parse(stored));
    } else {
      const defaults = [
        {
          id: 'default-1',
          author: 'System Care Coordinator',
          content: 'Welcome to your Care Team Handover & Notice Board. Use this space to log patient status updates, shift changes, or inventory notes.',
          createdAt: new Date().toISOString()
        }
      ];
      setCareNotes(defaults);
      localStorage.setItem(`diabp_care_notes_${currentFacilityId}`, JSON.stringify(defaults));
    }
  }, [currentFacilityId]);

  // Load current authenticated user info
  useEffect(() => {
    async function fetchUser() {
      if (isSupabaseConfigured) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user?.email) setCurrentUserEmail(user.email);
        } catch {}
      } else {
        try {
          const stored = localStorage.getItem('amphy_mock_session');
          if (stored) {
            const session = JSON.parse(stored);
            if (session?.user?.email) setCurrentUserEmail(session.user.email);
          }
        } catch {}
      }
    }
    fetchUser();
  }, []);

  const handleAddCareNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteText.trim() || !currentFacilityId) return;

    const newNote = {
      id: `note-${Date.now()}`,
      author: currentUserEmail,
      content: newNoteText.trim(),
      createdAt: new Date().toISOString()
    };

    const updated = [newNote, ...careNotes];
    setCareNotes(updated);
    localStorage.setItem(`diabp_care_notes_${currentFacilityId}`, JSON.stringify(updated));
    setNewNoteText('');
  };

  const handleDeleteCareNote = (noteId: string) => {
    if (!currentFacilityId) return;
    const updated = careNotes.filter(n => n.id !== noteId);
    setCareNotes(updated);
    localStorage.setItem(`diabp_care_notes_${currentFacilityId}`, JSON.stringify(updated));
  };
  
  // Check-in / BP Log Modal States
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [checkInPatient, setCheckInPatient] = useState<PatientNcdProfile | null>(null);
  const [checkInBpSystolic, setCheckInBpSystolic] = useState<number>(120);
  const [checkInBpDiastolic, setCheckInBpDiastolic] = useState<number>(80);
  const [checkInGlucose, setCheckInGlucose] = useState<number>(0);
  const [checkInGlucoseType, setCheckInGlucoseType] = useState<'Fasting' | 'Post-Meal'>('Fasting');
  const [sendWhatsAppChecked, setSendWhatsAppChecked] = useState(true);
  const [generatedWhatsAppUrl, setGeneratedWhatsAppUrl] = useState<string | null>(null);
  const [checkInSaving, setCheckInSaving] = useState(false);

  const handleOpenCheckIn = (patient: PatientNcdProfile) => {
    const bpArr = patient.bpHistory || [];
    const latestBp = bpArr.length > 0 ? bpArr[bpArr.length - 1] : { systolic: 120, diastolic: 80 };
    const glucoseArr = patient.glucoseHistory || [];
    const latestGlucose = glucoseArr.length > 0 ? glucoseArr[glucoseArr.length - 1] : { level: 0, type: 'Fasting' };

    setCheckInPatient(patient);
    setCheckInBpSystolic(latestBp.systolic);
    setCheckInBpDiastolic(latestBp.diastolic);
    setCheckInGlucose(latestGlucose.level);
    setCheckInGlucoseType(latestGlucose.type as 'Fasting' | 'Post-Meal');
    setSendWhatsAppChecked(true);
    setGeneratedWhatsAppUrl(null);
    setShowCheckInModal(true);
  };
  const [editingPrices, setEditingPrices] = useState(false);
  const [tempPrices, setTempPrices] = useState<{ [medId: string]: number }>({});

  // B2B Facility Upgrade states
  const [facilityUpgradeModalOpen, setFacilityUpgradeModalOpen] = useState(false);
  const [upgradeTarget, setUpgradeTarget] = useState<'clinic' | 'pharmacy'>('clinic');
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [paymentStep, setPaymentStep] = useState<'form' | 'processing' | 'success'>('form');
  const [paymentError, setPaymentError] = useState('');

  // Payout / Subaccount states
  const [editingPayout, setEditingPayout] = useState(false);
  const [tempSubaccountId, setTempSubaccountId] = useState('');
  const [payoutTab, setPayoutTab] = useState<'manual' | 'automatic'>('automatic');
  const [bankCode, setBankCode] = useState('044');
  const [accountNumber, setAccountNumber] = useState('');
  const [payoutEmail, setPayoutEmail] = useState('');
  const [isCreatingSubaccount, setIsCreatingSubaccount] = useState(false);
  const [createSubaccountError, setCreateSubaccountError] = useState('');
  const [createSubaccountSuccess, setCreateSubaccountSuccess] = useState('');
  const [resolvedAccountName, setResolvedAccountName] = useState('');
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);

  // Care Team & Staff states
  const [staffList, setStaffList] = useState<FacilityStaffMember[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [addingStaff, setAddingStaff] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [staffFullName, setStaffFullName] = useState('');
  const [staffRole, setStaffRole] = useState('Staff');
  const [staffError, setStaffError] = useState('');
  const [staffSuccess, setStaffSuccess] = useState('');
  const [collapsedStaffPanel, setCollapsedStaffPanel] = useState(true);
  const [collapsedNoticeBoard, setCollapsedNoticeBoard] = useState(true);

  // Onboarding guide state
  const [collapsedOnboarding, setCollapsedOnboarding] = useState<boolean>(() => {
    const saved = localStorage.getItem('clinician_onboarding_collapsed');
    if (saved !== null) {
      return saved === 'true';
    }
    return false; // Default to open initially
  });

  const toggleOnboarding = () => {
    setCollapsedOnboarding(prev => {
      localStorage.setItem('clinician_onboarding_collapsed', (!prev).toString());
      return !prev;
    });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Set default staff role when activeRole changes
  useEffect(() => {
    setStaffRole(activeRole === 'clinic' ? 'Doctor' : 'Staff');
  }, [activeRole]);

  // Load facility staff list
  const refreshStaffList = async () => {
    const facilityId = activeRole === 'clinic' ? activeClinicId : activePharmacyId;
    if (!facilityId) return;
    setIsLoadingStaff(true);
    try {
      const list = await getFacilityStaff(facilityId, activeRole);
      setStaffList(list);
    } catch (err) {
      console.error("Failed to load facility staff list:", err);
    } finally {
      setIsLoadingStaff(false);
    }
  };

  useEffect(() => {
    refreshStaffList();
  }, [activeClinicId, activePharmacyId, activeRole]);

  const handleAddStaffMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffEmail.trim() || !staffPassword.trim() || !staffFullName.trim()) {
      setStaffError("Please fill out all fields.");
      return;
    }
    setStaffError('');
    setStaffSuccess('');
    const facilityId = activeRole === 'clinic' ? activeClinicId : activePharmacyId;
    if (!facilityId) {
      setStaffError("No active facility selected.");
      return;
    }
    
    try {
      await addFacilityStaff(
        staffEmail.trim(),
        staffPassword.trim(),
        staffFullName.trim(),
        staffRole,
        facilityId,
        activeRole
      );
      setStaffSuccess(`Staff member registered successfully!`);
      // Reset form
      setStaffEmail('');
      setStaffPassword('');
      setStaffFullName('');
      refreshStaffList();
      setTimeout(() => {
        setAddingStaff(false);
        setStaffSuccess('');
      }, 2000);
    } catch (err: any) {
      setStaffError(err.message || "Failed to add staff member.");
    }
  };

  const handleUpgradeFacility = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingName || !billingEmail) {
      setPaymentError("Please enter your billing name and email.");
      return;
    }
    setPaymentError("");
    setPaymentStep('processing');

    const amount = upgradeTarget === 'clinic' 
      ? (selectedPlan === 'monthly' ? 25000 : 250000) 
      : (selectedPlan === 'monthly' ? 15000 : 150000);

    const activeFacilityId = upgradeTarget === 'clinic' ? activeClinicId : activePharmacyId;
    const txRef = `flw-facility-${upgradeTarget}-${activeFacilityId}-${Date.now()}`;

    if (!(window as any).FlutterwaveCheckout) {
      setPaymentError("Payment gateway is loading. Please try again in a few seconds.");
      setPaymentStep('form');
      return;
    }

    (window as any).FlutterwaveCheckout({
      public_key: "FLWPUBK-e2deff3114e81d12bb4f07dbad8b9558-X",
      tx_ref: txRef,
      amount: amount,
      currency: "NGN",
      payment_options: "card, banktransfer, ussd, account",
      customer: {
        email: billingEmail,
        name: billingName,
      },
      customizations: {
        title: "DiaBP Pay",
        description: `Upgrade to Premium ${upgradeTarget === 'clinic' ? 'Clinic' : 'Pharmacy'} Plan`,
      },
      meta: {
        facility_type: upgradeTarget,
        facility_id: activeFacilityId,
        plan: selectedPlan
      },
      callback: async function (response: any) {
        console.log("Flutterwave Response:", response);
        if (response.status === "successful" || response.status === "completed") {
          setPaymentStep('success');

          const expiryDate = new Date();
          if (selectedPlan === 'monthly') {
            expiryDate.setMonth(expiryDate.getMonth() + 1);
          } else {
            expiryDate.setFullYear(expiryDate.getFullYear() + 1);
          }

          if (upgradeTarget === 'clinic') {
            const activeClinic = clinics.find(c => c.id === activeClinicId);
            if (activeClinic && onUpdateClinic) {
              await onUpdateClinic({
                ...activeClinic,
                isPremium: true,
                premiumExpiry: expiryDate.toLocaleDateString()
              });
            }
          } else {
            const activePharmacy = pharmacies.find(p => p.id === activePharmacyId);
            if (activePharmacy && onUpdatePharmacy) {
              await onUpdatePharmacy({
                ...activePharmacy,
                isPremium: true,
                premiumExpiry: expiryDate.toLocaleDateString()
              });
            }
          }

          setTimeout(() => {
            setFacilityUpgradeModalOpen(false);
            setPaymentStep('form');
            setBillingName('');
            setBillingEmail('');
          }, 2000);
        } else {
          setPaymentError("Payment was not successful. Please try again.");
          setPaymentStep('form');
        }
      },
      onclose: function () {
        setPaymentStep('form');
      }
    });
  };

  // Load current subaccount ID when opening payout modal
  useEffect(() => {
    if (editingPayout) {
      setCreateSubaccountError('');
      setCreateSubaccountSuccess('');
      setAccountNumber('');
      setResolvedAccountName('');
      
      const activeFacilityName = activeRole === 'clinic' ? activeClinic?.name : activePharmacy?.name;
      const defaultEmail = activeFacilityName 
        ? `${activeFacilityName.toLowerCase().replace(/[^a-z0-9]/g, '')}@diabp-partner.com` 
        : 'billing@diabp.com';
      setPayoutEmail(defaultEmail);

      const dbSubaccountId = activeRole === 'clinic' ? activeClinic?.subaccountId : activePharmacy?.subaccountId;
      if (dbSubaccountId) {
        const parts = dbSubaccountId.split('|||');
        setTempSubaccountId(parts[0]);
        if (parts[1] && parts[2]) {
          const matchedBank = NIGERIAN_BANKS.find(b => b.name === parts[1]);
          if (matchedBank) setBankCode(matchedBank.code);
          setAccountNumber(parts[2]);
        }
        if (parts[3]) {
          setPayoutEmail(parts[3]);
        }
      } else {
        setTempSubaccountId('');
      }
    }
  }, [editingPayout, activeRole, activeClinicId, activePharmacyId, clinics, pharmacies, activeClinic, activePharmacy]);

  // Account name verification side effect
  useEffect(() => {
    const resolveAccountName = async () => {
      if (accountNumber.length !== 10) {
        setResolvedAccountName('');
        return;
      }

      setIsResolvingAccount(true);
      setResolvedAccountName('');
      setCreateSubaccountError('');

      try {
        if (isSupabaseConfigured) {
          const { data, error } = await supabase.functions.invoke('create-subaccount', {
            body: {
              action: 'resolve',
              account_bank: bankCode,
              account_number: accountNumber
            }
          });

          if (error) throw new Error(error.message);
          
          if (data?.status === 'error' || data?.error) {
            throw new Error(data.message || data.error || 'Failed to verify account number.');
          }

          if (data?.data?.account_name) {
            setResolvedAccountName(data.data.account_name);
          } else {
            throw new Error('Account name could not be resolved.');
          }
        } else {
          // Mock verification for local playground testing
          await new Promise(resolve => setTimeout(resolve, 800));
          const matchedBank = NIGERIAN_BANKS.find(b => b.code === bankCode);
          setResolvedAccountName(`MOCK:${(activeRole === 'clinic' ? activeClinic?.name : activePharmacy?.name) || 'FACILITY SOLUTIONS'} LTD (${matchedBank?.name})`);
        }
      } catch (err: any) {
        setCreateSubaccountError(err.message || 'Could not verify account details with bank.');
      } finally {
        setIsResolvingAccount(false);
      }
    };

    resolveAccountName();
  }, [accountNumber, bankCode, isSupabaseConfigured, activeRole, activeClinic, activePharmacy]);

  const handleCreateSubaccount = async () => {
    if (!accountNumber || accountNumber.length < 10) {
      setCreateSubaccountError("Please enter a valid 10-digit account number.");
      return;
    }

    setIsCreatingSubaccount(true);
    setCreateSubaccountError('');
    setCreateSubaccountSuccess('');

    const facilityName = activeRole === 'clinic' ? activeClinic?.name : activePharmacy?.name;
    const businessName = facilityName || (activeRole === 'clinic' ? 'DiaBP Clinic' : 'DiaBP Pharmacy');
    const email = payoutEmail.trim() || 'billing@diabp.com';

    try {
      let resultSubaccountId = '';

      if (isSupabaseConfigured) {
        const { data, error } = await supabase.functions.invoke('create-subaccount', {
          body: {
            account_bank: bankCode,
            account_number: accountNumber,
            business_name: businessName,
            business_email: email
          }
        });

        if (error) {
          throw new Error(error.message || 'Failed to communicate with subaccount creation service.');
        }

        if (data?.status === 'error' || data?.error) {
          throw new Error(data.message || data.error || 'Flutterwave subaccount creation failed.');
        }

        if (!data?.data?.subaccount_id) {
          throw new Error('No subaccount ID returned from registration.');
        }

        resultSubaccountId = data.data.subaccount_id;
      } else {
        // Mock subaccount creation for local playground testing
        await new Promise(resolve => setTimeout(resolve, 1500));
        resultSubaccountId = `RS_MOCK_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      }

      const matchedBank = NIGERIAN_BANKS.find(b => b.code === bankCode);
      const bankName = matchedBank ? matchedBank.name : 'Unknown Bank';
      const serializedValue = `${resultSubaccountId}|||${bankName}|||${accountNumber}|||${email}`;

      setTempSubaccountId(resultSubaccountId);
      setCreateSubaccountSuccess(`Success! Registered Subaccount ID: ${resultSubaccountId}`);
      
      // Save it to database immediately
      if (activeRole === 'clinic') {
        if (activeClinic && onUpdateClinic) {
          await onUpdateClinic({
            ...activeClinic,
            subaccountId: serializedValue
          });
        }
      } else {
        if (activePharmacy && onUpdatePharmacy) {
          await onUpdatePharmacy({
            ...activePharmacy,
            subaccountId: serializedValue
          });
        }
      }
    } catch (err: any) {
      setCreateSubaccountError(err.message || 'An error occurred during subaccount generation.');
    } finally {
      setIsCreatingSubaccount(false);
    }
  };

  const handleSavePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let valueToSave = tempSubaccountId.trim() || undefined;
    if (valueToSave && payoutTab === 'automatic' && accountNumber) {
      const matchedBank = NIGERIAN_BANKS.find(b => b.code === bankCode);
      const bankName = matchedBank ? matchedBank.name : 'Unknown Bank';
      const email = payoutEmail.trim() || 'billing@diabp.com';
      valueToSave = `${valueToSave}|||${bankName}|||${accountNumber}|||${email}`;
    }

    if (activeRole === 'clinic') {
      if (activeClinic && onUpdateClinic) {
        await onUpdateClinic({
          ...activeClinic,
          subaccountId: valueToSave
        });
      }
    } else {
      if (activePharmacy && onUpdatePharmacy) {
        await onUpdatePharmacy({
          ...activePharmacy,
          subaccountId: valueToSave
        });
      }
    }
    setEditingPayout(false);
  };

  // Collapsible cards state
  const [collapsedAlertsLog, setCollapsedAlertsLog] = useState(false);
  const [collapsedTriageQueue, setCollapsedTriageQueue] = useState(false);
  const [collapsedPatientVitals, setCollapsedPatientVitals] = useState(false);
  const [collapsedPatientAdherence, setCollapsedPatientAdherence] = useState(false);
  const [collapsedTitration, setCollapsedTitration] = useState(false);
  const [collapsedDispensingAudit, setCollapsedDispensingAudit] = useState(false);
  
  // Data Directory / Export Modal state
  const [exportPatient, setExportPatient] = useState<PatientNcdProfile | null>(null);
  const [exportTab, setExportTab] = useState<'vitals' | 'scans' | 'orders' | 'json'>('vitals');

  // Master clinical directory search/filter states
  const [directorySearch, setDirectorySearch] = useState('');
  const [directoryType, setDirectoryType] = useState<'all' | 'vitals' | 'scans' | 'orders'>('all');
  const [collapsedMasterDirectory, setCollapsedMasterDirectory] = useState(true); // Default collapsed

  // Pharmacist Checklist State
  const [checklist, setChecklist] = useState({
    rxVerified: false,
    nafdacAudit: false,
    vitalsAudit: false,
    identityVerified: false,
    bundlePackaged: false
  });

  // Reset checklist when patient changes
  useEffect(() => {
    setChecklist({
      rxVerified: false,
      nafdacAudit: false,
      vitalsAudit: false,
      identityVerified: false,
      bundlePackaged: false
    });
  }, [selectedPatient]);

  // Load current prices for active pharmacy into temp editing state
  useEffect(() => {
    if (editingPrices && activePharmacy) {
      setTempPrices(activePharmacy.prices || {});
    }
  }, [editingPrices, activePharmacyId, pharmacies, activePharmacy]);

  // System Alerts state & Automation Toggle
  const [alerts, setAlerts] = useState<NcdAlert[]>([]);
  const [autoRefillEnabled, setAutoRefillEnabled] = useState<boolean>(
    localStorage.getItem('diabp_auto_refill_automation') !== 'false'
  );
  const [refillTab, setRefillTab] = useState<'pending' | 'ready' | 'completed'>('pending');

  const refreshAlerts = async () => {
    const activeId = activeRole === 'clinic' ? activeClinicId : activePharmacyId;
    const updated = await getSystemAlerts(activeId, activeRole);
    setAlerts(updated);
  };

  useEffect(() => {
    refreshAlerts();
    const interval = setInterval(() => {
      refreshAlerts();
    }, 10000);
    return () => clearInterval(interval);
  }, [patients, orders, activeClinicId, activePharmacyId, activeRole]);

  const handleToggleAutoRefill = (val: boolean) => {
    setAutoRefillEnabled(val);
    localStorage.setItem('diabp_auto_refill_automation', String(val));
  };

  // Auditor form states (linked to selected patient when opened)
  const [auditAge, setAuditAge] = useState<number>(50);
  const [auditWeight, setAuditWeight] = useState<number>(80);
  const [auditSystolic, setAuditSystolic] = useState<number>(130);
  const [auditDiastolic, setAuditDiastolic] = useState<number>(80);
  const [auditGlucose, setAuditGlucose] = useState<number>(110);
  const [auditGlucoseType, setAuditGlucoseType] = useState<'Fasting' | 'Post-Meal'>('Fasting');
  const [patientMeds, setPatientMeds] = useState<string[]>([]);

  // Filter Patients mapped to the active provider
  const filteredPatients = patients.filter(p => {
    if (activeRole === 'clinic') {
      return p.assignedClinicId === activeClinicId;
    } else {
      return p.assignedPharmacyId === activePharmacyId;
    }
  });

  // Apply search filtering
  const searchedPatients = filteredPatients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter Refill Orders
  const filteredOrders = activeRole === 'pharmacy'
    ? orders.filter(o => o.pharmacyId === activePharmacyId)
    : orders.filter(o => {
        // Clinics see orders of patients assigned to them
        const orderPatient = patients.find(p => p.id === o.patientId);
        return orderPatient?.assignedClinicId === activeClinicId;
      });

  const pendingOrders = filteredOrders.filter(o => o.status === 'Pending Verification');
  const readyOrders = filteredOrders.filter(o => o.status === 'Approved');
  const completedOrders = filteredOrders.filter(o => o.status === 'Out for Delivery' || o.status === 'Delivered');

  const activeTabOrders = refillTab === 'pending'
    ? pendingOrders
    : refillTab === 'ready'
    ? readyOrders
    : completedOrders;

  const handleOpenPatientFile = (patient: PatientNcdProfile) => {
    setSelectedPatient(patient);
    
    // Pre-populate AI dosage auditor with patient values
    setAuditAge(patient.age);
    setAuditWeight(patient.weight);
    setPatientMeds([...(patient.activeMeds || [])]);
    
    const bpArr = patient.bpHistory || [];
    const latestBp = bpArr.length > 0 ? bpArr[bpArr.length - 1] : { systolic: 120, diastolic: 80 };
    setAuditSystolic(latestBp.systolic);
    setAuditDiastolic(latestBp.diastolic);
    
    const glucoseArr = patient.glucoseHistory || [];
    const latestGlucose = glucoseArr.length > 0 ? glucoseArr[glucoseArr.length - 1] : { level: 100, type: 'Fasting' as any };
    setAuditGlucose(latestGlucose.level);
    setAuditGlucoseType(latestGlucose.type);
  };

  const handleNudge = async (patientName: string, issue: string) => {
    alert(`WhatsApp Nudge Sent!\nTo: ${patientName}\nMessage: "Good day from your care team. We noticed your ${issue}. Please inspect your feet, log readings, and consult your pharmacist."`);
    // Auto-dismiss critical & info alerts for this patient
    const patient = patients.find(p => p.name === patientName);
    if (patient) {
      try {
        await dismissAlertsForPatient(patient.id, 'critical');
        await dismissAlertsForPatient(patient.id, 'info');
        await refreshAlerts();
      } catch (err) {
        console.error("Failed to auto-dismiss alerts on nudge:", err);
      }
    }
  };

  const handleUpdateStatusAndClearAlert = async (orderId: string, status: NcdRefillOrder['status'], finalPrice?: number) => {
    onUpdateOrderStatus(orderId, status, finalPrice);
    
    // Auto-dismiss warning alerts if approved or delivered
    if (status === 'Approved' || status === 'Delivered') {
      const order = orders.find(o => o.id === orderId);
      if (order?.patientId) {
        try {
          await dismissAlertsForPatient(order.patientId, 'warning');
          await refreshAlerts();
        } catch (err) {
          console.error("Failed to auto-dismiss alerts on status update:", err);
        }
      }
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      await dismissSystemAlert(alertId);
      await refreshAlerts();
    } catch (err) {
      console.error("Failed to dismiss alert:", err);
    }
  };

  const handleToggleMed = (medName: string) => {
    if (patientMeds.includes(medName)) {
      setPatientMeds(patientMeds.filter(m => m !== medName));
    } else {
      setPatientMeds([...patientMeds, medName]);
    }
  };

  const activeAuditResults = auditNcdRegimen(
    auditAge,
    auditWeight,
    auditSystolic,
    auditDiastolic,
    auditGlucose,
    auditGlucoseType,
    patientMeds
  );

  const triagePatients = filteredPatients.filter(p => {
    const hasCriticalAlert = alerts.some(a => a.patientId === p.id && a.type === 'critical');
    const bpArr = p.bpHistory || [];
    const latestBp = bpArr.length > 0 ? bpArr[bpArr.length - 1] : { systolic: 120, diastolic: 80 };
    const glucoseArr = p.glucoseHistory || [];
    const latestGlucose = glucoseArr.length > 0 ? glucoseArr[glucoseArr.length - 1] : { level: 100, type: 'Fasting' };
    const { strokeRisk, diabeticRisk } = evaluateNcdRisk(
      latestBp.systolic,
      latestBp.diastolic,
      latestGlucose.level,
      latestGlucose.type as any
    );
    return hasCriticalAlert || strokeRisk === 'High' || strokeRisk === 'Emergency' || diabeticRisk === 'High' || diabeticRisk === 'Emergency';
  });

  const isFacilityPremium = activeRole === 'clinic' 
    ? (activeClinic?.isPremium || false) 
    : (activePharmacy?.isPremium || false);

  const completedOrdersList = filteredOrders.filter(o => o.status === 'Delivered' || o.status === 'Out for Delivery');
  const totalRevenue = completedOrdersList.reduce((acc, curr) => acc + (curr.totalNaira || 0), 0);
  const activePatientsCount = filteredPatients.length;
  const commissionRate = (() => {
    const stored = localStorage.getItem('diabp_system_commission_rate');
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) return parsed;
    }
    return 0.05;
  })();

  return (
    <div className="space-y-6 animate-fade-in" style={{ paddingBottom: '30px' }}>
      
      {/* 1. Tenant Switcher Simulation Panel */}
      <div className="glass-panel" style={{ padding: '16px', background: 'rgba(20, 20, 20, 0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRight className="w-4 h-4 text-blue-400" /> {!userRole ? 'Multi-Tenant Role Switcher (Audit Simulator)' : 'Authenticated Care Team Bind'}
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {!userRole 
                ? 'Select a clinical facility or pharmacy to inspect routed data. Only assigned providers can view records.'
                : `Secured tenant stream active. Showing database records isolated for your facility.`
              }
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {!userRole ? (
              <>
                <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <button
                    onClick={() => {
                      setActiveRole('clinic');
                      setSelectedPatient(null);
                    }}
                    style={{ padding: '8px 12px', fontSize: '0.7rem', border: 'none', background: activeRole === 'clinic' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: activeRole === 'clinic' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Clinic / Doctor
                  </button>
                  <button
                    onClick={() => {
                      setActiveRole('pharmacy');
                      setSelectedPatient(null);
                    }}
                    style={{ padding: '8px 12px', fontSize: '0.7rem', border: 'none', background: activeRole === 'pharmacy' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: activeRole === 'pharmacy' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Pharmacy
                  </button>
                </div>

                {activeRole === 'clinic' ? (
                  <select
                    value={activeClinicId || ''}
                    onChange={(e) => {
                      setActiveClinicId(e.target.value);
                      setSelectedPatient(null);
                    }}
                    style={{ background: '#1c1c1e', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', fontSize: '0.7rem' }}
                  >
                    {clinics.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.city})</option>
                    ))}
                  </select>
                ) : (
                  <select
                    value={activePharmacyId || ''}
                    onChange={(e) => {
                      setActivePharmacyId(e.target.value);
                      setSelectedPatient(null);
                    }}
                    style={{ background: '#1c1c1e', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', fontSize: '0.7rem' }}
                  >
                    {pharmacies.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.city})</option>
                    ))}
                  </select>
                )}
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(20, 184, 166, 0.12)', border: '1px solid rgba(20, 184, 166, 0.25)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--color-teal-light)', fontWeight: 'bold' }}>
                <ShieldCheck size={14} />
                <span>
                  Facility: {activeRole === 'clinic' 
                    ? (clinics.find(c => c.id === activeClinicId)?.name || 'Abuja Care Center') 
                    : (pharmacies.find(p => p.id === activePharmacyId)?.name || 'Net Pharmacy')
                  }
                </span>
              </div>
            )}

            {/* Facility Workspace Role Selector */}
            {(!userRole || facilityUserRole === 'admin') ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 10px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', fontSize: '0.75rem', color: 'white', fontWeight: 'bold' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Workspace Role:</span>
                <select
                  value={workspaceRole}
                  onChange={(e) => setWorkspaceRole(e.target.value as 'admin' | 'staff')}
                  style={{ background: '#1c1c1e', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  <option value="admin">Owner/Admin</option>
                  <option value="staff">Staff/Dispenser</option>
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                <span>Workspace Role: Staff/Dispenser</span>
              </div>
            )}
            
            {workspaceRole === 'admin' && activeRole === 'pharmacy' && (
              <button
                type="button"
                onClick={() => {
                  if (!isFacilityPremium) {
                    setUpgradeTarget('pharmacy');
                    setFacilityUpgradeModalOpen(true);
                  } else {
                    setEditingPrices(true);
                  }
                }}
                style={{
                  background: isFacilityPremium ? 'rgba(20, 184, 166, 0.15)' : 'rgba(255,255,255,0.05)',
                  border: isFacilityPremium ? '1px solid var(--color-teal-light)' : '1px solid rgba(255,255,255,0.1)',
                  color: isFacilityPremium ? 'white' : 'var(--text-muted)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                {isFacilityPremium ? '⚙️ Manage Pricing' : '🔒 Manage Pricing (Premium)'}
              </button>
            )}

            {workspaceRole === 'admin' && !isFacilityPremium && (
              <button
                type="button"
                onClick={() => {
                  setUpgradeTarget(activeRole);
                  setFacilityUpgradeModalOpen(true);
                }}
                style={{
                  background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                  border: 'none',
                  color: 'black',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  boxShadow: '0 0 10px rgba(234, 179, 8, 0.2)'
                }}
              >
                👑 Upgrade Facility Plan
              </button>
            )}

            {workspaceRole === 'admin' && (
              <button
                type="button"
                onClick={() => setEditingPayout(true)}
                style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease'
                }}
              >
                💳 Payout Settings
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Facility Warning Banner */}
      {workspaceRole === 'admin' && !isFacilityPremium && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(234, 179, 8, 0.15) 0%, rgba(202, 138, 4, 0.05) 100%)',
          border: '1px solid rgba(234, 179, 8, 0.3)',
          borderRadius: '12px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '8px',
          textAlign: 'left'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>👑</span>
            <div style={{ textAlign: 'left' }}>
              <h5 style={{ margin: 0, fontSize: '0.8rem', color: '#eab308', fontWeight: 'bold' }}>
                Basic Facility Plan Active: {activeRole === 'clinic' ? (activeClinic?.name || 'this Clinic') : (activePharmacy?.name || 'this Pharmacy')}
              </h5>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {activeRole === 'clinic' 
                  ? 'Advanced diagnostics audit features (Global Master Logs auditing directories and CSV data exports) are locked.'
                  : 'Custom pricing catalog configurations and price adjustment overrides on customer orders are locked.'
                }
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setUpgradeTarget(activeRole);
              setFacilityUpgradeModalOpen(true);
            }}
            style={{
              background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
              border: 'none',
              color: 'black',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Upgrade Plan
          </button>
        </div>
      )}

      {/* Onboarding Quickstart Guide */}
      {(() => {
        const hasSubaccount = activeRole === 'clinic' ? !!activeClinic?.subaccountId : !!activePharmacy?.subaccountId;
        const hasOnboardedPatients = filteredPatients.length > 0;
        const hasVitalsCheckIn = filteredPatients.some(p => (p.bpHistory || []).length > 5 || (p.glucoseHistory || []).length > 5);
        const hasDrugPricing = !!activePharmacy?.prices && Object.keys(activePharmacy.prices).length > 0;
        const hasAddedStaff = staffList.length > 1;
        const hasRefillApproved = filteredOrders.some(o => o.status !== 'Pending Verification');

        const fullSteps = activeRole === 'pharmacy' ? [
          {
            id: 'payout',
            title: 'Link Payout Account',
            description: 'Set up your bank account details to receive direct payouts for processed medication orders.',
            instructions: 'Click "Configure Bank Payout" to select your bank, verify your account number, and link it.',
            isCompleted: hasSubaccount,
            actionLabel: 'Configure Bank Payout',
            actionClick: () => setEditingPayout(true)
          },
          {
            id: 'pricing',
            title: 'Set Medication Pricing',
            description: 'Customize drug prices for Metformin, Amlodipine, etc., to allow patients to purchase from your inventory.',
            instructions: 'Click "Manage Prices" to customize medication catalog pricing for your pharmacy.',
            isCompleted: hasDrugPricing,
            actionLabel: 'Manage Prices',
            actionClick: () => {
              if (!isFacilityPremium) {
                setUpgradeTarget('pharmacy');
                setFacilityUpgradeModalOpen(true);
              } else {
                setEditingPrices(true);
              }
            }
          },
          {
            id: 'patients',
            title: 'Onboard First Patient',
            description: 'Guide your customers to register. They can register online or self-onboard in under 1 minute via WhatsApp.',
            instructions: 'Instruct patients to register via the portal, or add them manually in the registry table below.',
            isCompleted: hasOnboardedPatients,
            actionLabel: 'View Patient Registry',
            actionClick: () => scrollToSection('patient-registry-table')
          },
          {
            id: 'fulfillment',
            title: 'Approve First Refill',
            description: 'Review patient prescription signature uploads and approve refills in your orders queue.',
            instructions: 'Go to the refills queue, audit the prescription sheet, and click "Verify & Approve".',
            isCompleted: hasRefillApproved,
            actionLabel: 'Go to Refills Queue',
            actionClick: () => scrollToSection('refills-queue-section')
          }
        ] : [
          {
            id: 'payout',
            title: 'Link Payout Account',
            description: 'Set up your bank account details to receive consultation fees or medication co-pays directly.',
            instructions: 'Click "Configure Bank Payout" to select your bank, verify your account number, and link it.',
            isCompleted: hasSubaccount,
            actionLabel: 'Configure Bank Payout',
            actionClick: () => setEditingPayout(true)
          },
          {
            id: 'staff',
            title: 'Add Roster Staff Accounts',
            description: 'Register nurses, front desk assistants, or junior physicians to help manage patient records.',
            instructions: 'Expand the Care Team & Staff Directory card below and input staff registration credentials.',
            isCompleted: hasAddedStaff,
            actionLabel: 'Manage Staff Directory',
            actionClick: () => {
              setCollapsedStaffPanel(false);
              setTimeout(() => scrollToSection('staff-directory-section'), 100);
            }
          },
          {
            id: 'patients',
            title: 'Register Patient Directory',
            description: 'Add your chronic clinic patients to the digital health ecosystem so they can be monitored.',
            instructions: 'Input their details during consults, or instruct patients to register via the portal or WhatsApp.',
            isCompleted: hasOnboardedPatients,
            actionLabel: 'View Patient Registry',
            actionClick: () => scrollToSection('patient-registry-table')
          },
          {
            id: 'vitals',
            title: 'Record Clinical Check-in',
            description: 'Log vital readings (BP, blood glucose) for a patient during an in-clinic medical consultation.',
            instructions: 'Click the check-in button next to any patient in the table to log their daily readings.',
            isCompleted: hasVitalsCheckIn,
            actionLabel: 'Record Check-in Vitals',
            actionClick: () => scrollToSection('patient-registry-table')
          }
        ];

        // Filter out admin-only setup tasks for staff dispenser roles
        const onboardingSteps = workspaceRole === 'admin' 
          ? fullSteps 
          : fullSteps.filter(s => s.id !== 'payout' && s.id !== 'pricing' && s.id !== 'staff');

        const completedSteps = onboardingSteps.filter(s => s.isCompleted).length;
        const onboardingProgress = Math.round((completedSteps / onboardingSteps.length) * 100);

        return (
          <div className="glass-panel" style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden',
            marginBottom: '16px'
          }}>
            {/* Glowing aura effect */}
            <div style={{
              position: 'absolute',
              top: '-40px',
              left: '-40px',
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              background: 'rgba(20, 184, 166, 0.12)',
              filter: 'blur(40px)',
              pointerEvents: 'none'
            }}></div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles className="w-5 h-5 text-teal-400 animate-pulse" />
                  {workspaceRole === 'admin' 
                    ? 'Quickstart Guide: Complete Your Facility Onboarding' 
                    : 'Quickstart Guide: Daily Clinic Operations Onboarding'}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {workspaceRole === 'admin' 
                    ? `Complete the following ${onboardingSteps.length} steps to verify your payouts, set catalog prices, and register patient care sheets.`
                    : `Complete the following ${onboardingSteps.length} steps to manage your patient registry, log vitals, and coordinate refills.`}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Progress: {completedSteps}/{onboardingSteps.length} Completed
                </span>
                <button
                  type="button"
                  onClick={toggleOnboarding}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  {collapsedOnboarding ? 'Expand Guide ▾' : 'Hide Guide ▴'}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.04)', borderRadius: '100px', overflow: 'hidden', marginBottom: collapsedOnboarding ? '0' : '20px' }}>
              <div style={{
                width: `${onboardingProgress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #14b8a6 0%, #3b82f6 100%)',
                borderRadius: '100px',
                boxShadow: '0 0 8px rgba(20, 184, 166, 0.4)',
                transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
              }}></div>
            </div>

            {!collapsedOnboarding && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {onboardingSteps.map((step, idx) => {
                  const IconComponent = step.id === 'payout' ? CreditCard : step.id === 'pricing' ? Calculator : step.id === 'patients' ? Users : step.id === 'fulfillment' ? ClipboardList : step.id === 'staff' ? Users : step.id === 'vitals' ? Activity : Sparkles;
                  return (
                    <div
                      key={step.id}
                      style={{
                        background: step.isCompleted ? 'rgba(20, 184, 166, 0.03)' : 'rgba(255,255,255,0.01)',
                        border: step.isCompleted ? '1px solid rgba(20, 184, 166, 0.15)' : '1px solid rgba(255, 255, 255, 0.04)',
                        borderRadius: '12px',
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        transition: 'all 0.3s ease',
                        position: 'relative'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: step.isCompleted ? 'rgba(20, 184, 166, 0.1)' : 'rgba(255,255,255,0.04)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: step.isCompleted ? '#14b8a6' : 'var(--text-secondary)'
                          }}>
                            <IconComponent size={16} />
                          </div>
                          {step.isCompleted ? (
                            <CheckCircle size={18} className="text-teal-400" style={{ fill: 'rgba(20, 184, 166, 0.1)' }} />
                          ) : (
                            <div style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              border: '2px solid rgba(255,255,255,0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '9px',
                              fontWeight: 'bold',
                              color: 'var(--text-secondary)'
                            }}>
                              {idx + 1}
                            </div>
                          )}
                        </div>

                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: 'white', fontWeight: 700 }}>
                          {step.title}
                        </h4>
                        <p style={{ margin: '0 0 8px 0', fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                          {step.description}
                        </p>
                        {!step.isCompleted && (
                          <p style={{ margin: '0 0 16px 0', fontSize: '0.68rem', color: 'var(--text-muted)', fontStyle: 'italic', lineHeight: '1.3' }}>
                            💡 {step.instructions}
                          </p>
                        )}
                      </div>

                      {step.isCompleted ? (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#14b8a6',
                          fontSize: '0.7rem',
                          fontWeight: 'bold',
                          padding: '6px 0'
                        }}>
                          ✓ Setup Completed
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={step.actionClick}
                          style={{
                            background: 'rgba(255, 255, 255, 0.06)',
                            color: 'white',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                            e.currentTarget.style.transform = 'none';
                          }}
                        >
                          {step.actionLabel} <ArrowRight size={12} className="text-teal-400" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* Facility Revenue Analytics Card */}
      {workspaceRole === 'admin' && (
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px', background: 'rgba(13, 17, 23, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'white', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CreditCard className="w-4 h-4 text-teal-400" />
          {activeRole === 'clinic' ? 'Clinic Financial & Patient Analytics' : 'Pharmacy Revenue & Fulfillment Analytics'}
        </h3>

        {workspaceRole === 'admin' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Refills Revenue</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--color-teal-light)', marginTop: '4px' }}>
                ₦{totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>Gross refills processed</div>
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Active Patients</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#eab308', marginTop: '4px' }}>
                {activePatientsCount}
              </div>
              <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '2px' }}>Currently assigned and managed</div>
            </div>
          </div>
        ) : (
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.01)', 
            border: '1px solid rgba(255,255,255,0.03)', 
            padding: '24px', 
            borderRadius: '12px', 
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}>
            <Lock className="w-8 h-8 text-red-400" style={{ opacity: 0.8 }} />
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#f87171', fontWeight: 'bold' }}>
              Financial Revenue Analytics Locked
            </h4>
            <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-secondary)', maxWidth: '380px' }}>
              Financial reporting, revenue analytics, and billing settlement details are only accessible to the Owner or designated Admin role. Contact your facility manager to adjust permissions.
            </p>
          </div>
        )}
      </div>
      )}

      {/* Triage & Automation Control Center */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '8px' }}>
        
        {/* Triage & Auto-Refill Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => setCollapsedTriageQueue(!collapsedTriageQueue)}>
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: '#f87171', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldAlert className="w-4 h-4 text-red-400 animate-pulse" /> Critical Triage Queue ({triagePatients.length})
            </h4>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
              {/* Auto-Refill Automation Switch */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: autoRefillEnabled ? 'var(--color-teal-light)' : 'var(--text-muted)' }}>
                  {autoRefillEnabled ? '🤖 Auto-Refill: ON' : '🤖 Auto-Refill: OFF'}
                </span>
                <input
                  type="checkbox"
                  checked={autoRefillEnabled}
                  onChange={(e) => handleToggleAutoRefill(e.target.checked)}
                  style={{ cursor: 'pointer', accentColor: 'var(--color-teal-light)' }}
                />
              </div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px' }}>
                {collapsedTriageQueue ? 'Expand ▾' : 'Collapse ▴'}
              </span>
            </div>
          </div>

          {!collapsedTriageQueue && (
            <>
              {triagePatients.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  ✓ All patient vitals are stable. No triage actions required.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto' }}>
                  {triagePatients.map(p => {
                    const bpArr = p.bpHistory || [];
                    const latestBp = bpArr.length > 0 ? bpArr[bpArr.length - 1] : { systolic: 120, diastolic: 80 };
                    return (
                      <div 
                        key={p.id}
                        onClick={() => handleOpenPatientFile(p)}
                        style={{ 
                          padding: '8px 10px', 
                          background: 'rgba(239, 68, 68, 0.05)', 
                          border: '1px solid rgba(239, 68, 68, 0.15)', 
                          borderRadius: '8px', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        className="triage-queue-item"
                      >
                        <div>
                          <div style={{ fontWeight: 'bold', color: 'white', fontSize: '12px', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {p.name}
                            {p.isPremium && <span title="Premium Priority Patient" style={{ cursor: 'help' }}>👑</span>}
                          </div>
                          <div style={{ fontSize: '10px', color: '#f87171', marginTop: '2px', textAlign: 'left' }}>
                            Critical BP: {latestBp.systolic}/{latestBp.diastolic} mmHg
                          </div>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--color-teal-light)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '2px' }}>
                          Review File <ArrowRight size={10} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {collapsedTriageQueue && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0 0 0' }}>
              {triagePatients.length === 0 ? (
                <span>✓ All patient vitals are stable.</span>
              ) : (
                <span>
                  ⚠️ <strong>{triagePatients.length} patient{triagePatients.length > 1 ? 's' : ''}</strong> needing triage. Latest: {triagePatients[0].name} ({triagePatients[0].bpHistory?.[triagePatients[0].bpHistory.length - 1]?.systolic}/{triagePatients[0].bpHistory?.[triagePatients[0].bpHistory.length - 1]?.diastolic} mmHg)
                </span>
              )}
            </div>
          )}
        </div>

        {/* Live System Automation activity feed */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setCollapsedAlertsLog(!collapsedAlertsLog)}
          >
            <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-teal-light)', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity className="w-4 h-4 text-teal-400" /> System Automation & Reminders Log
            </h4>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {collapsedAlertsLog ? 'Expand ▾' : 'Collapse ▴'}
            </span>
          </div>

          {!collapsedAlertsLog && (
            <>
              {alerts.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
              No automation actions logged.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '140px', overflowY: 'auto', paddingRight: '4px' }}>
              {alerts.slice(0, 10).map(alertItem => {
                let badgeColor = 'rgba(56, 189, 248, 0.12)';
                let textColor = '#38bdf8';
                if (alertItem.type === 'critical') {
                  badgeColor = 'rgba(239, 68, 68, 0.12)';
                  textColor = '#f87171';
                } else if (alertItem.type === 'success') {
                  badgeColor = 'rgba(16, 185, 129, 0.12)';
                  textColor = '#34d399';
                }

                return (
                  <div key={alertItem.id} style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(255,255,255,0.01)', padding: '6px 10px', borderRadius: '6px', fontSize: '11px', borderLeft: `2px solid ${textColor}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: 'white', textAlign: 'left' }}>{alertItem.title} ({alertItem.patientName})</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px', background: badgeColor, color: textColor, fontWeight: 'bold' }}>{alertItem.type}</span>
                        <button
                          onClick={() => handleDismissAlert(alertItem.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '4px',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#34d399'; e.currentTarget.style.background = 'rgba(52, 211, 153, 0.1)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'transparent'; }}
                          title="Mark alert as attended/resolved"
                        >
                          <CheckCircle size={12} />
                        </button>
                      </div>
                    </div>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '10px', lineHeight: '1.3', textAlign: 'left' }}>{alertItem.message}</p>
                    {alertItem.title === 'Refill Reminder Alert' && (
                      <button
                        onClick={() => handleNudge(alertItem.patientName || 'Patient', 'chronic medication supply is running low. Please check your refill tracker and place an order.')}
                        style={{
                          alignSelf: 'flex-start',
                          background: 'rgba(20, 184, 166, 0.15)',
                          border: '1px solid var(--color-teal-light)',
                          color: 'var(--color-teal-light)',
                          borderRadius: '4px',
                          padding: '2px 8px',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          marginTop: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <MessageSquare size={10} /> Send Refill WhatsApp Reminder
                      </button>
                    )}
                    <span style={{ fontSize: '8px', color: 'var(--text-muted)', textAlign: 'right' }}>
                      {new Date(alertItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
            </>
          )}

          {collapsedAlertsLog && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0 0 0' }}>
              {alerts.length === 0 ? (
                <span>No automation actions logged.</span>
              ) : (
                <span>
                  🤖 <strong>{alerts.length} alert{alerts.length > 1 ? 's' : ''}</strong> logged. Latest: {alerts[0].title} ({alerts[0].patientName})
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Care Team Handover & Notice Board */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '16px', background: 'rgba(13, 17, 23, 0.4)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '16px' }}>
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px', cursor: 'pointer' }}
          onClick={() => setCollapsedNoticeBoard(!collapsedNoticeBoard)}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '0.85rem', color: 'white', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText className="w-4 h-4 text-teal-400" />
              Care Team Handover & Notice Board
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
              Post shift notes, critical announcements, and medication shortages for staff members.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: '4px' }}>
              Facility: {activeRole === 'clinic' ? (activeClinic?.name || 'Clinic') : (activePharmacy?.name || 'Pharmacy')}
            </span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              {collapsedNoticeBoard ? 'Expand ▾' : 'Collapse ▴'}
            </span>
          </div>
        </div>

        <form onSubmit={handleAddCareNote} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="Type a shift handover note or announcement..."
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            style={{
              flex: 1,
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              padding: '8px 12px',
              color: 'white',
              fontSize: '0.75rem',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = '#14b8a6'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
          />
          <button
            type="submit"
            style={{
              background: 'rgba(20, 184, 166, 0.15)',
              color: 'var(--color-teal-light)',
              border: '1px solid rgba(20, 184, 166, 0.3)',
              borderRadius: '8px',
              padding: '0 16px',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.background = 'rgba(20, 184, 166, 0.25)'; }}
            onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(20, 184, 166, 0.15)'; }}
          >
            Post Memo
          </button>
        </form>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: collapsedNoticeBoard ? 'none' : '180px', overflowY: 'auto' }}>
          {careNotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '15px', color: 'var(--text-muted)', fontSize: '0.72rem', fontStyle: 'italic' }}>
              No active memos posted.
            </div>
          ) : (
            <>
              {(collapsedNoticeBoard ? careNotes.slice(0, 1) : careNotes).map((note) => (
                <div 
                  key={note.id} 
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'start',
                    background: 'rgba(255, 255, 255, 0.01)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.75rem'
                  }}
                >
                  <div style={{ textAlign: 'left', flex: 1, paddingRight: '12px' }}>
                    <p style={{ margin: 0, color: 'white', lineHeight: '1.4' }}>{note.content}</p>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', fontSize: '0.62rem', color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--color-teal-light)', fontWeight: 'bold' }}>{note.author}</span>
                      <span>•</span>
                      <span>{new Date(note.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                  {(workspaceRole === 'admin' || note.author === currentUserEmail) && (
                    <button
                      onClick={() => handleDeleteCareNote(note.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '0.65rem',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.color = '#f87171'}
                      onMouseOut={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      Delete
                    </button>
                  )}
                </div>
              ))}
              {collapsedNoticeBoard && careNotes.length > 1 && (
                <div 
                  onClick={() => setCollapsedNoticeBoard(false)}
                  style={{ 
                    textAlign: 'center', 
                    padding: '6px', 
                    color: 'var(--text-muted)', 
                    fontSize: '0.7rem', 
                    cursor: 'pointer',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '6px',
                    border: '1px dashed rgba(255,255,255,0.05)',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.color = 'white';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                    e.currentTarget.style.color = 'var(--text-muted)';
                  }}
                >
                  + {careNotes.length - 1} more memo{careNotes.length - 1 > 1 ? 's' : ''} • Click to expand and view all
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 2. Grid Layout: Left Registry Directory & Right Auditing Detail File */}
      <div className="dashboard-grid">
        
        {/* Left Column: Patients Registry */}
        <div id="patient-registry-table" className="glass-panel left-column">
          <div className="card-header-divider" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title" style={{ margin: 0 }}>
              <Users className="card-title-icon text-teal-400" /> 
              Patient Registry ({searchedPatients.length})
            </h3>
            
            {/* Search Input */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search patient..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 10px 6px 30px', color: 'white', fontSize: '0.75rem', width: '160px', outline: 'none' }}
              />
            </div>
          </div>

          <div style={{ overflowX: 'auto', marginTop: '12px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 8px' }}>Patient Name</th>
                  <th style={{ padding: '10px 8px' }}>Age</th>
                  <th style={{ padding: '10px 8px' }}>Baseline Vitals</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Refill Status</th>
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {searchedPatients.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No patients assigned to this facility match your search.
                    </td>
                  </tr>
                ) : (
                  searchedPatients.map((p, idx) => {
                    const bpArr = p.bpHistory || [];
                    const latestBp = bpArr.length > 0 ? bpArr[bpArr.length - 1] : { systolic: 120, diastolic: 80 };
                    const glucoseArr = p.glucoseHistory || [];
                    const latestGlucose = glucoseArr.length > 0 ? glucoseArr[glucoseArr.length - 1] : { level: 100, type: 'Fasting' };
                    return (
                      <tr 
                        key={idx} 
                        style={{ 
                          borderBottom: '1px solid rgba(255,255,255,0.03)', 
                          background: selectedPatient?.name === p.name ? 'rgba(20, 184, 166, 0.05)' : 'transparent',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleOpenPatientFile(p)}
                      >
                        <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'white' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {p.name}
                            {p.isPremium && (
                              <span style={{ 
                                background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', 
                                color: 'black', 
                                padding: '1px 5px', 
                                borderRadius: '4px', 
                                fontSize: '8px', 
                                fontWeight: 'bold',
                                border: '1px solid #fef08a'
                              }}>
                                👑 Premium
                              </span>
                            )}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px' }}>{p.age}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ color: '#60a5fa' }}>{latestBp.systolic}/{latestBp.diastolic}</span> | <span style={{ color: '#fb923c' }}>{latestGlucose.level} mg/dL</span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {(() => {
                            const tracker = getRefillTracker(p.id || 'mock-patient-default', orders);
                            let color = 'var(--color-teal-light)';
                            let bg = 'rgba(20, 184, 166, 0.1)';
                            if (tracker.status === 'Overdue') {
                              color = '#f87171';
                              bg = 'rgba(239, 68, 68, 0.12)';
                            } else if (tracker.status === 'Low Supply') {
                              color = '#fb923c';
                              bg = 'rgba(251, 146, 60, 0.12)';
                            }
                            return (
                              <span style={{
                                fontSize: '10px',
                                color,
                                background: bg,
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                                border: '1px solid rgba(255,255,255,0.02)',
                                display: 'inline-block',
                                whiteSpace: 'nowrap'
                              }}>
                                {tracker.status === 'No Refill Logged' ? 'No Order' : `${tracker.daysRemaining} days left`}
                              </span>
                            );
                          })()}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenPatientFile(p);
                              }}
                              className="btn-action-table"
                              style={{ padding: '4px 8px', fontSize: '0.65rem' }}
                            >
                              Open File
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenCheckIn(p);
                              }}
                              className="btn-action-table"
                              style={{ 
                                padding: '4px 8px', 
                                fontSize: '0.65rem', 
                                background: 'rgba(20, 184, 166, 0.15)', 
                                color: 'var(--color-teal-light)', 
                                border: '1px solid rgba(20, 184, 166, 0.3)' 
                              }}
                            >
                              Check-in
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Selected Patient Clinical File */}
        <div className="glass-panel right-column" style={{ minHeight: '350px' }}>
          {!selectedPatient ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
              <FileText size={40} style={{ color: 'rgba(255,255,255,0.1)', marginBottom: '16px' }} />
              <h4 style={{ margin: 0, color: 'white', fontSize: '0.9rem' }}>No Care File Active</h4>
              <p style={{ margin: '6px 0 0 0', fontSize: '0.75rem' }}>Select a patient from the registry to view clinical vitals history, foot ulcer scans, and titration diagnostics.</p>
            </div>
          ) : (
            <div className="space-y-6 animate-scale-in">
              
              {/* Patient File Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '16px' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {selectedPatient.name}
                    {selectedPatient.isPremium && (
                      <span style={{ 
                        background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', 
                        color: 'black', 
                        padding: '2px 8px', 
                        borderRadius: '100px', 
                        fontSize: '9px', 
                        fontWeight: 'bold',
                        border: '1px solid #fef08a',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}>
                        👑 Premium
                      </span>
                    )}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>Age: <strong>{selectedPatient.age}</strong></span>
                    <span>•</span>
                    <span>Weight: <strong>{selectedPatient.weight} kg</strong></span>
                    <span>•</span>
                    <span>Streak: <strong>{selectedPatient.streakDays} days</strong></span>
                  </div>
                  {(selectedPatient.phone || selectedPatient.address) && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '0.75rem' }}>
                      {selectedPatient.phone && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-teal-light)' }}>
                          <Phone size={12} /> <span>Phone: <strong>{selectedPatient.phone}</strong></span>
                        </div>
                      )}
                      {selectedPatient.address && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'white' }}>
                          <MapPin size={12} /> <span>Delivery Address: <strong>{selectedPatient.address}</strong></span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => handleOpenCheckIn(selectedPatient)}
                    style={{
                      background: 'rgba(59, 130, 246, 0.15)',
                      border: '1px solid rgba(59, 130, 246, 0.3)',
                      color: '#60a5fa',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    ⚡ Check-in / BP Log
                  </button>
                  <button
                    onClick={() => {
                      setExportPatient(selectedPatient);
                      setExportTab('vitals');
                    }}
                    style={{
                      background: 'rgba(20, 184, 166, 0.12)',
                      border: '1px solid var(--color-teal-light)',
                      color: 'var(--color-teal-light)',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '0.7rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    🗂️ Data Directory / Export
                  </button>
                  <button 
                    onClick={() => setSelectedPatient(null)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Patient Alerts Box */}
              {(() => {
                const bpArr = selectedPatient.bpHistory || [];
                const latestBp = bpArr.length > 0 ? bpArr[bpArr.length - 1] : { systolic: 120, diastolic: 80 };
                const glucoseArr = selectedPatient.glucoseHistory || [];
                const latestGlucose = glucoseArr.length > 0 ? glucoseArr[glucoseArr.length - 1] : { level: 100, type: 'Fasting' };
                const risk = evaluateNcdRisk(latestBp.systolic, latestBp.diastolic, latestGlucose.level, latestGlucose.type);
                
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ padding: '12px', background: risk.strokeRisk !== 'Low' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '10px', border: risk.strokeRisk !== 'Low' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>BP STATUS</span>
                        <span className={`risk-badge ${getRiskClass(risk.strokeRisk)}`} style={{ fontSize: '0.55rem', padding: '2px 6px' }}>{risk.strokeRisk}</span>
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white', marginTop: '4px' }}>
                        {latestBp.systolic}/{latestBp.diastolic} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>mmHg</span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>{risk.bpWarning}</p>
                    </div>

                    <div style={{ padding: '12px', background: risk.diabeticRisk !== 'Low' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255,255,255,0.02)', borderRadius: '10px', border: risk.diabeticRisk !== 'Low' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>GLUCOSE STATUS</span>
                        <span className={`risk-badge ${getRiskClass(risk.diabeticRisk)}`} style={{ fontSize: '0.55rem', padding: '2px 6px' }}>{risk.diabeticRisk}</span>
                      </div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white', marginTop: '4px' }}>
                        {latestGlucose.level} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>mg/dL ({latestGlucose.type})</span>
                      </div>
                      <p style={{ margin: '4px 0 0 0', fontSize: '0.65rem', color: 'var(--text-secondary)', lineHeight: '1.3' }}>{risk.glucoseWarning}</p>
                    </div>
                  </div>
                );
              })()}

              {/* Vitals History Log list */}
              <div style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)', padding: '12px' }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsedPatientVitals ? '0' : '8px' }}
                  onClick={() => setCollapsedPatientVitals(!collapsedPatientVitals)}
                >
                  <h4 style={{ margin: 0, fontSize: '0.75rem', color: 'white', fontWeight: 'bold' }}>Vitals Logs History</h4>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{collapsedPatientVitals ? 'Expand ▾' : 'Collapse ▴'}</span>
                </div>
                
                {!collapsedPatientVitals && (
                  <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.75rem' }}>
                    {(selectedPatient.bpHistory || []).map((bp, idx) => {
                      const sugar = (selectedPatient.glucoseHistory || [])[idx] || { level: 100, type: 'Fasting' };
                      return (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{bp.date}</span>
                          <span>BP: <strong>{bp.systolic}/{bp.diastolic}</strong></span>
                          <span>Glucose: <strong>{sugar.level} mg/dL</strong> ({sugar.type})</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {collapsedPatientVitals && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0 0 0' }}>
                    {selectedPatient.bpHistory && selectedPatient.bpHistory.length > 0 ? (
                      (() => {
                        const bp = selectedPatient.bpHistory[selectedPatient.bpHistory.length - 1];
                        const sugar = (selectedPatient.glucoseHistory || [])[selectedPatient.bpHistory.length - 1] || { level: 100, type: 'Fasting' };
                        return (
                          <span>
                            Latest ({bp.date}): <strong>BP {bp.systolic}/{bp.diastolic} mmHg</strong> | <strong>Glucose {sugar.level} mg/dL</strong> ({sugar.type})
                          </span>
                        );
                      })()
                    ) : (
                      <span>No vitals recorded.</span>
                    )}
                  </div>
                )}
              </div>

              {/* Foot Scan History Soles contour mapping */}
              {selectedPatient.footScanHistory && selectedPatient.footScanHistory.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(20, 184, 166, 0.03)', borderRadius: '10px', border: '1px solid rgba(20, 184, 166, 0.1)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '60px', height: '80px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: '30px', height: '60px', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '100px', margin: '10px auto', position: 'relative' }}>
                      {(selectedPatient.footScanHistory[selectedPatient.footScanHistory.length - 1]?.hotspots || []).map((spot, i) => (
                        <div 
                          key={i} 
                          style={{ position: 'absolute', left: `${spot.x / 2}%`, top: `${spot.y / 2}%`, width: '4px', height: '4px', borderRadius: '50%', background: '#ef4444' }} 
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <h5 style={{ margin: 0, fontSize: '0.75rem', color: 'white', fontWeight: 'bold' }}>Diabetic Foot Sole Scan (Latest)</h5>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Risk Index: <strong>{selectedPatient.footScanHistory[selectedPatient.footScanHistory.length - 1]?.riskScore || 0}%</strong> • 
                      {selectedPatient.footScanHistory[selectedPatient.footScanHistory.length - 1]?.hasHotspots ? " Hotspots detected on Metatarsal head." : " No hotspots detected."}
                    </p>
                    <button
                      onClick={() => handleNudge(selectedPatient.name, "foot sole scan shows early friction redness clusters. Please audit shoes.")}
                      className="btn-action-table"
                      style={{ padding: '4px 8px', fontSize: '0.65rem', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <MessageSquare size={10} /> Send WhatsApp Alert Nudge
                    </button>
                  </div>
                </div>
              )}

              {/* Dosing Titration Form & Copilot Recommendations / Refill Verification Checklist */}
              {activeRole === 'clinic' ? (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                  <div 
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsedTitration ? '0' : '12px' }}
                    onClick={() => setCollapsedTitration(!collapsedTitration)}
                  >
                    <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calculator size={14} className="text-blue-400" /> AI Regimen Titration Copilot
                    </h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{collapsedTitration ? 'Expand ▾' : 'Collapse ▴'}</span>
                  </div>
                  
                  {!collapsedTitration && (
                    <>
                      {/* Active Meds display */}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                        {(selectedPatient.activeMeds || []).map((med, i) => (
                          <span key={i} style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '4px 8px', borderRadius: '100px', color: 'white' }}>
                            {med}
                          </span>
                        ))}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Systolic / Diastolic</label>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            <input type="number" value={auditSystolic} onChange={(e) => setAuditSystolic(Number(e.target.value))} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '6px', color: 'white', fontSize: '0.75rem' }} />
                            <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
                            <input type="number" value={auditDiastolic} onChange={(e) => setAuditDiastolic(Number(e.target.value))} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '6px', color: 'white', fontSize: '0.75rem' }} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Glucose Level (mg/dL)</label>
                          <input type="number" value={auditGlucose} onChange={(e) => setAuditGlucose(Number(e.target.value))} style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '6px', color: 'white', fontSize: '0.75rem' }} />
                        </div>
                      </div>

                      {/* AI Auditing results block */}
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px' }}>
                        {activeAuditResults.warning && (
                          <div style={{ display: 'flex', gap: '8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', padding: '10px', borderRadius: '8px', color: '#f87171', fontSize: '0.7rem', marginBottom: '10px' }}>
                            <ShieldAlert size={14} className="shrink-0" style={{ marginTop: '2px' }} />
                            <div><strong>Dosing Warning:</strong> {activeAuditResults.warning}</div>
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.7rem' }}>
                          <div>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 'bold' }}>Audit Notes:</span>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '14px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                              {activeAuditResults.notes.map((note, i) => <li key={i}>{note}</li>)}
                            </ul>
                          </div>
                          <div>
                            <span style={{ color: 'var(--color-teal-light)', fontWeight: 'bold' }}>AI Recommendations:</span>
                            <ul style={{ margin: '4px 0 0 0', paddingLeft: '14px', color: 'white', lineHeight: '1.4' }}>
                              {activeAuditResults.recommendations.map((rec, i) => <li key={i}>{rec}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {collapsedTitration && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0 0 0' }}>
                      Current Regimen: <strong>{(selectedPatient.activeMeds || []).join(', ') || 'None Prescribed'}</strong>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                  <div 
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsedDispensingAudit ? '0' : '12px' }}
                    onClick={() => setCollapsedDispensingAudit(!collapsedDispensingAudit)}
                  >
                    <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-teal-light)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <ShieldCheck size={14} /> SafeMeds Dispensing Audit Checklist
                    </h4>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{collapsedDispensingAudit ? 'Expand ▾' : 'Collapse ▴'}</span>
                  </div>

                  {!collapsedDispensingAudit && (
                    <>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '6px' }}>
                        Perform mandatory safety audits before releasing prescription medications to prevent counterfeit distribution or adverse dosing.
                      </p>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(0,0,0,0.15)', padding: '14px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: 'white', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={checklist.rxVerified} 
                            onChange={(e) => setChecklist({ ...checklist, rxVerified: e.target.checked })} 
                            style={{ accentColor: '#14b8a6', marginTop: '2px' }} 
                          />
                          <div>
                            <strong>Verify Doctor\'s Prescription Signature</strong>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Audit PDF file metadata and doctor credentials.</span>
                            {(() => {
                              const pendingOrder = orders.find(o => o.patientId === selectedPatient.id && o.status === 'Pending Verification');
                              if (pendingOrder && pendingOrder.prescriptionDetails) {
                                const isBase64 = pendingOrder.prescriptionDetails.startsWith('data:');
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setViewingPrescriptionOrder(pendingOrder);
                                    }}
                                    style={{
                                      background: 'rgba(20, 184, 166, 0.15)',
                                      border: '1px solid var(--color-teal-light)',
                                      color: 'var(--color-teal-light)',
                                      borderRadius: '4px',
                                      padding: '2px 8px',
                                      fontSize: '10px',
                                      fontWeight: 'bold',
                                      cursor: 'pointer',
                                      marginTop: '6px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px'
                                    }}
                                  >
                                    <Eye size={10} /> {isBase64 ? 'View Uploaded Prescription' : 'View Manual Details'}
                                  </button>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: 'white', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={checklist.nafdacAudit} 
                            onChange={(e) => setChecklist({ ...checklist, nafdacAudit: e.target.checked })} 
                            style={{ accentColor: '#14b8a6', marginTop: '2px' }} 
                          />
                          <div>
                            <strong>NAFDAC Serial Potency Scan</strong>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Verify drug packaging anti-counterfeit QR code.</span>
                          </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: 'white', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={checklist.vitalsAudit} 
                            onChange={(e) => setChecklist({ ...checklist, vitalsAudit: e.target.checked })} 
                            style={{ accentColor: '#14b8a6', marginTop: '2px' }} 
                          />
                          <div>
                            <strong>Log-Vitals Compliance Review</strong>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Log review: Patient\'s blood pressure is within stable bounds for refill.</span>
                          </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: 'white', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={checklist.identityVerified} 
                            onChange={(e) => setChecklist({ ...checklist, identityVerified: e.target.checked })} 
                            style={{ accentColor: '#14b8a6', marginTop: '2px' }} 
                          />
                          <div>
                            <strong>Confirm Patient Identity</strong>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Match demographic record and photo.</span>
                          </div>
                        </label>

                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '0.75rem', color: 'white', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={checklist.bundlePackaged} 
                            onChange={(e) => setChecklist({ ...checklist, bundlePackaged: e.target.checked })} 
                            style={{ accentColor: '#14b8a6', marginTop: '2px' }} 
                          />
                          <div>
                            <strong>Package Chronic Meds Bundle</strong>
                            <span style={{ display: 'block', fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Ensure exact tablet count (Metformin, Amlodipine, Lisinopril).</span>
                          </div>
                        </label>
                      </div>
                    </>
                  )}

                  {collapsedDispensingAudit && (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0 0 0' }}>
                      Audit Progress: <strong>{(() => {
                        const completedChecks = [checklist.rxVerified, checklist.nafdacAudit, checklist.vitalsAudit, checklist.identityVerified, checklist.bundlePackaged].filter(Boolean).length;
                        return `${completedChecks}/5 tasks completed`;
                      })()}</strong>
                    </div>
                  )}
                </div>
              )}

              {/* Refill Adherence Tracker Panel */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: collapsedPatientAdherence ? '0' : '12px' }}
                  onClick={() => setCollapsedPatientAdherence(!collapsedPatientAdherence)}
                >
                  <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShoppingBag size={14} className="text-teal-400" /> SafeMeds Refill Adherence
                  </h4>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{collapsedPatientAdherence ? 'Expand ▾' : 'Collapse ▴'}</span>
                </div>
                
                {!collapsedPatientAdherence && (() => {
                  const tracker = getRefillTracker(selectedPatient.id || 'mock-patient-default', orders);
                  const activePharmacyName = pharmacies.find(ph => ph.id === selectedPatient.assignedPharmacyId)?.name || 'H-Medix Pharmacy Wuse II';
                  
                  return (
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Medication Supply Remaining:</span>
                        <span style={{ fontWeight: 'bold', color: tracker.status === 'Overdue' ? '#f87171' : tracker.status === 'Low Supply' ? '#fb923c' : 'var(--color-teal-light)' }}>
                          {tracker.daysRemaining} days ({tracker.status})
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Assigned Pharmacy Partner:</span>
                        <span style={{ fontWeight: 'bold', color: 'white' }}>{activePharmacyName}</span>
                      </div>
                      
                      {tracker.status !== 'Active Supply' && (
                        <button
                          type="button"
                          onClick={() => handleNudge(selectedPatient.name, `refill is due (only ${tracker.daysRemaining} days left). Please order from ${activePharmacyName}`)}
                          style={{
                            background: 'rgba(20, 184, 166, 0.12)',
                            border: '1px solid var(--color-teal-light)',
                            color: 'var(--color-teal-light)',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            marginTop: '4px',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <MessageSquare size={12} /> Send Refill WhatsApp Reminder
                        </button>
                      )}
                    </div>
                  );
                })()}

                {collapsedPatientAdherence && (() => {
                  const tracker = getRefillTracker(selectedPatient.id || 'mock-patient-default', orders);
                  return (
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '2px 0 0 0' }}>
                      Supply Remaining: <strong style={{ color: tracker.status === 'Overdue' ? '#f87171' : tracker.status === 'Low Supply' ? '#fb923c' : 'var(--color-teal-light)' }}>{tracker.daysRemaining} days ({tracker.status})</strong>
                    </div>
                  );
                })()}
              </div>

            </div>
          )}
        </div>

      </div>

      {/* 3. Orders List Table */}
      <div id="refills-queue-section" className="glass-panel">
        <div className="card-header-divider" style={{ borderBottom: 'none', paddingBottom: '0' }}>
          <h3 className="card-title">
            <ClipboardList className="card-title-icon text-teal-400" /> Prescriptions & Refill Requests
          </h3>
        </div>

        {/* Tab Navigation for Refills Queue */}
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '0 16px', overflowX: 'auto', gap: '8px' }}>
          <button
            onClick={() => setRefillTab('pending')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: refillTab === 'pending' ? '2px solid #f87171' : 'none',
              color: refillTab === 'pending' ? 'white' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            Pending Audit 
            <span style={{ fontSize: '9px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', padding: '2px 6px', borderRadius: '100px', fontWeight: 'bold' }}>
              {pendingOrders.length}
            </span>
          </button>
          <button
            onClick={() => setRefillTab('ready')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: refillTab === 'ready' ? '2px solid var(--color-teal-light)' : 'none',
              color: refillTab === 'ready' ? 'white' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            Ready to Dispense
            <span style={{ fontSize: '9px', background: readyOrders.length > 0 ? 'rgba(20, 184, 166, 0.25)' : 'rgba(255,255,255,0.06)', color: readyOrders.length > 0 ? 'var(--color-teal-light)' : 'var(--text-muted)', padding: '2px 6px', borderRadius: '100px', fontWeight: 'bold' }}>
              {readyOrders.length}
            </span>
          </button>
          <button
            onClick={() => setRefillTab('completed')}
            style={{
              padding: '12px 16px',
              background: 'none',
              border: 'none',
              borderBottom: refillTab === 'completed' ? '2px solid #38bdf8' : 'none',
              color: refillTab === 'completed' ? 'white' : 'var(--text-muted)',
              fontSize: '0.75rem',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap'
            }}
          >
            Shipped & Delivered
            <span style={{ fontSize: '9px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 6px', borderRadius: '100px', fontWeight: 'bold' }}>
              {completedOrders.length}
            </span>
          </button>
        </div>

        <div className="orders-table-wrapper">
          <table className="clinician-orders-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Patient</th>
                <th>Refill Package</th>
                <th style={{ textAlign: 'center' }}>Prescription</th>
                <th style={{ textAlign: 'right' }}>Value</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>{activeRole === 'clinic' ? 'Compliance Monitor' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {activeTabOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {refillTab === 'pending' && "No refill requests pending clinical audit."}
                    {refillTab === 'ready' && "No auto-approved refills waiting to be dispensed."}
                    {refillTab === 'completed' && "No shipped or delivered refills logged."}
                  </td>
                </tr>
              ) : (
                activeTabOrders.map((order, index) => (
                  <tr key={index}>
                    <td style={{ fontWeight: 'bold', color: 'white' }}>{order.id}</td>
                    <td>
                      <div>
                        <strong>{order.patientName || "Chief Chinedu Eze"}</strong>
                        {(() => {
                          const pProfile = patients.find(p => p.id === order.patientId);
                          if (pProfile) {
                            return (
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.2' }}>
                                {pProfile.phone && <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>📞 {pProfile.phone}</div>}
                                {pProfile.address && <div style={{ display: 'flex', alignItems: 'center', gap: '3px', wordBreak: 'break-word', maxWidth: '180px' }}>📍 {pProfile.address}</div>}
                              </div>
                            );
                          }
                          // Fallback mock details for mock patient
                          if (!order.patientId) {
                            return (
                              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: '1.2' }}>
                                <div>📞 +234 803 456 7890</div>
                                <div style={{ wordBreak: 'break-word', maxWidth: '180px' }}>📍 12 Link Rd, Wuse II, Abuja</div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </td>
                    <td style={{ minWidth: '220px', padding: '12px 8px' }}>
                      {order.items.map((item, idx) => {
                        const matched = NCD_MEDICATIONS.find(m => m.name === item || item.startsWith(m.name));
                        return (
                          <div key={idx} style={{ marginBottom: idx < order.items.length - 1 ? '6px' : '0' }}>
                            <div style={{ fontWeight: 'bold', color: 'white', fontSize: '0.8rem' }}>{item}</div>
                            {matched && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'normal', lineHeight: '1.3' }}>
                                {matched.description}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {order.prescriptionRequired ? (
                        order.prescriptionUploaded ? (
                          order.prescriptionDetails ? (
                            order.prescriptionDetails.startsWith('data:') ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <span className="order-rx-badge-pill valid" style={{ background: 'rgba(20, 184, 166, 0.15)', color: 'var(--color-teal-light)', borderColor: 'rgba(20, 184, 166, 0.3)' }}>
                                  File Uploaded
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pat = patients.find(p => p.id === order.patientId);
                                    if (pat) setSelectedPatient(pat);
                                    setViewingPrescriptionOrder(order);
                                  }}
                                  style={{
                                    background: 'rgba(56, 189, 248, 0.15)',
                                    border: '1px solid #38bdf8',
                                    color: '#38bdf8',
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    marginTop: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Eye size={10} /> View Rx File
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                <span className="order-rx-badge-pill valid" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                                  Details Provided
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const pat = patients.find(p => p.id === order.patientId);
                                    if (pat) setSelectedPatient(pat);
                                    setViewingPrescriptionOrder(order);
                                  }}
                                  style={{
                                    background: 'rgba(255, 255, 255, 0.08)',
                                    border: '1px solid rgba(255, 255, 255, 0.15)',
                                    color: 'white',
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    marginTop: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px'
                                  }}
                                >
                                  <Eye size={10} /> Read Details
                                </button>
                              </div>
                            )
                          ) : (
                            <span className="order-rx-badge-pill valid">
                              Uploaded (Eze_Rx.pdf)
                            </span>
                          )
                        ) : (
                          <span className="order-rx-badge-pill missing">
                            Missing Prescription
                          </span>
                        )
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Not Required</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }} className="order-val-highlight">₦{order.totalNaira.toLocaleString()}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`order-status-pill ${
                        order.status === 'Delivered' ? 'delivered' :
                        order.status === 'Out for Delivery' ? 'transit' :
                        order.status === 'Approved' ? 'approved' :
                        'pending'
                      }`} style={{ display: 'inline-flex' }}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        {activeRole === 'clinic' ? (
                          // CLINIC / DOCTOR ACTIONS: Read-only compliance monitor (No verify & approve buttons)
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '4px', background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            {order.status === 'Pending Verification' ? 'Awaiting Pharmacy Audit' :
                             order.status === 'Approved' ? '✓ Fulfillable / Dispensed' :
                             order.status === 'Out for Delivery' ? '⚡ In Transit' : '✅ Delivered'}
                          </span>
                        ) : (
                          // PHARMACIST ACTIONS: Check verification checklists and fulfill delivery
                          <>
                            {order.status === 'Pending Verification' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '4px', padding: '2px 4px' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>₦</span>
                                  <input
                                    type="number"
                                    defaultValue={order.totalNaira}
                                    id={`price-adjust-${order.id}`}
                                    disabled={!isFacilityPremium}
                                    style={{
                                      width: '65px',
                                      background: 'transparent',
                                      border: 'none',
                                      color: isFacilityPremium ? 'white' : 'var(--text-muted)',
                                      fontSize: '11px',
                                      fontFamily: 'monospace',
                                      textAlign: 'right',
                                      outline: 'none',
                                      cursor: isFacilityPremium ? 'text' : 'not-allowed'
                                    }}
                                    placeholder={isFacilityPremium ? "Adjust" : "Locked"}
                                    title={!isFacilityPremium ? "Price adjustment locked. Upgrade to Premium Pharmacy plan." : ""}
                                  />
                                </div>
                                <button
                                  onClick={() => {
                                    const inputEl = document.getElementById(`price-adjust-${order.id}`) as HTMLInputElement;
                                    const adjustedPrice = (inputEl && isFacilityPremium) ? Number(inputEl.value) : order.totalNaira;
                                    handleUpdateStatusAndClearAlert(order.id, 'Approved', adjustedPrice);
                                  }}
                                  className="btn-action-table"
                                  disabled={!checklist.rxVerified || !checklist.nafdacAudit}
                                  style={{ 
                                    opacity: (!checklist.rxVerified || !checklist.nafdacAudit) ? 0.5 : 1,
                                    cursor: (!checklist.rxVerified || !checklist.nafdacAudit) ? 'not-allowed' : 'pointer'
                                  }}
                                  title={(!checklist.rxVerified || !checklist.nafdacAudit) 
                                    ? "Please verify prescription signature and perform NAFDAC serial scan first in patient file" 
                                    : "Approve medication release"
                                  }
                                >
                                  Verify & Approve
                                </button>
                              </div>
                            )}
                            {order.status === 'Approved' && (
                              <button
                                onClick={() => handleUpdateStatusAndClearAlert(order.id, 'Out for Delivery')}
                                className="btn-action-table"
                                style={{ background: 'var(--color-blue)' }}
                              >
                                Hand to Rider
                              </button>
                            )}
                            {order.status === 'Out for Delivery' && (
                              <button
                                onClick={() => handleUpdateStatusAndClearAlert(order.id, 'Delivered')}
                                className="btn-action-table"
                                style={{ background: 'var(--color-green)' }}
                              >
                                Confirm Delivery
                              </button>
                            )}
                            {order.status === 'Delivered' && (
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                ✓ Complete
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Interactive Prescription Image / Details Verification Modal Overlay */}
      {viewingPrescriptionOrder && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>
                  Prescription Verification
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Order: <strong>{viewingPrescriptionOrder.id}</strong> • Patient: <strong>{viewingPrescriptionOrder.patientName}</strong>
                </p>
              </div>
              <button
                onClick={() => setViewingPrescriptionOrder(null)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              maxHeight: '65vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%'
            }}>
              {(() => {
                const rawDetails = viewingPrescriptionOrder.prescriptionDetails || '';
                const parts = rawDetails.split('|||');
                const note = parts.length > 1 ? parts[0] : '';
                const details = parts.length > 1 ? parts[1] : parts[0];

                return (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center' }}>
                    {note && (
                      <div style={{
                        width: '100%',
                        background: 'rgba(251, 146, 60, 0.08)',
                        border: '1px solid rgba(251, 146, 60, 0.2)',
                        borderRadius: '8px',
                        padding: '10px 14px',
                        color: '#fb923c',
                        fontSize: '11px',
                        textAlign: 'left',
                        marginBottom: '8px'
                      }}>
                        <strong>💡 Brand & Dosage Preference Note:</strong>
                        <p style={{ margin: '4px 0 0 0', color: 'white', fontSize: '12px' }}>"{note}"</p>
                      </div>
                    )}

                    {(() => {
                      if (details.startsWith('data:image/')) {
                        return (
                          <img 
                            src={details} 
                            alt="Doctor's Prescription" 
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '55vh', 
                              borderRadius: '8px', 
                              border: '1px solid rgba(255, 255, 255, 0.1)',
                              objectFit: 'contain'
                            }} 
                          />
                        );
                      } else if (details.startsWith('data:application/pdf;base64,')) {
                        return (
                          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <iframe 
                              src={details} 
                              title="Prescription PDF" 
                              style={{ 
                                width: '100%', 
                                height: '450px', 
                                border: 'none', 
                                borderRadius: '8px', 
                                background: 'white' 
                              }} 
                            />
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                              If PDF does not display, download files from patient registry profile.
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <div style={{
                            width: '100%',
                            background: 'rgba(255, 255, 255, 0.02)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '10px',
                            padding: '16px',
                            color: 'white',
                            lineHeight: '1.5'
                          }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.06)', paddingBottom: '8px', marginBottom: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              <FileText size={14} /> <span>PATIENT MANUALLY PROVIDED DETAILS</span>
                            </div>
                            <p style={{ margin: 0, fontSize: '0.85rem', fontStyle: 'italic', color: '#e5e7eb', whiteSpace: 'pre-wrap' }}>
                              "{details || "No details provided."}"
                            </p>
                          </div>
                        );
                      }
                    })()}
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(0,0,0,0.2)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setViewingPrescriptionOrder(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'transparent',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
              {activeRole === 'pharmacy' && viewingPrescriptionOrder.status === 'Pending Verification' && (
                <button
                  onClick={() => {
                    // Mark Rx Verified in checklist
                    setChecklist(prev => ({ ...prev, rxVerified: true }));
                    setViewingPrescriptionOrder(null);
                  }}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--color-teal-light)',
                    color: 'white',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <ShieldCheck size={14} /> Verify & Approve Signature
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Interactive Pharmacy Pricing Editor Modal Overlay */}
      {editingPrices && activePharmacy && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#111827',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '550px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>
                  Manage Pharmacy Pricing
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Pharmacy: <strong>{activePharmacy.name}</strong> ({activePharmacy.city})
                </p>
              </div>
              <button
                onClick={() => setEditingPrices(false)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              maxHeight: '60vh',
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              gap: '12px'
            }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: '1.4', textAlign: 'left' }}>
                Customize pricing for your pharmacy. These overrides will apply to any patient who selects <strong>{activePharmacy.name}</strong> as their preferred refill partner.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {NCD_MEDICATIONS.map(med => {
                  const currentPrice = tempPrices[med.id] !== undefined ? tempPrices[med.id] : med.price;
                  return (
                    <div 
                      key={med.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center', 
                        padding: '12px', 
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.04)',
                        borderRadius: '10px',
                        gap: '16px'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                        <span style={{ fontSize: '0.8rem', color: 'white', fontWeight: 'bold', textAlign: 'left' }}>{med.name}</span>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'left', lineHeight: '1.25' }}>{med.description}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', shrink: 0 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', fontWeight: 'bold' }}>₦</span>
                        <input
                          type="number"
                          value={currentPrice}
                          onChange={(e) => {
                            const val = Math.max(0, Number(e.target.value));
                            setTempPrices(prev => ({ ...prev, [med.id]: val }));
                          }}
                          style={{
                            width: '90px',
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '6px',
                            padding: '6px 8px',
                            color: 'white',
                            fontSize: '0.75rem',
                            textAlign: 'right',
                            outline: 'none',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(0,0,0,0.2)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => setEditingPrices(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  background: 'transparent',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (onUpdatePharmacyPrices) {
                    await onUpdatePharmacyPrices(activePharmacy.id, tempPrices);
                  }
                  setEditingPrices(false);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--color-teal-light)',
                  color: 'white',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                Save Pricing
              </button>
            </div>
          </div>
        </div>
        )}

      {/* Facility Staff Management Directory Panel */}
      {workspaceRole === 'admin' && (
        <div id="staff-directory-section" className="glass-panel" style={{ marginTop: '24px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.3) 0%, rgba(15, 23, 42, 0.3) 100%)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px' }}>
          <div 
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: collapsedStaffPanel ? 'none' : '1px solid rgba(255,255,255,0.06)', paddingBottom: collapsedStaffPanel ? '0' : '12px' }}
            onClick={() => setCollapsedStaffPanel(!collapsedStaffPanel)}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                👥 Care Team & Staff Directory
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                View and manage registered staff accounts and assign workspace permissions.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setStaffError('');
                  setStaffSuccess('');
                  setAddingStaff(true);
                }}
                style={{
                  background: 'rgba(20, 184, 166, 0.15)',
                  border: '1px solid var(--color-teal-light)',
                  color: 'var(--color-teal-light)',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '0.65rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                + Add Staff Account
              </button>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{collapsedStaffPanel ? 'Expand ▾' : 'Collapse ▴'}</span>
            </div>
          </div>

          {collapsedStaffPanel && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '6px 0 0 0' }}>
              Total Registered Staff: <strong>{staffList.length}</strong>
            </div>
          )}

          {!collapsedStaffPanel && (
            <div style={{ marginTop: '16px' }}>
              {isLoadingStaff ? (
                <div style={{ padding: '20px', textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Loading care team roster...
                </div>
              ) : staffList.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', borderRadius: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  No other staff accounts associated yet. Use "+ Add Staff Account" to register your care team.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                        <th style={{ padding: '8px 12px' }}>Email Address</th>
                        <th style={{ padding: '8px 12px' }}>Assigned Role</th>
                        <th style={{ padding: '8px 12px' }}>Created At</th>
                        <th style={{ padding: '8px 12px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffList.map((member, index) => (
                        <tr key={member.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', background: index % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent' }}>
                          <td style={{ padding: '10px 12px', color: 'white', fontWeight: 'bold' }}>{member.email || `Staff Account ${index + 1}`}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              fontSize: '9px',
                              background: member.role === 'Admin' || member.role === 'Owner' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                              color: member.role === 'Admin' || member.role === 'Owner' ? '#eab308' : '#38bdf8',
                              padding: '2px 8px',
                              borderRadius: '100px',
                              fontWeight: 'bold',
                              textTransform: 'uppercase'
                            }}>
                              {member.role}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                            {new Date(member.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </td>
                          <td style={{ padding: '10px 12px', color: 'var(--color-teal-light)' }}>Active</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Staff Account Modal */}
      {addingStaff && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: '#111827', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px', width: '100%', maxWidth: '400px',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.02)'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                👥 Add Facility Staff Member
              </h3>
              <button 
                onClick={() => setAddingStaff(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleAddStaffMember} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {staffError && (
                <div style={{ fontSize: '11px', color: '#f87171', background: 'rgba(239, 68, 68, 0.15)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  ⚠️ {staffError}
                </div>
              )}
              {staffSuccess && (
                <div style={{ fontSize: '11px', color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  ✓ {staffSuccess}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Full Name</label>
                <input 
                  type="text" 
                  value={staffFullName}
                  onChange={(e) => setStaffFullName(e.target.value)}
                  placeholder="e.g. John Doe"
                  required
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px', color: 'white', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Email Address</label>
                <input 
                  type="email" 
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="e.g. staff@facility.com"
                  required
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px', color: 'white', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Password</label>
                <input 
                  type="password" 
                  value={staffPassword}
                  onChange={(e) => setStaffPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  required
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px', color: 'white', fontSize: '0.8rem' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Assigned Role</label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  style={{ background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '10px', color: 'white', fontSize: '0.8rem', width: '100%' }}
                >
                  {activeRole === 'clinic' ? (
                    <>
                      <option value="Doctor">Doctor / MD Consultant</option>
                      <option value="Nurse">Nurse / Care Manager</option>
                      <option value="Admin">Admin / Director</option>
                    </>
                  ) : (
                    <>
                      <option value="Staff">Staff / Dispenser</option>
                      <option value="Owner">Owner / Manager</option>
                    </>
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setAddingStaff(false)}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'white', padding: '10px 16px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ background: 'var(--color-teal-light)', border: 'none', color: 'white', padding: '10px 16px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Register Staff
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Master Clinical Logs Directory Audit Panel */}
      {workspaceRole === 'admin' && (
      <div className="glass-panel" style={{ marginTop: '24px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.3) 0%, rgba(15, 23, 42, 0.3) 100%)', border: '1px solid rgba(255,255,255,0.05)', padding: '20px', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ filter: (activeRole === 'clinic' && !isFacilityPremium) ? 'blur(5px)' : 'none', transition: 'filter 0.3s ease' }}>
        <div 
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: collapsedMasterDirectory ? 'none' : '1px solid rgba(255,255,255,0.06)', paddingBottom: collapsedMasterDirectory ? '0' : '12px' }}
          onClick={() => setCollapsedMasterDirectory(!collapsedMasterDirectory)}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🗂️ Global Clinical Logs Directory (Master Auditing Portal)
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Access full historic records of vitals entries, foot sole scans, and refills across all patients for discrepancy auditing.
            </p>
          </div>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{collapsedMasterDirectory ? 'Expand Directory ▾' : 'Collapse Directory ▴'}</span>
        </div>

        {collapsedMasterDirectory && (
          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '6px 0 0 0', display: 'flex', gap: '16px' }}>
            <span>Patients Assigned: <strong>{patients.length}</strong></span>
            <span>•</span>
            <span>Total Refill Orders: <strong>{orders.length}</strong></span>
          </div>
        )}

        {!collapsedMasterDirectory && (
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Master Audit Filters & Tools */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <input
                  type="text"
                  placeholder="Filter by patient name..."
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 12px', color: 'white', fontSize: '0.75rem', width: '180px', outline: 'none' }}
                />
                
                <select
                  value={directoryType}
                  onChange={(e) => setDirectoryType(e.target.value as any)}
                  style={{ background: '#1c1c1e', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '6px 10px', borderRadius: '8px', fontSize: '0.75rem' }}
                >
                  <option value="all">All Logs Types</option>
                  <option value="vitals">Vitals Entries</option>
                  <option value="scans">Diabetic Foot Scans</option>
                  <option value="orders">Refill Orders</option>
                </select>
              </div>

              {/* Master Export Button */}
              <button
                onClick={() => {
                  const rows = [["Patient", "Date", "Log Type", "Details"]];
                  filteredPatients.forEach(p => {
                    if (directoryType === 'all' || directoryType === 'vitals') {
                      (p.bpHistory || []).forEach((bp, i) => {
                        const gl = (p.glucoseHistory || [])[i] || { level: 120, type: 'Fasting' };
                        rows.push([p.name, bp.date, "Vitals Log", `BP: ${bp.systolic}/${bp.diastolic} mmHg | Glucose: ${gl.level} mg/dL (${gl.type})`]);
                      });
                    }
                    if (directoryType === 'all' || directoryType === 'scans') {
                      (p.footScanHistory || []).forEach(scan => {
                        rows.push([p.name, scan.date, "Foot Scan", `Risk: ${scan.riskScore}% | Hotspots: ${scan.hasHotspots ? 'Yes' : 'No'}`]);
                      });
                    }
                    if (directoryType === 'all' || directoryType === 'orders') {
                      orders.filter(o => o.patientId === p.id).forEach(o => {
                        rows.push([p.name, o.date, `Order Refill ${o.id}`, `Items: ${o.items.join(' + ')} | Total: ₦${o.totalNaira} | Status: ${o.status}`]);
                      });
                    }
                  });
                  
                  const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(",")).join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", `diabp_master_audit_directory_${new Date().toLocaleDateString()}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                style={{
                  background: 'var(--color-teal-light)',
                  border: 'none',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                📥 Export Master Audit CSV
              </button>
            </div>

            {/* Logs master directory grid log view */}
            <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', background: 'rgba(0,0,0,0.15)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <th style={{ padding: '8px 10px' }}>Patient Name</th>
                    <th style={{ padding: '8px 10px' }}>Log Date</th>
                    <th style={{ padding: '8px 10px' }}>Type</th>
                    <th style={{ padding: '8px 10px' }}>Clinical Details / Record Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const allLogs: Array<{ patientName: string; date: string; type: string; details: string; rawData: any }> = [];
                    
                    filteredPatients.forEach(p => {
                      if (directoryType === 'all' || directoryType === 'vitals') {
                        (p.bpHistory || []).forEach((bp, i) => {
                          const gl = (p.glucoseHistory || [])[i] || { level: 120, type: 'Fasting' };
                          allLogs.push({
                            patientName: p.name,
                            date: bp.date,
                            type: 'Vitals Log',
                            details: `BP: ${bp.systolic}/${bp.diastolic} mmHg | Glucose: ${gl.level} mg/dL (${gl.type})`,
                            rawData: { bp, glucose: gl }
                          });
                        });
                      }
                      
                      if (directoryType === 'all' || directoryType === 'scans') {
                        (p.footScanHistory || []).forEach(scan => {
                          allLogs.push({
                            patientName: p.name,
                            date: scan.date,
                            type: 'Foot Scan',
                            details: `Risk Index: ${scan.riskScore}% | Hotspots: ${scan.hasHotspots ? 'Yes' : 'No'} | Recommendations: ${scan.recommendations.join('; ')}`,
                            rawData: scan
                          });
                        });
                      }
                      
                      if (directoryType === 'all' || directoryType === 'orders') {
                        orders.filter(o => o.patientId === p.id).forEach(o => {
                          allLogs.push({
                            patientName: p.name,
                            date: o.date,
                            type: `Refill ${o.id}`,
                            details: `Items: ${o.items.join(', ')} | Total: ₦${o.totalNaira.toLocaleString()} | Status: ${o.status}`,
                            rawData: o
                          });
                        });
                      }
                    });

                    const filteredLogs = allLogs.filter(log => 
                      log.patientName.toLowerCase().includes(directorySearch.toLowerCase())
                    );

                    if (filteredLogs.length === 0) {
                      return (
                        <tr>
                          <td colSpan={4} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                            No matching log entries found in directory history.
                          </td>
                        </tr>
                      );
                    }

                    return filteredLogs.map((log, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '8px 10px', color: 'white', fontWeight: 'bold' }}>{log.patientName}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{log.date}</td>
                        <td style={{ padding: '8px 10px' }}>
                          <span style={{
                            background: log.type.includes('Vitals') ? 'rgba(59, 130, 246, 0.12)' : log.type.includes('Scan') ? 'rgba(20, 184, 166, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            color: log.type.includes('Vitals') ? '#60a5fa' : log.type.includes('Scan') ? 'var(--color-teal-light)' : '#f87171',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '9px',
                            fontWeight: 'bold'
                          }}>
                            {log.type}
                          </span>
                        </td>
                        <td style={{ padding: '8px 10px', color: '#e5e7eb', fontFamily: 'monospace', fontSize: '11px' }}>{log.details}</td>
                      </tr>
                    ));
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
        {activeRole === 'clinic' && !isFacilityPremium && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(3px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: '20px', zIndex: 10, textAlign: 'center'
          }}>
            <Lock size={24} className="text-teal-400" style={{ marginBottom: '8px' }} />
            <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem', color: 'white', fontWeight: 'bold' }}>Global Master Logs Directory Locked</h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0 0 16px 0', lineHeight: '1.4', maxWidth: '80%' }}>
              Upgrade to a Premium Clinic Account to unlock consolidated historic vitals entries, foot sole scans, and refill audits across all patients.
            </p>
            <button
              type="button"
              onClick={() => {
                setUpgradeTarget('clinic');
                setFacilityUpgradeModalOpen(true);
              }}
              style={{
                background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', border: 'none', color: 'black',
                padding: '8px 16px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer',
                boxShadow: '0 0 10px rgba(234, 179, 8, 0.2)'
              }}
            >
              👑 Unlock Premium Clinic Workspace
            </button>
          </div>
        )}
      </div>
      )}

      {/* Interactive Selected Patient Export Modal */}
      {exportPatient && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: '#111827', border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px', width: '100%', maxWidth: '650px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>
                  🗂️ Patient Data Directory: {exportPatient.name}
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Active patient records history and discrepancy auditing log.
                </p>
              </div>
              <button
                onClick={() => setExportPatient(null)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Export Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
              {(['vitals', 'scans', 'orders', 'json'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setExportTab(tab)}
                  style={{
                    flex: 1, padding: '12px', background: 'none', border: 'none',
                    borderBottom: exportTab === tab ? '2px solid var(--color-teal-light)' : 'none',
                    color: exportTab === tab ? 'white' : 'var(--text-muted)',
                    fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  {tab === 'vitals' ? '📈 Vitals' : tab === 'scans' ? '🦶 Foot Scans' : tab === 'orders' ? '💊 Refills' : '📋 Raw JSON'}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', overflowY: 'auto', maxHeight: '50vh', background: '#0d1117' }}>
              
              {exportTab === 'vitals' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', paddingBottom: '6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <span>LOG DATE</span>
                    <span>BLOOD PRESSURE (mmHg)</span>
                    <span>BLOOD GLUCOSE (mg/dL)</span>
                  </div>
                  {(exportPatient.bpHistory || []).map((bp, i) => {
                    const gl = (exportPatient.glucoseHistory || [])[i] || { level: 120, type: 'Fasting' };
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'white', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{bp.date}</span>
                        <strong style={{ color: '#60a5fa' }}>{bp.systolic}/{bp.diastolic} mmHg</strong>
                        <strong style={{ color: '#fb923c' }}>{gl.level} mg/dL ({gl.type})</strong>
                      </div>
                    );
                  })}
                </div>
              )}

              {exportTab === 'scans' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(exportPatient.footScanHistory || []).map((scan, i) => (
                    <div key={i} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                        <span>Scan Date: {scan.date}</span>
                        <span style={{ color: scan.hasHotspots ? '#f87171' : 'var(--color-teal-light)' }}>Risk Score: {scan.riskScore}%</span>
                      </div>
                      <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
                        Hotspots: {scan.hasHotspots ? '⚠️ Detected Sensory Redness clusters' : '✓ Normal sole circulatory structures.'}
                      </p>
                      <div style={{ marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        Recs: {scan.recommendations.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {exportTab === 'orders' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {orders.filter(o => o.patientId === exportPatient.id).map((order, i) => (
                    <div key={i} style={{ padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'white', marginBottom: '4px' }}>
                        <span>Refill Order ID: {order.id}</span>
                        <span>{order.date}</span>
                      </div>
                      <div style={{ color: 'var(--color-teal-light)', marginBottom: '4px' }}>
                        Items: <strong>{order.items.join(', ')}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                        <span>Total Paid: ₦{order.totalNaira.toLocaleString()}</span>
                        <span style={{ color: order.status === 'Delivered' ? '#34d399' : '#fb923c' }}>{order.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {exportTab === 'json' && (
                <pre style={{
                  margin: 0, padding: '12px', background: 'black',
                  color: '#34d399', fontSize: '0.7rem', borderRadius: '8px',
                  overflowX: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'monospace',
                  textAlign: 'left'
                }}>
                  {JSON.stringify({
                    profile: {
                      id: exportPatient.id,
                      name: exportPatient.name,
                      age: exportPatient.age,
                      weight: exportPatient.weight,
                      conditions: exportPatient.conditions,
                      activeMeds: exportPatient.activeMeds,
                      phone: exportPatient.phone,
                      address: exportPatient.address
                    },
                    vitals: {
                      bp: exportPatient.bpHistory,
                      glucose: exportPatient.glucoseHistory
                    },
                    footScans: exportPatient.footScanHistory,
                    refills: orders.filter(o => o.patientId === exportPatient.id)
                  }, null, 2)}
                </pre>
              )}

            </div>

            {/* Footer */}
            <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', background: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setExportPatient(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)', background: 'transparent', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Close Audit
              </button>
              
              {exportTab === 'json' ? (
                <button
                  onClick={() => {
                    const data = {
                      profile: exportPatient,
                      orders: orders.filter(o => o.patientId === exportPatient.id)
                    };
                    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
                    alert("Raw JSON Patient records copied to clipboard!");
                  }}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--color-teal-light)', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  📋 Copy JSON to Clipboard
                </button>
              ) : (
                <button
                  onClick={() => {
                    let csvContent = "";
                    if (exportTab === 'vitals') {
                      csvContent = "Date,Systolic,Diastolic,Glucose,Glucose Type\n" + (exportPatient.bpHistory || []).map((bp, i) => {
                        const gl = (exportPatient.glucoseHistory || [])[i] || { level: 120, type: 'Fasting' };
                        return `${bp.date},${bp.systolic},${bp.diastolic},${gl.level},${gl.type}`;
                      }).join("\n");
                    } else if (exportTab === 'scans') {
                      csvContent = "Date,Risk Score,Has Hotspots,Recommendations\n" + (exportPatient.footScanHistory || []).map(s => {
                        return `${s.date},${s.riskScore},${s.hasHotspots},"${s.recommendations.join('; ')}"`;
                      }).join("\n");
                    } else if (exportTab === 'orders') {
                      csvContent = "Refill ID,Date,Items,Price,Status\n" + orders.filter(o => o.patientId === exportPatient.id).map(o => {
                        return `${o.id},${o.date},"${o.items.join('; ')}",${o.totalNaira},${o.status}`;
                      }).join("\n");
                    }
                    
                    const encodedUri = "data:text/csv;charset=utf-8," + encodeURIComponent(csvContent);
                    const link = document.createElement("a");
                    link.setAttribute("href", encodedUri);
                    link.setAttribute("download", `diabp_patient_audit_${exportPatient.name.replace(/\s+/g, '_')}_${exportTab}.csv`);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--color-teal-light)', color: 'white', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  📥 Download CSV Log
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* B2B Facility Premium Upgrade Flutterwave Modal */}
      {facilityUpgradeModalOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: '#111827', border: '2px solid #eab308', borderRadius: '16px',
            width: '100%', maxWidth: '500px', boxShadow: '0 25px 50px -12px rgba(234, 179, 8, 0.15)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.05) 0%, rgba(0,0,0,0) 100%)'
            }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: '#eab308', fontWeight: 'bold' }}>
                👑 Upgrade to Premium {upgradeTarget === 'clinic' ? 'Clinic' : 'Pharmacy'} Plan
              </h3>
              <button 
                onClick={() => {
                  setFacilityUpgradeModalOpen(false);
                  setPaymentStep('form');
                  setPaymentError('');
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)', border: 'none', borderRadius: '50%',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'white', cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {paymentStep === 'form' && (
              <form onSubmit={handleUpgradeFacility} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Select Subscription Plan */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    Choose Your Subscription Plan
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div 
                      onClick={() => setSelectedPlan('monthly')}
                      style={{
                        padding: '12px', borderRadius: '10px',
                        border: selectedPlan === 'monthly' ? '2px solid #eab308' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: selectedPlan === 'monthly' ? 'rgba(234, 179, 8, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white' }}>Monthly License</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#eab308', margin: '4px 0' }}>
                        {upgradeTarget === 'clinic' ? '₦25,000' : '₦15,000'}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Billed Monthly</div>
                    </div>
                    <div 
                      onClick={() => setSelectedPlan('annual')}
                      style={{
                        padding: '12px', borderRadius: '10px',
                        border: selectedPlan === 'annual' ? '2px solid #eab308' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: selectedPlan === 'annual' ? 'rgba(234, 179, 8, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s ease', position: 'relative'
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: '-8px', right: '10px',
                        background: '#eab308', color: 'black', padding: '1px 6px',
                        borderRadius: '100px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase'
                      }}>
                        Save 17%
                      </span>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white' }}>Annual License</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#eab308', margin: '4px 0' }}>
                        {upgradeTarget === 'clinic' ? '₦250,000' : '₦150,000'}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Billed Yearly</div>
                    </div>
                  </div>
                </div>

                {/* Secure Card Payment Section */}
                <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                    <CreditCard size={14} className="text-teal-400" />
                    <span style={{ fontSize: '0.75rem', color: 'white', fontWeight: 'bold' }}>DiaBP Pay (powered by Amphy)</span>
                  </div>
                  
                  <div style={{
                    fontSize: '0.62rem',
                    color: '#eab308',
                    background: 'rgba(234, 179, 8, 0.06)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(234, 179, 8, 0.15)',
                    marginBottom: '12px',
                    lineHeight: '1.3',
                    textAlign: 'left'
                  }}>
                    ⚡ Powered by <strong>Flutterwave Secure Checkout</strong>
                  </div>

                  {paymentError && (
                    <div style={{
                      padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)', color: '#f87171',
                      borderRadius: '6px', fontSize: '0.75rem', marginBottom: '12px'
                    }}>
                      {paymentError}
                    </div>
                  )}

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Billing Contact Name</label>
                      <input 
                        type="text" 
                        placeholder={upgradeTarget === 'clinic' ? 'Medical Director / Clinician' : 'Head Pharmacist / Manager'}
                        value={billingName}
                        onChange={(e) => setBillingName(e.target.value)}
                        required
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Billing Email Address</label>
                      <input 
                        type="email" 
                        placeholder="billing@facility.com"
                        value={billingEmail}
                        onChange={(e) => setBillingEmail(e.target.value)}
                        required
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem'
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={12} className="text-teal-400" /> Secure SSL Connection
                  </span>
                  <span>Total Due: {selectedPlan === 'monthly' ? (upgradeTarget === 'clinic' ? '₦25,000' : '₦15,000') : (upgradeTarget === 'clinic' ? '₦250,000' : '₦150,000')}</span>
                </div>

                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                    border: 'none', color: 'black', padding: '12px', borderRadius: '8px',
                    fontSize: '0.85rem', fontWeight: 'bold', cursor: 'pointer', marginTop: '8px',
                    boxShadow: '0 4px 12px rgba(234, 179, 8, 0.25)', transition: 'transform 0.1s ease'
                  }}
                >
                  Pay & Activate Facility License
                </button>
              </form>
            )}

            {paymentStep === 'processing' && (
              <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '300px' }}>
                <div style={{
                  width: '50px', height: '50px', border: '3px solid rgba(234, 179, 8, 0.2)',
                  borderTop: '3px solid #eab308', borderRadius: '50%'
                }} className="spinner-icon"></div>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'white', fontWeight: 'bold' }}>Verifying Transaction</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Communicating securely with Flutterwave. Please do not refresh.</p>
                </div>
              </div>
            )}

            {paymentStep === 'success' && (
              <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '300px' }}>
                <div style={{
                  width: '50px', height: '50px', background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #10b981'
                }}>
                  <ShieldCheck size={28} className="text-emerald-400" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#10b981', fontWeight: 'bold' }}>Upgrade Successful!</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Your premium facility license is active. Full administrative tools unlocked.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Payout Settings Modal */}
      {editingPayout && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: '#111827', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px',
            width: '100%', maxWidth: '450px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                💳 Payout & Settlement Settings
              </h3>
              <button 
                onClick={() => setEditingPayout(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)', border: 'none', borderRadius: '50%',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'white', cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* Tab Selector */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              background: 'rgba(0, 0, 0, 0.2)'
            }}>
              <button
                type="button"
                onClick={() => {
                  setPayoutTab('automatic');
                  setCreateSubaccountError('');
                  setCreateSubaccountSuccess('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: payoutTab === 'automatic' ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: 'none',
                  borderBottom: payoutTab === 'automatic' ? '2px solid var(--color-teal-light)' : '2px solid transparent',
                  color: payoutTab === 'automatic' ? 'white' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ⚡ Automatic Generation
              </button>
              <button
                type="button"
                onClick={() => {
                  setPayoutTab('manual');
                  setCreateSubaccountError('');
                  setCreateSubaccountSuccess('');
                }}
                style={{
                  flex: 1,
                  padding: '12px',
                  background: payoutTab === 'manual' ? 'rgba(255,255,255,0.04)' : 'transparent',
                  border: 'none',
                  borderBottom: payoutTab === 'manual' ? '2px solid var(--color-teal-light)' : '2px solid transparent',
                  color: payoutTab === 'manual' ? 'white' : 'var(--text-secondary)',
                  fontSize: '0.75rem',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
              >
                ✏️ Manual Subaccount ID
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePayout} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {payoutTab === 'automatic' ? (
                <>
                  <div style={{
                    fontSize: '0.7rem',
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.06)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(16, 185, 129, 0.15)',
                    lineHeight: '1.4'
                  }}>
                    💡 <strong>Automatic Payout setup:</strong> Simply choose your bank, enter your account number, and we will programmatically register your settlement channel on Flutterwave. 0% manual merchant setup required!
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                      Select Bank
                    </label>
                    <select
                      value={bankCode}
                      onChange={(e) => setBankCode(e.target.value)}
                      style={{
                        background: '#1f2937', border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '0.8rem', outline: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      {NIGERIAN_BANKS.map(bank => (
                        <option key={bank.code} value={bank.code}>{bank.name}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                      Bank Account Number (10 Digits)
                    </label>
                    <input 
                      type="text"
                      maxLength={10}
                      placeholder="e.g. 0123456789"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '0.8rem', outline: 'none'
                      }}
                    />
                    
                    {/* Real-time verification status */}
                    {isResolvingAccount && (
                      <div style={{ fontSize: '0.7rem', color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <svg style={{ width: '12px', height: '12px', animation: 'spin 1s linear infinite', display: 'inline-block' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying details with bank...
                      </div>
                    )}
                    
                    {resolvedAccountName && (
                      <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 'bold', marginTop: '2px', background: 'rgba(16, 185, 129, 0.04)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
                        ✓ Account Name: {resolvedAccountName}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                      Payout Notification Email
                    </label>
                    <input 
                      type="email"
                      placeholder="billing@yourfacility.com"
                      value={payoutEmail}
                      onChange={(e) => setPayoutEmail(e.target.value)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '0.8rem', outline: 'none'
                      }}
                    />
                  </div>

                  {createSubaccountError && (
                    <div style={{ color: '#ef4444', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      ❌ {createSubaccountError}
                    </div>
                  )}

                  {createSubaccountSuccess && (
                    <div style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 'bold' }}>
                      ✓ {createSubaccountSuccess}
                    </div>
                  )}

                  {tempSubaccountId && (
                    <div style={{ 
                      fontSize: '0.7rem', color: 'var(--text-secondary)',
                      background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '6px',
                      border: '1px dashed rgba(255,255,255,0.1)'
                    }}>
                      Current Assigned ID: <code style={{ color: '#60a5fa' }}>{tempSubaccountId}</code>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={isCreatingSubaccount || accountNumber.length < 10 || isResolvingAccount || !resolvedAccountName}
                    onClick={handleCreateSubaccount}
                    style={{
                      background: 'var(--color-teal-light)', border: 'none', color: 'white',
                      borderRadius: '8px', padding: '10px 16px', fontSize: '0.75rem', fontWeight: 'bold', 
                      cursor: accountNumber.length < 10 || isCreatingSubaccount || isResolvingAccount || !resolvedAccountName ? 'not-allowed' : 'pointer',
                      opacity: accountNumber.length < 10 || isCreatingSubaccount || isResolvingAccount || !resolvedAccountName ? 0.6 : 1,
                      display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                    }}
                  >
                    {isCreatingSubaccount ? (
                      <>
                        <svg style={{ width: '14px', height: '14px', marginRight: '6px', animation: 'spin 1s linear infinite', display: 'inline-block', verticalAlign: 'middle' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Registering Bank...
                      </>
                    ) : 'Register Account & Generate Payouts'}
                  </button>
                </>
              ) : (
                <>
                  <div style={{
                    fontSize: '0.7rem',
                    color: '#60a5fa',
                    background: 'rgba(59, 130, 246, 0.06)',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.15)',
                    lineHeight: '1.4'
                  }}>
                    ℹ️ <strong>Manual Flutterwave Subaccount:</strong> If you already have an existing Flutterwave Subaccount ID (e.g. <code>RS_C8A8E89B...</code>), paste it below to link your settlement bank instantly.
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                      Flutterwave Subaccount ID
                    </label>
                    <input 
                      type="text" 
                      placeholder="e.g. RS_D3E2F4..."
                      value={tempSubaccountId}
                      onChange={(e) => setTempSubaccountId(e.target.value)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '0.8rem', outline: 'none'
                      }}
                    />
                  </div>
                </>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setEditingPayout(false)}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)',
                    borderRadius: '8px', padding: '8px 16px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'var(--color-teal-light)', border: 'none', color: 'white',
                    borderRadius: '8px', padding: '8px 16px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  Confirm & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Patient Check-in Modal */}
      {showCheckInModal && checkInPatient && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center',
          zIndex: 9999, padding: '20px'
        }}>
          <div style={{
            background: '#111827', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '16px',
            width: '100%', maxWidth: '480px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              padding: '20px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <h3 style={{ margin: 0, fontSize: '1rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ⚡ Patient Check-in / BP & Glucose Log
              </h3>
              <button 
                onClick={() => {
                  setShowCheckInModal(false);
                  setGeneratedWhatsAppUrl(null);
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)', border: 'none', borderRadius: '50%',
                  width: '28px', height: '28px', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', color: 'white', cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Logging vitals for: <strong style={{ color: 'white' }}>{checkInPatient.name}</strong>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                    Systolic BP (mmHg)
                  </label>
                  <input 
                    type="number"
                    value={checkInBpSystolic}
                    onChange={(e) => setCheckInBpSystolic(parseInt(e.target.value) || 120)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '0.8rem', outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                    Diastolic BP (mmHg)
                  </label>
                  <input 
                    type="number"
                    value={checkInBpDiastolic}
                    onChange={(e) => setCheckInBpDiastolic(parseInt(e.target.value) || 80)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '0.8rem', outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                    Blood Glucose (mg/dL)
                  </label>
                  <input 
                    type="number"
                    value={checkInGlucose}
                    onChange={(e) => setCheckInGlucose(parseInt(e.target.value) || 0)}
                    style={{
                      background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '0.8rem', outline: 'none'
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                    Glucose Type
                  </label>
                  <select
                    value={checkInGlucoseType}
                    onChange={(e) => setCheckInGlucoseType(e.target.value as 'Fasting' | 'Post-Meal')}
                    style={{
                      background: '#1f2937', border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px', padding: '10px 12px', color: 'white', fontSize: '0.8rem', outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="Fasting">Fasting</option>
                    <option value="Post-Meal">Post-Meal</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input 
                  type="checkbox"
                  id="sendWhatsApp"
                  checked={sendWhatsAppChecked}
                  onChange={(e) => setSendWhatsAppChecked(e.target.checked)}
                  style={{ accentColor: '#10b981', cursor: 'pointer' }}
                />
                <label htmlFor="sendWhatsApp" style={{ fontSize: '0.75rem', color: 'white', cursor: 'pointer' }}>
                  Generate WhatsApp Health Vitals Link
                </label>
              </div>

              {generatedWhatsAppUrl && (
                <div style={{
                  background: 'rgba(7, 94, 84, 0.15)',
                  border: '1px solid rgba(7, 94, 84, 0.3)',
                  borderRadius: '8px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  marginTop: '8px'
                }}>
                  <div style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 'bold' }}>
                    ✓ WhatsApp URL generated!
                  </div>
                  <div style={{ 
                    fontSize: '0.65rem', color: 'var(--text-secondary)',
                    maxHeight: '60px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '4px'
                  }}>
                    {decodeURIComponent(generatedWhatsAppUrl.split('text=')[1] || '')}
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <a 
                      href={generatedWhatsAppUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        flex: 1,
                        background: '#25d366',
                        color: 'black',
                        textAlign: 'center',
                        textDecoration: 'none',
                        borderRadius: '6px',
                        padding: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        display: 'inline-block'
                      }}
                    >
                      📱 Send to WhatsApp Web
                    </a>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(generatedWhatsAppUrl);
                        alert("WhatsApp Web link copied to clipboard!");
                      }}
                      style={{
                        background: 'rgba(255, 255, 255, 0.08)',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        color: 'white',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      📋 Copy Link
                    </button>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowCheckInModal(false);
                    setGeneratedWhatsAppUrl(null);
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-secondary)',
                    borderRadius: '8px', padding: '8px 16px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={checkInSaving}
                  onClick={async () => {
                    if (!checkInPatient) return;
                    setCheckInSaving(true);
                    try {
                      // Import logVitalsForPatient directly in component scope or use wrapper
                      const { logVitalsForPatient: logVitals } = await import('../services/ncdService');
                      await logVitals(
                        checkInPatient.id || '',
                        checkInBpSystolic,
                        checkInBpDiastolic,
                        checkInGlucose,
                        checkInGlucoseType
                      );

                      if (sendWhatsAppChecked) {
                        const facilityName = activeRole === 'clinic' ? activeClinic?.name : activePharmacy?.name;
                        const messageText = `Hello ${checkInPatient.name},\n\nThis is a quick summary of your check-in vitals at *${facilityName}*:\n\n📈 *BP:* ${checkInBpSystolic}/${checkInBpDiastolic} mmHg\n🩸 *Glucose:* ${checkInGlucose > 0 ? `${checkInGlucose} mg/dL (${checkInGlucoseType})` : 'N/A'}\n\nTo view your historical charts or check your SafeMeds refill schedules, launch your assistant here: https://diabpcopilot.com/?patient_id=${checkInPatient.id}`;
                        const phone = checkInPatient.phone || '';
                        const cleanPhone = phone.replace(/\D/g, '').replace(/^0/, '234');
                        const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
                        setGeneratedWhatsAppUrl(waUrl);
                      } else {
                        setShowCheckInModal(false);
                      }

                      if (onRefreshData) onRefreshData();
                    } catch (e) {
                      console.error("Check-in save failed:", e);
                    } finally {
                      setCheckInSaving(false);
                    }
                  }}
                  style={{
                    background: 'var(--color-teal-light)', border: 'none', color: 'white',
                    borderRadius: '8px', padding: '8px 16px', fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer',
                    opacity: checkInSaving ? 0.6 : 1
                  }}
                >
                  {checkInSaving ? 'Saving...' : 'Save & Generate Link'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

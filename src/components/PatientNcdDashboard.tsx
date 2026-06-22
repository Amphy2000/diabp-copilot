import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  Activity, 
  AlertTriangle, 
  Camera, 
  Upload, 
  Clock, 
  CheckCircle,
  Plus,
  Compass,
  Phone,
  MapPin,
  ShoppingBag,
  Lock,
  ShieldCheck,
  CreditCard,
  Circle,
  ArrowRight,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import { 
  evaluateNcdRisk, 
  analyzeFootImage,
  logVitalsEntry,
  logFootScanRecord,
  getSystemAlerts,
  getRefillTracker
} from '../services/ncdService';
import type { PatientNcdProfile, FootScanRecord, NcdClinic, NcdPharmacy, NcdAlert, NcdRefillOrder } from '../services/ncdService';

interface PatientNcdDashboardProps {
  profile: PatientNcdProfile;
  onUpdateProfile: (updated: PatientNcdProfile) => void;
  clinics: NcdClinic[];
  pharmacies: NcdPharmacy[];
  orders: NcdRefillOrder[];
  onNavigateToRefill: () => void;
}

export const PatientNcdDashboard: React.FC<PatientNcdDashboardProps> = ({ profile, onUpdateProfile, clinics, pharmacies, orders, onNavigateToRefill }) => {
  // Input fields
  const [systolic, setSystolic] = useState<number>(140);
  const [diastolic, setDiastolic] = useState<number>(90);
  const [glucose, setGlucose] = useState<number>(130);
  const [glucoseType, setGlucoseType] = useState<'Fasting' | 'Post-Meal'>('Fasting');
  const [logMessage, setLogMessage] = useState<string | null>(null);

  // Reminders states
  const [dailyRemindersEnabled, setDailyRemindersEnabled] = useState<boolean>(() => {
    return localStorage.getItem('daily_reminders_enabled') !== 'false';
  });
  const [reminderTime, setReminderTime] = useState<string>(() => {
    return localStorage.getItem('daily_reminder_time') || '08:00';
  });
  const [reminderFeedback, setReminderFeedback] = useState<string | null>(null);
  const [collapsedReminders, setCollapsedReminders] = useState(true);

  // Background check for daily reminder schedule
  useEffect(() => {
    if (!dailyRemindersEnabled) return;

    const checkReminder = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      if (currentTimeStr === reminderTime) {
        const todayStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const hasLoggedToday = 
          (profile.bpHistory || []).some(bp => bp.date === todayStr) || 
          (profile.glucoseHistory || []).some(gl => gl.date === todayStr);

        if (!hasLoggedToday) {
          const todayDateStr = now.toDateString();
          const lastReminderDate = localStorage.getItem('last_reminder_date');
          if (lastReminderDate !== todayDateStr) {
            localStorage.setItem('last_reminder_date', todayDateStr);
            const title = "⏰ Daily Health Check-in";
            const body = `Time to log your blood pressure and glucose readings to keep your ${profile.streakDays || 0}-day care streak active!`;

            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'SHOW_NOTIFICATION',
                title,
                body
              });
            } else if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(title, {
                body,
                icon: '/favicon.svg'
              });
            }
          }
        }
      }
    };

    // Run check immediately and then every 30 seconds
    checkReminder();
    const interval = setInterval(checkReminder, 30000);
    return () => clearInterval(interval);
  }, [dailyRemindersEnabled, reminderTime, profile.bpHistory, profile.glucoseHistory, profile.streakDays]);

  const handleTestReminder = () => {
    if ('Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            triggerNotification();
          } else {
            setReminderFeedback("⚠️ Notification permission was denied.");
            setTimeout(() => setReminderFeedback(null), 3000);
          }
        });
      } else if (Notification.permission === 'granted') {
        triggerNotification();
      } else {
        setReminderFeedback("⚠️ Notifications are blocked by your browser settings.");
        setTimeout(() => setReminderFeedback(null), 3000);
      }
    } else {
      setReminderFeedback("⚠️ Your browser does not support notifications.");
      setTimeout(() => setReminderFeedback(null), 3000);
    }

    function triggerNotification() {
      const title = "⏰ Daily Health Check-in (Test)";
      const body = `Time to log your blood pressure and glucose readings to keep your ${profile.streakDays || 0}-day care streak active!`;

      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body
        });
      } else {
        new Notification(title, {
          body,
          icon: '/favicon.svg'
        });
      }
      setReminderFeedback("⚡ Test notification sent! Check your screen/notification tray.");
      setTimeout(() => setReminderFeedback(null), 4000);
    }
  };

  const handleSaveReminderPreferences = (enabled: boolean, time: string) => {
    setDailyRemindersEnabled(enabled);
    setReminderTime(time);
    localStorage.setItem('daily_reminders_enabled', String(enabled));
    localStorage.setItem('daily_reminder_time', time);
    
    if (enabled && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }

    setReminderFeedback("✓ Reminder preferences saved successfully.");
    setTimeout(() => setReminderFeedback(null), 3000);
  };

  // Contact editing states
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editPhone, setEditPhone] = useState(profile.phone || '');
  const [editAddress, setEditAddress] = useState(profile.address || '');

  // Premium subscription states
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [billingName, setBillingName] = useState('');
  const [billingEmail, setBillingEmail] = useState('');
  const [paymentStep, setPaymentStep] = useState<'form' | 'processing' | 'success'>('form');
  const [paymentError, setPaymentError] = useState('');

  // Onboarding guide states
  const [collapsedOnboarding, setCollapsedOnboarding] = useState<boolean>(() => {
    const saved = localStorage.getItem('onboarding_collapsed');
    if (saved !== null) {
      return saved === 'true';
    }
    const hasPhone = !!profile.phone;
    const hasLoggedVitals = (profile.bpHistory || []).length > 5;
    const hasCareTeam = !!profile.assignedClinicId || !!profile.assignedPharmacyId;
    const hasFootScan = (profile.footScanHistory || []).length > 1;
    const done = hasPhone && hasLoggedVitals && hasCareTeam && hasFootScan;
    return done;
  });

  const toggleOnboarding = () => {
    setCollapsedOnboarding(prev => {
      localStorage.setItem('onboarding_collapsed', (!prev).toString());
      return !prev;
    });
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleUpgradeSubscription = (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingName || !billingEmail) {
      setPaymentError("Please enter your billing name and email.");
      return;
    }
    setPaymentError("");
    setPaymentStep('processing');

    const amount = selectedPlan === 'monthly' ? 1500 : 15000;
    const txRef = `flw-patient-${profile.id}-${Date.now()}`;

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
        phonenumber: profile.phone || undefined,
      },
      customizations: {
        title: "DiaBP Pay",
        description: "Upgrade Patient Account to Premium Plan",
      },
      meta: {
        facility_type: "patient",
        facility_id: profile.id,
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

          await onUpdateProfile({
            ...profile,
            isPremium: true,
            premiumExpiry: expiryDate.toLocaleDateString()
          });

          setTimeout(() => {
            setUpgradeModalOpen(false);
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

  // Collapsible cards state
  const [collapsedAlerts, setCollapsedAlerts] = useState(false);
  const [collapsedVitals, setCollapsedVitals] = useState(false);
  const [collapsedRecs, setCollapsedRecs] = useState(false);

  // System Notifications
  const [alerts, setAlerts] = useState<NcdAlert[]>([]);
  
  useEffect(() => {
    getSystemAlerts().then(setAlerts);
  }, [profile]);

  useEffect(() => {
    setEditPhone(profile.phone || '');
    setEditAddress(profile.address || '');
  }, [profile.phone, profile.address]);

  // Foot scanner simulation states
  const [scanning, setScanning] = useState<boolean>(false);
  const footHistory = profile.footScanHistory || [];
  const [scanRecord, setScanRecord] = useState<FootScanRecord | null>(
    footHistory.length > 0 ? footHistory[footHistory.length - 1] : null
  );

  // Evaluate current risk indicators based on profile values
  const bpHistoryArr = profile.bpHistory || [];
  const currentBp = bpHistoryArr.length > 0 ? bpHistoryArr[bpHistoryArr.length - 1] : { systolic: 120, diastolic: 80 };
  const glucoseHistoryArr = profile.glucoseHistory || [];
  const currentGlucose = glucoseHistoryArr.length > 0 ? glucoseHistoryArr[glucoseHistoryArr.length - 1] : { level: 100, type: 'Fasting' as const };
  
  const riskEval = evaluateNcdRisk(
    currentBp.systolic,
    currentBp.diastolic,
    currentGlucose.level,
    currentGlucose.type as any
  );

  // Stabilization and improvement analytics
  const bpHistory = profile.bpHistory || [];
  let bpStabilizationText = "Log vitals daily to see stabilization trends.";
  let bpStabPercent = 0;
  if (bpHistory.length >= 2) {
    const initialSystolic = bpHistory[0].systolic;
    const latestSystolic = bpHistory[bpHistory.length - 1].systolic;
    if (initialSystolic > latestSystolic) {
      bpStabPercent = Math.round(((initialSystolic - latestSystolic) / initialSystolic) * 100);
      bpStabilizationText = `BP stabilized by ${bpStabPercent}% (Systolic reduced from ${initialSystolic} to ${latestSystolic} mmHg)`;
    } else if (initialSystolic === latestSystolic) {
      bpStabilizationText = `BP stabilized & consistent at ${latestSystolic} mmHg`;
    } else {
      bpStabilizationText = `BP fluctuations monitored. Current: ${latestSystolic} mmHg (Baseline: ${initialSystolic} mmHg)`;
    }
  }

  const glucoseHistory = profile.glucoseHistory || [];
  let glucoseStabilizationText = "Log glucose to track stabilization trends.";
  let glucoseStabPercent = 0;
  if (glucoseHistory.length >= 2) {
    const initialGluc = glucoseHistory[0].level;
    const latestGluc = glucoseHistory[glucoseHistory.length - 1].level;
    if (initialGluc > latestGluc) {
      glucoseStabPercent = Math.round(((initialGluc - latestGluc) / initialGluc) * 100);
      glucoseStabilizationText = `Glucose levels improved by ${glucoseStabPercent}% (from ${initialGluc} to ${latestGluc} mg/dL)`;
    } else if (initialGluc === latestGluc) {
      glucoseStabilizationText = `Glucose stable at ${latestGluc} mg/dL`;
    } else {
      glucoseStabilizationText = `Glucose levels fluctuate. Current: ${latestGluc} mg/dL (Baseline: ${initialGluc} mg/dL)`;
    }
  }

  const streakDays = profile.streakDays || 0;
  let streakMilestoneText = "";
  if (streakDays >= 30) {
    streakMilestoneText = "🏆 Champion of Health (30-day streak landmark reached!)";
  } else if (streakDays >= 14) {
    streakMilestoneText = "🛡️ Habits Master (14-day streak achieved!)";
  } else if (streakDays >= 7) {
    streakMilestoneText = "🔥 Weekly Warrior (7-day care routine maintained!)";
  } else if (streakDays >= 3) {
    streakMilestoneText = "🌱 Seedling (3-day vitals streak reached!)";
  } else {
    streakMilestoneText = `🚀 Care Starter (${streakDays} days active. Log daily to reach 3-day milestone!)`;
  }

  // Handle logging a new BP / Glucose reading
  const handleLogVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Persist to DB / LocalStorage
    await logVitalsEntry(systolic, diastolic, glucose, glucoseType);
    
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const bpHist = profile.bpHistory || [];
    const glucoseHist = profile.glucoseHistory || [];
    const updatedBpHistory = [...bpHist, { date: today, systolic, diastolic }];
    const updatedGlucoseHistory = [...glucoseHist, { date: today, level: glucose, type: glucoseType }];

    const newStreakDays = (profile.streakDays || 0) + 1;

    onUpdateProfile({
      ...profile,
      bpHistory: updatedBpHistory,
      glucoseHistory: updatedGlucoseHistory,
      streakDays: newStreakDays
    });

    // Send broadcast message to notify clinicians
    try {
      const channel = new BroadcastChannel('diabp-copilot-channel');
      channel.postMessage({
        type: 'VITALS_LOGGED',
        payload: {
          patientId: profile.id,
          patientName: profile.name,
          systolic,
          diastolic,
          glucose,
          glucoseType,
          streakDays: newStreakDays
        }
      });
      channel.close();
    } catch (err) {
      console.error("Failed to broadcast vital logging event:", err);
    }

    setLogMessage("Vitals logged successfully. AI risk calculations updated.");
    setTimeout(() => setLogMessage(null), 3000);
  };

  // Simulating foot scan
  const handleFootPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setScanning(true);
      
      // Simulate scanner animation delay
      setTimeout(async () => {
        const result = await analyzeFootImage(file);
        setScanRecord(result);
        setScanning(false);
        
        // Persist to DB / LocalStorage
        await logFootScanRecord(result);
        
        // Append to profile history
        onUpdateProfile({
          ...profile,
          footScanHistory: [...(profile.footScanHistory || []), result]
        });
      }, 2500);
    }
  };

  const getRiskClass = (risk: 'Low' | 'Medium' | 'High' | 'Emergency') => {
    return risk.toLowerCase();
  };

  return (
    <div className="space-y-6 animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Patient Header Box */}
      <div className="glass-panel patient-header-card">
        <div className="patient-profile">
          <h2>
            {profile.name}
            <span className="profile-badge">Active Patient</span>
            {profile.isPremium ? (
              <span className="profile-badge" style={{ background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', color: 'black', marginLeft: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid #fef08a', fontWeight: 'bold' }}>
                👑 Premium Member
              </span>
            ) : (
              <span className="profile-badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', marginLeft: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
                DiaBP Basic
              </span>
            )}
          </h2>
          <div className="patient-tags" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {(profile.conditions || []).map((cond, idx) => (
                <span key={idx} className="tag-item">
                  • {cond}
                </span>
              ))}
              <span className="tag-item">
                Age: {profile.age} | Wt: {profile.weight}kg
              </span>
              {!profile.isPremium && (
                <button
                  onClick={() => setUpgradeModalOpen(true)}
                  style={{
                    background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                    border: 'none',
                    color: 'black',
                    padding: '3px 8.5px',
                    borderRadius: '100px',
                    fontSize: '0.65rem',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginLeft: '8px',
                    boxShadow: '0 0 10px rgba(234, 179, 8, 0.3)',
                    transition: 'transform 0.15s ease'
                  }}
                >
                  👑 Go Premium
                </button>
              )}
            </div>

            {isEditingContact ? (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                <input 
                  type="text" 
                  value={editPhone} 
                  onChange={(e) => setEditPhone(e.target.value)} 
                  placeholder="Phone Number"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: 'white', fontSize: '0.75rem', width: '130px' }}
                />
                <input 
                  type="text" 
                  value={editAddress} 
                  onChange={(e) => setEditAddress(e.target.value)} 
                  placeholder="Delivery Address"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '4px 8px', color: 'white', fontSize: '0.75rem', width: '200px' }}
                />
                <button 
                  onClick={async () => {
                    await onUpdateProfile({ ...profile, phone: editPhone, address: editAddress });
                    setIsEditingContact(false);
                  }}
                  style={{ background: '#14b8a6', border: 'none', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  Save
                </button>
                <button 
                  onClick={() => {
                    setEditPhone(profile.phone || '');
                    setEditAddress(profile.address || '');
                    setIsEditingContact(false);
                  }}
                  style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', borderRadius: '6px', fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Phone size={12} className="text-teal-400" /> {profile.phone || 'No Phone Set'}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><MapPin size={12} className="text-blue-400" /> {profile.address || 'No Address Set'}</span>
                <button 
                  onClick={() => setIsEditingContact(true)}
                  style={{ background: 'transparent', border: 'none', color: '#14b8a6', padding: 0, textDecoration: 'underline', fontSize: '0.7rem', cursor: 'pointer' }}
                >
                  Edit Contact Details
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Adherence Streak */}
        <div className="streak-card">
          <Heart className="w-5 h-5 streak-icon" />
          <div>
            <div className="streak-title">Log Adherence Streak</div>
            <div className="streak-value">{profile.streakDays} Days Active</div>
          </div>
        </div>
      </div>

      {/* Daily check-in reminder banner if they haven't logged today */}
      {(() => {
        const todayStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const hasLoggedToday = 
          (profile.bpHistory || []).some(bp => bp.date === todayStr) || 
          (profile.glucoseHistory || []).some(gl => gl.date === todayStr);
          
        if (hasLoggedToday) return null;
        
        return (
          <div style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(251, 146, 60, 0.1) 100%)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            padding: '16px 20px',
            borderRadius: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px',
            boxShadow: '0 4px 15px rgba(239, 68, 68, 0.08)',
            animation: 'pulse 2s infinite ease-in-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171',
                flexShrink: 0
              }}>
                <Clock className="w-5 h-5 animate-bounce" />
              </div>
              <div style={{ textAlign: 'left' }}>
                <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'white', fontWeight: 'bold' }}>
                  ⏰ Daily Health Check-in Overdue!
                </h4>
                <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                  You have not logged your readings today. Record your vitals now to keep your <strong>{profile.streakDays || 0}-day</strong> streak alive!
                </p>
              </div>
            </div>
            <button
              onClick={() => scrollToSection('vitals-form')}
              style={{
                background: '#ef4444',
                border: 'none',
                color: 'white',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              Record Vitals <ArrowRight size={12} />
            </button>
          </div>
        );
      })()}

      {/* Onboarding Quickstart Guide */}
      {(() => {
        const hasPhone = !!profile.phone;
        const hasLoggedVitals = (profile.bpHistory || []).length > 5;
        const hasCareTeam = !!profile.assignedClinicId || !!profile.assignedPharmacyId;
        const hasFootScan = (profile.footScanHistory || []).length > 1;
        const hasOrder = orders.length > 0;

        const envWhatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || '+1 415 523 8886';
        const envWhatsappKeyword = import.meta.env.VITE_WHATSAPP_KEYWORD || 'join bet-sense';
        const isSandbox = envWhatsappNumber.includes('415 523 8886');
        const waCleanNumber = envWhatsappNumber.replace(/\s+/g, '').replace(/[^\d+]/g, '');
        const waTextParam = encodeURIComponent(envWhatsappKeyword);
        const actionUrl = `https://wa.me/${waCleanNumber.replace('+', '')}?text=${waTextParam}`;

        const onboardingSteps = [
          {
            id: 'phone',
            title: 'Link WhatsApp Bot',
            description: 'Connect your phone to receive daily dose nudges and log vitals via text message.',
            instructions: isSandbox 
              ? `Send "${envWhatsappKeyword}" to ${envWhatsappNumber} on WhatsApp.`
              : `Send any message to our Care Line at ${envWhatsappNumber} on WhatsApp.`,
            isCompleted: hasPhone,
            actionLabel: 'Link WhatsApp Now',
            actionUrl: actionUrl
          },
          {
            id: 'vitals',
            title: 'Log Your First Readings',
            description: 'Record your blood pressure and sugar levels to activate your automated NCD risk evaluation.',
            instructions: 'Use the readings form below, or reply to the WhatsApp bot.',
            isCompleted: hasLoggedVitals,
            actionLabel: 'Go to Vitals Form',
            actionClick: () => scrollToSection('vitals-form')
          },
          {
            id: 'team',
            title: 'Select Your Care Team',
            description: 'Link your clinic or pharmacy to coordinate refills and physician consultations.',
            instructions: 'Select your doctor clinic and preferred refill pharmacy below.',
            isCompleted: hasCareTeam,
            actionLabel: 'Select Care Team',
            actionClick: () => scrollToSection('care-team-form')
          },
          {
            id: 'foot',
            title: 'Perform AI Foot Scan',
            description: 'Upload a picture of your foot sole to scan for Neuropathic high-pressure hotspots.',
            instructions: 'Upload a picture under the AI Diabetic Foot Scan panel.',
            isCompleted: hasFootScan,
            actionLabel: 'Open Foot Scanner',
            actionClick: () => scrollToSection('foot-scanner')
          },
          {
            id: 'refill',
            title: 'Order First Refill',
            description: 'Request your first monthly chronic care medication bundle delivered directly to your door.',
            instructions: 'Navigate to the SafeMeds Refills tab above to place your delivery order.',
            isCompleted: hasOrder,
            actionLabel: 'Go to Refills Shop',
            actionClick: onNavigateToRefill
          }
        ];

        const completedSteps = onboardingSteps.filter(s => s.isCompleted).length;
        const onboardingProgress = Math.round((completedSteps / onboardingSteps.length) * 100);

        return (
          <div className="glass-panel" style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '24px',
            position: 'relative',
            overflow: 'hidden'
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
                  Quickstart Guide: Complete Your Self-Onboarding
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Complete the following {onboardingSteps.length} steps to link your care cycle and get the most out of your health copilot.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'white', background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  Progress: {completedSteps}/{onboardingSteps.length} Completed
                </span>
                <button
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
                  const IconComponent = step.id === 'phone' ? Phone : step.id === 'vitals' ? Activity : step.id === 'team' ? Compass : step.id === 'refill' ? ShoppingBag : Camera;
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
                      ) : step.actionUrl ? (
                        <a
                          href={step.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            background: '#25D366', // WhatsApp green
                            color: 'black',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '6px 12px',
                            fontSize: '0.72rem',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            textDecoration: 'none',
                            textAlign: 'center',
                            boxShadow: '0 4px 10px rgba(37, 211, 102, 0.2)',
                            transition: 'transform 0.15s ease'
                          }}
                          onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                          onMouseOut={(e) => e.currentTarget.style.transform = 'none'}
                        >
                          <MessageSquare size={12} /> {step.actionLabel}
                        </a>
                      ) : (
                        <button
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

      {logMessage && (
        <div className="p-4 bg-teal-900/20 border border-teal-500/30 text-teal-300 rounded-xl text-sm font-semibold text-center">
          {logMessage}
        </div>
      )}

      {/* Refill Supply Tracker Card */}
      {(() => {
        const tracker = getRefillTracker(profile.id || 'mock-patient-default', orders);
        const percentRemaining = Math.min(100, Math.round((tracker.daysRemaining / 30) * 100));
        const colorClass = tracker.status === 'Overdue' ? '#f87171' : tracker.status === 'Low Supply' ? '#fb923c' : 'var(--color-teal-light)';
        
        return (
          <div className="glass-panel" style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.5) 0%, rgba(15, 23, 42, 0.5) 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '20px',
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
            marginBottom: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '250px' }}>
              {/* Circular conic progress indicator */}
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                background: `conic-gradient(${colorClass} ${percentRemaining}%, rgba(255,255,255,0.06) ${percentRemaining}% 100%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(0,0,0,0.3)',
                position: 'relative',
                flexShrink: 0
              }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: '#0d131f',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column'
                }}>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white' }}>{tracker.daysRemaining}</span>
                  <span style={{ fontSize: '7px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>days</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  💊 SafeMeds Refill Adherence Tracker
                </h4>
                {tracker.lastRefillDate ? (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Last filled on <strong>{tracker.lastRefillDate}</strong>. Next refill due by <strong>{tracker.nextRefillDate}</strong>.
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    No orders recorded. Start your monthly care program by ordering your first refill bundle.
                  </p>
                )}
                <span style={{ 
                  fontSize: '9px', 
                  background: tracker.status === 'Overdue' ? 'rgba(239, 68, 68, 0.15)' : tracker.status === 'Low Supply' ? 'rgba(251, 146, 60, 0.15)' : 'rgba(20, 184, 166, 0.15)', 
                  color: colorClass, 
                  padding: '2px 8px', 
                  borderRadius: '100px', 
                  fontWeight: 'bold', 
                  display: 'inline-flex',
                  width: 'fit-content',
                  marginTop: '2px'
                }}>
                  {tracker.status === 'Overdue' ? '⚠️ SUPPLY OVERDUE (Adherence at risk)' : 
                   tracker.status === 'Low Supply' ? '⚠️ SUPPLY RUNNING LOW' : '✓ SUPPLY ACTIVE'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {tracker.status !== 'Active Supply' && (
                <button
                  onClick={onNavigateToRefill}
                  style={{
                    background: 'var(--color-teal-light)',
                    border: 'none',
                    color: 'white',
                    padding: '10px 16px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 6px -1px rgba(20, 184, 166, 0.2)'
                  }}
                >
                  <ShoppingBag size={14} /> Request Refill Now
                </button>
              )}
            </div>
          </div>
        );
      })()}

      {/* "How My Life Is Improving" Health Milestone Panel */}
      <div className="glass-panel" style={{
        background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
        border: '1px solid rgba(20, 184, 166, 0.15)',
        padding: '24px',
        borderRadius: '16px',
        marginBottom: '16px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Decorative background element */}
        <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(20, 184, 166, 0.1)', filter: 'blur(30px)' }}></div>
        
        <h3 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', color: 'white', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.2rem' }}>✨</span> How My Life Is Improving
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          
          {/* BP Stabilization Card */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Heart className="w-5 h-5 text-red-400" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>BP Stabilization</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white', marginTop: '4px', lineHeight: '1.3' }}>
                {bpStabilizationText}
              </div>
            </div>
          </div>

          {/* Glucose Stabilization Card */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(249, 115, 22, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Activity className="w-5 h-5 text-orange-400" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Glucose Stabilization</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white', marginTop: '4px', lineHeight: '1.3' }}>
                {glucoseStabilizationText}
              </div>
            </div>
          </div>

          {/* Adherence Streak Milestones */}
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.04)', padding: '16px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(20, 184, 166, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <ShieldCheck className="w-5 h-5 text-teal-400" />
            </div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Streak Milestone</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white', marginTop: '4px', lineHeight: '1.3' }}>
                {streakMilestoneText}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Grid: Left Vitals Log & Right AI Foot Scanner */}
      <div className="dashboard-grid">
        
        {/* Left Column: Vitals Log & Health Indicators */}
        <div className="left-column space-y-6">
          
          {/* Active Risk Summary Cards */}
          <div className="stats-cards-row">
            
            {/* Blood Pressure Summary */}
            <div className="glass-panel stat-card">
              <div className="stat-card-header">
                <span className="stat-label">Blood Pressure</span>
                <span className={`risk-badge ${getRiskClass(riskEval.strokeRisk)}`}>
                  {riskEval.strokeRisk} Stroke Risk
                </span>
              </div>
              <div className="stat-value">
                {currentBp.systolic}
                <span className="stat-unit">/ {currentBp.diastolic} mmHg</span>
              </div>
              <p className="stat-desc">
                {riskEval.bpWarning}
              </p>
            </div>

            {/* Blood Sugar Summary */}
            <div className="glass-panel stat-card">
              <div className="stat-card-header">
                <span className="stat-label">Blood Glucose</span>
                <span className={`risk-badge ${getRiskClass(riskEval.diabeticRisk)}`}>
                  {riskEval.diabeticRisk} Diabetic Risk
                </span>
              </div>
              <div className="stat-value">
                {currentGlucose.level}
                <span className="stat-unit">mg/dL</span>
                <span className="stat-unit" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  ({currentGlucose.type})
                </span>
              </div>
              <p className="stat-desc">
                {riskEval.glucoseWarning}
              </p>
            </div>

          </div>

          {/* System Notifications & Automated Alerts Log */}
          <div className="glass-panel" style={{ background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div 
              className="card-header-divider" 
              style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setCollapsedAlerts(!collapsedAlerts)}
            >
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Activity className="card-title-icon text-teal-400 animate-pulse" />
                Live Care Reminders & System Alerts
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {collapsedAlerts ? 'Expand ▾' : 'Collapse ▴'}
              </span>
            </div>

            {!collapsedAlerts && (
              <>
                {alerts.length === 0 ? (
                  <p className="scan-status-info" style={{ textAlign: 'center', padding: '1.5rem 0' }}>No active notifications.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {alerts.map((alertItem) => {
                      let badgeColor = 'rgba(56, 189, 248, 0.15)';
                      let textColor = '#38bdf8';
                      if (alertItem.type === 'critical') {
                        badgeColor = 'rgba(239, 68, 68, 0.15)';
                        textColor = '#f87171';
                      } else if (alertItem.type === 'success') {
                        badgeColor = 'rgba(16, 185, 129, 0.15)';
                        textColor = '#34d399';
                      }
                      
                      return (
                        <div 
                          key={alertItem.id} 
                          style={{ 
                            padding: '10px 12px', 
                            background: 'rgba(255,255,255,0.02)', 
                            borderRadius: '8px', 
                            borderLeft: `3px solid ${textColor}`, 
                            display: 'flex', 
                            flexDirection: 'column', 
                            gap: '4px',
                            fontSize: '12px'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontWeight: 'bold', color: 'white', textAlign: 'left' }}>{alertItem.title}</span>
                            <span style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', background: badgeColor, color: textColor, fontWeight: 'bold', textTransform: 'uppercase' }}>
                              {alertItem.type}
                            </span>
                          </div>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '1.35', margin: '0', textAlign: 'left' }}>{alertItem.message}</p>
                          <span style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'right' }}>
                            {new Date(alertItem.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {collapsedAlerts && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px 0 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                  {alerts.length === 0 ? '✓ No active notifications.' : `🔔 ${alerts.length} Care Alert${alerts.length > 1 ? 's' : ''}: ${alerts[0].title}`}
                </span>
                {alerts.length > 0 && (
                  <span style={{
                    fontSize: '9px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    background: alerts[0].type === 'critical' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)',
                    color: alerts[0].type === 'critical' ? '#f87171' : '#38bdf8',
                    fontWeight: 'bold',
                    textTransform: 'uppercase'
                  }}>
                    {alerts[0].type}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Vitals Logger Form */}
          <div id="vitals-form" className="glass-panel">
            <div className="card-header-divider">
              <h3 className="card-title">
                <Activity className="card-title-icon text-blue-400" />
                Log Daily Readings
              </h3>
            </div>

            <form onSubmit={handleLogVitals} className="form-layout">
              
              {/* BP Entry */}
              <div className="form-group-box">
                <div className="group-title-blue">Log Blood Pressure</div>
                
                <div className="inputs-row">
                  <div className="input-wrapper">
                    <label className="input-label">Systolic</label>
                    <input 
                      type="number"
                      value={systolic}
                      onChange={(e) => setSystolic(Number(e.target.value))}
                      className="input-control"
                    />
                  </div>
                  <div className="input-wrapper">
                    <label className="input-label">Diastolic</label>
                    <input 
                      type="number"
                      value={diastolic}
                      onChange={(e) => setDiastolic(Number(e.target.value))}
                      className="input-control"
                    />
                  </div>
                </div>
              </div>

              {/* Glucose Entry */}
              <div className="form-group-box">
                <div className="group-title-orange">Log Blood Sugar</div>
                
                <div className="inputs-row">
                  <div className="input-wrapper">
                    <label className="input-label">Sugar Level (mg/dL)</label>
                    <input 
                      type="number"
                      value={glucose}
                      onChange={(e) => setGlucose(Number(e.target.value))}
                      className="input-control"
                    />
                  </div>
                  <div className="input-wrapper">
                    <label className="input-label">Type</label>
                    <select
                      value={glucoseType}
                      onChange={(e) => setGlucoseType(e.target.value as any)}
                      className="select-control"
                    >
                      <option value="Fasting">Fasting</option>
                      <option value="Post-Meal">Post-Meal</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="form-actions-row">
                <button
                  type="submit"
                  className="btn-blue"
                >
                  <Plus className="w-4 h-4" /> Save Readings
                </button>
              </div>

            </form>
          </div>

          {/* Primary Care Team Configuration */}
          <div id="care-team-form" className="glass-panel">
            <div className="card-header-divider">
              <h3 className="card-title">
                <Compass className="card-title-icon text-teal-400" />
                Primary Care Team
              </h3>
            </div>
            
            <div className="form-layout" style={{ gap: '16px', display: 'flex', flexDirection: 'column' }}>
              <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="input-label" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  Assigned Medical Clinic (Doctor/MD Consultant)
                </label>
                <select
                  value={profile.assignedClinicId || ''}
                  onChange={(e) => {
                    onUpdateProfile({
                      ...profile,
                      assignedClinicId: e.target.value || null
                    });
                  }}
                  className="select-control"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px' }}
                >
                  <option value="" style={{ background: '#1c1c1e' }}>-- No Clinic Assigned (Self-Managed) --</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id} style={{ background: '#1c1c1e' }}>
                      {c.name} ({c.city})
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-wrapper" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label className="input-label" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                  Preferred Refill Pharmacy (SafeMeds Deliveries)
                </label>
                <select
                  value={profile.assignedPharmacyId || ''}
                  onChange={(e) => {
                    onUpdateProfile({
                      ...profile,
                      assignedPharmacyId: e.target.value || null
                    });
                  }}
                  className="select-control"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px' }}
                >
                  <option value="" style={{ background: '#1c1c1e' }}>-- No Pharmacy Assigned --</option>
                  {pharmacies.map(p => (
                    <option key={p.id} value={p.id} style={{ background: '#1c1c1e' }}>
                      {p.name} {p.isVerified ? '✓' : ''} ({p.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Vitals History Log list */}
          <div className="glass-panel history-section">
            <div 
              className="card-header-divider" 
              style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setCollapsedVitals(!collapsedVitals)}
            >
              <h3 className="card-title" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                <Clock className="card-title-icon text-gray-500" />
                Recent Vitals History
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {collapsedVitals ? 'Expand ▾' : 'Collapse ▴'}
              </span>
            </div>
            
            {!collapsedVitals && (
              <div className="history-scroll-box">
                {(profile.bpHistory || []).map((bp, index) => {
                  const sugar = (profile.glucoseHistory || [])[index] || { level: 120, type: 'Fasting' };
                  return (
                    <div key={index} className="history-item-row">
                      <span className="history-date">{bp.date}</span>
                      <span className="history-bp-val">
                        BP: <strong>{bp.systolic}/{bp.diastolic}</strong> mmHg
                      </span>
                      <span className="history-glucose-val">
                        Sugar: <strong>{sugar.level}</strong> mg/dL ({sugar.type})
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {collapsedVitals && (
              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', padding: '4px 0 0 0' }}>
                {profile.bpHistory && profile.bpHistory.length > 0 ? (
                  (() => {
                    const bp = profile.bpHistory[profile.bpHistory.length - 1];
                    const sugar = (profile.glucoseHistory || [])[profile.bpHistory.length - 1] || { level: 120, type: 'Fasting' };
                    return (
                      <span>
                        Latest Log ({bp.date}): <strong>BP {bp.systolic}/{bp.diastolic}</strong> mmHg | <strong>Sugar {sugar.level}</strong> mg/dL ({sugar.type})
                      </span>
                    );
                  })()
                ) : (
                  <span>No vitals recorded yet.</span>
                )}
              </div>
            )}
          </div>

        </div>

        {/* Right Column: AI Foot Ulcer Scanner */}
        <div className="right-column space-y-6">
          
          <div id="foot-scanner" className="glass-panel scanner-card">
            <div className="card-header-divider" style={{ width: '100%' }}>
              <h3 className="card-title">
                <Camera className="card-title-icon text-teal-400" />
                AI Diabetic Foot Scan
              </h3>
            </div>

            {/* High Tech Foot Scanner UI */}
            <div className="foot-scanner-viewport" style={{ position: 'relative' }}>
              
              {/* Grid Lines */}
              <div className="scanner-grid-overlay"></div>
              
              {/* Stylized Foot Outline */}
              <div className="foot-contour-shape" style={{ filter: profile.isPremium ? 'none' : 'blur(4px)' }}>
                
                {/* Toes Contours */}
                <div className="toe-bubble-contour toe-1"></div>
                <div className="toe-bubble-contour toe-2"></div>
                <div className="toe-bubble-contour toe-3"></div>
                <div className="toe-bubble-contour toe-4"></div>
                <div className="toe-bubble-contour toe-5"></div>

                {/* Scan Sweep Laser line */}
                {scanning && (
                  <div className="laser-beam-line"></div>
                )}

                {/* Simulated Neuropathic Hotspots Overlay */}
                {scanRecord && !scanning && scanRecord.hotspots.map((spot, idx) => (
                  <div 
                    key={idx}
                    className="hotspot-interactive-dot"
                    style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  >
                    <span className={`hotspot-pulse-ring ${spot.severity}`}></span>
                    <span className={`hotspot-inner-circle ${spot.severity}`}></span>

                    {/* Tooltip on hover */}
                    <div className="hotspot-tooltip-card">
                      <span className={`tooltip-header ${spot.severity}`}>
                        {spot.severity} Risk
                      </span>
                      {spot.description}
                    </div>
                  </div>
                ))}

              </div>

              {/* Scanning status spinner */}
              {scanning && (
                <div className="scan-status-spinner">
                  <Compass className="spinner-icon w-3.5 h-3.5" /> Analyzing Image...
                </div>
              )}

              {!profile.isPremium && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(3px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '20px', zIndex: 10, textAlign: 'center'
                }}>
                  <Lock size={20} className="text-teal-400" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white', display: 'block', marginBottom: '4px' }}>AI Hotspots Contour Locked</span>
                  <p style={{ fontSize: '10px', color: 'var(--text-secondary)', margin: '0 0 12px 0', lineHeight: '1.4', maxWidth: '85%' }}>
                    Upgrade to Premium to visualize high-pressure hotspots sole mapping and prevent diabetic foot ulcers.
                  </p>
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    style={{
                      background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', border: 'none', color: 'black',
                      padding: '6px 14px', borderRadius: '6px', fontSize: '10px', fontWeight: 'bold', cursor: 'pointer',
                      boxShadow: '0 0 10px rgba(234, 179, 8, 0.2)'
                    }}
                  >
                    👑 Unlock Premium Scan
                  </button>
                </div>
              )}
            </div>

            {/* Scan Action Controls */}
            <div style={{ width: '100%', textAlign: 'center' }} className="space-y-3">
              {!scanRecord && !scanning ? (
                <p className="scan-status-info">Upload a photo of the patient's foot sole to trigger the AI sensory audit.</p>
              ) : (
                <div className="space-y-1">
                  <div className="scan-status-info">
                    Latest Scan Risk Index: <strong style={{ color: 'white' }}>{scanRecord?.riskScore}%</strong>
                  </div>
                  <div className={`scan-status-alert ${scanRecord?.hasHotspots ? 'danger' : 'safe'}`}>
                    {scanRecord?.hasHotspots ? "⚠️ High-pressure Hotspots Detected" : "✓ Foot sensory health OK"}
                  </div>
                </div>
              )}

              <label className="scan-upload-btn-label">
                <Upload className="w-4 h-4 text-teal-400" />
                {scanRecord ? "Upload New Foot Photo" : "Scan Foot Sole"}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFootPhotoUpload}
                  disabled={scanning}
                  style={{ display: 'none' }}
                />
              </label>
            </div>
          </div>

          {/* Foot Care Recommendations */}
          {scanRecord && !scanning && (
            <div className="glass-panel recommendations-wrapper animate-scale-in" style={{ padding: '15px', position: 'relative', overflow: 'hidden' }}>
              {/* Blur wrapper for basic tier */}
              <div style={{ filter: profile.isPremium ? 'none' : 'blur(5px)', transition: 'filter 0.3s ease' }}>
                <div 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setCollapsedRecs(!collapsedRecs)}
                >
                  <h4 className="card-title" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-teal-light)', display: 'flex', alignItems: 'center', gap: '6px', margin: 0 }}>
                    <CheckCircle className="w-3.5 h-3.5" />
                    AI Recommended Actions
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {collapsedRecs ? 'Expand ▾' : 'Collapse ▴'}
                  </span>
                </div>
                
                {!collapsedRecs && (
                  <ul className="recommendations-list" style={{ marginTop: '10px' }}>
                    {scanRecord.recommendations.map((rec, index) => (
                      <li key={index} className="recommendation-bullet-item">
                        {rec}
                      </li>
                    ))}
                  </ul>
                )}

                {collapsedRecs && scanRecord.recommendations.length > 0 && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '6px', textAlign: 'left', fontStyle: 'italic' }}>
                    Latest: {scanRecord.recommendations[0]} 
                    {scanRecord.recommendations.length > 1 && ` (+${scanRecord.recommendations.length - 1} more actions)`}
                  </div>
                )}
              </div>

              {/* Locked overlay for free tier */}
              {!profile.isPremium && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(2px)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '12px', zIndex: 10, textAlign: 'center'
                }}>
                  <Lock size={16} className="text-teal-400" style={{ marginBottom: '4px' }} />
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'white', display: 'block', marginBottom: '4px' }}>AI Recommended Actions Locked</span>
                  <button
                    type="button"
                    onClick={() => setUpgradeModalOpen(true)}
                    style={{
                      background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)', border: 'none', color: 'black',
                      padding: '4px 10px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', cursor: 'pointer',
                      boxShadow: '0 0 10px rgba(234, 179, 8, 0.2)'
                    }}
                  >
                    👑 Unlock Recommendations
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Notification & Daily Reminder Settings Card */}
          <div className="glass-panel" style={{ marginTop: '16px', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.4) 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div 
              className="card-header-divider" 
              style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
              onClick={() => setCollapsedReminders(!collapsedReminders)}
            >
              <h3 className="card-title">
                <Clock className="card-title-icon text-blue-400" />
                🔔 Notification & Reminders
              </h3>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {collapsedReminders ? 'Expand ▾' : 'Collapse ▴'}
              </span>
            </div>

            {!collapsedReminders && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', color: 'var(--text-secondary)' }}>
                <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.4' }}>
                  Enable automated push reminders to stay on top of your daily vitals logging. Keeps your care streak active and clinicians updated.
                </p>

                {reminderFeedback && (
                  <div style={{ 
                    padding: '8px 12px', 
                    borderRadius: '8px', 
                    fontSize: '0.7rem', 
                    background: reminderFeedback.includes('⚠️') ? 'rgba(239, 68, 68, 0.12)' : 'rgba(20, 184, 166, 0.12)', 
                    color: reminderFeedback.includes('⚠️') ? '#f87171' : '#5eead4',
                    border: reminderFeedback.includes('⚠️') ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid rgba(20, 184, 166, 0.2)',
                    fontWeight: 'bold'
                  }}>
                    {reminderFeedback}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'white' }}>Daily Push Notifications</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Get a daily nudge to record readings</div>
                  </div>
                  <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '38px', height: '20px' }}>
                    <input 
                      type="checkbox" 
                      checked={dailyRemindersEnabled}
                      onChange={(e) => handleSaveReminderPreferences(e.target.checked, reminderTime)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: dailyRemindersEnabled ? '#14b8a6' : 'rgba(255,255,255,0.1)',
                      transition: '.3s', borderRadius: '20px'
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: '14px', width: '14px', left: '3px', bottom: '3px',
                        backgroundColor: 'white', transition: '.3s', borderRadius: '50%',
                        transform: dailyRemindersEnabled ? 'translateX(18px)' : 'none'
                      }}></span>
                    </span>
                  </label>
                </div>

                {dailyRemindersEnabled && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 'bold', color: 'white', textAlign: 'left' }}>
                      Preferred Reminder Time:
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select 
                        value={reminderTime} 
                        onChange={(e) => handleSaveReminderPreferences(dailyRemindersEnabled, e.target.value)}
                        style={{
                          flex: 1,
                          background: 'rgba(255, 255, 255, 0.05)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          color: 'white',
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        <option value="06:00" style={{ background: '#111827' }}>6:00 AM (Early Morning Check)</option>
                        <option value="08:00" style={{ background: '#111827' }}>8:00 AM (Morning Routine)</option>
                        <option value="12:00" style={{ background: '#111827' }}>12:00 PM (Midday Check)</option>
                        <option value="17:00" style={{ background: '#111827' }}>5:00 PM (Late Afternoon Check)</option>
                        <option value="20:00" style={{ background: '#111827' }}>8:00 PM (Evening Routine)</option>
                        <option value="22:00" style={{ background: '#111827' }}>10:00 PM (Before Bed)</option>
                      </select>
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleTestReminder}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    padding: '10px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)'}
                >
                  ⚡ Test Daily Reminder Now
                </button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* Premium Upgrade Billing Modal */}
      {upgradeModalOpen && (
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
            border: '2px solid #eab308',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '500px',
            boxShadow: '0 25px 50px -12px rgba(234, 179, 8, 0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative'
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(180deg, rgba(234, 179, 8, 0.05) 0%, rgba(0,0,0,0) 100%)'
            }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.15rem', color: '#eab308', fontWeight: 'bold' }}>
                👑 Upgrade to DiaBP Premium
              </h3>
              <button 
                onClick={() => {
                  setUpgradeModalOpen(false);
                  setPaymentStep('form');
                  setPaymentError('');
                }}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  cursor: 'pointer'
                }}
              >
                ✕
              </button>
            </div>

            {paymentStep === 'form' && (
              <form onSubmit={handleUpgradeSubscription} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Select Subscription Plan */}
                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                    Choose Your Subscription Plan
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div 
                      onClick={() => setSelectedPlan('monthly')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: selectedPlan === 'monthly' ? '2px solid #eab308' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: selectedPlan === 'monthly' ? 'rgba(234, 179, 8, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white' }}>Monthly Pass</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#eab308', margin: '4px 0' }}>₦1,500</div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Billed Monthly</div>
                    </div>
                    <div 
                      onClick={() => setSelectedPlan('annual')}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: selectedPlan === 'annual' ? '2px solid #eab308' : '1px solid rgba(255, 255, 255, 0.1)',
                        background: selectedPlan === 'annual' ? 'rgba(234, 179, 8, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                        cursor: 'pointer',
                        textAlign: 'center',
                        transition: 'all 0.2s ease',
                        position: 'relative'
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: '-8px', right: '10px',
                        background: '#eab308', color: 'black', padding: '1px 6px',
                        borderRadius: '100px', fontSize: '8px', fontWeight: 'bold', textTransform: 'uppercase'
                      }}>
                        Save 17%
                      </span>
                      <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white' }}>Annual Pass</div>
                      <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#eab308', margin: '4px 0' }}>₦15,000</div>
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
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>Billing Name</label>
                      <input 
                        type="text" 
                        placeholder="Billing Contact / Patient Name"
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
                        placeholder="billing@patient.com"
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
                    <ShieldCheck size={12} className="text-teal-400" /> SSL Encrypted & Secure
                  </span>
                  <span>Total Due: {selectedPlan === 'monthly' ? '₦1,500' : '₦15,000'}</span>
                </div>

                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #eab308 0%, #ca8a04 100%)',
                    border: 'none',
                    color: 'black',
                    padding: '12px',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    marginTop: '8px',
                    boxShadow: '0 4px 12px rgba(234, 179, 8, 0.25)',
                    transition: 'transform 0.1s ease'
                  }}
                >
                  Pay & Activate Premium Status
                </button>
              </form>
            )}

            {paymentStep === 'processing' && (
              <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '300px' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  border: '3px solid rgba(234, 179, 8, 0.2)',
                  borderTop: '3px solid #eab308',
                  borderRadius: '50%'
                }} className="spinner-icon"></div>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: 'white', fontWeight: 'bold' }}>Verifying Transaction</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Communicating securely with your bank. Please do not refresh.</p>
                </div>
              </div>
            )}

            {paymentStep === 'success' && (
              <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', minHeight: '300px' }}>
                <div style={{
                  width: '50px',
                  height: '50px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid #10b981'
                }}>
                  <ShieldCheck size={28} className="text-emerald-400" />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '1rem', color: '#10b981', fontWeight: 'bold' }}>Upgrade Successful!</h4>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>You are now a DiaBP Premium Member. Enjoy unrestricted medical audits.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

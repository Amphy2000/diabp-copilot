import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageCircle, 
  X, 
  Send, 
  CheckCheck, 
  Phone, 
  Video, 
  MoreVertical, 
  AlertCircle 
} from 'lucide-react';
import { 
  logVitalsForPatient, 
  getPatientProfile, 
  savePharmacy // to trigger reload
} from '../services/ncdService';
import type { PatientNcdProfile, NcdRefillOrder } from '../services/ncdService';
import { supabase, isSupabaseConfigured } from '../services/supabase';

interface WhatsAppSimulatorProps {
  patients: PatientNcdProfile[];
  orders: NcdRefillOrder[];
  activePatientId?: string;
  onRefreshData?: () => void;
  userRole?: 'patient' | 'doctor' | 'pharmacist' | 'admin' | null;
  userFacilityId?: string | null;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'patient';
  text: string;
  timestamp: string;
}

export const WhatsAppSimulator: React.FC<WhatsAppSimulatorProps> = ({
  patients,
  orders,
  activePatientId,
  onRefreshData,
  userRole,
  userFacilityId
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputVal, setInputVal] = useState('');
  
  // Bot flow states
  const [flowState, setFlowState] = useState<'idle' | 'waiting_bp' | 'waiting_glucose' | 'waiting_glucose_type' | 'waiting_refill_confirm' | 'onboard_name' | 'onboard_age' | 'onboard_phone'>('idle');
  const [tempBp, setTempBp] = useState({ systolic: 120, diastolic: 80 });
  const [tempGlucose, setTempGlucose] = useState(100);

  // Onboarding states
  const [onboardName, setOnboardName] = useState('');
  const [onboardAge, setOnboardAge] = useState<number>(45);
  const [onboardPhone, setOnboardPhone] = useState('');
  
  // Patient search filter term
  const [searchPatientTerm, setSearchPatientTerm] = useState('');

  // Filter patient options based on role & facility connection to prevent data leakage
  const visiblePatients = patients.filter(p => {
    if (userRole === 'doctor' && userFacilityId) {
      return p.assignedClinicId === userFacilityId;
    }
    if (userRole === 'pharmacist' && userFacilityId) {
      return p.assignedPharmacyId === userFacilityId;
    }
    if (userRole === 'patient') {
      return false; // Patients shouldn't see anyone else
    }
    return true; // Admin sees all
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize selected patient
  useEffect(() => {
    if (activePatientId) {
      setSelectedPatientId(activePatientId);
    } else if (selectedPatientId !== 'unregistered' && visiblePatients.length > 0) {
      // Avoid overriding 'unregistered' selection on initial refresh
      if (!visiblePatients.some(p => p.id === selectedPatientId)) {
        setSelectedPatientId(visiblePatients[0].id || '');
      }
    }
  }, [activePatientId, visiblePatients]);

  // Reset messages when patient context changes
  useEffect(() => {
    if (selectedPatientId === 'unregistered') {
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: `Green-check verified *DiaBP Safe-Meds Assistant* connected.\n\nWelcome to DiaBP! I noticed this phone number is not registered in our network yet. Let's get you set up!\n\nWhat is your full name?`,
          timestamp: getFormattedTime()
        }
      ]);
      setFlowState('onboard_name');
    } else {
      const patientName = patients.find(p => p.id === selectedPatientId)?.name || 'Patient';
      setMessages([
        {
          id: 'welcome',
          sender: 'bot',
          text: `Green-check verified *DiaBP Safe-Meds Assistant* connected.\n\nHello ${patientName}! You can manage your chronic hypertension & diabetes care directly inside WhatsApp.\n\nType *Menu* or choose an action below to start.`,
          timestamp: getFormattedTime()
        }
      ]);
      setFlowState('idle');
    }
  }, [selectedPatientId, patients]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getFormattedTime = () => {
    return new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const addBotMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      sender: 'bot',
      text,
      timestamp: getFormattedTime()
    }]);
  };

  const handleSend = async (customVal?: string) => {
    const messageText = (customVal || inputVal).trim();
    if (!messageText) return;

    if (!customVal) {
      setInputVal('');
    }

    // Add patient message
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      sender: 'patient',
      text: messageText,
      timestamp: getFormattedTime()
    }]);

    // Bot Response Logic
    setTimeout(async () => {
      const lower = messageText.toLowerCase();

      // Check for global exit/reset
      if (lower === 'menu' || lower === 'hello' || lower === 'hi') {
        setFlowState('idle');
        addBotMessage("Main Menu:\n\n*1.* Log Daily Vitals 📈\n*2.* Confirm Monthly Refill 💊\n*3.* Get Health PDF Report 📄\n\nReply with the number or click a button below.");
        return;
      }

      // State machine logic
      switch (flowState) {
        case 'idle':
          if (messageText === '1' || lower.includes('vital') || lower.includes('log')) {
            setFlowState('waiting_bp');
            addBotMessage("Please enter your Blood Pressure in format *SYSTOLIC/DIASTOLIC* (e.g. 120/80 mmHg):");
          } else if (messageText === '2' || lower.includes('refill') || lower.includes('confirm')) {
            const pendingOrders = orders.filter(o => o.patientId === selectedPatientId && o.status === 'Pending verification');
            if (pendingOrders.length === 0) {
              addBotMessage("You don't have any pending refill orders waiting for confirmation. Reply with *Refill* or type your medication names to request a refill quote directly via chat!");
            } else {
              const order = pendingOrders[0];
              setFlowState('waiting_refill_confirm');
              addBotMessage(`Refill Request Found!\n\nMedications: *${order.items.join(', ')}*\nTotal Amount: *₦${order.totalNaira.toLocaleString()}*\n\nWould you like to approve and pay for this monthly refill?\n\n*1.* Yes, approve & pay\n*2.* Cancel`);
            }
          } else if (messageText === '3' || lower.includes('report') || lower.includes('pdf')) {
            addBotMessage("Generating your secure DiaBP Health Vitals Audit PDF report...\n\n📄 [Download BP & Sugar Audit Report](https://diabp-copilot.vercel.app/mock_report.pdf)\n\nThis report has been uploaded to your clinician's registry automatically.");
          } else {
            addBotMessage("I didn't understand that command. Type *Menu* to return to options.");
          }
          break;

        case 'waiting_bp':
          const bpParts = messageText.split('/');
          if (bpParts.length === 2) {
            const systolic = parseInt(bpParts[0]);
            const diastolic = parseInt(bpParts[1]);
            if (!isNaN(systolic) && !isNaN(diastolic)) {
              setTempBp({ systolic, diastolic });
              setFlowState('waiting_glucose');
              addBotMessage(`Vitals Captured: BP *${systolic}/${diastolic} mmHg*.\n\nNow, enter your Blood Glucose level in mg/dL (or type *0* to skip):`);
            } else {
              addBotMessage("Invalid format. Please enter as numbers like *120/80*:");
            }
          } else {
            addBotMessage("Invalid format. Please use *SYSTOLIC/DIASTOLIC* (e.g. *120/80*):");
          }
          break;

        case 'waiting_glucose':
          const glucoseVal = parseInt(messageText);
          if (!isNaN(glucoseVal)) {
            setTempGlucose(glucoseVal);
            if (glucoseVal === 0) {
              // Skip glucose, save BP
              await saveLoggedVitals(tempBp.systolic, tempBp.diastolic, 0, 'Fasting');
            } else {
              setFlowState('waiting_glucose_type');
              addBotMessage("Is this reading Fasting or Post-Meal?\n\n*1.* Fasting\n*2.* Post-Meal");
            }
          } else {
            addBotMessage("Invalid number. Please enter glucose in mg/dL or type *0* to skip:");
          }
          break;

        case 'waiting_glucose_type':
          let type: 'Fasting' | 'Post-Meal' = 'Fasting';
          if (messageText === '2' || lower.includes('post')) {
            type = 'Post-Meal';
          }
          await saveLoggedVitals(tempBp.systolic, tempBp.diastolic, tempGlucose, type);
          break;

        case 'waiting_refill_confirm':
          if (messageText === '1' || lower === 'yes' || lower.includes('approve')) {
            const pendingOrders = orders.filter(o => o.patientId === selectedPatientId && o.status === 'Pending verification');
            if (pendingOrders.length > 0) {
              const order = pendingOrders[0];
              
              // Approve order in Database / LocalStorage
              if (isSupabaseConfigured) {
                try {
                  await supabase
                    .from('ncd_orders')
                    .update({ status: 'Delivered' })
                    .eq('order_number', order.id);
                } catch (e) {
                  console.error("Failed to approve order in Supabase:", e);
                }
              }

              // Update locally
              const localOrdersStr = localStorage.getItem('diabp_orders');
              if (localOrdersStr) {
                const localOrders = JSON.parse(localOrdersStr);
                const updated = localOrders.map((o: any) => o.id === order.id ? { ...o, status: 'Delivered' } : o);
                localStorage.setItem('diabp_orders', JSON.stringify(updated));
              }

              setFlowState('idle');
              addBotMessage(`💳 Refill Payment Confirmed successfully!\n\nAmount Settled: *₦${order.totalNaira.toLocaleString()}*\n\n✓ Refill Approved and marked as *Delivered*. Medications are out for delivery to your registered address.`);
              if (onRefreshData) onRefreshData();
            } else {
              setFlowState('idle');
              addBotMessage("Refill could not be processed. Order expired or removed.");
            }
          } else {
            setFlowState('idle');
            addBotMessage("Refill payment cancelled. Type *Menu* to start over.");
          }
          break;

        case 'onboard_name':
          setOnboardName(messageText);
          setFlowState('onboard_age');
          addBotMessage(`Nice to meet you, *${messageText}*!\n\nWhat is your age?`);
          break;

        case 'onboard_age':
          const ageVal = parseInt(messageText);
          if (!isNaN(ageVal) && ageVal > 0) {
            setOnboardAge(ageVal);
            setFlowState('onboard_phone');
            addBotMessage("Great! And what is your 11-digit phone number (e.g. 08012345678)?");
          } else {
            addBotMessage("Please enter your age as a valid number:");
          }
          break;

        case 'onboard_phone':
          setOnboardPhone(messageText);
          await registerNewChatPatient(onboardName, onboardAge, messageText);
          break;
      }
    }, 800);
  };

  const saveLoggedVitals = async (systolic: number, diastolic: number, glucose: number, type: 'Fasting' | 'Post-Meal') => {
    try {
      await logVitalsForPatient(selectedPatientId, systolic, diastolic, glucose, type);
      setFlowState('idle');
      addBotMessage(`✓ Vitals logged successfully!\n\nBP: *${systolic}/${diastolic} mmHg*\nGlucose: *${glucose > 0 ? `${glucose} mg/dL (${type})` : 'N/A'}*\n\nDiaBP clinician team alert: *Logged Stable*. Vitals charts and triage registry updated in real-time.`);
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error(e);
      addBotMessage("Error saving vitals to database. Please check connection.");
      setFlowState('idle');
    }
  };

  const registerNewChatPatient = async (name: string, age: number, phone: string) => {
    try {
      const newId = 'c0000000-0000-0000-0000-' + Math.random().toString(36).substr(2, 12).padEnd(12, '0');
      const clinicId = userRole === 'doctor' ? (userFacilityId || undefined) : undefined;
      const pharmacyId = userRole === 'pharmacist' ? (userFacilityId || undefined) : undefined;

      const newProfile: PatientNcdProfile = {
        id: newId,
        name,
        age,
        phone,
        conditions: ['Essential Hypertension'],
        isPremium: false,
        bpHistory: [{ date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), systolic: 120, diastolic: 80 }],
        glucoseHistory: [{ date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), level: 100, type: 'Fasting' }],
        streakDays: 0,
        weight: 70,
        footScanHistory: [],
        assignedClinicId: clinicId,
        assignedPharmacyId: pharmacyId
      };

      // 1. Save locally to localStorage (both keys for compatibility)
      const localPStr = localStorage.getItem('diabp_patients');
      const localP = localPStr ? JSON.parse(localPStr) : [];
      localP.push(newProfile);
      localStorage.setItem('diabp_patients', JSON.stringify(localP));

      const profilesLocalStr = localStorage.getItem('diabp_profiles');
      const profilesLocal = profilesLocalStr ? JSON.parse(profilesLocalStr) : {};
      profilesLocal[newId] = newProfile;
      localStorage.setItem('diabp_profiles', JSON.stringify(profilesLocal));

      // 2. Save in database if Supabase is active
      if (isSupabaseConfigured) {
        try {
          await supabase.from('ncd_profiles').insert([{
            id: newId,
            name,
            age,
            phone,
            conditions: ['Essential Hypertension'],
            is_premium: false,
            streak_days: 0,
            weight: 70,
            assigned_clinic_id: clinicId || null,
            assigned_pharmacy_id: pharmacyId || null
          }]);
        } catch (e) {
          console.warn("Supabase profile insert skipped (requires auth.users link). Local fallback active.");
        }
      }
      
      setFlowState('idle');
      addBotMessage(`✓ Onboarding completed successfully! Your profile is registered.\n\nWelcome to DiaBP-Copilot! Type *Menu* to start managing your daily health.`);
      
      // Update selected patient
      setSelectedPatientId(newId);
      
      // Refresh the App state
      if (onRefreshData) onRefreshData();
    } catch (e) {
      console.error("Failed to register new chat patient:", e);
      addBotMessage("Failed to register profile. Please try again.");
      setFlowState('idle');
    }
  };

  const handleShortcutClick = (num: string, text: string) => {
    handleSend(num);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="wa-toggle-btn"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: '50px',
          padding: '12px 20px',
          boxShadow: '0 8px 32px rgba(34, 197, 94, 0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '0.85rem',
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)';
          e.currentTarget.style.boxShadow = '0 12px 36px rgba(34, 197, 94, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(34, 197, 94, 0.4)';
        }}
      >
        <MessageCircle className="w-5 h-5" />
        DiaBP WhatsApp Bot
      </button>

      {/* 2. Chat Simulator Panel */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '88px',
            right: '24px',
            width: '380px',
            height: '520px',
            zIndex: 9999,
            borderRadius: '16px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'var(--card-bg, #0f172a)',
            backdropFilter: 'blur(10px)',
          }}
          className="wa-chat-window animate-scale-up"
        >
          {/* Header */}
          <div
            style={{
              background: '#075e54',
              color: 'white',
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50px',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                  border: '1.5px solid #22c55e',
                }}
              >
                💚
              </div>
              <div>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  DiaBP Assistant
                  <span 
                    style={{ background: '#22c55e', color: 'white', borderRadius: '50px', fontSize: '0.55rem', padding: '1px 4px', display: 'inline-flex', alignItems: 'center' }}
                    title="Verified Account"
                  >
                    ✓
                  </span>
                </div>
                <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.7)' }}>online</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Phone size={14} style={{ cursor: 'pointer', opacity: 0.8 }} />
              <Video size={14} style={{ cursor: 'pointer', opacity: 0.8 }} />
              <X
                size={16}
                onClick={() => setIsOpen(false)}
                style={{ cursor: 'pointer', opacity: 0.8 }}
              />
            </div>
          </div>

          {/* Test Patient Switcher (Developer Control Panel) */}
          {!activePatientId && userRole !== 'patient' && (
            <div
              style={{
                background: 'rgba(255,255,255,0.02)',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                padding: '8px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                fontSize: '0.7rem',
                color: 'var(--text-muted, #94a3b8)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Simulate Patient:</span>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: 'white',
                    fontSize: '0.7rem',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    outline: 'none',
                    maxWidth: '180px',
                  }}
                >
                  <option value="unregistered" style={{ background: '#1e293b', color: '#10b981', fontWeight: 'bold' }}>➕ Simulate New Patient (Self-Onboard)</option>
                  {visiblePatients
                    .filter(p => p.name.toLowerCase().includes(searchPatientTerm.toLowerCase()))
                    .map(p => (
                      <option key={p.id} value={p.id} style={{ background: '#1e293b' }}>
                        {p.name}
                      </option>
                    ))
                  }
                </select>
              </div>
              
              {/* Search filter for 400+ patients */}
              {visiblePatients.length > 3 && (
                <input 
                  type="text"
                  placeholder="🔍 Search patients list..."
                  value={searchPatientTerm}
                  onChange={(e) => setSearchPatientTerm(e.target.value)}
                  style={{
                    background: 'rgba(0,0,0,0.2)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    padding: '4px 8px',
                    color: 'white',
                    fontSize: '0.65rem',
                    outline: 'none',
                    width: '100%'
                  }}
                />
              )}
            </div>
          )}

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              background: 'rgba(0, 0, 0, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {messages.map(m => (
              <div
                key={m.id}
                style={{
                  alignSelf: m.sender === 'bot' ? 'flex-start' : 'flex-end',
                  maxWidth: '85%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    background: m.sender === 'bot' ? '#1f2c34' : '#005c4b',
                    color: 'white',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    lineHeight: '1.4',
                    whiteSpace: 'pre-wrap',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                    border: '1px solid rgba(255,255,255,0.03)',
                  }}
                >
                  {m.text}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.6rem',
                      color: 'rgba(255,255,255,0.5)',
                      marginTop: '4px',
                    }}
                  >
                    {m.timestamp}
                    {m.sender === 'patient' && <CheckCheck size={10} style={{ color: '#53bdeb' }} />}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Action Choices Panel */}
          {flowState === 'idle' && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.15)',
                display: 'flex',
                gap: '6px',
                flexWrap: 'wrap',
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <button
                onClick={() => handleShortcutClick('1', 'Log Daily Vitals')}
                style={{
                  background: 'rgba(34, 197, 94, 0.1)',
                  border: '1px solid rgba(34, 197, 94, 0.2)',
                  color: '#4ade80',
                  borderRadius: '50px',
                  padding: '4px 10px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                📈 Log Vitals
              </button>
              <button
                onClick={() => handleShortcutClick('2', 'Confirm Refill')}
                style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  borderRadius: '50px',
                  padding: '4px 10px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                💊 Confirm Refill
              </button>
              <button
                onClick={() => handleShortcutClick('3', 'Get PDF Report')}
                style={{
                  background: 'rgba(234, 179, 8, 0.1)',
                  border: '1px solid rgba(234, 179, 8, 0.2)',
                  color: '#facc15',
                  borderRadius: '50px',
                  padding: '4px 10px',
                  fontSize: '0.7rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                📄 PDF Vitals Report
              </button>
            </div>
          )}

          {/* Quick Answers for flow state choices */}
          {flowState === 'waiting_glucose_type' && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.15)',
                display: 'flex',
                gap: '8px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <button
                onClick={() => handleSend('1')}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                  borderRadius: '6px',
                  padding: '6px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Fasting
              </button>
              <button
                onClick={() => handleSend('2')}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                  borderRadius: '6px',
                  padding: '6px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Post-Meal
              </button>
            </div>
          )}

          {/* Quick Answers for refill split transaction confirmation */}
          {flowState === 'waiting_refill_confirm' && (
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(0,0,0,0.15)',
                display: 'flex',
                gap: '8px',
                borderTop: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <button
                onClick={() => handleSend('1')}
                style={{
                  flex: 1,
                  background: 'rgba(34, 197, 94, 0.2)',
                  border: '1px solid rgba(34, 197, 94, 0.4)',
                  color: '#4ade80',
                  borderRadius: '6px',
                  padding: '6px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                }}
              >
                Approve & Pay Refill
              </button>
              <button
                onClick={() => handleSend('2')}
                style={{
                  flex: 1,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  color: '#f87171',
                  borderRadius: '6px',
                  padding: '6px',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: '8px 12px',
              background: '#1f2c34',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <input
              type="text"
              placeholder="Type message..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              style={{
                flex: 1,
                background: '#2a3942',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                color: 'white',
                fontSize: '0.8rem',
                outline: 'none',
              }}
            />
            <button
              type="submit"
              style={{
                background: '#00a884',
                color: 'white',
                border: 'none',
                width: '32px',
                height: '32px',
                borderRadius: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Send size={14} />
            </button>
          </form>
        </div>
      )}
    </>
  );
};

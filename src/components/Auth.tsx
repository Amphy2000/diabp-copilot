import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabase';
import { 
  getClinics, 
  getPharmacies, 
  registerClinic, 
  registerPharmacy, 
  associateClinician, 
  associatePharmacist,
  savePatientProfile,
  INITIAL_NCD_PATIENT
} from '../services/ncdService';
import type { NcdClinic, NcdPharmacy, PatientNcdProfile } from '../services/ncdService';
import { Activity, Loader2, AlertCircle, Sparkles, Building, User, Users, ShieldAlert } from 'lucide-react';
import { InstallPrompt } from './InstallPrompt';

export const Auth: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Registration Role Selection
  const [role, setRole] = useState<'patient' | 'doctor' | 'pharmacist' | 'admin'>('patient');
  
  // Basic Info
  const [fullName, setFullName] = useState('');

  // Dropdowns Lists from Supabase
  const [clinics, setClinics] = useState<NcdClinic[]>([]);
  const [pharmacies, setPharmacies] = useState<NcdPharmacy[]>([]);

  // Patient Registration Details
  const [age, setAge] = useState<number>(45);
  const [weight, setWeight] = useState<number>(75);
  const [selectedConditions, setSelectedConditions] = useState<string[]>(["Type 2 Diabetes Mellitus"]);
  const [baselineBp, setBaselineBp] = useState("130/80 mmHg");
  const [targetGlucose, setTargetGlucose] = useState("70-130 mg/dL");
  const [assignedClinicId, setAssignedClinicId] = useState('');
  const [assignedPharmacyId, setAssignedPharmacyId] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [patientAddress, setPatientAddress] = useState('');

  // Doctor/Pharmacist Registration Details
  const [onboardOption, setOnboardOption] = useState<'join' | 'create'>('join');
  const [selectedFacilityId, setSelectedFacilityId] = useState('');
  const [newFacilityName, setNewFacilityName] = useState('');
  const [newFacilityAddress, setNewFacilityAddress] = useState('');
  const [newFacilityCity, setNewFacilityCity] = useState('Abuja');
  const [newFacilityPhone, setNewFacilityPhone] = useState('');

  // Load lists on mount for registration selectors
  useEffect(() => {
    async function loadLists() {
      const cList = await getClinics();
      const pList = await getPharmacies();
      setClinics(cList);
      setPharmacies(pList);
      
      let initialClinicId = '';
      if (cList && cList.length > 0) {
        const firstClinic = cList.find(c => c && c.id);
        if (firstClinic) initialClinicId = firstClinic.id;
      }

      let initialPharmacyId = '';
      if (pList && pList.length > 0) {
        const firstPharmacy = pList.find(p => p && p.id);
        if (firstPharmacy) initialPharmacyId = firstPharmacy.id;
      }

      // Parse referral param (?ref=...)
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get('ref');
      if (refParam && cList && cList.length > 0) {
        // 1. Try matching by direct Clinic UUID
        const matchedById = cList.find(c => c && c.id === refParam);
        if (matchedById) {
          initialClinicId = matchedById.id;
        } else {
          // 2. Try matching by slugified short code (e.g. ezeclini) or substring
          const matchedByCode = cList.find(c => {
            if (!c) return false;
            const clinicName = c.name || '';
            const code = clinicName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
            return code === refParam.toLowerCase() || clinicName.toLowerCase().includes(refParam.toLowerCase());
          });
          if (matchedByCode) {
            initialClinicId = matchedByCode.id;
          }
        }
      }

      setAssignedClinicId(initialClinicId);
      setAssignedPharmacyId(initialPharmacyId);
    }
    loadLists();
  }, []);

  const handleToggleCondition = (cond: string) => {
    if (selectedConditions.includes(cond)) {
      setSelectedConditions(selectedConditions.filter(c => c !== cond));
    } else {
      setSelectedConditions([...selectedConditions, cond]);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isLogin) {
        // Sign In Flow
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (signInErr) throw signInErr;
        window.location.reload();
      } else {
        // Sign Up Flow
        if (!fullName.trim()) {
          throw new Error("Please enter your full name.");
        }

        // 1. Resolve clinic/pharmacy target ID before sign up
        let targetClinicId = '';
        let targetPharmacyId = '';
        let facilityRole = '';

        if (role === 'doctor') {
          if (onboardOption === 'create') {
            if (!newFacilityName.trim()) throw new Error("Clinic name is required.");
            const newClinic = await registerClinic(newFacilityName, newFacilityAddress, newFacilityCity, newFacilityPhone);
            if (!newClinic || !newClinic.id) {
              throw new Error("Failed to register the new clinic. Please try again.");
            }
            targetClinicId = newClinic.id;
            facilityRole = 'Admin';
          } else {
            targetClinicId = selectedFacilityId;
            if (!targetClinicId) throw new Error("Please select a clinic to join.");
            facilityRole = 'Doctor';
          }
        } else if (role === 'pharmacist') {
          if (onboardOption === 'create') {
            if (!newFacilityName.trim()) throw new Error("Pharmacy name is required.");
            const newPharmacy = await registerPharmacy(newFacilityName, newFacilityAddress, newFacilityCity, newFacilityPhone);
            if (!newPharmacy || !newPharmacy.id) {
              throw new Error("Failed to register the new pharmacy. Please try again.");
            }
            targetPharmacyId = newPharmacy.id;
            facilityRole = 'Owner';
          } else {
            targetPharmacyId = selectedFacilityId;
            if (!targetPharmacyId) throw new Error("Please select a pharmacy to join.");
            facilityRole = 'Staff';
          }
        }

        // 2. Perform Supabase Sign Up with role and facility metadata
        const userMetadata: any = {
          role,
          display_name: fullName
        };
        if (targetClinicId) {
          userMetadata.clinic_id = targetClinicId;
          userMetadata.facility_role = facilityRole;
        }
        if (targetPharmacyId) {
          userMetadata.pharmacy_id = targetPharmacyId;
          userMetadata.facility_role = facilityRole;
        }

        const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: userMetadata
          }
        });

        if (signUpErr) throw signUpErr;
        const user = signUpData.user;
        if (!user) throw new Error("Onboarding registration failed. No user object returned.");

        // 3. Role-Specific Onboarding Mutations
        if (role === 'patient') {
          const profilePayload: PatientNcdProfile = {
            name: fullName,
            age,
            weight,
            conditions: selectedConditions,
            baselineBp,
            targetGlucoseRange: targetGlucose,
            bpHistory: INITIAL_NCD_PATIENT.bpHistory,
            glucoseHistory: INITIAL_NCD_PATIENT.glucoseHistory,
            footScanHistory: INITIAL_NCD_PATIENT.footScanHistory,
            streakDays: 1,
            activeMeds: selectedConditions.includes("Type 2 Diabetes Mellitus") 
              ? ["Metformin 500mg Daily"] 
              : ["Amlodipine 5mg Daily"],
            assignedClinicId: assignedClinicId || null,
            assignedPharmacyId: assignedPharmacyId || null,
            phone: patientPhone || undefined,
            address: patientAddress || undefined
          };
          await savePatientProfile(profilePayload, user.id);
        } else if (role === 'doctor') {
          await associateClinician(user.id, targetClinicId, facilityRole as any, email);
        } else if (role === 'pharmacist') {
          await associatePharmacist(user.id, targetPharmacyId, facilityRole as any, email);
        }

        // Complete authentication and sign-in directly
        alert("Registration and onboarding successful! Logging in now...");
        
        // Triggers App session reload
        window.location.reload();
      }
    } catch (err: any) {
      let msg = err.message || 'An error occurred during onboarding.';
      if (msg.toLowerCase().includes('email rate limit')) {
        msg = "Supabase Email Rate Limit Exceeded: The free tier of Supabase limits signup confirmation emails to 3 per hour. To bypass this, go to your Supabase Dashboard -> Authentication -> Providers -> Email, and toggle OFF the 'Confirm email' switch. This will allow instant registrations without sending emails.";
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px 24px',
      background: '#0d1117',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background blobs consistency */}
      <div className="bg-blob bg-blob-1" style={{ top: '-10%', left: '-10%', width: '400px', height: '400px' }}></div>
      <div className="bg-blob bg-blob-2" style={{ bottom: '-10%', right: '-10%', width: '400px', height: '400px' }}></div>

      <InstallPrompt />

      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: isLogin ? '440px' : '650px',
        padding: '40px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        background: 'rgba(20, 20, 22, 0.65)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        zIndex: 10
      }}>
        
        {/* Title Logo Group */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ display: 'inline-flex', background: 'rgba(20, 184, 166, 0.15)', padding: '12px', borderRadius: '16px', marginBottom: '16px', border: '1px solid rgba(20, 184, 166, 0.3)' }}>
            <Activity size={32} color="#14b8a6" />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '900', color: 'white', letterSpacing: '-0.02em', margin: 0 }}>
            DiaBP-Copilot
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '6px', fontWeight: 500 }}>
            {isLogin ? 'Sign in to access your Chronic Care Portal' : 'Self-Onboarding Registration Portal'}
          </p>
          {!isSupabaseConfigured && (
            <div style={{ marginTop: '12px', padding: '8px 12px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '10px', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold', lineHeight: '1.3' }}>
              ⚠ Running in Offline Sandbox (LocalStorage). Data will not sync across devices. Please configure your environment variables.
            </div>
          )}
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '14px', borderRadius: '12px', color: '#f87171', fontSize: '0.8rem', lineHeight: '1.4' }}>
            <AlertCircle size={16} className="shrink-0" style={{ marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '2px' }}>Onboarding Error</strong>
              {error}
            </div>
          </div>
        )}

        <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Credentials Inputs (Common to all) */}
          <div style={{ display: 'grid', gridTemplateColumns: isLogin ? '1fr' : '1fr 1fr', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="doctor@clinic.ng or patient@gmail.com"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '11px 14px', color: 'white', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
                style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '11px 14px', color: 'white', fontSize: '0.85rem', outline: 'none' }}
              />
            </div>
          </div>

          {/* SIGN UP EXTENDED ONBOARDING FIELDS */}
          {!isLogin && (
            <div className="space-y-5 animate-scale-in" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '20px' }}>
              
              {/* Full Name */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  Full Name / Contact Name
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Dr. Alhaji Ibrahim or Chinedu Eze"
                  style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '11px 14px', color: 'white', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              {/* Role Selection Tabs */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                  Choose Your Account Role
                </label>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '4px' }}>
                  <button
                    type="button"
                    onClick={() => setRole('patient')}
                    style={{ flex: 1, padding: '10px 4px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: role === 'patient' ? '#14b8a6' : 'transparent', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <User size={12} /> Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('doctor')}
                    style={{ flex: 1, padding: '10px 4px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: role === 'doctor' ? '#14b8a6' : 'transparent', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Users size={12} /> Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('pharmacist')}
                    style={{ flex: 1, padding: '10px 4px', border: 'none', borderRadius: '8px', cursor: 'pointer', background: role === 'pharmacist' ? '#14b8a6' : 'transparent', color: 'white', fontWeight: 'bold', fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    <Building size={12} /> Pharmacy
                  </button>
                </div>
              </div>

              {/* ROLE-SPECIFIC FORM FIELDS */}

              {/* 1. Patient Form Fields */}
              {role === 'patient' && (
                <div className="space-y-4 animate-fade-in" style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-teal-light)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} /> Clinical Baseline Profiles
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Age (Years)</label>
                      <input
                        type="number"
                        value={age}
                        onChange={(e) => setAge(Number(e.target.value))}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Weight (kg)</label>
                      <input
                        type="number"
                        value={weight}
                        onChange={(e) => setWeight(Number(e.target.value))}
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Baseline Blood Pressure</label>
                      <input
                        type="text"
                        value={baselineBp}
                        onChange={(e) => setBaselineBp(e.target.value)}
                        placeholder="e.g. 135/85 mmHg"
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Target Fasting Glucose</label>
                      <input
                        type="text"
                        value={targetGlucose}
                        onChange={(e) => setTargetGlucose(e.target.value)}
                        placeholder="e.g. 70-130 mg/dL"
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>

                  {/* Conditions Checkboxes */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Diagnosed Conditions</label>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'white', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedConditions.includes("Type 2 Diabetes Mellitus")}
                          onChange={() => handleToggleCondition("Type 2 Diabetes Mellitus")}
                          style={{ accentColor: '#14b8a6' }}
                        /> Type 2 Diabetes
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'white', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedConditions.includes("Essential Hypertension")}
                          onChange={() => handleToggleCondition("Essential Hypertension")}
                          style={{ accentColor: '#14b8a6' }}
                        /> Essential Hypertension
                      </label>
                    </div>
                  </div>

                  {/* Assigned Clinic & Pharmacy dropdowns */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Select Clinic (MD Consult)</label>
                      <select
                        value={assignedClinicId}
                        onChange={(e) => setAssignedClinicId(e.target.value)}
                        style={{ width: '100%', background: '#1c1c1e', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', fontSize: '0.75rem' }}
                      >
                        <option value="">-- No Assigned Clinic --</option>
                        {clinics.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Select Refill Pharmacy</label>
                      <select
                        value={assignedPharmacyId}
                        onChange={(e) => setAssignedPharmacyId(e.target.value)}
                        style={{ width: '100%', background: '#1c1c1e', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', fontSize: '0.75rem' }}
                      >
                        <option value="">-- No Preferred Pharmacy --</option>
                        {pharmacies.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Phone & Address Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Phone Number (for Rider Delivery)</label>
                      <input
                        type="tel"
                        value={patientPhone}
                        onChange={(e) => setPatientPhone(e.target.value)}
                        placeholder="e.g. +234 803 123 4567"
                        required
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Delivery Address</label>
                      <input
                        type="text"
                        value={patientAddress}
                        onChange={(e) => setPatientAddress(e.target.value)}
                        placeholder="e.g. 12 Link Rd, Wuse II"
                        required
                        style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 2. Doctor/Pharmacist Form Fields */}
              {(role === 'doctor' || role === 'pharmacist') && (
                <div className="space-y-4 animate-fade-in" style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-teal-light)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Building size={14} /> Assign Healthcare Facility
                  </h4>

                  {/* Toggle Join vs Create */}
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '8px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'white', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="facilityOpt"
                        checked={onboardOption === 'join'}
                        onChange={() => setOnboardOption('join')}
                        style={{ accentColor: '#14b8a6' }}
                      /> Join Existing Facility
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'white', cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="facilityOpt"
                        checked={onboardOption === 'create'}
                        onChange={() => setOnboardOption('create')}
                        style={{ accentColor: '#14b8a6' }}
                      /> Onboard New Facility
                    </label>
                  </div>

                  {onboardOption === 'join' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                        Select {role === 'doctor' ? 'Clinic' : 'Pharmacy'}
                      </label>
                      <select
                        value={selectedFacilityId}
                        onChange={(e) => setSelectedFacilityId(e.target.value)}
                        style={{ width: '100%', background: '#1c1c1e', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '10px', borderRadius: '8px', fontSize: '0.8rem' }}
                      >
                        <option value="">-- Choose Registered Facility --</option>
                        {role === 'doctor' 
                          ? clinics.map(c => <option key={c.id} value={c.id}>{c.name} ({c.city})</option>)
                          : pharmacies.map(p => <option key={p.id} value={p.id}>{p.name} ({p.city})</option>)
                        }
                      </select>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }} className="animate-scale-in">
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                          New {role === 'doctor' ? 'Clinic' : 'Pharmacy'} Name
                        </label>
                        <input
                          type="text"
                          value={newFacilityName}
                          onChange={(e) => setNewFacilityName(e.target.value)}
                          placeholder="e.g. Garki Specialist Clinic"
                          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem' }}
                        />
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>City</label>
                          <input
                            type="text"
                            value={newFacilityCity}
                            onChange={(e) => setNewFacilityCity(e.target.value)}
                            placeholder="Abuja"
                            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Contact Phone</label>
                          <input
                            type="text"
                            value={newFacilityPhone}
                            onChange={(e) => setNewFacilityPhone(e.target.value)}
                            placeholder="+234..."
                            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Street Address</label>
                        <input
                          type="text"
                          value={newFacilityAddress}
                          onChange={(e) => setNewFacilityAddress(e.target.value)}
                          placeholder="Plot 554, Herbert Macaulay Way"
                          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '8px 12px', color: 'white', fontSize: '0.8rem' }}
                        />
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          )}

          {/* Actions button */}
          <button 
            type="submit" 
            disabled={loading}
            style={{
              background: 'var(--color-teal-light)',
              color: '#0d1117',
              border: 'none',
              borderRadius: '12px',
              padding: '14px',
              fontSize: '0.9rem',
              fontWeight: '900',
              cursor: loading ? 'not-allowed' : 'pointer',
              marginTop: '10px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              transition: 'opacity 0.2s',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? (
              <Loader2 size={20} className="animate-spin" />
            ) : (
              isLogin ? 'Sign In to Care Portal' : 'Complete Onboarding & Start'
            )}
          </button>

        </form>

        {/* Toggle between sign-in and sign-up */}
        <div style={{ textAlign: 'center', marginTop: '8px' }}>
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              textDecoration: 'underline'
            }}
          >
            {isLogin ? "Don't have a clinician or patient account? Onboard here" : "Already have an account? Sign in"}
          </button>
        </div>

      </div>
    </div>
  );
};

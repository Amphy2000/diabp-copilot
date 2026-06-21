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
  ShoppingBag
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

  // Contact editing states
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editPhone, setEditPhone] = useState(profile.phone || '');
  const [editAddress, setEditAddress] = useState(profile.address || '');

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

    onUpdateProfile({
      ...profile,
      bpHistory: updatedBpHistory,
      glucoseHistory: updatedGlucoseHistory,
      streakDays: (profile.streakDays || 0) + 1
    });

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
          </h2>
          <div className="patient-tags" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(profile.conditions || []).map((cond, idx) => (
                <span key={idx} className="tag-item">
                  • {cond}
                </span>
              ))}
              <span className="tag-item">
                Age: {profile.age} | Wt: {profile.weight}kg
              </span>
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
          </div>

          {/* Vitals Logger Form */}
          <div className="glass-panel">
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
          <div className="glass-panel">
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
          </div>

        </div>

        {/* Right Column: AI Foot Ulcer Scanner */}
        <div className="right-column space-y-6">
          
          <div className="glass-panel scanner-card">
            <div className="card-header-divider" style={{ width: '100%' }}>
              <h3 className="card-title">
                <Camera className="card-title-icon text-teal-400" />
                AI Diabetic Foot Scan
              </h3>
            </div>

            {/* High Tech Foot Scanner UI */}
            <div className="foot-scanner-viewport">
              
              {/* Grid Lines */}
              <div className="scanner-grid-overlay"></div>
              
              {/* Stylized Foot Outline */}
              <div className="foot-contour-shape">
                
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
            <div className="glass-panel recommendations-wrapper animate-scale-in" style={{ padding: '15px' }}>
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
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

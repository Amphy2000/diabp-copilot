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
  ShieldCheck
} from 'lucide-react';
import { 
  auditNcdRegimen,
  evaluateNcdRisk,
  NCD_MEDICATIONS
} from '../services/ncdService';
import type { PatientNcdProfile, NcdRefillOrder, NcdClinic, NcdPharmacy } from '../services/ncdService';

interface ClinicianNcdDashboardProps {
  orders: NcdRefillOrder[];
  onUpdateOrderStatus: (orderId: string, status: NcdRefillOrder['status']) => void;
  patients: PatientNcdProfile[];
  clinics: NcdClinic[];
  pharmacies: NcdPharmacy[];
  userRole?: 'doctor' | 'pharmacist' | null;
  facilityId?: string | null;
}

export const ClinicianNcdDashboard: React.FC<ClinicianNcdDashboardProps> = ({ 
  orders, 
  onUpdateOrderStatus, 
  patients,
  clinics,
  pharmacies,
  userRole,
  facilityId
}) => {
  // Multi-Tenant Simulator State
  const [activeRole, setActiveRole] = useState<'clinic' | 'pharmacy'>(
    userRole === 'pharmacist' ? 'pharmacy' : 'clinic'
  );
  const [activeClinicId, setActiveClinicId] = useState<string | null>(
    userRole === 'doctor' && facilityId ? facilityId : (clinics[0]?.id || null)
  );
  const [activePharmacyId, setActivePharmacyId] = useState<string | null>(
    userRole === 'pharmacist' && facilityId ? facilityId : (pharmacies[0]?.id || null)
  );

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

  // Search and Selected Patient State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<PatientNcdProfile | null>(null);

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

  const handleOpenPatientFile = (patient: PatientNcdProfile) => {
    setSelectedPatient(patient);
    
    // Pre-populate AI dosage auditor with patient values
    setAuditAge(patient.age);
    setAuditWeight(patient.weight);
    setPatientMeds([...patient.activeMeds]);
    
    const latestBp = patient.bpHistory[patient.bpHistory.length - 1] || { systolic: 120, diastolic: 80 };
    setAuditSystolic(latestBp.systolic);
    setAuditDiastolic(latestBp.diastolic);
    
    const latestGlucose = patient.glucoseHistory[patient.glucoseHistory.length - 1] || { level: 100, type: 'Fasting' };
    setAuditGlucose(latestGlucose.level);
    setAuditGlucoseType(latestGlucose.type);
  };

  const handleNudge = (patientName: string, issue: string) => {
    alert(`WhatsApp Nudge Sent!\nTo: ${patientName}\nMessage: "Good day from your care team. We noticed your ${issue}. Please inspect your feet, log readings, and consult your pharmacist."`);
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

  const getRiskClass = (risk: 'Low' | 'Medium' | 'High' | 'Emergency') => {
    return risk.toLowerCase();
  };

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
          </div>
        </div>
      </div>

      {/* 2. Grid Layout: Left Registry Directory & Right Auditing Detail File */}
      <div className="dashboard-grid">
        
        {/* Left Column: Patients Registry */}
        <div className="glass-panel left-column">
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
                  <th style={{ padding: '10px 8px', textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {searchedPatients.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No patients assigned to this facility match your search.
                    </td>
                  </tr>
                ) : (
                  searchedPatients.map((p, idx) => {
                    const latestBp = p.bpHistory[p.bpHistory.length - 1] || { systolic: 120, diastolic: 80 };
                    const latestGlucose = p.glucoseHistory[p.glucoseHistory.length - 1] || { level: 100, type: 'Fasting' };
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
                        <td style={{ padding: '12px 8px', fontWeight: 'bold', color: 'white' }}>{p.name}</td>
                        <td style={{ padding: '12px 8px' }}>{p.age}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span style={{ color: '#60a5fa' }}>{latestBp.systolic}/{latestBp.diastolic}</span> | <span style={{ color: '#fb923c' }}>{latestGlucose.level} mg/dL</span>
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
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
                  <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white', fontWeight: '800' }}>
                    {selectedPatient.name}
                  </h3>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    <span>Age: <strong>{selectedPatient.age}</strong></span>
                    <span>•</span>
                    <span>Weight: <strong>{selectedPatient.weight} kg</strong></span>
                    <span>•</span>
                    <span>Streak: <strong>{selectedPatient.streakDays} days</strong></span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedPatient(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Patient Alerts Box */}
              {(() => {
                const latestBp = selectedPatient.bpHistory[selectedPatient.bpHistory.length - 1] || { systolic: 120, diastolic: 80 };
                const latestGlucose = selectedPatient.glucoseHistory[selectedPatient.glucoseHistory.length - 1] || { level: 100, type: 'Fasting' };
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
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.75rem', color: 'white', fontWeight: 'bold' }}>Vitals Logs History</h4>
                <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '0.75rem' }}>
                  {selectedPatient.bpHistory.map((bp, idx) => {
                    const sugar = selectedPatient.glucoseHistory[idx] || { level: 100, type: 'Fasting' };
                    return (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{bp.date}</span>
                        <span>BP: <strong>{bp.systolic}/{bp.diastolic}</strong></span>
                        <span>Glucose: <strong>{sugar.level} mg/dL</strong> ({sugar.type})</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Foot Scan History Soles contour mapping */}
              {selectedPatient.footScanHistory.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(20, 184, 166, 0.03)', borderRadius: '10px', border: '1px solid rgba(20, 184, 166, 0.1)', display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '60px', height: '80px', background: '#1c1c1e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: '30px', height: '60px', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: '100px', margin: '10px auto', position: 'relative' }}>
                      {selectedPatient.footScanHistory[selectedPatient.footScanHistory.length - 1].hotspots.map((spot, i) => (
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
                      Risk Index: <strong>{selectedPatient.footScanHistory[selectedPatient.footScanHistory.length - 1].riskScore}%</strong> • 
                      {selectedPatient.footScanHistory[selectedPatient.footScanHistory.length - 1].hasHotspots ? " Hotspots detected on Metatarsal head." : " No hotspots detected."}
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
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calculator size={14} className="text-blue-400" /> AI Regimen Titration Copilot
                  </h4>
                  
                  {/* Active Meds display */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    {selectedPatient.activeMeds.map((med, i) => (
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
                </div>
              ) : (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: '0.8rem', color: 'var(--color-teal-light)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <ShieldCheck size={14} /> SafeMeds Dispensing Audit Checklist
                  </h4>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
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
                </div>
              )}

            </div>
          )}
        </div>

      </div>

      {/* 3. Orders List Table */}
      <div className="glass-panel">
        <div className="card-header-divider">
          <h3 className="card-title">
            <ClipboardList className="card-title-icon text-teal-400" /> Prescriptions & Refill Requests
          </h3>
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
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No refill verification requests mapped to this provider.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order, index) => (
                  <tr key={index}>
                    <td style={{ fontWeight: 'bold', color: 'white' }}>{order.id}</td>
                    <td>
                      {order.patientName || "Chief Chinedu Eze"}
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
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                              <span className="order-rx-badge-pill valid" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', borderColor: 'rgba(56, 189, 248, 0.3)' }}>
                                Details Provided
                              </span>
                              <div style={{ fontSize: '9px', color: 'var(--text-muted)', maxWidth: '140px', whiteSpace: 'normal', fontStyle: 'italic', lineHeight: '1.2' }}>
                                "{order.prescriptionDetails}"
                              </div>
                            </div>
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
                              <button
                                onClick={() => onUpdateOrderStatus(order.id, 'Approved')}
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
                            )}
                            {order.status === 'Approved' && (
                              <button
                                onClick={() => onUpdateOrderStatus(order.id, 'Out for Delivery')}
                                className="btn-action-table"
                                style={{ background: 'var(--color-blue)' }}
                              >
                                Hand to Rider
                              </button>
                            )}
                            {order.status === 'Out for Delivery' && (
                              <button
                                onClick={() => onUpdateOrderStatus(order.id, 'Delivered')}
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

    </div>
  );
};

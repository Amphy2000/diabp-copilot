import React, { useState } from 'react';
import { 
  Users, 
  Calculator, 
  ClipboardList, 
  CheckCircle, 
  MessageSquare, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { 
  auditNcdRegimen 
} from '../services/ncdService';
import type { PatientNcdProfile, NcdRefillOrder, NcdClinic, NcdPharmacy } from '../services/ncdService';

interface ClinicianNcdDashboardProps {
  orders: NcdRefillOrder[];
  onUpdateOrderStatus: (orderId: string, status: NcdRefillOrder['status']) => void;
  patientProfile: PatientNcdProfile;
  clinics: NcdClinic[];
  pharmacies: NcdPharmacy[];
}

export const ClinicianNcdDashboard: React.FC<ClinicianNcdDashboardProps> = ({ 
  orders, 
  onUpdateOrderStatus, 
  patientProfile,
  clinics,
  pharmacies
}) => {
  // Simulation States for Multi-Tenant Role Switcher
  const [activeRole, setActiveRole] = useState<'clinic' | 'pharmacy'>('clinic');
  const [activeClinicId, setActiveClinicId] = useState<string | null>(clinics[0]?.id || null);
  const [activePharmacyId, setActivePharmacyId] = useState<string | null>(pharmacies[0]?.id || null);

  // Check if patient is assigned to simulated tenant
  const isPatientAssigned = activeRole === 'clinic'
    ? patientProfile.assignedClinicId === activeClinicId
    : patientProfile.assignedPharmacyId === activePharmacyId;

  // Filter orders matching simulated tenant
  const filteredOrders = activeRole === 'pharmacy'
    ? orders.filter(o => o.pharmacyId === activePharmacyId)
    : orders.filter(o => isPatientAssigned); // clinics only see orders if patient belongs to their clinic

  // Extract latest logs for audit initial states
  const latestBp = patientProfile.bpHistory[patientProfile.bpHistory.length - 1] || { systolic: 120, diastolic: 80 };
  const latestGlucose = patientProfile.glucoseHistory[patientProfile.glucoseHistory.length - 1] || { level: 100, type: 'Fasting' };

  // Auditor form state
  const [auditAge, setAuditAge] = useState<number>(patientProfile.age);
  const [auditWeight, setAuditWeight] = useState<number>(patientProfile.weight);
  const [auditSystolic, setAuditSystolic] = useState<number>(latestBp.systolic);
  const [auditDiastolic, setAuditDiastolic] = useState<number>(latestBp.diastolic);
  const [auditGlucose, setAuditGlucose] = useState<number>(latestGlucose.level);
  const [auditGlucoseType, setAuditGlucoseType] = useState<'Fasting' | 'Post-Meal'>('Fasting');
  const [patientMeds, setPatientMeds] = useState<string[]>([...patientProfile.activeMeds]);

  // Execute AI audit calculations
  const auditResults = auditNcdRegimen(
    auditAge,
    auditWeight,
    auditSystolic,
    auditDiastolic,
    auditGlucose,
    auditGlucoseType,
    patientMeds
  );

  const handleNudge = (patientName: string, issue: string) => {
    alert(`Nudge dispatched! Simulated WhatsApp alert sent to ${patientName}: \n"Good day, this is your clinical care team. We noticed your ${issue}. Please stay hydrated, limit salt/sugar, and log your daily values."`);
  };

  const handleToggleMed = (medName: string) => {
    if (patientMeds.includes(medName)) {
      setPatientMeds(patientMeds.filter(m => m !== medName));
    } else {
      setPatientMeds([...patientMeds, medName]);
    }
  };

  const MOCK_MED_OPTIONS = [
    "Metformin 1000mg Twice Daily",
    "Amlodipine 10mg Daily",
    "Lisinopril 20mg Daily",
    "Lantus Insulin Pen 15 units Daily"
  ];

  return (
    <div className="space-y-6 animate-fade-in" style={{ paddingBottom: '30px' }}>
      
      {/* Tenant Switcher Simulation Panel */}
      <div className="glass-panel" style={{ padding: '16px', background: 'rgba(20, 20, 20, 0.4)', border: '1px solid rgba(255,255,255,0.05)', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 800, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ArrowRight className="w-4 h-4 text-blue-400" /> Multi-Tenant Role Switcher (Audit Simulator)
            </h4>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              Select a clinical facility or pharmacy to inspect routed data. Only assigned providers can view records.
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
              <button
                onClick={() => setActiveRole('clinic')}
                style={{ padding: '8px 12px', fontSize: '0.7rem', border: 'none', background: activeRole === 'clinic' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: activeRole === 'clinic' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Clinic / Doctor
              </button>
              <button
                onClick={() => setActiveRole('pharmacy')}
                style={{ padding: '8px 12px', fontSize: '0.7rem', border: 'none', background: activeRole === 'pharmacy' ? 'rgba(59, 130, 246, 0.2)' : 'transparent', color: activeRole === 'pharmacy' ? 'white' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 'bold' }}
              >
                Pharmacy
              </button>
            </div>

            {activeRole === 'clinic' ? (
              <select
                value={activeClinicId || ''}
                onChange={(e) => setActiveClinicId(e.target.value)}
                style={{ background: '#1c1c1e', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', fontSize: '0.7rem' }}
              >
                {clinics.map(c => (
                  <option key={c.id} value={c.id}>{c.name} ({c.city})</option>
                ))}
              </select>
            ) : (
              <select
                value={activePharmacyId || ''}
                onChange={(e) => setActivePharmacyId(e.target.value)}
                style={{ background: '#1c1c1e', color: 'white', border: '1px solid rgba(255,255,255,0.1)', padding: '8px', borderRadius: '8px', fontSize: '0.7rem' }}
              >
                {pharmacies.map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.city})</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Triage Alerts and Auditor */}
      <div className="dashboard-grid">
        
        {/* Left: Patient Alerts Feed */}
        <div className="glass-panel left-column">
          <div className="card-header-divider">
            <h3 className="card-title">
              <Users className="card-title-icon text-orange-500" /> Patient Alerts Feed
            </h3>
          </div>

          <div className="alerts-card-list">
            
            {isPatientAssigned ? (
              <>
                {/* Alert Item 1: Chief Chinedu BP warning */}
                {latestBp.systolic >= 140 && (
                  <div className="alert-feed-card critical">
                    <div className="alert-card-meta">
                      <div>
                        <h4 className="alert-patient-name">{patientProfile.name}</h4>
                        <p className="alert-urgency-type critical">Elevated Stroke Risk</p>
                      </div>
                      <span className="alert-timestamp">5 mins ago</span>
                    </div>
                    <p className="alert-card-body">
                      Blood pressure logged at <strong>{latestBp.systolic}/{latestBp.diastolic} mmHg</strong> (Stage 2 Hypertension). Heart rate is slightly tachycardic.
                    </p>
                    <button
                      onClick={() => handleNudge(patientProfile.name, `blood pressure is elevated at ${latestBp.systolic}/{latestBp.diastolic} mmHg. Please log values twice daily.`)}
                      className="btn-nudge"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Send WhatsApp Nudge
                    </button>
                  </div>
                )}

                {/* Alert Item 2: Chief Chinedu Glucose warning */}
                {latestGlucose.level >= 130 && (
                  <div className="alert-feed-card warning">
                    <div className="alert-card-meta">
                      <div>
                        <h4 className="alert-patient-name">{patientProfile.name}</h4>
                        <p className="alert-urgency-type warning">Hyperglycemia Warning</p>
                      </div>
                      <span className="alert-timestamp">10 mins ago</span>
                    </div>
                    <p className="alert-card-body">
                      Fasting glucose logged at <strong>{latestGlucose.level} mg/dL</strong> (Target &lt; 130). Metformin adherence requires verification.
                    </p>
                    <button
                      onClick={() => handleNudge(patientProfile.name, `fasting blood glucose is elevated at ${latestGlucose.level} mg/dL. Ensure Metformin is taken with food.`)}
                      className="btn-nudge"
                    >
                      <MessageSquare className="w-3.5 h-3.5" /> Send WhatsApp Nudge
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <ShieldAlert className="w-8 h-8 text-gray-500" style={{ margin: '0 auto 12px auto' }} />
                <p style={{ margin: 0, fontSize: '0.8rem', fontWeight: 'bold', color: 'white' }}>
                  No Patients Found
                </p>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.7rem' }}>
                  Choose the provider assigned to the patient on the Care Dashboard to simulate active consultation records.
                </p>
              </div>
            )}

          </div>
        </div>

        {/* Right: AI Dosing & Titration Copilot */}
        <div className="glass-panel right-column">
          <div className="card-header-divider">
            <h3 className="card-title">
              <Calculator className="card-title-icon text-teal-400" /> AI NCD Dosage Auditor & Titration Copilot
            </h3>
          </div>

          {/* Calculator Inputs Grid */}
          <div className="auditor-config-box">
            <div className="input-wrapper">
              <label className="input-label">Systolic / Diastolic</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <input
                  type="number"
                  value={auditSystolic}
                  onChange={(e) => setAuditSystolic(Number(e.target.value))}
                  className="input-control"
                  style={{ padding: '6px' }}
                />
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <input
                  type="number"
                  value={auditDiastolic}
                  onChange={(e) => setAuditDiastolic(Number(e.target.value))}
                  className="input-control"
                  style={{ padding: '6px' }}
                />
              </div>
            </div>

            <div className="input-wrapper">
              <label className="input-label">Glucose Level (mg/dL)</label>
              <input
                type="number"
                value={auditGlucose}
                onChange={(e) => setAuditGlucose(Number(e.target.value))}
                className="input-control"
                style={{ padding: '6px' }}
              />
            </div>

            <div className="input-wrapper">
              <label className="input-label">Glucose State</label>
              <select
                value={auditGlucoseType}
                onChange={(e) => setAuditGlucoseType(e.target.value as any)}
                className="select-control"
                style={{ padding: '6px' }}
              >
                <option value="Fasting">Fasting</option>
                <option value="Post-Meal">Post-Meal</option>
              </select>
            </div>

            <div className="input-wrapper">
              <label className="input-label">Weight (kg)</label>
              <input
                type="number"
                value={auditWeight}
                onChange={(e) => setAuditWeight(Number(e.target.value))}
                className="input-control"
                style={{ padding: '6px' }}
              />
            </div>

            <div className="input-wrapper">
              <label className="input-label">Age (years)</label>
              <input
                type="number"
                value={auditAge}
                onChange={(e) => setAuditAge(Number(e.target.value))}
                className="input-control"
                style={{ padding: '6px' }}
              />
            </div>

            {/* Mock Active Meds check-list in Auditor */}
            <div className="auditor-meds-box">
              <div className="input-label">Audited Active Medications:</div>
              <div className="auditor-meds-grid">
                {MOCK_MED_OPTIONS.map((med, idx) => {
                  const active = patientMeds.includes(med);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleToggleMed(med)}
                      className={`btn-auditor-med ${active ? 'active' : ''}`}
                    >
                      {med}
                    </button>
                  );
                })}
              </div>
            </div>

          </div>

          {/* Audit Results */}
          <div className="space-y-4">
            
            {/* Warning Message if Uncontrolled */}
            {auditResults.warning && (
              <div className="auditor-alarm-box">
                <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0" style={{ marginTop: '2px' }} />
                <div className="alarm-info">
                  <h4>Clinical Dosing Alarm</h4>
                  <p>{auditResults.warning}</p>
                </div>
              </div>
            )}

            {/* Recommendations Grid */}
            <div className="auditor-results-layout">
              
              {/* Guidelines Protocol */}
              <div className="audit-block-teal">
                <div className="audit-block-title">Clinical Audit Protocols</div>
                <ul className="audit-guidelines-list" style={{ marginTop: '0.5rem' }}>
                  {auditResults.notes.map((note, idx) => (
                    <li key={idx} className="audit-guideline-bullet">
                      {note}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Titration Steps */}
              <div className="audit-block-gray">
                <div className="audit-block-title">AI Titration Pathways</div>
                {auditResults.recommendations.length === 0 ? (
                  <p className="audit-block-sub" style={{ color: 'var(--color-green)', marginTop: '0.5rem', fontWeight: 'bold' }}>✓ Patient values are stable. Maintain current dose schedules.</p>
                ) : (
                  <ul className="audit-guidelines-list" style={{ marginTop: '0.5rem' }}>
                    {auditResults.recommendations.map((rec, idx) => (
                      <li key={idx} className="titration-step-item">
                        <ArrowRight className="titration-step-item-icon w-3.5 h-3.5" />
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

            </div>

          </div>

        </div>

      </div>

      {/* Orders List Table */}
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
                <th style={{ textAlign: 'center' }}>Actions</th>
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
                      {order.id === 'NCD-6088' || order.id === 'NCD-5521' ? patientProfile.name : "Alhaji Ibrahim"}
                    </td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.items.join(', ')}</td>
                    <td style={{ textAlign: 'center' }}>
                      {order.prescriptionRequired ? (
                        order.prescriptionUploaded ? (
                          <span className="order-rx-badge-pill valid">
                            Uploaded (Chief_Eze_Rx.pdf)
                          </span>
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
                        {order.status === 'Pending Verification' && (
                          <button
                            onClick={() => onUpdateOrderStatus(order.id, 'Approved')}
                            className="btn-action-table"
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

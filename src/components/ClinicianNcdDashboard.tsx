import React, { useState } from 'react';
import { 
  Users, 
  Calculator, 
  ClipboardList, 
  CheckCircle, 
  AlertCircle, 
  MessageSquare, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { 
  auditNcdRegimen 
} from '../services/ncdService';
import type { PatientNcdProfile, NcdRefillOrder } from '../services/ncdService';


interface ClinicianNcdDashboardProps {
  orders: NcdRefillOrder[];
  onUpdateOrderStatus: (orderId: string, status: NcdRefillOrder['status']) => void;
  patientProfile: PatientNcdProfile;
}

export const ClinicianNcdDashboard: React.FC<ClinicianNcdDashboardProps> = ({ 
  orders, 
  onUpdateOrderStatus, 
  patientProfile 
}) => {
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
    alert(`Nudge dispatched! Simulated WhatsApp alert sent to ${patientName}: \n"Good day, this is your clinical pharmacist. We noticed your ${issue}. Please stay hydrated, adjust salt/sugar intake, and log your daily readings."`);
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
      
      {/* Grid: Triage Alerts and Auditor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Patient Alerts Feed */}
        <div className="lg:col-span-4 glass-panel p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <Users className="w-5 h-5 text-orange-500" /> Patient Alerts Feed
          </h3>

          <div className="space-y-3">
            
            {/* Alert Item 1: Chief Chinedu BP warning */}
            {latestBp.systolic >= 140 && (
              <div className="p-4 border border-red-500/20 bg-red-950/10 rounded-xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-sm">{patientProfile.name}</h4>
                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mt-0.5">Elevated Stroke Risk</p>
                  </div>
                  <span className="text-[10px] text-gray-500 font-semibold">5 mins ago</span>
                </div>
                <p className="text-xs text-gray-300 leading-normal">
                  Blood pressure logged at **{latestBp.systolic}/{latestBp.diastolic} mmHg** (Stage 2 Hypertension). Heart rate is slightly tachycardic.
                </p>
                <button
                  onClick={() => handleNudge(patientProfile.name, `blood pressure is elevated at ${latestBp.systolic}/${latestBp.diastolic} mmHg. Please log values twice daily.`)}
                  className="w-full py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Send WhatsApp Nudge
                </button>
              </div>
            )}

            {/* Alert Item 2: Chief Chinedu Glucose warning */}
            {latestGlucose.level >= 130 && (
              <div className="p-4 border border-orange-500/15 bg-orange-950/10 rounded-xl space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-white text-sm">{patientProfile.name}</h4>
                    <p className="text-[10px] text-orange-400 font-bold uppercase tracking-wider mt-0.5">Hyperglycemia Warning</p>
                  </div>
                  <span className="text-[10px] text-gray-500 font-semibold">10 mins ago</span>
                </div>
                <p className="text-xs text-gray-300 leading-normal">
                  Fasting glucose logged at **{latestGlucose.level} mg/dL** (Target &lt; 130). Metformin adherence requires verification.
                </p>
                <button
                  onClick={() => handleNudge(patientProfile.name, `fasting blood glucose is elevated at ${latestGlucose.level} mg/dL. Ensure Metformin is taken with food.`)}
                  className="w-full py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-300 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="w-3.5 h-3.5" /> Send WhatsApp Nudge
                </button>
              </div>
            )}

          </div>
        </div>

        {/* Right: AI Dosing & Titration Copilot */}
        <div className="lg:col-span-8 glass-panel p-6 space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
            <Calculator className="w-5 h-5 text-teal-500" /> AI NCD Dosage Auditor & Titration Copilot
          </h3>

          {/* Calculator Inputs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-gray-950/40 p-4 rounded-xl border border-gray-800/80">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Systolic / Diastolic</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={auditSystolic}
                  onChange={(e) => setAuditSystolic(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-white"
                />
                <span className="text-gray-500">/</span>
                <input
                  type="number"
                  value={auditDiastolic}
                  onChange={(e) => setAuditDiastolic(Number(e.target.value))}
                  className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-white"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Glucose Level (mg/dL)</label>
              <input
                type="number"
                value={auditGlucose}
                onChange={(e) => setAuditGlucose(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Glucose State</label>
              <select
                value={auditGlucoseType}
                onChange={(e) => setAuditGlucoseType(e.target.value as any)}
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-white"
              >
                <option value="Fasting">Fasting</option>
                <option value="Post-Meal">Post-Meal</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Weight (kg)</label>
              <input
                type="number"
                value={auditWeight}
                onChange={(e) => setAuditWeight(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-white"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Age (years)</label>
              <input
                type="number"
                value={auditAge}
                onChange={(e) => setAuditAge(Number(e.target.value))}
                className="w-full px-2 py-1.5 bg-gray-900 border border-gray-800 rounded text-xs text-white"
              />
            </div>

            {/* Mock Active Meds check-list in Auditor */}
            <div className="sm:col-span-3 space-y-2 border-t border-gray-800/40 pt-3">
              <div className="text-[10px] text-gray-400 font-bold uppercase">Audited Active Medications:</div>
              <div className="flex flex-wrap gap-2">
                {MOCK_MED_OPTIONS.map((med, idx) => {
                  const active = patientMeds.includes(med);
                  return (
                    <button
                      key={idx}
                      onClick={() => handleToggleMed(med)}
                      className={`text-xs px-2.5 py-1.5 rounded-lg border font-medium transition-all ${
                        active 
                          ? 'border-teal-500/40 bg-teal-950/20 text-teal-300' 
                          : 'border-gray-800 bg-gray-900 text-gray-500 hover:border-gray-700'
                      }`}
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
              <div className="p-4 border border-orange-500/30 bg-orange-950/20 rounded-xl flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-white text-sm">Clinical Dosing Alarm</h4>
                  <p className="text-xs text-orange-300 leading-normal mt-1">{auditResults.warning}</p>
                </div>
              </div>
            )}

            {/* Recommendations Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Guidelines Protocol */}
              <div className="p-4 border border-teal-500/20 bg-teal-950/15 rounded-xl space-y-2">
                <div className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">Clinical Audit Protocols</div>
                <ul className="space-y-1.5 text-xs text-gray-300 leading-relaxed">
                  {auditResults.notes.map((note, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-teal-500">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Titration Steps */}
              <div className="p-4 border border-gray-800 bg-gray-950/40 rounded-xl space-y-2">
                <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">AI Titration Pathways</div>
                {auditResults.recommendations.length === 0 ? (
                  <p className="text-xs text-green-400 font-medium">✓ Patient values are stable. Maintain current dose schedules.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs text-teal-300 leading-relaxed">
                    {auditResults.recommendations.map((rec, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <ArrowRight className="w-3.5 h-3.5 text-teal-400 shrink-0 mt-0.5" />
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
      <div className="glass-panel p-6 space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
          <ClipboardList className="w-5 h-5 text-teal-500" /> Prescriptions & Refill Requests
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-800">
                <th className="py-2.5 font-medium">Order ID</th>
                <th className="py-2.5 font-medium">Patient</th>
                <th className="py-2.5 font-medium">Refill Package</th>
                <th className="py-2.5 font-medium text-center">Prescription Refill</th>
                <th className="py-2.5 font-medium text-right">Value</th>
                <th className="py-2.5 font-medium text-center">Status</th>
                <th className="py-2.5 font-medium text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {orders.map((order, index) => (
                <tr key={index} className="text-gray-300 hover:bg-white/5 transition-colors">
                  <td className="py-3.5 font-bold text-white">{order.id}</td>
                  <td className="py-3.5 font-medium">
                    {order.id === 'NCD-6088' || order.id === 'NCD-5521' ? patientProfile.name : "Alhaji Ibrahim"}
                  </td>
                  <td className="py-3.5 text-gray-400 max-w-[200px] truncate">{order.items.join(', ')}</td>
                  <td className="py-3.5 text-center">
                    {order.prescriptionRequired ? (
                      order.prescriptionUploaded ? (
                        <span className="px-2 py-0.5 rounded bg-green-500/10 text-green-400 text-xs border border-green-500/10 font-medium">
                          Uploaded (Chief_Eze_Rx.pdf)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-xs border border-red-500/10 font-medium">
                          Missing Prescription
                        </span>
                      )
                    ) : (
                      <span className="text-xs text-gray-500">Not Required</span>
                    )}
                  </td>
                  <td className="py-3.5 text-right font-extrabold text-white">₦{order.totalNaira.toLocaleString()}</td>
                  <td className="py-3.5 text-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      order.status === 'Delivered' ? 'text-green-400 bg-green-950/20' :
                      order.status === 'Out for Delivery' ? 'text-blue-400 bg-blue-950/20' :
                      order.status === 'Approved' ? 'text-teal-400 bg-teal-950/20' :
                      'text-orange-400 bg-orange-950/20'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="py-3.5 text-center">
                    <div className="flex justify-center gap-1.5">
                      {order.status === 'Pending Verification' && (
                        <button
                          onClick={() => onUpdateOrderStatus(order.id, 'Approved')}
                          className="px-2 py-1 rounded bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold transition-all"
                        >
                          Verify & Approve
                        </button>
                      )}
                      {order.status === 'Approved' && (
                        <button
                          onClick={() => onUpdateOrderStatus(order.id, 'Out for Delivery')}
                          className="px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold transition-all"
                        >
                          Hand to Rider
                        </button>
                      )}
                      {order.status === 'Out for Delivery' && (
                        <button
                          onClick={() => onUpdateOrderStatus(order.id, 'Delivered')}
                          className="px-2 py-1 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-bold transition-all"
                        >
                          Confirm Delivery
                        </button>
                      )}
                      {order.status === 'Delivered' && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Complete
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

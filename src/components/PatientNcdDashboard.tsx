import React, { useState } from 'react';
import { 
  Heart, 
  Activity, 
  AlertTriangle, 
  Camera, 
  Upload, 
  Clock, 
  CheckCircle,
  Plus,
  Compass
} from 'lucide-react';
import { 
  evaluateNcdRisk, 
  simulateFootScan 
} from '../services/ncdService';
import type { PatientNcdProfile, FootScanRecord } from '../services/ncdService';

interface PatientNcdDashboardProps {
  profile: PatientNcdProfile;
  onUpdateProfile: (updated: PatientNcdProfile) => void;
}

export const PatientNcdDashboard: React.FC<PatientNcdDashboardProps> = ({ profile, onUpdateProfile }) => {
  // Input fields
  const [systolic, setSystolic] = useState<number>(140);
  const [diastolic, setDiastolic] = useState<number>(90);
  const [glucose, setGlucose] = useState<number>(130);
  const [glucoseType, setGlucoseType] = useState<'Fasting' | 'Post-Meal'>('Fasting');
  const [logMessage, setLogMessage] = useState<string | null>(null);

  // Foot scanner simulation states
  const [scanning, setScanning] = useState<boolean>(false);
  const [scanRecord, setScanRecord] = useState<FootScanRecord | null>(
    profile.footScanHistory.length > 0 ? profile.footScanHistory[profile.footScanHistory.length - 1] : null
  );

  // Evaluate current risk indicators based on profile values
  const currentBp = profile.bpHistory[profile.bpHistory.length - 1] || { systolic: 120, diastolic: 80 };
  const currentGlucose = profile.glucoseHistory[profile.glucoseHistory.length - 1] || { level: 100, type: 'Fasting' };
  
  const riskEval = evaluateNcdRisk(
    currentBp.systolic,
    currentBp.diastolic,
    currentGlucose.level,
    currentGlucose.type
  );

  // Handle logging a new BP / Glucose reading
  const handleLogVitals = (e: React.FormEvent) => {
    e.preventDefault();
    
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const updatedBpHistory = [...profile.bpHistory, { date: today, systolic, diastolic }];
    const updatedGlucoseHistory = [...profile.glucoseHistory, { date: today, level: glucose, type: glucoseType }];

    onUpdateProfile({
      ...profile,
      bpHistory: updatedBpHistory,
      glucoseHistory: updatedGlucoseHistory,
      streakDays: profile.streakDays + 1
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
      setTimeout(() => {
        const result = simulateFootScan(file.name);
        setScanRecord(result);
        setScanning(false);
        
        // Append to profile history
        onUpdateProfile({
          ...profile,
          footScanHistory: [...profile.footScanHistory, result]
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
          <div className="patient-tags">
            {profile.conditions.map((cond, idx) => (
              <span key={idx} className="tag-item">
                • {cond}
              </span>
            ))}
            <span className="tag-item">
              Age: {profile.age} | Wt: {profile.weight}kg
            </span>
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

          {/* Vitals History Log list */}
          <div className="glass-panel history-section">
            <div className="card-header-divider" style={{ borderBottom: 'none', paddingBottom: 0, marginBottom: '0.5rem' }}>
              <h3 className="card-title" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                <Clock className="card-title-icon text-gray-500" />
                Recent Vitals History
              </h3>
            </div>
            
            <div className="history-scroll-box">
              {profile.bpHistory.map((bp, index) => {
                const sugar = profile.glucoseHistory[index] || { level: 120, type: 'Fasting' };
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
            <div className="glass-panel recommendations-wrapper animate-scale-in">
              <h4 className="card-title" style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-teal-light)' }}>
                <CheckCircle className="w-3.5 h-3.5" />
                AI Recommended Actions:
              </h4>
              <ul className="recommendations-list">
                {scanRecord.recommendations.map((rec, index) => (
                  <li key={index} className="recommendation-bullet-item">
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>

      </div>

    </div>
  );
};

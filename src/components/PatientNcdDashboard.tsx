import React, { useState } from 'react';
import { 
  Heart, 
  Activity, 
  Flame, 
  AlertTriangle, 
  Camera, 
  Upload, 
  Clock, 
  User, 
  CheckCircle,
  Plus,
  Compass
} from 'lucide-react';
import { 
  evaluateNcdRisk, 
  simulateFootScan, 
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

  const getRiskBadgeColor = (risk: 'Low' | 'Medium' | 'High' | 'Emergency') => {
    switch (risk) {
      case 'Emergency': return 'text-red-500 bg-red-950/20 border-red-800/30';
      case 'High': return 'text-orange-500 bg-orange-950/20 border-orange-800/30';
      case 'Medium': return 'text-amber-500 bg-amber-950/20 border-amber-800/30';
      default: return 'text-teal-400 bg-teal-950/20 border-teal-800/30';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" style={{ paddingBottom: '40px' }}>
      
      {/* Patient Header Box */}
      <div className="glass-panel p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold text-white">{profile.name}</h2>
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-950 text-blue-300 border border-blue-800">
              Active Patient
            </span>
          </div>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {profile.conditions.map((cond, idx) => (
              <span key={idx} className="text-xs text-gray-400 px-2 py-0.5 bg-gray-900 border border-gray-800 rounded">
                • {cond}
              </span>
            ))}
            <span className="text-xs text-gray-400 px-2 py-0.5 bg-gray-900 border border-gray-800 rounded">
              Age: {profile.age} | Wt: {profile.weight}kg
            </span>
          </div>
        </div>

        {/* Adherence Streak */}
        <div className="flex items-center gap-3 bg-teal-500/10 border border-teal-500/20 px-4 py-2.5 rounded-xl">
          <Heart className="w-6 h-6 text-teal-400 fill-teal-400/20 animate-pulse" />
          <div>
            <div className="text-xs text-teal-400 font-bold uppercase tracking-wider">Log Adherence Streak</div>
            <div className="text-lg font-bold text-white">{profile.streakDays} Days Active</div>
          </div>
        </div>
      </div>

      {logMessage && (
        <div className="p-4 bg-teal-900/20 border border-teal-500/30 text-teal-300 rounded-xl text-sm font-semibold text-center">
          {logMessage}
        </div>
      )}

      {/* Grid: Left Vitals Log & Right AI Foot Scanner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Vitals Log & Health Indicators */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Active Risk Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Blood Pressure Summary */}
            <div className="glass-panel p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-semibold uppercase">Blood Pressure</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRiskBadgeColor(riskEval.strokeRisk)}`}>
                  {riskEval.strokeRisk} Stroke Risk
                </span>
              </div>
              <div className="text-3xl font-black text-white">
                {currentBp.systolic} <span className="text-base text-gray-500">/ {currentBp.diastolic}</span> <span className="text-xs text-gray-500">mmHg</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed border-t border-gray-800/40 pt-2.5">
                {riskEval.bpWarning}
              </p>
            </div>

            {/* Blood Sugar Summary */}
            <div className="glass-panel p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400 font-semibold uppercase">Blood Glucose</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getRiskBadgeColor(riskEval.diabeticRisk)}`}>
                  {riskEval.diabeticRisk} Diabetic Risk
                </span>
              </div>
              <div className="text-3xl font-black text-white">
                {currentGlucose.level} <span className="text-xs text-gray-500">mg/dL</span>
                <span className="text-xs text-gray-400 ml-1.5 font-medium">({currentGlucose.type})</span>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed border-t border-gray-800/40 pt-2.5">
                {riskEval.glucoseWarning}
              </p>
            </div>

          </div>

          {/* Vitals Logger Form */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
              <Activity className="w-5 h-5 text-blue-500" /> Log Daily Readings
            </h3>

            <form onSubmit={handleLogVitals} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* BP Entry */}
              <div className="space-y-3 p-4 border border-gray-850 rounded-xl bg-gray-950/20">
                <div className="text-xs font-bold text-blue-400 uppercase">Log Blood Pressure</div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Systolic</label>
                    <input 
                      type="number"
                      value={systolic}
                      onChange={(e) => setSystolic(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Diastolic</label>
                    <input 
                      type="number"
                      value={diastolic}
                      onChange={(e) => setDiastolic(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Glucose Entry */}
              <div className="space-y-3 p-4 border border-gray-850 rounded-xl bg-gray-950/20">
                <div className="text-xs font-bold text-orange-400 uppercase">Log Blood Sugar</div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Sugar Level (mg/dL)</label>
                    <input 
                      type="number"
                      value={glucose}
                      onChange={(e) => setGlucose(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Type</label>
                    <select
                      value={glucoseType}
                      onChange={(e) => setGlucoseType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-gray-900 border border-gray-800 rounded-lg text-sm text-white focus:outline-none focus:border-orange-500"
                    >
                      <option value="Fasting">Fasting</option>
                      <option value="Post-Meal">Post-Meal</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end pt-2">
                <button
                  type="submit"
                  className="btn-primary-scd flex items-center gap-1.5 text-sm"
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}
                >
                  <Plus className="w-4 h-4" /> Save Readings
                </button>
              </div>

            </form>
          </div>

          {/* Vitals History Log list */}
          <div className="glass-panel p-6 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-gray-850 pb-2">
              <Clock className="w-4 h-4 text-gray-400" /> Recent Vitals History
            </h3>
            
            <div className="max-h-[160px] overflow-y-auto space-y-2">
              {profile.bpHistory.map((bp, index) => {
                const sugar = profile.glucoseHistory[index] || { level: 120, type: 'Fasting' };
                return (
                  <div key={index} className="flex justify-between items-center text-xs p-3 rounded-lg bg-gray-950/20 border border-gray-900 hover:bg-white/5 transition-all">
                    <span className="text-gray-400 font-bold">{bp.date}</span>
                    <span className="text-gray-200">
                      BP: <strong className="text-white">{bp.systolic}/{bp.diastolic}</strong> mmHg
                    </span>
                    <span className="text-gray-200">
                      Sugar: <strong className="text-white">{sugar.level}</strong> mg/dL ({sugar.type})
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: AI Foot Ulcer Scanner */}
        <div className="lg:col-span-5 space-y-6">
          
          <div className="glass-panel p-6 flex flex-col items-center space-y-5">
            <div className="w-full flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-teal-400" />
                <h3 className="text-lg font-bold text-white">AI Diabetic Foot Scan</h3>
              </div>
              <span className="text-xs text-teal-400 font-bold uppercase tracking-wide">Amputation Prevention</span>
            </div>

            {/* High Tech Foot Scanner UI */}
            <div className="relative w-64 h-80 border border-gray-800 rounded-3xl bg-gray-950/40 overflow-hidden flex items-center justify-center">
              
              {/* Grid Lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px]"></div>
              
              {/* Stylized Foot Outline */}
              <div className="relative w-36 h-64 border-2 border-dashed border-gray-800/80 rounded-[40%_40%_30%_30%/_55%_55%_45%_45%] flex items-center justify-center">
                
                {/* Toes Contours */}
                <div className="absolute -top-3 left-[20%] w-6 h-6 rounded-full border border-dashed border-gray-800/60 bg-gray-950/20"></div>
                <div className="absolute -top-4 left-[40%] w-5 h-5 rounded-full border border-dashed border-gray-800/60 bg-gray-950/20"></div>
                <div className="absolute -top-3 left-[56%] w-4 h-4 rounded-full border border-dashed border-gray-800/60 bg-gray-950/20"></div>
                <div className="absolute -top-2 left-[68%] w-4 h-4 rounded-full border border-dashed border-gray-800/60 bg-gray-950/20"></div>
                <div className="absolute -top-1 left-[78%] w-3.5 h-3.5 rounded-full border border-dashed border-gray-800/60 bg-gray-950/20"></div>

                {/* Scan Sweep Laser line */}
                {scanning && (
                  <div className="absolute w-[180%] h-0.5 bg-teal-500/80 shadow-[0_0_15px_#14b8a6] left-[-40%] animate-bounce" style={{ animationDuration: '2s' }}></div>
                )}

                {/* Simulated Neuropathic Hotspots Overlay */}
                {scanRecord && !scanning && scanRecord.hotspots.map((spot, idx) => (
                  <div 
                    key={idx}
                    className="absolute group cursor-pointer"
                    style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  >
                    {/* Pulsing Hotspot Marker */}
                    <span className="flex h-5.5 w-5.5 relative">
                      <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        spot.severity === 'high' ? 'bg-red-500' : 'bg-orange-500'
                      }`}></span>
                      <span className={`relative inline-flex rounded-full h-4 w-4 border border-white/20 shadow-md ${
                        spot.severity === 'high' ? 'bg-red-500' : 'bg-orange-500'
                      }`}></span>
                    </span>

                    {/* Tooltip on hover */}
                    <div className="absolute z-10 bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 w-48 p-3 rounded-lg bg-gray-950 border border-gray-800 shadow-2xl text-[10px] text-gray-300 leading-normal pointer-events-none">
                      <span className={`font-extrabold uppercase tracking-wide block mb-1 ${
                        spot.severity === 'high' ? 'text-red-500' : 'text-orange-500'
                      }`}>
                        {spot.severity} Risk Warning
                      </span>
                      {spot.description}
                    </div>
                  </div>
                ))}

              </div>

              {/* Scanning status banner */}
              {scanning && (
                <div className="absolute bg-teal-950/80 border border-teal-800 text-teal-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 animate-spin" /> Analyzing Image...
                </div>
              )}
            </div>

            {/* Scan Action Controls */}
            <div className="w-full text-center space-y-3">
              {!scanRecord && !scanning ? (
                <p className="text-xs text-gray-500">Upload a photo of the patient's foot sole to trigger the AI sensory audit.</p>
              ) : (
                <div className="space-y-1">
                  <div className="text-xs text-gray-400">
                    Latest Scan Risk Index: <strong className="text-white text-sm">{scanRecord?.riskScore}%</strong>
                  </div>
                  <div className={`text-[10px] font-bold uppercase tracking-wider ${
                    scanRecord?.hasHotspots ? 'text-red-500' : 'text-teal-400'
                  }`}>
                    {scanRecord?.hasHotspots ? "⚠️ High-pressure Hotspots Detected" : "✓ Foot sensory health OK"}
                  </div>
                </div>
              )}

              <label className="w-full py-3 px-4 rounded-xl border border-dashed border-gray-800 bg-gray-950/20 hover:border-teal-500 cursor-pointer flex items-center justify-center gap-2 text-xs font-bold text-white transition-all">
                <Upload className="w-4 h-4 text-teal-400" />
                {scanRecord ? "Upload New Foot Photo" : "Scan Foot Sole"}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleFootPhotoUpload}
                  disabled={scanning}
                  className="hidden" 
                />
              </label>
            </div>
          </div>

          {/* Foot Care Recommendations */}
          {scanRecord && !scanning && (
            <div className="glass-panel p-5 space-y-3 animate-scale-in">
              <h4 className="text-xs font-bold text-teal-400 uppercase tracking-widest flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> AI Recommended Care Actions:
              </h4>
              <ul className="space-y-1.5 text-xs text-gray-300 leading-normal">
                {scanRecord.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-1.5">
                    <span className="text-teal-500">•</span>
                    <span>{rec}</span>
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
import { evaluateNcdRisk as evaluateNcdRiskAlias } from '../services/ncdService';

import React, { useState } from 'react';
import { 
  ShieldAlert, 
  Users, 
  Building2, 
  TrendingUp, 
  DollarSign, 
  CheckCircle, 
  AlertCircle, 
  XCircle, 
  Crown, 
  RefreshCw, 
  Sliders, 
  FileSpreadsheet,
  Search
} from 'lucide-react';
import type { PatientNcdProfile, NcdClinic, NcdPharmacy, NcdRefillOrder } from '../services/ncdService';

interface SuperAdminDashboardProps {
  patients: PatientNcdProfile[];
  clinics: NcdClinic[];
  pharmacies: NcdPharmacy[];
  orders: NcdRefillOrder[];
  onUpdateClinic: (clinic: NcdClinic) => Promise<void>;
  onUpdatePharmacy: (pharmacy: NcdPharmacy) => Promise<void>;
  onUpdatePatientProfile: (patient: PatientNcdProfile) => Promise<void>;
  onDeleteClinic?: (clinicId: string) => Promise<void>;
  onDeletePharmacy?: (pharmacyId: string) => Promise<void>;
  onDeletePatient?: (patientId: string) => Promise<void>;
  onDeleteOrder?: (orderId: string) => Promise<void>;
}

export const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({
  patients,
  clinics,
  pharmacies,
  orders,
  onUpdateClinic,
  onUpdatePharmacy,
  onUpdatePatientProfile,
  onDeleteClinic,
  onDeletePharmacy,
  onDeletePatient,
  onDeleteOrder
}) => {
  const [activeTab, setActiveTab] = useState<'facilities' | 'patients' | 'audits'>('facilities');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [commissionRate, setCommissionRate] = useState<number>(() => {
    const stored = localStorage.getItem('diabp_system_commission_rate');
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed)) return parsed;
    }
    return 0.05; // 5% default
  });

  const handleSaveCommission = (rate: number) => {
    localStorage.setItem('diabp_system_commission_rate', rate.toString());
    setCommissionRate(rate);
  };

  // --- REVENUE ANALYTICS CALCULATIONS ---
  
  // 1. Refills Transaction Volume (Only orders that are Approved, Out for Delivery, or Delivered)
  const successfulOrders = orders.filter(o => 
    o.status === 'Approved' || o.status === 'Out for Delivery' || o.status === 'Delivered'
  );
  const totalRefillVolume = successfulOrders.reduce((sum, o) => sum + o.totalNaira, 0);

  // 2. Admin Split Commission
  const adminCommissions = totalRefillVolume * commissionRate;

  // 3. B2B SaaS Subscriptions Revenue (Clinic: N25,000/mo, Pharmacy: N15,000/mo)
  const premiumClinicsCount = clinics.filter(c => c.isPremium).length;
  const premiumPharmaciesCount = pharmacies.filter(p => p.isPremium).length;
  
  const clinicSubRevenue = premiumClinicsCount * 25000;
  const pharmacySubRevenue = premiumPharmaciesCount * 15000;
  const totalSaaSRevenue = clinicSubRevenue + pharmacySubRevenue;

  // 4. Patient Premium Subscriptions Revenue (N1,500/mo)
  const premiumPatientsCount = patients.filter(p => p.isPremium).length;
  const patientSubRevenue = premiumPatientsCount * 1500;

  // 5. Total Admin Platform Revenue
  const totalAdminRevenue = adminCommissions + totalSaaSRevenue + patientSubRevenue;

  // 6. Active vs Inactive Patients Registry Metrics
  const totalPatients = patients.length;
  const activePatientsCount = patients.filter(p => 
    (p.bpHistory && p.bpHistory.length > 0) || 
    (p.glucoseHistory && p.glucoseHistory.length > 0) || 
    (p.streakDays && p.streakDays > 0)
  ).length;
  const inactivePatientsCount = totalPatients - activePatientsCount;

  // --- OVERRIDE TOGGLE HANDLERS ---

  const getPlanOption = (isPremium?: boolean, premiumExpiry?: string): string => {
    if (!isPremium) return 'basic';
    if (premiumExpiry === 'Lifetime') return 'lifetime';
    if (!premiumExpiry) return 'premium_1y'; // fallback
    
    // parse expiry to calculate remaining time
    const expiryDate = new Date(premiumExpiry);
    const diffTime = expiryDate.getTime() - Date.now();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays > 0 && diffDays <= 7) return 'trial_7';
    if (diffDays > 7 && diffDays <= 30) return 'trial_30';
    if (diffDays > 30 && diffDays <= 365) return 'premium_1y';
    return 'lifetime';
  };

  const handlePlanChange = async (
    type: 'clinic' | 'pharmacy' | 'patient',
    item: any,
    planKey: string
  ) => {
    setUpdatingId(item.id);
    try {
      let isPremium = false;
      let premiumExpiry: string | undefined = undefined;

      if (planKey === 'trial_7') {
        isPremium = true;
        premiumExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString();
      } else if (planKey === 'trial_30') {
        isPremium = true;
        premiumExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString();
      } else if (planKey === 'premium_1y') {
        isPremium = true;
        premiumExpiry = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toLocaleDateString();
      } else if (planKey === 'lifetime') {
        isPremium = true;
        premiumExpiry = 'Lifetime';
      }

      if (type === 'clinic') {
        await onUpdateClinic({
          ...item,
          isPremium,
          premiumExpiry
        });
      } else if (type === 'pharmacy') {
        await onUpdatePharmacy({
          ...item,
          isPremium,
          premiumExpiry
        });
      } else if (type === 'patient') {
        await onUpdatePatientProfile({
          ...item,
          isPremium,
          premiumExpiry
        });
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const getPlanBadge = (isPremium?: boolean, premiumExpiry?: string) => {
    if (!isPremium) {
      return (
        <span style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem' }}>
          Basic Plan
        </span>
      );
    }
    if (premiumExpiry === 'Lifetime') {
      return (
        <span style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
          ♾️ Lifetime
        </span>
      );
    }
    const planKey = getPlanOption(isPremium, premiumExpiry);
    if (planKey === 'trial_7' || planKey === 'trial_30') {
      return (
        <span style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
          ⏳ Trial ({premiumExpiry})
        </span>
      );
    }
    return (
      <span style={{ background: 'rgba(234, 179, 8, 0.1)', color: '#facc15', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 'bold' }}>
        👑 Premium ({premiumExpiry})
      </span>
    );
  };

  const handleUpdateSubaccountId = async (type: 'clinic' | 'pharmacy', facility: any, subId: string) => {
    if (type === 'clinic') {
      await onUpdateClinic({
        ...facility,
        subaccountId: subId.trim() || undefined
      });
    } else {
      await onUpdatePharmacy({
        ...facility,
        subaccountId: subId.trim() || undefined
      });
    }
  };

  // --- FILTERS ---
  const filteredClinics = clinics.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPharmacies = pharmacies.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPatients = patients.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.phone && p.phone.includes(searchTerm))
  );

  return (
    <div className="space-y-6 animate-fade-in" style={{ paddingBottom: '30px' }}>
      
      {/* 1. Header Row */}
      <div className="glass-panel" style={{ padding: '20px', background: 'linear-gradient(135deg, rgba(20, 20, 20, 0.4) 0%, rgba(20, 20, 20, 0.6) 100%)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'white', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ShieldAlert className="text-teal-400 w-6 h-6 animate-pulse" /> 
              DiaBP System Administrator Control Center
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Live B2B Facility Overrides, Core Subaccount Verification, and Global Commission & SaaS Metrics
            </p>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="flex items-center gap-2"
            style={{
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px', padding: '8px 14px', fontSize: '0.75rem', color: 'white', fontWeight: 'bold',
              cursor: 'pointer', transition: 'background 0.2s'
            }}
          >
            <RefreshCw size={12} /> Sync State
          </button>
        </div>
      </div>

      {/* System Settings & Commission Control */}
      <div className="glass-panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <h4 style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sliders className="text-teal-400 w-4 h-4" />
          System Platform Split Configuration
        </h4>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '250px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              <span>Platform Commission Rate</span>
              <span style={{ color: 'var(--color-teal-light)', fontWeight: 'bold' }}>{(commissionRate * 100).toFixed(1)}%</span>
            </div>
            <input 
              type="range"
              min="0.01"
              max="0.20"
              step="0.005"
              value={commissionRate}
              onChange={(e) => handleSaveCommission(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: '#14b8a6', cursor: 'pointer' }}
            />
          </div>
          <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)', flex: 2, minWidth: '200px', lineHeight: '1.4' }}>
            Adjusting this commission percentage dynamically updates the payout calculation across all clinics and pharmacies. Custom split parameters are routed to Flutterwave checkout payloads in real-time.
          </p>
        </div>
      </div>

      {/* 2. Global Revenue Analytics Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        
        {/* Total Admin commissions */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #14b8a6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Total Platform Revenue
            </span>
            <DollarSign className="text-teal-400 w-4 h-4" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>
            ₦{totalAdminRevenue.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            Comm. + SaaS subscriptions + Patients
          </span>
        </div>

        {/* Refills Commission volume */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Refills Split Comm. ({(commissionRate * 100).toFixed(0)}%)
            </span>
            <TrendingUp className="text-blue-400 w-4 h-4" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#60a5fa' }}>
            ₦{adminCommissions.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            From ₦{totalRefillVolume.toLocaleString()} total refills volume
          </span>
        </div>

        {/* SaaS Subscriptions volume */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #eab308' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              B2B SaaS Revenue
            </span>
            <Crown className="text-yellow-400 w-4 h-4" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#facc15' }}>
            ₦{totalSaaSRevenue.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            {premiumClinicsCount} Clinics | {premiumPharmaciesCount} Pharmacies active
          </span>
        </div>

        {/* Patient Subscriptions */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Patient Premium Revenue
            </span>
            <Users className="text-emerald-400 w-4 h-4" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#34d399' }}>
            ₦{patientSubRevenue.toLocaleString()}
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            From {premiumPatientsCount} premium-tier active users
          </span>
        </div>

        {/* App Patients Registry */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '3px solid #a855f7' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>
              Patients Registry
            </span>
            <Users className="text-purple-400 w-4 h-4" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#c084fc' }}>
            {totalPatients} Total Patients
          </div>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
            🟢 {activePatientsCount} Active | 🔴 {inactivePatientsCount} Inactive
          </span>
        </div>

      </div>

      {/* 3. Section Control Tabs & Search */}
      <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveTab('facilities')}
            className={`tab-btn ${activeTab === 'facilities' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '8px 16px' }}
          >
            <Building2 size={12} /> B2B Facilities ({clinics.length + pharmacies.length})
          </button>
          <button
            onClick={() => setActiveTab('patients')}
            className={`tab-btn ${activeTab === 'patients' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '8px 16px' }}
          >
            <Users size={12} /> Patient Overrides ({patients.length})
          </button>
          <button
            onClick={() => setActiveTab('audits')}
            className={`tab-btn ${activeTab === 'audits' ? 'active' : ''}`}
            style={{ fontSize: '0.75rem', padding: '8px 16px' }}
          >
            <FileSpreadsheet size={12} /> System split Audits ({orders.length})
          </button>
        </div>

        <div style={{ position: 'relative', width: '220px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '8px 12px 8px 30px', background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', color: 'white',
              fontSize: '0.75rem', outline: 'none'
            }}
          />
        </div>
      </div>

      {/* 4. Tab Contents */}
      {activeTab === 'facilities' && (
        <div className="space-y-6">
          
          {/* Clinic Overrides Table */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🏥 Clinic Subscriptions & Overrides
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px' }}>Clinic Name</th>
                    <th style={{ padding: '12px' }}>City</th>
                    <th style={{ padding: '12px' }}>Flutterwave Subaccount ID</th>
                    <th style={{ padding: '12px' }}>Plan Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClinics.map(clinic => {
                    const cleanSubaccount = clinic.subaccountId?.split('|||')[0] || '';
                    return (
                      <tr key={clinic.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'white' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{clinic.name}</td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{clinic.city}</td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            type="text"
                            defaultValue={cleanSubaccount}
                            placeholder="Link manually..."
                            onBlur={(e) => handleUpdateSubaccountId('clinic', clinic, e.target.value)}
                            style={{
                              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '6px', padding: '4px 8px', color: '#60a5fa', fontSize: '0.7rem', width: '150px', outline: 'none'
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          {getPlanBadge(clinic.isPremium, clinic.premiumExpiry)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <select
                              disabled={updatingId === clinic.id}
                              value={getPlanOption(clinic.isPremium, clinic.premiumExpiry)}
                              onChange={(e) => handlePlanChange('clinic', clinic, e.target.value)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'white',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                outline: 'none',
                                cursor: 'pointer',
                                minWidth: '130px'
                              }}
                            >
                              <option value="basic" style={{ background: '#111827', color: 'var(--text-muted)' }}>Basic Plan</option>
                              <option value="trial_7" style={{ background: '#111827', color: '#60a5fa' }}>Free Trial (7d)</option>
                              <option value="trial_30" style={{ background: '#111827', color: '#3b82f6' }}>Free Trial (30d)</option>
                              <option value="premium_1y" style={{ background: '#111827', color: '#facc15' }}>Standard (1y)</option>
                              <option value="lifetime" style={{ background: '#111827', color: '#34d399' }}>Lifetime Premium</option>
                            </select>
                            {onDeleteClinic && (
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete clinic "${clinic.name}"? This action cannot be undone.`)) {
                                    onDeleteClinic(clinic.id);
                                  }
                                }}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pharmacy Overrides Table */}
          <div className="glass-panel" style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🏪 Pharmacy Subscriptions & Overrides
            </h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '12px' }}>Pharmacy Name</th>
                    <th style={{ padding: '12px' }}>City</th>
                    <th style={{ padding: '12px' }}>Flutterwave Subaccount ID</th>
                    <th style={{ padding: '12px' }}>Plan Status</th>
                    <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPharmacies.map(pharmacy => {
                    const cleanSubaccount = pharmacy.subaccountId?.split('|||')[0] || '';
                    return (
                      <tr key={pharmacy.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'white' }}>
                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{pharmacy.name}</td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{pharmacy.city}</td>
                        <td style={{ padding: '12px' }}>
                          <input 
                            type="text"
                            defaultValue={cleanSubaccount}
                            placeholder="Link manually..."
                            onBlur={(e) => handleUpdateSubaccountId('pharmacy', pharmacy, e.target.value)}
                            style={{
                              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                              borderRadius: '6px', padding: '4px 8px', color: '#60a5fa', fontSize: '0.7rem', width: '150px', outline: 'none'
                            }}
                          />
                        </td>
                        <td style={{ padding: '12px' }}>
                          {getPlanBadge(pharmacy.isPremium, pharmacy.premiumExpiry)}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                            <select
                              disabled={updatingId === pharmacy.id}
                              value={getPlanOption(pharmacy.isPremium, pharmacy.premiumExpiry)}
                              onChange={(e) => handlePlanChange('pharmacy', pharmacy, e.target.value)}
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                color: 'white',
                                borderRadius: '8px',
                                padding: '6px 12px',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                outline: 'none',
                                cursor: 'pointer',
                                minWidth: '130px'
                              }}
                            >
                              <option value="basic" style={{ background: '#111827', color: 'var(--text-muted)' }}>Basic Plan</option>
                              <option value="trial_7" style={{ background: '#111827', color: '#60a5fa' }}>Free Trial (7d)</option>
                              <option value="trial_30" style={{ background: '#111827', color: '#3b82f6' }}>Free Trial (30d)</option>
                              <option value="premium_1y" style={{ background: '#111827', color: '#facc15' }}>Standard (1y)</option>
                              <option value="lifetime" style={{ background: '#111827', color: '#34d399' }}>Lifetime Premium</option>
                            </select>
                            {onDeletePharmacy && (
                              <button
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete pharmacy "${pharmacy.name}"? This action cannot be undone.`)) {
                                    onDeletePharmacy(pharmacy.id);
                                  }
                                }}
                                style={{
                                  background: 'rgba(239, 68, 68, 0.15)',
                                  border: '1px solid rgba(239, 68, 68, 0.3)',
                                  color: '#f87171',
                                  borderRadius: '8px',
                                  padding: '6px 12px',
                                  fontSize: '0.75rem',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  transition: 'all 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {activeTab === 'patients' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            👑 Patient Account Overrides
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Patient Name</th>
                  <th style={{ padding: '12px' }}>Conditions</th>
                  <th style={{ padding: '12px' }}>Phone</th>
                  <th style={{ padding: '12px' }}>Gold Status</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPatients.map(patient => (
                  <tr key={patient.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'white' }}>
                    <td style={{ padding: '12px', fontWeight: 'bold' }}>{patient.name}</td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      {(patient.conditions || []).join(', ')}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{patient.phone || 'N/A'}</td>
                    <td style={{ padding: '12px' }}>
                      {getPlanBadge(patient.isPremium, patient.premiumExpiry)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        <select
                          disabled={updatingId === patient.id}
                          value={getPlanOption(patient.isPremium, patient.premiumExpiry)}
                          onChange={(e) => handlePlanChange('patient', patient, e.target.value)}
                          style={{
                            background: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            color: 'white',
                            borderRadius: '8px',
                            padding: '6px 12px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold',
                            outline: 'none',
                            cursor: 'pointer',
                            minWidth: '130px'
                          }}
                        >
                          <option value="basic" style={{ background: '#111827', color: 'var(--text-muted)' }}>Basic Plan</option>
                          <option value="trial_7" style={{ background: '#111827', color: '#60a5fa' }}>Free Trial (7d)</option>
                          <option value="trial_30" style={{ background: '#111827', color: '#3b82f6' }}>Free Trial (30d)</option>
                          <option value="premium_1y" style={{ background: '#111827', color: '#facc15' }}>Standard (1y)</option>
                          <option value="lifetime" style={{ background: '#111827', color: '#34d399' }}>Lifetime Premium</option>
                        </select>
                        {onDeletePatient && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete patient "${patient.name}"? This action cannot be undone.`)) {
                                onDeletePatient(patient.id);
                              }
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'audits' && (
        <div className="glass-panel" style={{ padding: '20px' }}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 Master System Refills Split Audit Log
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px' }}>Order ID</th>
                  <th style={{ padding: '12px' }}>Patient</th>
                  <th style={{ padding: '12px' }}>Medications</th>
                  <th style={{ padding: '12px' }}>Total Amount</th>
                  <th style={{ padding: '12px' }}>Subaccount Payout ({((1 - commissionRate) * 100).toFixed(0)}%)</th>
                  <th style={{ padding: '12px' }}>Platform Fee ({(commissionRate * 100).toFixed(0)}%)</th>
                  <th style={{ padding: '12px' }}>Status</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => {
                  const resolvedPatient = patients.find(p => p.id === order.patientId);
                  const isSuccess = order.status === 'Approved' || order.status === 'Out for Delivery' || order.status === 'Delivered';
                  
                  return (
                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', color: 'white' }}>
                      <td style={{ padding: '12px' }}><code style={{ color: '#60a5fa' }}>{order.id.slice(0, 8)}</code></td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>{order.patientName || resolvedPatient?.name || 'Unknown Patient'}</td>
                      <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{order.items.join(', ')}</td>
                      <td style={{ padding: '12px', fontWeight: 'bold' }}>₦{order.totalNaira.toLocaleString()}</td>
                      <td style={{ padding: '12px', color: isSuccess ? '#34d399' : 'var(--text-muted)' }}>
                        ₦{(order.totalNaira * (1 - commissionRate)).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px', color: isSuccess ? '#60a5fa' : 'var(--text-muted)' }}>
                        ₦{(order.totalNaira * commissionRate).toLocaleString()}
                      </td>
                      <td style={{ padding: '12px' }}>
                        <span style={{
                          background: order.status === 'Delivered' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                          color: order.status === 'Delivered' ? '#10b981' : '#f59e0b',
                          border: order.status === 'Delivered' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(245, 158, 11, 0.2)',
                          padding: '2px 8px', borderRadius: '4px', fontSize: '0.65rem'
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px', textAlign: 'right' }}>
                        {onDeleteOrder && (
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to delete refill order "${order.id}"? This action cannot be undone.`)) {
                                onDeleteOrder(order.id);
                              }
                            }}
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              borderRadius: '8px',
                              padding: '6px 12px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

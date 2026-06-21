import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  User, 
  Activity, 
  ShoppingBag,
  Compass,
  LogOut
} from 'lucide-react';
import { 
  getPatientProfile,
  getRefillOrders,
  placeRefillOrder as servicePlaceOrder,
  updateOrderStatus as serviceUpdateStatus,
  savePatientProfile,
  getClinics,
  getPharmacies,
  getPatientsForClinic,
  getPatientsForPharmacy,
  updatePharmacyPrices
} from './services/ncdService';
import type { PatientNcdProfile, NcdRefillOrder, NcdClinic, NcdPharmacy } from './services/ncdService';
import { PatientNcdDashboard } from './components/PatientNcdDashboard';
import { NcdSafeMeds } from './components/NcdSafeMeds';
import { ClinicianNcdDashboard } from './components/ClinicianNcdDashboard';
import { Auth } from './components/Auth';
import { supabase, isSupabaseConfigured } from './services/supabase';

function App() {
  // Authentication State
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<'patient' | 'doctor' | 'pharmacist' | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [userFacilityId, setUserFacilityId] = useState<string | null>(null);

  // Centralized Application State
  const [patientProfile, setPatientProfile] = useState<PatientNcdProfile | null>(null);
  const [patients, setPatients] = useState<PatientNcdProfile[]>([]);
  const [orders, setOrders] = useState<NcdRefillOrder[]>([]);
  const [clinics, setClinics] = useState<NcdClinic[]>([]);
  const [pharmacies, setPharmacies] = useState<NcdPharmacy[]>([]);
  
  // Navigation State
  const [patientTab, setPatientTab] = useState<'dashboard' | 'refills'>('dashboard');
  const [loading, setLoading] = useState(false);

  // 1. Initial Auth Check and Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUserRole(session?.user?.user_metadata?.role || null);
      setAuthChecking(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUserRole(session?.user?.user_metadata?.role || null);
      setAuthChecking(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Fetch authenticated data matching roles when session changes
  useEffect(() => {
    if (!session) {
      setPatientProfile(null);
      setPatients([]);
      setOrders([]);
      setUserFacilityId(null);
      return;
    }

    async function loadData() {
      setLoading(true);
      try {
        const role = session.user.user_metadata.role;
        const clinicsList = await getClinics();
        const pharmaciesList = await getPharmacies();
        setClinics(clinicsList);
        setPharmacies(pharmaciesList);

        if (role === 'patient') {
          const profile = await getPatientProfile();
          const refillOrders = await getRefillOrders();
          setPatientProfile(profile);
          setOrders(refillOrders);
        } else if (role === 'doctor') {
          let clinicId = clinicsList[0]?.id || '11111111-1111-1111-1111-111111111111';
          try {
            const { data: clinician } = await supabase
              .from('ncd_clinicians')
              .select('clinic_id')
              .eq('user_id', session.user.id)
              .single();
            if (clinician?.clinic_id) clinicId = clinician.clinic_id;
          } catch {}
          setUserFacilityId(clinicId);
          const clinicPatients = await getPatientsForClinic(clinicId);
          const refillOrders = await getRefillOrders();
          setPatients(clinicPatients);
          setOrders(refillOrders);
        } else if (role === 'pharmacist') {
          let pharmacyId = pharmaciesList[0]?.id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
          try {
            const { data: pharmacist } = await supabase
              .from('ncd_pharmacists')
              .select('pharmacy_id')
              .eq('user_id', session.user.id)
              .single();
            if (pharmacist?.pharmacy_id) pharmacyId = pharmacist.pharmacy_id;
          } catch {}
          setUserFacilityId(pharmacyId);
          const pharmacyPatients = await getPatientsForPharmacy(pharmacyId);
          const refillOrders = await getRefillOrders();
          setPatients(pharmacyPatients);
          setOrders(refillOrders);
        }
      } catch (err) {
        console.error("Failed to load authenticated context data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [session]);

  const handleUpdateProfile = async (updated: PatientNcdProfile) => {
    setPatientProfile(updated);
    try {
      await savePatientProfile(updated);
    } catch (err) {
      console.error("Failed to save patient profile:", err);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: NcdRefillOrder['status']) => {
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId ? { ...order, status } : order
      )
    );
    try {
      await serviceUpdateStatus(orderId, status);
    } catch (err) {
      console.error("Failed to update order status:", err);
    }
  };

  const handlePlaceOrder = async (newOrder: NcdRefillOrder) => {
    setOrders(prev => [newOrder, ...prev]);
    try {
      await servicePlaceOrder(newOrder);
    } catch (err) {
      console.error("Failed to place refill order:", err);
    }
  };

  const handleUpdatePharmacyPrices = async (pharmacyId: string, prices: { [medId: string]: number }) => {
    try {
      await updatePharmacyPrices(pharmacyId, prices);
      const pharmaciesList = await getPharmacies();
      setPharmacies(pharmaciesList);
    } catch (err) {
      console.error("Failed to update pharmacy prices:", err);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUserFacilityId(null);
    window.location.reload();
  };

  // Auth Checking Loading Spinner
  if (authChecking) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center', background: '#0d1117' }}>
        <Compass className="spinner-icon w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  // Redirect to self-onboarding portal if not logged in
  if (!session) {
    return <Auth />;
  }

  // Role context loading indicator
  if (loading || (userRole === 'patient' && !patientProfile)) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center', background: '#0d1117' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', textAlign: 'center' }}>
          <Compass className="spinner-icon w-8 h-8 text-blue-500 animate-spin" />
          <p style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
            Synchronizing with DiaBP Safe-Meds Database...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-wrapper">
      
      {/* Background blobs for premium glassmorphic layout */}
      <div className="bg-blob bg-blob-1"></div>
      <div className="bg-blob bg-blob-2"></div>
      <div className="bg-blob bg-blob-3"></div>

      {/* Main Top Header */}
      <header className="app-header">
        <div className="header-container">
          
          {/* Logo Title */}
          <div className="logo-section">
            <div className="logo-icon-box">
              <Activity className="w-5 h-5" />
            </div>
            <div className="logo-title-group">
              <h1 style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                DiaBP-Copilot
                <span className="logo-badge">Nigeria Production</span>
                {isSupabaseConfigured ? (
                  <span className="logo-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.3)' }}>✓ Supabase Sync</span>
                ) : (
                  <span className="logo-badge" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}>⚠ Local Sandbox</span>
                )}
              </h1>
              <p className="logo-subtitle">AI Diabetes & Hypertension Care Hub</p>
            </div>
          </div>

          {/* User Sign-In Meta & Logout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '11px', color: 'white', fontWeight: 'bold' }}>
                {session.user.email}
              </span>
              <span style={{ fontSize: '9px', color: 'var(--color-teal-light)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                Role: {userRole}
              </span>
            </div>
            
            <button
              onClick={handleLogout}
              className="role-btn"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)', cursor: 'pointer', borderRadius: '8px', fontSize: '11px', fontWeight: 'bold' }}
            >
              <LogOut className="w-3.5 h-3.5" /> Logout
            </button>
          </div>

        </div>
      </header>

      {/* Main Page Content */}
      <main className="main-content">
        
        {userRole === 'patient' ? (
          // ================= PATIENT VIEW =================
          <div className="space-y-6">
            
            {/* Patient Sub Navigation Tabs */}
            <div className="patient-tab-nav">
              <button
                onClick={() => setPatientTab('dashboard')}
                className={`tab-btn ${patientTab === 'dashboard' ? 'active' : ''}`}
              >
                <Activity className="w-4 h-4" /> Care Dashboard
              </button>
              <button
                onClick={() => setPatientTab('refills')}
                className={`tab-btn ${patientTab === 'refills' ? 'active' : ''}`}
              >
                <ShoppingBag className="w-4 h-4" /> SafeMeds Refills
              </button>
            </div>

            {/* Tab Views */}
            {patientTab === 'dashboard' && patientProfile && (
              <PatientNcdDashboard 
                profile={patientProfile} 
                onUpdateProfile={handleUpdateProfile} 
                clinics={clinics}
                pharmacies={pharmacies}
              />
            )}
            
            {patientTab === 'refills' && patientProfile && (
              <NcdSafeMeds 
                orders={orders} 
                onPlaceOrder={handlePlaceOrder} 
                profile={patientProfile}
                pharmacies={pharmacies}
              />
            )}

          </div>
        ) : (
          // ================= CLINICIAN / PHARMACIST VIEW =================
          <div className="space-y-6">
            <div className="card-header-divider">
              <h2 className="card-title">
                <Users className="card-title-icon text-teal-400" />
                {userRole === 'doctor' ? 'Clinical Doctor Workspace' : 'Community Pharmacist Workspace'}
              </h2>
            </div>

            <ClinicianNcdDashboard 
              orders={orders} 
              onUpdateOrderStatus={handleUpdateOrderStatus} 
              patients={patients} 
              clinics={clinics}
              pharmacies={pharmacies}
              userRole={userRole}
              facilityId={userFacilityId}
              onUpdatePharmacyPrices={handleUpdatePharmacyPrices}
            />
          </div>
        )}

      </main>

      {/* Global Nigeria Footer */}
      <footer className="app-footer">
        <div className="footer-container">
          <div className="footer-meta">
            <ShieldCheck className="w-4 h-4" />
            <span>DiaBP-Copilot Integrated Patient Care System</span>
          </div>
          <div>
            Made for Nigeria, scalable globally • © {new Date().getFullYear()} DiaBP-Copilot
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;

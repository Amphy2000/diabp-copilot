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
  updatePharmacyPrices,
  saveClinic,
  savePharmacy,
  getAllPatients,
  deleteClinic,
  deletePharmacy,
  deletePatientProfile,
  deleteRefillOrder
} from './services/ncdService';
import type { PatientNcdProfile, NcdRefillOrder, NcdClinic, NcdPharmacy } from './services/ncdService';
import { PatientNcdDashboard } from './components/PatientNcdDashboard';
import { NcdSafeMeds } from './components/NcdSafeMeds';
import { ClinicianNcdDashboard } from './components/ClinicianNcdDashboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { Auth } from './components/Auth';
import { supabase, isSupabaseConfigured } from './services/supabase';
import { WhatsAppSimulator } from './components/WhatsAppSimulator';
import { InstallPrompt } from './components/InstallPrompt';

function App() {
  // Authentication State
  const [session, setSession] = useState<any>(null);
  const [userRole, setUserRole] = useState<'patient' | 'doctor' | 'pharmacist' | 'admin' | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [userFacilityId, setUserFacilityId] = useState<string | null>(null);
  const [facilityUserRole, setFacilityUserRole] = useState<'admin' | 'staff'>('staff');

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
    async function initAuth() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUserRole(session?.user?.user_metadata?.role || null);
      } catch (err) {
        console.error("Supabase getSession failed:", err);
      } finally {
        setAuthChecking(false);
      }
    }
    initAuth();

    let subscription: any = null;
    try {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUserRole(session?.user?.user_metadata?.role || null);
        setAuthChecking(false);
      });
      subscription = data?.subscription;
    } catch (err) {
      console.error("onAuthStateChange listener failed:", err);
      setAuthChecking(false);
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  // 2. Fetch authenticated data matching roles when session changes
  useEffect(() => {
    if (!session) {
      setPatientProfile(null);
      setPatients([]);
      setOrders([]);
      setUserFacilityId(null);
      setLoading(false);
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
          let profile = null;
          try {
            profile = await getPatientProfile();
          } catch (e) {
            console.error("Failed to load patient profile:", e);
          }

          if (!profile) {
            console.info("Using offline fallback profile context for session...");
            profile = {
              id: session.user.id,
              name: session.user.user_metadata?.display_name || "Active Patient",
              age: 45,
              weight: 70,
              conditions: ["Essential Hypertension"],
              baselineBp: "120/80 mmHg",
              targetGlucoseRange: "70-130 mg/dL",
              bpHistory: [],
              glucoseHistory: [],
              footScanHistory: [],
              streakDays: 1,
              activeMeds: ["Amlodipine 5mg Daily"],
              assignedClinicId: null,
              assignedPharmacyId: null,
              phone: session.user.user_metadata?.phone || undefined
            };
          }
          setPatientProfile(profile);

          let refillOrders = [];
          try {
            refillOrders = await getRefillOrders();
          } catch (e) {
            console.error("Failed to load patient refill orders:", e);
          }
          setOrders(refillOrders);
        } else        if (role === 'doctor') {
          let clinicId = session.user.user_metadata?.clinic_id || clinicsList[0]?.id || '11111111-1111-1111-1111-111111111111';
          let userRoleInFacility: 'admin' | 'staff' = 'staff';
          if (isSupabaseConfigured) {
            try {
              const { data: clinician, error } = await supabase
                .from('ncd_clinicians')
                .select('clinic_id, role, email')
                .eq('user_id', session.user.id)
                .single();
              if (error) throw error;
              if (clinician?.clinic_id) clinicId = clinician.clinic_id;
              if (clinician?.role === 'Admin' || !clinician?.role || session?.user?.email === 'amphyfx@gmail.com') {
                userRoleInFacility = 'admin';
              }
            } catch {
              if (session.user.user_metadata?.clinic_id) {
                clinicId = session.user.user_metadata.clinic_id;
              }
              const metaRole = session.user.user_metadata?.facility_role;
              if (metaRole === 'Admin' || metaRole === 'Owner' || session?.user?.email === 'amphyfx@gmail.com') {
                userRoleInFacility = 'admin';
              }
            }
          } else {
            const associations = JSON.parse(localStorage.getItem('diabp_mock_clinicians') || '[]');
            const assoc = associations.find((a: any) => a.user_id === session.user.id);
            if (assoc?.clinic_id) clinicId = assoc.clinic_id;
            if (assoc?.role === 'Admin' || !assoc?.role || session?.user?.email === 'amphyfx@gmail.com') {
              userRoleInFacility = 'admin';
            }
          }
          setFacilityUserRole(userRoleInFacility);
          setUserFacilityId(clinicId);
          const clinicPatients = await getPatientsForClinic(clinicId);
          const refillOrders = await getRefillOrders();
          setPatients(clinicPatients);
          setOrders(refillOrders);
        } else if (role === 'pharmacist') {
          let pharmacyId = session.user.user_metadata?.pharmacy_id || pharmaciesList[0]?.id || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
          let userRoleInFacility: 'admin' | 'staff' = 'staff';
          if (isSupabaseConfigured) {
            try {
              const { data: pharmacist, error } = await supabase
                .from('ncd_pharmacists')
                .select('pharmacy_id, role, email')
                .eq('user_id', session.user.id)
                .single();
              if (error) throw error;
              if (pharmacist?.pharmacy_id) pharmacyId = pharmacist.pharmacy_id;
              if (pharmacist?.role === 'Owner' || !pharmacist?.role || session?.user?.email === 'amphy2000@gmail.com') {
                userRoleInFacility = 'admin';
              }
            } catch {
              if (session.user.user_metadata?.pharmacy_id) {
                pharmacyId = session.user.user_metadata.pharmacy_id;
              }
              const metaRole = session.user.user_metadata?.facility_role;
              if (metaRole === 'Owner' || metaRole === 'Admin' || session?.user?.email === 'amphy2000@gmail.com') {
                userRoleInFacility = 'admin';
              }
            }
          } else {
            const associations = JSON.parse(localStorage.getItem('diabp_mock_pharmacists') || '[]');
            const assoc = associations.find((a: any) => a.user_id === session.user.id);
            if (assoc?.pharmacy_id) pharmacyId = assoc.pharmacy_id;
            if (assoc?.role === 'Owner' || !assoc?.role || session?.user?.email === 'amphy2000@gmail.com') {
              userRoleInFacility = 'admin';
            }
          }
          setFacilityUserRole(userRoleInFacility);
          setUserFacilityId(pharmacyId);
          const pharmacyPatients = await getPatientsForPharmacy(pharmacyId);
          const refillOrders = await getRefillOrders();
          setPatients(pharmacyPatients);
          setOrders(refillOrders);
        } else if (role === 'admin') {
          const allPatients = await getAllPatients();
          const allOrders = await getRefillOrders();
          setPatients(allPatients);
          setOrders(allOrders);
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

  const handleUpdatePatientProfile = async (updated: PatientNcdProfile) => {
    try {
      await savePatientProfile(updated);
      setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
      if (patientProfile && patientProfile.id === updated.id) {
        setPatientProfile(updated);
      }
    } catch (err) {
      console.error("Failed to update patient profile from admin:", err);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: NcdRefillOrder['status'], finalPrice?: number) => {
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId ? { ...order, status, totalNaira: finalPrice !== undefined ? finalPrice : order.totalNaira } : order
      )
    );
    try {
      await serviceUpdateStatus(orderId, status, finalPrice);
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

  const handleUpdateClinic = async (updatedClinic: NcdClinic) => {
    setClinics(prev => prev.map(c => c.id === updatedClinic.id ? updatedClinic : c));
    try {
      await saveClinic(updatedClinic);
    } catch (err) {
      console.error("Failed to update clinic:", err);
    }
  };

  const handleUpdatePharmacy = async (updatedPharmacy: NcdPharmacy) => {
    setPharmacies(prev => prev.map(p => p.id === updatedPharmacy.id ? updatedPharmacy : p));
    try {
      await savePharmacy(updatedPharmacy);
    } catch (err) {
      console.error("Failed to update pharmacy:", err);
    }
  };

  const handleDeleteClinic = async (clinicId: string) => {
    try {
      await deleteClinic(clinicId);
      setClinics(prev => prev.filter(c => c.id !== clinicId));
    } catch (err) {
      console.error("Failed to delete clinic:", err);
    }
  };

  const handleDeletePharmacy = async (pharmacyId: string) => {
    try {
      await deletePharmacy(pharmacyId);
      setPharmacies(prev => prev.filter(p => p.id !== pharmacyId));
    } catch (err) {
      console.error("Failed to delete pharmacy:", err);
    }
  };

  const handleDeletePatient = async (patientId: string) => {
    try {
      await deletePatientProfile(patientId);
      setPatients(prev => prev.filter(p => p.id !== patientId));
    } catch (err) {
      console.error("Failed to delete patient profile:", err);
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteRefillOrder(orderId);
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch (err) {
      console.error("Failed to delete refill order:", err);
    }
  };

  const handleRefreshData = async () => {
    if (!session) return;
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
        const clinicId = userFacilityId || clinicsList[0]?.id;
        if (clinicId) {
          const clinicPatients = await getPatientsForClinic(clinicId);
          const refillOrders = await getRefillOrders();
          setPatients(clinicPatients);
          setOrders(refillOrders);
        }
      } else if (role === 'pharmacist') {
        const pharmacyId = userFacilityId || pharmaciesList[0]?.id;
        if (pharmacyId) {
          const pharmacyPatients = await getPatientsForPharmacy(pharmacyId);
          const refillOrders = await getRefillOrders();
          setPatients(pharmacyPatients);
          setOrders(refillOrders);
        }
      } else if (role === 'admin') {
        const allPatients = await getAllPatients();
        const allOrders = await getRefillOrders();
        setPatients(allPatients);
        setOrders(allOrders);
      }
    } catch (e) {
      console.error("Failed to refresh state data:", e);
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

      <InstallPrompt />

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
                orders={orders}
                onNavigateToRefill={() => setPatientTab('refills')}
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
        ) : userRole === 'admin' ? (
          // ================= SUPER ADMIN VIEW =================
          <div className="space-y-6">
            <SuperAdminDashboard 
              patients={patients}
              clinics={clinics}
              pharmacies={pharmacies}
              orders={orders}
              onUpdateClinic={handleUpdateClinic}
              onUpdatePharmacy={handleUpdatePharmacy}
              onUpdatePatientProfile={handleUpdatePatientProfile}
              onDeleteClinic={handleDeleteClinic}
              onDeletePharmacy={handleDeletePharmacy}
              onDeletePatient={handleDeletePatient}
              onDeleteOrder={handleDeleteOrder}
            />
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
              onUpdateClinic={handleUpdateClinic}
              onUpdatePharmacy={handleUpdatePharmacy}
              facilityUserRole={facilityUserRole}
              onRefreshData={handleRefreshData}
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

      {session && userRole !== 'patient' && (
        <WhatsAppSimulator 
          patients={patients}
          orders={orders}
          activePatientId={undefined}
          onRefreshData={handleRefreshData}
          userRole={userRole}
          userFacilityId={userFacilityId}
        />
      )}

    </div>
  );
}

export default App;

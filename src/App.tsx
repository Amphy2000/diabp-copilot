import { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Users, 
  User, 
  Activity, 
  ShoppingBag,
  Compass
} from 'lucide-react';
import { 
  getPatientProfile,
  getRefillOrders,
  placeRefillOrder as servicePlaceOrder,
  updateOrderStatus as serviceUpdateStatus,
  logVitalsEntry as serviceLogVitals,
  savePatientProfile,
  getClinics,
  getPharmacies
} from './services/ncdService';
import type { PatientNcdProfile, NcdRefillOrder, NcdClinic, NcdPharmacy } from './services/ncdService';
import { PatientNcdDashboard } from './components/PatientNcdDashboard';
import { NcdSafeMeds } from './components/NcdSafeMeds';
import { ClinicianNcdDashboard } from './components/ClinicianNcdDashboard';

function App() {
  // Application Loading state
  const [loading, setLoading] = useState(true);
  
  // Centralized Application State
  const [patientProfile, setPatientProfile] = useState<PatientNcdProfile | null>(null);
  const [orders, setOrders] = useState<NcdRefillOrder[]>([]);
  const [clinics, setClinics] = useState<NcdClinic[]>([]);
  const [pharmacies, setPharmacies] = useState<NcdPharmacy[]>([]);
  
  // Navigation State
  const [currentRole, setCurrentRole] = useState<'patient' | 'pharmacist'>('patient');
  const [patientTab, setPatientTab] = useState<'dashboard' | 'refills'>('dashboard');

  // Load patient data asynchronously on mount
  useEffect(() => {
    async function loadData() {
      try {
        const profile = await getPatientProfile();
        const refillOrders = await getRefillOrders();
        const clinicsList = await getClinics();
        const pharmaciesList = await getPharmacies();
        
        setPatientProfile(profile);
        setOrders(refillOrders);
        setClinics(clinicsList);
        setPharmacies(pharmaciesList);
      } catch (err) {
        console.error("Failed to load initial NCD data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Update profile wrapper that persists updates
  const handleUpdateProfile = async (updated: PatientNcdProfile) => {
    // Optimistic local update
    setPatientProfile(updated);
    
    // Check if the update is just a state change or needs direct vitals call
    // (If the array length is different, the logger component has already triggered the logVitalsEntry call).
    // Here we save the general profile metrics (streak, age, meds, etc.)
    try {
      await savePatientProfile(updated);
    } catch (err) {
      console.error("Failed to save patient profile:", err);
    }
  };

  // Wrapper for vitals logger that handles persistence and re-query
  const handleLogVitalsAndRefresh = async (systolic: number, diastolic: number, glucose: number, glucoseType: 'Fasting' | 'Post-Meal') => {
    setLoading(true);
    try {
      await serviceLogVitals(systolic, diastolic, glucose, glucoseType);
      const updatedProfile = await getPatientProfile();
      setPatientProfile(updatedProfile);
    } catch (err) {
      console.error("Failed to log vitals:", err);
    } finally {
      setLoading(false);
    }
  };

  // Order status updater (passed to ClinicianNcdDashboard to update database state)
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

  if (loading || !patientProfile) {
    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', items: 'center', gap: '8px', textAlign: 'center' }}>
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
              <h1>
                DiaBP-Copilot
                <span className="logo-badge">Nigeria MVP</span>
              </h1>
              <p className="logo-subtitle">AI Diabetes & Hypertension Care Hub</p>
            </div>
          </div>

          {/* Interactive Role Switcher for MVP Testing */}
          <div className="role-switcher">
            <button
              onClick={() => setCurrentRole('patient')}
              className={`role-btn ${currentRole === 'patient' ? 'active' : ''}`}
            >
              <User className="w-3.5 h-3.5" /> Patient Portal
            </button>
            <button
              onClick={() => setCurrentRole('pharmacist')}
              className={`role-btn ${currentRole === 'pharmacist' ? 'active' : ''}`}
            >
              <Users className="w-3.5 h-3.5" /> Clinician Portal
            </button>
          </div>

        </div>
      </header>

      {/* Main Page Content */}
      <main className="main-content">
        
        {currentRole === 'patient' ? (
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
            {patientTab === 'dashboard' && (
              <PatientNcdDashboard 
                profile={patientProfile} 
                onUpdateProfile={handleUpdateProfile} 
                clinics={clinics}
                pharmacies={pharmacies}
              />
            )}
            
            {patientTab === 'refills' && (
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
                Clinical Pharmacist & MD Workspace
              </h2>
            </div>

            <ClinicianNcdDashboard 
              orders={orders} 
              onUpdateOrderStatus={handleUpdateOrderStatus} 
              patientProfile={patientProfile} 
              clinics={clinics}
              pharmacies={pharmacies}
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

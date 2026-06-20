import { useState } from 'react';
import { 
  Heart, 
  ShieldCheck, 
  Users, 
  User, 
  Activity, 
  ShoppingBag
} from 'lucide-react';
import { 
  INITIAL_NCD_PATIENT, 
  INITIAL_NCD_ORDERS, 
} from './services/ncdService';
import type { PatientNcdProfile, NcdRefillOrder } from './services/ncdService';
import { PatientNcdDashboard } from './components/PatientNcdDashboard';
import { NcdSafeMeds } from './components/NcdSafeMeds';
import { ClinicianNcdDashboard } from './components/ClinicianNcdDashboard';

function App() {
  // Centralized Application State
  const [patientProfile, setPatientProfile] = useState<PatientNcdProfile>(INITIAL_NCD_PATIENT);
  const [orders, setOrders] = useState<NcdRefillOrder[]>(INITIAL_NCD_ORDERS);
  
  // Navigation State
  const [currentRole, setCurrentRole] = useState<'patient' | 'pharmacist'>('patient');
  const [patientTab, setPatientTab] = useState<'dashboard' | 'refills'>('dashboard');

  // Order status updater (passed to ClinicianNcdDashboard to update patient state)
  const handleUpdateOrderStatus = (orderId: string, status: NcdRefillOrder['status']) => {
    setOrders(prevOrders => 
      prevOrders.map(order => 
        order.id === orderId ? { ...order, status } : order
      )
    );
  };

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
                onUpdateProfile={setPatientProfile} 
              />
            )}
            
            {patientTab === 'refills' && (
              <NcdSafeMeds 
                orders={orders} 
                onPlaceOrder={(newOrder) => setOrders(prev => [newOrder, ...prev])} 
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

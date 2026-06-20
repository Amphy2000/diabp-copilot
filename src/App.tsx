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
    <div className="min-height-100vh flex flex-col">
      
      {/* Background blobs for premium glassmorphic layout */}
      <div className="bg-blob bg-blob-1"></div>
      <div className="bg-blob bg-blob-2"></div>
      <div className="bg-blob bg-blob-3"></div>

      {/* Main Top Header */}
      <header className="border-b border-gray-800/80 bg-gray-950/40 backdrop-blur-md sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          
          {/* Logo Title */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-500/20">
              <Activity className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-extrabold text-white tracking-tight">DiaBP-Copilot</h1>
                <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-[9px] font-bold text-blue-400 uppercase tracking-widest">
                  Nigeria MVP
                </span>
              </div>
              <p className="text-[11px] text-gray-400 font-medium">AI Diabetes & Hypertension Care Hub</p>
            </div>
          </div>

          {/* Interactive Role Switcher for MVP Testing */}
          <div className="flex items-center gap-2 bg-gray-900 border border-gray-800 p-1.5 rounded-2xl shadow-inner">
            <button
              onClick={() => setCurrentRole('patient')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                currentRole === 'patient'
                  ? 'bg-blue-700 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" /> Patient Portal
            </button>
            <button
              onClick={() => setCurrentRole('pharmacist')}
              className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all ${
                currentRole === 'pharmacist'
                  ? 'bg-blue-700 text-white shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Clinician Portal
            </button>
          </div>

        </div>
      </header>

      {/* Main Page Content */}
      <main className="flex-1 container max-w-7xl mx-auto px-4 sm:px-6 py-8">
        
        {currentRole === 'patient' ? (
          // ================= PATIENT VIEW =================
          <div className="space-y-6">
            
            {/* Patient Sub Navigation Tabs */}
            <div className="flex border-b border-gray-800/80 gap-6">
              <button
                onClick={() => setPatientTab('dashboard')}
                className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                  patientTab === 'dashboard'
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Activity className="w-4 h-4" /> Care Dashboard
              </button>
              <button
                onClick={() => setPatientTab('refills')}
                className={`pb-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                  patientTab === 'refills'
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
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
            <div className="flex items-center gap-2 border-b border-gray-800 pb-3">
              <Users className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-bold text-white">Clinical Pharmacist & MD Workspace</h2>
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
      <footer className="border-t border-gray-900 bg-gray-950/80 py-6 mt-12 text-center text-xs text-gray-500">
        <div className="container max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
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

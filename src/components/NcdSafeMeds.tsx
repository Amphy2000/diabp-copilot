import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Upload, 
  ShoppingBag, 
  Truck, 
  FileText, 
  CheckCircle2, 
  Clock, 
  MapPin 
} from 'lucide-react';
import { NcdRefillOrder, NCD_MEDICATIONS } from '../services/ncdService';

interface NcdSafeMedsProps {
  orders: NcdRefillOrder[];
  onPlaceOrder: (order: NcdRefillOrder) => void;
}

export const NcdSafeMeds: React.FC<NcdSafeMedsProps> = ({ orders, onPlaceOrder }) => {
  const [selectedMeds, setSelectedMeds] = useState<string[]>(['bundle']);
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [orderNotification, setOrderNotification] = useState<string | null>(null);

  // Simulated prescription upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPrescriptionFile(file);
      setIsUploading(true);
      setUploadProgress(10);
      
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsUploading(false);
            return 100;
          }
          return prev + 30;
        });
      }, 200);
    }
  };

  const handleToggleMed = (id: string) => {
    if (selectedMeds.includes(id)) {
      setSelectedMeds(selectedMeds.filter(m => m !== id));
    } else {
      setSelectedMeds([...selectedMeds, id]);
    }
  };

  const calculateTotal = () => {
    return selectedMeds.reduce((sum, medId) => {
      const med = NCD_MEDICATIONS.find(m => m.id === medId);
      return sum + (med ? med.price : 0);
    }, 0);
  };

  const handleCheckout = () => {
    if (selectedMeds.length === 0) return;
    
    const requiresRx = selectedMeds.some(medId => {
      const med = NCD_MEDICATIONS.find(m => m.id === medId);
      return med?.rxRequired;
    });

    if (requiresRx && !prescriptionFile) {
      alert("A valid doctor's prescription must be uploaded for Metformin / Blood Pressure refills.");
      return;
    }

    const itemNames = selectedMeds.map(medId => {
      const med = NCD_MEDICATIONS.find(m => m.id === medId);
      return med ? med.name : '';
    });

    const newOrder: NcdRefillOrder = {
      id: `NCD-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      items: itemNames,
      totalNaira: calculateTotal(),
      status: 'Pending Verification',
      prescriptionRequired: requiresRx,
      prescriptionUploaded: !!prescriptionFile
    };

    onPlaceOrder(newOrder);
    setOrderNotification(`Refill ordered! Refill ID: ${newOrder.id}. We are auditing your compliance logs.`);
    
    // Clear form
    setPrescriptionFile(null);
    setUploadProgress(0);
    setSelectedMeds(['bundle']);

    setTimeout(() => {
      setOrderNotification(null);
    }, 5000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Delivered': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'Out for Delivery': return <Truck className="w-4 h-4 text-blue-400" />;
      case 'Approved': return <ShieldCheck className="w-4 h-4 text-teal-400" />;
      default: return <Clock className="w-4 h-4 text-orange-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered': return 'text-green-400 bg-green-950/20 border-green-800/30';
      case 'Out for Delivery': return 'text-blue-400 bg-blue-950/20 border-blue-800/30';
      case 'Approved': return 'text-teal-400 bg-teal-950/20 border-teal-800/30';
      default: return 'text-orange-400 bg-orange-950/20 border-orange-800/30';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" style={{ paddingBottom: '30px' }}>
      
      {/* Safety Shield Header */}
      <div className="glass-panel p-5 bg-gradient-to-r from-teal-950/30 to-blue-950/30 border border-teal-500/10 flex items-center gap-4">
        <div className="p-3 bg-teal-500/10 rounded-xl border border-teal-500/20 text-teal-400">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-bold text-white text-base">Verified NCD Safe-Meds Network</h3>
          <p className="text-xs text-gray-400 leading-normal">
            Every refill batch of Metformin, Insulin, and Antihypertensives in our network is audited for purity and clinical potency. We combat counterfeit drugs in Nigeria to keep your chronic care plan secure.
          </p>
        </div>
      </div>

      {orderNotification && (
        <div className="p-4 bg-teal-900/20 border border-teal-500/30 text-teal-300 rounded-xl text-sm font-semibold text-center animate-pulse">
          {orderNotification}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Refill Store Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
              <ShoppingBag className="w-5 h-5 text-teal-500" /> Choose Refill Items
            </h3>

            <div className="space-y-3">
              {NCD_MEDICATIONS.map(med => (
                <div 
                  key={med.id}
                  onClick={() => handleToggleMed(med.id)}
                  className={`p-4 rounded-xl border cursor-pointer flex justify-between items-start gap-4 transition-all hover:bg-white/5 ${
                    selectedMeds.includes(med.id)
                      ? 'border-teal-500/30 bg-teal-950/15'
                      : 'border-gray-800 bg-gray-950/20'
                  }`}
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white text-sm">{med.name}</span>
                      {med.rxRequired && (
                        <span className="px-2 py-0.5 text-[9px] font-bold bg-orange-950 text-orange-400 border border-orange-800/30 rounded uppercase tracking-wider">
                          Doctor Prescription Required
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{med.description}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-extrabold text-white text-base">₦{med.price.toLocaleString()}</div>
                    <div className="text-[10px] text-gray-500">per month</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Refill Tracker / Order History */}
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-3">
              <Truck className="w-5 h-5 text-blue-500" /> Refill Dispatch Tracker
            </h3>

            {orders.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No order logs found.</p>
            ) : (
              <div className="space-y-4">
                {orders.map((order, idx) => (
                  <div key={idx} className="p-4 border border-gray-800/60 rounded-2xl bg-gray-950/20 space-y-3">
                    <div className="flex justify-between items-center text-xs">
                      <div>
                        <span className="text-gray-400 font-bold">Refill ID: </span>
                        <span className="text-white font-bold">{order.id}</span>
                      </div>
                      <span className="text-gray-500">{order.date}</span>
                    </div>

                    <div className="text-sm font-semibold text-gray-300">
                      {order.items.join(', ')}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-800/40 pt-3">
                      <div className="text-sm">
                        <span className="text-gray-500">Total: </span>
                        <span className="font-extrabold text-teal-400">₦{order.totalNaira.toLocaleString()}</span>
                      </div>
                      
                      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </div>
                    </div>

                    {/* Progress visualizer */}
                    {order.status !== 'Delivered' && (
                      <div className="space-y-2 border-t border-gray-800/30 pt-3">
                        <div className="flex justify-between text-[10px] text-gray-500 font-semibold uppercase">
                          <span>Verified</span>
                          <span>Dispensed</span>
                          <span>In Transit</span>
                        </div>
                        <div className="progress-bar-container">
                          <div 
                            className="progress-bar-fill" 
                            style={{ 
                              width: order.status === 'Pending Verification' 
                                ? '20%' 
                                : order.status === 'Approved' 
                                ? '60%' 
                                : '90%' 
                            }}
                          ></div>
                        </div>
                        <div className="text-[10px] text-gray-400 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-teal-500" />
                          <span>
                            {order.status === 'Pending Verification' && "Clinician reviewing uploaded prescription and safety logs..."}
                            {order.status === 'Approved' && "Medications audited & packaged by Pharmacist. Preparing dispatch..."}
                            {order.status === 'Out for Delivery' && "Refill with dispatch rider. Navigating to delivery address."}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Checkout Summary & Prescription Upload */}
        <div className="space-y-6">
          <div className="glass-panel p-6 space-y-4">
            <h3 className="text-lg font-bold text-white border-b border-gray-800 pb-3">Refill Request</h3>
            
            <div className="space-y-2 text-sm text-gray-400">
              <div className="flex justify-between">
                <span>Selected Items:</span>
                <span className="text-white font-bold">{selectedMeds.length}</span>
              </div>
              <div className="flex justify-between border-t border-gray-800/60 pt-2 text-base font-extrabold text-white">
                <span>Total Refill Cost:</span>
                <span className="text-teal-400">₦{calculateTotal().toLocaleString()}</span>
              </div>
            </div>

            {/* Prescription Upload Widget */}
            {selectedMeds.some(medId => {
              const med = NCD_MEDICATIONS.find(m => m.id === medId);
              return med?.rxRequired;
            }) && (
              <div className="border border-dashed border-gray-800 rounded-xl p-4 text-center bg-gray-950/20 space-y-3">
                <div className="flex justify-center text-teal-400">
                  <FileText className="w-8 h-8" />
                </div>
                
                {prescriptionFile ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-white font-bold truncate max-w-[200px] mx-auto">{prescriptionFile.name}</p>
                    <p className="text-[10px] text-teal-400">✓ Uploaded & Checked for Purity</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-300 font-medium">Doctor's Prescription Required</p>
                    <p className="text-[10px] text-gray-500">Upload prescription to verify Metformin / Blood Pressure dosing</p>
                    
                    <label className="cursor-pointer py-2 px-3 rounded-lg bg-gray-900 border border-gray-800 text-xs font-bold text-white hover:border-teal-500 transition-colors inline-flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      Browse Files
                      <input 
                        type="file" 
                        accept="image/*,.pdf" 
                        onChange={handleFileChange} 
                        className="hidden" 
                      />
                    </label>
                  </div>
                )}

                {isUploading && (
                  <div className="space-y-1">
                    <div className="text-[9px] text-teal-400">Uploading {uploadProgress}%</div>
                    <div className="w-full bg-gray-800 h-1 rounded-full overflow-hidden">
                      <div className="bg-teal-500 h-full transition-all" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={selectedMeds.length === 0}
              className="w-full py-3.5 rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-teal-950/40"
            >
              <ShieldCheck className="w-4.5 h-4.5" /> Request SafeRefill
            </button>
            
            <p className="text-[10px] text-gray-500 leading-normal text-center">
              We verify all prescriptions against local physician registries in Nigeria to prevent medication abuse or toxic dosing.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};

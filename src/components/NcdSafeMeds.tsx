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
import { NCD_MEDICATIONS } from '../services/ncdService';
import type { NcdRefillOrder, PatientNcdProfile, NcdPharmacy } from '../services/ncdService';

interface NcdSafeMedsProps {
  orders: NcdRefillOrder[];
  onPlaceOrder: (order: NcdRefillOrder) => void;
  profile: PatientNcdProfile;
  pharmacies: NcdPharmacy[];
}

export const NcdSafeMeds: React.FC<NcdSafeMedsProps> = ({ orders, onPlaceOrder, profile, pharmacies }) => {
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
    
    if (!profile.assignedPharmacyId) {
      alert("Please select a Preferred Refill Pharmacy in your Care Dashboard before requesting a refill.");
      return;
    }

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
      prescriptionUploaded: !!prescriptionFile,
      pharmacyId: profile.assignedPharmacyId,
      patientId: profile.id,
      patientName: profile.name
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
      case 'Delivered': return <CheckCircle2 className="w-3.5 h-3.5" />;
      case 'Out for Delivery': return <Truck className="w-3.5 h-3.5" />;
      case 'Approved': return <ShieldCheck className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'Delivered': return 'delivered';
      case 'Out for Delivery': return 'transit';
      case 'Approved': return 'approved';
      default: return 'pending';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in" style={{ paddingBottom: '30px' }}>
      
      {/* Safety Shield Header */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: 'linear-gradient(135deg, rgba(15, 118, 110, 0.05) 0%, rgba(2, 132, 199, 0.05) 100%)' }}>
        <div style={{ padding: '0.6rem', borderRadius: '12px', background: 'rgba(20, 184, 166, 0.1)', color: 'var(--color-teal-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h3 className="card-title" style={{ fontSize: '1rem' }}>Verified NCD Safe-Meds Network</h3>
          <p className="scan-status-info" style={{ marginTop: '2px' }}>
            Every refill batch of Metformin, Insulin, and Antihypertensives in our network is audited for purity and clinical potency. We combat counterfeit drugs in Nigeria to keep your chronic care plan secure.
          </p>
        </div>
      </div>

      {orderNotification && (
        <div className="p-4 bg-teal-950/20 border border-teal-500/20 text-teal-300 rounded-xl text-sm font-semibold text-center animate-pulse">
          {orderNotification}
        </div>
      )}

      <div className="dashboard-grid">
        
        {/* Refill Store Selection */}
        <div className="left-column space-y-6">
          <div className="glass-panel">
            <div className="card-header-divider">
              <h3 className="card-title">
                <ShoppingBag className="card-title-icon text-teal-400" /> Choose Refill Items
              </h3>
            </div>

            <div className="meds-row-layout">
              {NCD_MEDICATIONS.map(med => {
                const isSelected = selectedMeds.includes(med.id);
                return (
                  <div 
                    key={med.id}
                    onClick={() => handleToggleMed(med.id)}
                    className={`meds-card-item ${isSelected ? 'selected' : ''}`}
                  >
                    <div className="meds-info-block">
                      <div className="meds-name-group">
                        <span className="meds-name">{med.name}</span>
                        {med.rxRequired && (
                          <span className="rx-badge">
                            Rx Required
                          </span>
                        )}
                      </div>
                      <p className="meds-description">{med.description}</p>
                    </div>
                    <div className="meds-price-group">
                      <div className="meds-price">₦{med.price.toLocaleString()}</div>
                      <div className="meds-price-period">per month</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Refill Tracker / Order History */}
          <div className="glass-panel">
            <div className="card-header-divider">
              <h3 className="card-title">
                <Truck className="card-title-icon text-blue-400" /> Refill Dispatch Tracker
              </h3>
            </div>

            {orders.length === 0 ? (
              <p className="scan-status-info" style={{ textAlign: 'center', padding: '2rem 0' }}>No order logs found.</p>
            ) : (
              <div className="orders-tracker-grid">
                {orders.map((order, idx) => (
                  <div key={idx} className="order-tracker-card-item">
                    <div className="order-card-meta">
                      <div>
                        Refill ID: <span className="order-id-highlight">{order.id}</span>
                      </div>
                      <span>{order.date}</span>
                    </div>

                    <div className="order-items-summary">
                      {order.items.join(', ')}
                    </div>

                    <div className="order-card-footer">
                      <div className="order-total-price">
                        Total: <strong>₦{order.totalNaira.toLocaleString()}</strong>
                      </div>
                      
                      <div className={`order-status-pill ${getStatusClass(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {order.status}
                      </div>
                    </div>

                    {/* Progress visualizer */}
                    {order.status !== 'Delivered' && (
                      <div className="order-progress-stepper">
                        <div className="stepper-headers">
                          <span>Verified</span>
                          <span>Dispensed</span>
                          <span>In Transit</span>
                        </div>
                        <div className="progress-bar-rail">
                          <div 
                            className="progress-bar-fill-ncd" 
                            style={{ 
                              width: order.status === 'Pending Verification' 
                                ? '20%' 
                                : order.status === 'Approved' 
                                ? '60%' 
                                : '90%' 
                            }}
                          ></div>
                        </div>
                        <div className="progress-status-desc">
                          <MapPin className="w-3.5 h-3.5 text-teal-400" />
                          <span>
                            {order.status === 'Pending Verification' && "Clinician reviewing prescription and sensory profiles..."}
                            {order.status === 'Approved' && "Refill packaged. Dispense verification complete."}
                            {order.status === 'Out for Delivery' && "Refill out with dispatcher. Delivering to your address."}
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
        <div className="right-column space-y-6">
          <div className="glass-panel">
            <div className="card-header-divider">
              <h3 className="card-title">Refill Request</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                <span>Selected Items:</span>
                <span style={{ color: 'white', fontWeight: 'bold' }}>{selectedMeds.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.75rem', fontSize: '1.1rem', fontWeight: '800', color: 'white' }}>
                <span>Total Refill Cost:</span>
                <span style={{ color: 'var(--color-teal-light)' }}>₦{calculateTotal().toLocaleString()}</span>
              </div>
            </div>

            {/* Prescription Upload Widget */}
            {selectedMeds.some(medId => {
              const med = NCD_MEDICATIONS.find(m => m.id === medId);
              return med?.rxRequired;
            }) && (
              <div className="prescription-dropzone">
                <FileText className="prescription-icon-box w-8 h-8" />
                
                {prescriptionFile ? (
                  <div style={{ width: '100%' }}>
                    <p className="prescription-meta-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', margin: '0 auto' }}>{prescriptionFile.name}</p>
                    <p className="upload-success-label" style={{ marginTop: '2px' }}>✓ Uploaded & Checked for Purity</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                    <p className="prescription-meta-title">Doctor's Prescription Required</p>
                    <p className="prescription-meta-desc">Upload prescription to verify drug dosing safety</p>
                    
                    <label className="btn-upload-file-label">
                      <Upload className="w-3.5 h-3.5" />
                      Browse Files
                      <input 
                        type="file" 
                        accept="image/*,.pdf" 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                      />
                    </label>
                  </div>
                )}

                {isUploading && (
                  <div className="upload-progress-container">
                    <div className="upload-progress-percent">Uploading {uploadProgress}%</div>
                    <div className="progress-bar-mini">
                      <div className="progress-bar-mini-fill" style={{ width: `${uploadProgress}%` }}></div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Fulfilling Pharmacy Route Display */}
            <div style={{ marginTop: '1.25rem', padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>
                Fulfilling Partner Pharmacy:
              </div>
              <div style={{ fontSize: '0.85rem', color: profile.assignedPharmacyId ? 'white' : '#f87171', fontWeight: 'bold' }}>
                {(() => {
                  const ph = pharmacies.find(p => p.id === profile.assignedPharmacyId);
                  return ph ? `${ph.name} (${ph.city})` : "❌ No Pharmacy Selected (Go to Care Dashboard)";
                })()}
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={selectedMeds.length === 0}
              className="btn-blue"
              style={{ width: '100%', justifyContent: 'center', marginTop: '1.25rem', padding: '12px' }}
            >
              <ShieldCheck className="w-4.5 h-4.5" /> Request SafeRefill
            </button>
            
            <p className="prescription-meta-desc" style={{ marginTop: '0.75rem', lineHeight: '1.4', textAlign: 'center' }}>
              We verify all prescriptions against local physician registries in Nigeria to prevent medication abuse or toxic dosing.
            </p>
          </div>
        </div>

      </div>

    </div>
  );
};

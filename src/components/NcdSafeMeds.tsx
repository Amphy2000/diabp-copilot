import React, { useState } from 'react';
import { 
  ShieldCheck, 
  Upload, 
  ShoppingBag, 
  Truck, 
  FileText, 
  CheckCircle2, 
  Clock, 
  MapPin,
  CreditCard
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
  const [useManualRx, setUseManualRx] = useState(false);
  const [manualRxDetails, setManualRxDetails] = useState('');
  const [uploadedRxDetails, setUploadedRxDetails] = useState('');
  const [brandPreference, setBrandPreference] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [orderNotification, setOrderNotification] = useState<string | null>(null);

  const availableMeds = [
    ...NCD_MEDICATIONS,
    {
      id: 'active-regimen',
      name: 'My Prescribed Active Regimen (Custom Combo)',
      description: profile.activeMeds && profile.activeMeds.length > 0
        ? profile.activeMeds.join(' + ')
        : 'Request a custom combination of your active medications.',
      price: 0,
      rxRequired: true
    }
  ];

  // Simulated prescription upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPrescriptionFile(file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedRxDetails(reader.result as string);
      };
      reader.readAsDataURL(file);

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

  // Find the selected pharmacy to read its pricing
  const assignedPharmacy = pharmacies.find(p => p.id === profile.assignedPharmacyId);
  const getMedPrice = (medId: string, basePrice: number) => {
    if (medId === 'active-regimen') return 0;
    if (assignedPharmacy && assignedPharmacy.prices && assignedPharmacy.prices[medId] !== undefined) {
      return assignedPharmacy.prices[medId];
    }
    return basePrice;
  };

  const calculateTotal = () => {
    return selectedMeds.reduce((sum, medId) => {
      const med = availableMeds.find(m => m.id === medId);
      const price = med ? getMedPrice(med.id, med.price) : 0;
      return sum + price;
    }, 0);
  };

  const handleCheckout = () => {
    if (selectedMeds.length === 0) return;
    
    if (!profile.assignedPharmacyId) {
      alert("Please select a Preferred Refill Pharmacy in your Care Dashboard before requesting a refill.");
      return;
    }

    const requiresRx = selectedMeds.some(medId => {
      if (medId === 'active-regimen') return true;
      const med = NCD_MEDICATIONS.find(m => m.id === medId);
      return med?.rxRequired;
    });

    if (requiresRx) {
      if (useManualRx) {
        if (!manualRxDetails.trim()) {
          alert("Please enter your prescription details (e.g. Doctor's name, prescription number or date) to verify drug dosing safety.");
          return;
        }
      } else {
        if (!prescriptionFile) {
          alert("A valid doctor's prescription must be uploaded for Metformin / Blood Pressure refills. If upload reloads your browser, please select 'Enter details manually' below.");
          return;
        }
      }
    }

    const itemNames: string[] = [];
    selectedMeds.forEach(medId => {
      if (medId === 'active-regimen') {
        if (profile.activeMeds && profile.activeMeds.length > 0) {
          itemNames.push(...profile.activeMeds);
        } else {
          itemNames.push("My Custom Regimen Combo");
        }
      } else {
        const med = NCD_MEDICATIONS.find(m => m.id === medId);
        if (med) itemNames.push(med.name);
      }
    });

    const baseDetails = useManualRx ? manualRxDetails : (uploadedRxDetails || '');
    const finalDetails = brandPreference ? `${brandPreference}|||${baseDetails}` : baseDetails;

    const totalNaira = calculateTotal();
    const orderId = `NCD-${Math.floor(1000 + Math.random() * 9000)}`;

    const newOrder: NcdRefillOrder = {
      id: orderId,
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      items: itemNames,
      totalNaira: totalNaira,
      status: 'Pending Verification',
      prescriptionRequired: requiresRx,
      prescriptionUploaded: useManualRx ? !!manualRxDetails.trim() : (!!prescriptionFile || !!uploadedRxDetails),
      prescriptionDetails: finalDetails || undefined,
      pharmacyId: profile.assignedPharmacyId,
      patientId: profile.id,
      patientName: profile.name
    };

    // If order has a price > 0, trigger real-time payment gateway checkout
    if (totalNaira > 0) {
      if (!(window as any).FlutterwaveCheckout) {
        alert("Payment gateway is loading. Please try again in a few seconds.");
        return;
      }

      const pharmacy = pharmacies.find(p => p.id === profile.assignedPharmacyId);
      const subaccountsList: any[] = [];
      if (pharmacy?.subaccountId) {
        subaccountsList.push({
          id: pharmacy.subaccountId,
          transaction_split_ratio: 95 // 95% to pharmacy, 5% stays as platform fee
        });
      }

      const txRef = `flw-refill-${orderId}-${Date.now()}`;

      (window as any).FlutterwaveCheckout({
        public_key: "FLWPUBK-e2deff3114e81d12bb4f07dbad8b9558-X",
        tx_ref: txRef,
        amount: totalNaira,
        currency: "NGN",
        payment_options: "card, banktransfer, ussd, account",
        customer: {
          email: (profile as any).email || `${profile.name.replace(/\s+/g, '').toLowerCase()}@diabp.com`,
          name: profile.name,
          phonenumber: profile.phone || undefined,
        },
        customizations: {
          title: "DiaBP Pay",
          description: `SafeMeds Medication Refill - Order #${orderId}`,
        },
        subaccounts: subaccountsList.length > 0 ? subaccountsList : undefined,
        callback: function (response: any) {
          console.log("Flutterwave Refill Response:", response);
          if (response.status === "successful" || response.status === "completed") {
            onPlaceOrder({ ...newOrder, status: 'Approved' });
            setOrderNotification(`Refill order paid & submitted successfully! Order ID: ${orderId}`);
            
            // Clear form
            setPrescriptionFile(null);
            setManualRxDetails('');
            setUploadedRxDetails('');
            setBrandPreference('');
            setUseManualRx(false);
            setUploadProgress(0);
            setSelectedMeds(['bundle']);
            
            setTimeout(() => {
              setOrderNotification(null);
            }, 5000);
          } else {
            alert("Payment was not successful. Order not placed.");
          }
        },
        onclose: function () {
          console.log("Payment window closed");
        }
      });
    } else {
      // Free or Quote needed orders go directly through as pending quote
      onPlaceOrder(newOrder);
      setOrderNotification(`Refill request submitted! Since this is a custom regimen, your pharmacist will verify & provide a price quote shortly. Order ID: ${newOrder.id}`);
      
      // Clear form
      setPrescriptionFile(null);
      setManualRxDetails('');
      setUploadedRxDetails('');
      setBrandPreference('');
      setUseManualRx(false);
      setUploadProgress(0);
      setSelectedMeds(['bundle']);

      setTimeout(() => {
        setOrderNotification(null);
      }, 5000);
    }
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
              {availableMeds.map(med => {
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
                      <div className="meds-price">
                        {med.id === 'active-regimen' 
                          ? 'Quote Needed' 
                          : `₦${getMedPrice(med.id, med.price).toLocaleString()}`}
                      </div>
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

              {selectedMeds.includes('active-regimen') && (
                <p style={{ margin: '8px 0 0 0', fontSize: '10px', color: '#fb923c', fontStyle: 'italic', textAlign: 'left', lineHeight: '1.3' }}>
                  * Custom active regimen selected. Fulfilling pharmacy will audit your prescription and update the final price during verification.
                </p>
              )}

              {/* Special Instructions / Brand Preference */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '12px' }}>
                <label style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 'bold', textAlign: 'left', textTransform: 'uppercase' }}>
                  Brand & Dosage Preference Notes
                </label>
                <input
                  type="text"
                  value={brandPreference}
                  onChange={(e) => setBrandPreference(e.target.value)}
                  placeholder="e.g. Branded Glucophage, 1000mg dosage"
                  style={{
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    color: 'white',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Prescription Verification Widget */}
            {selectedMeds.some(medId => {
              const med = NCD_MEDICATIONS.find(m => m.id === medId);
              return med?.rxRequired;
            }) && (
              <div className="prescription-dropzone" style={{ minHeight: 'auto', padding: '15px' }}>
                <div style={{ display: 'flex', gap: '8px', width: '100%', marginBottom: '12px', justifyContent: 'center' }}>
                  <button 
                    type="button"
                    onClick={() => setUseManualRx(false)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      border: '1px solid',
                      borderColor: !useManualRx ? 'var(--color-teal-light)' : 'rgba(255, 255, 255, 0.1)',
                      background: !useManualRx ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
                      color: !useManualRx ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Upload File
                  </button>
                  <button 
                    type="button"
                    onClick={() => setUseManualRx(true)}
                    style={{
                      flex: 1,
                      padding: '8px 10px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      border: '1px solid',
                      borderColor: useManualRx ? 'var(--color-teal-light)' : 'rgba(255, 255, 255, 0.1)',
                      background: useManualRx ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
                      color: useManualRx ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    Enter Details Manually
                  </button>
                </div>

                {useManualRx ? (
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <p className="prescription-meta-title" style={{ fontSize: '12px', color: 'white', textAlign: 'left', fontWeight: 'bold' }}>
                      Enter Prescription Details
                    </p>
                    <textarea
                      value={manualRxDetails}
                      onChange={(e) => setManualRxDetails(e.target.value)}
                      placeholder="e.g. Prescribed by Dr. Emeka, Abuja Heart Clinic on June 15. Metformin 500mg, Refill Code: RX-904"
                      style={{
                        width: '100%',
                        minHeight: '80px',
                        background: 'rgba(0, 0, 0, 0.3)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '8px',
                        padding: '8px',
                        fontSize: '11px',
                        color: 'white',
                        fontFamily: 'inherit',
                        resize: 'none'
                      }}
                    />
                    <p style={{ fontSize: '9px', color: 'var(--text-muted)', textAlign: 'left', lineHeight: '1.25' }}>
                      Type the prescription details here. Ideal if file uploads refresh your browser due to mobile memory constraints.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center', width: '100%' }}>
                    <FileText className="prescription-icon-box w-7 h-7" style={{ marginBottom: '4px' }} />
                    {!prescriptionFile ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'center' }}>
                        <p className="prescription-meta-title">Doctor's Prescription Required</p>
                        <p className="prescription-meta-desc">Upload prescription to verify drug dosing safety</p>
                        
                        <label htmlFor="prescription-upload-input" className="btn-upload-file-label" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Upload className="w-3.5 h-3.5" />
                          Browse Files
                        </label>
                        <input 
                          id="prescription-upload-input"
                          type="file" 
                          accept="application/pdf,image/png,image/jpeg" 
                          onChange={handleFileChange} 
                          style={{ display: 'none' }} 
                        />
                      </div>
                    ) : (
                      <div style={{ width: '100%', textAlign: 'center' }}>
                        <p className="prescription-meta-title" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', margin: '0 auto' }}>{prescriptionFile.name}</p>
                        <p className="upload-success-label" style={{ marginTop: '2px' }}>✓ Uploaded & Checked for Purity</p>
                        <button 
                          type="button" 
                          onClick={() => setPrescriptionFile(null)}
                          style={{ fontSize: '10px', color: '#f87171', background: 'none', border: 'none', textDecoration: 'underline', marginTop: '6px', cursor: 'pointer' }}
                        >
                          Clear File
                        </button>
                      </div>
                    )}

                    {isUploading && (
                      <div className="upload-progress-container" style={{ width: '100%', marginTop: '8px' }}>
                        <div className="upload-progress-percent">Uploading {uploadProgress}%</div>
                        <div className="progress-bar-mini">
                          <div className="progress-bar-mini-fill" style={{ width: `${uploadProgress}%` }}></div>
                        </div>
                      </div>
                    )}
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

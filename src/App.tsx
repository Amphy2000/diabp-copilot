import { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Users, 
  User, 
  Activity, 
  ShoppingBag,
  Compass,
  LogOut,
  Bell
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
  deleteRefillOrder,
  savePushSubscription,
  triggerServerPush
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
  const [globalToasts, setGlobalToasts] = useState<any[]>([]);
  const [showSkipLoading, setShowSkipLoading] = useState(false);

  useEffect(() => {
    if (loading || (userRole === 'patient' && !patientProfile)) {
      const timer = setTimeout(() => {
        setShowSkipLoading(true);
      }, 3500);
      return () => clearTimeout(timer);
    } else {
      setShowSkipLoading(false);
    }
  }, [loading, userRole, patientProfile]);

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

  // Ref to the latest loadData so visibilitychange can call it without stale closures
  const loadDataRef = useRef<(() => Promise<void>) | null>(null);

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
      const role = session.user?.user_metadata?.role || 'patient';

      // OPTIMISTIC: Pre-fill patient profile from per-user localStorage immediately
      // so the UI appears at once while Supabase loads in background
      if (role === 'patient') {
        const cachedKey = `diabp_profile_${session.user.id}`;
        try {
          const cached = localStorage.getItem(cachedKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            // CRITICAL: Always override the name from auth metadata (single source of truth)
            // This prevents stale/wrong names from corrupted localStorage cache
            const authName = session.user.user_metadata?.display_name || parsed.name;
            setPatientProfile({ id: session.user.id, ...parsed, name: authName });
            setLoading(false); // show UI immediately with cached data
            // Don't setLoading(true) again below — Supabase will update silently in background
          }
        } catch {}
      }

      // Only show spinner if we have no cached data to show
      const hasCachedData = role === 'patient' && (() => {
        try { return !!localStorage.getItem(`diabp_profile_${session.user.id}`); } catch { return false; }
      })();
      if (!hasCachedData) setLoading(true);
      try {
        
        let clinicsList: NcdClinic[] = [];
        try {
          clinicsList = await getClinics();
        } catch (e) {
          console.error("Failed to load clinics:", e);
        }
        setClinics(clinicsList);

        let pharmaciesList: NcdPharmacy[] = [];
        try {
          pharmaciesList = await getPharmacies();
        } catch (e) {
          console.error("Failed to load pharmacies:", e);
        }
        setPharmacies(pharmaciesList);

        if (role === 'patient') {
          let profile: PatientNcdProfile | null = null;
          try {
            profile = await getPatientProfile(undefined, session.user.user_metadata?.display_name);
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
          // SMART MERGE: Prefer Supabase data but keep existing cached fields
          // if Supabase returns null (prevents phone/address flash-and-disappear)
          setPatientProfile(prev => {
            if (!prev) return profile;
            return {
              ...prev,
              ...profile,
              // Never overwrite a non-null local value with a null Supabase value
              phone: profile!.phone || prev.phone,
              address: profile!.address || prev.address,
              name: profile!.name || prev.name,
            };
          });
          // Update localStorage cache with the confirmed Supabase data
          if (session?.user?.id) {
            try {
              localStorage.setItem(`diabp_profile_${session.user.id}`, JSON.stringify(profile));
            } catch {}
          }

          let refillOrders: NcdRefillOrder[] = [];
          try {
            refillOrders = await getRefillOrders();
          } catch (e) {
            console.error("Failed to load patient refill orders:", e);
          }
          setOrders(refillOrders);
        } else if (role === 'doctor') {
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

          let clinicPatients: PatientNcdProfile[] = [];
          try {
            clinicPatients = await getPatientsForClinic(clinicId);
          } catch (e) {
            console.error("Failed to load clinic patients:", e);
          }

          let refillOrders: NcdRefillOrder[] = [];
          try {
            refillOrders = await getRefillOrders();
          } catch (e) {
            console.error("Failed to load refill orders:", e);
          }
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

          let pharmacyPatients: PatientNcdProfile[] = [];
          try {
            pharmacyPatients = await getPatientsForPharmacy(pharmacyId);
          } catch (e) {
            console.error("Failed to load pharmacy patients:", e);
          }

          let refillOrders: NcdRefillOrder[] = [];
          try {
            refillOrders = await getRefillOrders();
          } catch (e) {
            console.error("Failed to load refill orders:", e);
          }
          setPatients(pharmacyPatients);
          setOrders(refillOrders);
        } else if (role === 'admin') {
          let allPatients: PatientNcdProfile[] = [];
          try {
            allPatients = await getAllPatients();
          } catch (e) {
            console.error("Failed to load all patients:", e);
          }

          let allOrders: NcdRefillOrder[] = [];
          try {
            allOrders = await getRefillOrders();
          } catch (e) {
            console.error("Failed to load all orders:", e);
          }
          setPatients(allPatients);
          setOrders(allOrders);
        }
      } catch (err) {
        console.error("Failed to load authenticated context data:", err);
      } finally {
        const role = session.user?.user_metadata?.role || 'patient';
        if (role === 'patient' && !patientProfile) {
          console.info("Safety fallback triggered to clear syncing screen...");
          setPatientProfile({
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
          });
        }
        setLoading(false);
      }
    }
    loadDataRef.current = loadData;
    loadData();
  }, [session]);

  // Re-fetch profile whenever user returns to the tab (handles mobile background sync lag)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && loadDataRef.current) {
        loadDataRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Request Notification permission + subscribe to Web Push (enables background notifications)
  useEffect(() => {
    if (!userRole || !session) return; // Wait until we know the user's role

    const VAPID_PUBLIC_KEY = 'BE49G-g17PiHyCzeCE3vJtr4eOlDzXYXz6n-ErsAw2H7vEKEgITWUO7b4EWaDbeaGHAA4-EHgnecb7fFIlLIAxE';

    function urlBase64ToUint8Array(base64String: string): Uint8Array {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = atob(base64);
      return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
    }

    async function subscribeToPush() {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

        const reg = await navigator.serviceWorker.ready;
        let permission = Notification.permission;

        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }

        if (permission !== 'granted') return;

        // Check if already subscribed
        let subscription = await reg.pushManager.getSubscription();
        if (!subscription) {
          subscription = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
        }

        // Save to Supabase so server can push to this device
        await savePushSubscription(subscription, userRole!);

        // Sync role to SW
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SYNC_USER_ROLE',
            payload: { role: userRole }
          });
        }
      } catch (err) {
        console.warn('Push subscription failed (non-fatal):', err);
      }
    }

    subscribeToPush();

    // Handle SW re-subscription events
    const handleSWPushUpdate = (event: MessageEvent) => {
      if (event.data?.type === 'PUSH_SUBSCRIPTION_UPDATED') {
        try {
          const sub = JSON.parse(event.data.payload) as PushSubscription;
          savePushSubscription(sub, userRole!);
        } catch {}
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleSWPushUpdate);
    return () => navigator.serviceWorker?.removeEventListener('message', handleSWPushUpdate);
  }, [userRole, session]);

  // Synchronize userRole to service worker dynamically
  useEffect(() => {
    const syncRole = () => {
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
          type: 'SYNC_USER_ROLE',
          payload: { role: userRole }
        });
      }
    };

    syncRole();

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', syncRole);
      return () => {
        navigator.serviceWorker.removeEventListener('controllerchange', syncRole);
      };
    }
  }, [userRole]);

  // Listen to BroadcastChannel and Service Worker messages for real-time updates & system broadcasts
  useEffect(() => {
    const handleVitalsLogged = (payload: any) => {
      const { patientId, patientName, systolic, diastolic, glucose, glucoseType, streakDays } = payload;
      
      // Update local patients state for clinician dashboard charts
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      setPatients(prev => {
        const exists = prev.some(p => p.id === patientId);
        if (!exists) return prev;
        return prev.map(p => {
          if (p.id === patientId) {
            const bpHist = p.bpHistory || [];
            const glucoseHist = p.glucoseHistory || [];
            
            // Prevent duplicate logs on same date if already present, otherwise append
            const dateExists = bpHist.some(b => b.date === dateStr);
            const updatedBpHistory = dateExists ? bpHist : [...bpHist, { date: dateStr, systolic, diastolic }];
            const updatedGlucoseHistory = dateExists ? glucoseHist : [...glucoseHist, { date: dateStr, level: glucose, type: glucoseType }];
            
            return {
              ...p,
              bpHistory: updatedBpHistory,
              glucoseHistory: updatedGlucoseHistory,
              streakDays: streakDays
            };
          }
          return p;
        });
      });

      // Trigger browser push notification if logged-in user is a clinician/admin
      const isClinician = userRole === 'doctor' || userRole === 'pharmacist' || userRole === 'admin';
      const title = `🚨 Vitals Logged: ${patientName}`;
      const body = `BP: ${systolic}/${diastolic} mmHg | Glucose: ${glucose > 0 ? `${glucose} mg/dL (${glucoseType})` : 'N/A'}. Streak: ${streakDays} days!`;

      // SERVER PUSH: Send to ALL clinicians via server-side Web Push (works even when app is closed)
      // This fires regardless of who the current user is (patient logging = clinicians get push)
      triggerServerPush(title, body, 'clinicians', `vitals-${patientId}`);

      if (isClinician) {
        // Also show local notification on THIS device (same-device clinician)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'SHOW_NOTIFICATION',
            title,
            body
          });
        } else if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, { body, icon: '/favicon.svg' });
        }

        // In-app global toast fallback (always shows, even if OS push is blocked)
        const toastId = `vitals-${Date.now()}-${Math.random()}`;
        setGlobalToasts(prev => {
          if (prev.some(t => t.patientId === patientId && t.systolic === systolic)) return prev;
          return [...prev, { id: toastId, title, body, patientId, systolic, time: Date.now(), type: 'vitals' }];
        });
        setTimeout(() => setGlobalToasts(prev => prev.filter(t => t.id !== toastId)), 10000);
      }
    };

    const handleSystemBroadcast = (payload: any) => {
      const { title, body, target } = payload;
      
      // Target matching filter
      const isClinician = userRole === 'doctor' || userRole === 'pharmacist' || userRole === 'admin';
      const roleMatches =
        target === 'all' ||
        (target === 'clinicians' && isClinician) ||
        (target === 'patients' && userRole === 'patient');

      if (!roleMatches) return;

      // Play audio chime/beep (synthesized double-tone C5 -> E5)
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
        gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.12);
        
        setTimeout(() => {
          const audioCtx2 = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc2 = audioCtx2.createOscillator();
          const gain2 = audioCtx2.createGain();
          osc2.connect(gain2);
          gain2.connect(audioCtx2.destination);
          osc2.type = 'sine';
          osc2.frequency.setValueAtTime(659.25, audioCtx2.currentTime); // E5
          gain2.gain.setValueAtTime(0.06, audioCtx2.currentTime);
          osc2.start();
          osc2.stop(audioCtx2.currentTime + 0.2);
        }, 150);
      } catch (e) {
        console.warn("Melodic chime sound failed:", e);
      }

      // Add to in-app global toasts
      const toastId = `toast-${Date.now()}-${Math.random()}`;
      setGlobalToasts(prev => {
        if (prev.some(t => t.title === title && t.body === body && Date.now() - t.time < 2000)) {
          return prev;
        }
        return [...prev, { id: toastId, title, body, time: Date.now() }];
      });

      // Auto dismiss after 10 seconds
      setTimeout(() => {
        setGlobalToasts(prev => prev.filter(t => t.id !== toastId));
      }, 10000);
    };

    // 1. BroadcastChannel Listener (same browser/device only)
    const channel = new BroadcastChannel('diabp-copilot-channel');
    channel.onmessage = (event) => {
      if (event.data) {
        if (event.data.type === 'VITALS_LOGGED') {
          handleVitalsLogged(event.data.payload);
        } else if (event.data.type === 'SYSTEM_BROADCAST') {
          handleSystemBroadcast(event.data.payload);
        }
      }
    };

    // 2. Service Worker Message Listener (same device only)
    const handleSWMessage = (event: MessageEvent) => {
      if (event.data) {
        if (event.data.type === 'VITALS_LOGGED_BROADCAST') {
          handleVitalsLogged(event.data.payload);
        } else if (event.data.type === 'SYSTEM_BROADCAST_BROADCAST') {
          handleSystemBroadcast(event.data.payload);
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleSWMessage);
    }

    // 3. Supabase Realtime subscription — CROSS-DEVICE broadcast + DB change subscriptions
    // This is what makes admin test notifications reach mobile patients on other devices
    // AND makes ALL data sync live without any refresh
    let realtimeChannel: any = null;
    if (isSupabaseConfigured) {
      realtimeChannel = supabase
        .channel('diabp-realtime-broadcasts')

        // ---- BROADCAST EVENTS (notifications) ----
        .on('broadcast', { event: 'SYSTEM_BROADCAST' }, ({ payload }: any) => {
          handleSystemBroadcast(payload);
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'DISPATCH_SYSTEM_BROADCAST', payload });
          }
        })
        .on('broadcast', { event: 'VITALS_LOGGED' }, ({ payload }: any) => {
          handleVitalsLogged(payload);
          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'PATIENT_LOGGED_VITALS', payload });
          }
        })

        // ---- POSTGRES CHANGES (live data sync) ----
        // Patient profile updated (name, phone, conditions, etc)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'ncd_profiles'
        }, (payload: any) => {
          const updated = payload.new as any;
          if (!updated) return;
          // Update patient profile if it matches current user
          setPatientProfile(prev => {
            if (!prev || prev.id !== updated.id) return prev;
            return {
              ...prev,
              name: updated.name || prev.name,
              age: updated.age ?? prev.age,
              weight: updated.weight ?? prev.weight,
              conditions: updated.conditions || prev.conditions,
              baselineBp: updated.baseline_bp || prev.baselineBp,
              targetGlucoseRange: updated.target_glucose_range || prev.targetGlucoseRange,
              streakDays: updated.streak_days ?? prev.streakDays,
              activeMeds: updated.active_meds || prev.activeMeds,
              phone: updated.phone || prev.phone,
              address: updated.address || prev.address,
              isPremium: updated.is_premium ?? prev.isPremium,
              premiumExpiry: updated.premium_expiry || prev.premiumExpiry,
              assignedClinicId: updated.assigned_clinic_id || prev.assignedClinicId,
              assignedPharmacyId: updated.assigned_pharmacy_id || prev.assignedPharmacyId,
            };
          });
          // Also update the patients list for clinicians
          setPatients(prev => prev.map(p =>
            p.id === updated.id
              ? { ...p, name: updated.name || p.name, isPremium: updated.is_premium ?? p.isPremium,
                  streakDays: updated.streak_days ?? p.streakDays, conditions: updated.conditions || p.conditions }
              : p
          ));
        })

        // New vitals entry — updates bpHistory/glucoseHistory live
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'ncd_vitals'
        }, (payload: any) => {
          const v = payload.new as any;
          if (!v) return;
          const newBp = v.systolic && v.diastolic ? { date: new Date(v.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }), systolic: v.systolic, diastolic: v.diastolic } : null;
          const newGlucose = v.glucose ? { date: new Date(v.created_at).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }), level: v.glucose, type: v.glucose_type || 'Fasting' } : null;
          setPatientProfile(prev => {
            if (!prev || prev.id !== v.patient_id) return prev;
            return {
              ...prev,
              streakDays: v.streak_days ?? prev.streakDays,
              bpHistory: newBp ? [...(prev.bpHistory || []), newBp].slice(-30) : prev.bpHistory,
              glucoseHistory: newGlucose ? [...(prev.glucoseHistory || []), newGlucose].slice(-30) : prev.glucoseHistory,
            };
          });
        })

        // Order status updated — patient sees status change live
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'ncd_orders'
        }, (payload: any) => {
          const updated = payload.new as any;
          const deleted = payload.old as any;
          if (payload.eventType === 'DELETE' && deleted?.id) {
            setOrders(prev => prev.filter(o => o.id !== deleted.id));
            return;
          }
          if (!updated) return;
          setOrders(prev => {
            const exists = prev.find(o => o.id === updated.id);
            if (exists) {
              return prev.map(o => o.id === updated.id
                ? { ...o, status: updated.status || o.status, updatedAt: updated.updated_at || o.updatedAt }
                : o
              );
            }
            // New order inserted — add to list
            return [{ id: updated.id, patientId: updated.patient_id, patientName: updated.patient_name,
              medicationName: updated.medication_name, quantity: updated.quantity, status: updated.status,
              createdAt: updated.created_at, updatedAt: updated.updated_at,
              orderNumber: updated.order_number, clinicId: updated.clinic_id, pharmacyId: updated.pharmacy_id }, ...prev];
          });
        })

        .subscribe((status: string) => {
          console.log('[Realtime] Channel status:', status);
        });
    }

    return () => {
      channel.close();
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      }
      if (realtimeChannel) {
        supabase.removeChannel(realtimeChannel);
      }
    };
  }, [session, userRole]);

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
        const profile = await getPatientProfile(undefined, session.user.user_metadata?.display_name);
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
    // Clear all cached profile data for the current user before signing out
    // This prevents the next user from seeing this user's cached profile
    if (session?.user?.id) {
      try {
        localStorage.removeItem(`diabp_profile_${session.user.id}`);
        localStorage.removeItem('diabp_patient_profile'); // clear shared legacy key
      } catch {}
    }
    await supabase.auth.signOut();
    setPatientProfile(null);
    setPatients([]);
    setOrders([]);
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
    const handleSkipLoading = () => {
      if (userRole === 'patient' && !patientProfile) {
        setPatientProfile({
          id: session?.user?.id || 'offline-user',
          name: session?.user?.user_metadata?.display_name || "Active Patient",
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
          phone: session?.user?.user_metadata?.phone || undefined
        });
      }
      setLoading(false);
    };

    return (
      <div className="app-wrapper" style={{ justifyContent: 'center', alignItems: 'center', background: '#0d1117', padding: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center', maxWidth: '320px' }}>
          <Compass className="spinner-icon w-10 h-10 text-teal-400 animate-spin" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <p style={{ fontSize: '13px', fontWeight: 'bold', color: 'white', margin: 0 }}>
              Synchronizing Database...
            </p>
            <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.4' }}>
              Fetching your treatment plans, vitals history, and refill configurations.
            </p>
          </div>
          
          {showSkipLoading && (
            <button
              onClick={handleSkipLoading}
              style={{
                marginTop: '8px',
                background: 'rgba(20, 184, 166, 0.1)',
                color: '#14b8a6',
                border: '1px solid rgba(20, 184, 166, 0.2)',
                borderRadius: '8px',
                padding: '8px 16px',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(20, 184, 166, 0.15)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(20, 184, 166, 0.1)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              Continue Offline Mode ➜
            </button>
          )}
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

      {/* Global in-app toast notification system */}
      {globalToasts.length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '24px',
          zIndex: 100000,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          width: '100%',
          maxWidth: '380px',
          pointerEvents: 'none'
        }}>
          {globalToasts.map((toast) => (
            <div 
              key={toast.id}
              style={{
                background: 'linear-gradient(135deg, #1e1b4b 0%, #0f0c29 100%)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                borderRadius: '12px',
                padding: '16px',
                boxShadow: '0 10px 25px -5px rgba(139, 92, 246, 0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                pointerEvents: 'auto',
                position: 'relative'
              }}
            >
              {/* Close Button */}
              <button
                onClick={() => setGlobalToasts(prev => prev.filter(t => t.id !== toast.id))}
                style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255, 255, 255, 0.5)',
                  cursor: 'pointer',
                  fontSize: '11px',
                  padding: '4px'
                }}
              >
                ✕
              </button>

              {/* Toast Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Bell size={14} style={{ color: 'var(--color-teal-light)' }} />
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: 'bold', 
                  textTransform: 'uppercase', 
                  color: 'var(--color-teal-light)',
                  letterSpacing: '0.05em'
                }}>
                  📢 System Notice
                </span>
                <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.4)', marginLeft: 'auto', marginRight: '14px' }}>
                  just now
                </span>
              </div>

              {/* Toast Body */}
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: 'white' }}>
                  {toast.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.7)', marginTop: '4px', lineHeight: '1.4' }}>
                  {toast.body}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export default App;

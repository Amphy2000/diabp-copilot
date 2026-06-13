import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

// Create a mock auth object that mimics Supabase auth but works using localStorage
const mockAuth = {
  getSession: async () => {
    try {
      const stored = localStorage.getItem('amphy_mock_session');
      if (stored) return { data: { session: JSON.parse(stored) }, error: null };
    } catch {}
    return { data: { session: null }, error: null };
  },
  onAuthStateChange: (callback: (event: string, session: any) => any) => {
    let session: any = null;
    try {
      const stored = localStorage.getItem('amphy_mock_session');
      if (stored) session = JSON.parse(stored);
    } catch {}
    
    // Defer the callback invocation to avoid React state update during render warnings
    setTimeout(() => {
      callback('SIGNED_IN', session);
    }, 0);

    return {
      data: {
        subscription: {
          unsubscribe: () => {}
        }
      }
    };
  },
  signInWithPassword: async ({ email }: { email: string }) => {
    const session = {
      user: {
        email,
        user_metadata: {
          amphy_history: JSON.parse(localStorage.getItem('amphy_ai_history') || '[]')
        }
      }
    };
    localStorage.setItem('amphy_mock_session', JSON.stringify(session));
    window.location.reload();
    return { data: { session }, error: null };
  },
  signUp: async ({ email }: { email: string }) => {
    return { data: { user: { email } }, error: null };
  },
  signOut: async () => {
    localStorage.removeItem('amphy_mock_session');
    window.location.reload();
    return { error: null };
  },
  updateUser: async ({ data }: { data: any }) => {
    try {
      const stored = localStorage.getItem('amphy_mock_session');
      if (stored) {
        const session = JSON.parse(stored);
        session.user.user_metadata = { ...session.user.user_metadata, ...data };
        localStorage.setItem('amphy_mock_session', JSON.stringify(session));
      }
    } catch {}
    return { data: {}, error: null };
  },
  getUser: async () => {
    try {
      const stored = localStorage.getItem('amphy_mock_session');
      if (stored) {
        const session = JSON.parse(stored);
        return { data: { user: session.user }, error: null };
      }
    } catch {}
    return { data: { user: null }, error: null };
  }
};

let client: any = null;
let configured = false;

// Check if credentials are set and are not placeholder strings or invalid formats
if (
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'undefined' && 
  supabaseAnonKey !== 'undefined' && 
  supabaseUrl.startsWith('http')
) {
  try {
    client = createClient(supabaseUrl, supabaseAnonKey);
    configured = true;
  } catch (err) {
    console.warn('Failed to initialize Supabase client:', err);
    client = null;
    configured = false;
  }
}

if (!client) {
  client = {
    auth: mockAuth,
  };
}

export const isSupabaseConfigured = configured;
export const supabase = client;

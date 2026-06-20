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
    const mockUsers = JSON.parse(localStorage.getItem('diabp_mock_users') || '{}');
    const mockUser = mockUsers[email.toLowerCase()] || {
      id: 'mock-user-default',
      email,
      user_metadata: {
        role: 'patient',
        display_name: 'Chief Chinedu Eze'
      }
    };

    const session = {
      user: mockUser,
      access_token: 'mock-token',
      expires_in: 3600
    };
    localStorage.setItem('amphy_mock_session', JSON.stringify(session));
    window.location.reload();
    return { data: { session }, error: null };
  },
  signUp: async ({ email, password, options }: { email: string, password?: string, options?: any }) => {
    const mockUserId = `mock-user-${Math.random().toString(36).substr(2, 9)}`;
    const metadata = options?.data || {};
    
    const mockUser = {
      id: mockUserId,
      email,
      user_metadata: {
        role: metadata.role || 'patient',
        display_name: metadata.display_name || 'Alhaji Ibrahim',
        ...metadata
      }
    };

    // Save to list of mock users
    const mockUsers = JSON.parse(localStorage.getItem('diabp_mock_users') || '{}');
    mockUsers[email.toLowerCase()] = mockUser;
    localStorage.setItem('diabp_mock_users', JSON.stringify(mockUsers));

    // Auto sign-in
    const session = {
      user: mockUser,
      access_token: 'mock-token',
      expires_in: 3600
    };
    localStorage.setItem('amphy_mock_session', JSON.stringify(session));

    return { data: { user: mockUser }, error: null };
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

// Create a mock db query builder that stores facility associations in localStorage
const mockFrom = (tableName: string) => {
  return {
    select: (columns?: string) => {
      return {
        eq: (colName: string, val: any) => {
          return {
            single: async () => {
              if (tableName === 'ncd_clinicians') {
                const associations = JSON.parse(localStorage.getItem('diabp_mock_clinicians') || '[]');
                const found = associations.find((a: any) => a.user_id === val);
                return { data: found || null, error: null };
              }
              if (tableName === 'ncd_pharmacists') {
                const associations = JSON.parse(localStorage.getItem('diabp_mock_pharmacists') || '[]');
                const found = associations.find((a: any) => a.user_id === val);
                return { data: found || null, error: null };
              }
              return { data: null, error: null };
            },
            limit: (n: number) => {
              return {
                then(resolve: any) {
                  resolve({ data: [], error: null });
                }
              };
            }
          };
        },
        order: (col: string, options?: any) => {
          return {
            then(resolve: any) {
              resolve({ data: [], error: null });
            }
          };
        }
      };
    },
    insert: (rows: any[]) => {
      if (tableName === 'ncd_clinicians') {
        const associations = JSON.parse(localStorage.getItem('diabp_mock_clinicians') || '[]');
        associations.push(...rows);
        localStorage.setItem('diabp_mock_clinicians', JSON.stringify(associations));
      }
      if (tableName === 'ncd_pharmacists') {
        const associations = JSON.parse(localStorage.getItem('diabp_mock_pharmacists') || '[]');
        associations.push(...rows);
        localStorage.setItem('diabp_mock_pharmacists', JSON.stringify(associations));
      }
      return {
        select: () => ({
          single: async () => ({ data: rows[0], error: null })
        })
      };
    },
    update: (payload: any) => {
      return {
        eq: (col: string, val: any) => {
          return {
            then(resolve: any) {
              resolve({ data: null, error: null });
            }
          };
        }
      };
    }
  };
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
    from: mockFrom
  };
}

export const isSupabaseConfigured = configured;
export const supabase = client;

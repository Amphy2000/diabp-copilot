// ════════════════════════════════════════════
//              BOT CONFIGURATION & RULES
// ════════════════════════════════════════════

// 1. Deriv App ID (Use a registered App ID for OAuth, or 61247 for general testing)
const APP_ID = import.meta.env.VITE_DERIV_APP_ID || '61247'; 

// 2. White-listed Accounts list. Add CR numbers here to grant access.
// Both Virtual (VRTC) and Real (CR) accounts can be added here.
const APPROVED_ACCOUNTS = [
  'VRTC123456',  // Example Virtual account
  'CR123456',    // Example Real account
  'ROT91833970', // User account
  'DOT93132805', // User demo account
  // Add your clients' account IDs here as they sign up under your link
];

// 3. Supabase Credentials (leave blank to use the hardcoded APPROVED_ACCOUNTS whitelist instead)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dqylesrwkgupnflyveth.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRxeWxlc3J3a2d1cG5mbHl2ZXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyOTcyMDIsImV4cCI6MjA5Njg3MzIwMn0.ll4lznpvJsSkXM6Z8Uf1kL6q-L5Mn3JAtx4QdxoXtyg';


// ════════════════════════════════════════════
//            STATE & UI SELECTORS
// ════════════════════════════════════════════
let socket = null;
let isAuthorized = false;
let isTrading = false;
let ticksHistory = []; // stores tick prices
let sessionProfit = 0.0;
let initialStake = 0.50;
let currentStake = 0.50;
let targetProfit = 2.00;
let stopLoss = 5.00;
let maxMartingaleSteps = 3;
let currentMartingaleStep = 0;
let currentProposalId = null;
let currentContractId = null;
let activePurchaseProposal = null;
let wakeLock = null;
let currentSubscriptionId = null;
let keepAliveAudioContext = null;
let keepAliveOscillator = null;

// Performance Stats Object
let stats = {
  wins: 0,
  losses: 0,
  total: 0,
  totalProfit: 0.0,
  history: []
};

// DOM Elements
const loginPanel = document.getElementById('loginPanel');
const consolePanel = document.getElementById('consolePanel');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const accountLabel = document.getElementById('accountLabel');
const accountSelect = document.getElementById('accountSelect');
const balanceText = document.getElementById('balanceText');
const profitText = document.getElementById('profitText');
const livePrice = document.getElementById('livePrice');
const trendLabel = document.getElementById('trendLabel');
const tickDirection = document.getElementById('tickDirection');
const logConsole = document.getElementById('logConsole');
const startBotBtn = document.getElementById('startBotBtn');
const stopBotBtn = document.getElementById('stopBotBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');

// Settings Inputs
const stakeInput = document.getElementById('stakeInput');
const targetProfitInput = document.getElementById('targetProfitInput');
const stopLossInput = document.getElementById('stopLossInput');
const martingaleStepsInput = document.getElementById('martingaleStepsInput');

// Risk Presets elements
const presetConservativeBtn = document.getElementById('presetConservativeBtn');
const presetModerateBtn = document.getElementById('presetModerateBtn');
const presetAggressiveBtn = document.getElementById('presetAggressiveBtn');
const presetFeedback = document.getElementById('presetFeedback');

let currentPreset = 'moderate'; // 'conservative', 'moderate', 'aggressive', 'custom'

// Developer Admin Panel Elements
const adminPanel = document.getElementById('adminPanel');
const adminWhitelistInput = document.getElementById('adminWhitelistInput');
const adminWhitelistBtn = document.getElementById('adminWhitelistBtn');
const adminFeedback = document.getElementById('adminFeedback');

// Performance Stats Elements
const statsWins = document.getElementById('statsWins');
const statsLosses = document.getElementById('statsLosses');
const statsWinRate = document.getElementById('statsWinRate');
const statsTotal = document.getElementById('statsTotal');
const toggleHistoryBtn = document.getElementById('toggleHistoryBtn');
const tradeHistorySection = document.getElementById('tradeHistorySection');
const tradeHistoryBody = document.getElementById('tradeHistoryBody');
const resetStatsBtn = document.getElementById('resetStatsBtn');
const exportReportBtn = document.getElementById('exportReportBtn');
const promoTemplateSelect = document.getElementById('promoTemplateSelect');

// PWA Installation Elements
let deferredPrompt = null;
const pwaInstallBanner = document.getElementById('pwaInstallBanner');
const pwaInstallBtn = document.getElementById('pwaInstallBtn');

// Simulator Elements
const demoPrice = document.getElementById('demoPrice');
const demoDirection = document.getElementById('demoDirection');
const demoTerminal = document.getElementById('demoTerminal');

// Guide Elements
const toggleGuideBtn = document.getElementById('toggleGuideBtn');
const settingsGuide = document.getElementById('settingsGuide');

// Push Notification Elements & Functions
const notificationCheckbox = document.getElementById('notificationCheckbox');


function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    Notification.requestPermission().then(permission => {
      if (permission === "granted") {
        addLog("System notifications enabled.", "success");
      }
    });
  }
}

function sendPushNotification(title, body) {
  const isEnabled = notificationCheckbox ? notificationCheckbox.checked : true;
  if (!isEnabled) return;

  if (Notification.permission === "granted") {
    // 1. Attempt sending via Service Worker (required for Mobile support)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.showNotification(title, {
          body: body,
          icon: window.location.origin + '/favicon.svg',
          badge: window.location.origin + '/favicon.svg',
          vibrate: [200, 100, 200]
        });
      }).catch(err => {
        // Fallback to standard desktop notification if SW is not ready
        if ("Notification" in window) {
          new Notification(title, { body: body, icon: window.location.origin + '/favicon.svg' });
        }
      });
    } else if ("Notification" in window) {
      // 2. Direct browser fallback for desktops without SW support
      try {
        new Notification(title, { body: body, icon: window.location.origin + '/favicon.svg' });
      } catch (err) {
        console.warn("Direct Notification constructor failed:", err);
      }
    }
  }
}



// ════════════════════════════════════════════
//         OAUTH FLOW & AUTHENTICATION (OIDC/PKCE & PAT)
// ════════════════════════════════════════════

// PKCE Cryptographic Helpers
function dec2hex(dec) {
  return ('0' + dec.toString(16)).slice(-2);
}

function generateCodeVerifier() {
  const array = new Uint32Array(56 / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  return window.crypto.subtle.digest('SHA-256', data);
}

function base64urlencode(a) {
  let str = "";
  const bytes = new Uint8Array(a);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    str += String.fromCharCode(bytes[i]);
  }
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function generateCodeChallenge(v) {
  const hashed = await sha256(v);
  return base64urlencode(hashed);
}

function generateRandomState() {
  const array = new Uint32Array(28 / 2);
  window.crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join('');
}

// Retrieve working App ID and fetch accounts from Options API REST endpoint
async function fetchAccountsWithFallback(token) {
  const candidates = [];
  // Use the configured APP_ID if it is alphanumeric (non-numeric)
  if (/^[a-zA-Z0-9]+$/.test(APP_ID) && !/^\d+$/.test(APP_ID)) {
    candidates.push(APP_ID);
  }
  // Standard PAT/OAuth App ID fallbacks registered by the user
  candidates.push('33xF1iFStFhUTRFup3ZQF'); // PAT Type App ID
  candidates.push('33xCanrA7freeICOdpEoH'); // OAuth Type App ID

  // Deduplicate candidates
  const uniqueCandidates = [...new Set(candidates)];
  let lastErrorMsg = "Failed to retrieve account list.";

  for (const appId of uniqueCandidates) {
    try {
      addLog(`Attempting account list fetch with App ID: ${appId}...`, "info");
      const res = await fetch('https://api.derivws.com/trading/v1/options/accounts', {
        method: 'GET',
        headers: {
          'Deriv-App-ID': appId,
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data && data.data && data.data.length > 0) {
          localStorage.setItem('deriv_app_id', appId);
          addLog(`Successful account retrieval using App ID: ${appId}`, "success");
          return { accounts: data.data, appId: appId };
        }
      } else {
        const errText = await res.text();
        lastErrorMsg = `REST Accounts API failed (${res.status}): ${errText}`;
        console.warn(`App ID ${appId} failed: ${res.status} - ${errText}`);
      }
    } catch (err) {
      lastErrorMsg = `Connection error: ${err.message}`;
      console.warn(`Fetch accounts error with App ID ${appId}:`, err);
    }
  }
  throw new Error(lastErrorMsg);
}

// Check URL parameters on page load
window.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  
  // 1. Check for legacy OAuth credentials (and parse all account tokens in redirect)
  const legacyToken = urlParams.get('token1');
  const legacyAcct = urlParams.get('acct1');

  if (legacyToken && legacyAcct) {
    const tokensMap = {};
    let idx = 1;
    while (urlParams.get(`acct${idx}`) && urlParams.get(`token${idx}`)) {
      const acctId = urlParams.get(`acct${idx}`).trim().toUpperCase();
      const tokenVal = urlParams.get(`token${idx}`).trim();
      tokensMap[acctId] = tokenVal;
      idx++;
    }
    localStorage.setItem('deriv_tokens_map', JSON.stringify(tokensMap));

    // Store all accounts so the account selector works immediately in legacy flow
    const legacyAccounts = Object.keys(tokensMap).map(acctId => ({ account_id: acctId }));
    localStorage.setItem('deriv_all_accounts', JSON.stringify(legacyAccounts));

    localStorage.setItem('deriv_token', legacyToken);
    localStorage.setItem('deriv_acct', legacyAcct);
    localStorage.removeItem('deriv_app_id'); // clear any OAuth-based App ID
    window.history.replaceState({}, document.title, window.location.pathname);
    checkAuth();
    return;
  }

  // 2. Check for new OIDC/OAuth 2.0 PKCE Authorization Code response
  const code = urlParams.get('code');
  const state = urlParams.get('state');

  if (code && state) {
    const storedState = sessionStorage.getItem('oauth_state');
    const storedVerifier = sessionStorage.getItem('code_verifier');

    if (!storedState || state !== storedState) {
      alert("⚠️ CSRF verification failed. OAuth state mismatch.");
      window.history.replaceState({}, document.title, window.location.pathname);
      checkAuth();
      return;
    }

    addLog("Authorization code received. Exchanging for access token...", "info");
    
    // Clean URL bar immediately so parameters aren't kept
    window.history.replaceState({}, document.title, window.location.pathname);

    try {
      const redirectUri = window.location.origin + '/';
      const tokenRes = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          code,
          code_verifier: storedVerifier,
          client_id: APP_ID,
          redirect_uri: redirectUri
        })
      });

      if (!tokenRes.ok) {
        const errText = await tokenRes.text();
        throw new Error(`Token exchange failed (${tokenRes.status}): ${errText}`);
      }

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new Error("Access token missing in exchange response.");
      }

      const accessToken = tokenData.access_token;
      
      // Fetch account details to verify and find account ID
      const { accounts, appId } = await fetchAccountsWithFallback(accessToken);
      
      // Store all accounts in localStorage
      localStorage.setItem('deriv_all_accounts', JSON.stringify(accounts));
      
      // Intelligently select the first whitelisted account to log in automatically
      let targetAcct = null;
      for (const a of accounts) {
        const approved = await isAccountApproved(a.account_id);
        if (approved) {
          targetAcct = a;
          break;
        }
      }

      // If none are whitelisted, default to demo (VRTC/DOT) to show whitelist warning, otherwise fallback to first
      if (!targetAcct) {
        const demoAcct = accounts.find(a => a.account_id && (a.account_id.toUpperCase().startsWith('VRTC') || a.account_id.toUpperCase().startsWith('DOT')));
        targetAcct = demoAcct || accounts[0];
      }

      // Check if whitelisted
      const isApproved = await isAccountApproved(targetAcct.account_id);
      if (!isApproved) {
        alert(`⚠️ ACCESS DENIED\nYour account (${targetAcct.account_id}) is not white-listed.\n\nPlease contact the admin to activate access.`);
        logout();
        return;
      }

      localStorage.setItem('deriv_token', accessToken);
      localStorage.setItem('deriv_acct', targetAcct.account_id);
      localStorage.setItem('deriv_app_id', appId);

      addLog(`OAuth login successful for account ${targetAcct.account_id}`, "success");
    } catch (err) {
      addLog(`OAuth error: ${err.message}`, "error");
      alert(`OAuth login failed: ${err.message}`);
    }

    // Clear session storage
    sessionStorage.removeItem('oauth_state');
    sessionStorage.removeItem('code_verifier');
  }

  // Register service worker for PWA support and mobile push notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('Service Worker registered scope:', reg.scope);
    }).catch(err => {
      console.error('Service Worker registration failed:', err);
    });
  }

  checkAuth();
  loadStats();
});

// Helper to check if account is whitelisted
async function isAccountApproved(acct) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return APPROVED_ACCOUNTS.some(approved => 
      approved.trim().toUpperCase() === acct.trim().toUpperCase()
    );
  }

  try {
    const formattedAcct = acct.trim().toUpperCase();
    const response = await fetch(`${SUPABASE_URL}/rest/v1/allowed_users?account_id=eq.${formattedAcct}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    
    if (!response.ok) {
      console.warn("Supabase response not OK, falling back to local whitelist");
      return APPROVED_ACCOUNTS.some(approved => 
        approved.trim().toUpperCase() === acct.trim().toUpperCase()
      );
    }

    const data = await response.json();
    if (data && data.length > 0) {
      return true;
    }

    // Fall back to local whitelist if not found in Supabase database
    return APPROVED_ACCOUNTS.some(approved => 
      approved.trim().toUpperCase() === acct.trim().toUpperCase()
    );
  } catch (err) {
    console.error("Supabase error, falling back to local whitelist:", err);
    return APPROVED_ACCOUNTS.some(approved => 
      approved.trim().toUpperCase() === acct.trim().toUpperCase()
    );
  }
}

function updateAccountLabelBadge(acct) {
  if (!accountLabel) return;
  if (acct.toUpperCase().startsWith('VRTC') || acct.toUpperCase().startsWith('DOT')) {
    accountLabel.innerText = "Virtual Account";
    accountLabel.style.background = "rgba(56, 189, 248, 0.1)";
    accountLabel.style.color = "var(--color-primary)";
  } else {
    accountLabel.innerText = "Real Account";
    accountLabel.style.background = "rgba(16, 185, 129, 0.1)";
    accountLabel.style.color = "var(--color-success)";
  }
}

async function populateAccountSelector(token) {
  if (!accountSelect) return;
  
  let accounts = [];
  try {
    const stored = localStorage.getItem('deriv_all_accounts');
    if (stored) {
      accounts = JSON.parse(stored);
    } else {
      const result = await fetchAccountsWithFallback(token);
      accounts = result.accounts;
      localStorage.setItem('deriv_all_accounts', JSON.stringify(accounts));
    }
  } catch (err) {
    console.error("Failed to populate account list:", err);
    addLog("Error loading account list.", "error");
  }

  // Clear existing options
  accountSelect.innerHTML = '';

  const currentAcct = localStorage.getItem('deriv_acct');

  for (const a of accounts) {
    const opt = document.createElement('option');
    opt.value = a.account_id;
    const typeStr = a.account_id.toUpperCase().startsWith('DOT') || a.account_id.toUpperCase().startsWith('VRTC') ? 'Demo' : 'Real';
    opt.textContent = `${a.account_id} (${typeStr})`;
    if (a.account_id === currentAcct) {
      opt.selected = true;
    }
    accountSelect.appendChild(opt);
  }
}

// Add event listener for account Select box change
if (accountSelect) {
  accountSelect.addEventListener('change', async () => {
    const selectedAcct = accountSelect.value;
    const isApproved = await isAccountApproved(selectedAcct);
    
    if (!isApproved) {
      alert(`⚠️ ACCESS DENIED\nYour account (${selectedAcct}) is not white-listed.\n\nPlease contact the admin to activate access.`);
      // Revert select box value
      accountSelect.value = localStorage.getItem('deriv_acct');
      return;
    }

    addLog(`Switching to account ${selectedAcct}...`, "info");
    
    if (isTrading) {
      stopTrading("Account switched");
    }

    // Load account-specific token from map if it exists
    try {
      const storedMap = localStorage.getItem('deriv_tokens_map');
      if (storedMap) {
        const tokensMap = JSON.parse(storedMap);
        const matchedToken = tokensMap[selectedAcct.trim().toUpperCase()];
        if (matchedToken) {
          localStorage.setItem('deriv_token', matchedToken);
        }
      }
    } catch (err) {
      console.warn("Failed to retrieve token from map:", err);
    }
    
    localStorage.setItem('deriv_acct', selectedAcct);
    updateAccountLabelBadge(selectedAcct);
    checkAdminStatus();

    if (socket) {
      socket.close();
    }
    connectWebSocket();
  });
}

// ════════════════════════════════════════════
//         RISK PRESET & SETTINGS WIZARD
// ════════════════════════════════════════════

function applyPreset(presetType) {
  currentPreset = presetType;
  
  if (!presetConservativeBtn || !presetModerateBtn || !presetAggressiveBtn || !presetFeedback) return;

  // Update button active states
  presetConservativeBtn.classList.toggle('active', presetType === 'conservative');
  presetModerateBtn.classList.toggle('active', presetType === 'moderate');
  presetAggressiveBtn.classList.toggle('active', presetType === 'aggressive');

  // Retrieve current balance
  let balance = 20.0; // Default fallback if not logged in
  const balStr = balanceText ? balanceText.innerText.replace('$', '') : '';
  const parsedBal = parseFloat(balStr);
  if (!isNaN(parsedBal) && parsedBal > 0) {
    balance = parsedBal;
  }

  let calculatedStake = 0.50;
  let calculatedSteps = 3;
  let calculatedStop = 5.00;
  let calculatedTarget = 2.00;
  let feedbackMsg = "";

  if (presetType === 'conservative') {
    calculatedStake = Math.max(0.35, Math.round((balance * 0.01) * 20) / 20); // 1% of balance, rounded to nearest 0.05
    calculatedSteps = 2;
    calculatedStop = Math.round((calculatedStake * (1 + 2 + 4)) * 100) / 100; // sum of stakes for 2 steps (Stake + 2*Stake)
    calculatedTarget = Math.max(1.00, Math.round((balance * 0.03) * 2) / 2); // 3% of balance target
    feedbackMsg = `🛡️ Conservative: 1% stake ($${calculatedStake.toFixed(2)}), 2 recovery steps. Low risk. Recommended balance: $15+`;
  } else if (presetType === 'moderate') {
    calculatedStake = Math.max(0.50, Math.round((balance * 0.02) * 20) / 20); // 2% of balance, rounded to nearest 0.05
    if (balance < 25) {
      calculatedStake = 0.50; // Fallback minimum stake
    }
    calculatedSteps = 3;
    calculatedStop = Math.round((calculatedStake * (1 + 2 + 4 + 8)) * 100) / 100; // sum of stakes for 3 steps
    calculatedTarget = Math.max(2.00, Math.round((balance * 0.07) * 2) / 2); // 7% of balance target
    feedbackMsg = `⚖️ Moderate: 2% stake ($${calculatedStake.toFixed(2)}), 3 recovery steps. Balanced risk. Recommended balance: $25+`;
  } else if (presetType === 'aggressive') {
    calculatedStake = Math.max(0.50, Math.round((balance * 0.04) * 10) / 10); // 4% of balance, rounded to nearest 0.10
    calculatedSteps = 4;
    calculatedStop = Math.round((calculatedStake * (1 + 2 + 4 + 8 + 16)) * 100) / 100; // sum of stakes for 4 steps
    calculatedTarget = Math.max(5.00, Math.round((balance * 0.15) * 2) / 2); // 15% of balance target
    feedbackMsg = `🔥 Aggressive: 4% stake ($${calculatedStake.toFixed(2)}), 4 recovery steps. High yield, high risk. Recommended balance: $50+`;
  }

  // Update inputs
  if (presetType !== 'custom') {
    if (stakeInput) stakeInput.value = calculatedStake.toFixed(2);
    if (targetProfitInput) targetProfitInput.value = calculatedTarget.toFixed(2);
    if (stopLossInput) stopLossInput.value = calculatedStop.toFixed(2);
    if (martingaleStepsInput) martingaleStepsInput.value = calculatedSteps;
    presetFeedback.innerText = feedbackMsg;
    
    console.log(`Preset Applied: ${presetType}. Stake: ${calculatedStake}, Steps: ${calculatedSteps}, Stop: ${calculatedStop}, Target: ${calculatedTarget}`);
  }
}

// Event Listeners for Presets
if (presetConservativeBtn) {
  presetConservativeBtn.addEventListener('click', () => applyPreset('conservative'));
}
if (presetModerateBtn) {
  presetModerateBtn.addEventListener('click', () => applyPreset('moderate'));
}
if (presetAggressiveBtn) {
  presetAggressiveBtn.addEventListener('click', () => applyPreset('aggressive'));
}

// Event listeners to detect manual customization
const markCustomSettings = () => {
  currentPreset = 'custom';
  if (presetConservativeBtn) presetConservativeBtn.classList.remove('active');
  if (presetModerateBtn) presetModerateBtn.classList.remove('active');
  if (presetAggressiveBtn) presetAggressiveBtn.classList.remove('active');
  if (presetFeedback) presetFeedback.innerText = "✏️ Custom settings applied by user.";
};

if (stakeInput) stakeInput.addEventListener('input', markCustomSettings);
if (targetProfitInput) targetProfitInput.addEventListener('input', markCustomSettings);
if (stopLossInput) stopLossInput.addEventListener('input', markCustomSettings);
if (martingaleStepsInput) martingaleStepsInput.addEventListener('input', markCustomSettings);

// Apply default on load
setTimeout(() => {
  applyPreset('moderate');
}, 500);

// Developer Admin Panel logic
function checkAdminStatus() {
  const currentAcct = localStorage.getItem('deriv_acct');
  if (!adminPanel) return;

  const adminAccounts = ['ROT91833970', 'DOT93132805'];
  if (currentAcct && adminAccounts.includes(currentAcct.trim().toUpperCase())) {
    adminPanel.classList.remove('hidden');
  } else {
    adminPanel.classList.add('hidden');
  }
}

if (adminWhitelistBtn) {
  adminWhitelistBtn.addEventListener('click', async () => {
    const accountToWhitelist = adminWhitelistInput.value.trim().toUpperCase();
    if (!accountToWhitelist) {
      showAdminFeedback("Please enter a valid Account ID.", "error");
      return;
    }

    const adminAcct = localStorage.getItem('deriv_acct');
    const adminToken = localStorage.getItem('deriv_token');

    if (!adminAcct || !adminToken) {
      showAdminFeedback("Developer session expired. Please log in again.", "error");
      return;
    }

    adminWhitelistBtn.disabled = true;
    adminWhitelistBtn.innerText = "Whitelisting...";
    showAdminFeedback("Processing...", "info");

    try {
      addLog(`Sending whitelist request for account ${accountToWhitelist}...`, "info");
      
      let response;
      try {
        response = await fetch('/api/whitelist', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            account_to_whitelist: accountToWhitelist,
            admin_account_id: adminAcct,
            admin_token: adminToken
          })
        });
      } catch (e) {
        // Fetch failed (network or local dev without serverless backend)
        response = { status: 404 };
      }

      // If Serverless function is not found (404), fallback to direct Supabase REST insert (using anon key)
      if (response.status === 404) {
        addLog("Vercel Serverless Function /api/whitelist not found (404). Falling back to direct Supabase insert...", "warn");
        
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
          throw new Error("Supabase credentials are not configured.");
        }

        // Check if already whitelisted first to avoid duplicate key errors
        try {
          const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/allowed_users?account_id=eq.${accountToWhitelist}`, {
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData && checkData.length > 0) {
              showAdminFeedback(`Account ${accountToWhitelist} is already whitelisted!`, "success");
              addLog(`Database Whitelist Check (Direct): ${accountToWhitelist} is already whitelisted.`, "success");
              adminWhitelistInput.value = "";
              return;
            }
          }
        } catch (checkErr) {
          console.warn("Failed to check existing whitelist table row:", checkErr);
        }

        const directRes = await fetch(`${SUPABASE_URL}/rest/v1/allowed_users`, {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({
            account_id: accountToWhitelist
          })
        });

        if (!directRes.ok) {
          const errText = await directRes.text();
          throw new Error(`Direct database insert failed: ${errText} (Note: Row-Level Security in Supabase might block anonymous writes. Set up SUPABASE_SERVICE_ROLE_KEY in Vercel to allow secure developer whitelisting)`);
        }

        showAdminFeedback(`Direct database insertion successful for ${accountToWhitelist}!`, "success");
        addLog(`Database Whitelist Success (Direct): ${accountToWhitelist}`, "success");
        adminWhitelistInput.value = "";
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Server returned an error.');
      }

      showAdminFeedback(data.message || `Account ${accountToWhitelist} whitelisted successfully!`, "success");
      addLog(`Database Whitelist Success: ${accountToWhitelist}`, "success");
      adminWhitelistInput.value = "";
    } catch (err) {
      showAdminFeedback(err.message, "error");
      addLog(`Database Whitelist Error: ${err.message}`, "error");
    } finally {
      adminWhitelistBtn.disabled = false;
      adminWhitelistBtn.innerText = "Whitelist";
    }
  });
}

function showAdminFeedback(text, type) {
  if (!adminFeedback) return;
  adminFeedback.innerText = text;
  adminFeedback.className = "admin-feedback " + type;
  if (type === "info") {
    adminFeedback.style.color = "var(--color-primary)";
    adminFeedback.style.display = "block";
  } else {
    adminFeedback.style.color = ""; // fallback to CSS classes
  }
}

async function checkAuth() {
  const token = localStorage.getItem('deriv_token');
  const acct = localStorage.getItem('deriv_acct');

  if (token && acct) {
    // Check if account is in the white-list (via Supabase or local fallback)
    const isApproved = await isAccountApproved(acct);

    if (!isApproved) {
      alert(`⚠️ ACCESS DENIED\nYour account (${acct}) is not white-listed.\n\nPlease contact the admin to activate access.`);
      logout();
      return;
    }

    // Display trading console
    loginPanel.classList.remove('active');
    consolePanel.classList.add('active');
    
    updateAccountLabelBadge(acct);
    await populateAccountSelector(token);
    checkAdminStatus();

    connectWebSocket();
  } else {
    // Show login page
    loginPanel.classList.add('active');
    consolePanel.classList.remove('active');
  }
}

// Redirect to Deriv OIDC/OAuth 2.0 PKCE page
loginBtn.addEventListener('click', async () => {
  try {
    loginBtn.innerText = "Connecting...";
    loginBtn.disabled = true;

    const verifier = generateCodeVerifier();
    const state = generateRandomState();

    sessionStorage.setItem('code_verifier', verifier);
    sessionStorage.setItem('oauth_state', state);

    const challenge = await generateCodeChallenge(verifier);
    const redirectUri = window.location.origin + '/';

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: APP_ID,
      redirect_uri: redirectUri,
      scope: 'trade account_manage',
      state: state,
      code_challenge: challenge,
      code_challenge_method: 'S256'
    });

    const authUrl = `https://auth.deriv.com/oauth2/auth?${params.toString()}`;
    addLog("Redirecting to Deriv Authorization Center...", "info");
    window.location.href = authUrl;
  } catch (err) {
    console.error("Failed to start login redirect:", err);
    alert("Error initializing OAuth: " + err.message);
    loginBtn.innerText = "Log In with Deriv";
    loginBtn.disabled = false;
  }
});

// Manual token connection fields (removed from index.html)
const connectTokenBtn = null;
const tokenInput = null;

logoutBtn.addEventListener('click', logout);

function logout() {
  localStorage.removeItem('deriv_token');
  localStorage.removeItem('deriv_acct');
  localStorage.removeItem('deriv_app_id');
  isTrading = false;
  isAuthorized = false;
  if (socket) {
    socket.close();
  }
  
  checkAuth();
}

// ════════════════════════════════════════════
//             WEBSOCKET CLIENT
// ════════════════════════════════════════════

function connectWebSocket(isLoginAttempt = false) {
  const token = localStorage.getItem('deriv_token');
  const acct = localStorage.getItem('deriv_acct');
  const appId = localStorage.getItem('deriv_app_id');

  // Determine if we are using the new Options API flow
  // We use the new Options API flow if the token starts with 'pat_' OR we have an alphanumeric app_id stored.
  const isNewApiFlow = (token && token.startsWith('pat_')) || (appId && /^[a-zA-Z0-9]+$/.test(appId) && !/^\d+$/.test(appId));

  if (isNewApiFlow) {
    addLog("Connecting using new Options API flow...", "info");
    
    // Disable connectTokenBtn while connecting via manual token
    if (isLoginAttempt && connectTokenBtn) {
      connectTokenBtn.innerText = "Connecting...";
      connectTokenBtn.disabled = true;
    }

    const otpAppId = appId || (token.startsWith('pat_') ? '33xF1iFStFhUTRFup3ZQF' : APP_ID);
    addLog(`Requesting OTP for account ${acct} using App ID: ${otpAppId}...`, "info");
    
    fetch(`https://api.derivws.com/trading/v1/options/accounts/${acct}/otp`, {
      method: 'POST',
      headers: {
        'Deriv-App-ID': otpAppId,
        'Authorization': `Bearer ${token}`
      }
    })
    .then(async (otpRes) => {
      if (!otpRes.ok) {
        const errText = await otpRes.text();
        throw new Error(`OTP request failed: ${otpRes.status} - ${errText}`);
      }
      return otpRes.json();
    })
    .then((otpData) => {
      if (!otpData.data || !otpData.data.url) {
        throw new Error("Invalid OTP response structure.");
      }

      const wsUrl = otpData.data.url;
      addLog("OTP retrieved. Connecting to Options WebSocket...", "info");

      socket = new WebSocket(wsUrl);
      socket.isNewWSApi = true;

      socket.onopen = () => {
        addLog("Connected to Options WebSocket!", "success");
        isAuthorized = true;
        
        // Fetch balance and subscribe to ticks
        socket.send(JSON.stringify({
          balance: 1,
          subscribe: 1
        }));

        // Subscribe to V75 ticks
        socket.send(JSON.stringify({
          ticks: 'R_75',
          subscribe: 1
        }));

        if (isLoginAttempt && connectTokenBtn) {
          connectTokenBtn.innerText = "Connected";
          connectTokenBtn.disabled = false;
        }
      };

      socket.onclose = () => {
        addLog("Options WebSocket disconnected.", "warn");
        isAuthorized = false;
        if (isTrading) {
          stopTrading("Disconnect event detected.");
        }
      };

      socket.onerror = (error) => {
        console.error("Options WebSocket Error:", error);
        addLog("Options WebSocket connection error.", "error");
        if (isLoginAttempt && connectTokenBtn) {
          connectTokenBtn.innerText = "Connect with Token";
          connectTokenBtn.disabled = false;
        }
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data, isLoginAttempt);
      };
    })
    .catch((err) => {
      addLog(`Failed to connect using Options API: ${err.message}`, "error");
      if (isLoginAttempt && connectTokenBtn) {
        connectTokenBtn.innerText = "Connect with Token";
        connectTokenBtn.disabled = false;
      }
      logout();
    });
  } else {
    // Legacy flow
    addLog("Connecting to legacy Deriv WebSocket server...", "info");
    const wsAppId = /^\d+$/.test(APP_ID) ? APP_ID : '61247';
    const primaryUrl = `wss://ws.derivws.com/websockets/v3?app_id=${wsAppId}`;
    let primaryFailed = false;

    function attemptConnection(url) {
      socket = new WebSocket(url);
      socket.isNewWSApi = false;

      socket.onopen = () => {
        addLog("Socket connected. Authorizing...", "info");
        socket.send(JSON.stringify({ authorize: token }));
      };

      socket.onclose = () => {
        if (!primaryFailed && url === primaryUrl) return;
        addLog("WebSocket disconnected.", "warn");
        isAuthorized = false;
        if (isTrading) {
          stopTrading("Disconnect event detected.");
        }
      };

      socket.onerror = (error) => {
        console.error(`WS Connection Error on ${url}:`, error);
        if (!primaryFailed && url === primaryUrl) {
          primaryFailed = true;
          addLog("Primary server connection failed. Retrying legacy server...", "warn");
          const fallbackUrl = `wss://ws.binaryws.com/websockets/v3?app_id=${wsAppId}`;
          attemptConnection(fallbackUrl);
        } else {
          addLog("Network connection error encountered.", "error");
          if (isLoginAttempt) {
            alert("Failed to connect to Deriv WebSocket server. Please check your network or try again.");
            if (connectTokenBtn) {
              connectTokenBtn.innerText = "Connect with Token";
              connectTokenBtn.disabled = false;
            }
          }
        }
      };

      socket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleMessage(data, isLoginAttempt);
      };
    }

    attemptConnection(primaryUrl);
  }
}

// ════════════════════════════════════════════
//             INCOMING MESSAGES
// ════════════════════════════════════════════

async function handleMessage(data, isLoginAttempt = false) {
  const msgType = data.msg_type;

  if (msgType === 'authorize') {
    if (data.error) {
      addLog(`Authorization failed: ${data.error.message}`, "error");
      if (isLoginAttempt) {
        alert(`Failed to authorize: ${data.error.message}`);
        if (connectTokenBtn) {
          connectTokenBtn.innerText = "Connect with Token";
          connectTokenBtn.disabled = false;
        }
      }
      logout();
    } else {
      const acct = data.authorize.loginid;
      
      // Check if account is in the white-list (via Supabase or local fallback)
      const isApproved = await isAccountApproved(acct);

      if (!isApproved) {
        alert(`⚠️ ACCESS DENIED\nYour account (${acct}) is not white-listed.\n\nPlease contact the admin to activate access.`);
        if (isLoginAttempt && connectTokenBtn) {
          connectTokenBtn.innerText = "Connect with Token";
          connectTokenBtn.disabled = false;
        }
        logout();
        return;
      }

      // Successfully authorized & whitelisted
      localStorage.setItem('deriv_acct', acct);
      isAuthorized = true;
      addLog("Successfully Authorized!", "success");
      
      // Display trading console
      loginPanel.classList.remove('active');
      consolePanel.classList.add('active');
      
      updateAccountLabelBadge(acct);
      const token = localStorage.getItem('deriv_token');
      await populateAccountSelector(token);
      checkAdminStatus();
      
      balanceText.innerText = `$${parseFloat(balance).toFixed(2)}`;
      
      // Auto-recalculate recommended settings if not customized
      if (typeof applyPreset === 'function' && currentPreset !== 'custom') {
        applyPreset(currentPreset);
      }
      
      // Subscribe to balance updates
      socket.send(JSON.stringify({
        balance: 1,
        subscribe: 1
      }));

      // Subscribe to V75 ticks
      socket.send(JSON.stringify({
        ticks: 'R_75',
        subscribe: 1
      }));
    }
  }


  else if (msgType === 'balance') {
    if (!data.error && data.balance) {
      balanceText.innerText = `$${parseFloat(data.balance.balance).toFixed(2)}`;
      
      // Auto-recalculate recommended settings if not customized
      if (typeof applyPreset === 'function' && currentPreset !== 'custom') {
        applyPreset(currentPreset);
      }
    }
  }

  else if (msgType === 'tick') {
    if (!data.error && data.tick) {
      processTick(data.tick);
    }
  }

  else if (msgType === 'proposal') {
    if (data.error) {
      addLog(`Proposal failed: ${data.error.message}`, "error");
      sendPushNotification("❌ Proposal Failed", `Error: ${data.error.message}`);
      activePurchaseProposal = null;
      currentProposalId = null;
      if (isTrading) {
        statusText.innerText = "Bot is Active";
        statusIndicator.className = "status-bar status-running";
      }
    } else if (data.proposal) {
      const echoReq = data.echo_req || (data.proposal && data.proposal.echo_req);
      const contractType = echoReq ? echoReq.contract_type : null;
      if (isTrading && contractType && activePurchaseProposal === contractType) {
        currentProposalId = data.proposal.id;
        buyContract(currentProposalId);
      } else {
        console.warn("Proposal response received, but mismatch or missing echo_req", data);
        addLog("Proposal error: mismatch or missing echo request.", "error");
        activePurchaseProposal = null;
        currentProposalId = null;
        if (isTrading) {
          statusText.innerText = "Bot is Active";
          statusIndicator.className = "status-bar status-running";
        }
      }
    }
  }

  else if (msgType === 'buy') {
    if (data.error) {
      addLog(`Failed to place order: ${data.error.message}`, "error");
      sendPushNotification("❌ Order Failed", `Error: ${data.error.message}`);
      activePurchaseProposal = null;
      currentProposalId = null;
      if (isTrading) {
        statusText.innerText = "Bot is Active";
        statusIndicator.className = "status-bar status-running";
      }
    } else {
      currentContractId = data.buy.contract_id;
      addLog(`Order placed successfully. ID: ${currentContractId}`, "info");
      sendPushNotification("📈 Trade Placed", `${activePurchaseProposal === 'CALL' ? 'RISE 🟢' : 'FALL 🔴'} order executed with stake $${currentStake.toFixed(2)}.`);
      
      // Subscribe to this specific contract's updates to check outcome
      socket.send(JSON.stringify({
        proposal_open_contract: 1,
        contract_id: currentContractId,
        subscribe: 1
      }));
    }
  }

  else if (msgType === 'proposal_open_contract') {
    if (data.error) {
      addLog(`Contract tracking failed: ${data.error.message}`, "error");
      activePurchaseProposal = null;
      currentProposalId = null;
      currentContractId = null;
      currentSubscriptionId = null;
      if (isTrading) {
        statusText.innerText = "Bot is Active";
        statusIndicator.className = "status-bar status-running";
      }
    } else if (data.proposal_open_contract) {
      const contract = data.proposal_open_contract;
      
      // Store subscription ID on the first message
      if (data.subscription && data.subscription.id) {
        currentSubscriptionId = data.subscription.id;
      }
      
      // Check if trade is complete (only when status is no longer 'open')
      if (contract.status !== 'open') {
        // Unsubscribe using forget request
        if (currentSubscriptionId) {
          socket.send(JSON.stringify({
            forget: currentSubscriptionId
          }));
          currentSubscriptionId = null;
        }

        handleTradeOutcome(contract);
      }
    }
  }
}

// ════════════════════════════════════════════
//           TICK PROCESSOR & STRATEGY
// ════════════════════════════════════════════

function calculateSMA(period) {
  if (ticksHistory.length < period) return null;
  const slice = ticksHistory.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateRSI(period) {
  if (ticksHistory.length < period + 1) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = ticksHistory.length - period - 1; i < ticksHistory.length - 1; i++) {
    const diff = ticksHistory[i+1] - ticksHistory[i];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }
  
  const avgGain = gains / period;
  const avgLoss = losses / period;
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

function processTick(tick) {
  const price = parseFloat(tick.quote);
  livePrice.innerText = price.toFixed(4);

  // Determine direction arrow & color
  let direction = "";
  if (ticksHistory.length > 0) {
    const prevPrice = ticksHistory[ticksHistory.length - 1];
    if (price > prevPrice) {
      direction = "▲";
      livePrice.className = "tick-price up";
      tickDirection.innerText = "▲";
      tickDirection.className = "tick-arrow profit-won";
    } else if (price < prevPrice) {
      direction = "▼";
      livePrice.className = "tick-price down";
      tickDirection.innerText = "▼";
      tickDirection.className = "tick-arrow profit-lost";
    }
  }

  // Keep a record of the last 50 prices to analyze patterns and calculate moving averages
  ticksHistory.push(price);
  if (ticksHistory.length > 50) {
    ticksHistory.shift();
  }

  // Calculate moving averages for trend filtering
  const sma10 = calculateSMA(10);
  const sma20 = calculateSMA(20);
  const rsi14 = calculateRSI(14);
  
  let trendStr = "Analyzing...";
  let trendColor = "var(--text-muted)";
  
  if (sma10 && sma20) {
    if (sma10 > sma20) {
      trendStr = "Bullish 📈";
      trendColor = "var(--color-success)";
    } else if (sma10 < sma20) {
      trendStr = "Bearish 📉";
      trendColor = "var(--color-danger)";
    } else {
      trendStr = "Neutral ➡️";
      trendColor = "var(--text-muted)";
    }
  }
  
  if (rsi14 !== null) {
    let rsiCondition = "";
    if (rsi14 < 40) {
      rsiCondition = " (Oversold 🟢)";
    } else if (rsi14 > 60) {
      rsiCondition = " (Overbought 🔴)";
    }
    trendStr += ` | RSI: ${rsi14.toFixed(1)}${rsiCondition}`;
  }
  
  if (trendLabel) {
    trendLabel.innerText = `Trend: ${trendStr}`;
    trendLabel.style.color = trendColor;
  }

  // Execute strategy if trading is active and not waiting on a trade
  if (isTrading && activePurchaseProposal === null && currentContractId === null) {
    evaluateStrategyPattern();
  }
}

function evaluateStrategyPattern() {
  if (ticksHistory.length < 20) return; // Need at least 20 ticks for SMA-20

  const sma10 = calculateSMA(10);
  const sma20 = calculateSMA(20);
  const rsi14 = calculateRSI(14);
  if (!sma10 || !sma20 || rsi14 === null) return;

  const len = ticksHistory.length;
  const t0 = ticksHistory[len - 4];
  const t1 = ticksHistory[len - 3];
  const t2 = ticksHistory[len - 2];
  const t3 = ticksHistory[len - 1];

  const trendIsBullish = sma10 > sma20;
  const trendIsBearish = sma10 < sma20;

  // 1. Trend-Following Bullish Pullback: Trend is Bullish, RSI is oversold (< 40), last 3 ticks were consecutive drops -> Buy Rise (CALL)
  if (trendIsBullish && rsi14 < 40 && t1 < t0 && t2 < t1 && t3 < t2) {
    addLog(`Trend: Bullish | RSI: ${rsi14.toFixed(1)} (Oversold) | Pullback detected. Buying RISE...`, "info");
    proposeTrade("CALL");
  }
  // 2. Trend-Following Bearish Pullback: Trend is Bearish, RSI is overbought (> 60), last 3 consecutive rises -> Buy Fall (PUT)
  else if (trendIsBearish && rsi14 > 60 && t1 > t0 && t2 > t1 && t3 > t2) {
    addLog(`Trend: Bearish | RSI: ${rsi14.toFixed(1)} (Overbought) | Pullback detected. Buying FALL...`, "info");
    proposeTrade("PUT");
  }
}

// ════════════════════════════════════════════
//             TRADING ACTIONS
// ════════════════════════════════════════════

function proposeTrade(type) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  activePurchaseProposal = type;
  statusText.innerText = "Proposing Order...";
  statusIndicator.className = "status-bar status-running";

  const req = {
    proposal: 1,
    amount: currentStake,
    basis: "stake",
    contract_type: type,
    currency: "USD",
    duration: 5,
    duration_unit: "t"
  };

  if (socket.isNewWSApi) {
    req.underlying_symbol = "R_75";
  } else {
    req.symbol = "R_75";
  }

  // Request proposal
  socket.send(JSON.stringify(req));
}

function buyContract(proposalId) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  statusText.innerText = "Executing Order...";
  socket.send(JSON.stringify({
    buy: proposalId,
    price: currentStake
  }));
}

function handleTradeOutcome(contract) {
  const status = contract.status; // 'won' or 'lost'
  const profit = parseFloat(contract.profit);
  const contractType = contract.contract_type || activePurchaseProposal || "Unknown";
  
  sessionProfit += profit;
  updateProfitDisplay();

  const result = status === 'won' ? 'win' : 'loss';
  const displayType = contractType === 'CALL' ? 'RISE 🟢' : (contractType === 'PUT' ? 'FALL 🔴' : contractType);
  recordTrade(displayType, contract.buy_price || currentStake, profit, result);

  if (status === 'won') {
    addLog(`🎉 WIN! Profit: +$${profit.toFixed(2)}`, "success");
    sendPushNotification("🎉 Trade WON!", `Profit: +$${profit.toFixed(2)} | Session Profit: ${sessionProfit >= 0 ? '+' : ''}$${sessionProfit.toFixed(2)}`);
    
    // Reset martingale steps
    currentStake = initialStake;
    currentMartingaleStep = 0;
  } else {
    addLog(`🚨 LOSS! Loss: -$${Math.abs(profit).toFixed(2)}`, "error");
    
    // Martingale management
    currentMartingaleStep++;
    if (currentMartingaleStep >= maxMartingaleSteps) {
      addLog(`⚠️ Max Martingale Steps (${maxMartingaleSteps}) reached. Resetting stake.`, "warn");
      sendPushNotification("🚨 Trade LOST", `Loss: -$${Math.abs(profit).toFixed(2)} (Max steps hit, stake reset) | Session: $${sessionProfit.toFixed(2)}`);
      currentStake = initialStake;
      currentMartingaleStep = 0;
    } else {
      currentStake = currentStake * parseFloat(martingaleStepsInput.value === '1' ? 1.0 : 2.0); // Multiply by 2
      addLog(`🔄 Martingale Multiplier applied. Next stake: $${currentStake.toFixed(2)}`, "warn");
      sendPushNotification("🚨 Trade LOST", `Loss: -$${Math.abs(profit).toFixed(2)} (Martingale Step ${currentMartingaleStep} next: $${currentStake.toFixed(2)}) | Session: $${sessionProfit.toFixed(2)}`);
    }
  }

  // Clear trade lock state
  activePurchaseProposal = null;
  currentProposalId = null;
  currentContractId = null;

  // Check safety targets
  if (sessionProfit >= targetProfit) {
    addLog(`🏆 TARGET PROFIT REACHED! Session Profit: $${sessionProfit.toFixed(2)}`, "success");
    sendPushNotification("🏆 Target Profit Reached!", `Session Profit: +$${sessionProfit.toFixed(2)}`);
    stopTrading("Target Profit Reached");
    alert(`🏆 Target Profit ($${targetProfit.toFixed(2)}) reached!\nTrading halted to secure profits.`);
  } else if (sessionProfit <= -stopLoss) {
    addLog(`❌ STOP LOSS HIT! Session Loss: -$${Math.abs(sessionProfit).toFixed(2)}`, "error");
    sendPushNotification("❌ Stop Loss Hit!", `Session Loss: -$${Math.abs(sessionProfit).toFixed(2)}`);
    stopTrading("Stop Loss Hit");
    alert(`❌ Stop Loss (-$${stopLoss.toFixed(2)}) hit!\nTrading halted to protect your account.`);
  } else {
    if (isTrading) {
      statusText.innerText = "Bot is Active";
      statusIndicator.className = "status-bar status-running";
    }
  }
}

// ════════════════════════════════════════════
//             CONTROLS & DOM EVENTS
// ════════════════════════════════════════════

startBotBtn.addEventListener('click', () => {
  if (!isAuthorized) {
    addLog("Error: Account not authorized.", "error");
    return;
  }

  // Parse Inputs
  initialStake = parseFloat(stakeInput.value);
  currentStake = initialStake;
  targetProfit = parseFloat(targetProfitInput.value);
  stopLoss = parseFloat(stopLossInput.value);
  maxMartingaleSteps = parseInt(martingaleStepsInput.value);
  currentMartingaleStep = 0;
  sessionProfit = 0.0;

  updateProfitDisplay();

  // Request notifications permission if enabled
  const isNotificationsEnabled = notificationCheckbox ? notificationCheckbox.checked : true;
  if (isNotificationsEnabled) {
    requestNotificationPermission();
  }

  // Disable Inputs
  toggleInputs(true);

  // Start Trading
  isTrading = true;
  startBotBtn.classList.add('hidden');
  stopBotBtn.classList.remove('hidden');
  
  statusText.innerText = "Bot is Active";
  statusIndicator.className = "status-bar status-running";
  
  addLog("🤖 V75 Scalper Bot Started.", "success");
  addLog(`Params: Stake=$${initialStake.toFixed(2)}, Target=$${targetProfit.toFixed(2)}, Stop=$${stopLoss.toFixed(2)}, MaxSteps=${maxMartingaleSteps}`, "info");
  
  requestWakeLock();
  startKeepAlive();
  
  sendPushNotification("🤖 Bot Started", `Monitoring V75 tick patterns...\nStake: $${initialStake.toFixed(2)} | Target: $${targetProfit.toFixed(2)}`);
});

stopBotBtn.addEventListener('click', () => {
  stopTrading("Stopped by user");
});

function stopTrading(reason) {
  const wasTrading = isTrading;
  isTrading = false;
  activePurchaseProposal = null;
  currentProposalId = null;
  currentContractId = null;

  releaseWakeLock();
  stopKeepAlive();

  startBotBtn.classList.remove('hidden');
  stopBotBtn.classList.add('hidden');
  
  statusText.innerText = "Bot is Idle";
  statusIndicator.className = "status-bar status-idle";
  
  toggleInputs(false);
  addLog(`🤖 Bot Halted. Reason: ${reason}`, "warn");

  if (wasTrading) {
    sendPushNotification("🤖 Bot Halted", `Reason: ${reason}`);
  }
}

function toggleInputs(disabled) {
  stakeInput.disabled = disabled;
  targetProfitInput.disabled = disabled;
  stopLossInput.disabled = disabled;
  martingaleStepsInput.disabled = disabled;
}

// ════════════════════════════════════════════
//             WAKE LOCK HELPER FUNCTIONS
// ════════════════════════════════════════════

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      addLog("Screen Wake Lock active (prevents screen from sleeping).", "info");
    }
  } catch (err) {
    console.warn(`Could not obtain Screen Wake Lock: ${err.message}`);
  }
}

function releaseWakeLock() {
  if (wakeLock !== null) {
    wakeLock.release()
      .then(() => {
        wakeLock = null;
        addLog("Screen Wake Lock released.", "info");
      })
      .catch(err => {
        console.warn(`Error releasing Wake Lock: ${err.message}`);
      });
  }
}

// Handle visibility change to re-request Wake Lock if visible or send push notification when backgrounded
document.addEventListener('visibilitychange', async () => {
  if (isTrading) {
    if (document.visibilityState === 'visible') {
      await requestWakeLock();
    } else if (document.visibilityState === 'hidden') {
      sendPushNotification("⚡ Running in Background", "Amphy Bot is actively monitoring V75 tick patterns and trading in the background.");
    }
  }
});

// ════════════════════════════════════════════
//         BACKGROUND KEEP ALIVE FUNCTIONS
// ════════════════════════════════════════════

function startKeepAlive() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      console.warn("AudioContext is not supported by your browser.");
      return;
    }
    
    if (!keepAliveAudioContext) {
      keepAliveAudioContext = new AudioContextClass();
    }
    
    // Resume if suspended (browser autoplay restriction)
    if (keepAliveAudioContext.state === 'suspended') {
      keepAliveAudioContext.resume();
    }
    
    // Check if oscillator is already running
    if (keepAliveOscillator) return;

    // Create an oscillator node (makes sound)
    keepAliveOscillator = keepAliveAudioContext.createOscillator();
    keepAliveOscillator.type = 'sine';
    keepAliveOscillator.frequency.value = 440; // Frequency doesn't matter (silent)

    // Create gain node (controls volume)
    const gainNode = keepAliveAudioContext.createGain();
    gainNode.gain.value = 0.000001; // Virtually silent to the speaker

    // Connect oscillator -> gain -> destination
    keepAliveOscillator.connect(gainNode);
    gainNode.connect(keepAliveAudioContext.destination);

    // Start playing
    keepAliveOscillator.start();
    addLog("Background keep-alive active (silent Web Audio).", "info");
  } catch (err) {
    console.warn("Could not start background keep-alive:", err);
  }
}

function stopKeepAlive() {
  if (keepAliveOscillator) {
    try {
      keepAliveOscillator.stop();
      keepAliveOscillator.disconnect();
    } catch (e) {}
    keepAliveOscillator = null;
  }
  if (keepAliveAudioContext && keepAliveAudioContext.state !== 'closed') {
    try {
      keepAliveAudioContext.suspend();
    } catch (e) {}
  }
}

// ════════════════════════════════════════════
//                LOGGING & UTILS
// ════════════════════════════════════════════

function addLog(text, type = "info") {
  const row = document.createElement('div');
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour12: false });
  row.className = `log-row ${type}`;
  row.innerText = `[${timeStr}] ${text}`;
  
  logConsole.appendChild(row);
  logConsole.scrollTop = logConsole.scrollHeight;
}

function updateProfitDisplay() {
  profitText.innerText = `${sessionProfit >= 0 ? '+' : '-'}$${Math.abs(sessionProfit).toFixed(2)}`;
  if (sessionProfit > 0) {
    profitText.className = "metric-value profit-won";
  } else if (sessionProfit < 0) {
    profitText.className = "metric-value profit-lost";
  } else {
    profitText.className = "metric-value profit-neutral";
  }
}

// ════════════════════════════════════════════
//             PWA INSTALLATION LOGIC
// ════════════════════════════════════════════
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome 67 and earlier from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Update UI notify the user they can install the PWA
  if (pwaInstallBanner) {
    pwaInstallBanner.classList.remove('hidden');
  }
});

if (pwaInstallBtn) {
  pwaInstallBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    // We've used the prompt, so we can't use it again
    deferredPrompt = null;
    // Hide the install banner
    if (pwaInstallBanner) {
      pwaInstallBanner.classList.add('hidden');
    }
  });
}

window.addEventListener('appinstalled', (evt) => {
  console.log('Amphy V75 Scalper Bot installed successfully!');
  if (pwaInstallBanner) {
    pwaInstallBanner.classList.add('hidden');
  }
});

// ════════════════════════════════════════════
//             LIVE STRATEGY SIMULATOR
// ════════════════════════════════════════════
let simPrice = 37286.64;
let simHistory = [];
let isSimulatingTrade = false;
let simMartingaleStep = 0;
let simInitialStake = 0.50;
let simCurrentStake = 0.50;

function addSimLog(text, type = "info") {
  if (!demoTerminal) return;
  
  const row = document.createElement('div');
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour12: false });
  row.className = `demo-log ${type}`;
  row.innerText = `[${timeStr}] ${text}`;
  
  demoTerminal.appendChild(row);
  demoTerminal.scrollTop = demoTerminal.scrollHeight;

  // Limit terminal size
  while (demoTerminal.children.length > 5) {
    demoTerminal.removeChild(demoTerminal.firstChild);
  }
}

function runSimulator() {
  if (!demoPrice || !loginPanel.classList.contains('active')) return;

  // Simulate tick fluctuation
  const change = (Math.random() - 0.5) * 5.0; // random change up to 2.5 points
  simPrice += change;
  demoPrice.innerText = simPrice.toFixed(4);

  // Direction arrows
  if (change > 0) {
    demoPrice.className = "demo-price up";
    demoDirection.innerText = "▲";
    demoDirection.className = "demo-arrow up";
    simHistory.push(1); // 1 = up
  } else {
    demoPrice.className = "demo-price down";
    demoDirection.innerText = "▼";
    demoDirection.className = "demo-arrow down";
    simHistory.push(-1); // -1 = down
  }

  if (simHistory.length > 4) {
    simHistory.shift();
  }

  // If not currently simulating a trade, scan for patterns
  if (!isSimulatingTrade && simHistory.length >= 3) {
    const last3 = simHistory.slice(-3);
    const allUp = last3.every(v => v === 1);
    const allDown = last3.every(v => v === -1);

    if (allDown) {
      isSimulatingTrade = true;
      addSimLog("Pattern: 3 consecutive drops. Buying RISE 🟢...", "info");
      executeSimulatedTrade("CALL");
    } else if (allUp) {
      isSimulatingTrade = true;
      addSimLog("Pattern: 3 consecutive rises. Buying FALL 🔴...", "info");
      executeSimulatedTrade("PUT");
    }
  }
}

function executeSimulatedTrade(type) {
  setTimeout(() => {
    addSimLog(`Executed ${type} order with stake $${simCurrentStake.toFixed(2)}`, "info");
    
    // Simulate trade outcome (93.6% win rate sequence simulation)
    setTimeout(() => {
      const isWin = Math.random() < 0.65; // individual trade has 65% base win rate

      if (isWin) {
        const profit = simCurrentStake * 0.94;
        addSimLog(`🎉 WIN! Payout: +$${profit.toFixed(2)}`, "success");
        simCurrentStake = simInitialStake;
        simMartingaleStep = 0;
        isSimulatingTrade = false;
        simHistory = []; // reset history
      } else {
        addSimLog(`🚨 LOSS! Loss: -$${simCurrentStake.toFixed(2)}`, "error");
        simMartingaleStep++;
        if (simMartingaleStep >= 3) {
          addSimLog(`⚠️ Max steps hit. Resetting stake to $${simInitialStake.toFixed(2)}`, "warn");
          simCurrentStake = simInitialStake;
          simMartingaleStep = 0;
          isSimulatingTrade = false;
          simHistory = [];
        } else {
          simCurrentStake = simCurrentStake * 2.0;
          addSimLog(`🔄 Martingale Multiplier applied. Next stake: $${simCurrentStake.toFixed(2)}`, "warn");
          // Re-evaluate on next ticks
          isSimulatingTrade = false;
        }
      }
    }, 1500);
  }, 1000);
}

// Start simulator loop (runs every 1.5 seconds)
setInterval(runSimulator, 1500);

// ════════════════════════════════════════════
//             CONSOLE USER GUIDE TOGGLE
// ════════════════════════════════════════════
if (toggleGuideBtn && settingsGuide) {
  toggleGuideBtn.addEventListener('click', () => {
    const isHidden = settingsGuide.classList.contains('hidden');
    if (isHidden) {
      settingsGuide.classList.remove('hidden');
      toggleGuideBtn.innerText = "📖 Hide Settings Guide";
    } else {
      settingsGuide.classList.add('hidden');
      toggleGuideBtn.innerText = "📖 Show Settings Guide";
    }
  });
}

// ════════════════════════════════════════════
//         PERFORMANCE STATS & HISTORY
// ════════════════════════════════════════════

function loadStats() {
  try {
    const stored = localStorage.getItem('v75_bot_stats');
    if (stored) {
      stats = JSON.parse(stored);
      if (stats.totalProfit === undefined) {
        stats.totalProfit = stats.history.reduce((sum, t) => sum + (parseFloat(t.profit) || 0), 0);
      }
      updateStatsUI();
    }
  } catch (e) {
    console.warn("Failed to load stats:", e);
  }
}

function saveStats() {
  try {
    localStorage.setItem('v75_bot_stats', JSON.stringify(stats));
  } catch (e) {
    console.warn("Failed to save stats:", e);
  }
}

function updateStatsUI() {
  if (!statsWins) return;
  statsWins.innerText = stats.wins;
  statsLosses.innerText = stats.losses;
  statsTotal.innerText = stats.total;
  
  const rate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : "0.0";
  statsWinRate.innerText = `${rate}%`;
  
  // Populate table
  if (!tradeHistoryBody) return;
  if (stats.history.length === 0) {
    tradeHistoryBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No trades recorded.</td></tr>`;
    return;
  }
  
  tradeHistoryBody.innerHTML = stats.history.map(t => {
    const isWin = t.result === 'win';
    const resultClass = isWin ? 'win-color' : 'loss-color';
    const stakeVal = parseFloat(t.stake) || 0;
    const profitVal = parseFloat(t.profit) || 0;
    const profitPrefix = profitVal >= 0 ? '+' : '';
    return `
      <tr>
        <td>${t.time}</td>
        <td>${t.type}</td>
        <td>$${stakeVal.toFixed(2)}</td>
        <td class="${resultClass}">${profitPrefix}$${profitVal.toFixed(2)}</td>
        <td class="${resultClass}" style="font-weight: 700;">${t.result.toUpperCase()}</td>
      </tr>
    `;
  }).join('');
}

function recordTrade(type, stake, profit, result) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  const stakeNum = parseFloat(stake) || parseFloat(currentStake) || 0;
  const profitNum = parseFloat(profit) || 0;

  if (result === 'win') {
    stats.wins++;
  } else {
    stats.losses++;
  }
  stats.total++;
  stats.totalProfit += profitNum;
  
  stats.history.unshift({
    time: timeStr,
    type: type,
    stake: stakeNum,
    profit: profitNum,
    result: result
  });
  
  // Limit history to 50 entries
  if (stats.history.length > 50) {
    stats.history.pop();
  }
  
  saveStats();
  updateStatsUI();
}

// Bind event listeners for statistics panel
if (toggleHistoryBtn && tradeHistorySection) {
  toggleHistoryBtn.addEventListener('click', () => {
    const isHidden = tradeHistorySection.classList.contains('hidden');
    if (isHidden) {
      tradeHistorySection.classList.remove('hidden');
      toggleHistoryBtn.innerText = "📋 Hide Trade History & Export Report";
    } else {
      tradeHistorySection.classList.add('hidden');
      toggleHistoryBtn.innerText = "📋 View Trade History & Export Report";
    }
  });
}

if (resetStatsBtn) {
  resetStatsBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to reset all performance statistics? This cannot be undone.")) {
      stats = {
        wins: 0,
        losses: 0,
        total: 0,
        totalProfit: 0.0,
        history: []
      };
      saveStats();
      updateStatsUI();
      addLog("Performance statistics reset.", "info");
    }
  });
}

if (exportReportBtn) {
  exportReportBtn.addEventListener('click', () => {
    const rate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : "0.0";
    const selectedTemplate = promoTemplateSelect ? promoTemplateSelect.value : 'raw';
    
    const partnerLink = window.location.origin;
    
    let reportText = "";
    
    if (selectedTemplate === 'social') {
      reportText = 
`🤖 Automated V75 Scalper Bot Update

Chart setup doing the work while I go about my day. Here are the live stats from my current session:

📈 Total Trades: ${stats.total}
🟢 Wins: ${stats.wins} | 🔴 Losses: ${stats.losses}
🎯 Win Rate: ${rate}%
💰 Session Profit: $${sessionProfit.toFixed(2)}
💵 Lifetime Profit: $${(stats.totalProfit || 0).toFixed(2)}

Set the parameters, turn on background running, and let it scan tick trends.

👉 Try the bot for free and start auto-trading here:
${partnerLink}`;
    } else if (selectedTemplate === 'short') {
      reportText = 
`⚡ V75 Scalping Session Complete! ⚡

📈 Trades: ${stats.total}
🎯 Win Rate: ${rate}%
💰 Today's Profit: $${sessionProfit.toFixed(2)}

100% automated trend scalping. Screen Wake Lock and silent background keep-alive active.

👉 Get free bot access here:
${partnerLink}`;
    } else {
      // Default: Raw Stats
      reportText = 
`🔥 AMPHY V75 SCALPER BOT PERFORMANCE REPORT 🔥
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Total Trades: ${stats.total}
🟢 Wins: ${stats.wins}
🔴 Losses: ${stats.losses}
🎯 Win Rate: ${rate}%
💰 Net Session Profit: $${sessionProfit.toFixed(2)}
💵 Lifetime Net Profit: $${(stats.totalProfit || 0).toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Get free bot access & start trading:
👉 ${partnerLink}`;
    }
    
    navigator.clipboard.writeText(reportText).then(() => {
      const originalText = exportReportBtn.innerHTML;
      exportReportBtn.innerText = "Copied! ✅";
      setTimeout(() => {
        exportReportBtn.innerHTML = originalText;
      }, 2000);
    }).catch(err => {
      console.error("Failed to copy report:", err);
    });
  });
}


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
let currentAuthorizedAccount = null;
let isTrading = false;
let candlesHistory = []; // stores compiled candles
let candleGranularity = 300; // default 5 minutes (300s)

// ── Cached indicator arrays (recalculated only on candle close, not every tick) ──
let _cachedEma9 = [];   // EMA-9  values aligned to candlesHistory
let _cachedEma21 = [];  // EMA-21 values aligned to candlesHistory
let _cachedEma200 = []; // EMA-200 values aligned to candlesHistory
let _cachedRsi14 = [];  // RSI-14 values aligned to candlesHistory
let _cachedAdx14 = [];  // ADX-14 values aligned to candlesHistory (Layer 1: regime filter)
let _chartDrawPending = false; // rAF gate for chart redraws
let lastTickPrice = null;
let chartTradeMarkers = [];
let sessionProfit = 0.0;
let initialStake = 0.50;
let currentStake = 0.50;
let targetProfit = 2.00;
let stopLoss = 5.00;
let maxMartingaleSteps = 2;
let martingaleMultiplier = 2.0;
let currentMartingaleStep = 0;
let lossCooldownTicks = 3; // candles to wait after a loss (1 candle = 1 minute)
let cooldownTicksRemaining = 0;
let useSma50Guard = false; // Removed from UI — kept as false so guard is always off
let lastTradeCandleEpoch = 0;

// Tick Momentum Buffer
let tickPrices = [];
const MIN_TICKS_BEFORE_TRADE = 10;
let tradeInProgress = false;
let tickCooldownRemaining = 0;

// ── Layer 1: ADX Regime Filter ────────────────────────────────────────────────
let adxThreshold = 18; // ADX must be >= this to allow trades (18 = soft trend filter)

// ── Layer 4: Consecutive Loss Guard ──────────────────────────────────────────
let consecutiveLosses = 0;          // resets on any win
let consecutiveLossPauseEnd = 0;    // epoch timestamp — bot pauses until this time
const CONSECUTIVE_LOSS_LIMIT = 3;   // trigger pause after this many consecutive losses
const CONSECUTIVE_LOSS_PAUSE_MIN = 10; // pause duration in minutes

// ── Layer 5: Daily P&L Tracker ────────────────────────────────────────────────
let dailyPnl = 0.0;          // cumulative P&L for today (loaded from localStorage)
let dailyTarget  = 30.00;   // daily profit target - bot auto-stops when reached
let stopLossMode = 'fixed';   // 'fixed' = dollar amount, 'percent' = % of account balance
let stopLossPercent = 5.0;    // % of balance (used when stopLossMode = 'percent')
let accountBalance = 0;       // live balance from Deriv API - used for % stop loss calculation
let dailyStopLoss = 9999.00;  // safe default — real value always read from UI when bot starts   // daily max loss limit — bot stops for the day if exceeded
const DAILY_PNL_KEY = 'v75bot_dailyPnl'; // localStorage key
let useStrictMartingale = true;
let currentProposalId = null;
let currentContractId = null;
let activePurchaseProposal = null;
let wakeLock = null;
let currentSubscriptionId = null;
let keepAliveAudioContext = null;
let keepAliveOscillator = null;
let wsPingIntervalId = null; // WebSocket keepalive pinger (fires every 25s)

// Session Database Analytics Tracking
let activeSessionDbId = null;
let sessionTradedVolume = 0.0;
let sessionWins = 0;
let sessionLosses = 0;
let sessionTradesCount = 0;

// Auto-Reconnect State Variables
let isReconnecting = false;
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
let reconnectTimeoutId = null;

let deviceId = '';
let heartbeatIntervalId = null;
let activeSessionCache = null;

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

// Session Resume Elements
const resumeSessionContainer = document.getElementById('resumeSessionContainer');
const resumeStep = document.getElementById('resumeStep');
const resumeStake = document.getElementById('resumeStake');
const resumeProfit = document.getElementById('resumeProfit');
const resumeBotBtn = document.getElementById('resumeBotBtn');
const discardSessionBtn = document.getElementById('discardSessionBtn');

// Settings Inputs
const stakeInput = document.getElementById('stakeInput');
const targetProfitInput = document.getElementById('targetProfitInput');
const stopLossInput = document.getElementById('stopLossInput');
const martingaleStepsInput = document.getElementById('martingaleStepsInput');
const martingaleMultiplierInput = document.getElementById('martingaleMultiplierInput');

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
const exportCsvBtn = document.getElementById('exportCsvBtn');
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
  deviceId = localStorage.getItem('deriv_bot_device_id');
  if (!deviceId) {
    deviceId = 'dev_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('deriv_bot_device_id', deviceId);
  }

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
    // Perform a full reload to clean the URL query params and restore viewport scale
    window.location.replace(window.location.origin + '/');
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
      
      // Clear session storage
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('code_verifier');

      // Perform a full reload to clean URL and force browser to reset viewport to device width
      window.location.replace(window.location.origin + '/');
      return;
    } catch (err) {
      addLog(`OAuth error: ${err.message}`, "error");
      alert(`OAuth login failed: ${err.message}`);
      
      // Clear session storage
      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('code_verifier');
      
      // Reload on failure too to clean query strings
      window.location.replace(window.location.origin + '/');
      return;
    }
  }

  // Register service worker for PWA support and mobile push notifications
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('Service Worker registered scope:', reg.scope);
      reg.update(); // Force checking server for service worker updates
    }).catch(err => {
      console.error('Service Worker registration failed:', err);
    });
  }

  // Initialize dashboard tab switching event listeners
  const tabButtons = document.querySelectorAll('.console-tab-bar .tab-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      
      // Update buttons
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update panes
      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === `tab-${tabId}`) {
          pane.classList.add('active');
        }
      });
    });
  });

  // Initialize FAQ accordion slide transitions
  const faqQuestions = document.querySelectorAll('.faq-question-btn');
  faqQuestions.forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.faq-item');
      const collapse = item.querySelector('.faq-answer-collapse');
      const isActive = item.classList.contains('active');
      
      // Close other active FAQ items
      document.querySelectorAll('.faq-item.active').forEach(activeItem => {
        if (activeItem !== item) {
          activeItem.classList.remove('active');
          activeItem.querySelector('.faq-answer-collapse').style.maxHeight = null;
        }
      });
      
      // Toggle current item
      if (isActive) {
        item.classList.remove('active');
        collapse.style.maxHeight = null;
      } else {
        item.classList.add('active');
        collapse.style.maxHeight = collapse.scrollHeight + 'px';
      }
    });
  });

  checkAuth();
  loadStats();
  loadDailyPnl();
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
    if (currentAcct && a.account_id.trim().toUpperCase() === currentAcct.trim().toUpperCase()) {
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
    checkActiveSession();

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
  let calculatedSteps = 4;
  let calculatedStop = 5.00;
  let calculatedTarget = 2.00;
  let calculatedCooldown = 15;
  let calculatedSma50 = true;
  let calculatedStrictMartingale = true;
  let feedbackMsg = "";

  if (presetType === 'conservative') {
    calculatedStake = Math.max(0.35, Math.round((balance * 0.01) * 20) / 20); // 1% of balance, rounded to nearest 0.05
    calculatedSteps = 3; // Base + 2 recovery steps = 3 total steps
    calculatedStop = Math.round((calculatedStake * (1 + 2 + 4)) * 100) / 100; // sum of stakes for 3 total steps (Stake * 7)
    calculatedTarget = Math.max(1.00, Math.round((balance * 0.03) * 2) / 2); // 3% of balance target
    calculatedCooldown = 20;
    calculatedSma50 = true;
    calculatedStrictMartingale = true;
    feedbackMsg = `🛡️ Conservative: 1% stake ($${calculatedStake.toFixed(2)}), 2 recovery steps, 20-tick loss cooldown. Low risk. Recommended balance: $15+`;
  } else if (presetType === 'moderate') {
    calculatedStake = Math.max(0.50, Math.round((balance * 0.02) * 20) / 20); // 2% of balance, rounded to nearest 0.05
    if (balance < 25) {
      calculatedStake = 0.50; // Fallback minimum stake
    }
    calculatedSteps = 3; // Enforced Capped Martingale: 3 total steps
    calculatedStop = Math.round((calculatedStake * (1 + 2 + 4)) * 100) / 100; // sum of stakes for 3 total steps (Stake * 7)
    calculatedTarget = Math.max(2.00, Math.round((balance * 0.07) * 2) / 2); // 7% of balance target
    calculatedCooldown = 15;
    calculatedSma50 = true;
    calculatedStrictMartingale = true;
    feedbackMsg = `⚖️ Moderate: 2% stake ($${calculatedStake.toFixed(2)}), 2 recovery steps, 15-tick loss cooldown. Balanced risk. Recommended balance: $25+`;
  } else if (presetType === 'aggressive') {
    calculatedStake = Math.max(0.50, Math.round((balance * 0.04) * 10) / 10); // 4% of balance, rounded to nearest 0.10
    calculatedSteps = 3; // Enforced Capped Martingale: 3 total steps
    calculatedStop = Math.round((calculatedStake * (1 + 2 + 4)) * 100) / 100; // sum of stakes for 3 total steps (Stake * 7)
    calculatedTarget = Math.max(5.00, Math.round((balance * 0.15) * 2) / 2); // 15% of balance target
    calculatedCooldown = 10;
    calculatedSma50 = true;
    calculatedStrictMartingale = true;
    feedbackMsg = `🔥 Aggressive: 4% stake ($${calculatedStake.toFixed(2)}), 2 recovery steps, 10-tick loss cooldown. High yield, high risk. Recommended balance: $50+`;
  }

  // Update inputs
  if (presetType !== 'custom') {
    if (stakeInput) stakeInput.value = calculatedStake.toFixed(2);
    if (targetProfitInput) targetProfitInput.value = calculatedTarget.toFixed(2);
    if (stopLossInput) stopLossInput.value = calculatedStop.toFixed(2);
    if (martingaleStepsInput) martingaleStepsInput.value = calculatedSteps;
    if (martingaleMultiplierInput) martingaleMultiplierInput.value = "2.0";
    // strictMartingale always on
    presetFeedback.innerText = feedbackMsg;
    
    console.log(`Preset Applied: ${presetType}. Stake: ${calculatedStake}, Steps: ${calculatedSteps}, Stop: ${calculatedStop}, Target: ${calculatedTarget}, Cooldown: ${calculatedCooldown}`);
    
    // Refresh the real-time Stop Loss helper text
    updateStopLossSuggestion();
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

// Dynamic Stop Loss Suggestion & Validator function
function updateStopLossSuggestion() {
  const helperEl = document.getElementById('stopLossHelper');
  if (!helperEl) return;

  const stakeInputVal = document.getElementById('stakeInput');
  const martingaleStepsInputVal = document.getElementById('martingaleStepsInput');
  const martingaleMultiplierInputVal = document.getElementById('martingaleMultiplierInput');
  const stopLossInputVal = document.getElementById('stopLossInput');

  if (!stakeInputVal || !martingaleStepsInputVal || !martingaleMultiplierInputVal || !stopLossInputVal) return;

  const stake = parseFloat(stakeInputVal.value) || 0.35;
  const steps = parseInt(martingaleStepsInputVal.value) || 1;
  const multiplier = parseFloat(martingaleMultiplierInputVal.value) || 2.0;
  const currentStopLoss = parseFloat(stopLossInputVal.value) || 0;

  if (stake <= 0 || steps <= 0 || multiplier < 1.0) {
    helperEl.style.display = 'none';
    return;
  }

  // Calculate total cycle cost
  let cycleCost = 0;
  let current = stake;
  for (let i = 0; i < steps; i++) {
    cycleCost += current;
    current = current * multiplier;
  }
  cycleCost = Math.round(cycleCost * 100) / 100;

  helperEl.style.display = 'block';

  if (currentStopLoss < cycleCost) {
    helperEl.style.backgroundColor = 'rgba(239, 68, 68, 0.15)'; // Red background
    helperEl.style.borderColor = 'rgba(239, 68, 68, 0.4)';
    helperEl.innerHTML = `
      <div style="color: #fca5a5; font-weight: 600; display: flex; align-items: center; gap: 4px;">⚠️ Stop Loss Warning</div>
      <div style="color: var(--text-muted); margin-top: 3px;">
        Martingale Cycle Cost: <strong>$${cycleCost.toFixed(2)}</strong> (for ${steps} steps at ${multiplier}x).
        Your Stop Loss (<strong>$${currentStopLoss.toFixed(2)}</strong>) is lower than this cost. The bot will stop trading prematurely on losses.
      </div>
    `;
  } else if (currentStopLoss >= cycleCost * 2) {
    helperEl.style.backgroundColor = 'rgba(245, 158, 11, 0.15)'; // Orange background
    helperEl.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    helperEl.innerHTML = `
      <div style="color: #fde047; font-weight: 600; display: flex; align-items: center; gap: 4px;">⚠️ High Drawdown Risk</div>
      <div style="color: var(--text-muted); margin-top: 3px;">
        Martingale Cycle Cost: <strong>$${cycleCost.toFixed(2)}</strong>.
        Your Stop Loss (<strong>$${currentStopLoss.toFixed(2)}</strong>) allows <strong>${Math.floor(currentStopLoss / cycleCost)} full cycle failures</strong>. You may experience large drawdowns before the bot halts.
      </div>
    `;
  } else {
    helperEl.style.backgroundColor = 'rgba(16, 185, 129, 0.1)'; // Green background
    helperEl.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    helperEl.innerHTML = `
      <div style="color: #34d399; font-weight: 600; display: flex; align-items: center; gap: 4px;">✅ Aligned Risk Settings</div>
      <div style="color: var(--text-muted); margin-top: 3px;">
        Martingale Cycle Cost: <strong>$${cycleCost.toFixed(2)}</strong>.
        Stop Loss: <strong>$${currentStopLoss.toFixed(2)}</strong>. Perfectly sized to halt the bot after exactly 1 full cycle failure.
      </div>
    `;
  }
}

// Event listeners to detect manual customization
const markCustomSettings = () => {
  currentPreset = 'custom';
  if (presetConservativeBtn) presetConservativeBtn.classList.remove('active');
  if (presetModerateBtn) presetModerateBtn.classList.remove('active');
  if (presetAggressiveBtn) presetAggressiveBtn.classList.remove('active');
  if (presetFeedback) presetFeedback.innerText = "✏️ Custom settings applied by user.";
  updateStopLossSuggestion();
};

if (stakeInput) stakeInput.addEventListener('input', markCustomSettings);
if (targetProfitInput) targetProfitInput.addEventListener('input', markCustomSettings);
if (stopLossInput) {
  stopLossInput.addEventListener('input', () => {
    markCustomSettings();
    updateStopLossSuggestion();
  });
}
if (martingaleStepsInput) martingaleStepsInput.addEventListener('input', markCustomSettings);
if (martingaleMultiplierInput) martingaleMultiplierInput.addEventListener('input', markCustomSettings);

const tfSelectElement = document.getElementById('timeframeSelect');
if (tfSelectElement) {
  tfSelectElement.addEventListener('change', () => {
    markCustomSettings();
    candleGranularity = parseInt(tfSelectElement.value) || 300;
    fetchHistoricalCandles();
  });
}



// Apply default on load
setTimeout(() => {
  applyPreset('moderate');
}, 500);

// Bot Database Analytics Reporting and Retrieving
async function reportSessionAnalytics() {
  const acct = currentAuthorizedAccount || localStorage.getItem('deriv_acct');
  if (!acct) return;

  const cleanAcct = acct.trim().toUpperCase();
  const isDemo = cleanAcct.startsWith('VRTC') || cleanAcct.startsWith('DOT');
  
  const payload = {
    account_id: cleanAcct,
    is_demo: isDemo,
    trades_count: sessionTradesCount,
    wins_count: sessionWins,
    losses_count: sessionLosses,
    traded_volume: sessionTradedVolume,
    net_profit: sessionProfit,
    updated_at: new Date().toISOString()
  };

  try {
    const response = await fetch('/api/analytics', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_id: activeSessionDbId,
        ...payload
      })
    });

    if (response.ok) {
      const data = await response.json();
      if (data.session_id) {
        activeSessionDbId = data.session_id;
      }
      return;
    }
  } catch (err) {
    console.warn("Serverless analytics endpoint failed, attempting direct Supabase fallback:", err);
  }

  // Fallback direct REST write if Vercel serverless is not running (e.g. local vite dev server)
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      let resUrl = `${SUPABASE_URL}/rest/v1/bot_sessions`;
      let fetchOptions = {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      };

      if (activeSessionDbId) {
        resUrl += `?id=eq.${activeSessionDbId}`;
        fetchOptions.method = 'PATCH';
      } else {
        fetchOptions.method = 'POST';
      }

      const dbRes = await fetch(resUrl, {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body
      });

      if (dbRes.ok) {
        const dbData = await dbRes.json();
        if (dbData && dbData.length > 0) {
          activeSessionDbId = dbData[0].id;
        }
      }
    } catch (dbErr) {
      console.warn("Direct Supabase fallback also failed:", dbErr);
    }
  }
}

async function loadAdminAnalytics() {
  const adminAcct = localStorage.getItem('deriv_acct');
  const adminToken = localStorage.getItem('deriv_token');
  if (!adminAcct || !adminToken) return;

  const refreshBtn = document.getElementById('refreshAnalyticsBtn');
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerText = "🔄 Loading...";
  }

  try {
    const response = await fetch(`/api/analytics?admin_account_id=${adminAcct}&admin_token=${adminToken}`);
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        renderAdminAnalytics(data.summary, data.sessions);
        if (refreshBtn) {
          refreshBtn.disabled = false;
          refreshBtn.innerText = "🔄 Refresh";
        }
        return;
      }
    }
  } catch (err) {
    console.warn("Serverless analytics retrieval failed, attempting direct Supabase fallback:", err);
  }

  // Direct Supabase REST fallback if serverless API is not active (local dev)
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const sessionsRes = await fetch(`${SUPABASE_URL}/rest/v1/bot_sessions?order=updated_at.desc&limit=30`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      const sessions = sessionsRes.ok ? await sessionsRes.json() : [];

      const allRes = await fetch(`${SUPABASE_URL}/rest/v1/bot_sessions?select=account_id,traded_volume,trades_count,is_demo`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      const allData = allRes.ok ? await allRes.json() : [];

      let totalVolume = 0.0;
      let totalTrades = 0;
      const uniqueUsers = new Set();

      allData.forEach(row => {
        // Only sum volume and trades for REAL accounts to prevent demo play money from polluting statistics
        if (row.is_demo === false || row.is_demo === 'false') {
          totalVolume += parseFloat(row.traded_volume || 0);
          totalTrades += parseInt(row.trades_count || 0);
        }
        if (row.account_id) {
          uniqueUsers.add(row.account_id.trim().toUpperCase());
        }
      });

      renderAdminAnalytics({
        totalVolume,
        totalTrades,
        uniqueUsersCount: uniqueUsers.size,
        estimatedCommission: totalVolume * 0.01,
        totalSessions: allData.length
      }, sessions);
    } catch (dbErr) {
      console.warn("Direct Supabase fallback retrieval failed:", dbErr);
    }
  }

  if (refreshBtn) {
    refreshBtn.disabled = false;
    refreshBtn.innerText = "🔄 Refresh";
  }
}

function renderAdminAnalytics(summary, sessions) {
  const activeUsersEl = document.getElementById('adminActiveUsers');
  const sessionsEl = document.getElementById('adminTotalSessions');
  const volumeEl = document.getElementById('adminTradedVolume');
  const commissionEl = document.getElementById('adminCommission');
  const sessionsBody = document.getElementById('adminSessionsBody');

  if (activeUsersEl) activeUsersEl.innerText = summary.uniqueUsersCount;
  
  const totalSessions = summary.totalSessions || sessions.length || 0;
  if (sessionsEl) sessionsEl.innerText = totalSessions;

  if (volumeEl) volumeEl.innerText = `$${summary.totalVolume.toFixed(2)}`;
  if (commissionEl) commissionEl.innerText = `$${summary.estimatedCommission.toFixed(2)}`;

  if (sessionsBody) {
    if (!sessions || sessions.length === 0) {
      sessionsBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 8px 0;">No active sessions found.</td></tr>`;
      return;
    }

    sessionsBody.innerHTML = sessions.map(s => {
      const typeLabel = s.is_demo ? "Demo" : "Real";
      const typeClass = s.is_demo ? "text-muted" : "win-color";
      const profitVal = parseFloat(s.net_profit || 0);
      const profitClass = profitVal >= 0 ? "win-color" : "loss-color";
      const profitPrefix = profitVal >= 0 ? "+" : "";
      
      return `
        <tr>
          <td style="padding: 4px 6px; font-family: var(--font-family-mono); font-weight: 500;">${s.account_id}</td>
          <td style="padding: 4px 6px; font-weight: 600;" class="${typeClass}">${typeLabel}</td>
          <td style="padding: 4px 6px;">${s.trades_count} (${s.wins_count}/${s.losses_count})</td>
          <td style="padding: 4px 6px; font-weight: 700;" class="${profitClass}">${profitPrefix}$${profitVal.toFixed(2)}</td>
        </tr>
      `;
    }).join('');
  }
}

function updateExportButtonLabel() {
  if (!exportReportBtn) return;
  const currentAcct = localStorage.getItem('deriv_acct') || "";
  const adminAccounts = ['ROT91833970', 'DOT93132805'];
  const isAdmin = adminAccounts.includes(currentAcct.trim().toUpperCase());
  
  exportReportBtn.innerHTML = isAdmin ? "📤 Copy Promo Report" : "📤 Share Stats";
}

// Developer Admin Panel logic
function checkAdminStatus() {
  const currentAcct = localStorage.getItem('deriv_acct');
  updateExportButtonLabel();
  
  const adminAccounts = ['ROT91833970', 'DOT93132805'];
  const isAdmin = currentAcct && adminAccounts.includes(currentAcct.trim().toUpperCase());
  
  const adminTabBtn = document.getElementById('adminTabBtn');
  if (adminTabBtn) {
    if (isAdmin) {
      adminTabBtn.classList.remove('hidden');
    } else {
      adminTabBtn.classList.add('hidden');
      // If we are currently on the admin tab but no longer admin, switch to trade tab
      const activeTabBtn = document.querySelector('.console-tab-bar .tab-btn.active');
      if (activeTabBtn && activeTabBtn.getAttribute('data-tab') === 'admin') {
        const tradeTabBtn = document.querySelector('.console-tab-bar .tab-btn[data-tab="trade"]');
        if (tradeTabBtn) tradeTabBtn.click();
      }
    }
  }

  if (!adminPanel) return;
  if (isAdmin) {
    adminPanel.classList.remove('hidden');
    loadAdminAnalytics();
  } else {
    adminPanel.classList.add('hidden');
  }
}

// Hook refresh button
const refreshAnalyticsBtn = document.getElementById('refreshAnalyticsBtn');
if (refreshAnalyticsBtn) {
  refreshAnalyticsBtn.addEventListener('click', loadAdminAnalytics);
}

// Hook clear real stats button
const clearRealStatsBtn = document.getElementById('clearRealStatsBtn');
if (clearRealStatsBtn) {
  clearRealStatsBtn.addEventListener('click', async () => {
    if (!confirm("⚠️ WARNING\nAre you sure you want to delete all recorded Real account trading statistics from the database? This will reset the Traded Volume and Commission values back to $0.00.\n\nThis action cannot be undone.")) {
      return;
    }

    const adminAcct = localStorage.getItem('deriv_acct');
    const adminToken = localStorage.getItem('deriv_token');

    if (!adminAcct || !adminToken) {
      showAdminFeedback("Missing authentication credentials to perform database reset.", "error");
      return;
    }

    clearRealStatsBtn.disabled = true;
    clearRealStatsBtn.innerText = "Clearing...";

    try {
      let success = false;
      
      // Try via secure serverless API
      const res = await fetch(`/api/analytics?admin_account_id=${adminAcct}&admin_token=${adminToken}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        success = true;
      } else {
        // Fallback to direct REST endpoint
        if (SUPABASE_URL && SUPABASE_ANON_KEY) {
          const response = await fetch(`${SUPABASE_URL}/rest/v1/bot_sessions?is_demo=eq.false`, {
            method: 'DELETE',
            headers: {
              'apikey': SUPABASE_ANON_KEY,
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          });
          if (response.ok) {
            success = true;
          }
        }
      }

      if (success) {
        showAdminFeedback("Successfully cleared all real-account sessions!", "success");
        loadAdminAnalytics();
      } else {
        showAdminFeedback("Failed to clear sessions. Please check database permissions.", "error");
      }
    } catch (err) {
      console.error(err);
      showAdminFeedback("Error communicating with database.", "error");
    } finally {
      clearRealStatsBtn.disabled = false;
      clearRealStatsBtn.innerText = "🧹 Clear Real Stats";
    }
  });
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
    checkActiveSession();

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
  localStorage.removeItem('deriv_tokens_map');
  localStorage.removeItem('deriv_all_accounts');
  isTrading = false;
  isAuthorized = false;
  if (socket) {
    try {
      socket.close();
    } catch (e) {}
  }
  
  // Force a full reload to clean memory, reset viewport scaling, and show clean login page
  window.location.replace(window.location.origin + '/');
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
        currentAuthorizedAccount = acct ? acct.trim().toUpperCase() : null;
        
        if (isReconnecting) {
          addLog("🔄 Options WebSocket connection re-established. Session resumed.", "success");
          sendPushNotification("🔄 Connection Restored", "Bot is active and trading has resumed.");
        }
        isReconnecting = false;
        reconnectAttempts = 0;
        if (reconnectTimeoutId) {
          clearTimeout(reconnectTimeoutId);
          reconnectTimeoutId = null;
        }
        if (isTrading) {
          statusText.innerText = "Bot is Active";
          statusIndicator.className = "status-bar status-running";
          if (currentContractId) {
            addLog(`🔄 Re-subscribing to active contract tracking: ${currentContractId}`, "info");
            socket.send(JSON.stringify({
              proposal_open_contract: 1,
              contract_id: currentContractId,
              subscribe: 1
            }));
          }
        }

        checkActiveSession();

        // Fetch balance and subscribe to ticks
        socket.send(JSON.stringify({
          balance: 1,
          subscribe: 1
        }));

        // Fetch historical candles to populate indicator calculations
        fetchHistoricalCandles();

        // Subscribe to live ticks separately to ensure reliable tick stream delivery
        socket.send(JSON.stringify({
          ticks: 'R_75'
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
          handleWebSocketDisconnect();
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
      if (isReconnecting || isTrading) {
        handleWebSocketDisconnect();
      } else {
        logout();
      }
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
          handleWebSocketDisconnect();
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
      if (isReconnecting || isTrading) {
        handleWebSocketDisconnect();
      } else {
        logout();
      }
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
      currentAuthorizedAccount = acct ? acct.trim().toUpperCase() : null;
      isAuthorized = true;
      addLog("Successfully Authorized!", "success");

      if (isReconnecting) {
        addLog("🔄 WebSocket connection re-established. Session resumed.", "success");
        sendPushNotification("🔄 Connection Restored", "Bot is active and trading has resumed.");
      }
      isReconnecting = false;
      reconnectAttempts = 0;
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      if (isTrading) {
        statusText.innerText = "Bot is Active";
        statusIndicator.className = "status-bar status-running";
        if (currentContractId) {
          addLog(`🔄 Re-subscribing to active contract tracking: ${currentContractId}`, "info");
          socket.send(JSON.stringify({
            proposal_open_contract: 1,
            contract_id: currentContractId,
            subscribe: 1
          }));
        }
      }
      
      // Display trading console
      loginPanel.classList.remove('active');
      consolePanel.classList.add('active');
      
      updateAccountLabelBadge(acct);
      const token = localStorage.getItem('deriv_token');
      await populateAccountSelector(token);
      checkAdminStatus();
      checkActiveSession();
      
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

      // Fetch historical candles to populate indicator calculations
      fetchHistoricalCandles();

      // Subscribe to live ticks separately to ensure reliable tick stream delivery
      socket.send(JSON.stringify({
        ticks: 'R_75'
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

  else if (msgType === 'candles') {
    if (data.candles) {
      candlesHistory = data.candles.map(c => ({
        epoch: parseInt(c.epoch),
        open: parseFloat(c.open),
        high: parseFloat(c.high),
        low: parseFloat(c.low),
        close: parseFloat(c.close)
      }));
      // Immediately build indicator cache so the chart renders with full data
      _rebuildIndicatorCache();
      addLog(`📈 Loaded ${candlesHistory.length} historical ${candleGranularity === 60 ? '1-minute' : '5-minute'} candles. Analysis ready!`, "success");
      
      // Update UI element to display current price immediately
      if (candlesHistory.length > 0) {
        const lastCandle = candlesHistory[candlesHistory.length - 1];
        livePrice.innerText = lastCandle.close.toFixed(4);
        lastTickPrice = lastCandle.close;
      }

      // Draw chart immediately with historical data
      if (typeof drawChart === 'function') drawChart();
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
      
      // Record trade marker for chart visualizer
      const lastCandle = candlesHistory.length > 0 ? candlesHistory[candlesHistory.length - 1] : null;
      const markerPrice = lastCandle ? lastCandle.close : 0;
      const markerEpoch = lastCandle ? lastCandle.epoch : Math.floor(Date.now() / 1000);
      chartTradeMarkers.push({
        epoch: markerEpoch,
        price: markerPrice,
        type: activePurchaseProposal,
        result: null,
        id: currentContractId
      });
      if (chartTradeMarkers.length > 50) {
        chartTradeMarkers.shift();
      }
      if (typeof drawChart === 'function') {
        drawChart();
      }

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

function calculateCandleEMAValues(period) {
  if (candlesHistory.length < period) return [];
  const emaValues = new Array(candlesHistory.length).fill(null);
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candlesHistory[i].close;
  }
  let ema = sum / period;
  emaValues[period - 1] = ema;
  for (let i = period; i < candlesHistory.length; i++) {
    ema = (candlesHistory[i].close * k) + (ema * (1 - k));
    emaValues[i] = ema;
  }
  return emaValues;
}

function calculateCandleRSIValues(period = 14) {
  if (candlesHistory.length < period + 1) return [];
  const rsiValues = new Array(candlesHistory.length).fill(null);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candlesHistory[i].close - candlesHistory[i - 1].close;
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  let rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
  rsiValues[period] = rsi;

  for (let i = period + 1; i < candlesHistory.length; i++) {
    const diff = candlesHistory[i].close - candlesHistory[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = ((avgGain * (period - 1)) + gain) / period;
    avgLoss = ((avgLoss * (period - 1)) + loss) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));
    rsiValues[i] = rsi;
  }
  return rsiValues;
}

// ════════════════════════════════════════════
//    INDICATOR CACHE HELPERS (performance)
// ════════════════════════════════════════════

/**
 * Computes ADX-14 (Average Directional Index) using Wilder's smoothing.
 * ADX measures trend STRENGTH (not direction). Higher = stronger trend.
 * - ADX >= 18: trending market (bot allowed to trade)
 * - ADX <  18: choppy/ranging market (bot waits)
 * Returns an array of ADX values aligned to candlesHistory.
 * Returns null for indices where not enough data exists.
 */
function calculateCandleADXValues(period = 14) {
  const candles = candlesHistory;
  const n = candles.length;
  const result = new Array(n).fill(null);
  if (n < period * 2 + 1) return result;

  // Step 1: Compute True Range (TR), +DM, -DM for each bar
  const trArr = [];
  const pdmArr = [];
  const mdmArr = [];

  for (let i = 1; i < n; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    const ph = candles[i - 1].high;
    const pl = candles[i - 1].low;

    const tr = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    trArr.push(tr);

    const upMove   = h - ph;
    const downMove = pl - l;
    pdmArr.push((upMove > downMove && upMove > 0)   ? upMove   : 0);
    mdmArr.push((downMove > upMove && downMove > 0) ? downMove : 0);
  }

  // Step 2: Wilder's first smoothed values (sum of first `period` bars)
  let smoothTR  = trArr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothPDM = pdmArr.slice(0, period).reduce((a, b) => a + b, 0);
  let smoothMDM = mdmArr.slice(0, period).reduce((a, b) => a + b, 0);

  // Step 3: Compute first DX after initial period
  const dxArr = [];

  function computeDx(sTR, sPDM, sMDM) {
    if (sTR === 0) return 0;
    const diPlus  = 100 * sPDM / sTR;
    const diMinus = 100 * sMDM / sTR;
    const diSum   = diPlus + diMinus;
    return diSum === 0 ? 0 : 100 * Math.abs(diPlus - diMinus) / diSum;
  }

  dxArr.push(computeDx(smoothTR, smoothPDM, smoothMDM));

  for (let i = period; i < trArr.length; i++) {
    // Wilder's smoothing: newSmooth = prevSmooth - prevSmooth/period + current
    smoothTR  = smoothTR  - smoothTR  / period + trArr[i];
    smoothPDM = smoothPDM - smoothPDM / period + pdmArr[i];
    smoothMDM = smoothMDM - smoothMDM / period + mdmArr[i];
    dxArr.push(computeDx(smoothTR, smoothPDM, smoothMDM));
  }

  // Step 4: ADX = Wilder's smooth of DX over `period` bars
  if (dxArr.length < period) return result;
  let adx = dxArr.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Align result: first valid ADX corresponds to candle index (period * 2)
  result[period * 2] = adx;
  for (let i = period; i < dxArr.length; i++) {
    adx = (adx * (period - 1) + dxArr[i]) / period;
    result[period + i] = adx;
  }

  return result;
}

/**
 * Fetch historical candles of the selected granularity from Deriv.
 */
function fetchHistoricalCandles() {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  // Clear existing history to force warm up and clean state
  candlesHistory = [];
  _cachedEma9 = [];
  _cachedEma21 = [];
  _cachedEma200 = [];
  _cachedRsi14 = [];
  _cachedAdx14 = [];

  const tfSelect = document.getElementById('timeframeSelect');
  if (tfSelect) {
    candleGranularity = parseInt(tfSelect.value) || 300;
  }

  addLog(`Requesting historical ${candleGranularity === 60 ? '1-minute' : '5-minute'} candles...`, 'info');

  socket.send(JSON.stringify({
    ticks_history: 'R_75',
    adjust_start_time: 1,
    count: 150,
    end: 'latest',
    granularity: candleGranularity,
    style: 'candles'
  }));
}

/**
 * Full recalculation of all indicator caches.
 * Called once per candle close (~once per minute).
 */
function _rebuildIndicatorCache() {
  _cachedEma9   = calculateCandleEMAValues(9);
  _cachedEma21  = calculateCandleEMAValues(21);
  _cachedEma200 = calculateCandleEMAValues(200);
  _cachedRsi14  = calculateCandleRSIValues(14);
  _cachedAdx14  = calculateCandleADXValues(14);  // Layer 1: ADX regime filter
}

/**
 * Incremental EMA update for the live (current) candle's close price.
 * This is O(1) and keeps the displayed EMA values up-to-date between candle closes.
 * @param {number} price - latest tick price
 */
function _updateLastEmaIncremental(price) {
  // Helper to apply one EMA step
  function applyEmaStep(cache, period) {
    if (cache.length < 2) return;
    const k = 2 / (period + 1);
    const prev = cache[cache.length - 2]; // previous confirmed candle EMA
    if (prev === null) return;
    cache[cache.length - 1] = (price * k) + (prev * (1 - k));
  }

  if (_cachedEma9.length > 0)  applyEmaStep(_cachedEma9, 9);
  if (_cachedEma21.length > 0) applyEmaStep(_cachedEma21, 21);
  // Note: EMA-200 and RSI update less critically between closes; skip for speed.
}

function processTick(tick) {
  const price = parseFloat(tick.quote);
  const timeEpoch = parseInt(tick.epoch);
  livePrice.innerText = price.toFixed(4);

  // Determine direction arrow & color
  let direction = "";
  if (lastTickPrice !== null) {
    if (price > lastTickPrice) {
      direction = "▲";
      livePrice.className = "tick-price up";
      tickDirection.innerText = "▲";
      tickDirection.className = "tick-arrow profit-won";
    } else if (price < lastTickPrice) {
      direction = "▼";
      livePrice.className = "tick-price down";
      tickDirection.innerText = "▼";
      tickDirection.className = "tick-arrow profit-lost";
    }
  }
  lastTickPrice = price;

  // Tick buffer: rolling 30-price window for momentum
  tickPrices.push(price);
  if (tickPrices.length > 30) tickPrices.shift();

  // Real-time Candle Compilation
  const tickMinuteEpoch = Math.floor(timeEpoch / candleGranularity) * candleGranularity;
  const lastCandle = candlesHistory[candlesHistory.length - 1];
  let candleClosed = false;

  if (lastCandle && lastCandle.epoch === tickMinuteEpoch) {
    // Update current candle in-place (no indicator recalc needed — only close changes)
    lastCandle.high = Math.max(lastCandle.high, price);
    lastCandle.low = Math.min(lastCandle.low, price);
    lastCandle.close = price;
    // Update last EMA value incrementally (fast — avoids full recalc on every tick)
    _updateLastEmaIncremental(price);
  } else if (lastCandle && tickMinuteEpoch > lastCandle.epoch) {
    // A new minute has started — previous candle is officially closed.
    candleClosed = true;

    // Initialize the new candle
    candlesHistory.push({
      epoch: tickMinuteEpoch,
      open: price,
      high: price,
      low: price,
      close: price
    });

    if (candlesHistory.length > 300) {
      candlesHistory.shift();
    }

    // Full recalc only on candle close (once per minute)
    _rebuildIndicatorCache();
  } else if (!lastCandle) {
    // First candle ever
    candlesHistory.push({
      epoch: tickMinuteEpoch,
      open: price,
      high: price,
      low: price,
      close: price
    });
    _rebuildIndicatorCache();
  }

  // Use cached indicator values — O(1) lookup, no loop
  const curEma9  = _cachedEma9.length  > 0 ? _cachedEma9[_cachedEma9.length - 1]   : null;
  const curEma21 = _cachedEma21.length > 0 ? _cachedEma21[_cachedEma21.length - 1] : null;
  const curRsi   = _cachedRsi14.length > 0 ? _cachedRsi14[_cachedRsi14.length - 1] : null;
  const curAdx   = _cachedAdx14.length > 0 ? _cachedAdx14[_cachedAdx14.length - 1] : null;

  let trendStr = "Analyzing...";
  let trendColor = "var(--text-muted)";

  if (curEma9 !== null && curEma21 !== null) {
    if (curEma9 > curEma21) {
      trendStr = "Bullish 📈";
      trendColor = "var(--color-success)";
    } else if (curEma9 < curEma21) {
      trendStr = "Bearish 📉";
      trendColor = "var(--color-danger)";
    } else {
      trendStr = "Neutral ➡️";
      trendColor = "var(--text-muted)";
    }
  }

  if (curRsi !== null) {
    let rsiCondition = "";
    if (curRsi < 40) {
      rsiCondition = " (Oversold 🟢)";
    } else if (curRsi > 60) {
      rsiCondition = " (Overbought 🔴)";
    }
    trendStr += ` | RSI: ${curRsi.toFixed(1)}${rsiCondition}`;
  }

  if (curAdx !== null) {
    const isChoppy = curAdx < adxThreshold;
    trendStr += ` | ADX: ${curAdx.toFixed(1)} ${isChoppy ? '⏸ (Choppy)' : '🔥 (Trending)'}`;
    if (isChoppy) {
      trendColor = "var(--text-muted)";
    }
  }

  if (trendLabel) {
    trendLabel.innerText = `Trend: ${trendStr}`;
    trendLabel.style.color = trendColor;
  }

  // Handle candle/minutes based loss cooldown
  if (candleClosed && cooldownTicksRemaining > 0) {
    cooldownTicksRemaining--;
    if (cooldownTicksRemaining === 0) {
      addLog("⏱️ Loss cooldown complete. Bot is ready to evaluate crossovers.", "info");
    }
  }

  // Execute strategy ONLY on candle close (quality signal gate)
  // Still uses 5-tick contracts for fast settlement
  if (isTrading && !tradeInProgress && activePurchaseProposal === null && currentContractId === null) {
    if (tickCooldownRemaining > 0) {
      tickCooldownRemaining--;
      if (candleClosed) {
        statusText.innerText = `Cooldown: ${Math.ceil(tickCooldownRemaining / 10)} candles`;
        statusIndicator.className = 'status-bar status-idle';
      }
    } else if (candleClosed) {
      if (statusText.innerText.startsWith('Cooldown')) {
        statusText.innerText = 'Bot is Active';
        statusIndicator.className = 'status-bar status-running';
      }
      evaluateCrossoverStrategy();
    }
  }

  // Throttle chart redraws using requestAnimationFrame to prevent UI jank
  if (!_chartDrawPending) {
    _chartDrawPending = true;
    requestAnimationFrame(() => {
      _chartDrawPending = false;
      if (typeof drawChart === 'function') drawChart();
    });
  }
}

function evaluateCrossoverStrategy() {
  // Need at least 30 candles to compute ADX-14 (requires 29 bars)
  if (candlesHistory.length < 30) {
    addLog('Warming up... need ' + (30 - candlesHistory.length) + ' more candles for indicators.', 'info');
    return;
  }

  const len = candlesHistory.length;
  const ema9  = _cachedEma9;
  const ema21 = _cachedEma21;
  const rsi   = _cachedRsi14;
  const adx   = _cachedAdx14;

  if (ema9.length < len || ema21.length < len || rsi.length < len || adx.length < len) return;

  const ci = len - 2;  // last CLOSED candle index
  const pi = len - 3;  // previous candle

  const curEma9  = ema9[ci],  prevEma9  = ema9[pi];
  const curEma21 = ema21[ci], prevEma21 = ema21[pi];
  const curRsi   = rsi[ci];
  const curAdx   = adx[ci];

  if (curEma9 == null || curEma21 == null || prevEma9 == null || prevEma21 == null || curRsi == null || curAdx == null) return;

  const candle   = candlesHistory[ci];
  const nowEpoch = candle.epoch;

  // ── Daily limits ─────────────────────────────────────────────────────────
  if (dailyPnl <= -dailyStopLoss) {
    stopTrading('Daily Stop Loss Hit');
    addLog('Daily stop loss hit. Session ended.', 'error');
    return;
  }
  if (dailyTarget > 0 && dailyPnl >= dailyTarget) {
    stopTrading('Daily Target Reached');
    addLog('Daily target reached! Well done.', 'success');
    return;
  }

  // ── Consecutive loss pause ────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  if (consecutiveLossPauseEnd > now) {
    const m = Math.ceil((consecutiveLossPauseEnd - now) / 60);
    if (trendLabel) trendLabel.innerHTML = '<span style="color:#f43f5e">Cooling down ' + m + 'm after 3 losses</span>';
    return;
  }

  // ── Minimum gap between trades ────────────────────────────────────────────
  const minsSinceLast = (nowEpoch - lastTradeCandleEpoch) / 60;
  const minGap = currentMartingaleStep > 0 ? 10 : 5; // 1-2 full 5-min candles between trades
  if (minsSinceLast < minGap) return;

  // ── Layer 1: ADX Regime Filter ────────────────────────────────────────────
  if (curAdx < adxThreshold) {
    if (trendLabel) {
      trendLabel.innerText = `Trend: Choppy ⏸ | ADX: ${curAdx.toFixed(1)} < ${adxThreshold}`;
      trendLabel.style.color = "var(--text-muted)";
    }
    return;
  }

  // ── EMA trend direction (the single source of truth) ─────────────────────
  const emaBullish = curEma9 > curEma21;
  const emaBearish = curEma9 < curEma21;

  if (trendLabel) {
    trendLabel.innerText = 'Trend: ' + (emaBullish ? 'Bullish' : (emaBearish ? 'Bearish' : 'Neutral')) + ' | RSI: ' + curRsi.toFixed(1) + ' | ADX: ' + curAdx.toFixed(1);
    trendLabel.style.color = emaBullish ? 'var(--color-success)' : (emaBearish ? 'var(--color-danger)' : 'var(--text-muted)');
  }

  // ── SIGNAL A: EMA Crossover ───────────────────────────────────────────────
  // Fresh crossover = strongest signal. RSI just confirms we're not at extremes.
  const bullCross = (prevEma9 <= prevEma21) && (curEma9 > curEma21);
  const bearCross = (prevEma9 >= prevEma21) && (curEma9 < curEma21);

  if (bullCross && curRsi < 70) {
    lastTradeCandleEpoch = nowEpoch;
    addLog('EMA CROSS UP -> RISE | RSI: ' + curRsi.toFixed(1), 'info');
    tradeInProgress = true;
    proposeTrade('CALL');
    return;
  }
  if (bearCross && curRsi > 30) {
    lastTradeCandleEpoch = nowEpoch;
    addLog('EMA CROSS DOWN -> FALL | RSI: ' + curRsi.toFixed(1), 'info');
    tradeInProgress = true;
    proposeTrade('PUT');
    return;
  }

  // ── NOTE: RSI extreme bounce (Signal B) is intentionally removed ─────────
  // During a downtrend, RSI gets oversold — but that does NOT mean price will
  // bounce. Betting RISE against a falling EMA = contradictory = losses.
  // We only trade WITH the EMA direction, never against it.

  // ── SIGNAL C: Trend continuation ─────────────────────────────────────────
  // Only fires when EMAs are well separated (clear trend) and RSI is neutral
  // (trend has room to continue — not overextended).
  if (minsSinceLast < 10) return; // need 2 full 5-min candles before trend continuation

  const spread = Math.abs(curEma9 - curEma21) / candle.close * 100;
  if (spread < 0.005) return; // EMAs too close — no clear trend

  // Layer 2: Candle Body Quality Filter (reject indecision Doji candles)
  const body = Math.abs(candle.close - candle.open);
  const range = candle.high - candle.low;
  const bodyRatio = range > 0 ? (body / range) : 0;

  // CALL only when EMA confirms bullish trend, RSI is neutral, EMA-9 is sloping upwards, and the closed candle was green
  const isBullishCandle = candle.close > candle.open;
  if (emaBullish && curRsi >= 42 && curRsi <= 57 && curEma9 > prevEma9 && isBullishCandle) {
    if (bodyRatio < 0.35) {
      addLog(`TREND -> RISE skipped: Indecision candle (body ratio ${bodyRatio.toFixed(2)} < 0.35)`, 'info');
      return;
    }
    lastTradeCandleEpoch = nowEpoch;
    addLog('TREND -> RISE | EMA spread: ' + spread.toFixed(3) + '% | RSI: ' + curRsi.toFixed(1) + ' | Slope: Up', 'info');
    tradeInProgress = true;
    proposeTrade('CALL');
    return;
  }
  // PUT only when EMA confirms bearish trend, RSI is neutral, EMA-9 is sloping downwards, and the closed candle was red
  const isBearishCandle = candle.close < candle.open;
  if (emaBearish && curRsi >= 43 && curRsi <= 58 && curEma9 < prevEma9 && isBearishCandle) {
    if (bodyRatio < 0.35) {
      addLog(`TREND -> FALL skipped: Indecision candle (body ratio ${bodyRatio.toFixed(2)} < 0.35)`, 'info');
      return;
    }
    lastTradeCandleEpoch = nowEpoch;
    addLog('TREND -> FALL | EMA spread: ' + spread.toFixed(3) + '% | RSI: ' + curRsi.toFixed(1) + ' | Slope: Down', 'info');
    tradeInProgress = true;
    proposeTrade('PUT');
    return;
  }
}


function proposeTrade(type) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;

  activePurchaseProposal = type;
  statusText.innerText = "Proposing Order...";
  statusIndicator.className = "status-bar status-running";

  const tradeDuration = candleGranularity === 60 ? 1 : 5;

  const req = {
    proposal: 1,
    amount: currentStake,
    basis: "stake",
    contract_type: type,
    currency: "USD",
    duration: tradeDuration,
    duration_unit: "m"  // contract duration matches signal candle timeframe
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

  // Update trade marker outcome on chart
  const marker = chartTradeMarkers.find(m => m.id === contract.contract_id);
  if (marker) {
    marker.result = status === 'won' ? 'win' : 'loss';
  } else {
    const lastPending = [...chartTradeMarkers].reverse().find(m => m.result === null);
    if (lastPending) {
      lastPending.result = status === 'won' ? 'win' : 'loss';
    }
  }
  if (typeof drawChart === 'function') {
    drawChart();
  }
  
  sessionProfit += profit;
  dailyPnl += profit;
  saveDailyPnl();
  updateProfitDisplay();

  // Update session database analytics tracking variables
  const tradeStake = parseFloat(contract.buy_price || currentStake) || 0;
  sessionTradedVolume += tradeStake;
  sessionTradesCount++;
  if (status === 'won') {
    sessionWins++;
  } else {
    sessionLosses++;
  }
  reportSessionAnalytics(); // report live session update to database

  const result = status === 'won' ? 'win' : 'loss';
  const displayType = contractType === 'CALL' ? 'RISE 🟢' : (contractType === 'PUT' ? 'FALL 🔴' : contractType);
  recordTrade(displayType, contract.buy_price || currentStake, profit, result);

  if (status === 'won') {
    addLog(`🎉 WIN! Profit: +$${profit.toFixed(2)}`, "success");
    sendPushNotification("🎉 Trade WON!", `Profit: +$${profit.toFixed(2)} | Session Profit: ${sessionProfit >= 0 ? '+' : ''}$${sessionProfit.toFixed(2)}`);
    
    // Reset martingale steps
    currentStake = initialStake;
    currentMartingaleStep = 0;
    consecutiveLosses = 0; // Reset consecutive losses on any win
  } else {
    addLog(`🚨 LOSS! Loss: -$${Math.abs(profit).toFixed(2)}`, "error");
    
    consecutiveLosses++;

    // Layer 4: Consecutive Loss Guard (3 consecutive losses forces 10-min pause)
    if (consecutiveLosses >= CONSECUTIVE_LOSS_LIMIT) {
      const pauseMins = CONSECUTIVE_LOSS_PAUSE_MIN;
      consecutiveLossPauseEnd = Math.floor(Date.now() / 1000) + (pauseMins * 60);
      addLog(`🚨 Consecutive Loss Guard triggered! ${consecutiveLosses} losses in a row. Bot is paused for ${pauseMins} minutes to cool down.`, "error");
      sendPushNotification("🚨 Consecutive Loss Guard", `${consecutiveLosses} consecutive losses! Bot paused for ${pauseMins} mins.`);
      
      // Reset martingale state and consecutive loss counter
      currentStake = initialStake;
      currentMartingaleStep = 0;
      consecutiveLosses = 0;
      
      if (statusText) statusText.innerText = `Paused: 3-Loss Guard (${pauseMins}m)`;
      if (statusIndicator) statusIndicator.className = "status-bar status-idle";
    } else {
      // Apply loss cooldown if configured
      // 20-tick cooldown after each loss (~20 seconds)
      // 30-tick cooldown = ~1 candle of breathing room after each loss
      tickCooldownRemaining = 30;
      addLog("Loss cooldown: 30 ticks before next trade.", "warn");

      // Martingale management
      currentMartingaleStep++;
      if (currentMartingaleStep >= maxMartingaleSteps) {
        addLog(`⚠️ Max Martingale Steps (${maxMartingaleSteps}) reached. Resetting stake.`, "warn");
        sendPushNotification("🚨 Trade LOST", `Loss: -$${Math.abs(profit).toFixed(2)} (Max steps hit, stake reset) | Session: $${sessionProfit.toFixed(2)}`);
        currentStake = initialStake;
        currentMartingaleStep = 0;
        
        // Layer 3: Capped Martingale recovery failure forces a 5-candle cooldown
        tickCooldownRemaining = 60;
        addLog("Martingale exhausted. Cooling 60 ticks before next entry.", "warn");
      } else {
        currentStake = currentStake * parseFloat(martingaleStepsInput.value === '1' ? 1.0 : martingaleMultiplier);
        addLog(`🔄 Martingale Multiplier (${martingaleMultiplier}x) applied. Next stake: $${currentStake.toFixed(2)}`, "warn");
        sendPushNotification("🚨 Trade LOST", `Loss: -$${Math.abs(profit).toFixed(2)} (Martingale Step ${currentMartingaleStep} next: $${currentStake.toFixed(2)}) | Session: $${sessionProfit.toFixed(2)}`);
      }
    }
  }

  // Clear trade lock state
  activePurchaseProposal = null;
  currentProposalId = null;
  currentContractId = null;
  tradeInProgress = false;

  // Save active session state in real-time
  if (isTrading) {
    saveSessionState();
  }

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
  const tfSelect = document.getElementById('timeframeSelect');
  candleGranularity = tfSelect ? parseInt(tfSelect.value) || 300 : 300;

  initialStake = parseFloat(stakeInput.value);
  currentStake = initialStake;
  targetProfit = parseFloat(targetProfitInput.value);
  stopLoss = parseFloat(stopLossInput.value);
  
  // Layer 3: Enforce capped Martingale (max 3 total steps = 2 recovery steps)
  const stepsVal = parseInt(martingaleStepsInput.value) || 3;
  if (stepsVal > 3) {
    addLog(`⚠️ Capped Martingale system allows max 2 recovery steps (3 total attempts). Stake steps restricted to 3.`, "warn");
  }
  maxMartingaleSteps = Math.min(2, stepsVal); // hard cap at 2 steps to prevent account blowup
  
  currentMartingaleStep = 0;
  sessionProfit = 0.0;

  // Reset tick state for fresh session
  tickPrices = [];
  tradeInProgress = false;
  tickCooldownRemaining = 0;

  // Parse ADX threshold from UI input
  const adxInputEl = document.getElementById('adxThresholdInput');
  adxThreshold = adxInputEl ? parseInt(adxInputEl.value) || 18 : 18;

  // IMPORTANT: dailyStopLoss reads from the DAILY STOP LOSS field
  // NOT from stopLossInput (which shows the martingale cycle cost)
  const dslEl = document.getElementById('dailyStopLossInput');
  dailyStopLoss = dslEl ? Math.max(0.50, parseFloat(dslEl.value) || 50.00) : 9999.00;

  // Daily target reads from targetProfitInput
  const tpEl = document.getElementById('targetProfitInput');
  dailyTarget = tpEl ? Math.max(0.50, parseFloat(tpEl.value) || 5.00) : 9999.00;

  addLog(`ℹ️ Session limits set — Stop Loss: $${dailyStopLoss.toFixed(2)} | Target: $${dailyTarget.toFixed(2)}`, 'info');

  const multiplierVal = parseFloat(martingaleMultiplierInput ? martingaleMultiplierInput.value : '2.0');
  if (isNaN(multiplierVal) || multiplierVal < 1.0 || multiplierVal > 5.0) {
    alert("⚠️ Invalid Martingale Multiplier!\nPlease enter a number between 1.0 and 5.0.");
    return;
  }
  martingaleMultiplier = multiplierVal;

  lossCooldownTicks = 3;
  cooldownTicksRemaining = 0;
  useSma50Guard = false; // guard removed from UI — always off
  useStrictMartingale = true;

  // Reset session database analytics tracking variables
  activeSessionDbId = null;
  sessionTradedVolume = 0.0;
  sessionWins = 0;
  sessionLosses = 0;
  sessionTradesCount = 0;
  reportSessionAnalytics(); // report start of session

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
  addLog(`Params: Stake=$${initialStake.toFixed(2)}, Target=$${targetProfit.toFixed(2)}, Stop=$${stopLoss.toFixed(2)}, MaxSteps=${maxMartingaleSteps}, Multiplier=${martingaleMultiplier}x`, "info");
  
  requestWakeLock();
  startKeepAlive();
  startWsPinger(); // sends a ping every 25s to keep WebSocket alive when screen is off

  saveSessionState();

  sendPushNotification("🤖 Bot Started", `Monitoring V75 tick patterns...\nStake: $${initialStake.toFixed(2)} | Target: $${targetProfit.toFixed(2)}`);
});

stopBotBtn.addEventListener('click', () => {
  stopTrading("Stopped by user");
});

function stopTrading(reason) {
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }
  isReconnecting = false;
  reconnectAttempts = 0;

  const wasTrading = isTrading;
  isTrading = false;
  activePurchaseProposal = null;
  currentProposalId = null;
  currentContractId = null;

  releaseWakeLock();
  stopKeepAlive();
  stopWsPinger();

  startBotBtn.classList.remove('hidden');
  stopBotBtn.classList.add('hidden');
  
  // Hide resume container when stopped
  if (resumeSessionContainer) {
    resumeSessionContainer.classList.add('hidden');
  }

  // Only clear stored session state on explicit user stops or safety target hits, NOT on connection loss
  if (reason === "Stopped by user" || reason === "Target Profit Reached" || reason === "Stop Loss Hit" || reason === "Account switched") {
    clearSessionState();
  }
  
  statusText.innerText = "Bot is Idle";
  statusIndicator.className = "status-bar status-idle";
  
  toggleInputs(false);
  addLog(`🤖 Bot Halted. Reason: ${reason}`, "warn");

  if (wasTrading) {
    sendPushNotification("🤖 Bot Halted", `Reason: ${reason}`);
    reportSessionAnalytics(); // report final session updates on halt
  }
}

function toggleInputs(disabled) {
  stakeInput.disabled = disabled;
  targetProfitInput.disabled = disabled;
  stopLossInput.disabled = disabled;
  martingaleStepsInput.disabled = disabled;
  if (martingaleMultiplierInput) martingaleMultiplierInput.disabled = disabled;
  
  const tfSelect = document.getElementById('timeframeSelect');
  if (tfSelect) tfSelect.disabled = disabled;
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

// Handle visibility change: when the screen comes back on, resume audio and reconnect if needed
document.addEventListener('visibilitychange', async () => {
  if (isTrading) {
    if (document.visibilityState === 'visible') {
      // Re-request wake lock (it was revoked when screen turned off)
      await requestWakeLock();

      // Resume the audio context (it may have been suspended by the OS)
      if (keepAliveAudioContext && keepAliveAudioContext.state === 'suspended') {
        try { await keepAliveAudioContext.resume(); } catch(e) {}
      }

      // If the WebSocket died while the screen was off, force a reconnect
      if (!socket || socket.readyState === WebSocket.CLOSED || socket.readyState === WebSocket.CLOSING) {
        addLog("📱 Screen resumed — WebSocket was lost. Reconnecting...", "warn");
        handleWebSocketDisconnect();
      }
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
//   WEBSOCKET PING (keeps connection alive
//   when screen is off / page is backgrounded)
// ════════════════════════════════════════════

/**
 * Sends a Deriv API ping every 25 seconds.
 * This prevents the WebSocket server from timing out the connection
 * when the phone screen is off and the browser is throttled.
 * Without this, the connection silently dies after ~60-90 seconds.
 */
function startWsPinger() {
  stopWsPinger(); // clear any existing pinger first
  wsPingIntervalId = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify({ ping: 1 }));
      } catch (e) {
        console.warn('WS ping failed:', e);
      }
    }
  }, 25000); // every 25 seconds
}

function stopWsPinger() {
  if (wsPingIntervalId) {
    clearInterval(wsPingIntervalId);
    wsPingIntervalId = null;
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

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadDailyPnl() {
  const todayKey = getTodayKey();
  const stored = localStorage.getItem(DAILY_PNL_KEY);
  if (stored) {
    try {
      const data = JSON.parse(stored);
      if (data.date === todayKey) {
        dailyPnl = parseFloat(data.pnl) || 0.0;
        updateDailyPnlDisplay();
        return;
      }
    } catch (e) {
      console.error("Error parsing daily P&L", e);
    }
  }
  // Reset daily P&L if not found or if date is old
  dailyPnl = 0.0;
  saveDailyPnl();
}

function saveDailyPnl() {
  const todayKey = getTodayKey();
  localStorage.setItem(DAILY_PNL_KEY, JSON.stringify({ date: todayKey, pnl: dailyPnl }));
  updateDailyPnlDisplay();
}

function updateDailyPnlDisplay() {
  const dailyPnlText = document.getElementById('dailyPnlText');
  if (dailyPnlText) {
    dailyPnlText.innerText = `${dailyPnl >= 0 ? '+' : ''}$${dailyPnl.toFixed(2)}`;
    dailyPnlText.className = dailyPnl >= 0 ? "perf-value win-color" : "perf-value loss-color";
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
// ── Stop Loss Mode Toggle (Fixed $ vs % of Balance) ──────────────────────────
const stopLossModeSelect = document.getElementById('stopLossModeSelect');
const fixedStopLossRow   = document.getElementById('fixedStopLossRow');
const percentStopLossRow = document.getElementById('percentStopLossRow');

function applyStopLossMode(mode) {
  if (!fixedStopLossRow || !percentStopLossRow) return;
  if (mode === 'percent') {
    fixedStopLossRow.classList.add('hidden');
    percentStopLossRow.classList.remove('hidden');
  } else {
    fixedStopLossRow.classList.remove('hidden');
    percentStopLossRow.classList.add('hidden');
  }
}

if (stopLossModeSelect) {
  stopLossModeSelect.addEventListener('change', () => {
    applyStopLossMode(stopLossModeSelect.value);
  });
  applyStopLossMode(stopLossModeSelect.value);
}
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
  
  // Animate circular progress ring
  const ringFg = document.getElementById('winRateRingFg');
  if (ringFg) {
    const radius = 52;
    const circumference = 2 * Math.PI * radius; // 326.7256
    const rateVal = parseFloat(rate) || 0;
    const offset = circumference - (rateVal / 100) * circumference;
    ringFg.style.strokeDashoffset = offset;
  }
  
  // Populate table
  if (!tradeHistoryBody) return;
  if (stats.history.length === 0) {
    tradeHistoryBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No trades recorded.</td></tr>`;
    return;
  }
  
  const N = stats.history.length;
  tradeHistoryBody.innerHTML = stats.history.map((t, idx) => {
    const isWin = t.result === 'win';
    const resultClass = isWin ? 'win-color' : 'loss-color';
    const stakeVal = parseFloat(t.stake) || 0;
    const profitVal = parseFloat(t.profit) || 0;
    const profitPrefix = profitVal >= 0 ? '+' : '';
    const indexNum = N - idx;
    return `
      <tr>
        <td style="color: var(--text-muted);">#${indexNum}</td>
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

if (exportCsvBtn) {
  exportCsvBtn.addEventListener('click', () => {
    if (!stats.history || stats.history.length === 0) {
      alert("⚠️ No trade logs available to export.");
      return;
    }

    const headers = ["Index", "Time", "Type", "Stake ($)", "Profit ($)", "Result"];
    const csvRows = [headers.join(",")];
    
    const sortedHistory = [...stats.history].reverse();
    
    sortedHistory.forEach((t, idx) => {
      const indexNum = idx + 1;
      const profitPrefix = t.profit >= 0 ? "+" : "";
      const row = [
        indexNum,
        t.time,
        `"${t.type}"`,
        t.stake.toFixed(2),
        `${profitPrefix}${t.profit.toFixed(2)}`,
        t.result.toUpperCase()
      ];
      csvRows.push(row.join(","));
    });

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `v75_scalper_trades_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addLog("📥 Trade history exported to CSV.", "success");
  });
}

if (exportReportBtn) {
  exportReportBtn.addEventListener('click', () => {
    const rate = stats.total > 0 ? ((stats.wins / stats.total) * 100).toFixed(1) : "0.0";
    const selectedTemplate = promoTemplateSelect ? promoTemplateSelect.value : 'raw';
    
    const currentAcct = localStorage.getItem('deriv_acct') || "";
    const adminAccounts = ['ROT91833970', 'DOT93132805'];
    const isAdmin = adminAccounts.includes(currentAcct.trim().toUpperCase());
    
    // Admins copy their affiliate link; standard users copy the organic app link
    const affiliateLink = "https://deriv.partners/rx?sidi=9A373E8A-A450-487A-A419-064B4FE5B751&utm_campaign=dynamicworks&utm_medium=affiliate&utm_source=CU13329";
    const partnerLink = isAdmin ? affiliateLink : "https://amphybot.vercel.app/";
    
    let reportText = "";
    
    if (selectedTemplate === 'social') {
      const hookText = isAdmin 
        ? "Chart setup doing the work while I go about my day. Here are the live stats from my current session:"
        : "Just completed an automated V75 trading session. Here are the live stats:";
      const actionText = isAdmin
        ? "👉 Try the bot for free and start auto-trading here:"
        : "👉 Try the V75 Scalper Bot for free:";
      const runningText = isAdmin
        ? "Set the parameters, turn on background running, and let it scan tick trends."
        : "Runs securely inside the local browser. Zero server custody.";

      reportText = 
`${isAdmin ? "🤖 Automated V75 Scalper Bot Update" : "⚡ V75 Scalper Bot Session Stats ⚡"}

${hookText}

📈 Total Trades: ${stats.total}
🟢 Wins: ${stats.wins} | 🔴 Losses: ${stats.losses}
🎯 Win Rate: ${rate}%
💰 Session Profit: $${sessionProfit.toFixed(2)}
💵 Lifetime Profit: $${(stats.totalProfit || 0).toFixed(2)}

${runningText}

${actionText}
${partnerLink}`;
    } else if (selectedTemplate === 'short') {
      const headerText = isAdmin
        ? "⚡ V75 Scalping Session Complete! ⚡"
        : "📊 V75 Scalping Stats Update 📊";
      const actionText = isAdmin
        ? "👉 Get free bot access here:"
        : "👉 Get free access to the bot:";

      reportText = 
`${headerText}

📈 Trades: ${stats.total}
🎯 Win Rate: ${rate}%
💰 Today's Profit: $${sessionProfit.toFixed(2)}

100% automated mean-reversion trading. Screen Wake Lock and background keep-alive active.

${actionText}
${partnerLink}`;
    } else {
      // Default: Raw Stats
      const headerText = isAdmin
        ? "🔥 AMPHY V75 SCALPER BOT PERFORMANCE REPORT 🔥"
        : "🔥 AMPHY V75 SCALPER BOT REPORT 🔥";
      const actionText = isAdmin
        ? "🚀 Join under my Deriv partner link:"
        : "🚀 Try the V75 Scalper Bot for free:";
      const profitLabel = isAdmin
        ? "Net Session Profit"
        : "Today's Net Profit";

      reportText = 
`${headerText}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 Total Trades: ${stats.total}
🟢 Wins: ${stats.wins}
🔴 Losses: ${stats.losses}
🎯 Win Rate: ${rate}%
💰 ${profitLabel}: $${sessionProfit.toFixed(2)}
💵 Lifetime Net Profit: $${(stats.totalProfit || 0).toFixed(2)}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${actionText}
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

// ════════════════════════════════════════════
//             SESSION PERSISTENCE HELPERS
// ════════════════════════════════════════════

function saveSessionState() {
  const acct = currentAuthorizedAccount || localStorage.getItem('deriv_acct');
  if (!acct) return;

  const cleanAcct = acct.trim().toUpperCase();
  const sessionState = {
    account_id: cleanAcct,
    initialStake: initialStake,
    currentStake: currentStake,
    currentMartingaleStep: currentMartingaleStep,
    sessionProfit: sessionProfit,
    targetProfit: targetProfit,
    stopLoss: stopLoss,
    maxMartingaleSteps: maxMartingaleSteps,
    martingaleMultiplier: martingaleMultiplier,
    lossCooldownTicks: lossCooldownTicks,
    useSma50Guard: useSma50Guard,
    useStrictMartingale: useStrictMartingale,
    activeSessionDbId: activeSessionDbId,
    sessionTradedVolume: sessionTradedVolume,
    sessionWins: sessionWins,
    sessionLosses: sessionLosses,
    sessionTradesCount: sessionTradesCount,
    device_id: deviceId,
    last_heartbeat: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  // 1. Keep a local backup
  localStorage.setItem('deriv_bot_active_session', JSON.stringify(sessionState));

  // 2. Save to Supabase Cloud asynchronously (non-blocking)
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    saveSessionStateCloud(cleanAcct, sessionState);
    if (isTrading && !heartbeatIntervalId) {
      startHeartbeatLoop(cleanAcct);
    }
  }
}

async function saveSessionStateCloud(accountId, sessionState) {
  try {
    const url = `${SUPABASE_URL}/rest/v1/active_sessions?account_id=eq.${accountId}`;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    const checkRes = await fetch(url, { method: 'GET', headers });
    const exists = checkRes.ok && (await checkRes.json()).length > 0;

    let method = 'POST';
    let saveUrl = `${SUPABASE_URL}/rest/v1/active_sessions`;
    if (exists) {
      method = 'PATCH';
      saveUrl = url;
    }

    const payload = {
      account_id: accountId,
      initial_stake: sessionState.initialStake,
      current_stake: sessionState.currentStake,
      current_martingale_step: sessionState.currentMartingaleStep,
      session_profit: sessionState.sessionProfit,
      target_profit: sessionState.targetProfit,
      stop_loss: sessionState.stopLoss,
      max_martingale_steps: sessionState.maxMartingaleSteps,
      martingale_multiplier: sessionState.martingaleMultiplier,
      loss_cooldown_ticks: sessionState.lossCooldownTicks,
      use_sma50_guard: sessionState.useSma50Guard,
      use_strict_martingale: sessionState.useStrictMartingale,
      active_session_db_id: sessionState.activeSessionDbId || null,
      session_traded_volume: sessionState.sessionTradedVolume,
      session_wins: sessionState.sessionWins,
      session_losses: sessionState.sessionLosses,
      session_trades_count: sessionState.sessionTradesCount,
      device_id: sessionState.device_id,
      last_heartbeat: sessionState.last_heartbeat,
      updated_at: sessionState.updated_at
    };

    const res = await fetch(saveUrl, {
      method,
      headers,
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.warn("Failed to save session state to Supabase:", res.status, await res.text());
    }
  } catch (err) {
    console.warn("Error saving session state to Supabase:", err);
  }
}

async function updateSessionHeartbeat(accountId, forceWrite = false) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  try {
    const url = `${SUPABASE_URL}/rest/v1/active_sessions?account_id=eq.${accountId}`;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };
    
    if (!forceWrite) {
      // Check if another device has taken over the lock
      const res = await fetch(url, { method: 'GET', headers });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          const dbDeviceId = rows[0].device_id;
          if (dbDeviceId && dbDeviceId !== deviceId) {
            addLog("🚨 Session takeover detected. Halting bot immediately to prevent double-trading.", "error");
            sendPushNotification("🚨 Session Taken Over", "Trading halted because this session was resumed on another device.");
            stopTrading("Takeover by another device");
            return;
          }
        }
      }
    }
    
    const payload = {
      last_heartbeat: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      device_id: deviceId // Always keep device_id updated to our lock
    };

    await fetch(url, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(payload)
    });
  } catch (err) {
    console.warn("Error updating session heartbeat:", err);
  }
}

function startHeartbeatLoop(accountId) {
  if (heartbeatIntervalId) clearInterval(heartbeatIntervalId);
  // Force first heartbeat write immediately to override lock and avoid startup race checks
  updateSessionHeartbeat(accountId, true);
  heartbeatIntervalId = setInterval(() => {
    if (!isTrading) {
      clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = null;
      return;
    }
    updateSessionHeartbeat(accountId, false);
  }, 10000);
}

function clearSessionState() {
  localStorage.removeItem('deriv_bot_active_session');
  activeSessionCache = null;
  
  if (heartbeatIntervalId) {
    clearInterval(heartbeatIntervalId);
    heartbeatIntervalId = null;
  }
  
  chartTradeMarkers = [];
  if (typeof drawChart === 'function') {
    drawChart();
  }

  const acct = currentAuthorizedAccount || localStorage.getItem('deriv_acct');
  if (acct && SUPABASE_URL && SUPABASE_ANON_KEY) {
    const cleanAcct = acct.trim().toUpperCase();
    const url = `${SUPABASE_URL}/rest/v1/active_sessions?account_id=eq.${cleanAcct}`;
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
    };
    fetch(url, { method: 'DELETE', headers })
      .catch(err => console.warn("Failed to delete session state from Supabase:", err));
  }
}

async function checkActiveSession() {
  if (!resumeSessionContainer) return;
  
  const currentAcct = localStorage.getItem('deriv_acct');
  if (!currentAcct) {
    resumeSessionContainer.classList.add('hidden');
    if (!isTrading) startBotBtn.classList.remove('hidden');
    return;
  }
  const cleanCurrent = currentAcct.trim().toUpperCase();

  let state = null;
  
  // 1. Fetch from Supabase Cloud
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      const url = `${SUPABASE_URL}/rest/v1/active_sessions?account_id=eq.${cleanCurrent}`;
      const headers = {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      };
      const res = await fetch(url, { method: 'GET', headers });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows.length > 0) {
          const row = rows[0];
          state = {
            account_id: row.account_id,
            initialStake: parseFloat(row.initial_stake),
            currentStake: parseFloat(row.current_stake),
            currentMartingaleStep: parseInt(row.current_martingale_step),
            sessionProfit: parseFloat(row.session_profit),
            targetProfit: parseFloat(row.target_profit),
            stopLoss: parseFloat(row.stop_loss),
            maxMartingaleSteps: parseInt(row.max_martingale_steps),
            martingaleMultiplier: parseFloat(row.martingale_multiplier),
            lossCooldownTicks: parseInt(row.loss_cooldown_ticks),
            useSma50Guard: row.use_sma50_guard,
            useStrictMartingale: row.use_strict_martingale,
            activeSessionDbId: row.active_session_db_id,
            sessionTradedVolume: parseFloat(row.session_traded_volume),
            sessionWins: parseInt(row.session_wins),
            sessionLosses: parseInt(row.session_losses),
            sessionTradesCount: parseInt(row.session_trades_count),
            device_id: row.device_id,
            last_heartbeat: row.last_heartbeat
          };
        }
      }
    } catch (e) {
      console.warn("Failed to check active session from Supabase, falling back to localStorage:", e);
    }
  }

  // 2. Fall back to local storage backup
  if (!state) {
    const sessionData = localStorage.getItem('deriv_bot_active_session');
    if (sessionData) {
      try {
        const saved = JSON.parse(sessionData);
        const cleanSaved = saved.account_id ? saved.account_id.trim().toUpperCase() : "";
        if (saved && cleanSaved === cleanCurrent) {
          state = saved;
        }
      } catch (e) {
        console.error("Failed to parse local active session:", e);
      }
    }
  }

  if (state && !isTrading) {
    activeSessionCache = state;
    
    // Check if active on another device (heartbeat fresh)
    let isLockedOnOtherDevice = false;
    let secondsSinceLastHeartbeat = 999;
    
    if (state.last_heartbeat && state.device_id !== deviceId) {
      const lastHeartTime = new Date(state.last_heartbeat).getTime();
      secondsSinceLastHeartbeat = Math.round((Date.now() - lastHeartTime) / 1000);
      if (secondsSinceLastHeartbeat >= 0 && secondsSinceLastHeartbeat < 45) {
        isLockedOnOtherDevice = true;
      }
    }

    resumeStep.innerText = state.currentMartingaleStep;
    resumeStake.innerText = `$${parseFloat(state.currentStake).toFixed(2)}`;
    
    const profit = parseFloat(state.sessionProfit);
    resumeProfit.innerText = `${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`;
    
    if (profit >= 0) {
      resumeProfit.className = "profit-won";
      resumeProfit.style.color = "var(--color-success)";
    } else {
      resumeProfit.className = "profit-lost";
      resumeProfit.style.color = "var(--color-danger)";
    }

    const badgeId = 'deviceLockBadge';
    let badge = document.getElementById(badgeId);

    if (isLockedOnOtherDevice) {
      if (!badge) {
        badge = document.createElement('div');
        badge.id = badgeId;
        badge.style.background = "rgba(239, 68, 68, 0.1)";
        badge.style.color = "var(--color-danger)";
        badge.style.border = "1px solid rgba(239, 68, 68, 0.2)";
        badge.style.borderRadius = "4px";
        badge.style.padding = "6px 8px";
        badge.style.fontSize = "10px";
        badge.style.marginTop = "8px";
        badge.style.textAlign = "center";
        badge.style.fontWeight = "600";
        resumeSessionContainer.insertBefore(badge, resumeSessionContainer.firstChild);
      }
      badge.innerText = `⚠️ Active on another device (Heartbeat: ${secondsSinceLastHeartbeat}s ago)`;
      if (resumeBotBtn) {
        resumeBotBtn.style.boxShadow = "0 0 10px rgba(239, 68, 68, 0.5)";
      }
    } else {
      if (badge) badge.remove();
      if (resumeBotBtn) {
        resumeBotBtn.style.boxShadow = "";
      }
    }

    resumeSessionContainer.classList.remove('hidden');
    startBotBtn.classList.add('hidden');
    return;
  }
  
  const badge = document.getElementById('deviceLockBadge');
  if (badge) badge.remove();
  
  resumeSessionContainer.classList.add('hidden');
  if (!isTrading) {
    startBotBtn.classList.remove('hidden');
  }
}

// Event Listeners for Session Recovery
if (resumeBotBtn) {
  resumeBotBtn.addEventListener('click', async () => {
    const state = activeSessionCache;
    if (!state) return;

    // Concurrency Warning & Takeover
    if (state.last_heartbeat && state.device_id !== deviceId) {
      const lastHeartTime = new Date(state.last_heartbeat).getTime();
      const secondsSinceLastHeartbeat = Math.round((Date.now() - lastHeartTime) / 1000);
      if (secondsSinceLastHeartbeat >= 0 && secondsSinceLastHeartbeat < 45) {
        const confirmOverride = confirm(`⚠️ Warning: This session is currently active on another device (Heartbeat: ${secondsSinceLastHeartbeat}s ago).\n\nResuming here will override and takeover the session, which might disrupt trading on the other device.\n\nDo you want to continue?`);
        if (!confirmOverride) return;
      }
    }

    try {
      // Restore session variables
      initialStake = parseFloat(state.initialStake);
      currentStake = parseFloat(state.currentStake);
      currentMartingaleStep = parseInt(state.currentMartingaleStep);
      sessionProfit = parseFloat(state.sessionProfit);
      targetProfit = parseFloat(state.targetProfit);
      stopLoss = parseFloat(state.stopLoss);
      maxMartingaleSteps = parseInt(state.maxMartingaleSteps);
      martingaleMultiplier = parseFloat(state.martingaleMultiplier !== undefined ? state.martingaleMultiplier : 2.0);
      lossCooldownTicks = parseInt(state.lossCooldownTicks);
      useSma50Guard = state.useSma50Guard;
      useStrictMartingale = state.useStrictMartingale;
      activeSessionDbId = state.activeSessionDbId;
      sessionTradedVolume = parseFloat(state.sessionTradedVolume || 0);
      sessionWins = parseInt(state.sessionWins || 0);
      sessionLosses = parseInt(state.sessionLosses || 0);
      sessionTradesCount = parseInt(state.sessionTradesCount || 0);

      // Update inputs on the UI
      stakeInput.value = initialStake;
      targetProfitInput.value = targetProfit;
      stopLossInput.value = stopLoss;
      martingaleStepsInput.value = maxMartingaleSteps;
      if (martingaleMultiplierInput) martingaleMultiplierInput.value = martingaleMultiplier;
      
      // sma50GuardCheckbox removed from UI
      // strictMartingale always on

      // Update profit display
      updateProfitDisplay();

      // Disable inputs and toggle buttons
      toggleInputs(true);
      resumeSessionContainer.classList.add('hidden');
      startBotBtn.classList.add('hidden');
      stopBotBtn.classList.remove('hidden');

      // Set active trading state
      isTrading = true;
      statusText.innerText = "Bot is Active";
      statusIndicator.className = "status-bar status-running";

      requestWakeLock();
      startKeepAlive();

      addLog(`🔄 Session Resumed! Step: ${currentMartingaleStep} | Stake: $${currentStake.toFixed(2)} | Profit: $${sessionProfit.toFixed(2)}`, "success");
      sendPushNotification("🤖 Bot Resumed", `Continuing V75 scalper session...\nNext Stake: $${currentStake.toFixed(2)} | Session Profit: $${sessionProfit.toFixed(2)}`);

      // Overwrite the device lock with our current device ID
      state.device_id = deviceId;
      state.last_heartbeat = new Date().toISOString();
      saveSessionState();

      // Start the heartbeat updater
      const cleanAcct = (state.account_id || localStorage.getItem('deriv_acct')).trim().toUpperCase();
      startHeartbeatLoop(cleanAcct);

    } catch (e) {
      console.error("Error resuming session:", e);
      addLog("Failed to resume session. Starting clean instead.", "error");
      clearSessionState();
      resumeSessionContainer.classList.add('hidden');
      startBotBtn.classList.remove('hidden');
    }
  });
}

if (discardSessionBtn) {
  discardSessionBtn.addEventListener('click', () => {
    if (confirm("Are you sure you want to discard this session and start fresh? This cannot be undone.")) {
      clearSessionState();
      resumeSessionContainer.classList.add('hidden');
      startBotBtn.classList.remove('hidden');
      addLog("🧹 Unfinished session discarded.", "info");
    }
  });
}

// ════════════════════════════════════════════
//             AUTO-RECONNECT HEARTBEAT
// ════════════════════════════════════════════

function handleWebSocketDisconnect() {
  isAuthorized = false;

  if (isTrading) {
    if (reconnectAttempts < maxReconnectAttempts) {
      isReconnecting = true;
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000); // Exponential backoff up to 10s

      statusText.innerText = `Reconnecting (${reconnectAttempts}/${maxReconnectAttempts})...`;
      statusIndicator.className = "status-bar status-idle"; // Set to idle warning state
      addLog(`⚠️ WebSocket disconnected. Attempting auto-reconnect ${reconnectAttempts}/${maxReconnectAttempts} in ${(delay/1000).toFixed(0)}s...`, "warn");
      sendPushNotification("⚠️ Bot Connection Lost", `Attempting auto-reconnect ${reconnectAttempts}/${maxReconnectAttempts}...`);

      if (reconnectTimeoutId) clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = setTimeout(() => {
        connectWebSocket();
      }, delay);
    } else {
      isReconnecting = false;
      reconnectAttempts = 0;
      stopTrading("Connection permanently lost after maximum retry attempts.");
      alert("🚨 Connection Lost!\nThe bot was unable to reconnect to Deriv after 5 attempts. Trading has been stopped to protect your account.");
    }
  } else {
    isReconnecting = false;
    reconnectAttempts = 0;
  }
}

// ════════════════════════════════════════════
//             REAL-TIME TICK CHART DRAWING
// ════════════════════════════════════════════

function drawChart() {
  const canvas = document.getElementById('tickChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Scale the canvas for high-DPR screens to keep lines sharp
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;

  // Clear background
  ctx.clearRect(0, 0, width, height);

  // If no candle history is loaded, show placeholder text
  if (!candlesHistory || candlesHistory.length === 0) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Waiting for live candles feed...", width / 2, height / 2);
    return;
  }

  // Draw last 50 candles for the premium visual representation
  const drawCandles = candlesHistory.slice(-50);
  
  // Use cached EMA arrays (no recalculation — zero extra cost per draw)
  const ema9Values = _cachedEma9.slice(-50);
  const ema21Values = _cachedEma21.slice(-50);

  // Calculate min and max bounds for y-axis scaling
  let minVal = Infinity;
  let maxVal = -Infinity;
  for (let i = 0; i < drawCandles.length; i++) {
    const c = drawCandles[i];
    minVal = Math.min(minVal, c.low);
    maxVal = Math.max(maxVal, c.high);
    
    if (ema9Values[i] !== null && ema9Values[i] !== undefined) {
      minVal = Math.min(minVal, ema9Values[i]);
      maxVal = Math.max(maxVal, ema9Values[i]);
    }
    if (ema21Values[i] !== null && ema21Values[i] !== undefined) {
      minVal = Math.min(minVal, ema21Values[i]);
      maxVal = Math.max(maxVal, ema21Values[i]);
    }
  }

  const range = maxVal - minVal;
  const padding = range > 0 ? range * 0.08 : 0.5;
  minVal -= padding;
  maxVal += padding;

  const rightMargin = 45; // pixels reserved for current price badge
  const chartWidth = width - rightMargin;

  // 1. Draw Grid Lines
  ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let g = 1; g < 4; g++) {
    const gy = (g / 4) * height;
    ctx.moveTo(0, gy);
    ctx.lineTo(chartWidth, gy);
  }
  ctx.stroke();

  // 2. Draw Candlesticks
  // Fixed 50-slot layout: candles always occupy the same slot width regardless of
  // how many candles are currently loaded. This prevents mobile stretching on startup.
  const TOTAL_SLOTS = 50;
  const slotWidth = chartWidth / TOTAL_SLOTS;
  const candleWidth = Math.max(2, Math.floor(slotWidth * 0.65));
  // First candle starts at slot (TOTAL_SLOTS - drawCandles.length)
  const startSlot = TOTAL_SLOTS - drawCandles.length;

  for (let i = 0; i < drawCandles.length; i++) {
    const c = drawCandles[i];
    // x is the center of this candle's slot
    const x = ((startSlot + i) + 0.5) * slotWidth;
    
    const yOpen = height - ((c.open - minVal) / (maxVal - minVal)) * height;
    const yClose = height - ((c.close - minVal) / (maxVal - minVal)) * height;
    const yHigh = height - ((c.high - minVal) / (maxVal - minVal)) * height;
    const yLow = height - ((c.low - minVal) / (maxVal - minVal)) * height;

    const isBullish = c.close >= c.open;
    const color = isBullish ? '#10b981' : '#f43f5e'; // green vs red

    // Draw Wick (High to Low line)
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();

    // Draw Body (Open to Close rectangle)
    ctx.fillStyle = color;
    const yTop = Math.min(yOpen, yClose);
    const yBottom = Math.max(yOpen, yClose);
    const bodyHeight = Math.max(1, yBottom - yTop);
    ctx.fillRect(x - candleWidth / 2, yTop, candleWidth, bodyHeight);
  }

  // 3. Draw EMA-9 Line (Gold)
  ctx.strokeStyle = "#f59e0b"; // gold
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let ema9Started = false;
  for (let i = 0; i < drawCandles.length; i++) {
    if (ema9Values[i] !== null && ema9Values[i] !== undefined) {
      const x = ((startSlot + i) + 0.5) * slotWidth;
      const y = height - ((ema9Values[i] - minVal) / (maxVal - minVal)) * height;
      if (!ema9Started) {
        ctx.moveTo(x, y);
        ema9Started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();

  // 4. Draw EMA-21 Line (Pink)
  ctx.strokeStyle = "#ec4899"; // pink
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  let ema21Started = false;
  for (let i = 0; i < drawCandles.length; i++) {
    if (ema21Values[i] !== null && ema21Values[i] !== undefined) {
      const x = ((startSlot + i) + 0.5) * slotWidth;
      const y = height - ((ema21Values[i] - minVal) / (maxVal - minVal)) * height;
      if (!ema21Started) {
        ctx.moveTo(x, y);
        ema21Started = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
  }
  ctx.stroke();

  // 5. Draw Horizontal Price level tracker and Badge
  const lastPriceVal = drawCandles[drawCandles.length - 1].close;
  const currentY = height - ((lastPriceVal - minVal) / (maxVal - minVal)) * height;

  ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(0, currentY);
  ctx.lineTo(chartWidth, currentY);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // Draw price badge background
  ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(width - 43, currentY - 8, 41, 16, 4);
  } else {
    ctx.rect(width - 43, currentY - 8, 41, 16);
  }
  ctx.fill();
  ctx.stroke();

  // Draw price text
  ctx.fillStyle = "#38bdf8";
  ctx.font = "bold 9px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(lastPriceVal.toFixed(2), width - 22, currentY);

  // 6. Draw Trade Markers
  for (let i = 0; i < chartTradeMarkers.length; i++) {
    const marker = chartTradeMarkers[i];
    const idx = drawCandles.findIndex(c => c.epoch === marker.epoch);
    if (idx !== -1) {
      const x = ((startSlot + idx) + 0.5) * slotWidth;
      const y = height - ((marker.price - minVal) / (maxVal - minVal)) * height;

      let markerColor = "#f59e0b"; // gold/yellow for pending
      if (marker.result === 'win') markerColor = "#10b981"; // green
      else if (marker.result === 'loss') markerColor = "#ef4444"; // red

      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, 2 * Math.PI);
      ctx.fillStyle = markerColor;
      ctx.shadowColor = markerColor;
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Draw direction arrows
      ctx.fillStyle = markerColor;
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      if (marker.type === 'CALL') {
        ctx.textBaseline = "bottom";
        ctx.fillText("▲", x, y - 5);
      } else {
        ctx.textBaseline = "top";
        ctx.fillText("▼", x, y + 5);
      }
    }
  }
}


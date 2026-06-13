// ════════════════════════════════════════════
//              BOT CONFIGURATION & RULES
// ════════════════════════════════════════════

// 1. Deriv App ID (Use a registered App ID for OAuth, or 61247 for general testing)
const APP_ID = '61247'; 

// 2. White-listed Accounts list. Add CR numbers here to grant access.
// Both Virtual (VRTC) and Real (CR) accounts can be added here.
const APPROVED_ACCOUNTS = [
  'VRTC123456',  // Example Virtual account
  'CR123456',    // Example Real account
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

// DOM Elements
const loginPanel = document.getElementById('loginPanel');
const consolePanel = document.getElementById('consolePanel');
const loginBtn = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const accountLabel = document.getElementById('accountLabel');
const accountID = document.getElementById('accountID');
const balanceText = document.getElementById('balanceText');
const profitText = document.getElementById('profitText');
const livePrice = document.getElementById('livePrice');
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

// ════════════════════════════════════════════
//         OAUTH FLOW & AUTHENTICATION
// ════════════════════════════════════════════

// Check URL parameters on page load
window.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token1');
  const acct = urlParams.get('acct1');

  if (token && acct) {
    localStorage.setItem('deriv_token', token);
    localStorage.setItem('deriv_acct', acct);
    // Clean up URL parameters so they aren't visible in address bar
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  checkAuth();
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
    return data && data.length > 0;
  } catch (err) {
    console.error("Supabase error, falling back to local whitelist:", err);
    return APPROVED_ACCOUNTS.some(approved => 
      approved.trim().toUpperCase() === acct.trim().toUpperCase()
    );
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
    
    accountID.innerText = acct;
    if (acct.toUpperCase().startsWith('VRTC')) {
      accountLabel.innerText = "Virtual Account";
      accountLabel.style.background = "rgba(56, 189, 248, 0.1)";
      accountLabel.style.color = "var(--color-primary)";
    } else {
      accountLabel.innerText = "Real Account";
      accountLabel.style.background = "rgba(16, 185, 129, 0.1)";
      accountLabel.style.color = "var(--color-success)";
    }

    connectWebSocket();
  } else {
    // Show login page
    loginPanel.classList.add('active');
    consolePanel.classList.remove('active');
  }
}

// Redirect to Deriv OAuth page
loginBtn.addEventListener('click', () => {
  const redirectUri = window.location.href.split('?')[0];
  const oauthUrl = `https://oauth.deriv.com/oauth2/authorize?app_id=${APP_ID}&l=en&signup_device=mobile`;
  window.location.href = oauthUrl;
});

logoutBtn.addEventListener('click', logout);

function logout() {
  localStorage.removeItem('deriv_token');
  localStorage.removeItem('deriv_acct');
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

function connectWebSocket() {
  addLog("Connecting to Deriv WebSocket server...", "info");
  
  socket = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${APP_ID}`);

  socket.onopen = () => {
    addLog("Socket connected. Authorizing...", "info");
    const token = localStorage.getItem('deriv_token');
    
    // Authorize socket connection
    socket.send(JSON.stringify({
      authorize: token
    }));
  };

  socket.onclose = () => {
    addLog("WebSocket disconnected.", "warn");
    isAuthorized = false;
    if (isTrading) {
      stopTrading("Disconnect event detected.");
    }
  };

  socket.onerror = (error) => {
    console.error("WS Error:", error);
    addLog("Network connection error encountered.", "error");
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleMessage(data);
  };
}

// ════════════════════════════════════════════
//             INCOMING MESSAGES
// ════════════════════════════════════════════

function handleMessage(data) {
  const msgType = data.msg_type;

  if (msgType === 'authorize') {
    if (data.error) {
      addLog(`Authorization failed: ${data.error.message}`, "error");
      logout();
    } else {
      isAuthorized = true;
      addLog("Successfully Authorized!", "success");
      
      // Update Balance
      const balance = data.authorize.balance;
      const currency = data.authorize.currency;
      balanceText.innerText = `$${parseFloat(balance).toFixed(2)}`;
      
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
    }
  }

  else if (msgType === 'tick') {
    if (!data.error && data.tick) {
      processTick(data.tick);
    }
  }

  else if (msgType === 'proposal') {
    if (!data.error && data.proposal) {
      if (isTrading && activePurchaseProposal === data.proposal.echo_req.contract_type) {
        currentProposalId = data.proposal.id;
        buyContract(currentProposalId);
      }
    }
  }

  else if (msgType === 'buy') {
    if (data.error) {
      addLog(`Failed to place order: ${data.error.message}`, "error");
      activePurchaseProposal = null;
      currentProposalId = null;
      if (isTrading) {
        statusText.innerText = "Bot is Active";
        statusIndicator.className = "status-bar status-running";
      }
    } else {
      currentContractId = data.buy.contract_id;
      addLog(`Order placed successfully. ID: ${currentContractId}`, "info");
      
      // Subscribe to this specific contract's updates to check outcome
      socket.send(JSON.stringify({
        proposal_open_contract: 1,
        contract_id: currentContractId,
        subscribe: 1
      }));
    }
  }

  else if (msgType === 'proposal_open_contract') {
    if (!data.error && data.proposal_open_contract) {
      const contract = data.proposal_open_contract;
      
      // Check if trade is complete
      if (contract.is_expired === 1 || contract.status !== 'open') {
        // Unsubscribe from this contract
        socket.send(JSON.stringify({
          proposal_open_contract: 1,
          contract_id: contract.contract_id,
          unsubscribe: 1
        }));

        handleTradeOutcome(contract);
      }
    }
  }
}

// ════════════════════════════════════════════
//           TICK PROCESSOR & STRATEGY
// ════════════════════════════════════════════

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

  // Keep a record of the last 4 prices to analyze patterns
  ticksHistory.push(price);
  if (ticksHistory.length > 4) {
    ticksHistory.shift();
  }

  // Execute strategy if trading is active and not waiting on a trade
  if (isTrading && activePurchaseProposal === null && currentContractId === null) {
    evaluateStrategyPattern();
  }
}

function evaluateStrategyPattern() {
  if (ticksHistory.length < 4) return;

  const t0 = ticksHistory[0];
  const t1 = ticksHistory[1];
  const t2 = ticksHistory[2];
  const t3 = ticksHistory[3];

  // 1. Mean-Reversion Pattern: 3 consecutive drops -> Buy Rise (CALL)
  if (t1 < t0 && t2 < t1 && t3 < t2) {
    addLog(`Pattern Match: 3 drops detected. Buying RISE...`, "info");
    proposeTrade("CALL");
  }
  // 2. Mean-Reversion Pattern: 3 consecutive rises -> Buy Fall (PUT)
  else if (t1 > t0 && t2 > t1 && t3 > t2) {
    addLog(`Pattern Match: 3 rises detected. Buying FALL...`, "info");
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

  // Request proposal
  socket.send(JSON.stringify({
    proposal: 1,
    amount: currentStake,
    basis: "stake",
    contract_type: type,
    currency: "USD",
    duration: 1,
    duration_unit: "t",
    symbol: "R_75"
  }));
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
  
  sessionProfit += profit;
  updateProfitDisplay();

  if (status === 'won') {
    addLog(`🎉 WIN! Profit: +$${profit.toFixed(2)}`, "success");
    
    // Reset martingale steps
    currentStake = initialStake;
    currentMartingaleStep = 0;
  } else {
    addLog(`🚨 LOSS! Loss: -$${Math.abs(profit).toFixed(2)}`, "error");
    
    // Martingale management
    currentMartingaleStep++;
    if (currentMartingaleStep >= maxMartingaleSteps) {
      addLog(`⚠️ Max Martingale Steps (${maxMartingaleSteps}) reached. Resetting stake.`, "warn");
      currentStake = initialStake;
      currentMartingaleStep = 0;
    } else {
      currentStake = currentStake * parseFloat(martingaleStepsInput.value === '1' ? 1.0 : 2.0); // Multiply by 2
      addLog(`🔄 Martingale Multiplier applied. Next stake: $${currentStake.toFixed(2)}`, "warn");
    }
  }

  // Clear trade lock state
  activePurchaseProposal = null;
  currentProposalId = null;
  currentContractId = null;

  // Check safety targets
  if (sessionProfit >= targetProfit) {
    addLog(`🏆 TARGET PROFIT REACHED! Session Profit: $${sessionProfit.toFixed(2)}`, "success");
    stopTrading("Target Profit Reached");
    alert(`🏆 Target Profit ($${targetProfit.toFixed(2)}) reached!\nTrading halted to secure profits.`);
  } else if (sessionProfit <= -stopLoss) {
    addLog(`❌ STOP LOSS HIT! Session Loss: -$${Math.abs(sessionProfit).toFixed(2)}`, "error");
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
});

stopBotBtn.addEventListener('click', () => {
  stopTrading("Stopped by user");
});

function stopTrading(reason) {
  isTrading = false;
  activePurchaseProposal = null;
  currentProposalId = null;
  currentContractId = null;

  startBotBtn.classList.remove('hidden');
  stopBotBtn.classList.add('hidden');
  
  statusText.innerText = "Bot is Idle";
  statusIndicator.className = "status-bar status-idle";
  
  toggleInputs(false);
  addLog(`🤖 Bot Halted. Reason: ${reason}`, "warn");
}

function toggleInputs(disabled) {
  stakeInput.disabled = disabled;
  targetProfitInput.disabled = disabled;
  stopLossInput.disabled = disabled;
  martingaleStepsInput.disabled = disabled;
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

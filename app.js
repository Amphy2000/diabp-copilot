/* ═══════════════════════════════════════════════════════════
   MT5 PLATFORM — COMPLETE TRADING ENGINE
   Full replica of MetaTrader 5 mobile app
   With real-time WebSocket feeds and canvas charting
═══════════════════════════════════════════════════════════ */

'use strict';

// ══════════════════════════════════
// STATE
// ══════════════════════════════════
const STATE = {
  balance: 10000,
  openPositions: [],
  pendingOrders: [],
  history: [],
  messages: [],
  nextTicketId: 10001,
  currentTab: 'trade',
  currentSymbol: 'BTCUSD.x',
  currentTF: 'M1',
  sidebarOpen: false,
  chartLot: 0.01,
};

// ══════════════════════════════════
// SYMBOLS CONFIG (.x format)
// ══════════════════════════════════
const SYMBOLS = {
  'BTCUSD.x':  { desc: 'Bitcoin vs US Dollar',     basePrice: 61500,  spread: 50.0, digits: 2, pip: 0.01,  margin: 50.0, category: 'Crypto' },
  'ETHUSD.x':  { desc: 'Ethereum vs US Dollar',    basePrice: 3450,   spread: 2.50, digits: 2, pip: 0.01,  margin: 20.0, category: 'Crypto' },
  'XAUUSD.x':  { desc: 'Gold vs US Dollar',        basePrice: 4071.29, spread: 0.35, digits: 2, pip: 0.01,  margin: 10.0, category: 'Metals' },
  'XAGUSD.x':  { desc: 'Silver vs US Dollar',      basePrice: 32.450, spread: 0.040, digits: 3, pip: 0.001, margin: 5.0,  category: 'Metals' },
  'EURUSD.x':  { desc: 'Euro vs US Dollar',        basePrice: 1.08920, spread: 0.00020, digits: 5, pip: 0.0001, margin: 3.33, category: 'FX' },
  'GBPUSD.x':  { desc: 'British Pound vs Dollar',  basePrice: 1.27345, spread: 0.00025, digits: 5, pip: 0.0001, margin: 3.33, category: 'FX' },
  'USDJPY.x':  { desc: 'US Dollar vs Yen',         basePrice: 156.420, spread: 0.020, digits: 3, pip: 0.01,  margin: 3.33, category: 'FX' },
  'NAS100.x':  { desc: 'NASDAQ 100 Index',         basePrice: 21450,  spread: 1.5,   digits: 1, pip: 0.1,   margin: 25.0, category: 'Indices' },
  'US30.x':    { desc: 'Dow Jones Index',          basePrice: 43200,  spread: 2.5,   digits: 1, pip: 0.1,   margin: 25.0, category: 'Indices' },
  'USOIL.x':   { desc: 'US Crude Oil',             basePrice: 72.50,  spread: 0.04,  digits: 2, pip: 0.01,  margin: 5.0,  category: 'Energy' },
};

// Live prices
const PRICES = {};
for (const sym in SYMBOLS) {
  PRICES[sym] = { bid: SYMBOLS[sym].basePrice, ask: SYMBOLS[sym].basePrice + SYMBOLS[sym].spread };
}

// ══════════════════════════════════
// PRICE ENGINE & WEBSOCKET/API INTEGRATION
// ══════════════════════════════════
let binanceWS = null;

// Connect to Binance WebSocket for crypto ticker feeds
function connectCryptoWS() {
  if (binanceWS) {
    try { binanceWS.close(); } catch(e){}
  }
  // Binance WS miniTicker is completely public, free and CORS-free
  binanceWS = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@miniTicker/ethusdt@miniTicker');

  binanceWS.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const binanceSym = data.s; // "BTCUSDT" or "ETHUSDT"
      const price = parseFloat(data.c);
      let sym = '';
      if (binanceSym === 'BTCUSDT') sym = 'BTCUSD.x';
      if (binanceSym === 'ETHUSDT') sym = 'ETHUSD.x';

      if (sym && PRICES[sym]) {
        const cfg = SYMBOLS[sym];
        PRICES[sym].bid = parseFloat(price.toFixed(cfg.digits));
        PRICES[sym].ask = parseFloat((PRICES[sym].bid + cfg.spread).toFixed(cfg.digits));

        if (STATE.currentSymbol === sym && chartData.length > 0) {
          updateLiveCandle(sym, PRICES[sym].bid);
        }
        updateQuotesUI();
        updatePositionPnl();
        checkPendingOrders();
        updateQuickOrderBarPrices();
      }
    } catch(e) {
      console.error("Error parsing Binance WS message:", e);
    }
  };

  binanceWS.onclose = () => {
    console.log("Binance WS closed. Reconnecting in 5s...");
    setTimeout(connectCryptoWS, 5000);
  };
}

// Poll XAUUSD and XAGUSD from free gold-api
function pollGoldAPI() {
  // Gold (XAU)
  fetch('https://api.gold-api.com/price/XAU')
    .then(res => res.json())
    .then(data => {
      if (data && data.price) {
        const price = parseFloat(data.price);
        const cfg = SYMBOLS['XAUUSD.x'];
        PRICES['XAUUSD.x'].bid = parseFloat(price.toFixed(cfg.digits));
        PRICES['XAUUSD.x'].ask = parseFloat((PRICES['XAUUSD.x'].bid + cfg.spread).toFixed(cfg.digits));
        
        if (STATE.currentSymbol === 'XAUUSD.x') {
          // If baseline jumps significantly, regenerate candles
          if (chartData.length === 0 || Math.abs(chartData[chartData.length - 1].close - price) > price * 0.005) {
            chartData = generateCandles('XAUUSD.x', STATE.currentTF);
          } else {
            updateLiveCandle('XAUUSD.x', PRICES['XAUUSD.x'].bid);
          }
          drawChart();
        }
      }
    })
    .catch(e => console.error("Error polling Gold API (XAU):", e));

  // Silver (XAG)
  fetch('https://api.gold-api.com/price/XAG')
    .then(res => res.json())
    .then(data => {
      if (data && data.price) {
        const price = parseFloat(data.price);
        const cfg = SYMBOLS['XAGUSD.x'];
        PRICES['XAGUSD.x'].bid = parseFloat(price.toFixed(cfg.digits));
        PRICES['XAGUSD.x'].ask = parseFloat((PRICES['XAGUSD.x'].bid + cfg.spread).toFixed(cfg.digits));

        if (STATE.currentSymbol === 'XAGUSD.x') {
          if (chartData.length === 0 || Math.abs(chartData[chartData.length - 1].close - price) > price * 0.005) {
            chartData = generateCandles('XAGUSD.x', STATE.currentTF);
          } else {
            updateLiveCandle('XAGUSD.x', PRICES['XAGUSD.x'].bid);
          }
          drawChart();
        }
      }
    })
    .catch(e => console.error("Error polling Gold API (XAG):", e));
}

// Smooth micro-ticking for symbols in watchlist, including intermediate Gold ticks
function tickPrices() {
  for (const sym in PRICES) {
    // Skip crypto as WebSocket handles it tick-by-tick
    if (sym === 'BTCUSD.x' || sym === 'ETHUSD.x') continue;

    const cfg = SYMBOLS[sym];
    // Gold/Silver tick smoothly around their API baseline
    const multiplier = (sym === 'XAUUSD.x' || sym === 'XAGUSD.x') ? 0.00005 : 0.00015;
    const volatility = cfg.basePrice * multiplier;
    const move = (Math.random() - 0.5) * volatility;
    
    PRICES[sym].bid = parseFloat((PRICES[sym].bid + move).toFixed(cfg.digits));
    PRICES[sym].ask = parseFloat((PRICES[sym].bid + cfg.spread).toFixed(cfg.digits));

    // Limit deviation for forex/indices
    if (sym !== 'XAUUSD.x' && sym !== 'XAGUSD.x') {
      const maxDev = cfg.basePrice * 0.05;
      if (Math.abs(PRICES[sym].bid - cfg.basePrice) > maxDev) {
        PRICES[sym].bid += (cfg.basePrice - PRICES[sym].bid) * 0.1;
      }
    }

    if (STATE.currentSymbol === sym && chartData.length > 0) {
      updateLiveCandle(sym, PRICES[sym].bid);
    }
  }

  updateQuotesUI();
  updatePositionPnl();
  checkPendingOrders();
  updateQuickOrderBarPrices();
}

// Start engines
connectCryptoWS();
pollGoldAPI();
setInterval(pollGoldAPI, 10000); // Poll every 10s
setInterval(tickPrices, 800);    // Smooth ticks every 800ms

// ══════════════════════════════════
// TAB NAVIGATION
// ══════════════════════════════════
function setTab(tab) {
  STATE.currentTab = tab;
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById(`tab-${tab}`);
  const navBtn = document.getElementById(`nav-${tab}`);
  if (panel) panel.classList.add('active');
  if (navBtn) navBtn.classList.add('active');

  // Set Top Bar Actions
  const chartActions = document.getElementById('chartTopActions');
  const normalActions = document.getElementById('topActions');
  if (tab === 'charts') {
    if (chartActions) chartActions.style.display = 'flex';
    if (normalActions) normalActions.style.display = 'none';
    setTimeout(() => { initChart(); }, 50);
  } else {
    if (chartActions) chartActions.style.display = 'none';
    if (normalActions) normalActions.style.display = 'flex';
  }

  // Update Top Title / Subtitle
  const titles = { quotes: 'Quotes', charts: STATE.currentSymbol, trade: 'Trade', history: 'History', messages: 'Messages' };
  document.getElementById('topTitle').textContent = titles[tab] || tab;

  // Clear Top Subtitle on other tabs, will be handled by Trade updates
  if (tab !== 'trade') {
    document.getElementById('topSubtitle').textContent = '';
  }

  // Update sidebar highlight
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const sideItems = document.querySelectorAll('.sidebar-item');
  const tabIdx = ['quotes','charts','trade','history','messages'].indexOf(tab);
  if (sideItems[tabIdx]) sideItems[tabIdx].classList.add('active');

  if (tab === 'trade') {
    renderPositions();
    renderPendingOrders();
    updateAccountDisplay();
  }
  if (tab === 'history') {
    renderHistory();
    updateHistorySummary();
  }
  if (tab === 'messages') {
    renderMessages();
    unreadMsgs = 0;
    const badge = document.getElementById('msgBadge');
    if (badge) badge.style.display = 'none';
    STATE.messages.forEach(m => m.unread = false);
  }
}

// ══════════════════════════════════
// SIDEBAR
// ══════════════════════════════════
function toggleSidebar() {
  STATE.sidebarOpen = !STATE.sidebarOpen;
  document.getElementById('sidebar').classList.toggle('open', STATE.sidebarOpen);
  document.getElementById('sidebarOverlay').classList.toggle('open', STATE.sidebarOpen);
}

// ══════════════════════════════════
// QUOTES TAB
// ══════════════════════════════════
const prevPrices = {};

function buildQuotesList() {
  const container = document.getElementById('quotesList');
  if (!container) return;
  container.innerHTML = '';
  for (const sym in SYMBOLS) {
    const cfg = SYMBOLS[sym];
    const el = document.createElement('div');
    el.className = 'quote-row';
    el.id = `qrow-${sym}`;
    el.onclick = () => openChartFor(sym);
    el.innerHTML = `
      <div class="q-sym">
        <div class="q-sym-name">${sym}</div>
        <div class="q-sym-desc">${cfg.desc}</div>
      </div>
      <div class="q-bid">
        <div class="q-price price-normal" id="qbid-${sym}">${fmt(PRICES[sym].bid, cfg.digits)}</div>
        <div class="q-spread" id="qspread-${sym}">Spread: ${Math.round(cfg.spread / cfg.pip)}</div>
      </div>
      <div class="q-ask">
        <div class="q-price price-normal" id="qask-${sym}">${fmt(PRICES[sym].ask, cfg.digits)}</div>
      </div>`;
    container.appendChild(el);
    prevPrices[sym] = PRICES[sym].bid;
  }
}

function updateQuotesUI() {
  if (STATE.currentTab !== 'quotes') return;
  for (const sym in PRICES) {
    const cfg = SYMBOLS[sym];
    const bidEl = document.getElementById(`qbid-${sym}`);
    const askEl = document.getElementById(`qask-${sym}`);
    const row = document.getElementById(`qrow-${sym}`);
    if (!bidEl) continue;
    const prev = prevPrices[sym] || PRICES[sym].bid;
    const cur = PRICES[sym].bid;
    const dir = cur > prev ? 'up' : cur < prev ? 'down' : null;
    bidEl.textContent = fmt(cur, cfg.digits);
    askEl.textContent = fmt(PRICES[sym].ask, cfg.digits);
    bidEl.className = 'q-price ' + (dir === 'up' ? 'price-up' : dir === 'down' ? 'price-down' : 'price-normal');
    askEl.className = 'q-price ' + (dir === 'up' ? 'price-up' : dir === 'down' ? 'price-down' : 'price-normal');
    if (dir) {
      row.classList.remove('flash-up', 'flash-down');
      void row.offsetWidth;
      row.classList.add(`flash-${dir}`);
    }
    prevPrices[sym] = cur;
  }
}

function openChartFor(sym) {
  STATE.currentSymbol = sym;
  document.getElementById('topTitle').textContent = sym;
  setTab('charts');
}

// ══════════════════════════════════
// CHART SYMBOL PICKER
// ══════════════════════════════════
function openChartSymbolPicker() {
  buildSymPickerList('');
  document.getElementById('symSearchInput').value = '';
  document.getElementById('symbolPickerModal').classList.add('open');
}

function closeSymbolPicker(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('symbolPickerModal').classList.remove('open');
  }
}

function buildSymPickerList(filter) {
  const list = document.getElementById('symPickerList');
  if (!list) return;
  list.innerHTML = '';
  for (const sym in SYMBOLS) {
    const cfg = SYMBOLS[sym];
    if (filter && !sym.toLowerCase().includes(filter.toLowerCase()) && !cfg.desc.toLowerCase().includes(filter.toLowerCase())) continue;
    const row = document.createElement('div');
    row.className = 'sym-picker-row' + (sym === STATE.currentSymbol ? ' selected' : '');
    row.innerHTML = `
      <div class="spr-left">
        <div class="spr-name">${sym}</div>
        <div class="spr-cat">${cfg.desc} · ${cfg.category}</div>
      </div>
      <div class="spr-price">${fmt(PRICES[sym].bid, cfg.digits)}</div>`;
    row.onclick = () => {
      STATE.currentSymbol = sym;
      document.getElementById('topTitle').textContent = sym;
      closeSymbolPicker();
      setTimeout(() => initChart(), 30);
    };
    list.appendChild(row);
  }
}

function filterSymbols(val) {
  buildSymPickerList(val);
}

// ══════════════════════════════════
// TIMEFRAME PICKER
// ══════════════════════════════════
function openTFPicker() {
  const grid = document.getElementById('tfGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const timeframes = ['M1', 'M5', 'M15', 'H1', 'H4', 'D1'];
  timeframes.forEach(tf => {
    const btn = document.createElement('button');
    btn.className = 'tf-grid-btn' + (tf === STATE.currentTF ? ' active' : '');
    btn.textContent = tf;
    btn.onclick = () => {
      setTimeframe(tf);
      closeTFPicker();
    };
    grid.appendChild(btn);
  });
  document.getElementById('tfPickerModal').classList.add('open');
}

function closeTFPicker(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('tfPickerModal').classList.remove('open');
  }
}

function setTimeframe(tf) {
  STATE.currentTF = tf;
  const pill = document.getElementById('tfPillBtn');
  if (pill) pill.textContent = tf;
  const ctf = document.getElementById('csoTF');
  if (ctf) ctf.textContent = tf;
  chartData = generateCandles(STATE.currentSymbol, tf);
  chartOffset = 0;
  drawChart();
}

// ══════════════════════════════════
// QUICK ORDER BAR (CHART TAB)
// ══════════════════════════════════
function updateQuickOrderBarPrices() {
  if (STATE.currentTab !== 'charts') return;
  const sym = STATE.currentSymbol;
  const cfg = SYMBOLS[sym];
  const bidEl = document.getElementById('qobBid');
  const askEl = document.getElementById('qobAsk');
  if (bidEl) bidEl.textContent = fmt(PRICES[sym].bid, cfg.digits);
  if (askEl) askEl.textContent = fmt(PRICES[sym].ask, cfg.digits);
}

function adjustChartLot(delta) {
  STATE.chartLot = parseFloat((STATE.chartLot + delta).toFixed(2));
  if (STATE.chartLot < 0.01) STATE.chartLot = 0.01;
  const lotEl = document.getElementById('qobLot');
  if (lotEl) lotEl.textContent = STATE.chartLot.toFixed(2);
}

function quickBuy() {
  executeQuickOrder('buy');
}

function quickSell() {
  executeQuickOrder('sell');
}

function executeQuickOrder(type) {
  const sym = STATE.currentSymbol;
  const cfg = SYMBOLS[sym];
  const volume = STATE.chartLot;
  const price = type === 'buy' ? PRICES[sym].ask : PRICES[sym].bid;
  const ticket = STATE.nextTicketId++;
  const now = new Date();
  const timeStr = now.toLocaleString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
  
  // Calculate margin requirement
  const marginReq = volume * cfg.margin * price / 100;

  STATE.openPositions.push({
    id: ticket, symbol: sym,
    type: type, volume: volume, openPrice: price,
    sl: 0, tp: 0, comment: 'Quick order',
    openTime: timeStr, currentPnl: 0, margin: marginReq, cfg
  });
  updatePositionPnl();
  showToast(`#${ticket} ${sym} ${type === 'buy' ? 'Buy' : 'Sell'} ${volume} lots opened`, 'success');
  addMessage('Order Opened', `#${ticket} ${sym} ${type === 'buy' ? 'Buy' : 'Sell'} ${volume} lots @ ${fmt(price, cfg.digits)}`, type);
  
  if (STATE.currentTab === 'trade') {
    renderPositions();
    updateAccountDisplay();
  }
  drawChart();
}

// ══════════════════════════════════
// CHART ENGINE (Canvas Candlestick)
// ══════════════════════════════════
let chartData = [];
let chartOffset = 0;
let chartScale = 1;
let isDragging = false;
let dragStartX = 0;
let dragStartOffset = 0;
let crosshairX = -1, crosshairY = -1;

const TF_MINUTES = { M1:1, M5:5, M15:15, H1:60, H4:240, D1:1440 };

function generateCandles(sym, tf, count = 150) {
  const cfg = SYMBOLS[sym];
  const minutes = TF_MINUTES[tf] || 60;
  const candles = [];
  
  // Baseline price anchors to current live price
  let price = PRICES[sym] ? PRICES[sym].bid : cfg.basePrice;
  const now = Date.now();
  const ms = minutes * 60000;

  for (let i = 0; i < count; i++) {
    const ts = now - (count - i) * ms;
    const volatility = price * (0.0006 + Math.random() * 0.0009);
    const close = price;
    const dir = Math.random() > 0.48 ? -1 : 1;
    const body = volatility * (0.2 + Math.random() * 0.6);
    const open = close + dir * body;
    const high = Math.max(open, close) + volatility * (0.05 + Math.random() * 0.3);
    const low  = Math.min(open, close) - volatility * (0.05 + Math.random() * 0.3);
    const vol = Math.floor(100 + Math.random() * 1000);
    
    candles.push({
      ts,
      open: +open.toFixed(cfg.digits),
      high: +high.toFixed(cfg.digits),
      low: +low.toFixed(cfg.digits),
      close: +close.toFixed(cfg.digits),
      vol
    });
    price = open;
  }
  return candles;
}

function updateLiveCandle(sym, price) {
  if (chartData.length === 0) return;
  const last = chartData[chartData.length - 1];
  last.close = price;
  last.high = Math.max(last.high, price);
  last.low = Math.min(last.low, price);
  drawChart();
}

function initChart() {
  const canvas = document.getElementById('chartCanvas');
  const container = document.getElementById('chartAreaWrap');
  if (!canvas || !container) return;

  canvas.width = container.clientWidth * window.devicePixelRatio;
  canvas.height = container.clientHeight * window.devicePixelRatio;
  canvas.style.width = container.clientWidth + 'px';
  canvas.style.height = container.clientHeight + 'px';

  const csoSym = document.getElementById('csoSymbol');
  if (csoSym) csoSym.textContent = STATE.currentSymbol;
  const csoTF = document.getElementById('csoTF');
  if (csoTF) csoTF.textContent = STATE.currentTF;
  const pillBtn = document.getElementById('tfPillBtn');
  if (pillBtn) pillBtn.textContent = STATE.currentTF;
  const csoDesc = document.getElementById('csoDesc');
  if (csoDesc) csoDesc.textContent = SYMBOLS[STATE.currentSymbol].desc;
  const csoStatus = document.getElementById('csoStatus');
  if (csoStatus) csoStatus.textContent = 'Market open';

  chartData = generateCandles(STATE.currentSymbol, STATE.currentTF);
  chartOffset = 0;
  chartScale = 1;

  setupChartEvents(canvas, container);
  drawChart();
  document.getElementById('topTitle').textContent = STATE.currentSymbol;
}

function setupChartEvents(canvas, container) {
  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  const c = document.getElementById('chartCanvas');

  c.addEventListener('mousemove', e => {
    const rect = c.getBoundingClientRect();
    crosshairX = e.clientX - rect.left;
    crosshairY = e.clientY - rect.top;
    updateCrosshair(container, c);
    if (isDragging) {
      chartOffset = Math.max(0, Math.min(chartData.length - 20, dragStartOffset + (dragStartX - crosshairX) / candleW()));
      drawChart();
    }
  });

  c.addEventListener('mouseleave', () => {
    crosshairX = -1; crosshairY = -1;
    document.getElementById('crosshairV').style.display = 'none';
    document.getElementById('crosshairH').style.display = 'none';
    document.getElementById('chartTooltip').style.display = 'none';
    drawChart();
  });

  c.addEventListener('mousedown', e => {
    isDragging = true;
    dragStartX = e.clientX - c.getBoundingClientRect().left;
    dragStartOffset = chartOffset;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  c.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.15;
    chartScale = Math.max(0.3, Math.min(4, chartScale * delta));
    drawChart();
  }, { passive: false });

  // Touch
  let lastTouchX = 0;
  c.addEventListener('touchstart', e => {
    lastTouchX = e.touches[0].clientX;
    dragStartOffset = chartOffset;
    isDragging = true;
  });
  c.addEventListener('touchmove', e => {
    e.preventDefault();
    const tx = e.touches[0].clientX;
    chartOffset = Math.max(0, Math.min(chartData.length - 20, dragStartOffset + (lastTouchX - tx) / candleW()));
    drawChart();
  }, { passive: false });
  c.addEventListener('touchend', () => { isDragging = false; });
}

function candleW() {
  const canvas = document.getElementById('chartCanvas');
  if (!canvas) return 10;
  const W = canvas.width / window.devicePixelRatio;
  const priceAxisW = 70;
  const available = W - priceAxisW;
  const visible = Math.max(20, Math.min(150, Math.floor(80 / chartScale)));
  return available / visible;
}

function drawChart() {
  const canvas = document.getElementById('chartCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio;
  const W = canvas.width / dpr;
  const H = canvas.height / dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const PRICE_AXIS_W = 70;
  const CHART_W = W - PRICE_AXIS_W;
  const PADDING_TOP = 20, PADDING_BOTTOM = 30;
  const CHART_H = H - PADDING_TOP - PADDING_BOTTOM;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, W, H);

  const visible = Math.max(20, Math.min(150, Math.floor(80 / chartScale)));
  const startIdx = Math.max(0, chartData.length - visible - Math.round(chartOffset));
  const endIdx = Math.min(chartData.length, startIdx + visible);
  const visibleCandles = chartData.slice(startIdx, endIdx);

  if (!visibleCandles.length) return;

  const highs = visibleCandles.map(c => c.high);
  const lows = visibleCandles.map(c => c.low);
  let priceMax = Math.max(...highs);
  let priceMin = Math.min(...lows);
  const pricePad = (priceMax - priceMin) * 0.15 || 1.0;
  priceMax += pricePad;
  priceMin -= pricePad;
  const priceRange = priceMax - priceMin;

  const priceToY = p => PADDING_TOP + ((priceMax - p) / priceRange) * CHART_H;
  const cw = CHART_W / visible;
  const cwBody = Math.max(2, cw * 0.65);

  // Horizontal Grid lines & Price Labels
  ctx.strokeStyle = '#161616';
  ctx.lineWidth = 1;
  const gridSteps = 7;
  for (let i = 0; i <= gridSteps; i++) {
    const y = PADDING_TOP + (CHART_H / gridSteps) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CHART_W, y); ctx.stroke();
    const priceAtY = priceMax - (priceRange / gridSteps) * i;
    const cfg = SYMBOLS[STATE.currentSymbol];
    ctx.fillStyle = '#555555';
    ctx.font = '10px Roboto Mono';
    ctx.textAlign = 'left';
    ctx.fillText(fmt(priceAtY, cfg.digits), CHART_W + 6, y + 3);
  }

  // Vertical grid lines & Time labels
  const timeStep = Math.max(1, Math.floor(visible / 5));
  visibleCandles.forEach((c, i) => {
    if (i % timeStep === 0) {
      const x = (i + 0.5) * cw;
      ctx.strokeStyle = '#161616';
      ctx.beginPath(); ctx.moveTo(x, PADDING_TOP); ctx.lineTo(x, PADDING_TOP + CHART_H); ctx.stroke();
      const d = new Date(c.ts);
      const lbl = TF_MINUTES[STATE.currentTF] >= 1440
        ? d.toLocaleDateString('en', { month:'short', day:'numeric' })
        : d.toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit', hour12: false });
      ctx.fillStyle = '#444444';
      ctx.font = '9px Inter';
      ctx.textAlign = 'center';
      ctx.fillText(lbl, x, H - 8);
    }
  });

  // Candles
  visibleCandles.forEach((candle, i) => {
    const x = (i + 0.5) * cw;
    const isBull = candle.close >= candle.open;
    const color = isBull ? '#26a69a' : '#ef5350';
    const openY = priceToY(candle.open);
    const closeY = priceToY(candle.close);
    const highY = priceToY(candle.high);
    const lowY = priceToY(candle.low);

    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, highY); ctx.lineTo(x, lowY); ctx.stroke();

    const bodyY = Math.min(openY, closeY);
    const bodyH = Math.max(1.5, Math.abs(closeY - openY));
    ctx.fillStyle = color;
    ctx.fillRect(x - cwBody / 2, bodyY, cwBody, bodyH);
  });

  const bidPrice = PRICES[STATE.currentSymbol].bid;
  const askPrice = PRICES[STATE.currentSymbol].ask;
  const bidY = priceToY(bidPrice);
  const askY = priceToY(askPrice);
  const cfg = SYMBOLS[STATE.currentSymbol];

  // Draw Ask line & label (Red)
  if (askY >= PADDING_TOP && askY <= PADDING_TOP + CHART_H) {
    ctx.strokeStyle = '#ef5350'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(0, askY); ctx.lineTo(CHART_W, askY); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#ef5350';
    ctx.fillRect(CHART_W, askY - 8, PRICE_AXIS_W, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Roboto Mono';
    ctx.textAlign = 'left';
    ctx.fillText(fmt(askPrice, cfg.digits), CHART_W + 5, askY + 3);
  }

  // Draw Bid line & label & Timer (Green)
  if (bidY >= PADDING_TOP && bidY <= PADDING_TOP + CHART_H) {
    ctx.strokeStyle = '#26a69a'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(0, bidY); ctx.lineTo(CHART_W, bidY); ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#26a69a';
    ctx.fillRect(CHART_W, bidY - 8, PRICE_AXIS_W, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Roboto Mono';
    ctx.textAlign = 'left';
    ctx.fillText(fmt(bidPrice, cfg.digits), CHART_W + 5, bidY + 3);

    // Candle remaining countdown
    const minutes = TF_MINUTES[STATE.currentTF] || 60;
    const elapsed = Date.now() % (minutes * 60000);
    const remainingSec = Math.floor(((minutes * 60000) - elapsed) / 1000);
    const m = Math.floor(remainingSec / 60);
    const s = remainingSec % 60;
    const timerStr = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

    ctx.fillStyle = '#26a69a';
    ctx.fillRect(CHART_W, bidY + 8, PRICE_AXIS_W, 13);
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px Roboto Mono';
    ctx.fillText(timerStr, CHART_W + 5, bidY + 17);
  }

  // Draw SL/TP lines
  STATE.openPositions.forEach(pos => {
    if (pos.symbol !== STATE.currentSymbol) return;
    if (pos.sl && pos.sl > 0) {
      const y = priceToY(pos.sl);
      ctx.strokeStyle = 'rgba(239,83,80,.6)'; ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CHART_W, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#ef5350'; ctx.font = '9px Inter';
      ctx.fillText(`SL ${fmt(pos.sl, cfg.digits)}`, 4, y - 2);
    }
    if (pos.tp && pos.tp > 0) {
      const y = priceToY(pos.tp);
      ctx.strokeStyle = 'rgba(38,166,154,.6)'; ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CHART_W, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#26a69a'; ctx.font = '9px Inter';
      ctx.fillText(`TP ${fmt(pos.tp, cfg.digits)}`, 4, y - 2);
    }
  });

  // Crosshair Price box
  if (crosshairX >= 0 && crosshairX <= CHART_W && crosshairY >= PADDING_TOP && crosshairY <= PADDING_TOP + CHART_H) {
    const priceAtY = priceMax - (crosshairY - PADDING_TOP) / CHART_H * priceRange;
    ctx.fillStyle = '#555555';
    ctx.fillRect(CHART_W, crosshairY - 8, PRICE_AXIS_W, 16);
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px Roboto Mono';
    ctx.textAlign = 'left';
    ctx.fillText(fmt(priceAtY, cfg.digits), CHART_W + 5, crosshairY + 3);
  }

  canvas._meta = { priceToY, priceMax, priceMin, priceRange, CHART_W, PADDING_TOP, CHART_H, startIdx, visible, cw, visibleCandles, PADDING_BOTTOM };
}

function updateCrosshair(container, canvas) {
  if (crosshairX < 0 || !canvas._meta) return;
  const { CHART_W, PADDING_TOP, CHART_H, cw, visibleCandles } = canvas._meta;
  const vH = document.getElementById('crosshairV');
  const hH = document.getElementById('crosshairH');
  const tt = document.getElementById('chartTooltip');

  if (crosshairX <= CHART_W) {
    vH.style.display = 'block'; vH.style.left = crosshairX + 'px';
    hH.style.display = 'block'; hH.style.top = crosshairY + 'px';
    const candleIdx = Math.max(0, Math.min(visibleCandles.length - 1, Math.floor(crosshairX / cw)));
    const candle = visibleCandles[candleIdx];
    if (candle) {
      const cfg = SYMBOLS[STATE.currentSymbol];
      const d = new Date(candle.ts);
      const timeStr = d.toLocaleString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
      tt.style.display = 'block';
      tt.innerHTML = `<span style="color:#888">${timeStr}</span><br>` +
        `O: <span style="color:#e0e0e0">${fmt(candle.open,cfg.digits)}</span>  ` +
        `H: <span style="color:#26a69a">${fmt(candle.high,cfg.digits)}</span><br>` +
        `L: <span style="color:#ef5350">${fmt(candle.low,cfg.digits)}</span>  ` +
        `C: <span style="color:#e0e0e0">${fmt(candle.close,cfg.digits)}</span>`;
      document.getElementById('chartOHLC').textContent =
        `O: ${fmt(candle.open,cfg.digits)} H: ${fmt(candle.high,cfg.digits)} L: ${fmt(candle.low,cfg.digits)} C: ${fmt(candle.close,cfg.digits)}`;
    }
  } else {
    vH.style.display = 'none'; hH.style.display = 'none';
  }
}

// Live ticks for chart canvas
setInterval(() => {
  if (STATE.currentTab === 'charts' && chartData.length > 0) {
    drawChart();
  }
}, 500);

// ══════════════════════════════════
// ACCOUNT DISPLAY
// ══════════════════════════════════
function updateAccountDisplay() {
  const totalPnl = STATE.openPositions.reduce((sum, p) => sum + (p.currentPnl || 0), 0);
  const equity = STATE.balance + totalPnl;
  const usedMargin = STATE.openPositions.reduce((sum, p) => sum + p.margin, 0);
  const freeMargin = equity - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : 0;

  document.getElementById('balanceDisplay').textContent = fmtMoney(STATE.balance);
  document.getElementById('equityDisplay').textContent = fmtMoney(equity);
  document.getElementById('freeMarginDisplay').textContent = fmtMoney(freeMargin);

  const marginRow = document.getElementById('marginRow');
  const marginLevelRow = document.getElementById('marginLevelRow');
  const subtitleEl = document.getElementById('topSubtitle');

  if (STATE.openPositions.length > 0) {
    if (marginRow) marginRow.style.display = 'flex';
    if (marginLevelRow) marginLevelRow.style.display = 'flex';
    document.getElementById('marginDisplay').textContent = fmtMoney(usedMargin);
    document.getElementById('marginLevelDisplay').textContent = fmtMoney(marginLevel);

    // Show Net P&L in top bar subtitle
    if (STATE.currentTab === 'trade' && subtitleEl) {
      subtitleEl.textContent = (totalPnl >= 0 ? '+' : '') + fmtMoney(totalPnl) + ' USD';
      subtitleEl.style.color = totalPnl >= 0 ? 'var(--green2)' : 'var(--red2)';
      subtitleEl.style.fontWeight = '700';
    }
  } else {
    if (marginRow) marginRow.style.display = 'none';
    if (marginLevelRow) marginLevelRow.style.display = 'none';
    if (STATE.currentTab === 'trade' && subtitleEl) {
      subtitleEl.textContent = '';
    }
  }
}

// ══════════════════════════════════
// ORDER MODAL
// ══════════════════════════════════
let selectedOrderType = 'market_buy';
let editingPendingId = null;

function openNewOrder(sym) {
  const modal = document.getElementById('orderModal');
  const select = document.getElementById('orderSymbol');

  select.innerHTML = '';
  for (const s in SYMBOLS) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = `${s} — ${SYMBOLS[s].desc}`;
    if (s === (sym || STATE.currentSymbol)) opt.selected = true;
    select.appendChild(opt);
  }

  selectOrderType(document.querySelector('.ot-btn[data-type="market_buy"]'));
  updateOrderPrice();
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeNewOrder() {
  document.getElementById('orderModal').classList.remove('open');
  document.body.style.overflow = '';
}

function closeOrderModal(e) {
  if (e.target === e.currentTarget) closeNewOrder();
}

function selectOrderType(btn) {
  document.querySelectorAll('.ot-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedOrderType = btn.dataset.type;

  const priceGroup = document.getElementById('orderPriceGroup');
  const isPending = selectedOrderType !== 'market_buy' && selectedOrderType !== 'market_sell';
  priceGroup.style.opacity = isPending ? '1' : '0.4';
  priceGroup.querySelector('input').disabled = !isPending;

  const placeBtnEl = document.getElementById('placeOrderBtn');
  const isBuy = selectedOrderType.includes('buy');
  placeBtnEl.textContent = isPending ? `Place ${btn.textContent}` : (isBuy ? 'Place Buy' : 'Place Sell');
  placeBtnEl.className = `btn-place ${!isBuy ? 'sell-mode' : ''}`;
}

function updateOrderPrice() {
  const sym = document.getElementById('orderSymbol').value;
  if (!sym || !PRICES[sym]) return;
  const cfg = SYMBOLS[sym];
  const bid = PRICES[sym].bid;
  const ask = PRICES[sym].ask;
  const spread = (ask - bid).toFixed(cfg.digits);

  document.getElementById('opiBid').textContent = fmt(bid, cfg.digits);
  document.getElementById('opiAsk').textContent = fmt(ask, cfg.digits);
  document.getElementById('opiSpread').textContent = spread;
  if (!document.getElementById('orderPrice').disabled) {
    document.getElementById('orderPrice').value = bid.toFixed(cfg.digits);
  }
}

function adjustVolume(delta) {
  const inp = document.getElementById('orderVolume');
  let v = parseFloat(inp.value) + delta;
  v = Math.max(0.01, parseFloat(v.toFixed(2)));
  inp.value = v;
}

function placeOrder() {
  const sym = document.getElementById('orderSymbol').value;
  const cfg = SYMBOLS[sym];
  const volume = parseFloat(document.getElementById('orderVolume').value);
  const sl = parseFloat(document.getElementById('orderSL').value) || 0;
  const tp = parseFloat(document.getElementById('orderTP').value) || 0;
  const comment = document.getElementById('orderComment').value;
  const isPending = selectedOrderType !== 'market_buy' && selectedOrderType !== 'market_sell';
  const isBuy = selectedOrderType.includes('buy');
  const price = isPending ? parseFloat(document.getElementById('orderPrice').value) : (isBuy ? PRICES[sym].ask : PRICES[sym].bid);

  if (!sym || isNaN(volume) || volume <= 0) { showToast('Invalid volume', 'error'); return; }

  const ticket = STATE.nextTicketId++;
  const now = new Date();
  const timeStr = now.toLocaleString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
  const marginReq = volume * cfg.margin * price / 100;

  if (isPending) {
    STATE.pendingOrders.push({
      id: ticket, symbol: sym, type: selectedOrderType, volume,
      price, sl, tp, comment,
      openTime: timeStr, cfg
    });
    showToast(`Pending order #${ticket} placed`, 'success');
    addMessage('Pending Order Placed', `#${ticket} ${sym} ${selectedOrderType.replace(/_/g,' ').toUpperCase()} ${volume} lots @ ${fmt(price, cfg.digits)}`, 'buy');
  } else {
    STATE.openPositions.push({
      id: ticket, symbol: sym,
      type: isBuy ? 'buy' : 'sell',
      volume, openPrice: price,
      sl, tp, comment,
      openTime: timeStr,
      currentPnl: 0,
      margin: marginReq,
      cfg
    });
    updatePositionPnl();
    showToast(`#${ticket} ${sym} ${isBuy ? 'Buy' : 'Sell'} ${volume} lots opened`, 'success');
    addMessage(`Order Opened`, `#${ticket} ${sym} ${isBuy ? 'Buy' : 'Sell'} ${volume} lots @ ${fmt(price, cfg.digits)}`, isBuy ? 'buy' : 'sell');
  }

  renderPositions();
  renderPendingOrders();
  updateAccountDisplay();
  closeNewOrder();
  if (STATE.currentTab === 'charts') drawChart();
}

// ══════════════════════════════════
// POSITION P&L CALCULATOR
// ══════════════════════════════════
function updatePositionPnl() {
  let anyChange = false;
  STATE.openPositions.forEach(pos => {
    const curPrice = pos.type === 'buy' ? PRICES[pos.symbol].bid : PRICES[pos.symbol].ask;
    const diff = pos.type === 'buy' ? curPrice - pos.openPrice : pos.openPrice - curPrice;
    
    // Exact MT5 position P&L calculations
    let pnlCalc = 0;
    const sym = pos.symbol;
    if (sym === 'XAUUSD.x') {
      pnlCalc = diff * pos.volume * 100;
    } else if (sym === 'XAGUSD.x') {
      pnlCalc = diff * pos.volume * 5000;
    } else if (sym === 'BTCUSD.x' || sym === 'ETHUSD.x') {
      pnlCalc = diff * pos.volume;
    } else if (sym.includes('USD.x') && sym.indexOf('USD.x') === 3) {
      pnlCalc = diff * pos.volume * 100000 / curPrice;
    } else if (sym.includes('JPY.x')) {
      pnlCalc = diff * pos.volume * 100000 / 156.42;
    } else if (sym === 'NAS100.x' || sym === 'US30.x') {
      pnlCalc = diff * pos.volume * 10;
    } else if (sym === 'USOIL.x') {
      pnlCalc = diff * pos.volume * 1000;
    } else {
      pnlCalc = diff * pos.volume * 100000;
    }
    pos.currentPnl = parseFloat(pnlCalc.toFixed(2));

    // Check SL/TP
    if (pos.sl > 0) {
      const hit = pos.type === 'buy' ? curPrice <= pos.sl : curPrice >= pos.sl;
      if (hit) { closePositionById(pos.id, 'Stop Loss'); anyChange = true; return; }
    }
    if (pos.tp > 0) {
      const hit = pos.type === 'buy' ? curPrice >= pos.tp : curPrice <= pos.tp;
      if (hit) { closePositionById(pos.id, 'Take Profit'); anyChange = true; return; }
    }
    anyChange = true;
  });

  if (STATE.currentTab === 'trade' && anyChange) {
    updatePositionCards();
    updateAccountDisplay();
  }
}

function updatePositionCards() {
  STATE.openPositions.forEach(pos => {
    const pnlEl = document.getElementById(`pnl-${pos.id}`);
    if (pnlEl) {
      const pnl = pos.currentPnl || 0;
      pnlEl.textContent = (pnl >= 0 ? '+' : '') + pnl.toFixed(2);
      pnlEl.className = 'pos-pnl ' + (pnl >= 0 ? 'pnl-pos' : 'pnl-neg');
    }
    const curPriceEl = document.getElementById(`curprice-${pos.id}`);
    if (curPriceEl) {
      const cfg = SYMBOLS[pos.symbol];
      const curPrice = pos.type === 'buy' ? PRICES[pos.symbol].bid : PRICES[pos.symbol].ask;
      curPriceEl.textContent = fmtPrice(curPrice, cfg.digits);
    }
  });
}

function renderPositions() {
  const list = document.getElementById('positionsList');
  const sec = document.getElementById('posSection');
  if (!list || !sec) return;
  if (!STATE.openPositions.length) {
    sec.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  sec.style.display = 'block';
  list.innerHTML = '';
  STATE.openPositions.forEach(pos => {
    const cfg = SYMBOLS[pos.symbol];
    const isBuy = pos.type === 'buy';
    const pnl = pos.currentPnl || 0;
    const curPrice = isBuy ? PRICES[pos.symbol].bid : PRICES[pos.symbol].ask;
    const card = document.createElement('div');
    card.className = 'pos-card';
    card.onclick = () => openCloseModal(pos.id);
    card.innerHTML = `
      <div class="pos-card-row1">
        <span class="pos-sym-type">
          <span class="pos-sym-text">${pos.symbol}</span>, 
          <span class="${isBuy ? 'pos-type-buy' : 'pos-type-sell'}">${pos.type} ${pos.volume}</span>
        </span>
        <span class="pos-pnl ${pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}" id="pnl-${pos.id}">
          ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
        </span>
      </div>
      <div class="pos-card-row2">
        ${fmtPrice(pos.openPrice, cfg.digits)} &rarr; <span id="curprice-${pos.id}">${fmtPrice(curPrice, cfg.digits)}</span>
      </div>`;
    list.appendChild(card);
  });
}

// ══════════════════════════════════
// CLOSE POSITION MODAL
// ══════════════════════════════════
let closingPositionId = null;

function openCloseModal(posId) {
  closingPositionId = posId;
  const pos = STATE.openPositions.find(p => p.id === posId);
  if (!pos) return;
  const cfg = SYMBOLS[pos.symbol];
  document.getElementById('closePositionInfo').innerHTML = `
    <strong>${pos.symbol}</strong> ${pos.type.toUpperCase()} — #${pos.id}<br>
    Volume: ${pos.volume} lots<br>
    Open: ${fmtPrice(pos.openPrice, cfg.digits)}<br>
    Current P&L: <span style="color:${pos.currentPnl >= 0 ? 'var(--green2)' : 'var(--red2)'}">${pos.currentPnl >= 0 ? '+' : ''}$${(pos.currentPnl || 0).toFixed(2)}</span>`;
  document.getElementById('closeVolume').value = pos.volume;
  document.getElementById('closeVolume').max = pos.volume;
  document.getElementById('closeModal').classList.add('open');
}

function closeCloseModal(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('closeModal').classList.remove('open');
    closingPositionId = null;
  }
}

function adjustCloseVolume(delta) {
  const inp = document.getElementById('closeVolume');
  let v = parseFloat(inp.value) + delta;
  const max = parseFloat(inp.max) || 100;
  v = Math.max(0.01, Math.min(max, parseFloat(v.toFixed(2))));
  inp.value = v;
}

function confirmClose() {
  const pos = STATE.openPositions.find(p => p.id === closingPositionId);
  if (!pos) return;
  closePositionById(pos.id, 'Manual');
  closeCloseModal();
}

function closePositionById(posId, reason) {
  const idx = STATE.openPositions.findIndex(p => p.id === posId);
  if (idx < 0) return;
  const pos = STATE.openPositions[idx];
  const pnl = pos.currentPnl || 0;
  STATE.balance += pnl;
  const cfg = SYMBOLS[pos.symbol];
  const closePrice = pos.type === 'buy' ? PRICES[pos.symbol].bid : PRICES[pos.symbol].ask;
  const now = new Date();
  const closeTime = now.toLocaleString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false });
  
  STATE.history.push({
    id: pos.id, symbol: pos.symbol, type: pos.type,
    volume: pos.volume, openPrice: pos.openPrice, closePrice,
    pnl, openTime: pos.openTime, closeTime, reason,
    closedAt: Date.now()
  });
  STATE.openPositions.splice(idx, 1);
  showToast(`#${pos.id} closed ${reason} — ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, pnl >= 0 ? 'success' : 'error');
  addMessage(`Position Closed (${reason})`, `#${pos.id} ${pos.symbol} ${pos.type.toUpperCase()} — P&L: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, 'close');
  
  renderPositions();
  updateAccountDisplay();
  if (STATE.currentTab === 'charts') drawChart();
}

// ══════════════════════════════════
// PENDING ORDERS
// ══════════════════════════════════
function renderPendingOrders() {
  const list = document.getElementById('pendingList');
  const sec = document.getElementById('pendSection');
  if (!list || !sec) return;
  if (!STATE.pendingOrders.length) {
    sec.style.display = 'none';
    list.innerHTML = '';
    return;
  }
  sec.style.display = 'block';
  list.innerHTML = '';
  STATE.pendingOrders.forEach(order => {
    const cfg = SYMBOLS[order.symbol];
    const card = document.createElement('div');
    card.className = 'pend-card';
    card.onclick = () => openEditPending(order.id);
    card.innerHTML = `
      <div class="pend-sym-type">
        ${order.symbol}, ${order.type.replace(/_/g,' ').toLowerCase()} ${order.volume}
      </div>
      <div class="pend-details">
        ${fmtPrice(order.price, cfg.digits)} &rarr; <span style="color:var(--text)">${fmtPrice(PRICES[order.symbol].bid, cfg.digits)}</span>
      </div>`;
    list.appendChild(card);
  });
}

function checkPendingOrders() {
  const toActivate = [];
  STATE.pendingOrders.forEach(order => {
    const bid = PRICES[order.symbol].bid;
    const ask = PRICES[order.symbol].ask;
    let triggered = false;
    if (order.type === 'buy_limit' && ask <= order.price) triggered = true;
    if (order.type === 'sell_limit' && bid >= order.price) triggered = true;
    if (order.type === 'buy_stop' && ask >= order.price) triggered = true;
    if (order.type === 'sell_stop' && bid <= order.price) triggered = true;
    if (triggered) toActivate.push(order);
  });
  toActivate.forEach(order => {
    STATE.pendingOrders = STATE.pendingOrders.filter(o => o.id !== order.id);
    const isBuy = order.type.includes('buy');
    const execPrice = isBuy ? PRICES[order.symbol].ask : PRICES[order.symbol].bid;
    const marginReq = order.volume * order.cfg.margin * execPrice / 100;
    STATE.openPositions.push({
      id: order.id, symbol: order.symbol,
      type: isBuy ? 'buy' : 'sell',
      volume: order.volume, openPrice: execPrice,
      sl: order.sl, tp: order.tp, comment: order.comment,
      openTime: new Date().toLocaleString('en', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }),
      currentPnl: 0, margin: marginReq, cfg: order.cfg
    });
    showToast(`#${order.id} triggered at ${execPrice}`, 'info');
    addMessage('Order Triggered', `#${order.id} ${order.symbol} ${order.type.replace(/_/g,' ').toUpperCase()} triggered @ ${execPrice}`, isBuy ? 'buy' : 'sell');
    if (STATE.currentTab === 'trade') { renderPositions(); renderPendingOrders(); updateAccountDisplay(); }
  });
}

function openEditPending(id) {
  editingPendingId = id;
  const order = STATE.pendingOrders.find(o => o.id === id);
  if (!order) return;
  const cfg = SYMBOLS[order.symbol];
  document.getElementById('editPendingInfo').innerHTML = `
    <strong>${order.symbol}</strong> ${order.type.replace(/_/g,' ').toUpperCase()} — #${order.id}<br>
    Current price: Bid ${fmtPrice(PRICES[order.symbol].bid, cfg.digits)} / Ask ${fmtPrice(PRICES[order.symbol].ask, cfg.digits)}`;
  document.getElementById('editPendingPrice').value = order.price;
  document.getElementById('editPendingVolume').value = order.volume;
  document.getElementById('editPendingSL').value = order.sl || '';
  document.getElementById('editPendingTP').value = order.tp || '';
  document.getElementById('editPendingModal').classList.add('open');
}

function closeEditPending(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('editPendingModal').classList.remove('open');
    editingPendingId = null;
  }
}

function savePendingEdit() {
  const order = STATE.pendingOrders.find(o => o.id === editingPendingId);
  if (!order) return;
  order.price = parseFloat(document.getElementById('editPendingPrice').value) || order.price;
  order.volume = parseFloat(document.getElementById('editPendingVolume').value) || order.volume;
  order.sl = parseFloat(document.getElementById('editPendingSL').value) || 0;
  order.tp = parseFloat(document.getElementById('editPendingTP').value) || 0;
  renderPendingOrders();
  showToast(`#${order.id} updated`, 'success');
  closeEditPending();
}

function deletePendingOrder() {
  STATE.pendingOrders = STATE.pendingOrders.filter(o => o.id !== editingPendingId);
  renderPendingOrders();
  showToast(`Order #${editingPendingId} deleted`, 'info');
  closeEditPending();
}

// ══════════════════════════════════
// BALANCE EDITOR
// ══════════════════════════════════
function editBalance() {
  document.getElementById('newBalanceInput').value = STATE.balance;
  document.getElementById('balanceModal').classList.add('open');
}

function closeBalanceModal(e) {
  if (!e || e.target === e.currentTarget) {
    document.getElementById('balanceModal').classList.remove('open');
  }
}

function setBalancePreset(amount) {
  document.getElementById('newBalanceInput').value = amount;
}

function applyBalance() {
  const val = parseFloat(document.getElementById('newBalanceInput').value);
  if (isNaN(val) || val < 0) { showToast('Invalid balance amount', 'error'); return; }
  STATE.balance = parseFloat(val.toFixed(2));
  updateAccountDisplay();
  closeBalanceModal();
  showToast(`Balance set to $${fmtMoney(STATE.balance)}`, 'success');
  addMessage('Balance Updated', `Account balance changed to $${fmtMoney(STATE.balance)}`, 'info');
}

// ══════════════════════════════════
// HISTORY TAB
// ══════════════════════════════════
let historyFilter = 'today';

function filterHistory(f, btn) {
  historyFilter = f;
  document.querySelectorAll('.hf-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderHistory();
  updateHistorySummary();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  if (!list) return;
  const now = Date.now();
  const DAY = 86400000;
  let filtered = STATE.history.filter(h => {
    if (historyFilter === 'today') return h.closedAt > now - DAY;
    if (historyFilter === 'week') return h.closedAt > now - 7 * DAY;
    if (historyFilter === 'month') return h.closedAt > now - 30 * DAY;
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><p>No trades for this period</p></div>`;
    return;
  }

  filtered = filtered.reverse();
  list.innerHTML = '';
  filtered.forEach(h => {
    const cfg = SYMBOLS[h.symbol];
    const card = document.createElement('div');
    card.className = 'hist-card';
    card.innerHTML = `
      <div class="hc-left">
        <div class="hc-sym">${h.symbol}</div>
        <div class="hc-type ${h.type === 'buy' ? 'price-up' : 'price-down'}">${h.type.toUpperCase()} ${h.volume} (${h.reason})</div>
        <div class="hc-date">${h.openTime} &rarr; ${h.closeTime}</div>
      </div>
      <div class="hc-right">
        <div class="hc-pnl ${h.pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">
          ${h.pnl >= 0 ? '+' : ''}${h.pnl.toFixed(2)}
        </div>
        <div class="hc-volume" style="font-size:10px;color:var(--text3);margin-top:2px">#${h.id}</div>
      </div>`;
    list.appendChild(card);
  });
}

function updateHistorySummary() {
  const now = Date.now();
  const DAY = 86400000;
  let filtered = STATE.history.filter(h => {
    if (historyFilter === 'today') return h.closedAt > now - DAY;
    if (historyFilter === 'week') return h.closedAt > now - 7 * DAY;
    if (historyFilter === 'month') return h.closedAt > now - 30 * DAY;
    return true;
  });
  const netPl = filtered.reduce((s, h) => s + h.pnl, 0);
  const wins = filtered.filter(h => h.pnl > 0).length;
  document.getElementById('histNetPL').textContent = (netPl >= 0 ? '+' : '') + fmtMoney(netPl);
  document.getElementById('histNetPL').className = 'hs-val ' + (netPl >= 0 ? 'pnl-pos' : 'pnl-neg');
  document.getElementById('histTrades').textContent = filtered.length;
  document.getElementById('histWinRate').textContent = filtered.length ? `${Math.round(wins / filtered.length * 100)}%` : '—';
}

// ══════════════════════════════════
// MESSAGES
// ══════════════════════════════════
let unreadMsgs = 0;

function addMessage(title, body, type) {
  const now = new Date();
  const timeStr = now.toLocaleString('en', { hour:'2-digit', minute:'2-digit', hour12:false });
  STATE.messages.unshift({ title, body, type, time: timeStr, unread: true });
  unreadMsgs++;
  const badge = document.getElementById('msgBadge');
  if (badge) {
    badge.textContent = unreadMsgs;
    badge.style.display = unreadMsgs > 0 ? 'flex' : 'none';
  }

  if (STATE.currentTab === 'messages') {
    renderMessages();
    unreadMsgs = 0;
    if (badge) badge.style.display = 'none';
  }
}

function renderMessages() {
  const list = document.getElementById('messagesList');
  if (!list) return;
  list.innerHTML = '';
  STATE.messages.forEach(msg => {
    const iconMap = {
      buy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" stroke="#26a69a" stroke-width="2" stroke-linecap="round"/></svg>`,
      sell: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><polyline points="1 6 10.5 15.5 15.5 10.5 23 18" stroke="#ef5350" stroke-width="2" stroke-linecap="round"/></svg>`,
      close: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#ffa726" stroke-width="2"/><line x1="8" y1="8" x2="16" y2="16" stroke="#ffa726" stroke-width="2"/><line x1="16" y1="8" x2="8" y2="16" stroke="#ffa726" stroke-width="2"/></svg>`,
      info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#00b4d8" stroke-width="2"/><line x1="12" y1="8" x2="12" y2="12" stroke="#00b4d8" stroke-width="2"/><circle cx="12" cy="16" r="0.5" fill="#00b4d8" stroke="#00b4d8"/></svg>`,
    };
    const iconClassMap = { buy: 'buy-icon', sell: 'sell-icon', close: 'close-icon', info: '' };
    const item = document.createElement('div');
    item.className = `msg-item${msg.unread ? ' unread' : ''}`;
    item.onclick = () => { msg.unread = false; item.classList.remove('unread'); };
    item.innerHTML = `
      <div class="msg-icon ${iconClassMap[msg.type] || ''}">${iconMap[msg.type] || iconMap.info}</div>
      <div class="msg-content">
        <div class="msg-title">${msg.title}</div>
        <div class="msg-body">${msg.body}</div>
        <div class="msg-time">${msg.time}</div>
      </div>`;
    list.appendChild(item);
  });
}

// ══════════════════════════════════
// TOAST
// ══════════════════════════════════
let toastTimer;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ══════════════════════════════════
// HELPERS
// ══════════════════════════════════
function fmt(n, digits) {
  return parseFloat(n).toFixed(digits);
}

function fmtMoney(n) {
  return parseFloat(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/,/g, ' ');
}

function fmtPrice(n, digits) {
  return parseFloat(n).toLocaleString('en', { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/,/g, ' ');
}

// ══════════════════════════════════
// WINDOW RESIZE — REDRAW CHART
// ══════════════════════════════════
window.addEventListener('resize', () => {
  if (STATE.currentTab === 'charts') initChart();
});

// ══════════════════════════════════
// KEYBOARD SHORTCUTS & ESCAPE CLOSE
// ══════════════════════════════════
document.addEventListener('keydown', e => {
  if (e.key === 'n' || e.key === 'N') {
    if (!document.querySelector('.modal-overlay.open')) openNewOrder();
  }
  if (e.key === 'Escape') {
    closeNewOrder();
    closeCloseModal();
    closeBalanceModal();
    closeEditPending();
    closeTFPicker();
    closeSymbolPicker();
  }
});

// ══════════════════════════════════
// INIT
// ══════════════════════════════════
function init() {
  buildQuotesList();

  // Populate order symbol selector
  const orderSymSelect = document.getElementById('orderSymbol');
  if (orderSymSelect) {
    orderSymSelect.innerHTML = '';
    for (const s in SYMBOLS) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = `${s} — ${SYMBOLS[s].desc}`;
      orderSymSelect.appendChild(opt);
    }
    orderSymSelect.addEventListener('change', updateOrderPrice);
  }

  // Bind balance editor to click on the Balance summary row
  const balanceDisplay = document.getElementById('balanceDisplay');
  if (balanceDisplay) {
    const row = balanceDisplay.closest('.acct-row');
    if (row) {
      row.style.cursor = 'pointer';
      row.addEventListener('click', editBalance);
    }
  }

  // Initial tab set
  setTab('trade');

  // Periodically refresh items
  setInterval(() => {
    if (STATE.currentTab === 'messages') renderMessages();
    if (STATE.currentTab === 'history') { renderHistory(); updateHistorySummary(); }
  }, 5000);
}

document.addEventListener('DOMContentLoaded', init);

/* ═══════════════════════════════════════════════════════════
   MT5 PLATFORM — COMPLETE TRADING ENGINE
   Full replica of MetaTrader 5 mobile app
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
  currentSymbol: 'XAUUSD',
  currentTF: 'H1',
  sidebarOpen: false,
};

// ══════════════════════════════════
// SYMBOLS CONFIG
// ══════════════════════════════════
const SYMBOLS = {
  XAUUSD:  { desc: 'Gold vs US Dollar',       basePrice: 3327.50, spread: 0.35, digits: 2, pip: 0.01, margin: 10,   category: 'Metals' },
  EURUSD:  { desc: 'Euro vs US Dollar',        basePrice: 1.08920, spread: 0.00020, digits: 5, pip: 0.0001, margin: 3.33, category: 'FX' },
  GBPUSD:  { desc: 'British Pound vs Dollar',  basePrice: 1.27345, spread: 0.00025, digits: 5, pip: 0.0001, margin: 3.33, category: 'FX' },
  USDJPY:  { desc: 'US Dollar vs Yen',         basePrice: 156.420, spread: 0.020, digits: 3, pip: 0.01, margin: 3.33, category: 'FX' },
  BTCUSD:  { desc: 'Bitcoin vs Dollar',        basePrice: 103240, spread: 50,   digits: 0, pip: 1, margin: 50,  category: 'Crypto' },
  ETHUSD:  { desc: 'Ethereum vs Dollar',       basePrice: 2520,   spread: 2.5,  digits: 1, pip: 0.1, margin: 20,  category: 'Crypto' },
  NAS100:  { desc: 'NASDAQ 100 Index',         basePrice: 21450,  spread: 1.5,  digits: 1, pip: 0.1, margin: 25,  category: 'Indices' },
  US30:    { desc: 'Dow Jones Index',          basePrice: 43200,  spread: 2.5,  digits: 1, pip: 0.1, margin: 25,  category: 'Indices' },
  USOIL:   { desc: 'US Crude Oil',             basePrice: 72.50,  spread: 0.04, digits: 2, pip: 0.01, margin: 5,   category: 'Energy' },
  XAGUSD:  { desc: 'Silver vs US Dollar',      basePrice: 32.450, spread: 0.040, digits: 3, pip: 0.001, margin: 5,  category: 'Metals' },
};

// Live prices (bid)
const PRICES = {};
for (const sym in SYMBOLS) {
  PRICES[sym] = { bid: SYMBOLS[sym].basePrice, ask: SYMBOLS[sym].basePrice + SYMBOLS[sym].spread };
}

// ══════════════════════════════════
// PRICE ENGINE — REAL-TIME TICKING
// ══════════════════════════════════
function tickPrices() {
  for (const sym in PRICES) {
    const cfg = SYMBOLS[sym];
    const volatility = cfg.basePrice * 0.00015;
    const move = (Math.random() - 0.49) * volatility;
    const raw = PRICES[sym].bid + move;
    PRICES[sym].bid = parseFloat(raw.toFixed(cfg.digits));
    PRICES[sym].ask = parseFloat((PRICES[sym].bid + cfg.spread).toFixed(cfg.digits));

    // Prevent prices going too far from base
    const maxDev = cfg.basePrice * 0.05;
    if (Math.abs(PRICES[sym].bid - cfg.basePrice) > maxDev) {
      PRICES[sym].bid += (cfg.basePrice - PRICES[sym].bid) * 0.1;
    }
  }
  updateQuotesUI();
  updatePositionPnl();
  checkPendingOrders();
  updateChartLivePrice();
}

setInterval(tickPrices, 800);

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

  // Update top bar title & actions
  const titles = { quotes: 'Quotes', charts: STATE.currentSymbol, trade: 'Trade', history: 'History', messages: 'Messages' };
  document.getElementById('topTitle').textContent = titles[tab] || tab;

  // Update sidebar items
  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  const sideItems = document.querySelectorAll('.sidebar-item');
  const tabIdx = ['quotes','charts','trade','history','messages'].indexOf(tab);
  if (sideItems[tabIdx]) sideItems[tabIdx].classList.add('active');

  if (tab === 'charts') {
    setTimeout(() => { initChart(); }, 50);
  }
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
    // Mark all as read
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
  container.innerHTML = '';
  for (const sym in SYMBOLS) {
    const cfg = SYMBOLS[sym];
    const el = document.createElement('div');
    el.className = 'quote-row';
    el.id = `qrow-${sym}`;
    el.onclick = () => openChartFor(sym);
    el.innerHTML = `
      <div class="quote-symbol">
        <div class="quote-sym-name">${sym}</div>
        <div class="quote-sym-desc">${cfg.desc}</div>
      </div>
      <div class="quote-bid">
        <div class="quote-price price-normal" id="qbid-${sym}">${fmt(PRICES[sym].bid, cfg.digits)}</div>
        <div class="quote-spread" id="qspread-${sym}">Spread: ${fmt(cfg.spread, cfg.digits)}</div>
      </div>
      <div class="quote-ask">
        <div class="quote-price price-normal" id="qask-${sym}">${fmt(PRICES[sym].ask, cfg.digits)}</div>
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
    bidEl.className = 'quote-price ' + (dir === 'up' ? 'price-up' : dir === 'down' ? 'price-down' : 'price-normal');
    askEl.className = 'quote-price ' + (dir === 'up' ? 'price-up' : dir === 'down' ? 'price-down' : 'price-normal');
    if (dir) {
      row.classList.remove('flash-up', 'flash-down');
      void row.offsetWidth;
      row.classList.add(`flash-${dir}`);
      setTimeout(() => row.classList.remove(`flash-${dir}`), 500);
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
      <div class="spr-right">${fmt(PRICES[sym].bid, cfg.digits)}</div>`;
    row.onclick = () => {
      STATE.currentSymbol = sym;
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
// CHART ENGINE (Canvas Candlestick)
// ══════════════════════════════════
let chartData = [];
let chartOffset = 0;
let chartScale = 1;
let isDragging = false;
let dragStartX = 0;
let dragStartOffset = 0;
let crosshairX = -1, crosshairY = -1;
let chartAnimFrame = null;

const TF_MINUTES = { M1:1, M5:5, M15:15, H1:60, H4:240, D1:1440 };

function generateCandles(sym, tf, count = 200) {
  const cfg = SYMBOLS[sym];
  const minutes = TF_MINUTES[tf] || 60;
  const candles = [];
  let price = cfg.basePrice;
  const now = Date.now();
  const ms = minutes * 60000;

  for (let i = count; i >= 0; i--) {
    const ts = now - i * ms;
    const volatility = price * (0.0008 + Math.random() * 0.0012);
    const open = price;
    const dir = Math.random() > 0.48 ? 1 : -1;
    const body = volatility * (0.3 + Math.random() * 0.7);
    const close = open + dir * body;
    const high = Math.max(open, close) + volatility * (0.1 + Math.random() * 0.5);
    const low  = Math.min(open, close) - volatility * (0.1 + Math.random() * 0.5);
    const vol = Math.floor(100 + Math.random() * 1000);
    candles.push({ ts, open: +open.toFixed(cfg.digits), high: +high.toFixed(cfg.digits), low: +low.toFixed(cfg.digits), close: +close.toFixed(cfg.digits), vol });
    price = close;
  }
  return candles;
}

function setTimeframe(tf) {
  STATE.currentTF = tf;
  document.querySelectorAll('.tf-btn').forEach(b => b.classList.toggle('active', b.textContent === tf));
  chartData = generateCandles(STATE.currentSymbol, tf);
  chartOffset = 0;
  drawChart();
}

function initChart() {
  const canvas = document.getElementById('chartCanvas');
  if (!canvas) return;
  const container = document.getElementById('chartContainer');
  canvas.width = container.clientWidth * window.devicePixelRatio;
  canvas.height = container.clientHeight * window.devicePixelRatio;
  canvas.style.width = container.clientWidth + 'px';
  canvas.style.height = container.clientHeight + 'px';

  document.getElementById('chartSymbolName').textContent = STATE.currentSymbol;
  const symDesc = document.getElementById('chartSymbolDesc');
  if (symDesc) symDesc.textContent = SYMBOLS[STATE.currentSymbol].desc;
  document.getElementById('chartMarketStatus').textContent = 'Market open';

  chartData = generateCandles(STATE.currentSymbol, STATE.currentTF);
  chartOffset = 0;
  chartScale = 1;
  setupChartEvents(canvas, container);
  drawChart();
  document.getElementById('topTitle').textContent = STATE.currentSymbol;
}

function setupChartEvents(canvas, container) {
  // Remove old listeners by cloning
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
  });
  c.addEventListener('mousedown', e => { isDragging = true; dragStartX = e.clientX - c.getBoundingClientRect().left; dragStartOffset = chartOffset; });
  window.addEventListener('mouseup', () => { isDragging = false; });

  c.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.85 : 1.15;
    chartScale = Math.max(0.3, Math.min(4, chartScale * delta));
    drawChart();
  }, { passive: false });

  // Touch
  let lastTouchX = 0;
  c.addEventListener('touchstart', e => { lastTouchX = e.touches[0].clientX; dragStartOffset = chartOffset; isDragging = true; });
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
  const visible = Math.max(20, Math.min(200, Math.floor(100 / chartScale)));
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
  const PADDING_TOP = 20, PADDING_BOTTOM = 40;
  const CHART_H = H - PADDING_TOP - PADDING_BOTTOM;

  // Clear
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // Visible candles
  const visible = Math.max(20, Math.min(200, Math.floor(100 / chartScale)));
  const startIdx = Math.max(0, chartData.length - visible - Math.round(chartOffset));
  const endIdx = Math.min(chartData.length, startIdx + visible);
  const visibleCandles = chartData.slice(startIdx, endIdx);

  if (!visibleCandles.length) return;

  // Price range
  const highs = visibleCandles.map(c => c.high);
  const lows = visibleCandles.map(c => c.low);
  let priceMax = Math.max(...highs);
  let priceMin = Math.min(...lows);
  const pricePad = (priceMax - priceMin) * 0.1;
  priceMax += pricePad;
  priceMin -= pricePad;
  const priceRange = priceMax - priceMin;

  const priceToY = p => PADDING_TOP + ((priceMax - p) / priceRange) * CHART_H;
  const cw = CHART_W / visible;
  const cwBody = Math.max(2, cw * 0.6);

  // Grid lines
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1;
  const gridSteps = 6;
  for (let i = 0; i <= gridSteps; i++) {
    const y = PADDING_TOP + (CHART_H / gridSteps) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CHART_W, y); ctx.stroke();
    const priceAtY = priceMax - (priceRange / gridSteps) * i;
    const cfg = SYMBOLS[STATE.currentSymbol];
    ctx.fillStyle = '#444';
    ctx.font = '10px Roboto Mono';
    ctx.textAlign = 'left';
    ctx.fillText(fmt(priceAtY, cfg.digits), CHART_W + 4, y + 3);
  }

  // Vertical grid lines & time labels
  const timeStep = Math.max(1, Math.floor(visible / 6));
  ctx.fillStyle = '#333';
  ctx.font = '9px Inter';
  ctx.textAlign = 'center';
  visibleCandles.forEach((c, i) => {
    if (i % timeStep === 0) {
      const x = (i + 0.5) * cw;
      ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, PADDING_TOP); ctx.lineTo(x, PADDING_TOP + CHART_H); ctx.stroke();
      const d = new Date(c.ts);
      const lbl = TF_MINUTES[STATE.currentTF] >= 1440
        ? d.toLocaleDateString('en', { month:'short', day:'numeric' })
        : d.toLocaleTimeString('en', { hour:'2-digit', minute:'2-digit', hour12: false });
      ctx.fillStyle = '#444';
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

    // Wick
    ctx.strokeStyle = color; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, highY); ctx.lineTo(x, lowY); ctx.stroke();

    // Body
    const bodyY = Math.min(openY, closeY);
    const bodyH = Math.max(1, Math.abs(closeY - openY));
    ctx.fillStyle = color;
    ctx.fillRect(x - cwBody / 2, bodyY, cwBody, bodyH);
  });

  // Live price line
  const livePrice = PRICES[STATE.currentSymbol].bid;
  const livePriceY = priceToY(livePrice);
  if (livePriceY >= PADDING_TOP && livePriceY <= PADDING_TOP + CHART_H) {
    ctx.strokeStyle = '#00b4d8'; ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(0, livePriceY); ctx.lineTo(CHART_W, livePriceY); ctx.stroke();
    ctx.setLineDash([]);
  }

  // SL/TP lines from open positions
  STATE.openPositions.forEach(pos => {
    if (pos.symbol !== STATE.currentSymbol) return;
    if (pos.sl && pos.sl > 0) {
      const y = priceToY(pos.sl);
      ctx.strokeStyle = 'rgba(239,83,80,.6)'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CHART_W, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(239,83,80,.8)';
      ctx.font = '9px Inter'; ctx.textAlign = 'left';
      ctx.fillText(`SL ${fmt(pos.sl, SYMBOLS[STATE.currentSymbol].digits)}`, 4, y - 2);
    }
    if (pos.tp && pos.tp > 0) {
      const y = priceToY(pos.tp);
      ctx.strokeStyle = 'rgba(38,166,154,.6)'; ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CHART_W, y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(38,166,154,.8)';
      ctx.font = '9px Inter'; ctx.textAlign = 'left';
      ctx.fillText(`TP ${fmt(pos.tp, SYMBOLS[STATE.currentSymbol].digits)}`, 4, y - 2);
    }
  });

  // Store chart meta for crosshair
  canvas._meta = { priceToY, priceMax, priceMin, priceRange, CHART_W, PADDING_TOP, CHART_H, startIdx, visible, cw, visibleCandles, PADDING_BOTTOM };

  // Update price label
  updateChartLivePrice();
}

function updateChartLivePrice() {
  if (STATE.currentTab !== 'charts') return;
  const canvas = document.getElementById('chartCanvas');
  if (!canvas || !canvas._meta) return;
  const livePrice = PRICES[STATE.currentSymbol].bid;
  const cfg = SYMBOLS[STATE.currentSymbol];
  const y = canvas._meta.priceToY(livePrice);
  const label = document.getElementById('chartPriceLabel');
  label.textContent = fmt(livePrice, cfg.digits);
  label.style.top = y + 'px';
}

function updateCrosshair(container, canvas) {
  if (crosshairX < 0 || !canvas._meta) return;
  const { CHART_W, PADDING_TOP, CHART_H, cw, visibleCandles, priceMax, priceRange } = canvas._meta;
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
    // Show crosshair price label
    const priceAtY = priceMax - (crosshairY - PADDING_TOP) / CHART_H * priceRange;
    const cfg = SYMBOLS[STATE.currentSymbol];
    const label = document.getElementById('chartPriceLabel');
    if (crosshairY >= PADDING_TOP && crosshairY <= PADDING_TOP + CHART_H) {
      label.textContent = fmt(priceAtY, cfg.digits);
      label.style.top = crosshairY + 'px';
      label.style.background = '#555';
    }
  } else {
    vH.style.display = 'none'; hH.style.display = 'none';
    // Restore live price label color
    document.getElementById('chartPriceLabel').style.background = '#0077b6';
    updateChartLivePrice();
  }
}

// Live candle update
setInterval(() => {
  if (STATE.currentTab === 'charts' && chartData.length > 0) {
    const last = chartData[chartData.length - 1];
    const cfg = SYMBOLS[STATE.currentSymbol];
    const price = PRICES[STATE.currentSymbol].bid;
    last.close = price;
    last.high = Math.max(last.high, price);
    last.low = Math.min(last.low, price);
    drawChart();
  }
}, 1200);

// ══════════════════════════════════
// ACCOUNT DISPLAY
// ══════════════════════════════════
function updateAccountDisplay() {
  const totalPnl = STATE.openPositions.reduce((sum, p) => sum + (p.currentPnl || 0), 0);
  const equity = STATE.balance + totalPnl;
  const usedMargin = STATE.openPositions.reduce((sum, p) => sum + p.margin, 0);
  const freeMargin = equity - usedMargin;

  document.getElementById('balanceDisplay').textContent = fmtMoney(STATE.balance);
  document.getElementById('equityDisplay').textContent = fmtMoney(equity);
  document.getElementById('marginDisplay').textContent = fmtMoney(Math.max(0, freeMargin));

  const profitRow = document.getElementById('profitRow');
  if (STATE.openPositions.length > 0) {
    profitRow.style.display = 'flex';
    const profitEl = document.getElementById('profitDisplay');
    profitEl.textContent = (totalPnl >= 0 ? '+' : '') + fmtMoney(totalPnl);
    profitEl.style.color = totalPnl >= 0 ? 'var(--green2)' : 'var(--red2)';
  } else {
    profitRow.style.display = 'none';
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

  // Populate symbols
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
// POSITION P&L
// ══════════════════════════════════
function updatePositionPnl() {
  let anyChange = false;
  STATE.openPositions.forEach(pos => {
    const curPrice = pos.type === 'buy' ? PRICES[pos.symbol].bid : PRICES[pos.symbol].ask;
    const diff = pos.type === 'buy' ? curPrice - pos.openPrice : pos.openPrice - curPrice;
    const pipValue = pos.cfg.basePrice > 100 ? pos.volume * diff : pos.volume * diff * 100000;
    const pnl = parseFloat((diff * pos.volume * (pos.cfg.basePrice > 10 ? 100 : 100000)).toFixed(2));
    // Simplified PnL: diff * volume * contract_size / price
    // For gold: $10 per oz per lot
    // For forex: $10 per pip per standard lot
    let pnlCalc;
    const sym = pos.symbol;
    if (sym === 'XAUUSD' || sym === 'XAGUSD') {
      pnlCalc = diff * pos.volume * 100;
    } else if (sym === 'BTCUSD' || sym === 'ETHUSD') {
      pnlCalc = diff * pos.volume;
    } else if (sym.includes('USD') && sym.indexOf('USD') === 3) {
      pnlCalc = diff * pos.volume * 100000 / curPrice;
    } else if (sym.includes('JPY')) {
      pnlCalc = diff * pos.volume * 100000 / 156;
    } else if (sym === 'NAS100' || sym === 'US30') {
      pnlCalc = diff * pos.volume * 10;
    } else if (sym === 'USOIL') {
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

  if (STATE.currentTab === 'trade') {
    updatePositionCards();
    updateAccountDisplay();
  }
}

function updatePositionCards() {
  STATE.openPositions.forEach(pos => {
    const pnlEl = document.getElementById(`pnl-${pos.id}`);
    if (pnlEl) {
      pnlEl.textContent = (pos.currentPnl >= 0 ? '+$' : '-$') + Math.abs(pos.currentPnl).toFixed(2);
      pnlEl.className = 'pos-pnl ' + (pos.currentPnl >= 0 ? 'pnl-pos' : 'pnl-neg');
    }
    const curPriceEl = document.getElementById(`curprice-${pos.id}`);
    if (curPriceEl) {
      const cfg = SYMBOLS[pos.symbol];
      curPriceEl.textContent = fmt(PRICES[pos.symbol].bid, cfg.digits);
    }
  });
}

function renderPositions() {
  const list = document.getElementById('positionsList');
  const empty = document.getElementById('positionsEmpty');
  const badge = document.getElementById('positionsBadge');
  badge.textContent = STATE.openPositions.length;
  if (!STATE.openPositions.length) {
    empty.style.display = 'flex'; list.innerHTML = ''; return;
  }
  empty.style.display = 'none';
  list.innerHTML = '';
  STATE.openPositions.forEach(pos => {
    const cfg = SYMBOLS[pos.symbol];
    const isBuy = pos.type === 'buy';
    const pnl = pos.currentPnl || 0;
    const card = document.createElement('div');
    card.className = 'position-card';
    card.innerHTML = `
      <div class="pos-header">
        <div>
          <span class="pos-symbol">${pos.symbol}</span>
          <span style="font-size:11px;color:var(--text3);margin-left:6px">#${pos.id}</span>
        </div>
        <span class="pos-type-badge ${isBuy ? 'buy' : 'sell'}">${pos.type}</span>
      </div>
      <div class="pos-details">
        <div class="pos-info">
          <div>${pos.volume} lots @ ${fmt(pos.openPrice, cfg.digits)}</div>
          <div style="margin-top:2px;color:var(--text3)">${pos.openTime}</div>
          ${pos.comment ? `<div style="margin-top:2px;color:var(--text3);font-style:italic">${pos.comment}</div>` : ''}
        </div>
        <div id="pnl-${pos.id}" class="pos-pnl ${pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">
          ${pnl >= 0 ? '+$' : '-$'}${Math.abs(pnl).toFixed(2)}
        </div>
      </div>
      <div class="pos-prices">
        <div class="pos-price-item"><span class="pos-price-label">Open: </span><span class="pos-price-val">${fmt(pos.openPrice, cfg.digits)}</span></div>
        <div class="pos-price-item"><span class="pos-price-label">Cur: </span><span class="pos-price-val" id="curprice-${pos.id}">${fmt(PRICES[pos.symbol].bid, cfg.digits)}</span></div>
        ${pos.sl > 0 ? `<div class="pos-price-item"><span class="pos-price-label">SL: </span><span class="pos-price-val" style="color:var(--red)">${fmt(pos.sl, cfg.digits)}</span></div>` : ''}
        ${pos.tp > 0 ? `<div class="pos-price-item"><span class="pos-price-label">TP: </span><span class="pos-price-val" style="color:var(--green)">${fmt(pos.tp, cfg.digits)}</span></div>` : ''}
      </div>
      <div class="pos-actions">
        <button class="pos-btn pos-btn-close" onclick="openCloseModal(${pos.id})">Close Position</button>
      </div>`;
    list.appendChild(card);
  });
}

// ══════════════════════════════════
// CLOSE POSITION
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
    Open: ${fmt(pos.openPrice, cfg.digits)}<br>
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
  renderPendingOrders();
  updateAccountDisplay();
  if (STATE.currentTab === 'charts') drawChart();
}

// ══════════════════════════════════
// PENDING ORDERS
// ══════════════════════════════════
function renderPendingOrders() {
  const list = document.getElementById('pendingList');
  const empty = document.getElementById('pendingEmpty');
  const badge = document.getElementById('pendingBadge');
  badge.textContent = STATE.pendingOrders.length;
  if (!STATE.pendingOrders.length) {
    empty.style.display = 'flex'; list.innerHTML = ''; return;
  }
  empty.style.display = 'none';
  list.innerHTML = '';
  STATE.pendingOrders.forEach(order => {
    const cfg = SYMBOLS[order.symbol];
    const card = document.createElement('div');
    card.className = 'pending-card';
    card.onclick = () => openEditPending(order.id);
    card.innerHTML = `
      <div class="pend-header">
        <div>
          <span style="font-size:14px;font-weight:700">${order.symbol}</span>
          <span style="font-size:11px;color:var(--text3);margin-left:6px">#${order.id}</span>
        </div>
        <span class="pend-type-badge">${order.type.replace(/_/g,' ').toUpperCase()}</span>
      </div>
      <div class="pend-details">
        ${order.volume} lots @ ${fmt(order.price, cfg.digits)}
        ${order.sl > 0 ? ` · SL: ${fmt(order.sl, cfg.digits)}` : ''}
        ${order.tp > 0 ? ` · TP: ${fmt(order.tp, cfg.digits)}` : ''}
      </div>
      <div style="font-size:10px;color:var(--text3);margin-top:4px">Placed: ${order.openTime}</div>`;
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

// Edit Pending
function openEditPending(id) {
  editingPendingId = id;
  const order = STATE.pendingOrders.find(o => o.id === id);
  if (!order) return;
  const cfg = SYMBOLS[order.symbol];
  document.getElementById('editPendingInfo').innerHTML = `
    <strong>${order.symbol}</strong> ${order.type.replace(/_/g,' ').toUpperCase()} — #${order.id}<br>
    Current price: Bid ${fmt(PRICES[order.symbol].bid, cfg.digits)} / Ask ${fmt(PRICES[order.symbol].ask, cfg.digits)}`;
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

function filterHistory(f) {
  historyFilter = f;
  document.querySelectorAll('.hf-btn').forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  renderHistory();
  updateHistorySummary();
}

function renderHistory() {
  const list = document.getElementById('historyList');
  const now = Date.now();
  const DAY = 86400000;
  let filtered = STATE.history.filter(h => {
    if (historyFilter === 'today') return h.closedAt > now - DAY;
    if (historyFilter === 'week') return h.closedAt > now - 7 * DAY;
    if (historyFilter === 'month') return h.closedAt > now - 30 * DAY;
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" opacity="0.3"><circle cx="12" cy="12" r="10" stroke="white" stroke-width="1.5"/><line x1="12" y1="8" x2="12" y2="12" stroke="white" stroke-width="1.5"/><circle cx="12" cy="16" r="0.5" fill="white" stroke="white"/></svg><p>No trades for this period</p></div>`;
    return;
  }

  filtered = filtered.reverse(); // newest first
  list.innerHTML = '';
  filtered.forEach(h => {
    const cfg = SYMBOLS[h.symbol];
    const card = document.createElement('div');
    card.className = 'history-card';
    card.innerHTML = `
      <div class="hc-left">
        <div class="hc-symbol">${h.symbol}</div>
        <div class="hc-type ${h.type === 'buy' ? 'price-up' : 'price-down'}">${h.type.toUpperCase()} ${h.volume} lots (${h.reason})</div>
        <div class="hc-date">${h.openTime} → ${h.closeTime}</div>
        <div style="font-size:10px;color:var(--text3);margin-top:1px">
          ${fmt(h.openPrice, cfg.digits)} → ${fmt(h.closePrice, cfg.digits)}
        </div>
      </div>
      <div class="hc-right">
        <div class="hc-pnl" style="color:${h.pnl >= 0 ? 'var(--green2)' : 'var(--red2)'}">
          ${h.pnl >= 0 ? '+' : ''}$${Math.abs(h.pnl).toFixed(2)}
        </div>
        <div class="hc-volume">#${h.id}</div>
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
  document.getElementById('histNetPL').textContent = (netPl >= 0 ? '+$' : '-$') + Math.abs(netPl).toFixed(2);
  document.getElementById('histNetPL').style.color = netPl >= 0 ? 'var(--green2)' : 'var(--red2)';
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
  badge.textContent = unreadMsgs;
  badge.style.display = unreadMsgs > 0 ? 'flex' : 'none';

  if (STATE.currentTab === 'messages') {
    renderMessages();
    unreadMsgs = 0;
    badge.style.display = 'none';
  }
}

function renderMessages() {
  const list = document.getElementById('messagesList');
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

// Override setTab to render messages when switching to that tab
const _origSetTab = setTab;

// ══════════════════════════════════
// SECTION TOGGLE
// ══════════════════════════════════
function toggleSection(section) {
  const body = document.getElementById(`${section}Body`);
  const arrow = document.getElementById(`${section}Arrow`);
  const isCollapsed = body.classList.toggle('collapsed');
  arrow.classList.toggle('collapsed', isCollapsed);
  if (!isCollapsed) {
    body.style.maxHeight = body.scrollHeight + 'px';
  } else {
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(() => body.style.maxHeight = '0');
  }
}

function expandSection(section) {
  const body = document.getElementById(`${section}Body`);
  const arrow = document.getElementById(`${section}Arrow`);
  body.classList.remove('collapsed');
  arrow.classList.remove('collapsed');
  body.style.maxHeight = 'none';
}

// ══════════════════════════════════
// TOAST
// ══════════════════════════════════
let toastTimer;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
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
  return parseFloat(n).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ══════════════════════════════════
// WINDOW RESIZE — REDRAW CHART
// ══════════════════════════════════
window.addEventListener('resize', () => {
  if (STATE.currentTab === 'charts') initChart();
});

// ══════════════════════════════════
// KEYBOARD SHORTCUT: N = New Order
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
  }
});

// ══════════════════════════════════
// INIT
// ══════════════════════════════════
function init() {
  buildQuotesList();

  // Populate order symbol selector on page load
  document.getElementById('orderSymbol').innerHTML = '';
  for (const s in SYMBOLS) {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = `${s} — ${SYMBOLS[s].desc}`;
    document.getElementById('orderSymbol').appendChild(opt);
  }

  // Wire up symbol change in order modal
  document.getElementById('orderSymbol').addEventListener('change', updateOrderPrice);

  // Expand sections by default with proper heights
  ['positions', 'pending'].forEach(sec => {
    const body = document.getElementById(`${sec}Body`);
    body.style.maxHeight = 'none';
  });

  setTab('trade');

  // Periodic messages update for live PnL in messages tab
  setInterval(() => {
    if (STATE.currentTab === 'messages') renderMessages();
    if (STATE.currentTab === 'history') { renderHistory(); updateHistorySummary(); }
  }, 5000);
}

document.addEventListener('DOMContentLoaded', init);

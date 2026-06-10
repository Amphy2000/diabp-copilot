# MT5 Trade Platform

A pixel-perfect **MetaTrader 5 mobile replica** built with vanilla HTML, CSS, and JavaScript. No frameworks, no dependencies — just fast, beautiful trading UI.

## 🚀 Features

- **📊 Quotes Tab** — 10 live-ticking symbols (XAUUSD, EURUSD, GBPUSD, BTCUSD, NAS100, US30, USOIL…) with real-time bid/ask price flashing
- **📈 Charts Tab** — Canvas candlestick chart with drag-to-pan, scroll-to-zoom, crosshair OHLC tooltip, SL/TP level lines, timeframe switcher (M1, M5, M15, H1, H4, D1), symbol picker
- **💼 Trade Tab** — Full order entry (Market Buy/Sell, Buy/Sell Limit, Buy/Sell Stop), live P&L per position, close positions, editable account balance
- **📜 History Tab** — Closed trade log with today/week/month/all filters, net P&L and win rate summary
- **✉️ Messages Tab** — Auto-populating system notifications with unread badge

## 🎮 Interactions

| Action | How |
|--------|-----|
| Place Order | Tap **+** button or press **N** |
| Edit Balance | Tap ✎ pencil icon on Trade tab |
| Pan Chart | Click & drag left/right |
| Zoom Chart | Scroll wheel |
| Switch Symbol | Tap symbol name on chart |
| Close Position | Tap position card → Close Position |
| Edit Pending | Tap pending order → edit price/SL/TP |

## 🛠 Tech Stack

- Vanilla HTML5 / CSS3 / JavaScript (ES6+)
- Canvas API for candlestick rendering
- Google Fonts (Inter, Roboto Mono)
- Zero dependencies

## 🌐 Deploy

### Vercel (recommended)
1. Import this repo on [vercel.com](https://vercel.com)
2. Framework preset: **Other**
3. Deploy — no build step needed

### Local
```bash
python -m http.server 3000
# or
npx serve .
```

## 📁 Structure

```
├── index.html     # App shell + all modals
├── style.css      # Complete dark theme design system
├── app.js         # Trading engine + chart + state
├── vercel.json    # Vercel SPA routing config
└── .gitignore
```

---

> ⚠️ **Disclaimer**: This is a demo/educational trading simulator. All prices are simulated and no real trading occurs.

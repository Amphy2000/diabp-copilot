# Amphy V75 Scalper Bot

A premium, mobile-first automated V75 Tick Scalper Bot web application for Deriv (Synthetic Indices). 

## 🚀 Features

*   **📱 Mobile-First Design**: Optimized for smooth, native-like rendering in mobile browser views.
*   **⚡ WebSocket Integration**: Connects directly to Deriv's low-latency WebSocket API for instant tick data.
*   **🔒 Security Whitelist**: Fully integrated with Supabase to check the logging-in trader's account ID before authorizing access.
*   **⚙️ Advanced Scalper Settings**: Configure Stake, Target Profit, Stop Loss, and Martingale steps directly from the UI.
*   **📜 Real-Time Logger**: Displays a live activity stream of price action, strategy triggers, and trade states.

## 🛠 Tech Stack

*   Vanilla HTML5 / CSS3 / JavaScript (ES6+ / Vite)
*   Supabase (Public API Rest API)
*   Deriv WebSocket API

## 🌐 Setting Up Environment Variables (Vercel)

Ensure the following environment variables are configured in Vercel:

1.  `VITE_SUPABASE_URL`: Your Supabase Project URL.
2.  `VITE_SUPABASE_ANON_KEY`: Your Supabase public anon key.
3.  `VITE_DERIV_APP_ID`: Your registered Deriv App ID from the Deriv Developer Portal.

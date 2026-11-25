# ECLIPSE AI — Berserk Personal AI Chatbot (Groq + 3D WebGL)

A fast, customizable daily-driver personal AI chatbot powered by the **Groq API**, built with **vanilla HTML5, CSS3, and ES6+ JavaScript** on the frontend, a lightweight **Node.js + Express** server on the backend, and a 100% procedural **Three.js WebGL** *Berserk* dark-fantasy atmosphere.

---

## Using Your Groq API Key (Two Ways)

### Option 1: Enter Your Key Directly in the Website UI (Recommended)
1. Open the live app (or `http://localhost:3000`).
2. Paste your Groq API key (`gsk_...` from https://console.groq.com/keys) into the **"Astral Seal Unbound"** banner or click **Set API Key / Customize** in the top-right header.
3. Click **Bind Seal**. Your key is saved locally in your browser's `localStorage` (never included in exported `.md`/`.json` chronicles) and verified live against Groq.

### Option 2: Local `.env` Server Fallback (Optional)
For local self-hosting without entering a key in the browser, paste your key into `.env`:
```env
GROQ_API_KEY=gsk_your_actual_groq_key_here
GROQ_DEFAULT_MODEL=llama-3.3-70b-versatile
PORT=3000
```

---

## Local Development Quickstart

```bash
npm install
npm start
```
Open **http://localhost:3000** in your browser.

---

## Key Features

- **In-App Groq API Key Management:** Paste, mask/reveal, verify, or clear your Groq API key right inside the web app—with automatic `.env` fallback when self-hosted.
- **Procedural 3D WebGL Scene (`public/js/scene3d.js`):**
  - Custom GLSL **Blood-Eclipse Corona** & rolling crimson astral mist backdrop
  - 3D forged-iron **Brand of Sacrifice** sigil whose crimson veins react to `idle`, `streaming`, and `error` states
  - Peripheral cleaved **Obsidian Monoliths** & monumental **Dragon Slayer** greatsword silhouette
  - Dual-layer rising ember & drifting ash particle fields
  - **3D Atmosphere Controls:** Cycle between `Full`, `Subtle`, and `Static` (0% continuous GPU loop) anytime
  - **Clean Native OS Cursor:** Zero cursor-tracing rings, halos, or custom cursor followers
- **Personal Daily-Driver Customization:**
  - Edit defaults in `public/js/config.js` or live in the **Customize / Settings** drawer (`localStorage`)
  - Switch between *Daily Companion*, *Black Swordsman*, *Astral Scholar*, *Skull Knight*, or a *Custom Oath* system prompt
  - Live Groq model selector (fetched from `/api/models`) + custom model ID support
- **Complete Multi-Thread Chat Workflow:**
  - Multi-chronicle sidebar with auto-titling, rename, delete, purge, and `.md` / `.json` export
  - Real-time SSE token streaming with **Stop** cancellation (`AbortController`)
  - Safe Markdown rendering + syntax-highlighted code blocks with one-click **Copy** buttons
  - Per-message **Copy Markdown**, **Regenerate**, and **Edit & Resend**

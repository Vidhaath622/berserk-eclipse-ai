# ECLIPSE AI — Berserk Personal AI Chatbot (Groq + 3D WebGL)

A fast, customizable daily-driver personal AI chatbot powered by the **Groq API**, built with **vanilla HTML5, CSS3, and ES6+ JavaScript** on the frontend, a lightweight **Node.js + Express** server on the backend, and a 100% procedural **Three.js WebGL** *Berserk* dark-fantasy atmosphere.

---

## Quickstart (3 Steps)

### 1. Install Dependencies
```bash
npm install
```

### 2. Add Your Groq API Key to `.env`
Open `.env` in the project root and paste your Groq API key (from https://console.groq.com/keys):

```env
GROQ_API_KEY=gsk_your_actual_groq_key_here
GROQ_DEFAULT_MODEL=llama-3.3-70b-versatile
PORT=3000
```

> **Security Note:** `.env` is listed in `.gitignore` and read **exclusively on the Node.js server** (`server.js`). Your API key is never sent to or stored in the browser.

### 3. Start the Server
```bash
npm start
```
*(Or run `npm run dev` to auto-restart on server file edits.)*

Open **http://localhost:3000** in your browser.

---

## Key Features

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

---

## Project Structure

```text
.
├── .env                  # Local Groq API key (gitignored)
├── .env.example          # Template environment file
├── .gitignore            # Protects .env and node_modules
├── package.json          # Scripts & dependencies
├── server.js             # Express backend (/api/chat, /api/models, /api/health, /vendor/*)
└── public/
    ├── index.html        # Semantic HTML5 shell & inline SVG emblems
    ├── css/
    │   └── styles.css    # Pure CSS3 Berserk obsidian/crimson theme
    └── js/
        ├── config.js     # Default bot identity, personas, & starter prompts
        ├── state.js      # localStorage chronicle & settings store
        ├── api.js        # SSE streaming client & API helpers
        ├── markdown.js   # Safe Marked + Highlight.js renderer
        ├── scene3d.js    # Procedural Three.js Eclipse, Brand, Sword, & Embers
        ├── settings.js   # Customize & Settings drawer controller
        ├── ui.js         # DOM rendering, smart scroll, & message actions
        └── main.js       # Application bootstrap
```

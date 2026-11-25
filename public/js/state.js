/**
 * LocalStorage State Store for Sessions, Messages, and Personal Settings
 */

import { DEFAULT_CONFIG, PERSONA_PRESETS } from './config.js';

const STORAGE_KEYS = {
  SESSIONS: 'eclipse_ai_sessions_v1',
  ACTIVE_SESSION: 'eclipse_ai_active_session_v1',
  SETTINGS: 'eclipse_ai_settings_v1',
  SIDEBAR_COLLAPSED: 'eclipse_ai_sidebar_collapsed_v1'
};

function generateId(prefix = 'id') {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function safeParseJSON(raw, fallback) {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function detectInitialAtmosphere() {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return 'subtle';
  }
  return DEFAULT_CONFIG.atmosphere;
}

class ChatStore {
  constructor() {
    this.listeners = new Set();
    this.sessions = [];
    this.activeSessionId = null;
    this.sidebarCollapsed = false;
    this.settings = {
      ...DEFAULT_CONFIG,
      model: DEFAULT_CONFIG.defaultModel,
      customModel: '',
      atmosphere: detectInitialAtmosphere()
    };
    this.load();
  }

  load() {
    const savedSettings = safeParseJSON(localStorage.getItem(STORAGE_KEYS.SETTINGS), null);
    if (savedSettings && typeof savedSettings === 'object') {
      this.settings = {
        ...this.settings,
        ...savedSettings,
        temperature: clampNumber(savedSettings.temperature, 0, 1.5, DEFAULT_CONFIG.temperature),
        maxTokens: clampInt(savedSettings.maxTokens, 256, 8192, DEFAULT_CONFIG.maxTokens),
        atmosphere: ['full', 'subtle', 'static'].includes(savedSettings.atmosphere)
          ? savedSettings.atmosphere
          : this.settings.atmosphere
      };
    }

    const savedSessions = safeParseJSON(localStorage.getItem(STORAGE_KEYS.SESSIONS), []);
    if (Array.isArray(savedSessions)) {
      this.sessions = savedSessions.filter((s) => s && typeof s.id === 'string' && Array.isArray(s.messages));
    }

    const savedActive = localStorage.getItem(STORAGE_KEYS.ACTIVE_SESSION);
    if (savedActive && this.sessions.some((s) => s.id === savedActive)) {
      this.activeSessionId = savedActive;
    } else if (this.sessions.length > 0) {
      this.activeSessionId = this.sessions[0].id;
    } else {
      const fresh = this.buildBlankSession();
      this.sessions = [fresh];
      this.activeSessionId = fresh.id;
      this.persistSessions();
    }

    this.sidebarCollapsed = localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
  }

  buildBlankSession() {
    const now = Date.now();
    return {
      id: generateId('chronicle'),
      title: 'New Chronicle',
      autoTitled: false,
      createdAt: now,
      updatedAt: now,
      messages: []
    };
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(reason = 'update') {
    for (const listener of this.listeners) {
      try {
        listener(this, reason);
      } catch (err) {
        console.error('State listener error:', err);
      }
    }
  }

  persistSessions() {
    try {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(this.sessions));
      if (this.activeSessionId) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_SESSION, this.activeSessionId);
      }
    } catch (err) {
      console.warn('Unable to persist sessions to localStorage:', err);
    }
  }

  persistSettings() {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(this.settings));
    } catch (err) {
      console.warn('Unable to persist settings to localStorage:', err);
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  getEffectiveModel() {
    const custom = (this.settings.customModel || '').trim();
    if (this.settings.model === '__custom__' && custom) {
      return custom;
    }
    return (this.settings.model && this.settings.model !== '__custom__')
      ? this.settings.model
      : DEFAULT_CONFIG.defaultModel;
  }

  getActivePersona() {
    return (
      PERSONA_PRESETS.find((p) => p.id === this.settings.personaId) ||
      PERSONA_PRESETS[0]
    );
  }

  updateSettings(patch) {
    const next = { ...this.settings, ...patch };
    next.botName = (next.botName || '').trim() || DEFAULT_CONFIG.botName;
    next.botSubtitle = (next.botSubtitle || '').trim() || DEFAULT_CONFIG.botSubtitle;
    next.userName = (next.userName || '').trim() || DEFAULT_CONFIG.userName;
    next.temperature = clampNumber(next.temperature, 0, 1.5, DEFAULT_CONFIG.temperature);
    next.maxTokens = clampInt(next.maxTokens, 256, 8192, DEFAULT_CONFIG.maxTokens);
    if (!['full', 'subtle', 'static'].includes(next.atmosphere)) {
      next.atmosphere = DEFAULT_CONFIG.atmosphere;
    }
    this.settings = next;
    this.persistSettings();
    this.notify('settings');
  }

  resetSettings(serverDefaultModel) {
    this.settings = {
      ...DEFAULT_CONFIG,
      model: serverDefaultModel || DEFAULT_CONFIG.defaultModel,
      customModel: '',
      atmosphere: detectInitialAtmosphere()
    };
    this.persistSettings();
    this.notify('settings');
  }

  cycleAtmosphere() {
    const order = ['full', 'subtle', 'static'];
    const idx = order.indexOf(this.settings.atmosphere);
    const next = order[(idx + 1) % order.length];
    this.updateSettings({ atmosphere: next });
    return next;
  }

  setSidebarCollapsed(collapsed) {
    this.sidebarCollapsed = Boolean(collapsed);
    try {
      localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(this.sidebarCollapsed));
    } catch {
      // ignore storage quota errors
    }
    this.notify('sidebar');
  }

  getSessions() {
    return [...this.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getActiveSession() {
    return this.sessions.find((s) => s.id === this.activeSessionId) || this.sessions[0] || null;
  }

  createSession() {
    const existingActive = this.getActiveSession();
    if (existingActive && existingActive.messages.length === 0 && existingActive.title === 'New Chronicle') {
      this.notify('session');
      return existingActive;
    }
    const session = this.buildBlankSession();
    this.sessions.unshift(session);
    this.activeSessionId = session.id;
    this.persistSessions();
    this.notify('session');
    return session;
  }

  setActiveSession(id) {
    if (!this.sessions.some((s) => s.id === id)) return;
    this.activeSessionId = id;
    this.persistSessions();
    this.notify('session');
  }

  renameSession(id, rawTitle) {
    const session = this.sessions.find((s) => s.id === id);
    if (!session) return;
    const clean = (rawTitle || '').trim();
    if (!clean) return;
    session.title = clean.slice(0, 80);
    session.autoTitled = true;
    session.updatedAt = Date.now();
    this.persistSessions();
    this.notify('session');
  }

  deleteSession(id) {
    this.sessions = this.sessions.filter((s) => s.id !== id);
    if (this.sessions.length === 0) {
      const fresh = this.buildBlankSession();
      this.sessions = [fresh];
      this.activeSessionId = fresh.id;
    } else if (this.activeSessionId === id) {
      const sorted = this.getSessions();
      this.activeSessionId = sorted[0].id;
    }
    this.persistSessions();
    this.notify('session');
  }

  clearAllSessions() {
    const fresh = this.buildBlankSession();
    this.sessions = [fresh];
    this.activeSessionId = fresh.id;
    this.persistSessions();
    this.notify('session');
    return fresh;
  }

  addMessage(sessionId, { role, content, model = '', meta = null, isError = false }) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return null;

    const msg = {
      id: generateId('msg'),
      role,
      content: String(content ?? ''),
      model,
      meta,
      isError: Boolean(isError),
      createdAt: Date.now()
    };

    session.messages.push(msg);
    session.updatedAt = Date.now();

    if (role === 'user' && !session.autoTitled && session.title === 'New Chronicle') {
      session.title = deriveTitleFromPrompt(msg.content);
      session.autoTitled = true;
    }

    this.persistSessions();
    this.notify('messages');
    return msg;
  }

  updateMessage(sessionId, messageId, patch, { persist = true, silent = false } = {}) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    const msg = session.messages.find((m) => m.id === messageId);
    if (!msg) return null;

    Object.assign(msg, patch);
    session.updatedAt = Date.now();

    if (persist) {
      this.persistSessions();
    }
    if (!silent) {
      this.notify('messages');
    }
    return msg;
  }

  truncateFromMessage(sessionId, messageId, { inclusive = true } = {}) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) return false;
    const idx = session.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return false;
    session.messages = session.messages.slice(0, inclusive ? idx : idx + 1);
    session.updatedAt = Date.now();
    this.persistSessions();
    this.notify('messages');
    return true;
  }

  exportSessionMarkdown(sessionId) {
    const session = this.sessions.find((s) => s.id === sessionId) || this.getActiveSession();
    if (!session) return '';

    const lines = [
      `# ${session.title}`,
      ``,
      `- **Assistant:** ${this.settings.botName}`,
      `- **Exported:** ${new Date().toISOString()}`,
      ``,
      `---`,
      ``
    ];

    for (const m of session.messages) {
      const speaker = m.role === 'user' ? this.settings.userName : `${this.settings.botName}${m.model ? ` (${m.model})` : ''}`;
      const stamp = new Date(m.createdAt).toLocaleString();
      lines.push(`### ${speaker} — _${stamp}_`);
      lines.push('');
      lines.push(m.content || '');
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    return lines.join('\n');
  }

  exportSessionJSON(sessionId) {
    const session = this.sessions.find((s) => s.id === sessionId) || this.getActiveSession();
    if (!session) return '{}';
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        botName: this.settings.botName,
        userName: this.settings.userName,
        session
      },
      null,
      2
    );
  }
}

function deriveTitleFromPrompt(text) {
  const oneLine = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!oneLine) return 'Untitled Chronicle';
  return oneLine.length > 44 ? `${oneLine.slice(0, 44).trim()}…` : oneLine;
}

function clampNumber(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, Math.round(num * 100) / 100));
}

function clampInt(val, min, max, fallback) {
  const num = parseInt(val, 10);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export const store = new ChatStore();

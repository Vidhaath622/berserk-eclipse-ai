/**
 * Customize & Settings Drawer Controller
 * Persists user Groq API key, chatbot identity, Berserk/daily-driver personas,
 * generation params, and 3D WebGL atmosphere intensity to localStorage via store.
 */

import { PERSONA_PRESETS } from './config.js';

export class SettingsController {
  constructor({ store, onAtmospherePreview, onApiKeyChanged, getServerDefaultModel }) {
    this.store = store;
    this.onAtmospherePreview = onAtmospherePreview;
    this.onApiKeyChanged = onApiKeyChanged;
    this.getServerDefaultModel = getServerDefaultModel;
    this.isOpen = false;
    this.pendingAtmosphere = store.getSettings().atmosphere;
    this.keyStatusMeta = { configured: false, rejected: false, source: 'none' };

    this.cacheDom();
    this.populatePersonaOptions();
    this.bindEvents();
    this.syncFromStore();
  }

  cacheDom() {
    this.drawer = document.getElementById('settings-drawer');
    this.backdrop = document.getElementById('settings-backdrop');
    this.openBtn = document.getElementById('open-settings-btn');
    this.openKeyHeaderBtn = document.getElementById('open-key-settings-btn');
    this.sidebarKeyBadge = document.getElementById('sidebar-key-badge');
    this.personaPillBtn = document.getElementById('composer-persona-pill');
    this.closeBtn = document.getElementById('close-settings-btn');
    this.form = document.getElementById('settings-form');
    this.resetBtn = document.getElementById('reset-settings-btn');

    this.apiKeyInput = document.getElementById('setting-api-key');
    this.apiKeyToggleVisBtn = document.getElementById('setting-key-toggle-vis');
    this.clearKeyBtn = document.getElementById('setting-clear-key-btn');
    this.keyStatusPill = document.getElementById('setting-key-status-pill');

    this.botNameInput = document.getElementById('setting-bot-name');
    this.botSubtitleInput = document.getElementById('setting-bot-subtitle');
    this.userNameInput = document.getElementById('setting-user-name');
    this.personaSelect = document.getElementById('setting-persona-select');
    this.personaDesc = document.getElementById('setting-persona-desc');
    this.systemPromptInput = document.getElementById('setting-system-prompt');
    this.tempSlider = document.getElementById('setting-temperature');
    this.tempDisplay = document.getElementById('setting-temp-display');
    this.maxTokensInput = document.getElementById('setting-max-tokens');
    this.customModelInput = document.getElementById('setting-custom-model');
    this.atmosphereBtns = Array.from(
      document.querySelectorAll('[data-atmosphere-choice]')
    );
  }

  populatePersonaOptions() {
    this.personaSelect.innerHTML = PERSONA_PRESETS.map(
      (p) => `<option value="${p.id}">${p.name}</option>`
    ).join('');
  }

  bindEvents() {
    this.openBtn?.addEventListener('click', () => this.open({ focusKey: false }));
    this.openKeyHeaderBtn?.addEventListener('click', () => this.open({ focusKey: true }));
    this.sidebarKeyBadge?.addEventListener('click', () => this.open({ focusKey: true }));
    this.personaPillBtn?.addEventListener('click', () => this.open({ focusKey: false }));
    this.closeBtn?.addEventListener('click', () => this.close());
    this.backdrop?.addEventListener('click', () => this.close());

    this.apiKeyToggleVisBtn?.addEventListener('click', () => {
      if (!this.apiKeyInput) return;
      const isMasked = this.apiKeyInput.type === 'password';
      this.apiKeyInput.type = isMasked ? 'text' : 'password';
      this.apiKeyToggleVisBtn.textContent = isMasked ? 'Hide' : 'Show';
    });

    this.clearKeyBtn?.addEventListener('click', () => {
      this.apiKeyInput.value = '';
      this.store.setUserApiKey('');
      this.clearKeyBtn.hidden = true;
      this.onApiKeyChanged?.('');
    });

    this.personaSelect?.addEventListener('change', () => {
      const selected = PERSONA_PRESETS.find((p) => p.id === this.personaSelect.value);
      if (!selected) return;
      this.personaDesc.textContent = selected.description;
      if (selected.id !== 'custom') {
        this.systemPromptInput.value = selected.systemPrompt;
      }
    });

    this.systemPromptInput?.addEventListener('input', () => {
      const activePreset = PERSONA_PRESETS.find((p) => p.id === this.personaSelect.value);
      if (activePreset && activePreset.id !== 'custom') {
        if (this.systemPromptInput.value.trim() !== activePreset.systemPrompt.trim()) {
          this.personaSelect.value = 'custom';
          const customPreset = PERSONA_PRESETS.find((p) => p.id === 'custom');
          if (customPreset) {
            this.personaDesc.textContent = customPreset.description;
          }
        }
      }
    });

    this.tempSlider?.addEventListener('input', () => {
      this.tempDisplay.textContent = Number(this.tempSlider.value).toFixed(2);
    });

    for (const btn of this.atmosphereBtns) {
      btn.addEventListener('click', () => {
        const level = btn.getAttribute('data-atmosphere-choice');
        if (!level) return;
        this.pendingAtmosphere = level;
        this.highlightAtmosphereButtons(level);
        this.onAtmospherePreview?.(level);
      });
    }

    this.form?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });

    this.resetBtn?.addEventListener('click', () => {
      const defModel = this.getServerDefaultModel ? this.getServerDefaultModel() : undefined;
      this.store.resetSettings(defModel);
      this.syncFromStore();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });
  }

  setKeyStatusMeta({ configured, rejected = false, source = 'none' }) {
    this.keyStatusMeta = { configured, rejected, source };
    this.renderKeyStatusPill();
  }

  renderKeyStatusPill() {
    if (!this.keyStatusPill) return;
    const { configured, rejected, source } = this.keyStatusMeta;
    if (configured && !rejected) {
      this.keyStatusPill.textContent =
        source === 'browser' ? 'Bound (Browser Key)' : 'Bound (Server .env)';
      this.keyStatusPill.style.color = '#c89645';
    } else if (rejected) {
      this.keyStatusPill.textContent = 'Rejected (401)';
      this.keyStatusPill.style.color = '#ef4444';
    } else {
      this.keyStatusPill.textContent = 'Unbound';
      this.keyStatusPill.style.color = '#fca5a5';
    }
  }

  syncFromStore() {
    const s = this.store.getSettings();
    const savedKey = this.store.getUserApiKey();

    if (this.apiKeyInput) {
      this.apiKeyInput.value = savedKey;
      this.apiKeyInput.type = 'password';
    }
    if (this.apiKeyToggleVisBtn) {
      this.apiKeyToggleVisBtn.textContent = 'Show';
    }
    if (this.clearKeyBtn) {
      this.clearKeyBtn.hidden = !savedKey;
    }
    this.renderKeyStatusPill();

    this.botNameInput.value = s.botName || '';
    this.botSubtitleInput.value = s.botSubtitle || '';
    this.userNameInput.value = s.userName || '';
    this.personaSelect.value = s.personaId || 'daily-driver';

    const preset =
      PERSONA_PRESETS.find((p) => p.id === this.personaSelect.value) || PERSONA_PRESETS[0];
    this.personaDesc.textContent = preset.description;
    this.systemPromptInput.value = s.systemPrompt || preset.systemPrompt;

    this.tempSlider.value = String(s.temperature ?? 0.7);
    this.tempDisplay.textContent = Number(s.temperature ?? 0.7).toFixed(2);
    this.maxTokensInput.value = String(s.maxTokens ?? 4096);
    this.customModelInput.value = s.customModel || '';

    this.pendingAtmosphere = s.atmosphere || 'full';
    this.highlightAtmosphereButtons(this.pendingAtmosphere);
  }

  highlightAtmosphereButtons(level) {
    for (const btn of this.atmosphereBtns) {
      const match = btn.getAttribute('data-atmosphere-choice') === level;
      btn.classList.toggle('active', match);
      btn.setAttribute('aria-checked', String(match));
    }
  }

  save() {
    const previousKey = this.store.getUserApiKey();
    const nextKey = (this.apiKeyInput?.value || '').trim();
    const keyChanged = nextKey !== previousKey;

    if (keyChanged) {
      this.store.setUserApiKey(nextKey);
    }

    const customModel = (this.customModelInput.value || '').trim();
    const currentSettings = this.store.getSettings();

    const patch = {
      botName: this.botNameInput.value,
      botSubtitle: this.botSubtitleInput.value,
      userName: this.userNameInput.value,
      personaId: this.personaSelect.value,
      systemPrompt: this.systemPromptInput.value,
      temperature: Number(this.tempSlider.value),
      maxTokens: Number(this.maxTokensInput.value),
      customModel,
      atmosphere: this.pendingAtmosphere
    };

    if (customModel) {
      patch.model = '__custom__';
    } else if (currentSettings.model === '__custom__') {
      patch.model = this.getServerDefaultModel?.() || currentSettings.defaultModel;
    }

    this.store.updateSettings(patch);
    this.close({ saved: true });

    if (keyChanged) {
      this.onApiKeyChanged?.(nextKey);
    }
  }

  open({ focusKey = false } = {}) {
    this.syncFromStore();
    this.isOpen = true;
    this.backdrop.hidden = false;
    this.drawer.classList.add('open');
    this.drawer.setAttribute('aria-hidden', 'false');
    setTimeout(() => {
      if (focusKey || !this.keyStatusMeta.configured) {
        this.apiKeyInput?.focus();
      } else {
        this.botNameInput?.focus();
      }
    }, 60);
  }

  close({ saved = false } = {}) {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.drawer.classList.remove('open');
    this.drawer.setAttribute('aria-hidden', 'true');
    this.backdrop.hidden = true;

    if (!saved) {
      const storedLevel = this.store.getSettings().atmosphere;
      this.onAtmospherePreview?.(storedLevel);
    }
  }
}

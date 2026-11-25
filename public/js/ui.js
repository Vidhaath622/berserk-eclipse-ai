/**
 * Foreground DOM & Chat UI Controller
 * Renders chronicles sidebar, model selector, welcome state, streaming messages,
 * code copy buttons, inline prompt editing, export downloads, and smart auto-scroll.
 */

import { STARTER_PROMPTS } from './config.js';
import { escapeHtml, renderMarkdown } from './markdown.js';

export class ChatUI {
  constructor({ store, callbacks }) {
    this.store = store;
    this.callbacks = callbacks;
    this.userScrolledUp = false;
    this.isStreaming = false;
    this.editingMessageId = null;
    this.availableModels = [];
    this.dialogResolver = null;

    this.cacheDom();
    this.renderStarterPrompts();
    this.bindEvents();
    this.syncAll();
  }

  cacheDom() {
    this.appShell = document.getElementById('app-shell');
    this.mobileBackdrop = document.getElementById('mobile-backdrop');
    this.sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    this.sidebarCloseMobileBtn = document.getElementById('sidebar-close-mobile');
    this.newChatBtn = document.getElementById('new-chat-btn');
    this.sessionListEl = document.getElementById('session-list');

    this.exportMdBtn = document.getElementById('export-md-btn');
    this.exportJsonBtn = document.getElementById('export-json-btn');
    this.clearHistoryBtn = document.getElementById('clear-history-btn');

    this.sidebarKeyBadge = document.getElementById('sidebar-key-badge');
    this.sidebarKeyText = document.getElementById('sidebar-key-text');

    this.headerBotName = document.getElementById('header-bot-name');
    this.headerBotSubtitle = document.getElementById('header-bot-subtitle');
    this.modelSelect = document.getElementById('model-select');
    this.headerCustomModel = document.getElementById('header-custom-model');
    this.atmosphereToggleBtn = document.getElementById('atmosphere-toggle-btn');
    this.atmosphereLabel = document.getElementById('atmosphere-label');

    this.keyBanner = document.getElementById('api-key-banner');
    this.keyBannerTitle = document.getElementById('api-key-banner-title');
    this.keyBannerDesc = document.getElementById('api-key-banner-desc');
    this.keyBannerSnippet = document.getElementById('api-key-banner-snippet');
    this.recheckKeyBtn = document.getElementById('recheck-key-btn');

    this.viewport = document.getElementById('chat-viewport');
    this.welcomeScreen = document.getElementById('welcome-screen');
    this.welcomeTitle = document.getElementById('welcome-title');
    this.welcomeGreeting = document.getElementById('welcome-greeting');
    this.starterGrid = document.getElementById('starter-prompts-grid');
    this.messageList = document.getElementById('message-list');
    this.jumpLatestBtn = document.getElementById('jump-latest-btn');

    this.composerForm = document.getElementById('composer-form');
    this.promptInput = document.getElementById('prompt-input');
    this.sendBtn = document.getElementById('send-btn');
    this.stopBtn = document.getElementById('stop-stream-btn');
    this.personaNameEl = document.getElementById('composer-persona-name');
    this.tempValEl = document.getElementById('composer-temp-val');
    this.statusHintEl = document.getElementById('composer-status-hint');

    // Custom Dialog Modal
    this.dialogBackdrop = document.getElementById('dialog-backdrop');
    this.dialogTitle = document.getElementById('dialog-title');
    this.dialogMessage = document.getElementById('dialog-message');
    this.dialogInput = document.getElementById('dialog-input');
    this.dialogCancelBtn = document.getElementById('dialog-cancel-btn');
    this.dialogConfirmBtn = document.getElementById('dialog-confirm-btn');
  }

  renderStarterPrompts() {
    this.starterGrid.innerHTML = STARTER_PROMPTS.map(
      (item, idx) => `
        <button type="button" class="starter-chip" data-starter-idx="${idx}" role="listitem">
          <span class="starter-chip-tag">${escapeHtml(item.tag)}</span>
          <span class="starter-chip-title">${escapeHtml(item.title)}</span>
          <span class="starter-chip-sub">${escapeHtml(item.subtitle)}</span>
        </button>
      `
    ).join('');
  }

  bindEvents() {
    // Sidebar desktop collapse & mobile drawer toggle
    this.sidebarToggleBtn?.addEventListener('click', () => {
      if (window.innerWidth <= 900) {
        const open = !this.appShell.classList.contains('mobile-sidebar-open');
        this.setMobileSidebar(open);
      } else {
        this.store.setSidebarCollapsed(!this.store.sidebarCollapsed);
      }
    });

    this.sidebarCloseMobileBtn?.addEventListener('click', () => this.setMobileSidebar(false));
    this.mobileBackdrop?.addEventListener('click', () => this.setMobileSidebar(false));

    // New Chronicle
    this.newChatBtn?.addEventListener('click', () => {
      if (this.isStreaming) {
        this.callbacks.onStopStream?.();
      }
      this.editingMessageId = null;
      this.store.createSession();
      this.setMobileSidebar(false);
      this.promptInput?.focus();
    });

    // Session list actions (select, rename, delete)
    this.sessionListEl?.addEventListener('click', async (e) => {
      const renameBtn = e.target.closest('[data-rename-session]');
      if (renameBtn) {
        e.stopPropagation();
        const id = renameBtn.getAttribute('data-rename-session');
        const session = this.store.getSessions().find((s) => s.id === id);
        if (!session) return;
        const nextTitle = await this.openDialog({
          title: 'Rename Chronicle',
          message: 'Enter a new title for this conversation:',
          inputValue: session.title,
          confirmLabel: 'Rename'
        });
        if (typeof nextTitle === 'string' && nextTitle.trim()) {
          this.store.renameSession(id, nextTitle);
        }
        return;
      }

      const deleteBtn = e.target.closest('[data-delete-session]');
      if (deleteBtn) {
        e.stopPropagation();
        const id = deleteBtn.getAttribute('data-delete-session');
        if (this.isStreaming && this.store.activeSessionId === id) {
          this.callbacks.onStopStream?.();
        }
        this.store.deleteSession(id);
        return;
      }

      const selectBtn = e.target.closest('[data-select-session]');
      if (selectBtn) {
        const id = selectBtn.getAttribute('data-select-session');
        if (id && id !== this.store.activeSessionId) {
          if (this.isStreaming) {
            this.callbacks.onStopStream?.();
          }
          this.editingMessageId = null;
          this.store.setActiveSession(id);
          this.userScrolledUp = false;
          this.scrollToBottom(true);
        }
        this.setMobileSidebar(false);
      }
    });

    // Export & Clear All
    this.exportMdBtn?.addEventListener('click', () => this.downloadExport('md'));
    this.exportJsonBtn?.addEventListener('click', () => this.downloadExport('json'));
    this.clearHistoryBtn?.addEventListener('click', async () => {
      const confirmed = await this.openDialog({
        title: 'Purge All Chronicles',
        message: 'This will permanently erase every saved conversation from browser storage. Proceed?',
        confirmLabel: 'Purge All'
      });
      if (confirmed) {
        if (this.isStreaming) this.callbacks.onStopStream?.();
        this.editingMessageId = null;
        this.store.clearAllSessions();
        this.showTransientHint('All chronicles purged.');
      }
    });

    // Header Model Selector & Custom Model Inline Input
    this.modelSelect?.addEventListener('change', () => {
      const val = this.modelSelect.value;
      if (val === '__custom__') {
        this.headerCustomModel.hidden = false;
        this.headerCustomModel.focus();
        this.store.updateSettings({ model: '__custom__' });
      } else {
        this.headerCustomModel.hidden = true;
        this.store.updateSettings({ model: val });
      }
    });

    this.headerCustomModel?.addEventListener('change', () => {
      this.store.updateSettings({
        model: '__custom__',
        customModel: this.headerCustomModel.value.trim()
      });
    });

    // Atmosphere Quick-Toggle
    this.atmosphereToggleBtn?.addEventListener('click', () => {
      this.store.cycleAtmosphere();
    });

    // Re-check .env API Key
    this.recheckKeyBtn?.addEventListener('click', () => {
      this.callbacks.onRecheckKey?.();
    });

    // Starter prompt chips
    this.starterGrid?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-starter-idx]');
      if (!chip || this.isStreaming) return;
      const idx = Number(chip.getAttribute('data-starter-idx'));
      const item = STARTER_PROMPTS[idx];
      if (!item) return;
      this.promptInput.value = item.prompt;
      this.submitPrompt();
    });

    // Smart Auto-Scroll Detection
    this.viewport?.addEventListener('scroll', () => {
      const distanceFromBottom =
        this.viewport.scrollHeight - this.viewport.scrollTop - this.viewport.clientHeight;
      this.userScrolledUp = distanceFromBottom > 95;
      this.jumpLatestBtn.hidden = !this.userScrolledUp;
    });

    this.jumpLatestBtn?.addEventListener('click', () => {
      this.userScrolledUp = false;
      this.jumpLatestBtn.hidden = true;
      this.scrollToBottom(true);
    });

    // Delegated Message Actions (Copy Code, Copy Markdown, Regenerate, Edit & Resend)
    this.messageList?.addEventListener('click', async (e) => {
      const copyCodeBtn = e.target.closest('[data-copy-code]');
      if (copyCodeBtn) {
        const shell = copyCodeBtn.closest('.code-block-shell');
        const codeNode = shell?.querySelector('pre code');
        if (codeNode) {
          await copyTextToClipboard(codeNode.textContent || '');
          const label = copyCodeBtn.querySelector('.copy-code-label');
          copyCodeBtn.classList.add('copied');
          if (label) label.textContent = 'Copied!';
          setTimeout(() => {
            copyCodeBtn.classList.remove('copied');
            if (label) label.textContent = 'Copy';
          }, 1600);
        }
        return;
      }

      const copyMsgBtn = e.target.closest('[data-copy-msg]');
      if (copyMsgBtn) {
        const msgId = copyMsgBtn.getAttribute('data-copy-msg');
        const session = this.store.getActiveSession();
        const msg = session?.messages.find((m) => m.id === msgId);
        if (msg) {
          await copyTextToClipboard(msg.content || '');
          const orig = copyMsgBtn.textContent;
          copyMsgBtn.textContent = 'Copied';
          setTimeout(() => {
            copyMsgBtn.textContent = orig;
          }, 1400);
        }
        return;
      }

      const regenBtn = e.target.closest('[data-regen-msg]');
      if (regenBtn && !this.isStreaming) {
        const msgId = regenBtn.getAttribute('data-regen-msg');
        this.callbacks.onRegenerate?.(msgId);
        return;
      }

      const editBtn = e.target.closest('[data-edit-msg]');
      if (editBtn && !this.isStreaming) {
        this.editingMessageId = editBtn.getAttribute('data-edit-msg');
        this.renderMessages();
        return;
      }

      const cancelEditBtn = e.target.closest('[data-cancel-edit]');
      if (cancelEditBtn) {
        this.editingMessageId = null;
        this.renderMessages();
        return;
      }

      const saveEditBtn = e.target.closest('[data-save-edit]');
      if (saveEditBtn && !this.isStreaming) {
        const msgId = saveEditBtn.getAttribute('data-save-edit');
        const row = saveEditBtn.closest('.msg-row');
        const textarea = row?.querySelector('.inline-edit-textarea');
        const updatedText = textarea?.value.trim() || '';
        if (!updatedText) return;
        this.editingMessageId = null;
        this.callbacks.onEditAndResend?.(msgId, updatedText);
      }
    });

    // Composer Textarea Auto-Resize & Enter-to-Send
    this.promptInput?.addEventListener('input', () => this.autoResizeTextarea());
    this.promptInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        if (!this.isStreaming) {
          this.submitPrompt();
        }
      }
    });

    this.composerForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!this.isStreaming) {
        this.submitPrompt();
      }
    });

    this.stopBtn?.addEventListener('click', () => {
      this.callbacks.onStopStream?.();
    });

    // Dialog Modal Listeners
    this.dialogCancelBtn?.addEventListener('click', () => this.closeDialog(null));
    this.dialogBackdrop?.addEventListener('click', (e) => {
      if (e.target === this.dialogBackdrop) this.closeDialog(null);
    });
    this.dialogConfirmBtn?.addEventListener('click', () => {
      if (!this.dialogInput.hidden) {
        this.closeDialog(this.dialogInput.value);
      } else {
        this.closeDialog(true);
      }
    });
    this.dialogInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.closeDialog(this.dialogInput.value);
      } else if (e.key === 'Escape') {
        this.closeDialog(null);
      }
    });
  }

  submitPrompt() {
    const text = (this.promptInput.value || '').trim();
    if (!text) return;
    this.promptInput.value = '';
    this.autoResizeTextarea();
    this.userScrolledUp = false;
    this.jumpLatestBtn.hidden = true;
    this.callbacks.onSendPrompt?.(text);
  }

  autoResizeTextarea() {
    if (!this.promptInput) return;
    this.promptInput.style.height = 'auto';
    this.promptInput.style.height = `${Math.min(190, this.promptInput.scrollHeight)}px`;
  }

  setMobileSidebar(open) {
    this.appShell.classList.toggle('mobile-sidebar-open', open);
    this.mobileBackdrop.hidden = !open;
  }

  syncAll(reason = 'all') {
    this.syncLayoutAndIdentity();
    this.renderSessionList();
    if (reason !== 'settings-only') {
      this.renderMessages();
    }
  }

  syncLayoutAndIdentity() {
    const s = this.store.getSettings();
    const persona = this.store.getActivePersona();

    this.appShell.classList.toggle('sidebar-collapsed', this.store.sidebarCollapsed);

    this.headerBotName.textContent = s.botName;
    this.headerBotSubtitle.textContent = s.botSubtitle;
    document.title = `${s.botName} — Personal AI`;

    this.welcomeTitle.textContent = s.botName;
    this.welcomeGreeting.textContent = `Greetings, ${s.userName}. What problem shall we cleave through today?`;

    const atmCap = s.atmosphere.charAt(0).toUpperCase() + s.atmosphere.slice(1);
    this.atmosphereLabel.textContent = atmCap;

    this.personaNameEl.textContent = persona.shortLabel || persona.name;
    this.tempValEl.textContent = Number(s.temperature).toFixed(2);

    this.syncModelControls();
  }

  setModels(models) {
    this.availableModels = Array.isArray(models) ? models : [];
    this.syncModelControls();
  }

  syncModelControls() {
    if (!this.modelSelect) return;
    const s = this.store.getSettings();
    const list = this.availableModels.length > 0 ? this.availableModels : [];

    const optionsHtml = list
      .map((m) => `<option value="${escapeHtml(m.id)}">${escapeHtml(m.label || m.id)}</option>`)
      .concat(`<option value="__custom__">Custom Model ID…</option>`)
      .join('');

    this.modelSelect.innerHTML = optionsHtml;

    const hasSavedModel = list.some((m) => m.id === s.model);
    if (s.model === '__custom__') {
      this.modelSelect.value = '__custom__';
      this.headerCustomModel.hidden = false;
      this.headerCustomModel.value = s.customModel || '';
    } else if (hasSavedModel) {
      this.modelSelect.value = s.model;
      this.headerCustomModel.hidden = true;
    } else if (list.length > 0) {
      this.modelSelect.value = list[0].id;
      this.headerCustomModel.hidden = true;
    }
  }

  updateKeyStatus({ configured, rejected = false, setupExample = '', message = '' }) {
    this.sidebarKeyBadge.classList.remove('connected', 'unbound');

    if (configured && !rejected) {
      this.sidebarKeyBadge.classList.add('connected');
      this.sidebarKeyText.textContent = '.env Groq Seal: Active';
      this.keyBanner.hidden = true;
      return;
    }

    this.sidebarKeyBadge.classList.add('unbound');
    this.sidebarKeyText.textContent = rejected
      ? '.env Groq Seal: Rejected (401)'
      : '.env Groq Seal: Missing Key';

    this.keyBanner.hidden = false;
    this.keyBannerTitle.textContent = rejected
      ? 'Astral Seal Fractured — Invalid Groq API Key (401)'
      : 'Astral Seal Unbound — Missing Groq API Key';

    this.keyBannerDesc.innerHTML = message
      ? escapeHtml(message)
      : 'Open your local <code>.env</code> file, paste your Groq API key on the line below, save, and restart the server (<code>npm start</code>):';

    this.keyBannerSnippet.textContent = setupExample || 'Paste your key into .env';
  }

  setStreamingState(streaming) {
    this.isStreaming = Boolean(streaming);
    document.body.classList.toggle('is-streaming', this.isStreaming);
    this.stopBtn.hidden = !this.isStreaming;
    this.sendBtn.hidden = this.isStreaming;
  }

  showTransientHint(text, durationMs = 4200) {
    if (!this.statusHintEl) return;
    this.statusHintEl.textContent = text || '';
    if (this.hintTimer) clearTimeout(this.hintTimer);
    if (text && durationMs > 0) {
      this.hintTimer = setTimeout(() => {
        this.statusHintEl.textContent = '';
      }, durationMs);
    }
  }

  renderSessionList() {
    const sessions = this.store.getSessions();
    const activeId = this.store.activeSessionId;

    this.sessionListEl.innerHTML = sessions
      .map((s) => {
        const isActive = s.id === activeId;
        const msgCount = s.messages.length;
        const timeStr = formatShortTime(s.updatedAt);
        return `
          <div class="session-item${isActive ? ' active' : ''}" role="listitem">
            <button type="button" class="session-select-btn" data-select-session="${escapeHtml(s.id)}">
              <span class="session-title-text">${escapeHtml(s.title)}</span>
              <span class="session-meta-text">${msgCount} ${msgCount === 1 ? 'entry' : 'entries'} • ${escapeHtml(timeStr)}</span>
            </button>
            <div class="session-actions">
              <button
                type="button"
                class="session-icon-btn"
                data-rename-session="${escapeHtml(s.id)}"
                title="Rename chronicle"
                aria-label="Rename chronicle"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button
                type="button"
                class="session-icon-btn danger"
                data-delete-session="${escapeHtml(s.id)}"
                title="Delete chronicle"
                aria-label="Delete chronicle"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  }

  renderMessages() {
    const session = this.store.getActiveSession();
    const settings = this.store.getSettings();
    const messages = session?.messages || [];

    if (messages.length === 0) {
      this.welcomeScreen.hidden = false;
      this.messageList.hidden = true;
      this.messageList.innerHTML = '';
      this.jumpLatestBtn.hidden = true;
      return;
    }

    this.welcomeScreen.hidden = true;
    this.messageList.hidden = false;

    const userInitial = (settings.userName || 'S').trim().charAt(0).toUpperCase();

    this.messageList.innerHTML = messages
      .map((m) => this.buildMessageHtml(m, settings, userInitial))
      .join('');

    if (!this.userScrolledUp) {
      this.scrollToBottom(false);
    }
  }

  buildMessageHtml(msg, settings, userInitial) {
    const isUser = msg.role === 'user';
    const isEditing = isUser && this.editingMessageId === msg.id;
    const stamp = formatClockTime(msg.createdAt);

    if (isUser) {
      const bodyHtml = isEditing
        ? `
          <div class="inline-edit-wrap">
            <textarea class="inline-edit-textarea">${escapeHtml(msg.content)}</textarea>
            <div class="inline-edit-actions">
              <button type="button" class="btn-ghost" data-cancel-edit="${escapeHtml(msg.id)}">Cancel</button>
              <button type="button" class="btn-primary" data-save-edit="${escapeHtml(msg.id)}">Resend</button>
            </div>
          </div>
        `
        : `<div class="msg-content msg-user-text">${escapeHtml(msg.content)}</div>`;

      return `
        <article class="msg-row user" data-message-id="${escapeHtml(msg.id)}">
          <div class="msg-card">
            <div class="msg-header">
              <div class="msg-author-wrap">
                <span class="msg-author">${escapeHtml(settings.userName)}</span>
              </div>
              <span class="msg-time">${escapeHtml(stamp)}</span>
            </div>
            ${bodyHtml}
            ${
              !isEditing
                ? `
              <div class="msg-footer">
                <div class="msg-actions-group">
                  <button type="button" class="msg-action-btn" data-edit-msg="${escapeHtml(msg.id)}" title="Edit and resend">
                    Edit &amp; Resend
                  </button>
                  <button type="button" class="msg-action-btn" data-copy-msg="${escapeHtml(msg.id)}" title="Copy text">
                    Copy
                  </button>
                </div>
              </div>`
                : ''
            }
          </div>
          <div class="msg-avatar user-avatar" aria-hidden="true">${escapeHtml(userInitial)}</div>
        </article>
      `;
    }

    // Assistant message
    const rowClasses = ['msg-row', 'assistant'];
    if (msg.streaming) rowClasses.push('streaming');
    if (msg.isError) rowClasses.push('error');

    const renderedBody = renderMarkdown(msg.content, { streaming: Boolean(msg.streaming) });
    const statsLabel = formatStatsFooter(msg.meta);

    return `
      <article class="${rowClasses.join(' ')}" data-message-id="${escapeHtml(msg.id)}">
        <div class="msg-avatar" aria-hidden="true">
          <svg width="18" height="23"><use href="#icon-brand"></use></svg>
        </div>
        <div class="msg-card">
          <div class="msg-header">
            <div class="msg-author-wrap">
              <span class="msg-author">${escapeHtml(settings.botName)}</span>
              ${msg.model ? `<span class="msg-model-tag">${escapeHtml(msg.model)}</span>` : ''}
            </div>
            <span class="msg-time">${escapeHtml(stamp)}</span>
          </div>
          <div class="msg-content" data-msg-body="${escapeHtml(msg.id)}">${renderedBody}</div>
          <div class="msg-footer">
            <div class="msg-actions-group">
              <button type="button" class="msg-action-btn" data-copy-msg="${escapeHtml(msg.id)}" title="Copy Markdown">
                Copy Markdown
              </button>
              <button type="button" class="msg-action-btn" data-regen-msg="${escapeHtml(msg.id)}" title="Regenerate response">
                Regenerate
              </button>
            </div>
            <span class="msg-stats" data-msg-stats="${escapeHtml(msg.id)}">${escapeHtml(statsLabel)}</span>
          </div>
        </div>
      </article>
    `;
  }

  /**
   * Fast surgical update for an actively streaming assistant message bubble.
   */
  updateStreamingMessageDom(messageId, content, { streaming = true, meta = null, isError = false } = {}) {
    const row = this.messageList.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`);
    if (!row) {
      this.renderMessages();
      return;
    }

    row.classList.toggle('streaming', Boolean(streaming));
    row.classList.toggle('error', Boolean(isError));

    const bodyEl = row.querySelector(`[data-msg-body="${CSS.escape(messageId)}"]`);
    if (bodyEl) {
      bodyEl.innerHTML = renderMarkdown(content, { streaming });
    }

    if (meta) {
      const statsEl = row.querySelector(`[data-msg-stats="${CSS.escape(messageId)}"]`);
      if (statsEl) {
        statsEl.textContent = formatStatsFooter(meta);
      }
    }

    if (!this.userScrolledUp) {
      this.scrollToBottom(false);
    }
  }

  scrollToBottom(smooth = false) {
    if (!this.viewport) return;
    this.viewport.scrollTo({
      top: this.viewport.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  downloadExport(format) {
    const session = this.store.getActiveSession();
    if (!session || session.messages.length === 0) {
      this.showTransientHint('Nothing to export in this chronicle yet.');
      return;
    }

    const safeSlug =
      session.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'chronicle';

    const isMd = format === 'md';
    const content = isMd
      ? this.store.exportSessionMarkdown(session.id)
      : this.store.exportSessionJSON(session.id);

    const blob = new Blob([content], {
      type: isMd ? 'text/markdown;charset=utf-8' : 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeSlug}.${isMd ? 'md' : 'json'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  openDialog({ title, message, inputValue = null, confirmLabel = 'Confirm' }) {
    this.dialogTitle.textContent = title;
    this.dialogMessage.textContent = message;
    this.dialogConfirmBtn.textContent = confirmLabel;

    if (inputValue !== null) {
      this.dialogInput.hidden = false;
      this.dialogInput.value = inputValue;
    } else {
      this.dialogInput.hidden = true;
      this.dialogInput.value = '';
    }

    this.dialogBackdrop.hidden = false;
    setTimeout(() => {
      if (!this.dialogInput.hidden) {
        this.dialogInput.focus();
        this.dialogInput.select();
      } else {
        this.dialogConfirmBtn.focus();
      }
    }, 30);

    return new Promise((resolve) => {
      this.dialogResolver = resolve;
    });
  }

  closeDialog(result) {
    this.dialogBackdrop.hidden = true;
    if (this.dialogResolver) {
      const resolve = this.dialogResolver;
      this.dialogResolver = null;
      resolve(result);
    }
  }
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

function formatClockTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatShortTime(ts) {
  if (!ts) return 'now';
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatStatsFooter(meta) {
  if (!meta) return '';
  const parts = [];
  if (meta.completionTokens) {
    parts.push(`${meta.completionTokens} tok`);
  }
  if (meta.elapsedSec) {
    parts.push(`${Number(meta.elapsedSec).toFixed(2)}s`);
  }
  if (meta.tokensPerSec) {
    parts.push(`${Math.round(meta.tokensPerSec)} tok/s`);
  }
  return parts.join(' • ');
}

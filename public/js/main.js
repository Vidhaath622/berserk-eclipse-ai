/**
 * Main Application Bootstrap
 * Connects 3D Berserk WebGL Scene, LocalStorage Store, Settings Drawer,
 * UI Controller, and Server-Side Groq SSE Endpoints.
 */

import { store } from './state.js';
import { fetchHealth, fetchModels, streamChat } from './api.js';
import { BerserkScene3D } from './scene3d.js';
import { SettingsController } from './settings.js';
import { ChatUI } from './ui.js';

class BerserkChatbotApp {
  constructor() {
    this.activeAbortController = null;
    this.serverDefaultModel = store.getSettings().defaultModel;
    this.keyConfigured = true;

    const canvas = document.getElementById('berserk-canvas');
    this.scene3d = new BerserkScene3D(canvas);
    this.scene3d.setAtmosphere(store.getSettings().atmosphere);

    this.ui = new ChatUI({
      store,
      callbacks: {
        onSendPrompt: (text) => this.handleSendPrompt(text),
        onStopStream: () => this.stopStreaming(),
        onRegenerate: (assistantMsgId) => this.handleRegenerate(assistantMsgId),
        onEditAndResend: (userMsgId, newText) => this.handleEditAndResend(userMsgId, newText),
        onRecheckKey: () => this.refreshServerStatus()
      }
    });

    this.settingsController = new SettingsController({
      store,
      onAtmospherePreview: (level) => this.scene3d.setAtmosphere(level),
      getServerDefaultModel: () => this.serverDefaultModel
    });

    store.subscribe((_store, reason) => {
      this.scene3d.setAtmosphere(store.getSettings().atmosphere);
      if (reason === 'settings') {
        this.ui.syncLayoutAndIdentity();
        this.ui.renderMessages();
      } else if (reason === 'sidebar') {
        this.ui.syncLayoutAndIdentity();
      } else {
        this.ui.syncAll(reason);
      }
    });

    this.refreshServerStatus();
  }

  async refreshServerStatus() {
    const [health, modelResult] = await Promise.all([fetchHealth(), fetchModels()]);

    if (health.defaultModel) {
      this.serverDefaultModel = health.defaultModel;
    }

    this.ui.setModels(modelResult.models);

    const configured = Boolean(health.groqKeyConfigured && modelResult.keyConfigured);
    const rejected = Boolean(health.groqKeyConfigured && !modelResult.keyConfigured);
    this.keyConfigured = configured;

    this.ui.updateKeyStatus({
      configured,
      rejected,
      setupExample: health.setupExample || modelResult.setupExample || '',
      message: rejected ? modelResult.warning : ''
    });

    this.scene3d.setState(configured ? 'idle' : 'error');
  }

  async handleSendPrompt(promptText) {
    const session = store.getActiveSession() || store.createSession();
    store.addMessage(session.id, {
      role: 'user',
      content: promptText
    });
    await this.generateAssistantReply(session.id);
  }

  async handleRegenerate(assistantMsgId) {
    const session = store.getActiveSession();
    if (!session) return;
    store.truncateFromMessage(session.id, assistantMsgId, { inclusive: true });
    await this.generateAssistantReply(session.id);
  }

  async handleEditAndResend(userMsgId, updatedText) {
    const session = store.getActiveSession();
    if (!session) return;
    store.truncateFromMessage(session.id, userMsgId, { inclusive: true });
    store.addMessage(session.id, {
      role: 'user',
      content: updatedText
    });
    await this.generateAssistantReply(session.id);
  }

  stopStreaming() {
    if (this.activeAbortController) {
      this.activeAbortController.abort();
      this.activeAbortController = null;
    }
  }

  async generateAssistantReply(sessionId) {
    const session = store.getSessions().find((s) => s.id === sessionId);
    if (!session) return;

    const settings = store.getSettings();
    const model = store.getEffectiveModel();

    // Collect conversation history excluding trailing empty/error assistant stubs
    const contextMessages = session.messages
      .filter((m) => !m.isError && m.content.trim().length > 0)
      .map((m) => ({
        role: m.role,
        content: m.content
      }));

    const assistantMsg = store.addMessage(sessionId, {
      role: 'assistant',
      content: '',
      model
    });
    if (!assistantMsg) return;

    store.updateMessage(sessionId, assistantMsg.id, { streaming: true }, { persist: false });

    this.activeAbortController = new AbortController();
    this.ui.setStreamingState(true);
    this.scene3d.setState('streaming');

    let accumulated = '';
    let latestUsage = null;

    try {
      await streamChat({
        messages: contextMessages,
        model,
        temperature: settings.temperature,
        maxTokens: settings.maxTokens,
        systemPrompt: settings.systemPrompt,
        signal: this.activeAbortController.signal,
        onToken: (delta) => {
          accumulated += delta;
          store.updateMessage(
            sessionId,
            assistantMsg.id,
            { content: accumulated, streaming: true },
            { persist: false, silent: true }
          );
          this.ui.updateStreamingMessageDom(assistantMsg.id, accumulated, {
            streaming: true
          });
        },
        onMeta: (usage) => {
          latestUsage = usage;
        },
        onDone: ({ elapsedSec, usage }) => {
          const finalUsage = usage || latestUsage;
          const completionTokens = finalUsage?.completionTokens || null;
          const compTime = finalUsage?.completionTime || elapsedSec;
          const meta = {
            elapsedSec,
            completionTokens,
            promptTokens: finalUsage?.promptTokens || null,
            tokensPerSec:
              completionTokens && compTime > 0 ? completionTokens / compTime : null
          };

          store.updateMessage(
            sessionId,
            assistantMsg.id,
            {
              content: accumulated || '*(Empty response returned by model.)*',
              streaming: false,
              meta
            },
            { persist: true, silent: true }
          );

          this.ui.updateStreamingMessageDom(
            assistantMsg.id,
            accumulated || '*(Empty response returned by model.)*',
            { streaming: false, meta }
          );
          this.ui.renderSessionList();
        }
      });

      this.keyConfigured = true;
      this.ui.updateKeyStatus({ configured: true });
      this.scene3d.setState('idle');
    } catch (err) {
      if (err?.name === 'AbortError') {
        const haltedText = accumulated
          ? `${accumulated}\n\n*[Invocation halted by user.]*`
          : '*[Invocation halted.]*';
        store.updateMessage(
          sessionId,
          assistantMsg.id,
          { content: haltedText, streaming: false },
          { persist: true, silent: true }
        );
        this.ui.updateStreamingMessageDom(assistantMsg.id, haltedText, { streaming: false });
        this.scene3d.setState(this.keyConfigured ? 'idle' : 'error');
      } else {
        const errText = `**Invocation Failed:** ${err.message || 'Unexpected error communicating with Groq.'}`;
        store.updateMessage(
          sessionId,
          assistantMsg.id,
          { content: errText, streaming: false, isError: true },
          { persist: true, silent: true }
        );
        this.ui.updateStreamingMessageDom(assistantMsg.id, errText, {
          streaming: false,
          isError: true
        });

        if (err.keyMissing || err.status === 401) {
          this.keyConfigured = false;
          this.ui.updateKeyStatus({
            configured: false,
            rejected: err.code === 'INVALID_API_KEY',
            setupExample: err.setupExample || '',
            message: err.message
          });
          this.scene3d.setState('error');
        } else {
          this.ui.showTransientHint(err.message || 'Request failed.');
          this.scene3d.setState('error');
          setTimeout(() => {
            if (!this.ui.isStreaming && this.keyConfigured) {
              this.scene3d.setState('idle');
            }
          }, 3200);
        }
      }
    } finally {
      this.activeAbortController = null;
      this.ui.setStreamingState(false);
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new BerserkChatbotApp();
});

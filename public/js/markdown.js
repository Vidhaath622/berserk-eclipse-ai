/**
 * Safe Markdown + Syntax Highlighting Renderer
 * Uses local /vendor/marked and /vendor/hljs ES modules with strict HTML escaping
 * so untrusted HTML is never executed, and adds one-click Copy buttons to code blocks.
 */

import { Marked } from '/vendor/marked/marked.esm.js';
import hljs from '/vendor/hljs/es/highlight.min.js';

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeUrl(href) {
  if (!href || typeof href !== 'string') return '#';
  const trimmed = href.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('#') ||
    trimmed.startsWith('/')
  ) {
    return escapeHtml(trimmed);
  }
  return '#';
}

const COPY_ICON_SVG = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;

const markedInstance = new Marked({
  gfm: true,
  breaks: true
});

markedInstance.use({
  renderer: {
    // Escape raw HTML blocks/inline HTML so LLM output cannot inject scripts or unsafe DOM
    html(token) {
      const raw = typeof token === 'string' ? token : token?.text || '';
      return escapeHtml(raw);
    },

    link(token) {
      const safeHref = sanitizeUrl(token?.href || '');
      const titleAttr = token?.title ? ` title="${escapeHtml(token.title)}"` : '';
      const label = this.parser ? this.parser.parseInline(token.tokens || []) : escapeHtml(token?.text || safeHref);
      return `<a href="${safeHref}"${titleAttr} target="_blank" rel="noopener noreferrer">${label}</a>`;
    },

    code(token) {
      const rawCode = typeof token === 'string' ? token : token?.text || '';
      const rawLang = (typeof token === 'object' ? token?.lang : '') || '';
      const cleanLang = rawLang.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9_+#-]/g, '');

      let highlighted = '';
      let displayLang = cleanLang || 'code';

      try {
        if (cleanLang && hljs.getLanguage(cleanLang)) {
          highlighted = hljs.highlight(rawCode, {
            language: cleanLang,
            ignoreIllegals: true
          }).value;
        } else if (rawCode.length < 24000) {
          const auto = hljs.highlightAuto(rawCode);
          highlighted = auto.value;
          if (!cleanLang && auto.language) {
            displayLang = auto.language;
          }
        } else {
          highlighted = escapeHtml(rawCode);
        }
      } catch {
        highlighted = escapeHtml(rawCode);
      }

      return `
        <div class="code-block-shell">
          <div class="code-block-header">
            <span class="code-lang-badge">${escapeHtml(displayLang)}</span>
            <button type="button" class="copy-code-btn" data-copy-code="true" aria-label="Copy code block">
              ${COPY_ICON_SVG}
              <span class="copy-code-label">Copy</span>
            </button>
          </div>
          <pre class="code-pre"><code class="hljs language-${escapeHtml(displayLang)}">${highlighted}</code></pre>
        </div>
      `;
    }
  }
});

/**
 * Renders Markdown safely into HTML, optionally appending a streaming bone-white caret.
 */
export function renderMarkdown(markdownText, { streaming = false } = {}) {
  const source = String(markdownText ?? '');
  if (!source.trim() && streaming) {
    return `<p class="streaming-placeholder"><span class="stream-caret" aria-hidden="true"></span></p>`;
  }

  let html = '';
  try {
    html = markedInstance.parse(source);
  } catch {
    html = `<p>${escapeHtml(source)}</p>`;
  }

  if (streaming) {
    html += `<span class="stream-caret" aria-hidden="true"></span>`;
  }

  return html;
}

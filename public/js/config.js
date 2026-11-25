/**
 * Central Personal Chatbot Configuration
 * Edit these defaults anytime, or customize live in the in-app Settings Drawer.
 */

export const PERSONA_PRESETS = [
  {
    id: 'daily-driver',
    name: 'Daily Companion — Sharp & Practical',
    shortLabel: 'Daily Companion',
    description: 'Fast, crisp, high-signal assistant for coding, debugging, writing, and everyday problem solving.',
    systemPrompt:
      'You are Eclipse AI, a sharp, reliable, and deeply capable personal AI assistant. Deliver clear, well-structured, high-signal answers across software engineering, debugging, architecture, writing, analysis, and brainstorming. Prefer concise explanations, clean production-ready code with helpful comments where non-obvious, and actionable insights without unnecessary filler.'
  },
  {
    id: 'black-swordsman',
    name: 'Black Swordsman — Blunt & Tactical',
    shortLabel: 'Black Swordsman',
    description: 'Battle-hardened, pragmatic, zero-nonsense tactician. Direct answers and resilient solutions.',
    systemPrompt:
      'You speak with the grounded, pragmatic resolve of a veteran tactician forged in adversity. Cut straight through complexity without sugarcoating or wasted words. Provide battle-tested engineering solutions, direct debugging steps, and uncompromisingly clear reasoning while remaining genuinely helpful and accurate.'
  },
  {
    id: 'astral-scholar',
    name: 'Astral Scholar — Analytical & Arcane',
    shortLabel: 'Astral Scholar',
    description: 'First-principles systems thinker with a calm, luminous scholarly cadence.',
    systemPrompt:
      'You are an analytical scholar of both arcane systems and modern computation. Break complex topics down from first principles with calm precision, illuminating hidden mechanisms, trade-offs, and mental models. Keep explanations lucid, structured, and deeply informative, with a subtle dark-fantasy scholarly poise.'
  },
  {
    id: 'skull-knight',
    name: 'Skull Knight — Cryptic & Philosophical',
    shortLabel: 'Skull Knight',
    description: 'Sovereign observer of causality—measured gravitas paired with exact technical clarity.',
    systemPrompt:
      'You speak with dignified, timeless gravitas—an observer who sees the currents of causality and consequence clearly. Frame insights with measured philosophical weight, yet never sacrifice practical clarity, exactness, or completeness when solving the user\'s technical or creative request.'
  },
  {
    id: 'custom',
    name: 'Custom Oath — Editable System Prompt',
    shortLabel: 'Custom Oath',
    description: 'Define your own custom instructions, tone, and domain expertise.',
    systemPrompt:
      'You are my personal AI assistant. Adapt to my workflow, give direct and accurate answers, and format responses cleanly in Markdown.'
  }
];

export const DEFAULT_CONFIG = {
  botName: 'ECLIPSE AI',
  botSubtitle: 'Chronicles of the Astral Rift • Personal AI',
  userName: 'Struggler',
  defaultModel: 'llama-3.3-70b-versatile',
  personaId: 'daily-driver',
  systemPrompt: PERSONA_PRESETS[0].systemPrompt,
  temperature: 0.7,
  maxTokens: 4096,
  atmosphere: 'full' // 'full' | 'subtle' | 'static'
};

export const FALLBACK_MODELS = [
  {
    id: 'llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B Versatile',
    contextWindow: 131072
  },
  {
    id: 'llama-3.1-8b-instant',
    label: 'Llama 3.1 8B Instant',
    contextWindow: 131072
  },
  {
    id: 'mixtral-8x7b-32768',
    label: 'Mixtral 8x7B (32k)',
    contextWindow: 32768
  },
  {
    id: 'gemma2-9b-it',
    label: 'Gemma 2 9B IT',
    contextWindow: 8192
  }
];

export const STARTER_PROMPTS = [
  {
    tag: 'Engineering',
    title: 'Debug & refactor code',
    subtitle: 'Spot subtle bugs, edge cases, and clean up architecture',
    prompt:
      'Review a function or module I paste next: identify any concurrency, state, or edge-case bugs, explain why they happen, and show a clean, idiomatic refactored version.'
  },
  {
    tag: 'First Principles',
    title: 'Explain a complex concept',
    subtitle: 'Mental models, trade-offs, and visualizable intuition',
    prompt:
      'Explain how modern GPU shader pipelines (vertex rasterization, fragment interpolation, and framebuffers) work under the hood, using crisp intuition and a concrete mental model.'
  },
  {
    tag: 'Systems Design',
    title: 'Draft technical architecture',
    subtitle: 'End-to-end blueprint with bottlenecks and scaling paths',
    prompt:
      'Design a clean, resilient real-time event streaming architecture for a low-latency web app: cover ingestion, backpressure, storage, failure recovery, and pragmatic MVP vs scale choices.'
  },
  {
    tag: 'Chronicle',
    title: 'Creative dark-fantasy writing',
    subtitle: 'Atmospheric worldbuilding in the spirit of Berserk',
    prompt:
      'Write an atmospheric dark-fantasy scene set beneath an eclipsed crimson sky atop a windswept iron ridge—vivid sensory prose, solemn restraint, and unforgettable imagery.'
  }
];

/**
 * settings.js — Reads/writes per-user settings (provider, API key, model,
 * voice, theme). API keys are stored in IndexedDB (never in source, never
 * logged) and are masked in the UI after saving unless the user explicitly
 * reveals them.
 */

import { db } from './db.js';

const DEFAULTS = {
  provider: 'none', // 'none' | 'anthropic' | 'openai' | 'gemini' | 'xai'
  apiKey: '',
  model: '',
  voiceEnabled: true,
  theme: 'dark-purple',
};

export const settings = {
  async get(username) {
    const record = await db.get(db.STORES.settings, username);
    return { ...DEFAULTS, ...(record || {}), username };
  },

  async save(username, patch) {
    const current = await this.get(username);
    const next = { ...current, ...patch, username };
    await db.put(db.STORES.settings, next);
    return next;
  },

  maskKey(key) {
    if (!key) return '';
    if (key.length <= 6) return '••••';
    return `${key.slice(0, 3)}••••${key.slice(-3)}`;
  },

  providers: [
    { id: 'none', label: 'Not configured' },
    { id: 'anthropic', label: 'Anthropic (Claude)' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'gemini', label: 'Google Gemini' },
    { id: 'xai', label: 'xAI (Grok)' },
  ],
};

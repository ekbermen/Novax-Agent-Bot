/**
 * tools.js — Tool implementations.
 *
 * Every tool returns a consistent shape:
 *   { status: 'success' | 'failure' | 'unavailable', message: string, data?: any }
 *
 * Tools never invent success. If something can't actually run in this
 * environment (e.g. a native action with no bridge), they return
 * 'unavailable' with a clear explanation.
 */

import { bridge } from '../bridge.js';

function sanitizeQuery(q) {
  return String(q || '').trim().slice(0, 300);
}

function isSafeUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

export const tools = {
  /** Opens a web search in a new tab/window. Always available in a browser context. */
  webSearch: {
    name: 'web_search',
    description: 'Search the web for a query.',
    async run({ query }) {
      const q = sanitizeQuery(query);
      if (!q) return { status: 'failure', message: 'No search query provided.' };
      const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
        return { status: 'success', message: `Opened a web search for "${q}".`, data: { url } };
      } catch (err) {
        return { status: 'failure', message: 'Could not open the search tab.' };
      }
    },
  },

  /** Opens a specific URL, e.g. a YouTube search. Validates the URL before navigating. */
  openUrl: {
    name: 'open_url',
    description: 'Open a specific, sanitized URL.',
    async run({ url }) {
      if (!isSafeUrl(url)) {
        return { status: 'failure', message: 'Refused to open an invalid or unsafe URL.' };
      }
      try {
        window.open(url, '_blank', 'noopener,noreferrer');
        return { status: 'success', message: `Opened ${url}`, data: { url } };
      } catch (err) {
        return { status: 'failure', message: 'Could not open the URL.' };
      }
    },
  },

  /** Reads a local file the user explicitly picks (no silent filesystem access). */
  fileOperation: {
    name: 'file_operation',
    description: 'Read a file the user selects via the browser file picker.',
    async run() {
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = () => {
          const file = input.files && input.files[0];
          if (!file) {
            resolve({ status: 'failure', message: 'No file selected.' });
            return;
          }
          resolve({
            status: 'success',
            message: `Selected file "${file.name}" (${Math.round(file.size / 1024)} KB).`,
            data: { name: file.name, size: file.size, type: file.type },
          });
        };
        input.click();
      });
    },
  },

  /** Application/device actions and other native-only actions go through the bridge. */
  applicationAction: {
    name: 'application_action',
    description: 'Perform an application/device level action via the native bridge.',
    async run({ action, args = [] }) {
      if (!bridge.isAvailable()) {
        return { status: 'unavailable', message: 'Native Android bridge unavailable.' };
      }
      if (typeof bridge[action] !== 'function') {
        return { status: 'unavailable', message: `Unsupported native action: "${action}".` };
      }
      const result = await bridge[action](...args);
      if (result.status === 'success') {
        return { status: 'success', message: `Executed native action "${action}".`, data: result.result };
      }
      return { status: result.status, message: result.message || `Native action "${action}" failed.` };
    },
  },

  /** Local, in-app notification (Notification API). Distinct from native bridge notifications. */
  notification: {
    name: 'notification',
    description: 'Show a local browser notification.',
    async run({ title, body }) {
      if (!('Notification' in window)) {
        return { status: 'unavailable', message: 'Notifications are not supported in this browser.' };
      }
      if (Notification.permission !== 'granted') {
        return { status: 'unavailable', message: 'Notification permission has not been granted.' };
      }
      try {
        new Notification(title || 'NovaX', { body: body || '' });
        return { status: 'success', message: 'Notification shown.' };
      } catch (err) {
        return { status: 'failure', message: 'Could not display the notification.' };
      }
    },
  },

  /** Basic, real system/browser information — no fabricated device data. */
  systemInfo: {
    name: 'system_info',
    description: 'Report real browser/system information.',
    async run() {
      const info = {
        userAgent: navigator.userAgent,
        platform: navigator.platform || 'unknown',
        language: navigator.language,
        online: navigator.onLine,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
      };
      return { status: 'success', message: 'Gathered system information.', data: info };
    },
  },
};

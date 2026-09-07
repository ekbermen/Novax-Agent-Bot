/**
 * planner.js — Intent understanding.
 *
 * Turns raw text into a plan: { type, tool, params, requiresConfirmation }.
 * This is intentionally a transparent, rule-based planner (not a black box)
 * so behavior is predictable and auditable. It can be swapped later for an
 * LLM-backed planner without changing the executor/tool contract.
 */

const DESTRUCTIVE_KEYWORDS = ['delete', 'remove', 'wipe', 'format', 'erase', 'uninstall'];

function normalize(text) {
  return String(text || '').trim().toLowerCase();
}

export const planner = {
  plan(rawText) {
    const text = normalize(rawText);

    if (!text) {
      return { type: 'unsupported_action', reason: 'Empty input.' };
    }

    // Web search: "search youtube for X", "search for X", "google X"
    const searchMatch = text.match(/^(?:nova,?\s*)?search\s+(?:on\s+)?(\w+\s+)?for\s+(.+)$/i)
      || text.match(/^(?:nova,?\s*)?google\s+(.+)$/i);
    if (searchMatch) {
      const site = searchMatch[1] ? searchMatch[1].trim() : null;
      const query = searchMatch[2] || searchMatch[1];
      const fullQuery = site && site.length > 0 && searchMatch.length > 2 ? `${site} ${query}` : query;
      return {
        type: 'web_search',
        tool: 'webSearch',
        params: { query: site ? `site:${site} ${searchMatch[2] || query}` : query },
        requiresConfirmation: false,
      };
    }

    // Direct URL request
    const urlMatch = text.match(/https?:\/\/\S+/);
    if (urlMatch) {
      return {
        type: 'url_request',
        tool: 'openUrl',
        params: { url: urlMatch[0] },
        requiresConfirmation: false,
      };
    }

    // Open a well-known site by name, e.g. "open youtube", "open settings"
    const openMatch = text.match(/^(?:nova,?\s*)?open\s+(.+)$/i);
    if (openMatch) {
      const target = openMatch[1].trim();
      const knownSites = {
        youtube: 'https://www.youtube.com',
        gmail: 'https://mail.google.com',
        maps: 'https://maps.google.com',
        google: 'https://www.google.com',
      };
      if (knownSites[target]) {
        return {
          type: 'url_request',
          tool: 'openUrl',
          params: { url: knownSites[target] },
          requiresConfirmation: false,
        };
      }
      // Anything else that isn't a known website is treated as a device/app action.
      return {
        type: 'device_action',
        tool: 'applicationAction',
        params: { action: 'openApp', args: [target] },
        requiresConfirmation: false,
      };
    }

    // File operations
    if (/\b(file|photo|upload|attach)\b/.test(text) && /\b(open|pick|select|choose|send)\b/.test(text)) {
      return {
        type: 'file_operation',
        tool: 'fileOperation',
        params: {},
        requiresConfirmation: false,
      };
    }

    // Native/system actions: camera, screen share, notifications, device info
    if (/\b(take a photo|camera)\b/.test(text)) {
      return { type: 'device_action', tool: 'applicationAction', params: { action: 'takePhoto', args: [] }, requiresConfirmation: false };
    }
    if (/\b(share (my )?screen|screen share)\b/.test(text)) {
      return { type: 'device_action', tool: 'applicationAction', params: { action: 'shareScreen', args: [] }, requiresConfirmation: false };
    }
    if (/\b(device info|system info|about this device)\b/.test(text)) {
      return { type: 'device_action', tool: 'systemInfo', params: {}, requiresConfirmation: false };
    }
    if (/\bnotify|notification\b/.test(text)) {
      return {
        type: 'device_action',
        tool: 'notification',
        params: { title: 'NovaX', body: rawText },
        requiresConfirmation: false,
      };
    }

    // Destructive-sounding action -> require explicit confirmation before executing.
    if (DESTRUCTIVE_KEYWORDS.some((kw) => text.includes(kw))) {
      return {
        type: 'device_action',
        tool: 'applicationAction',
        params: { action: 'closeApp', args: [text] },
        requiresConfirmation: true,
        reason: `This looks like a destructive action ("${text}"). Confirm before I proceed.`,
      };
    }

    // Fallback: normal conversation, no tool execution.
    return { type: 'conversation', tool: null, params: { text: rawText }, requiresConfirmation: false };
  },
};

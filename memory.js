/**
 * memory.js — Conversation memory for the current user.
 *
 * Short-term: kept in a module-level array for instant UI rerenders.
 * Persisted: flushed to IndexedDB so a reload within the same session
 * (or a later sign-in) restores history. This is session/user memory,
 * not long-term semantic memory — that's listed as a future extension.
 */

import { db } from '../db.js';

let cache = { username: null, messages: [] };

export const memory = {
  async load(username) {
    const record = await db.get(db.STORES.conversations, username);
    cache = { username, messages: (record && record.messages) || [] };
    return cache.messages;
  },

  getAll() {
    return cache.messages;
  },

  async append(message) {
    cache.messages.push({ ...message, timestamp: Date.now() });
    if (cache.username) {
      await db.put(db.STORES.conversations, { username: cache.username, messages: cache.messages });
    }
    return cache.messages;
  },

  async clear() {
    cache.messages = [];
    if (cache.username) {
      await db.put(db.STORES.conversations, { username: cache.username, messages: [] });
    }
  },
};

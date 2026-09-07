/**
 * auth.js — Sign up / sign in / sign out.
 *
 * Passwords are never stored in plain text. We hash with SubtleCrypto
 * (SHA-256 + a random per-user salt) before writing to IndexedDB. This is a
 * client-only demo auth system — good enough to gate the local experience,
 * but it is NOT a substitute for a real backend auth service. Swap this
 * module out wholesale once a real API exists; nothing else in the app
 * should need to change beyond the calls in app.js.
 */

import { db } from './db.js';

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hashPassword(password, saltHex) {
  const enc = new TextEncoder();
  const data = enc.encode(saltHex + ':' + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bufToHex(digest);
}

function randomSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return bufToHex(arr.buffer);
}

function validateUsername(username) {
  if (!username || typeof username !== 'string') return 'Username is required.';
  const trimmed = username.trim();
  if (trimmed.length < 3) return 'Username must be at least 3 characters.';
  if (trimmed.length > 24) return 'Username must be 24 characters or fewer.';
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) return 'Username can only contain letters, numbers, and underscores.';
  return null;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') return 'Password is required.';
  if (password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

export const auth = {
  async signUp(usernameRaw, password) {
    const username = (usernameRaw || '').trim();
    const usernameError = validateUsername(username);
    if (usernameError) return { success: false, error: usernameError };
    const passwordError = validatePassword(password);
    if (passwordError) return { success: false, error: passwordError };

    const existing = await db.get(db.STORES.users, username);
    if (existing) return { success: false, error: 'That username is already taken.' };

    const salt = randomSalt();
    const passwordHash = await hashPassword(password, salt);

    await db.put(db.STORES.users, {
      username,
      salt,
      passwordHash,
      createdAt: Date.now(),
    });
    await db.put(db.STORES.conversations, { username, messages: [] });
    await db.put(db.STORES.settings, {
      username,
      provider: 'none',
      apiKey: '',
      model: '',
      voiceEnabled: true,
      theme: 'dark-purple',
    });

    return this.signIn(username, password);
  },

  async signIn(usernameRaw, password) {
    const username = (usernameRaw || '').trim();
    if (!username || !password) {
      return { success: false, error: 'Username and password are required.' };
    }

    const user = await db.get(db.STORES.users, username);
    if (!user) return { success: false, error: 'Invalid username or password.' };

    const hash = await hashPassword(password, user.salt);
    if (hash !== user.passwordHash) {
      return { success: false, error: 'Invalid username or password.' };
    }

    await db.put(db.STORES.sessions, { id: 'current', username, loginAt: Date.now() });
    return { success: true, username };
  },

  async signOut() {
    await db.delete(db.STORES.sessions, 'current');
    return { success: true };
  },

  async getCurrentSession() {
    const session = await db.get(db.STORES.sessions, 'current');
    if (!session) return null;
    const user = await db.get(db.STORES.users, session.username);
    if (!user) return null; // stale session, user was removed
    return session;
  },
};

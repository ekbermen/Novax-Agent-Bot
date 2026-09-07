/**
 * permissions.js — Permission Center.
 *
 * States: 'available' | 'denied' | 'unavailable' | 'not_connected'
 * These are derived from real browser APIs (Permissions API, feature
 * detection) and the native bridge — never hard-coded as granted.
 */

import { bridge } from '../bridge.js';

async function checkMicrophone() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return 'unavailable';
  }
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' });
      if (status.state === 'granted') return 'available';
      if (status.state === 'denied') return 'denied';
      return 'not_connected'; // 'prompt'
    } catch {
      // Some browsers (Firefox) don't support querying 'microphone'.
      return 'not_connected';
    }
  }
  return 'not_connected';
}

async function checkNotifications() {
  if (!('Notification' in window)) return 'unavailable';
  if (Notification.permission === 'granted') return 'available';
  if (Notification.permission === 'denied') return 'denied';
  return 'not_connected';
}

async function checkCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return 'unavailable';
  }
  if (navigator.permissions && navigator.permissions.query) {
    try {
      const status = await navigator.permissions.query({ name: 'camera' });
      if (status.state === 'granted') return 'available';
      if (status.state === 'denied') return 'denied';
      return 'not_connected';
    } catch {
      return 'not_connected';
    }
  }
  return 'not_connected';
}

async function checkFiles() {
  // File input / File System Access — always at least available via <input type="file">.
  return 'available';
}

async function checkNativeBridge() {
  return bridge.isAvailable() ? 'available' : 'unavailable';
}

export const permissions = {
  async checkAll() {
    const [microphone, notifications, camera, files, nativeBridge] = await Promise.all([
      checkMicrophone(),
      checkNotifications(),
      checkCamera(),
      checkFiles(),
      checkNativeBridge(),
    ]);
    return { microphone, notifications, camera, files, nativeBridge };
  },

  async requestMicrophone() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return 'available';
    } catch (err) {
      if (err && err.name === 'NotAllowedError') return 'denied';
      return 'unavailable';
    }
  },

  async requestNotifications() {
    if (!('Notification' in window)) return 'unavailable';
    const result = await Notification.requestPermission();
    return result === 'granted' ? 'available' : result === 'denied' ? 'denied' : 'not_connected';
  },
};

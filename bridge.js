/**
 * bridge.js — Interface to the native Android layer.
 *
 * When NovaX is wrapped by the Android app (see /android), the WebView
 * injects a JavaScript interface at window.NovaXBridge (see
 * NovaXBridge.kt). In a plain browser tab, that object does not exist.
 *
 * This module NEVER simulates a successful native call. If the bridge or a
 * specific method is missing, every call resolves with
 * { status: 'unavailable' } and a clear message — the agent and UI report
 * that honestly instead of pretending the action happened.
 */

const BRIDGE_METHODS = [
  'openApp',
  'closeApp',
  'takePhoto',
  'shareScreen',
  'sendFile',
  'showNotification',
  'getDeviceInfo',
];

function isBridgeAvailable() {
  return typeof window !== 'undefined' && !!window.NovaXBridge;
}

function methodAvailable(name) {
  return isBridgeAvailable() && typeof window.NovaXBridge[name] === 'function';
}

async function callBridge(name, ...args) {
  if (!isBridgeAvailable()) {
    return {
      status: 'unavailable',
      message: 'Native Android bridge unavailable.',
    };
  }
  if (!methodAvailable(name)) {
    return {
      status: 'unavailable',
      message: `Native Android bridge does not implement "${name}".`,
    };
  }
  try {
    const raw = window.NovaXBridge[name](...args);
    // Native side may return a JSON string (typical for Android JS interfaces).
    const result = typeof raw === 'string' ? safeParse(raw) : raw;
    return { status: 'success', result };
  } catch (err) {
    return { status: 'failure', message: err && err.message ? err.message : 'Native bridge call failed.' };
  }
}

function safeParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}

export const bridge = {
  isAvailable: isBridgeAvailable,
  methodAvailable,
  methods: BRIDGE_METHODS,
  openApp: (packageName) => callBridge('openApp', packageName),
  closeApp: (packageName) => callBridge('closeApp', packageName),
  takePhoto: () => callBridge('takePhoto'),
  shareScreen: () => callBridge('shareScreen'),
  sendFile: (path) => callBridge('sendFile', path),
  showNotification: (title, body) => callBridge('showNotification', title, body),
  getDeviceInfo: () => callBridge('getDeviceInfo'),
};

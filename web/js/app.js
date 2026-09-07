import { auth } from './auth.js';
import { memory } from './agent/memory.js';
import { planner } from './agent/planner.js';
import { executor } from './agent/executor.js';
import { permissions } from './agent/permissions.js';
import { voice } from './voice.js';
import { settings as settingsStore } from './settings.js';
import { commands, isCommand, parseCommand } from './commands.js';
import { bridge } from './bridge.js';

/* ---------------------------------------------------------------------- */
/* Element refs                                                            */
/* ---------------------------------------------------------------------- */

const el = {
  authScreen: document.getElementById('auth-screen'),
  authForm: document.getElementById('auth-form'),
  authUsername: document.getElementById('auth-username'),
  authPassword: document.getElementById('auth-password'),
  authError: document.getElementById('auth-error'),
  authSubmit: document.getElementById('auth-submit'),
  tabSignin: document.getElementById('tab-signin'),
  tabSignup: document.getElementById('tab-signup'),

  appShell: document.getElementById('app-shell'),
  conversation: document.getElementById('conversation'),
  activityPanel: document.getElementById('activity-panel'),
  activityText: document.getElementById('activity-text'),
  statusDot: document.getElementById('agent-status-dot'),
  statusLabel: document.getElementById('agent-status-label'),

  micBtn: document.getElementById('btn-mic'),
  textInput: document.getElementById('text-input'),
  sendBtn: document.getElementById('btn-send'),
  settingsBtn: document.getElementById('btn-settings'),

  settingsScreen: document.getElementById('settings-screen'),
  backFromSettings: document.getElementById('btn-back-from-settings'),
  settingsProvider: document.getElementById('settings-provider'),
  settingsModel: document.getElementById('settings-model'),
  settingsApiKey: document.getElementById('settings-apikey'),
  toggleKeyBtn: document.getElementById('btn-toggle-key'),
  settingsVoiceEnabled: document.getElementById('settings-voice-enabled'),
  voiceSupportNote: document.getElementById('voice-support-note'),
  settingsTheme: document.getElementById('settings-theme'),
  permissionList: document.getElementById('permission-list'),
  refreshPermissionsBtn: document.getElementById('btn-refresh-permissions'),
  saveSettingsBtn: document.getElementById('btn-save-settings'),
  signOutBtn: document.getElementById('btn-signout'),

  confirmOverlay: document.getElementById('confirm-dialog'),
  confirmMessage: document.getElementById('confirm-message'),
  confirmOk: document.getElementById('confirm-ok'),
  confirmCancel: document.getElementById('confirm-cancel'),
};

let authMode = 'signin';
let currentUsername = null;
let activeListen = null;

/* ---------------------------------------------------------------------- */
/* Utility: agent status + activity                                       */
/* ---------------------------------------------------------------------- */

const STATUS_LABELS = {
  ready: 'Ready',
  listening: 'Listening',
  thinking: 'Thinking',
  executing: 'Executing',
  speaking: 'Speaking',
  error: 'Error',
};

function setStatus(state) {
  el.statusDot.dataset.state = state;
  el.statusLabel.textContent = STATUS_LABELS[state] || state;
}

function showActivity(text) {
  el.activityPanel.hidden = false;
  el.activityText.textContent = text;
}

function hideActivity() {
  el.activityPanel.hidden = true;
}

/* ---------------------------------------------------------------------- */
/* Conversation rendering                                                  */
/* ---------------------------------------------------------------------- */

function renderConversation() {
  const messages = memory.getAll();
  el.conversation.innerHTML = '';

  if (messages.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'conversation-empty';
    empty.textContent = 'Say "Nova, search YouTube for..." or type a message to get started.';
    el.conversation.appendChild(empty);
    return;
  }

  for (const msg of messages) {
    const bubble = document.createElement('div');
    bubble.className = `msg msg--${msg.role}`;
    bubble.textContent = msg.text;
    el.conversation.appendChild(bubble);
  }
  el.conversation.scrollTop = el.conversation.scrollHeight;
}

async function addMessage(role, text) {
  await memory.append({ role, text });
  renderConversation();
}

/* ---------------------------------------------------------------------- */
/* Confirmation dialog (for destructive actions)                          */
/* ---------------------------------------------------------------------- */

function confirmAction(message) {
  return new Promise((resolve) => {
    el.confirmMessage.textContent = message;
    el.confirmOverlay.hidden = false;

    const cleanup = (result) => {
      el.confirmOverlay.hidden = true;
      el.confirmOk.removeEventListener('click', onOk);
      el.confirmCancel.removeEventListener('click', onCancel);
      resolve(result);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);

    el.confirmOk.addEventListener('click', onOk);
    el.confirmCancel.addEventListener('click', onCancel);
  });
}

/* ---------------------------------------------------------------------- */
/* Core agent pipeline: text -> plan -> execute -> report -> (speak)      */
/* ---------------------------------------------------------------------- */

async function handleUserInput(rawText) {
  const text = rawText.trim();
  if (!text) return;

  if (isCommand(text)) {
    await handleCommand(text);
    return;
  }

  await addMessage('user', text);
  setStatus('thinking');
  showActivity('Thinking…');

  const plan = planner.plan(text);

  if (plan.requiresConfirmation) {
    const confirmed = await confirmAction(plan.reason || 'Confirm this action?');
    if (!confirmed) {
      await addMessage('system', 'Action cancelled.');
      setStatus('ready');
      hideActivity();
      return;
    }
  }

  setStatus('executing');
  const result = await executor.execute(plan, (activity) => showActivity(activity));

  if (plan.type === 'conversation') {
    const reply = "I heard you, but I don't have an AI provider configured yet. Add one in Settings, or try a command like \"search YouTube for...\" or \"open youtube\".";
    await addMessage('agent', reply);
    await maybeSpeak(reply);
  } else {
    const reportLine = formatResult(plan, result);
    await addMessage(result.status === 'success' ? 'agent' : 'error', reportLine);
    await maybeSpeak(reportLine);
  }

  hideActivity();
  setStatus('ready');
}

function formatResult(plan, result) {
  if (result.status === 'success') return result.message || 'Done.';
  if (result.status === 'unavailable') return `Unavailable: ${result.message}`;
  return `Failed: ${result.message || 'Unknown error.'}`;
}

async function maybeSpeak(text) {
  const s = await settingsStore.get(currentUsername);
  if (!s.voiceEnabled || !voice.ttsSupported) return;
  setStatus('speaking');
  await new Promise((resolve) => {
    voice.speak(text, { onEnd: resolve, onError: resolve });
  });
  setStatus('ready');
}

/* ---------------------------------------------------------------------- */
/* Slash commands                                                          */
/* ---------------------------------------------------------------------- */

let lastDebugInfo = null;

async function handleCommand(text) {
  const { command, args } = parseCommand(text);

  switch (command) {
    case '/help':
      await addMessage('system', commands.helpText());
      break;
    case '/settings':
      openSettings();
      break;
    case '/clear':
      await memory.clear();
      renderConversation();
      break;
    case '/status': {
      const perms = await permissions.checkAll();
      const lines = [
        `Agent: Ready`,
        `Speech recognition: ${voice.sttSupported ? 'supported' : 'unsupported'}`,
        `Speech synthesis: ${voice.ttsSupported ? 'supported' : 'unsupported'}`,
        `Native bridge: ${bridge.isAvailable() ? 'connected' : 'unavailable'}`,
        `Microphone: ${perms.microphone}`,
      ];
      await addMessage('system', lines.join('\n'));
      break;
    }
    case '/voice':
      startListening();
      break;
    case '/text':
      el.textInput.focus();
      break;
    case '/search':
      if (args) await handleUserInput(`search for ${args}`);
      else await addMessage('system', 'Usage: /search <query>');
      break;
    case '/open':
      if (args) await handleUserInput(`open ${args}`);
      else await addMessage('system', 'Usage: /open <url or app>');
      break;
    case '/file':
      await handleUserInput('pick a file');
      break;
    case '/debug':
      await addMessage('system', lastDebugInfo ? JSON.stringify(lastDebugInfo, null, 2) : 'No plan executed yet this session.');
      break;
    case '/api':
      openSettings();
      el.settingsApiKey.focus();
      break;
    default:
      await addMessage('system', `Unknown command "${command}". Try /help.`);
  }
}

/* ---------------------------------------------------------------------- */
/* Voice input                                                             */
/* ---------------------------------------------------------------------- */

function startListening() {
  if (activeListen) return; // already listening
  if (!voice.sttSupported) {
    addMessage('system', 'Speech recognition is not supported in this browser. Use the text input instead.');
    return;
  }

  el.micBtn.dataset.listening = 'true';
  setStatus('listening');
  showActivity('Listening…');

  activeListen = voice.listen({
    onResult: async (transcript) => {
      activeListen = null;
      el.micBtn.dataset.listening = 'false';
      if (transcript) await handleUserInput(transcript);
      else {
        hideActivity();
        setStatus('ready');
      }
    },
    onEnd: () => {
      el.micBtn.dataset.listening = 'false';
      activeListen = null;
    },
    onError: (message) => {
      el.micBtn.dataset.listening = 'false';
      activeListen = null;
      hideActivity();
      setStatus('error');
      addMessage('error', message);
      setTimeout(() => setStatus('ready'), 1500);
    },
  });
}

function stopListening() {
  if (activeListen) {
    activeListen.stop();
    activeListen = null;
  }
  el.micBtn.dataset.listening = 'false';
}

/* ---------------------------------------------------------------------- */
/* Settings screen                                                         */
/* ---------------------------------------------------------------------- */

function populateProviderOptions() {
  el.settingsProvider.innerHTML = '';
  for (const p of settingsStore.providers) {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.label;
    el.settingsProvider.appendChild(opt);
  }
}

let keyRevealed = false;

async function openSettings() {
  const s = await settingsStore.get(currentUsername);
  el.settingsProvider.value = s.provider;
  el.settingsModel.value = s.model || '';
  el.settingsApiKey.value = s.apiKey ? settingsStore.maskKey(s.apiKey) : '';
  el.settingsApiKey.dataset.raw = s.apiKey || '';
  keyRevealed = false;
  el.settingsApiKey.type = 'password';
  el.toggleKeyBtn.textContent = 'Show';
  el.settingsVoiceEnabled.checked = !!s.voiceEnabled;
  el.settingsTheme.value = s.theme || 'dark-purple';
  el.voiceSupportNote.textContent = voice.ttsSupported
    ? 'Speech synthesis is supported in this browser.'
    : 'Speech synthesis is not supported in this browser — responses will only appear as text.';

  await renderPermissions();

  el.appShell.hidden = true;
  el.settingsScreen.hidden = false;
}

function closeSettings() {
  el.settingsScreen.hidden = true;
  el.appShell.hidden = false;
}

async function renderPermissions() {
  const perms = await permissions.checkAll();
  const rows = [
    { key: 'microphone', label: 'Microphone', state: perms.microphone },
    { key: 'notifications', label: 'Notifications', state: perms.notifications },
    { key: 'camera', label: 'Camera', state: perms.camera },
    { key: 'files', label: 'Files', state: perms.files },
    { key: 'nativeBridge', label: 'Native Android bridge', state: perms.nativeBridge },
  ];

  el.permissionList.innerHTML = '';
  for (const row of rows) {
    const li = document.createElement('li');
    li.className = 'permission-item';
    li.innerHTML = `<span>${row.label}</span><span class="permission-badge" data-state="${row.state}">${row.state.replace('_', ' ')}</span>`;
    el.permissionList.appendChild(li);
  }
}

async function saveSettingsFromForm() {
  const rawKeyInput = el.settingsApiKey.value;
  // If the field still shows the masked value (user didn't touch it), keep the stored raw key.
  const apiKey = rawKeyInput === settingsStore.maskKey(el.settingsApiKey.dataset.raw || '')
    ? (el.settingsApiKey.dataset.raw || '')
    : rawKeyInput;

  await settingsStore.save(currentUsername, {
    provider: el.settingsProvider.value,
    model: el.settingsModel.value.trim(),
    apiKey,
    voiceEnabled: el.settingsVoiceEnabled.checked,
    theme: el.settingsTheme.value,
  });

  document.body.dataset.theme = el.settingsTheme.value;
  await addMessage('system', 'Settings saved.');
  closeSettings();
}

/* ---------------------------------------------------------------------- */
/* Auth flow                                                               */
/* ---------------------------------------------------------------------- */

function setAuthMode(mode) {
  authMode = mode;
  el.tabSignin.classList.toggle('is-active', mode === 'signin');
  el.tabSignup.classList.toggle('is-active', mode === 'signup');
  el.tabSignin.setAttribute('aria-selected', String(mode === 'signin'));
  el.tabSignup.setAttribute('aria-selected', String(mode === 'signup'));
  el.authSubmit.textContent = mode === 'signin' ? 'Sign in' : 'Create account';
  el.authPassword.autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  el.authError.hidden = true;
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  el.authError.hidden = true;
  el.authSubmit.disabled = true;

  const username = el.authUsername.value;
  const password = el.authPassword.value;

  try {
    const result = authMode === 'signin'
      ? await auth.signIn(username, password)
      : await auth.signUp(username, password);

    if (!result.success) {
      el.authError.textContent = result.error;
      el.authError.hidden = false;
      return;
    }

    await enterApp(result.username);
  } catch (err) {
    el.authError.textContent = 'Something went wrong. Please try again.';
    el.authError.hidden = false;
  } finally {
    el.authSubmit.disabled = false;
  }
}

async function enterApp(username) {
  currentUsername = username;
  await memory.load(username);
  renderConversation();

  const s = await settingsStore.get(username);
  document.body.dataset.theme = s.theme || 'dark-purple';

  el.authScreen.hidden = true;
  el.settingsScreen.hidden = true;
  el.appShell.hidden = false;
  setStatus('ready');
}

async function handleSignOut() {
  await auth.signOut();
  currentUsername = null;
  closeSettings();
  el.appShell.hidden = true;
  el.authScreen.hidden = false;
  el.authForm.reset();
  setAuthMode('signin');
}

/* ---------------------------------------------------------------------- */
/* Event wiring                                                            */
/* ---------------------------------------------------------------------- */

el.tabSignin.addEventListener('click', () => setAuthMode('signin'));
el.tabSignup.addEventListener('click', () => setAuthMode('signup'));
el.authForm.addEventListener('submit', handleAuthSubmit);

el.sendBtn.addEventListener('click', () => {
  const text = el.textInput.value;
  el.textInput.value = '';
  handleUserInput(text);
});

el.textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    el.sendBtn.click();
  }
});

el.micBtn.addEventListener('click', () => {
  if (el.micBtn.dataset.listening === 'true') stopListening();
  else startListening();
});

el.settingsBtn.addEventListener('click', openSettings);
el.backFromSettings.addEventListener('click', closeSettings);
el.saveSettingsBtn.addEventListener('click', saveSettingsFromForm);
el.signOutBtn.addEventListener('click', handleSignOut);
el.refreshPermissionsBtn.addEventListener('click', renderPermissions);

el.toggleKeyBtn.addEventListener('click', () => {
  keyRevealed = !keyRevealed;
  el.settingsApiKey.type = keyRevealed ? 'text' : 'password';
  el.settingsApiKey.value = keyRevealed ? (el.settingsApiKey.dataset.raw || '') : settingsStore.maskKey(el.settingsApiKey.dataset.raw || '');
  el.toggleKeyBtn.textContent = keyRevealed ? 'Hide' : 'Show';
});

populateProviderOptions();

/* ---------------------------------------------------------------------- */
/* Boot: resume session if one exists                                     */
/* ---------------------------------------------------------------------- */

(async function boot() {
  try {
    const session = await auth.getCurrentSession();
    if (session) {
      await enterApp(session.username);
    } else {
      setAuthMode('signin');
    }
  } catch (err) {
    // IndexedDB unavailable or failed to open — fall back to the auth screen
    // with a clear message rather than a blank/broken app.
    el.authError.textContent = 'Local storage is unavailable in this browser. Some private/incognito modes block it.';
    el.authError.hidden = false;
  }
})();

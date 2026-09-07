/**
 * commands.js — Slash command parsing.
 *
 * Commands are resolved here and handled by callbacks passed in from app.js
 * so this module has no direct DOM/UI dependency.
 */

const COMMAND_LIST = ['/help', '/settings', '/clear', '/status', '/voice', '/text', '/search', '/open', '/file', '/debug', '/api'];

export function isCommand(text) {
  return typeof text === 'string' && text.trim().startsWith('/');
}

export function parseCommand(text) {
  const trimmed = text.trim();
  const [cmd, ...rest] = trimmed.split(/\s+/);
  return { command: cmd.toLowerCase(), args: rest.join(' ') };
}

export const commands = {
  list: COMMAND_LIST,

  helpText() {
    return [
      '/help — show this list',
      '/settings — open Settings',
      '/clear — clear the conversation',
      '/status — show agent + permission status',
      '/voice — switch to voice mode',
      '/text — switch to text mode',
      '/search <query> — run a web search',
      '/open <url or app> — open a URL or app',
      '/file — pick a local file',
      '/debug — show last plan/tool result',
      '/api — jump to provider/API settings',
    ].join('\n');
  },
};

// Shared by bridge.mjs and tm.mjs: finds or starts the local tampermonkey-mcp daemon and talks to it
// over MCP Streamable HTTP. No dependencies besides Node 18+.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PKG = 'tampermonkey-mcp@0.0.5';
export const PORT = Number(process.env.TAMPERMONKEY_MCP_PORT) || 47801;
export const BASE = `http://127.0.0.1:${PORT}`;
export const LOG = path.join(os.tmpdir(), `tampermonkey-mcp-${PORT}.log`);
export const DAEMON_NAME = 'tampermonkey-mcp-daemon';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 'ours' | 'foreign' | null (nothing listening)
async function probe() {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    const body = await res.json().catch(() => null);
    return body?.name === DAEMON_NAME ? 'ours' : 'foreign';
  } catch {
    return null;
  }
}

let starting = null;

export function ensureDaemon() {
  return (starting ||= (async () => {
    const state = await probe();
    if (state === 'ours') return;
    if (state === 'foreign') throw new Error(`Port ${PORT} is used by another program. Set TAMPERMONKEY_MCP_PORT to a free port.`);
    const out = fs.openSync(LOG, 'a');
    const daemon = path.join(HERE, 'daemon.mjs');
    const win = process.platform === 'win32';
    const child = spawn('npx', ['-y', '-p', PKG, 'node', win ? `"${daemon}"` : daemon], {
      detached: true,
      windowsHide: true,
      shell: win, // npx is npx.cmd there
      stdio: ['ignore', out, out],
      env: { ...process.env, TAMPERMONKEY_MCP_PORT: String(PORT) },
    });
    child.unref();
    fs.closeSync(out);
    for (let i = 0; i < 240; i++) { // the first start may download the package
      await sleep(250);
      if ((await probe()) === 'ours') return;
    }
    throw new Error(`The tampermonkey-mcp daemon did not start; see ${LOG}`);
  })().finally(() => { starting = null; }));
}

// One JSON-RPC message to the daemon. Returns the HTTP status, the session id and the reply messages.
export async function post(message, session) {
  const res = await fetch(`${BASE}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(session ? { 'mcp-session-id': session } : {}),
    },
    body: JSON.stringify(message),
  });
  const text = await res.text();
  const messages = [];
  if ((res.headers.get('content-type') || '').includes('text/event-stream')) {
    for (const event of text.split(/\r?\n\r?\n/)) {
      const data = event.split(/\r?\n/).filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
      if (data) messages.push(JSON.parse(data));
    }
  } else if (text.trim()) {
    try { messages.push(...[].concat(JSON.parse(text))); } catch { /* plain-text error body */ }
  }
  return { status: res.status, session: res.headers.get('mcp-session-id'), messages, text };
}

export async function closeSession(session) {
  if (!session) return;
  await fetch(`${BASE}/mcp`, { method: 'DELETE', headers: { 'mcp-session-id': session } }).catch(() => {});
}

export const initializeMessage = (id, clientName) => ({
  jsonrpc: '2.0',
  id,
  method: 'initialize',
  params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: clientName, version: '1.0.0' } },
});

// Opens a session (starting the daemon if needed) and returns its id.
export async function openSession(initMessage) {
  await ensureDaemon();
  const r = await post(initMessage);
  if (!r.session) throw new Error(`initialize failed (${r.status}): ${r.text.slice(0, 300)}`);
  await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, r.session);
  return r;
}

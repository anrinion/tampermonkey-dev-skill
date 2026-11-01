// stdio MCP server for Claude Code that forwards everything to the shared daemon (see daemon.mjs).
// Starts the daemon when needed, and opens a new session if the daemon was restarted meanwhile.
import readline from 'node:readline';
import { closeSession, ensureDaemon, openSession, post } from './client.mjs';

let init = null; // Claude Code's initialize request, replayed when a new session is needed
let session = null;
let ready = null; // resolves once a session exists
let reopening = null;

const send = (m) => process.stdout.write(JSON.stringify(m) + '\n');
const fail = (msg, err) => {
  if (msg.id !== undefined) send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: String(err?.message || err) } });
};

function reopen() {
  return (reopening ||= openSession({ ...init, id: 'bridge-reinit' })
    .then((r) => { session = r.session; })
    .finally(() => { reopening = null; }));
}

async function forward(msg, retried = false) {
  let r;
  try {
    r = await post(msg, session);
  } catch (e) {
    if (retried) throw e;
    await ensureDaemon(); // daemon gone: start it, then retry with a fresh session
    await reopen();
    return forward(msg, true);
  }
  if ((r.status === 400 || r.status === 404) && !retried) { // session unknown to a restarted daemon
    await reopen();
    return forward(msg, true);
  }
  for (const m of r.messages) send(m);
  if (!r.messages.length && msg.id !== undefined && r.status >= 400) fail(msg, `HTTP ${r.status}: ${r.text.slice(0, 300)}`);
}

async function handle(msg) {
  try {
    if (msg.method === 'initialize') {
      init = msg;
      ready = openSession(msg).then((r) => { session = r.session; for (const m of r.messages) send(m); });
      await ready;
      return;
    }
    if (msg.method === 'notifications/initialized') return; // openSession already sent it
    await ready;
    await forward(msg);
  } catch (e) {
    fail(msg, e);
  }
}

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  handle(msg);
});
rl.on('close', async () => {
  await closeSession(session);
  process.exit(0);
});

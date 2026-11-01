#!/usr/bin/env node
// Command line access to the user's Tampermonkey through the shared daemon (see daemon.mjs).
// Pushing from here sends the file straight from disk: an agent passing a whole script as a tool
// argument has to generate every character of it, which takes minutes for a large script.
//
//   tm.mjs push <file> [<uuid>/source]   write the file into Tampermonkey (default: the script whose
//                                        @name matches the file's @name)
//   tm.mjs pull <uuid>/source|<uuid>/storage|<name> [<out-file>]
//                                        installed source, without the "Last modified" trailer
//   tm.mjs list                          installed scripts (name, path)
//   tm.mjs code                          connection code for Tampermonkey Editors
import fs from 'node:fs';
import { closeSession, initializeMessage, openSession, post } from './client.mjs';

const [cmd, ...args] = process.argv.slice(2);
const die = (msg) => { console.error(msg); process.exit(1); };

let session = null;
let nextId = 1;

async function call(name, params = {}) {
  session ||= (await openSession(initializeMessage(0, 'tm.mjs'))).session;
  const r = await post({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: params } }, session);
  const reply = r.messages.find((m) => m.id !== undefined);
  if (!reply) die(`No reply from the daemon (HTTP ${r.status}): ${r.text.slice(0, 300)}`);
  if (reply.error) die(reply.error.message);
  const text = (reply.result?.content || []).map((c) => c.text || '').join('\n');
  if (reply.result?.isError || /^Not connected/.test(text)) die(text + '\nRun `tm.mjs code` and enter the code in Tampermonkey Editors.');
  return text;
}

async function scripts() {
  const text = await call('tampermonkey_list');
  let data;
  try { data = JSON.parse(text); } catch { die(text); }
  return data.list || [].concat(data); // { messageId, list: [...] } in 0.0.5
}

const headerName = (src) => src.match(/^\/\/\s*@name\s+(.+?)\s*$/m)?.[1];

async function resolvePath(nameOrPath) {
  if (/\/(source|storage)$/.test(nameOrPath)) return nameOrPath;
  const matches = (await scripts()).filter((s) => s.name === nameOrPath);
  if (matches.length !== 1) die(matches.length ? `Several scripts are named "${nameOrPath}": ${matches.map((s) => s.path).join(', ')}` : `No installed script named "${nameOrPath}"`);
  return matches[0].path.replace(/\/source$/, '') + '/source';
}

try {
  if (cmd === 'push') {
    const [file, target] = args;
    if (!file) die('usage: tm.mjs push <file> [<uuid>/source]');
    const src = fs.readFileSync(file, 'utf8');
    const name = headerName(src);
    const scriptPath = await resolvePath(target || name || die('The file has no @name; pass the script path'));
    const text = await call('tampermonkey_patch', { path: scriptPath, value: src });
    if (!/updated successfully/.test(text)) die(text);
    console.log(`Pushed ${file} (${src.length} chars) to ${name ? `"${name}" ` : ''}${scriptPath}`);
  } else if (cmd === 'pull') {
    const [what, out] = args;
    if (!what) die('usage: tm.mjs pull <uuid>/source|<name> [<out-file>]');
    const text = await call('tampermonkey_get', { path: await resolvePath(what) });
    const src = text.replace(/\n\n---\nLast modified: [^\n]*$/, '');
    if (src === text) die(text); // error object instead of a script
    if (out) { fs.writeFileSync(out, src); console.log(`Wrote ${out} (${src.length} chars)`); } else process.stdout.write(src);
  } else if (cmd === 'list') {
    for (const s of await scripts()) console.log(`${s.name}\t${s.path}`);
  } else if (cmd === 'code') {
    console.log(await call('tampermonkey_get_connection_code'));
  } else {
    die('usage: tm.mjs push <file> [<uuid>/source] | pull <uuid>/source|<name> [<out-file>] | list | code');
  }
} finally {
  await closeSession(session);
}

// Long-lived tampermonkey-mcp server over HTTP, shared by every Claude Code session and by tm.mjs.
// Started on demand by client.mjs via `npx -p tampermonkey-mcp@<version> node daemon.mjs`, so the
// package (unmodified) is on PATH. One process means one WebSocket server, so Tampermonkey Editors
// stays connected across sessions until the daemon stops (reboot, WSL shutdown, kill).
//
// Same as the package's own `--transport=http`, except for the request size limit: express defaults
// to 100 KB, too small for the full source of a larger script.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.TAMPERMONKEY_MCP_PORT) || 47801;

const bin = (process.env.PATH || '').split(path.delimiter).map((d) => path.join(d, 'tampermonkey-mcp')).find((f) => fs.existsSync(f));
if (!bin) throw new Error('tampermonkey-mcp is not on PATH; start this through npx -p tampermonkey-mcp');
const pkg = path.resolve(path.dirname(fs.realpathSync(bin)), '..');
const require = createRequire(path.join(pkg, 'package.json'));
const { version } = require('./package.json');
const express = require('express');
const { createMcpMiddleware } = await import(pathToFileURL(path.join(pkg, 'dist/mcp/server/server.js')).href);

const app = express();
// Local clients only. Browsers send an Origin header (and, after DNS rebinding, a foreign Host), so
// a web page can't reach the MCP endpoint and, through it, the user's scripts.
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
app.use((req, res, next) => {
  if (!HOSTS.has(req.headers.host) || req.headers.origin !== undefined) return res.status(403).end();
  next();
});
app.get('/health', (req, res) => res.json({ name: 'tampermonkey-mcp-daemon', version, pid: process.pid }));
app.use(express.json({ limit: '50mb' }));
app.use(await createMcpMiddleware('/mcp'));
app.listen(PORT, '127.0.0.1', () => console.log(`${new Date().toISOString()} tampermonkey-mcp ${version} daemon on 127.0.0.1:${PORT}, pid ${process.pid}`))
  .on('error', (e) => { console.error(e.message); process.exit(1); });

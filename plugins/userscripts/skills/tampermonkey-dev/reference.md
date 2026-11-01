# Reference

Tested with tampermonkey-mcp 0.0.5, Tampermonkey 5.5.1, Tampermonkey Editors 1.0.7.

## tampermonkey-mcp

- Paths: `<uuid>/source` (script), `<uuid>/storage` (all GM values as one JSON object; `get`/`patch`
  both work, handy for seeding test state), `<uuid>/external/<url-encoded>` (`@require` files).
- `get` appends `\n---\nLast modified: <ISO date>` to the content. Strip it before saving or diffing.
- `patch` replaces the whole file; it takes effect on the next page load. Push scripts with
  `scripts/tm.mjs push` rather than `patch` (see SKILL.md).
- `put` / `delete` need Tampermonkey 5.6+. Before that they return `405 Method Not Allowed`, even though
  they're listed. To create a script, have the user make an empty stub (dashboard → **+** → **Ctrl+S**),
  find it with `list`, then `patch` it, header included. Deleting stays manual.
- `list` has no enabled flag and no `@match`. If a script doesn't run, ask whether it's enabled, and
  check `@match` yourself.
- Not possible via MCP: enable/disable, Tampermonkey's permission dialogs (e.g. cross-origin
  `@connect`), menu commands. Ask the user.
- If the extension can't connect: same browser profile as Claude in Chrome? A code from this session?
  On macOS, `localhost` IPv4/IPv6 mismatch causes random failures (upstream PR #13). WSL2 works with
  mirrored networking.

## The shared daemon

- `scripts/bridge.mjs` is the plugin's MCP server: it forwards to `scripts/daemon.mjs`, one long-lived
  tampermonkey-mcp (the unmodified npm package, run via `npx -p`) on `127.0.0.1:47801`. `tm.mjs` uses
  the same daemon. Either one starts it when it isn't running.
- Port: `TAMPERMONKEY_MCP_PORT`. Log: `$TMPDIR/tampermonkey-mcp-<port>.log`. Health:
  `curl 127.0.0.1:47801/health` (pid, package version).
- The connection code changes only when the daemon restarts (reboot, WSL shutdown, killed). Stop it
  with `kill <pid>` from `/health`; the next call starts a fresh one, which needs a new code.
- Local clients only: requests with an `Origin` header (any browser) or a `Host` other than
  `127.0.0.1`/`localhost` get 403, so web pages can't reach it, DNS rebinding included.
- The daemon raises the request size limit to 50 MB; the package's own `--transport=http` keeps
  express's 100 KB default, too small for large scripts.

## Claude in Chrome

- Userscript console output and exceptions are attributed to
  `chrome-extension://<tampermonkey-id>/userscript.html`. Read with
  `read_console_messages({pattern: "userscript\\.html", onlyErrors: true, clear: true})`. Without
  `clear`, messages pile up across reloads. Line numbers match the source to within 1.
- `javascript_tool` runs in the page world. With any `@grant` other than `none`, the script's variables
  are in Tampermonkey's sandbox and invisible to you: observe through the DOM, console or GM storage.
- *"Cannot access a chrome-extension:// URL of different extension"* from `javascript_tool` or
  `screenshot`: another extension has a frame in the page (seen with AliHelper on AliExpress). `find` and
  `read_page` still work. Otherwise ask the user to pause that extension.

## Snippets

Census with reasons: re-apply the script's own rules to every item and tally the outcomes.

```js
const items = [...document.querySelectorAll('.card')];
const why = {};
for (const el of items) {
  const sold = el.innerText.match(/[\d.,]+K?\+? sold/)?.[0];
  const reason = !sold ? 'no sold text' : parse(sold) === null ? `unparsed: ${sold}` : 'ok';
  why[reason] = (why[reason] || 0) + 1;
}
({ total: items.length, hidden: items.filter(e => e.style.display === 'none').length, why })
```

Real formats on the page, with digits normalized:
`texts.reduce((m, t) => (m[t.replace(/\d+/g, 'N')] = (m[t.replace(/\d+/g, 'N')] || 0) + 1, m), {})`.

Temporary debug flag in site `localStorage`, with a backup: save the old value under a
`sessionStorage` key, set the flag, reload, read the logs, then write the old value back (or remove the
key if it was absent).

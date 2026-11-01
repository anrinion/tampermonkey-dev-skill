# userscripts

Claude Code plugin for developing Tampermonkey userscripts against the real site.

Claude edits the script file, writes it into your installed Tampermonkey through
[tampermonkey-mcp](https://github.com/Tampermonkey/tampermonkey-mcp), reloads the target page in your
browser through [Claude in Chrome](https://code.claude.com/docs/en/chrome) and checks the result (page
content, console errors, GM storage) before the next iteration. The plugin consists of a skill describing
this workflow and the tampermonkey-mcp server configuration.

## Requirements

- Claude Code with Claude in Chrome set up. See the
  [official instructions](https://code.claude.com/docs/en/chrome) for the extension, supported browsers
  and plans.
- Node.js, to run tampermonkey-mcp via `npx`.
- [Tampermonkey](https://www.tampermonkey.net/) 5.5 or later and
  [Tampermonkey Editors](https://chrome.google.com/webstore/detail/tampermonkey-editors/lieodnapokbjkkdkhdljlllmgkmdokcm),
  installed in the same browser profile that Claude in Chrome controls.

## Installation

```sh
claude plugin marketplace add anrinion/tampermonkey-dev-skill
claude plugin install userscripts@tampermonkey-dev-skill
```

The skill alone can also be installed with the [skills CLI](https://skills.sh), for Claude Code or
other agents:

```sh
npx skills add anrinion/tampermonkey-dev-skill
```

In that case the tampermonkey-mcp server is not configured automatically; add it to your agent's MCP
configuration (command `npx -y tampermonkey-mcp@0.0.5`).

## Usage

1. Start Claude Code with `claude --chrome`, or enable Claude in Chrome by default via `/chrome`.
2. Describe the change, e.g. "my AliExpress Filter script hides every card since the last site update,
   fix it". The skill is selected automatically; it can also be invoked as
   `/userscripts:tampermonkey-dev`.
3. Once per session, Claude gives you a connection code. Open Tampermonkey Editors and type it into the
   "Connection code" field.

Without Claude in Chrome, Claude still writes the script into Tampermonkey and asks you to check the
page. Without tampermonkey-mcp, it tests by injecting the script into the page and you install the
result manually.

## Limitations

- Tampermonkey before 5.6 does not allow creating or deleting scripts through tampermonkey-mcp. Claude
  will ask you to create an empty script in the Tampermonkey dashboard, which it then fills in.
- Enabling and disabling scripts, Tampermonkey permission dialogs and menu commands are not accessible
  to Claude.
- If the Tampermonkey Editors popup closes immediately after opening, open
  `chrome-extension://lieodnapokbjkkdkhdljlllmgkmdokcm/popup.html` in a tab instead.

## License

MIT

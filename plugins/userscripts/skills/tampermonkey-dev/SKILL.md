---
name: tampermonkey-dev
description: Develop, fix and verify Tampermonkey userscripts against the real site, writing them into the user's installed Tampermonkey via tampermonkey-mcp and checking them in the browser via Claude in Chrome. Use when the user wants to write, fix, debug or extend a userscript (Tampermonkey, Greasemonkey or Violentmonkey style .user.js) or customize a website with a script.
license: MIT
compatibility: Claude Code with the tampermonkey-mcp server and Claude in Chrome (claude --chrome). Tampermonkey 5.5+ with the Tampermonkey Editors extension.
---

# Live userscript development

Loop: edit the local file → `tampermonkey_patch` it into the user's real Tampermonkey → reload the real
page in Claude in Chrome → measure → repeat. The script runs with the real manager, so `GM_*`, `@grant`,
`@run-at` and logged-in sessions behave as in daily use. Tool quirks and snippets:
[reference.md](reference.md).

## Connect (once per session)

Call `tampermonkey_get_connection_code`, send the user this as a message of its own, then **end your
turn and wait**. Don't assume the extensions are installed; answer setup questions before doing anything else.

> **Connect Tampermonkey**: code **`<code>`**
> 1. Open **Tampermonkey Editors** (toolbar icon, or paste
>    `chrome-extension://lieodnapokbjkkdkhdljlllmgkmdokcm/popup.html` into the address bar if the popup
>    closes immediately).
> 2. Type the code; it connects as you type. Tell me when it says connected.
>
> First time? Install [Tampermonkey](https://www.tampermonkey.net/) 5.5+ and
> [Tampermonkey Editors](https://chrome.google.com/webstore/detail/tampermonkey-editors/lieodnapokbjkkdkhdljlllmgkmdokcm)
> in the browser Claude in Chrome controls.

Confirm with `tampermonkey_list`.

## Habits that pay off

- **The local file is the source of truth, but check for drift first.** Installed copies often contain
  fixes made in the Tampermonkey editor that never reached git. Compare before editing, and reconcile
  with the user.
- **Read the user's real settings** (GM storage, or the site `localStorage` keys the script uses)
  before deciding what "correct" output is. Defaults in the code are often not what they run.
- **Measure, don't eyeball:** one `javascript_tool` call returning counts plus a breakdown of *why*,
  using the script's own rules, finds bugs fast. Use the script's debug flag if it has one.
- **Restore anything you change** to observe something (debug flags, storage).
- Test pure logic offline with node against the real strings from the page before pushing.
- Don't commit without asking. Don't click anything that buys, posts or changes accounts: this is the
  user's real profile.

## Missing tools: degrade, don't refuse

Say once what's missing and how to get it (`claude --chrome`), then continue:

- **Another browser tool** (chrome-devtools-mcp, Playwright): fine, as long as it drives the user's
  profile, where Tampermonkey lives.
- **No browser tool:** still push via MCP; ask the user for specific observations after each reload
  (a count, console lines, the output of a snippet you give them).
- **No tampermonkey-mcp:** simulate by injecting the script with `javascript_tool`. That's good enough
  for `@grant none` logic, but it doesn't cover `@match`, `@run-at` timing, `@require`, the sandbox or
  real `GM_*` (stub light ones). Watch for double runs if the script is also installed. Label results
  "verified by simulation", and have the user paste the final version once for a real check.

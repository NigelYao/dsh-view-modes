# DshViewModes

<div align="center">

**English** · [简体中文](./README.zh-CN.md)

</div>

<p align="center">Three output modes for DSH Web: Verbose, Normal, and Summary. Keep the full trace when debugging, reduce process noise during daily work, or focus on the result.</p>

This is an official-style DSH bundle plugin (`dsh.bundle` + `dsh.client`). It changes only browser-side presentation and does not patch DSH core files.

## Preview

The interface follows the language selected in Harness Settings. This is Summary mode with Harness set to English:

<p align="center">
  <img src="./docs/images/english-summary.png" alt="DshViewModes Summary mode in the Harness English interface" width="100%">
</p>

Normal mode groups related tool calls and thinking while keeping assistant text as a clear boundary. Click a process title to inspect its original steps.

<p align="center">
  <img src="./docs/images/normal-grouping.png" alt="Normal mode semantic process grouping and expanded details" width="100%">
</p>

Switch modes from the session header.

<p align="center">
  <img src="./docs/images/mode-switcher.png" alt="Verbose, Normal, and Summary mode switcher" width="576">
</p>

## Modes

| Mode | Best for | Behavior |
|---|---|---|
| **Verbose** | Debugging | Preserves everything DSH renders, including thinking, tool calls, retries, context, and statistics |
| **Normal** | Daily work | Groups process steps by semantic phase; thinking joins the neighboring process group; assistant text remains visible and starts a new grouping interval |
| **Summary** | Results | Hides process noise while running, shows a live shimmer status, and folds the completed process into a compact summary |

Normal mode does not split a group after an arbitrary number of calls. Repeated reads, commands, edits, searches, or coordination steps can stay together while they belong to the same phase. A visible assistant message is always a hard boundary.

## Install

Requirements:

- Node.js 20 or later
- DSH with the `web` profile available
- Git
- `pnpm` on `PATH` (required by `dsh plugin`; use `corepack enable` if needed)

### Public GitHub install (recommended)

No npm account is required:

```sh
dsh plugin --profile web add git+https://github.com/NigelYao/dsh-view-modes.git
```

If an older development build named `dsh-output-mode` is already installed, remove it once before installing DshViewModes:

```sh
dsh plugin --profile web remove dsh-output-mode
dsh plugin --profile web add git+https://github.com/NigelYao/dsh-view-modes.git
```

### Local development on Windows

For source iteration, clone the repository onto the same drive as the DSH home directory. This avoids broken cross-drive package links.

```powershell
$pluginRoot = Join-Path $env:USERPROFILE ".dsh\local-plugins\dsh-view-modes"
git clone https://github.com/NigelYao/dsh-view-modes.git $pluginRoot
Set-Location $pluginRoot
dsh plugin --profile web add link:$pluginRoot
```

If you already keep the repository on another drive, create a junction on the DSH home drive and install from the junction:

```powershell
$source = "D:\Projects\dsh\plugins\dsh-output-mode"
$pluginRoot = Join-Path $env:USERPROFILE ".dsh\local-plugins\dsh-view-modes"
New-Item -ItemType Junction -Path $pluginRoot -Target $source
Set-Location $pluginRoot
dsh plugin --profile web add link:$pluginRoot
```

Do not insert `dsh-view-modes` again in the profile or home `cordis.patch.yml`; the plugin's own patch already registers its bundle id.

### Start DSH Web

Restart DSH Web after installing or updating the plugin. The client bundle revision is composed when the process starts.

```powershell
npx @deepseek-ai/dsh web
```

Open [http://127.0.0.1:3080/](http://127.0.0.1:3080/).

## Use

- Use the session-header control to select **Verbose**, **Normal**, or **Summary**.
- Use `Alt+1`, `Alt+2`, or `Alt+3` to switch modes from the keyboard.
- In Normal mode, click a process title such as "Ran 2 commands, thought 3 times" to expand the original steps. Click the title row again to collapse it.
- Individual command details remain expandable inside an open process group. Closing the group resets those details, so the next opening starts compact.
- The selected mode is stored in `localStorage` and survives refresh. The default is **Normal**.
- All UI copy follows the language selected in Harness Settings and updates between Chinese and English automatically.
- The running process title uses a shimmer effect, and changing counters roll upward.

Summary mode shows a compact live activity line while the agent runs. When the turn completes, the process becomes an expandable recap above the answer.

## Update

```powershell
Set-Location $pluginRoot
git pull --ff-only
npm run check
# Restart DSH Web after the pull.
```

## Verify

```powershell
dsh --profile web --dump-config | Select-String "dsh-view-modes"
npm run check
```

The configuration should mention `dsh-view-modes` once, and [http://127.0.0.1:3080/plugins/dsh-view-modes/client.js](http://127.0.0.1:3080/plugins/dsh-view-modes/client.js) should return HTTP 200 while DSH Web is running.

## Documentation

- [Technical notes](./TECHNICAL.md) (Chinese): architecture, grouping rules, data attributes, performance constraints, and maintenance notes
- [Handoff](./HANDOFF.md) (Chinese): current behavior, completed changes, pitfalls, and verification checklist

## License

MIT

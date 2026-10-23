# Overdraw

Draw, annotate and diagram on top of anything on your screen: code editors,
games, Blender, video, slides. Overdraw lives in the Windows system tray and
puts the full [Excalidraw](https://github.com/excalidraw/excalidraw) editor on a
transparent layer over every app.

Overdraw is run from source: clone this repository, install two free tools,
and start it with one command. There is no installer to download.

## Before you start

You need **Windows 10 or 11 (64-bit)** and two free tools. Install them once,
from PowerShell or Windows Terminal:

| Tool | Why | Install |
| --- | --- | --- |
| **Node.js 24 LTS** (includes npm 11) | Runs the build and downloads dependencies | `winget install OpenJS.NodeJS.LTS` or [nodejs.org](https://nodejs.org) |
| **Git** | Downloads this repository | `winget install Git.Git` or [git-scm.com](https://git-scm.com/download/win) |

Close and reopen the terminal after installing, then check both are ready:

```bash
node --version
```

```bash
git --version
```

Node should print `v24` or newer (v22.12 is the minimum). You also need an
internet connection for the first install and start (a few hundred MB, mostly
Electron) and about 1 GB of free disk space. No Visual Studio, Python or admin
rights are needed.

## Install and run

```bash
git clone https://github.com/<your-username>/overdraw.git
```

```bash
cd overdraw
```

```bash
npm ci
```

```bash
npm start
```

`npm ci` installs the exact dependency versions locked in `package-lock.json`.
`npm start` builds Overdraw (about 20 seconds) and launches it. The very first
start also prints `Downloading Electron binary...` and fetches Electron (about
110 MB, checked against Electron's published checksums). Nothing opens:
look for the Overdraw icon in the system tray (the **^** arrow by the clock). On
the first launch a notification confirms it's running.

Press **Alt+Shift+P** to draw, and **Esc** when you're done.

### Launch it without a terminal

`npm start` keeps the terminal busy while Overdraw runs. To launch it like any
other app instead, add a Start menu shortcut once:

```bash
npm run shortcut
```

Then search **Overdraw** in the Start menu. To start it automatically when you
sign in, right-click the tray icon and tick **Launch at Login**.

### Update

```bash
git pull
```

```bash
npm ci
```

```bash
npm start
```

Quit Overdraw from the tray first. Your settings and drawings library are kept.

### Uninstall

1. Right-click the tray icon → **Quit Overdraw**, and untick **Launch at Login**
   first if you turned it on.
2. Run `npm run shortcut -- --remove` if you added the Start menu shortcut.
3. Delete the `overdraw` folder. Settings live in `%APPDATA%\Overdraw` and
   screenshots in `Pictures\Overdraw`; delete those too if you like.

## Use it

| Action | Default shortcut | Also |
| --- | --- | --- |
| Start / stop drawing on the screen under the cursor | **Alt+Shift+P** | Click the tray icon |
| Hide / show all ink (nothing is lost) | **Alt+Shift+H** | Tray menu |
| Clear the current screen (undo with Ctrl+Z) | **Alt+Shift+X** | Trash button |
| Screenshot the screen with your ink | **Alt+Shift+4** | Camera button |
| Finish drawing | **Esc** (with nothing selected) | **Done** button |

All shortcuts can be changed in **Settings** (tray menu → Settings…).

While drawing, the screen has a thin blue frame and every Excalidraw tool and
shortcut works: **P** pen, **M** highlighter, **K** laser pointer, **R**
rectangle, **A** arrow, **T** text, **E** eraser, **Ctrl+Z** undo, plus shapes,
arrows that bind to shapes, text, images, frames, the library, Mermaid-to-diagram,
export and save/open `.excalidraw` files.

When you finish, your ink stays on screen and **clicks pass straight through** to
the apps underneath. Start drawing again to keep editing it. A screen with no
ink hides its overlay completely, so nothing sits over your games.

Control bar (bottom centre while drawing): pen · highlighter · laser · colours ·
whiteboard (hides the screen behind a blank canvas) · re-align canvas (only shown
if you panned) · screenshot · clear · settings · **Done**.

Screenshots go to `Pictures\Overdraw` and, by default, to the clipboard.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `npm` or `git` is "not recognized" | Reopen the terminal after installing Node.js or Git. |
| `npm ci` fails with a network error | Check your connection or proxy, then run `npm ci` again. |
| `npm start` fails at `Downloading Electron binary...` | A network blip interrupted the download. Run `npm ci`, then `npm start` again. |
| `npm ci` prints `allow-scripts` warnings | Expected: npm skips install scripts that Overdraw doesn't need. |
| Nothing happens after `npm start` | Overdraw runs in the tray, so check the **^** arrow by the clock. Only one copy runs at a time; launching it again starts drawing. |
| A shortcut does nothing | Another app may own it. Settings marks such shortcuts in red; pick another. |
| The overlay doesn't appear over a game | Switch the game to **borderless** or **windowed** mode. Exclusive full screen can't show any overlay. |
| "Launch at Login" is greyed out | You started it with `npm run dev`; use `npm start`. |

## Develop

```bash
npm run dev         # Electron + Vite with hot reload (renderer)
npm run typecheck   # main/preload and renderer
npm run build       # production bundles in out/, then checks the preloads
npm run icons       # regenerate app and tray icons
```

To work on the UI in a normal browser, run `npx electron-vite dev --rendererOnly`
and open `http://localhost:5173/overlay.html` or `/settings.html`. A preview
bridge stands in for Electron.

Every push and pull request is checked by `.github/workflows/ci.yml`, which does
exactly what this README asks of you (`npm ci`, typecheck, build) on Windows.
Building a packaged `.exe` is optional; see [DISTRIBUTING.md](DISTRIBUTING.md).

## How it works

```
 tray / global shortcuts
          │
   main process ─────────────────────────────────────────────────────────┐
   │ OverlayManager: one transparent, always-on-top window per display    │
   │   drawing  → captures input, focused, shows the editor               │
   │   passive  → setIgnoreMouseEvents: ink visible, clicks pass through  │
   │   hidden   → window hidden (also used whenever there is no ink)      │
   │ HotkeyManager · SettingsStore · screenshot (desktopCapturer)         │
   └──────── typed, validated IPC ─────────────────────────────────────────┘
          │
   overlay renderer (sandboxed): Excalidraw with a transparent background,
   restyled, plus the Overdraw control bar
```

- **Drawing engine.** Excalidraw's pen is built on
  [perfect-freehand](https://github.com/steveruizok/perfect-freehand)'s
  `getStroke` (pressure-sensitive outlines, so pen tablets get real pressure).
  Embedding Excalidraw rather than re-implementing it gives every Excalidraw
  feature, kept current by updating one dependency. The app icon is drawn by
  `scripts/make-icons.mjs` with the same `getStroke`.
- **Pinned canvas.** Ink must stay aligned with what is under it, so the mouse
  wheel does not pan or zoom the canvas (toggle in Settings).
- **Multiple monitors.** Each display gets its own overlay and its own drawing,
  created the first time you draw there and rebuilt if displays change.

## Security

- Every renderer is sandboxed with context isolation and no Node.js. Preloads
  expose a small typed API (never raw `ipcRenderer`); a build step fails if a
  preload bundle requires anything but `electron`.
- The main process checks that each IPC message comes from one of its own windows
  and validates every payload. Settings from disk or IPC go through
  `sanitizeSettings`, so a corrupted file falls back to defaults.
- Pages are served from a custom `app://` protocol (not `file://`) with path
  traversal checks, explicit MIME types, `nosniff`, and a strict
  Content-Security-Policy. Nothing is loaded from the network: fonts are bundled,
  and third-party embeds (iframes) are disabled.
- Navigation, new windows and `<webview>` are blocked; links open in your
  browser. Only clipboard and file-dialog permissions are granted.
- Settings live in your user profile (`%APPDATA%\Overdraw`) and are written
  atomically, so a crash never leaves a half-written file. Global shortcuts
  must include Ctrl, Alt or Win so they can never hijack normal typing.
- **Supply chain.** Dependencies are pinned to exact versions in
  `package-lock.json`, and `npm audit` reports no known vulnerabilities (patched
  versions of vulnerable transitive packages are forced via `overrides`). npm 11
  only runs the install scripts listed in `allowScripts` (just esbuild, which
  unpacks its compiler); all others are skipped. Electron downloads its binary
  on first start and verifies it against the checksums in its package. CI
  workflow actions are pinned to commit hashes, and Dependabot proposes updates
  weekly.
- Packaged builds (optional, see [DISTRIBUTING.md](DISTRIBUTING.md))
  additionally lock the Electron binary with fuses (no `RunAsNode`,
  `NODE_OPTIONS` or `--inspect`; ASAR integrity checks) and refuse remote
  debugging. These apply only to packaged builds, not to `npm start`.

## Design

The UI follows Swiss and Apple principles: a 4/8 pt grid, one type family (Segoe
UI Variable on Windows, SF Pro on macOS) in two weights, neutral surfaces with a
single blue accent, hairline separators, 32 pt hit targets and quiet motion that
respects *Reduce motion*. Excalidraw's own violet theme is restyled to match.
Light and dark appearance follow the system, and Settings uses the Windows 11
Mica material.

## Licence

Overdraw's own code: all rights reserved (`UNLICENSED`) until a licence is
chosen. Third-party components are listed in `THIRD_PARTY_NOTICES.txt`,
generated by every build (open it from **Settings → Third-Party Licenses**).
Whether Overdraw can be sold, and what that requires, is covered in
[LEGAL.md](LEGAL.md).

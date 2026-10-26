# How to install and use Overdraw (step by step)

Overdraw lets you **draw on top of anything on your screen**: your code
editor, a game, a video, a slideshow. It's free and open source (MIT licence),
works offline, and collects no data.

This guide assumes you've never used a terminal. It takes about 10 minutes
the first time. You need **Windows 10 or 11** and an internet connection for
the setup.

There are two ways to get Overdraw:

- **[A. From the source code](#a-from-the-source-code-recommended)**
  (recommended): you download the project and start it with two commands.
- **[B. From an `.exe` file](#b-from-an-exe-file-someone-sent-you)** someone
  sent you: double-click and go.

---

## A. From the source code (recommended)

### Step 1: Install Node.js (once)

Node.js is the free tool that builds and runs Overdraw.

1. Go to **<https://nodejs.org>** and click the big **LTS** download button.
2. Open the downloaded file and click **Next** through the installer, keeping
   the default options.
   - If a page offers **"Automatically install the necessary tools"**, leave
     that box **unticked**. Overdraw doesn't need them.
3. Click **Finish**.

### Step 2: Download Overdraw

The simple way, with no extra tools:

1. Go to **<https://github.com/JohnsonDza/overdraw>**.
2. Click the green **Code** button, then **Download ZIP**.
3. Open your **Downloads** folder, right-click **overdraw-main.zip** and
   choose **Extract All…**, then **Extract**.
4. Move the extracted **overdraw-main** folder somewhere you'll keep it, such
   as **Documents**. Don't delete it later: Overdraw runs from this folder.

<details>
<summary>Or, if you already use Git</summary>

```bash
git clone https://github.com/JohnsonDza/overdraw.git
```

With Git, `git pull` fetches updates later.
</details>

### Step 3: Open PowerShell in that folder

1. Open the **overdraw-main** folder in File Explorer. You should see files
   like `package.json` and `README.md`.
2. Click the **address bar** at the top (where the folder path is shown), type
   `powershell`, and press **Enter**.

A blue or black window opens, already "inside" the folder. This is where you
type the next commands. (On Windows 11 you can also right-click an empty
space in the folder and choose **Open in Terminal**.)

### Step 4: Install Overdraw's parts (once, about 1–3 minutes)

Type this and press **Enter**:

```bash
npm.cmd ci
```

Wait until the text stops scrolling and you can type again. Yellow `warn`
lines are normal.

> Why `npm.cmd` and not `npm`? Windows PowerShell blocks scripts by default,
> and `npm` on Windows is one. `npm.cmd` is the same command without that
> problem, so there's no need to change any security settings.

### Step 5: Start Overdraw

```bash
npm.cmd start
```

The first time, it builds Overdraw (about 20 seconds) and downloads part of it
(`Downloading Electron binary...`, about 110 MB). After that, **no window
opens**: Overdraw lives in the **system tray**, the icons by the clock. Click
the **^** arrow there if you don't see it. On the first start, a notification
says it's ready.

Leave the PowerShell window open while you use Overdraw. Closing it closes
Overdraw.

### Step 6: Add it to the Start menu (recommended)

So you never need PowerShell again, run this once in the same window:

```bash
npm.cmd run shortcut
```

From now on, search **Overdraw** in the Start menu to open it. You can close
the PowerShell window after Overdraw has started from the Start menu.

To start Overdraw automatically when you sign in, right-click the tray icon
and tick **Launch at Login**.

---

## B. From an `.exe` file someone sent you

1. Save **Overdraw-1.0.0.exe** somewhere you'll find it again, such as your
   Desktop.
2. Double-click it. Windows will probably show **"Windows protected your PC"**,
   because the file isn't signed (signing costs money, and Overdraw is free).
   Click **More info**, then **Run anyway**. Your browser may also warn while
   downloading; choose **Keep**.
3. Wait about 10 seconds while it unpacks itself. Then look for the Overdraw
   icon by the clock (click **^**).

Each time you open it, it takes a few seconds to start. To close it,
right-click the tray icon and choose **Quit Overdraw**. To remove it, quit it
and delete the file.

---

## If Windows says "Smart App Control blocked" or "Application Control policy"

**Smart App Control** is a Windows 11 security feature that only allows apps
Microsoft already knows or that are signed. A free, unsigned app like
Overdraw may be blocked by it, from either method above. You'll see a
message like *"Smart App Control blocked an app"* or *"An Application Control
policy has blocked this file."*

There's no "allow just this app" option, so your choices are:

- **Don't use Overdraw on this PC**, or
- **Turn Smart App Control off:**
  1. Open **Start**, type **Windows Security**, and open it.
  2. Go to **App & browser control → Smart App Control settings**.
  3. Choose **Off** and confirm.

Before you decide:

- This lowers your PC's protection for **all** apps, not just Overdraw.
  Microsoft Defender antivirus and SmartScreen keep protecting you.
- On Windows 11 with updates from April 2026 or later, you can turn Smart App
  Control back on from the same page. On older versions turning it off was
  permanent until Windows was reset, and some PCs updated in October 2026
  show the switch greyed out.
- If it's a **work or school PC**, ask your IT department first instead.

---

## Using Overdraw

| To… | Press… |
| --- | --- |
| Start drawing on the screen under your mouse | **Alt + Shift + P** (or click the tray icon) |
| Finish drawing (your drawing stays; apps underneath work normally) | **Esc**, or click **Done** |
| Hide or show all drawings | **Alt + Shift + H** |
| Clear the screen (Ctrl + Z while drawing brings it back) | **Alt + Shift + X** |
| Screenshot with your drawings (saved to Pictures\Overdraw) | **Alt + Shift + 4** |

While drawing, the bar at the bottom has a pen, highlighter, laser pointer,
colours, a whiteboard, screenshot, clear, settings and **Done**. Keys also
work: **P** pen, **M** highlighter, **K** laser, **R** rectangle, **A** arrow,
**T** text, **E** eraser.

To change the shortcuts, right-click the tray icon and choose **Settings…**,
click a shortcut and press the new keys.

**Games:** run the game in **borderless** or **windowed** mode. If the game
pauses while you draw, turn on **Settings → Keep the app underneath focused**.

---

## Updating (source code method)

1. Right-click the tray icon and choose **Quit Overdraw**.
2. Download the ZIP again (Step 2) and replace the old folder's contents. With
   Git, run `git pull` in the folder instead.
3. Open PowerShell in the folder (Step 3) and run `npm.cmd ci`, then
   `npm.cmd start`.

Your settings are kept.

## Uninstalling (source code method)

1. Right-click the tray icon and choose **Quit Overdraw**. If you ticked
   **Launch at Login**, untick it first.
2. If you added the Start menu shortcut, open PowerShell in the folder and run
   `npm.cmd run shortcut -- --remove`.
3. Delete the **overdraw-main** folder.
4. Optional: delete your settings in `%APPDATA%\Overdraw` (paste that into the
   File Explorer address bar) and your screenshots in **Pictures\Overdraw**.

---

## Something not working?

| Problem | Fix |
| --- | --- |
| `npm.cmd` is "not recognized" | Node.js isn't installed, or PowerShell was open during the install. Close PowerShell, open it again (Step 3), and retry. |
| `npm.cmd ci` stops with red `ERR!` lines | Check your internet connection and run it again. |
| `npm.cmd start` stops at `Downloading Electron binary...` | The download was interrupted. Run `npm.cmd ci`, then `npm.cmd start` again. |
| Nothing appears after starting | Overdraw is in the tray by the clock (click **^**). Only one copy runs at a time. |
| A shortcut does nothing | Another app may use it. Open **Settings…** from the tray; taken shortcuts are marked in red. Pick another. |
| Windows blocks it | See [Smart App Control](#if-windows-says-smart-app-control-blocked-or-application-control-policy). |

Still stuck? Open an issue at <https://github.com/JohnsonDza/overdraw/issues>
and describe what you did and what you saw.

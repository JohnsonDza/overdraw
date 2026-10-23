// Adds (or removes) an "Overdraw" Start menu shortcut for a copy run from
// source, so it can be launched like any other app without a terminal.
//
//   npm run shortcut             create or update the shortcut
//   npm run shortcut -- --remove remove it
//
// Runs inside Electron (for shell.writeShortcutLink, which can also set the
// AppUserModelID Windows needs to show Overdraw's notifications).
const { app, shell } = require('electron')
const { existsSync, rmSync } = require('node:fs')
const { join, resolve } = require('node:path')

const APP_ID = 'com.overdraw.app'
const root = resolve(__dirname, '..')
const args = process.argv.slice(2)
const dirFlag = args.indexOf('--dir')
const folder =
  dirFlag !== -1 && args[dirFlag + 1]
    ? resolve(args[dirFlag + 1])
    : join(process.env.APPDATA, 'Microsoft', 'Windows', 'Start Menu', 'Programs')
const link = join(folder, 'Overdraw.lnk')

app.whenReady().then(() => {
  try {
    if (process.platform !== 'win32') throw new Error('Start menu shortcuts are Windows-only.')

    if (args.includes('--remove')) {
      rmSync(link, { force: true })
      console.log(`Removed ${link}`)
      return
    }

    if (!existsSync(join(root, 'out', 'main', 'index.js'))) {
      throw new Error('Overdraw is not built yet. Run `npm start` once first.')
    }
    // Replace rather than update, so no stale target or arguments survive.
    rmSync(link, { force: true })
    const ok = shell.writeShortcutLink(link, 'create', {
      target: process.execPath, // node_modules\electron\dist\electron.exe
      args: `"${root}"`,
      cwd: root,
      description: 'Draw over anything on your screen',
      icon: join(root, 'resources', 'icon.ico'),
      iconIndex: 0,
      appUserModelId: APP_ID
    })
    if (!ok) throw new Error(`Could not write ${link}`)
    console.log(`Created ${link}\nSearch "Overdraw" in the Start menu to launch it.`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally {
    app.quit()
  }
})

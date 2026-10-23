import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { clipboard, ClipboardItem, desktopCapturer, Notification, shell, type Display } from 'electron'
import { iconPath, screenshotFolder } from './paths'

function timestamp(date = new Date()): string {
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} at ${p(date.getHours())}.${p(date.getMinutes())}.${p(date.getSeconds())}`
}

/**
 * Grabs one display exactly as it looks right now: apps underneath plus the
 * overlay's ink, at native resolution.
 */
export async function captureDisplay(display: Display): Promise<Electron.NativeImage> {
  const { width, height } = display.size
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(width * display.scaleFactor),
      height: Math.round(height * display.scaleFactor)
    }
  })
  const source = sources.find((s) => s.display_id === String(display.id)) ?? (sources.length === 1 ? sources[0] : undefined)
  if (!source || source.thumbnail.isEmpty()) throw new Error('Screen capture returned no image.')
  return source.thumbnail
}

export async function saveScreenshot(image: Electron.NativeImage, toClipboard: boolean): Promise<string> {
  const folder = screenshotFolder()
  await mkdir(folder, { recursive: true })
  const file = join(folder, `Overdraw ${timestamp()}.png`)
  const png = image.toPNG()
  await writeFile(file, png)
  if (toClipboard) {
    await clipboard.write([new ClipboardItem({ 'image/png': new Blob([png], { type: 'image/png' }) })])
  }

  if (Notification.isSupported()) {
    const note = new Notification({
      title: 'Screenshot saved',
      body: toClipboard ? 'Copied to the clipboard. Click to show the file.' : 'Click to show the file.',
      icon: iconPath('icon.png'),
      silent: true
    })
    note.on('click', () => shell.showItemInFolder(file))
    note.show()
  }
  return file
}

import { EventEmitter } from 'node:events'
import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { app } from 'electron'
import { applySettingsPatch, DEFAULT_SETTINGS, sanitizeSettings, type Settings } from '@shared/settings'

/**
 * Persists settings as JSON in the user data folder. Input is always passed
 * through `sanitizeSettings`, so a hand-edited or corrupted file is harmless.
 */
export class SettingsStore extends EventEmitter<{ change: [Settings] }> {
  private current: Settings
  readonly file = join(app.getPath('userData'), 'settings.json')

  constructor() {
    super()
    this.current = this.load()
  }

  get value(): Settings {
    return this.current
  }

  update(patch: unknown): Settings {
    const next = applySettingsPatch(this.current, patch)
    return this.replace(next)
  }

  reset(): Settings {
    return this.replace(sanitizeSettings(DEFAULT_SETTINGS))
  }

  private replace(next: Settings): Settings {
    if (JSON.stringify(next) === JSON.stringify(this.current)) return this.current
    this.current = next
    this.save()
    this.emit('change', next)
    return next
  }

  private load(): Settings {
    try {
      return sanitizeSettings(JSON.parse(readFileSync(this.file, 'utf8')))
    } catch {
      return sanitizeSettings(DEFAULT_SETTINGS)
    }
  }

  /** Write to a temp file and rename, so a crash mid-write never truncates settings. */
  save(): void {
    const temp = `${this.file}.tmp`
    try {
      writeFileSync(temp, JSON.stringify(this.current, null, 2), { encoding: 'utf8', mode: 0o600 })
      renameSync(temp, this.file)
    } catch (error) {
      console.error('Could not save settings:', error)
    }
  }
}

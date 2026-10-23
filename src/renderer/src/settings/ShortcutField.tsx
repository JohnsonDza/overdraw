import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { acceleratorToKeycaps, chordToAccelerator, isValidAccelerator } from '@shared/accelerator'
import type { HotkeyStatus } from '@shared/ipc'

interface Props {
  label: string
  value: string
  status: HotkeyStatus
  onChange: (accelerator: string) => void
  onRecordingChange: (recording: boolean) => void
}

const MODIFIER_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'OS'])

/**
 * Click, then press a key combination. Esc cancels; Backspace turns the
 * shortcut off. Requires at least Ctrl, Alt or Win so it can't hijack typing.
 */
export function ShortcutField({ label, value, status, onChange, onRecordingChange }: Props) {
  const [recording, setRecording] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => onRecordingChange(recording), [recording, onRecordingChange])

  const stop = (): void => {
    setRecording(false)
    setHint(null)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (!recording) return
    event.preventDefault()
    event.stopPropagation()
    const bare = !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey
    if (bare && event.key === 'Escape') return stop()
    if (bare && (event.key === 'Backspace' || event.key === 'Delete')) {
      onChange('')
      return stop()
    }
    if (MODIFIER_KEYS.has(event.key)) {
      setHint('Now press a letter, number or function key')
      return
    }
    const accelerator = chordToAccelerator(event.nativeEvent)
    if (!accelerator) {
      setHint('That key can’t be used in a shortcut')
      return
    }
    if (!isValidAccelerator(accelerator)) {
      setHint('Include Ctrl, Alt or Win')
      return
    }
    onChange(accelerator)
    stop()
    button.current?.blur()
  }

  const keycaps = acceleratorToKeycaps(value)
  const describedBy = `${label.replace(/\W+/g, '-')}-status`

  return (
    <div className="shortcut">
      <button
        ref={button}
        type="button"
        className="shortcut-field"
        data-recording={recording}
        data-status={status}
        aria-label={`${label} shortcut: ${value || 'off'}. Click to change.`}
        aria-describedby={describedBy}
        onClick={() => setRecording(true)}
        onBlur={stop}
        onKeyDown={onKeyDown}
      >
        {recording ? (
          <span className="shortcut-placeholder">Type shortcut…</span>
        ) : keycaps.length > 0 ? (
          keycaps.map((cap, i) => (
            <kbd key={i} className="keycap">
              {cap}
            </kbd>
          ))
        ) : (
          <span className="shortcut-placeholder">Off</span>
        )}
      </button>
      <span id={describedBy} className="shortcut-status" data-status={recording ? 'hint' : status} role="status">
        {recording
          ? (hint ?? 'Esc to cancel · Backspace to turn off')
          : status === 'conflict'
            ? 'In use by another app'
            : ''}
      </span>
    </div>
  )
}

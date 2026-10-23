/**
 * Helpers for Electron accelerator strings ("Alt+Shift+D").
 *
 * Global shortcuts are deliberately restricted: at least one modifier plus one
 * non-modifier key. A bare key ("D") would hijack typing in every other app.
 */

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Super'] as const
type Modifier = (typeof MODIFIERS)[number]

const NAMED_KEYS = new Set([
  'Space', 'Tab', 'Backspace', 'Delete', 'Insert', 'Return', 'Escape',
  'Up', 'Down', 'Left', 'Right', 'Home', 'End', 'PageUp', 'PageDown',
  'Plus', 'numadd', 'numsub', 'nummult', 'numdiv', 'numdec',
  'num0', 'num1', 'num2', 'num3', 'num4', 'num5', 'num6', 'num7', 'num8', 'num9'
])

const PUNCTUATION = new Set([')', '!', '@', '#', '$', '%', '^', '&', '*', '(', ':', ';', '<', '=', '>', '?', '-', '_', '[', ']', '{', '}', '|', '\\', '/', '`', '~', ',', '.', "'", '"'])

function isKey(token: string): boolean {
  if (/^[A-Z0-9]$/.test(token)) return true
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(token)) return true
  return NAMED_KEYS.has(token) || PUNCTUATION.has(token)
}

export function isValidAccelerator(value: string): boolean {
  if (value.length === 0 || value.length > 64) return false
  const tokens = value.split('+')
  // "Plus" is the named key for "+", so splitting on "+" is unambiguous.
  if (tokens.some((t) => t.length === 0)) return false
  const key = tokens[tokens.length - 1]
  const modifiers = tokens.slice(0, -1)
  if (modifiers.length === 0 || !isKey(key)) return false
  const seen = new Set<string>()
  for (const m of modifiers) {
    if (!MODIFIERS.includes(m as Modifier) || seen.has(m)) return false
    seen.add(m)
  }
  // Shift alone is not a real chord: Shift+D is just typing a capital D.
  if (seen.size === 1 && seen.has('Shift')) return false
  return true
}

const CODE_TO_KEY: Record<string, string> = {
  Space: 'Space', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Insert: 'Insert',
  Enter: 'Return', NumpadEnter: 'Return', Escape: 'Escape',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', Backquote: '`',
  NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult',
  NumpadDivide: 'numdiv', NumpadDecimal: 'numdec'
}

/** Minimal shape of a KeyboardEvent so this module stays DOM-free. */
export interface KeyChord {
  code: string
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

/**
 * Converts a keydown into an accelerator. Uses `code` (physical key) so the
 * result is the same regardless of keyboard layout or Shift state.
 * Returns null while only modifiers are held.
 */
export function chordToAccelerator(e: KeyChord): string | null {
  let key: string | undefined
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3)
  else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5)
  else if (/^Numpad[0-9]$/.test(e.code)) key = `num${e.code.slice(6)}`
  else if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.code)) key = e.code
  else key = CODE_TO_KEY[e.code]
  if (!key) return null

  const parts: string[] = []
  if (e.ctrlKey) parts.push('Ctrl')
  if (e.altKey) parts.push('Alt')
  if (e.shiftKey) parts.push('Shift')
  if (e.metaKey) parts.push('Super')
  parts.push(key)
  return parts.join('+')
}

const DISPLAY_NAMES: Record<string, string> = {
  Super: 'Win', Return: 'Enter', Escape: 'Esc', Up: '↑', Down: '↓', Left: '←', Right: '→',
  numadd: 'Num +', numsub: 'Num −', nummult: 'Num ×', numdiv: 'Num ÷', numdec: 'Num .'
}

/** Splits an accelerator into human-readable key caps. */
export function acceleratorToKeycaps(value: string): string[] {
  if (!value) return []
  return value.split('+').map((t) => DISPLAY_NAMES[t] ?? (t.startsWith('num') ? `Num ${t.slice(3)}` : t))
}

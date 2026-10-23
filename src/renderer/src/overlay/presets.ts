/** Quick tools in the control bar. Pen and laser are Excalidraw tools; the marker is a translucent pen. */
export type Preset = 'pen' | 'marker' | 'laser'

export const MARKER_OPACITY = 40
export const MARKER_WIDTH = 4
export const PEN_WIDTH = 2

/** Excalidraw's own palette (open-color), so swatches match its colour picker. */
export const PEN_COLORS = [
  { value: '#e03131', name: 'Red' },
  { value: '#f08c00', name: 'Orange' },
  { value: '#2f9e44', name: 'Green' },
  { value: '#1971c2', name: 'Blue' },
  { value: '#1e1e1e', name: 'Ink' }
] as const

export const MARKER_COLORS = [
  { value: '#ffd43b', name: 'Yellow' },
  { value: '#69db7c', name: 'Green' },
  { value: '#74c0fc', name: 'Blue' },
  { value: '#f783ac', name: 'Pink' }
] as const

export interface PresetStyle {
  color: string
  width: number
  opacity: number
}

/** Which preset (if any) the current Excalidraw tool state corresponds to. */
export function presetFor(tool: string, opacity: number): Preset | null {
  if (tool === 'laser') return 'laser'
  if (tool === 'freedraw') return opacity < 100 ? 'marker' : 'pen'
  return null
}

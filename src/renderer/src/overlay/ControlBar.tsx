import { acceleratorToKeycaps } from '@shared/accelerator'
import { BoardIcon, CameraIcon, CheckIcon, GearIcon, LaserIcon, MarkerIcon, PenIcon, RecenterIcon, TrashIcon } from './icons'
import { MARKER_COLORS, PEN_COLORS, type Preset } from './presets'

interface Props {
  preset: Preset | null
  color: string
  boardOn: boolean
  viewMoved: boolean
  hasInk: boolean
  screenshotShortcut: string
  onPreset: (preset: Preset) => void
  onColor: (color: string) => void
  onToggleBoard: () => void
  onResetView: () => void
  onClear: () => void
  onScreenshot: () => void
  onSettings: () => void
  onDone: () => void
}

const withShortcut = (label: string, accelerator: string): string =>
  accelerator ? `${label} (${acceleratorToKeycaps(accelerator).join('+')})` : label

/**
 * Floating control bar. Grouped left to right by intent: what you draw with,
 * its colour, the canvas, output, then leaving draw mode.
 */
export function ControlBar(props: Props) {
  const swatches = props.preset === 'marker' ? MARKER_COLORS : PEN_COLORS
  const showSwatches = props.preset !== 'laser'

  const tool = (preset: Preset, label: string, icon: JSX.Element, key: string) => (
    <button
      type="button"
      className="od-button"
      aria-pressed={props.preset === preset}
      title={`${label} (${key})`}
      aria-label={label}
      onClick={() => props.onPreset(preset)}
    >
      {icon}
    </button>
  )

  return (
    <div className="od-bar" role="toolbar" aria-label="Overdraw">
      <div className="od-group">
        {tool('pen', 'Pen', <PenIcon />, 'P')}
        {tool('marker', 'Highlighter', <MarkerIcon />, 'M')}
        {tool('laser', 'Laser pointer', <LaserIcon />, 'K')}
      </div>

      {showSwatches && (
        <>
          <span className="od-separator" aria-hidden="true" />
          <div className="od-group od-swatches" role="radiogroup" aria-label="Colour">
            {swatches.map((swatch) => (
              <button
                key={swatch.value}
                type="button"
                role="radio"
                className="od-swatch"
                aria-checked={props.color.toLowerCase() === swatch.value}
                aria-label={swatch.name}
                title={swatch.name}
                style={{ ['--swatch' as string]: swatch.value }}
                onClick={() => props.onColor(swatch.value)}
              />
            ))}
          </div>
        </>
      )}

      <span className="od-separator" aria-hidden="true" />
      <div className="od-group">
        <button
          type="button"
          className="od-button"
          aria-pressed={props.boardOn}
          title="Whiteboard: hide the screen behind a blank canvas"
          aria-label="Whiteboard"
          onClick={props.onToggleBoard}
        >
          <BoardIcon />
        </button>
        {props.viewMoved && (
          <button
            type="button"
            className="od-button"
            title="Re-align the canvas with the screen"
            aria-label="Re-align canvas"
            onClick={props.onResetView}
          >
            <RecenterIcon />
          </button>
        )}
        <button
          type="button"
          className="od-button"
          title={withShortcut('Screenshot with annotations', props.screenshotShortcut)}
          aria-label="Screenshot"
          onClick={props.onScreenshot}
        >
          <CameraIcon />
        </button>
        <button
          type="button"
          className="od-button"
          title="Clear this screen (undo with Ctrl+Z)"
          aria-label="Clear"
          disabled={!props.hasInk}
          onClick={props.onClear}
        >
          <TrashIcon />
        </button>
        <button type="button" className="od-button" title="Settings" aria-label="Settings" onClick={props.onSettings}>
          <GearIcon />
        </button>
      </div>

      <span className="od-separator" aria-hidden="true" />
      <button type="button" className="od-done" title="Stop drawing (Esc)" onClick={props.onDone}>
        <CheckIcon />
        <span>Done</span>
      </button>
    </div>
  )
}

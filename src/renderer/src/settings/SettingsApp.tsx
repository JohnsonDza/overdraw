import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { SettingsBridge } from '@shared/bridge'
import type { SettingsSnapshot } from '@shared/ipc'
import { HOTKEY_ACTIONS, HOTKEY_LABELS, type BooleanSettingKey, type HotkeyAction } from '@shared/settings'
import { ShortcutField } from './ShortcutField'
import { Switch } from './Switch'

function Section({ title, footer, children }: { title: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="section" aria-label={title}>
      <h2 className="section-title">{title}</h2>
      <div className="group">{children}</div>
      {footer && <p className="section-footer">{footer}</p>}
    </section>
  )
}

function Row({ title, detail, htmlFor, children }: { title: string; detail?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="row">
      <div className="row-text">
        <label className="row-title" htmlFor={htmlFor}>
          {title}
        </label>
        {detail && <span className="row-detail">{detail}</span>}
      </div>
      <div className="row-control">{children}</div>
    </div>
  )
}

const TOGGLES: { key: BooleanSettingKey; title: string; detail: string }[] = [
  {
    key: 'keepInkVisible',
    title: 'Keep ink on screen',
    detail: 'After you finish drawing, annotations stay visible and clicks pass through to your apps.'
  },
  {
    key: 'lockViewport',
    title: 'Pin canvas to screen',
    detail: 'The scroll wheel won’t pan or zoom the canvas, so ink stays aligned with what’s under it.'
  },
  { key: 'dimWhileDrawing', title: 'Dim screen while drawing', detail: 'Makes ink easier to see on busy screens.' },
  { key: 'showControlBar', title: 'Show control bar', detail: 'Quick tools, colours and Done at the bottom of the screen.' },
  {
    key: 'keepAppFocused',
    title: 'Keep the app underneath focused',
    detail:
      'For games and players that pause when they lose focus. Your keys keep going to that app, so pick tools from the toolbar and finish with Done or your Draw shortcut instead of Esc.'
  }
]

/** Shown instead of a blank window while settings load, or if loading fails. */
export function SettingsNotice({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return (
    <div className="window">
      <header className="titlebar">
        <span className="titlebar-title">Overdraw</span>
      </header>
      <main className="content notice" role="status">
        <h1 className="large-title">{title}</h1>
        {detail && <p className="notice-detail">{detail}</p>}
        {action}
      </main>
    </div>
  )
}

export function SettingsApp({ bridge }: { bridge: SettingsBridge }) {
  const [snapshot, setSnapshot] = useState<SettingsSnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoadError(null)
    bridge.get().then(setSnapshot, (error: unknown) => {
      setLoadError(error instanceof Error ? error.message : String(error))
    })
  }, [bridge])

  useEffect(() => {
    load()
    return bridge.onChange(setSnapshot)
  }, [bridge, load])

  const onRecordingChange = useCallback((recording: boolean) => bridge.suspendHotkeys(recording), [bridge])

  if (!snapshot) {
    return loadError ? (
      <SettingsNotice
        title="Settings didn’t load"
        detail={`Overdraw couldn’t read its settings: ${loadError}`}
        action={
          <button type="button" className="button" onClick={load}>
            Try Again
          </button>
        }
      />
    ) : (
      <SettingsNotice title="Settings" detail="Loading…" />
    )
  }
  const { settings, hotkeyStatus } = snapshot

  const setHotkey = (action: HotkeyAction, accelerator: string): void => {
    void bridge.update({ hotkeys: { [action]: accelerator } }).then(setSnapshot)
  }
  const setToggle = (key: BooleanSettingKey, value: boolean): void => {
    void bridge.update({ [key]: value }).then(setSnapshot)
  }

  return (
    <div className="window">
      <header className="titlebar">
        <span className="titlebar-title">Overdraw</span>
      </header>

      <main className="content">
        <h1 className="large-title">Settings</h1>

        <Section title="Shortcuts" footer="Shortcuts work everywhere, even while another app is in focus.">
          {HOTKEY_ACTIONS.map((action) => (
            <Row key={action} title={HOTKEY_LABELS[action].title} detail={HOTKEY_LABELS[action].detail}>
              <ShortcutField
                label={HOTKEY_LABELS[action].title}
                value={settings.hotkeys[action]}
                status={hotkeyStatus[action]}
                onChange={(value) => setHotkey(action, value)}
                onRecordingChange={onRecordingChange}
              />
            </Row>
          ))}
        </Section>

        <Section
          title="Drawing"
          footer="While drawing, press Esc to finish. Every Excalidraw shortcut works too: R rectangle, A arrow, T text, E eraser."
        >
          {TOGGLES.map(({ key, title, detail }) => (
            <Row key={key} title={title} detail={detail} htmlFor={key}>
              <Switch id={key} checked={settings[key]} onChange={(value) => setToggle(key, value)} />
            </Row>
          ))}
        </Section>

        <Section title="Screenshots">
          <Row title="Copy to clipboard" detail="Paste straight into chat, docs or an issue." htmlFor="clipboard">
            <Switch
              id="clipboard"
              checked={settings.screenshotToClipboard}
              onChange={(value) => setToggle('screenshotToClipboard', value)}
            />
          </Row>
          <Row title="Saved to" detail={snapshot.screenshotFolder}>
            <button type="button" className="button" onClick={() => bridge.openFolder('screenshots')}>
              Show Folder
            </button>
          </Row>
        </Section>

        <Section
          title="General"
          footer={snapshot.launchAtLoginAvailable ? undefined : 'Not available while running with npm run dev. Start Overdraw with npm start instead.'}
        >
          <Row title="Launch at login" detail="Start Overdraw in the tray when you sign in to Windows." htmlFor="login">
            <Switch
              id="login"
              checked={snapshot.launchAtLogin}
              disabled={!snapshot.launchAtLoginAvailable}
              onChange={(value) => void bridge.setLaunchAtLogin(value).then(setSnapshot)}
            />
          </Row>
        </Section>

        <footer className="page-footer">
          <span>Overdraw {snapshot.version} · Drawing engine by Excalidraw</span>
          <span className="page-footer-actions">
            <button type="button" className="link" onClick={() => bridge.openFolder('licenses')}>
              Third-Party Licenses
            </button>
            <button type="button" className="link" onClick={() => bridge.openFolder('settings')}>
              Open Settings Folder
            </button>
            <button type="button" className="link" onClick={() => void bridge.reset().then(setSnapshot)}>
              Restore Defaults
            </button>
          </span>
        </footer>
      </main>
    </div>
  )
}

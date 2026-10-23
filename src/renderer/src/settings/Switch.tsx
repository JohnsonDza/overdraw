interface Props {
  id: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

export function Switch({ id, checked, disabled, onChange }: Props) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      className="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-thumb" />
    </button>
  )
}

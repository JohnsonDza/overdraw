import type { SVGProps } from 'react'

/** Line icons on a 20 pt grid, 1.6 pt strokes, round joins (SF Symbols style). */
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    />
  )
}

export const PenIcon = () => (
  <Icon>
    <path d="M13.6 3.4a1.9 1.9 0 0 1 2.7 2.7l-9 9-3.6.9.9-3.6 9-9Z" />
    <path d="m12.2 4.8 2.7 2.7" />
  </Icon>
)

export const MarkerIcon = () => (
  <Icon>
    <path d="m11.5 3.5 5 5-6.2 6.2H6.8l-1.4-1.4V9.8l6.1-6.3Z" />
    <path d="m5.4 13.3-2.4 2.4 1.3 1.3h3.1" />
  </Icon>
)

export const LaserIcon = () => (
  <Icon>
    <circle cx="10" cy="10" r="2.2" fill="currentColor" stroke="none" />
    <path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" />
  </Icon>
)

export const BoardIcon = () => (
  <Icon>
    <rect x="2.75" y="4" width="14.5" height="10.5" rx="2" />
    <path d="M7 17.25h6M10 14.5v2.75" />
  </Icon>
)

export const CameraIcon = () => (
  <Icon>
    <path d="M3 7.2c0-1 .8-1.7 1.7-1.7h1.8l1.3-1.9h4.4l1.3 1.9h1.8c1 0 1.7.8 1.7 1.7v7.1c0 1-.8 1.7-1.7 1.7H4.7c-1 0-1.7-.8-1.7-1.7V7.2Z" />
    <circle cx="10" cy="10.6" r="2.8" />
  </Icon>
)

export const TrashIcon = () => (
  <Icon>
    <path d="M3.5 5.5h13M8 5.5V3.8c0-.4.4-.8.8-.8h2.4c.4 0 .8.4.8.8v1.7M5.2 5.5l.7 10.2c.1.7.7 1.3 1.4 1.3h5.4c.7 0 1.3-.6 1.4-1.3l.7-10.2" />
    <path d="M8.5 8.5v5.5M11.5 8.5v5.5" />
  </Icon>
)

export const RecenterIcon = () => (
  <Icon>
    <path d="M3 7V4.5C3 3.7 3.7 3 4.5 3H7M13 3h2.5c.8 0 1.5.7 1.5 1.5V7M17 13v2.5c0 .8-.7 1.5-1.5 1.5H13M7 17H4.5c-.8 0-1.5-.7-1.5-1.5V13" />
    <circle cx="10" cy="10" r="2" />
  </Icon>
)

export const GearIcon = () => (
  <Icon>
    <circle cx="10" cy="10" r="2.5" />
    <path d="M10 2.5v2M10 15.5v2M17.5 10h-2M4.5 10h-2M15.3 4.7l-1.4 1.4M6.1 13.9l-1.4 1.4M15.3 15.3l-1.4-1.4M6.1 6.1 4.7 4.7" />
  </Icon>
)

export const CheckIcon = () => (
  <Icon strokeWidth="2">
    <path d="m4.5 10.5 3.5 3.5 7.5-8" />
  </Icon>
)

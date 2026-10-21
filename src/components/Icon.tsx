import type { MediaType } from '../lib/types'

/** Jeu d'icônes au trait (24×24), repris du POC. */
export const ICONS = {
  lib: 'M5 4v16 M9.5 4v16 M14 5l4.5 15 M3 20h18',
  soir: 'M3 7h18v3a2 2 0 0 0 0 4v3H3v-3a2 2 0 0 0 0-4z M15 7v2 M15 11v2 M15 15v2',
  pile: 'M4 16h16v4H4z M5 11h14v5H5z M7 6h10v5H7z',
  sorties: 'M4 6h16v14H4z M4 10h16 M8 3v5 M16 3v5',
  pourtoi: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M15.5 8.5l-2 5-5 2 2-5z',
  reglages: 'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 5v4 M9 15v4',
  film: 'M4 5h16v14H4z M8 5v14 M16 5v14 M4 9.5h4 M4 14.5h4 M16 9.5h4 M16 14.5h4',
  serie: 'M3 7h18v12H3z M8 3l4 4 4-4',
  jeu: 'M7 8h10a4 4 0 0 1 4 4v2a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.8A3 3 0 0 1 3 14v-2a4 4 0 0 1 4-4z M8 10.5v3 M6.5 12h3 M16 11h.01 M17.5 13h.01',
  livre: 'M12 6c-2-1.5-5-2-8-1.5V19c3-.5 6 0 8 1.5 M12 6c2-1.5 5-2 8-1.5V19c-3-.5-6 0-8 1.5 M12 6v14.5',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 4l9 16H3z M12 10v4 M12 17h.01',
  info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z M12 11v5 M12 8h.01',
  wifi: 'M2 9a15 15 0 0 1 20 0 M5.5 12.5a10 10 0 0 1 13 0 M9 16a5 5 0 0 1 6 0 M12 19.5h.01 M3 3l18 18',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14z M16.5 16.5L20 20',
  close: 'M6 6l12 12M18 6L6 18',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7 M20 4v7h-7',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13',
  external: 'M14 4h6v6 M20 4l-9 9 M18 14v6H4V6h6',
  play: 'M7 4l13 8-13 8z',
} as const

export type IconName = keyof typeof ICONS

export function Icon({
  name,
  size = 18,
  stroke = 1.7,
  fill = 'none',
  className,
  style,
}: {
  name: IconName | MediaType
  size?: number
  stroke?: number
  fill?: string
  className?: string
  style?: React.CSSProperties
}) {
  const solid = name === 'play'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={solid ? 'currentColor' : fill}
      stroke={solid ? 'none' : 'currentColor'}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden
    >
      <path d={ICONS[name]} />
    </svg>
  )
}

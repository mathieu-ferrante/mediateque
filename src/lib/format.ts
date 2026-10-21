import type { Item } from './types'

export function duration(min: number | null | undefined): string {
  if (!min || min <= 0) return ''
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h >= 24) return `${h} h`
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

export function hours(min: number): string {
  const h = Math.round(min / 60)
  return `${h.toLocaleString('fr-FR')} h`
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export function frDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

export function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso.slice(0, 10))
  const b = Date.parse(toIso.slice(0, 10))
  return Math.round((b - a) / 86_400_000)
}

export const todayIso = () => new Date().toISOString().slice(0, 10)

export function relativeDays(iso: string, today = todayIso()): string {
  const d = daysBetween(today, iso)
  if (d === 0) return "aujourd'hui"
  if (d === 1) return 'demain'
  if (d === -1) return 'hier'
  if (d > 0) return d < 60 ? `dans ${d} jours` : `dans ${Math.round(d / 30)} mois`
  return -d < 60 ? `il y a ${-d} jours` : `il y a ${Math.round(-d / 30)} mois`
}

/** Temps estimé pour finir un élément (minutes). Livres : ~1,2 min par page. */
export function estimatedMinutes(it: Pick<Item, 'type' | 'runtime_min' | 'total_min' | 'pages'>): number | null {
  if (it.total_min) return it.total_min
  if (it.type === 'film' && it.runtime_min) return it.runtime_min
  if (it.type === 'livre' && it.pages) return Math.round(it.pages * 1.2)
  return null
}

/** Valeurs par défaut quand on ne connaît pas la durée. */
export const DEFAULT_MIN: Record<Item['type'], number> = { film: 110, serie: 45 * 10, jeu: 20 * 60, livre: 300 * 1.2 }

export function subtitle(it: Item): string {
  const parts: string[] = []
  if (it.year) parts.push(String(it.year))
  if (it.type === 'film' && it.runtime_min) parts.push(duration(it.runtime_min))
  if (it.type === 'serie' && it.seasons) parts.push(`${it.seasons} saison${it.seasons > 1 ? 's' : ''}`)
  if (it.type === 'jeu' && it.total_min) parts.push(`~${duration(it.total_min)}`)
  if (it.type === 'livre' && it.pages) parts.push(`${it.pages} p.`)
  if (it.creator) parts.push(it.creator)
  return parts.join(' · ')
}

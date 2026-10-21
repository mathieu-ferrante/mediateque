import { DEFAULT_MIN, estimatedMinutes, todayIso } from './format'
import type { Item, MediaType } from './types'
import { TYPES } from './types'

export interface TypeStats {
  type: MediaType
  count: number
  minutes: number
  unknownDuration: number
}

export interface BacklogStats {
  byType: TypeStats[]
  totalCount: number
  totalMinutes: number
  addedLast90: number
  finishedLast90: number
  finishedMinutesLast90: number
  /** mois pour vider la pile au rythme des 90 derniers jours (null si aucun fini) */
  monthsToClear: number | null
  oldest: Item[]
}

/** Temps restant estimé : pour une série en cours on retire la part déjà vue si on connaît SxEy. */
export function remainingMinutes(it: Item): { min: number; known: boolean } {
  const est = estimatedMinutes(it)
  const known = est != null
  let min = est ?? DEFAULT_MIN[it.type]
  if (it.status === 'en_cours') {
    const m = it.progress?.match(/S(\d+)\s*E(\d+)/i)
    if (it.type === 'serie' && m && it.seasons && it.episodes && it.runtime_min) {
      const perSeason = it.episodes / it.seasons
      const seen = (Number(m[1]) - 1) * perSeason + Number(m[2])
      min = Math.max(0, (it.episodes - seen) * it.runtime_min)
    } else if (it.type === 'livre' && it.pages) {
      const p = it.progress?.match(/(\d+)/)
      if (p) min = Math.max(0, (it.pages - Number(p[1])) * 1.2)
    } else {
      min = min / 2 // à défaut : on suppose la moitié faite
    }
  }
  return { min: Math.round(min), known }
}

export function backlogStats(items: Item[], now = Date.now()): BacklogStats {
  const pile = items.filter((i) => i.status === 'a_voir' || i.status === 'en_cours')
  const byType = TYPES.map((type) => {
    const list = pile.filter((i) => i.type === type)
    let minutes = 0
    let unknownDuration = 0
    for (const it of list) {
      const r = remainingMinutes(it)
      minutes += r.min
      if (!r.known) unknownDuration++
    }
    return { type, count: list.length, minutes, unknownDuration }
  })
  const since = now - 90 * 86_400_000
  const finished = items.filter((i) => i.status === 'termine' && i.finished_at && Date.parse(i.finished_at) >= since)
  const finishedMinutesLast90 = finished.reduce((a, i) => a + (estimatedMinutes(i) ?? DEFAULT_MIN[i.type]), 0)
  const totalMinutes = byType.reduce((a, t) => a + t.minutes, 0)
  return {
    byType,
    totalCount: pile.length,
    totalMinutes,
    addedLast90: items.filter((i) => Date.parse(i.added_at) >= since).length,
    finishedLast90: finished.length,
    finishedMinutesLast90,
    monthsToClear: finishedMinutesLast90 > 0 ? (totalMinutes / finishedMinutesLast90) * 3 : null,
    oldest: pile.filter((i) => i.status === 'a_voir').sort((a, b) => a.added_at.localeCompare(b.added_at)).slice(0, 6),
  }
}

// ---------- Sorties ----------

export interface Releases {
  upcoming: Item[]
  recent: Item[]
}

/** Prochaines sorties des titres suivis + ce qui est sorti ces 14 derniers jours. */
export function releases(items: Item[], today = todayIso()): Releases {
  const tracked = items.filter((i) => i.status !== 'abandonne' && i.next_release_date)
  const upcoming = tracked
    .filter((i) => i.next_release_date! >= today)
    .sort((a, b) => a.next_release_date!.localeCompare(b.next_release_date!))
  const cutoff = new Date(Date.parse(today) - 14 * 86_400_000).toISOString().slice(0, 10)
  const recent = tracked
    .filter((i) => i.next_release_date! < today && i.next_release_date! >= cutoff)
    .sort((a, b) => b.next_release_date!.localeCompare(a.next_release_date!))
  return { upcoming, recent }
}

/** Titres à rafraîchir auprès des sources (séries suivies, sorties à venir, fiches anciennes). */
export function needsRefresh(items: Item[], now = Date.now()): Item[] {
  const today = new Date(now).toISOString().slice(0, 10)
  return items.filter((i) => {
    if (i.source !== 'tmdb' && i.source !== 'igdb') return false
    if (i.status === 'abandonne') return false
    const age = i.refreshed_at ? now - Date.parse(i.refreshed_at) : Infinity
    if (age < 20 * 3600_000) return false
    if (i.type === 'serie' && i.media_status !== 'Ended' && i.media_status !== 'Canceled') return true
    if (i.status === 'attendu') return true
    if (i.next_release_date && i.next_release_date >= today) return true
    if (i.release_date && i.release_date > today) return true
    return false
  })
}

// ---------- Progression d'un titre en cours ----------

export interface ProgressInfo {
  pct: number | null
  label: string
  right: string
}

function hoursLeft(min: number): string {
  if (min < 60) return `≈ ${Math.max(5, Math.round(min / 5) * 5)} min restantes`
  return `≈ ${Math.round(min / 60)} h restantes`
}

export function progressInfo(it: Item): ProgressInfo | null {
  if (it.status !== 'en_cours') return null
  const p = it.progress?.trim() ?? ''
  const se = p.match(/S(\d+)\s*E(\d+)/i)
  if (it.type === 'serie' && se && it.seasons && it.episodes) {
    const seen = Math.min(it.episodes, (Number(se[1]) - 1) * (it.episodes / it.seasons) + Number(se[2]))
    const left = Math.max(0, Math.round(it.episodes - seen))
    return { pct: seen / it.episodes, label: `S${se[1]}E${se[2]}`, right: `${left} ép. restant${left > 1 ? 's' : ''}` }
  }
  if (it.type === 'livre' && it.pages) {
    const m = p.match(/(\d+)/)
    if (m) {
      const page = Math.min(it.pages, Number(m[1]))
      return { pct: page / it.pages, label: `Page ${page}`, right: hoursLeft((it.pages - page) * 1.2) }
    }
  }
  const pc = p.match(/(\d+)\s*%/)
  if (pc) {
    const pct = Math.min(100, Number(pc[1])) / 100
    const tot = estimatedMinutes(it)
    return { pct, label: p, right: tot ? hoursLeft(tot * (1 - pct)) : '' }
  }
  const h = p.match(/(\d+)\s*h/i)
  if (it.type === 'jeu' && h && it.total_min) {
    const played = Number(h[1]) * 60
    return { pct: Math.min(1, played / it.total_min), label: p, right: hoursLeft(Math.max(0, it.total_min - played)) }
  }
  if (!p) return null
  const r = remainingMinutes(it)
  return { pct: null, label: p, right: r.min ? hoursLeft(r.min) : '' }
}

// ---------- Ajoutés / terminés par mois (3 derniers mois) ----------

const MONTHS_SHORT = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

export function lastMonths(items: Item[], n = 3, now = new Date()): { label: string; added: number; done: number }[] {
  const out: { label: string; added: number; done: number }[] = []
  for (let k = n - 1; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    out.push({
      label: MONTHS_SHORT[d.getMonth()],
      added: items.filter((i) => i.added_at.slice(0, 7) === key).length,
      done: items.filter((i) => i.status === 'termine' && i.finished_at?.slice(0, 7) === key).length,
    })
  }
  return out
}

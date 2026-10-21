import { DEFAULT_MIN } from './format'
import type { Item, MediaType } from './types'

export type Mood = 'detente' | 'frisson' | 'action' | 'emotion' | 'reflexion' | 'evasion'

export const MOODS: { id: Mood; label: string; icon: string }[] = [
  { id: 'detente', label: 'Détente, rire', icon: '😄' },
  { id: 'frisson', label: 'Frisson, suspense', icon: '😱' },
  { id: 'action', label: 'Action', icon: '💥' },
  { id: 'emotion', label: 'Émotion', icon: '🥲' },
  { id: 'reflexion', label: 'Réfléchir', icon: '🧠' },
  { id: 'evasion', label: 'Évasion, aventure', icon: '🌌' },
]

/** Mots-clés (sans accents, en minuscules) cherchés dans les genres TMDB / IGDB / livres. */
const MOOD_KEYWORDS: Record<Mood, string[]> = {
  detente: ['comedie', 'comedy', 'familial', 'family', 'animation', 'kids', 'humou', 'humor', 'platform', 'puzzle',
    'simulat', 'arcade', 'sport', 'racing', 'music', 'party', 'quiz', 'comics', 'bande dessinee', 'manga'],
  frisson: ['horreur', 'horror', 'thriller', 'mystere', 'mystery', 'crime', 'policier', 'suspense', 'detective', 'survival'],
  action: ['action', 'guerre', 'war', 'western', 'shooter', 'fighting', 'hack and slash', 'racing', 'combat', 'espionnage'],
  emotion: ['drame', 'drama', 'romance', 'romantique', 'visual novel', 'point-and-click', 'roman', 'literary', 'biograph'],
  reflexion: ['documentaire', 'documentary', 'histoire', 'history', 'politic', 'strategy', 'strategie', 'puzzle',
    'tactical', 'tbs', 'rts', 'philosoph', 'science', 'essai', 'business', 'psycholog'],
  evasion: ['aventure', 'adventure', 'fantastique', 'fantasy', 'science-fiction', 'science fiction', 'sci-fi',
    'role-playing', 'rpg', 'animation', 'mmorpg', 'open world'],
}

export const norm = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function matchesMood(it: Pick<Item, 'genres'>, mood: Mood): boolean {
  const g = it.genres.map(norm)
  return MOOD_KEYWORDS[mood].some((k) => g.some((x) => x.includes(k)))
}

// ---------- Affinité : ce que tu notes bien ----------

export interface Affinity {
  mean: number
  byGenre: Map<string, { avg: number; n: number }>
}

export function computeAffinity(items: Item[]): Affinity {
  const rated = items.filter((i) => i.rating != null)
  const mean = rated.length ? rated.reduce((a, i) => a + i.rating!, 0) / rated.length : 7
  const acc = new Map<string, { sum: number; n: number }>()
  for (const it of rated) {
    for (const g of new Set(it.genres.map(norm))) {
      const a = acc.get(g) ?? { sum: 0, n: 0 }
      a.sum += it.rating!
      a.n++
      acc.set(g, a)
    }
  }
  const byGenre = new Map<string, { avg: number; n: number }>()
  for (const [g, a] of acc) byGenre.set(g, { avg: a.sum / a.n, n: a.n })
  return { mean, byGenre }
}

/** Entre -1 (genres que tu notes mal) et +1 (genres que tu adores). 0 si inconnu. */
export function affinityScore(it: Pick<Item, 'genres'>, aff: Affinity): number {
  const vals: number[] = []
  for (const g of it.genres.map(norm)) {
    const s = aff.byGenre.get(g)
    if (!s) continue
    const confidence = Math.min(1, s.n / 3)
    vals.push(((s.avg - aff.mean) / 3) * confidence)
  }
  if (!vals.length) return 0
  const v = vals.reduce((a, b) => a + b, 0) / vals.length
  return Math.max(-1, Math.min(1, v))
}

// ---------- "Ce soir je fais quoi ?" ----------

export interface PickOptions {
  time: number | null // minutes dispo, null = peu importe
  mood: Mood | null
  types: MediaType[]
  exclude?: string[]
  /** pour les tests : remplace Math.random */
  random?: () => number
}

export interface Candidate {
  item: Item
  score: number
  reasons: string[]
}

function sessionMinutes(it: Item): number {
  if (it.type === 'film') return it.runtime_min ?? DEFAULT_MIN.film
  if (it.type === 'serie') return it.runtime_min ?? 45
  if (it.type === 'jeu') return 60
  return 30
}

export function scoreCandidates(items: Item[], opts: PickOptions, now = Date.now()): Candidate[] {
  const aff = computeAffinity(items)
  const out: Candidate[] = []
  for (const it of items) {
    if (it.status !== 'a_voir' && it.status !== 'en_cours') continue
    if (!opts.types.includes(it.type)) continue
    if (opts.exclude?.includes(it.id)) continue
    if (it.next_release_date && it.next_release_date > new Date(now).toISOString().slice(0, 10) && it.status === 'a_voir' && it.type !== 'serie') continue

    const reasons: string[] = []
    let score = 1

    // Temps disponible
    if (opts.time != null) {
      const need = sessionMinutes(it)
      if (it.type === 'film' && need > opts.time + 10) continue
      if (it.type === 'serie' && need > opts.time + 5) continue
      if (it.type === 'jeu' && opts.time < 45) score *= 0.5
      if (it.type === 'film' || it.type === 'serie') {
        const fit = need / opts.time
        if (fit > 0.6) {
          score += 1
          reasons.push(it.type === 'film' ? `${need} min, ça tient pile` : `épisodes de ${need} min`)
        }
        if (it.type === 'serie' && opts.time >= need * 2) reasons.push(`${Math.floor(opts.time / need)} épisodes possibles`)
      }
    }

    // Humeur
    if (opts.mood) {
      if (matchesMood(it, opts.mood)) {
        score += 3
        reasons.push('colle à ton humeur')
      } else {
        score *= 0.25
      }
    }

    // Déjà commencé : on pousse à finir
    if (it.status === 'en_cours') {
      score += 2
      reasons.push(it.progress ? `déjà commencé (${it.progress})` : 'déjà commencé')
    }

    // Tes goûts
    const a = affinityScore(it, aff)
    if (a > 0.15) reasons.push('dans les genres que tu notes bien')
    score += a * 1.5

    // Ce qui traîne depuis longtemps remonte un peu
    const ageDays = (now - Date.parse(it.added_at)) / 86_400_000
    if (ageDays > 180) {
      score += 0.5
      reasons.push(`dans ta pile depuis ${Math.round(ageDays / 30)} mois`)
    }
    if (it.favorite) score += 0.5

    out.push({ item: it, score: Math.max(0.05, score), reasons })
  }
  return out.sort((a, b) => b.score - a.score)
}

/** Tirage pondéré : les meilleurs candidats ont plus de chances, mais pas toujours le même. */
export function pickTonight(items: Item[], opts: PickOptions): Candidate | null {
  const cands = scoreCandidates(items, opts).slice(0, 12)
  if (!cands.length) return null
  const rnd = opts.random ?? Math.random
  const weights = cands.map((c) => c.score * c.score)
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rnd() * total
  for (let i = 0; i < cands.length; i++) {
    r -= weights[i]
    if (r <= 0) return cands[i]
  }
  return cands[cands.length - 1]
}

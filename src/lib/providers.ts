import { supabase } from './supabase'
import type { Item, MediaInfo, MediaType } from './types'
import { emptyInfo } from './types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any

async function callMedia<T>(body: Record<string, unknown>): Promise<T> {
  if (!supabase) {
    throw new Error(
      'En mode démo, la recherche de films, séries et jeux est désactivée (elle passe par ta base Supabase). ' +
        'Les livres fonctionnent, et tu peux ajouter une fiche à la main.',
    )
  }
  const { data, error } = await supabase.functions.invoke('media', { body })
  if (error) {
    let msg = error.message
    try {
      const ctx = await (error as Json).context?.json?.()
      if (ctx?.error) msg = ctx.error
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  if (data?.error) throw new Error(data.error)
  return data as T
}

// ---------- Livres (appel direct depuis le navigateur, pas de clé) ----------

export function normGoogleBook(v: Json): MediaInfo {
  const i = v.volumeInfo ?? {}
  const img: string | undefined = i.imageLinks?.thumbnail ?? i.imageLinks?.smallThumbnail
  const date: string | undefined = i.publishedDate
  return {
    ...emptyInfo('livre', i.subtitle ? `${i.title} : ${i.subtitle}` : (i.title ?? '')),
    year: date && /^\d{4}/.test(date) ? Number(date.slice(0, 4)) : null,
    poster_url: img ? img.replace(/^http:/, 'https:').replace('&edge=curl', '') : null,
    overview: i.description ?? null,
    genres: (i.categories ?? []).flatMap((c: string) => c.split(' / ')).slice(0, 4),
    creator: (i.authors ?? []).slice(0, 2).join(', ') || null,
    pages: i.pageCount || null,
    source: 'gbooks',
    source_id: String(v.id),
    release_date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
  }
}

export function normOpenLibrary(d: Json): MediaInfo {
  return {
    ...emptyInfo('livre', d.title ?? ''),
    year: d.first_publish_year ?? null,
    poster_url: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
    genres: (d.subject ?? []).slice(0, 4),
    creator: (d.author_name ?? []).slice(0, 2).join(', ') || null,
    pages: d.number_of_pages_median ?? null,
    source: 'openlibrary',
    source_id: String(d.key ?? '').replace('/works/', ''),
  }
}

async function searchBooks(q: string): Promise<MediaInfo[]> {
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=15&printType=books&langRestrict=fr`,
    )
    if (res.ok) {
      const data = await res.json()
      let items: MediaInfo[] = (data.items ?? []).map(normGoogleBook)
      if (items.length < 3) {
        // pas assez de résultats en français : on élargit à toutes les langues
        const r2 = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=15&printType=books`)
        if (r2.ok) items = items.concat(((await r2.json()).items ?? []).map(normGoogleBook))
      }
      if (items.length) return dedupeBooks(items)
    }
  } catch {
    /* on bascule sur Open Library */
  }
  const res = await fetch(
    `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=12&fields=key,title,author_name,first_publish_year,cover_i,number_of_pages_median,subject`,
  ).catch(() => {
    throw new Error('Recherche de livres injoignable (pas de connexion, ou aperçu qui bloque les sites externes).')
  })
  if (!res.ok) throw new Error(`Recherche de livres indisponible (${res.status})`)
  return ((await res.json()).docs ?? []).map(normOpenLibrary)
}

function dedupeBooks(list: MediaInfo[]): MediaInfo[] {
  const seen = new Set<string>()
  return list.filter((b) => {
    const k = `${b.title.toLowerCase()}|${(b.creator ?? '').toLowerCase()}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ---------- API publique ----------

export async function searchMedia(type: MediaType, q: string): Promise<MediaInfo[]> {
  if (!q.trim()) return []
  if (type === 'livre') return searchBooks(q)
  return callMedia<MediaInfo[]>({ action: 'search', type, q })
}

/** Fiche complète (durée, créateur, prochain épisode...). Pour les livres, la recherche suffit. */
export async function mediaDetails(info: MediaInfo): Promise<MediaInfo> {
  if (info.type === 'livre' || !['tmdb', 'igdb'].includes(info.source)) return info
  return callMedia<MediaInfo>({ action: 'details', type: info.type, id: info.source_id })
}

export function canRefresh(it: Item): boolean {
  return !!supabase && (it.source === 'tmdb' || it.source === 'igdb') && !!it.source_id
}

export async function refreshMany(items: Item[]): Promise<MediaInfo[]> {
  const list = items.filter(canRefresh).map((i) => ({ type: i.type, source_id: i.source_id }))
  if (!list.length) return []
  const out: MediaInfo[] = []
  for (let i = 0; i < list.length; i += 60) {
    out.push(...(await callMedia<MediaInfo[]>({ action: 'refresh', items: list.slice(i, i + 60) })))
  }
  return out
}

/** Champs "source" à recopier lors d'une mise à jour (on ne touche pas aux notes/avis perso). */
export function sourceFields(m: MediaInfo): Partial<Item> {
  return {
    title: m.title,
    original_title: m.original_title,
    year: m.year,
    poster_url: m.poster_url,
    overview: m.overview,
    genres: m.genres,
    creator: m.creator,
    platforms: m.platforms,
    runtime_min: m.runtime_min,
    total_min: m.total_min,
    pages: m.pages,
    seasons: m.seasons,
    episodes: m.episodes,
    release_date: m.release_date,
    next_release_date: m.next_release_date,
    next_release_label: m.next_release_label,
    media_status: m.media_status,
    refreshed_at: new Date().toISOString(),
  }
}

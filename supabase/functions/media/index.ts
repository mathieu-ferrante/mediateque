// Fonction "media" : recherche et fiches détaillées pour films/séries (TMDB) et jeux (IGDB).
// Les clés restent côté serveur (secrets Supabase) : TMDB_TOKEN, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET.
// Fichier unique et autonome : peut être collé tel quel dans l'éditeur de fonctions de Supabase.

export type MediaType = 'film' | 'serie' | 'jeu' | 'livre'

export interface MediaInfo {
  type: MediaType
  title: string
  original_title: string | null
  year: number | null
  poster_url: string | null
  overview: string | null
  genres: string[]
  creator: string | null
  platforms: string[]
  runtime_min: number | null
  total_min: number | null
  pages: number | null
  seasons: number | null
  episodes: number | null
  source: string
  source_id: string
  release_date: string | null
  next_release_date: string | null
  next_release_label: string | null
  media_status: string | null
}

// ---------- TMDB ----------

const TMDB_IMG = 'https://image.tmdb.org/t/p/w342'

export const TMDB_GENRES: Record<number, string> = {
  28: 'Action', 12: 'Aventure', 16: 'Animation', 35: 'Comédie', 80: 'Crime', 99: 'Documentaire',
  18: 'Drame', 10751: 'Familial', 14: 'Fantastique', 36: 'Histoire', 27: 'Horreur', 10402: 'Musique',
  9648: 'Mystère', 10749: 'Romance', 878: 'Science-Fiction', 10770: 'Téléfilm', 53: 'Thriller',
  10752: 'Guerre', 37: 'Western', 10759: 'Action & Aventure', 10762: 'Kids', 10763: 'News',
  10764: 'Reality', 10765: 'Science-Fiction & Fantastique', 10766: 'Soap', 10767: 'Talk',
  10768: 'War & Politics',
}

const yearOf = (d?: string | null) => (d && /^\d{4}/.test(d) ? Number(d.slice(0, 4)) : null)
const dateOrNull = (d?: string | null) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null)

const FR_MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export function frDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} ${FR_MONTHS[m - 1]} ${y}`
}

// deno-lint-ignore no-explicit-any
type Json = any

export function normTmdbSearch(r: Json, type: 'film' | 'serie'): MediaInfo {
  const date = type === 'film' ? r.release_date : r.first_air_date
  return {
    type,
    title: (type === 'film' ? r.title : r.name) ?? '',
    original_title: (type === 'film' ? r.original_title : r.original_name) ?? null,
    year: yearOf(date),
    poster_url: r.poster_path ? TMDB_IMG + r.poster_path : null,
    overview: r.overview || null,
    genres: (r.genre_ids ?? []).map((g: number) => TMDB_GENRES[g]).filter(Boolean),
    creator: null,
    platforms: [],
    runtime_min: null,
    total_min: null,
    pages: null,
    seasons: null,
    episodes: null,
    source: 'tmdb',
    source_id: String(r.id),
    release_date: dateOrNull(date),
    next_release_date: null,
    next_release_label: null,
    media_status: null,
  }
}

export function normTmdbMovie(r: Json, today = new Date().toISOString().slice(0, 10)): MediaInfo {
  const base = normTmdbSearch({ ...r, genre_ids: [] }, 'film')
  const directors = (r.credits?.crew ?? []).filter((c: Json) => c.job === 'Director').map((c: Json) => c.name)
  const rel = dateOrNull(r.release_date)
  const upcoming = rel && rel > today
  return {
    ...base,
    genres: (r.genres ?? []).map((g: Json) => g.name),
    creator: directors.slice(0, 2).join(', ') || null,
    runtime_min: r.runtime || null,
    total_min: r.runtime || null,
    media_status: r.status ?? null,
    next_release_date: upcoming ? rel : null,
    next_release_label: upcoming ? `Sortie le ${frDate(rel!)}` : null,
  }
}

export function normTmdbTv(r: Json): MediaInfo {
  const base = normTmdbSearch({ ...r, genre_ids: [] }, 'serie')
  const epRuntime: number | null =
    (r.episode_run_time && r.episode_run_time.length ? r.episode_run_time[0] : null) ??
    r.last_episode_to_air?.runtime ?? null
  const next = r.next_episode_to_air
  const nextDate = dateOrNull(next?.air_date)
  let label: string | null = null
  if (nextDate) {
    const isPremiere = next.episode_number === 1
    label = isPremiere
      ? `Saison ${next.season_number} le ${frDate(nextDate)}`
      : `S${next.season_number}E${next.episode_number} le ${frDate(nextDate)}`
  }
  return {
    ...base,
    genres: (r.genres ?? []).map((g: Json) => g.name),
    creator: (r.created_by ?? []).map((c: Json) => c.name).slice(0, 2).join(', ') || null,
    runtime_min: epRuntime,
    total_min: epRuntime && r.number_of_episodes ? epRuntime * r.number_of_episodes : null,
    seasons: r.number_of_seasons ?? null,
    episodes: r.number_of_episodes ?? null,
    media_status: r.status ?? null,
    next_release_date: nextDate,
    next_release_label: label,
  }
}

async function tmdb(path: string, token: string): Promise<Json> {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`https://api.themoviedb.org/3${path}${sep}language=fr-FR`, {
    headers: { Authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`TMDB ${res.status}`)
  return res.json()
}

// ---------- IGDB ----------

const igdbCover = (id?: string) => (id ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${id}.jpg` : null)

export function normIgdbGame(g: Json, ttb?: Json, today = new Date().toISOString().slice(0, 10)): MediaInfo {
  const rel = g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null
  const upcoming = rel && rel > today
  const devs = (g.involved_companies ?? []).filter((c: Json) => c.developer).map((c: Json) => c.company?.name)
  const secs: number | null = ttb ? (ttb.normally ?? ttb.hastily ?? ttb.completely ?? null) : null
  return {
    type: 'jeu',
    title: g.name ?? '',
    original_title: null,
    year: yearOf(rel),
    poster_url: igdbCover(g.cover?.image_id),
    overview: g.summary || null,
    genres: (g.genres ?? []).map((x: Json) => x.name),
    creator: devs.filter(Boolean).slice(0, 2).join(', ') || null,
    platforms: (g.platforms ?? []).map((p: Json) => p.abbreviation || p.name).filter(Boolean),
    runtime_min: null,
    total_min: secs ? Math.round(secs / 60) : null,
    pages: null,
    seasons: null,
    episodes: null,
    source: 'igdb',
    source_id: String(g.id),
    release_date: rel,
    next_release_date: upcoming ? rel : null,
    next_release_label: upcoming ? `Sortie le ${frDate(rel!)}` : null,
    media_status: null,
  }
}

let twitchToken: { value: string; exp: number } | null = null

async function igdb(endpoint: string, body: string, env: Env): Promise<Json[]> {
  if (!twitchToken || twitchToken.exp < Date.now() + 60_000) {
    const url =
      `https://id.twitch.tv/oauth2/token?client_id=${env.TWITCH_CLIENT_ID}` +
      `&client_secret=${env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`
    const res = await fetch(url, { method: 'POST' })
    if (!res.ok) throw new Error(`Twitch ${res.status}`)
    const t = await res.json()
    twitchToken = { value: t.access_token, exp: Date.now() + t.expires_in * 1000 }
  }
  const res = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: 'POST',
    headers: { 'Client-ID': env.TWITCH_CLIENT_ID!, Authorization: `Bearer ${twitchToken.value}` },
    body,
  })
  if (!res.ok) throw new Error(`IGDB ${res.status}`)
  return res.json()
}

const IGDB_FIELDS =
  'fields name,first_release_date,cover.image_id,genres.name,summary,platforms.abbreviation,platforms.name,' +
  'involved_companies.developer,involved_companies.company.name;'

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')

// ---------- Actions ----------

interface Env {
  TMDB_TOKEN?: string
  TWITCH_CLIENT_ID?: string
  TWITCH_CLIENT_SECRET?: string
}

async function search(type: MediaType, q: string, env: Env): Promise<MediaInfo[]> {
  if (type === 'film' || type === 'serie') {
    if (!env.TMDB_TOKEN) throw new Error('Clé TMDB manquante (secret TMDB_TOKEN)')
    const kind = type === 'film' ? 'movie' : 'tv'
    const data = await tmdb(`/search/${kind}?query=${encodeURIComponent(q)}&include_adult=false`, env.TMDB_TOKEN)
    return (data.results ?? []).slice(0, 12).map((r: Json) => normTmdbSearch(r, type))
  }
  if (type === 'jeu') {
    if (!env.TWITCH_CLIENT_ID || !env.TWITCH_CLIENT_SECRET) throw new Error('Clés Twitch/IGDB manquantes')
    const games = await igdb('games', `search "${esc(q)}"; ${IGDB_FIELDS} limit 12;`, env)
    return games.map((g) => normIgdbGame(g))
  }
  throw new Error(`Type non géré côté serveur : ${type}`)
}

async function details(type: MediaType, id: string, env: Env): Promise<MediaInfo> {
  if (!/^\d+$/.test(id)) throw new Error('Identifiant invalide')
  if (type === 'film') {
    return normTmdbMovie(await tmdb(`/movie/${id}?append_to_response=credits`, env.TMDB_TOKEN!))
  }
  if (type === 'serie') {
    return normTmdbTv(await tmdb(`/tv/${id}`, env.TMDB_TOKEN!))
  }
  if (type === 'jeu') {
    const [g] = await igdb('games', `${IGDB_FIELDS} where id = ${id};`, env)
    if (!g) throw new Error('Jeu introuvable')
    let ttb: Json | undefined
    try {
      ;[ttb] = await igdb('game_time_to_beats', `fields hastily,normally,completely; where game_id = ${id};`, env)
    } catch {
      /* durée facultative */
    }
    return normIgdbGame(g, ttb)
  }
  throw new Error(`Type non géré côté serveur : ${type}`)
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

export async function handle(req: Request, env: Env): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const body = await req.json()
    const { action } = body
    if (action === 'search') return json(await search(body.type, String(body.q ?? '').slice(0, 200), env))
    if (action === 'details') return json(await details(body.type, String(body.id), env))
    if (action === 'refresh') {
      const list: { type: MediaType; source_id: string }[] = (body.items ?? []).slice(0, 60)
      const out: MediaInfo[] = []
      // 4 requêtes en parallèle max, pour rester poli avec les API
      for (let i = 0; i < list.length; i += 4) {
        const chunk = await Promise.allSettled(list.slice(i, i + 4).map((it) => details(it.type, it.source_id, env)))
        for (const r of chunk) if (r.status === 'fulfilled') out.push(r.value)
      }
      return json(out)
    }
    if (action === 'status') {
      return json({ tmdb: !!env.TMDB_TOKEN, igdb: !!(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET) })
    }
    return json({ error: 'Action inconnue' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
}

// Démarrage dans Supabase (Deno). Ignoré quand le fichier est importé par les tests.
// deno-lint-ignore no-explicit-any
const D = (globalThis as any).Deno
if (D?.serve) {
  D.serve((req: Request) =>
    handle(req, {
      TMDB_TOKEN: D.env.get('TMDB_TOKEN'),
      TWITCH_CLIENT_ID: D.env.get('TWITCH_CLIENT_ID'),
      TWITCH_CLIENT_SECRET: D.env.get('TWITCH_CLIENT_SECRET'),
    }),
  )
}

import { describe, expect, it, vi, afterEach } from 'vitest'
import { handle, normIgdbGame, normTmdbMovie, normTmdbSearch, normTmdbTv } from '../supabase/functions/media/index'
import { normGoogleBook, normOpenLibrary } from '../src/lib/providers'
import { matchesMood, pickTonight, scoreCandidates, computeAffinity, affinityScore } from '../src/lib/picker'
import { backlogStats, needsRefresh, releases, remainingMinutes } from '../src/lib/stats'
import { buildPrompt, parseSuggestions } from '../src/lib/ollama'
import { statusSideEffects } from '../src/lib/store'
import { emptyInfo, type Item } from '../src/lib/types'
import { duration, relativeDays } from '../src/lib/format'

function item(p: Partial<Item>): Item {
  return {
    ...emptyInfo(p.type ?? 'film', p.title ?? 'X'),
    id: p.id ?? Math.random().toString(36),
    status: 'a_voir',
    rating: null,
    review: null,
    progress: null,
    favorite: false,
    added_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    started_at: null,
    finished_at: null,
    refreshed_at: null,
    ...p,
  } as Item
}

describe('normalisation TMDB / IGDB', () => {
  it('résultat de recherche film', () => {
    const m = normTmdbSearch({ id: 438631, title: 'Dune', original_title: 'Dune', release_date: '2021-09-15', poster_path: '/a.jpg', genre_ids: [878, 12] }, 'film')
    expect(m).toMatchObject({ title: 'Dune', year: 2021, source: 'tmdb', source_id: '438631', genres: ['Science-Fiction', 'Aventure'] })
    expect(m.poster_url).toBe('https://image.tmdb.org/t/p/w342/a.jpg')
  })
  it('film à venir → date de sortie suivie', () => {
    const m = normTmdbMovie({ id: 1, title: 'Futur', release_date: '2027-03-10', runtime: 130, genres: [{ name: 'Drame' }], credits: { crew: [{ job: 'Director', name: 'A. Réal' }] } }, '2026-10-21')
    expect(m.next_release_date).toBe('2027-03-10')
    expect(m.next_release_label).toBe('Sortie le 10 mars 2027')
    expect(m.creator).toBe('A. Réal')
    expect(m.runtime_min).toBe(130)
  })
  it('série avec prochain épisode et nouvelle saison', () => {
    const tv = { id: 2, name: 'Série', first_air_date: '2020-01-01', episode_run_time: [45], number_of_seasons: 3, number_of_episodes: 30, status: 'Returning Series', genres: [], created_by: [{ name: 'X' }] }
    expect(normTmdbTv({ ...tv, next_episode_to_air: { air_date: '2026-11-02', season_number: 3, episode_number: 4 } }).next_release_label).toBe('S3E4 le 2 nov. 2026')
    const s4 = normTmdbTv({ ...tv, next_episode_to_air: { air_date: '2027-01-15', season_number: 4, episode_number: 1 } })
    expect(s4.next_release_label).toBe('Saison 4 le 15 janv. 2027')
    expect(s4.total_min).toBe(1350)
  })
  it('série sans episode_run_time utilise le dernier épisode', () => {
    expect(normTmdbTv({ id: 3, name: 'S', episode_run_time: [], last_episode_to_air: { runtime: 52 }, genres: [] }).runtime_min).toBe(52)
  })
  it('jeu IGDB + durée pour le finir', () => {
    const g = normIgdbGame(
      { id: 7, name: 'Jeu', first_release_date: 1700000000, cover: { image_id: 'co1' }, genres: [{ name: 'Adventure' }], platforms: [{ abbreviation: 'PC' }], involved_companies: [{ developer: true, company: { name: 'Studio' } }, { developer: false, company: { name: 'Éditeur' } }] },
      { normally: 36000 },
    )
    expect(g).toMatchObject({ title: 'Jeu', year: 2023, total_min: 600, creator: 'Studio', platforms: ['PC'], source: 'igdb', source_id: '7' })
    expect(g.poster_url).toContain('co1.jpg')
  })
  it('livres Google Books / Open Library', () => {
    const b = normGoogleBook({ id: 'abc', volumeInfo: { title: 'Livre', authors: ['Auteur'], publishedDate: '2019-05-01', pageCount: 320, categories: ['Fiction / Fantasy'], imageLinks: { thumbnail: 'http://books.google.com/x&edge=curl' } } })
    expect(b).toMatchObject({ type: 'livre', year: 2019, pages: 320, creator: 'Auteur', genres: ['Fiction', 'Fantasy'], poster_url: 'https://books.google.com/x' })
    const o = normOpenLibrary({ key: '/works/OL1W', title: 'L', author_name: ['A'], first_publish_year: 2001, cover_i: 9 })
    expect(o).toMatchObject({ source: 'openlibrary', source_id: 'OL1W', year: 2001 })
  })
})

describe('fonction edge', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('recherche film via TMDB (clé en en-tête, langue fr)', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ results: [{ id: 1, title: 'Alien', release_date: '1979-05-25', genre_ids: [27] }] })))
    vi.stubGlobal('fetch', fetchMock)
    const res = await handle(new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'search', type: 'film', q: 'alien' }) }), { TMDB_TOKEN: 'tok' })
    const data = await res.json()
    expect(data[0]).toMatchObject({ title: 'Alien', genres: ['Horreur'] })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('/search/movie?query=alien')
    expect(url).toContain('language=fr-FR')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })
  it('erreur claire si clé manquante', async () => {
    const res = await handle(new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'search', type: 'jeu', q: 'zelda' }) }), {})
    expect(res.status).toBe(500)
    expect((await res.json()).error).toMatch(/Twitch/)
  })
  it('recherche jeu : jeton Twitch puis IGDB', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('twitch')) return new Response(JSON.stringify({ access_token: 'T', expires_in: 3600 }))
      return new Response(JSON.stringify([{ id: 5, name: 'Zelda' }]))
    })
    vi.stubGlobal('fetch', fetchMock)
    const res = await handle(new Request('http://x', { method: 'POST', body: JSON.stringify({ action: 'search', type: 'jeu', q: 'zel"da' }) }), { TWITCH_CLIENT_ID: 'c', TWITCH_CLIENT_SECRET: 's' })
    expect((await res.json())[0].title).toBe('Zelda')
    const body = (fetchMock.mock.calls[1] as unknown as [string, RequestInit])[1].body as string
    expect(body).toContain('search "zel\\"da"')
  })
  it('CORS preflight', async () => {
    const res = await handle(new Request('http://x', { method: 'OPTIONS' }), {})
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

describe('Ce soir je fais quoi', () => {
  const pile = [
    item({ id: 'long', type: 'film', title: 'Long', runtime_min: 180, genres: ['Drame'] }),
    item({ id: 'comedie', type: 'film', title: 'Comédie', runtime_min: 95, genres: ['Comédie'] }),
    item({ id: 'serie', type: 'serie', title: 'Série', runtime_min: 30, genres: ['Comédie'], status: 'en_cours', progress: 'S1E3' }),
    item({ id: 'vu', type: 'film', title: 'Vu', runtime_min: 90, status: 'termine', rating: 9, genres: ['Comédie'] }),
    item({ id: 'livre', type: 'livre', title: 'Livre', genres: ['Fantasy'] }),
  ]
  it('respecte le temps dispo et exclut ce qui est terminé', () => {
    const ids = scoreCandidates(pile, { time: 120, mood: null, types: ['film', 'serie'] }).map((c) => c.item.id)
    expect(ids).not.toContain('long')
    expect(ids).not.toContain('vu')
    expect(ids).toContain('comedie')
  })
  it("l'humeur et les séries en cours remontent", () => {
    const c = scoreCandidates(pile, { time: 120, mood: 'detente', types: ['film', 'serie'] })
    expect(c[0].item.id).toBe('serie')
    expect(c[0].reasons.join(' ')).toMatch(/humeur/)
  })
  it('exclusion pour "autre chose"', () => {
    const p = pickTonight(pile, { time: 120, mood: null, types: ['film', 'serie'], exclude: ['serie'], random: () => 0 })
    expect(p?.item.id).toBe('comedie')
  })
  it('null si rien ne correspond', () => {
    expect(pickTonight(pile, { time: 30, mood: null, types: ['film'] })).toBeNull()
  })
  it('humeur reconnue sur genres IGDB en anglais', () => {
    expect(matchesMood({ genres: ['Role-playing (RPG)'] }, 'evasion')).toBe(true)
    expect(matchesMood({ genres: ['Comédie'] }, 'frisson')).toBe(false)
  })
  it('affinité : genre bien noté > genre mal noté', () => {
    const rated = [
      item({ genres: ['Horreur'], rating: 9, status: 'termine' }),
      item({ genres: ['Horreur'], rating: 8, status: 'termine' }),
      item({ genres: ['Romance'], rating: 3, status: 'termine' }),
      item({ genres: ['Romance'], rating: 4, status: 'termine' }),
    ]
    const aff = computeAffinity(rated)
    expect(affinityScore({ genres: ['Horreur'] }, aff)).toBeGreaterThan(0)
    expect(affinityScore({ genres: ['Romance'] }, aff)).toBeLessThan(0)
    expect(affinityScore({ genres: ['Western'] }, aff)).toBe(0)
  })
})

describe('pile, sorties, rafraîchissement', () => {
  it('temps restant série en cours depuis SxEy', () => {
    const s = item({ type: 'serie', status: 'en_cours', progress: 'S2E5', seasons: 2, episodes: 20, runtime_min: 40, total_min: 800 })
    expect(remainingMinutes(s).min).toBe(5 * 40)
  })
  it('temps restant livre depuis la page', () => {
    expect(remainingMinutes(item({ type: 'livre', status: 'en_cours', progress: 'page 100', pages: 300 })).min).toBe(240)
  })
  it('statistiques de pile et rythme', () => {
    const now = Date.now()
    const st = backlogStats(
      [
        item({ type: 'film', runtime_min: 120 }),
        item({ type: 'film', runtime_min: 60, status: 'termine', finished_at: new Date(now - 86400000).toISOString() }),
      ],
      now,
    )
    expect(st.totalCount).toBe(1)
    expect(st.totalMinutes).toBe(120)
    expect(st.monthsToClear).toBeCloseTo(6)
  })
  it('sorties à venir / récentes', () => {
    const r = releases(
      [
        item({ id: 'a', next_release_date: '2026-11-01' }),
        item({ id: 'b', next_release_date: '2026-10-15' }),
        item({ id: 'c', next_release_date: '2026-01-01' }),
        item({ id: 'd', next_release_date: '2026-11-01', status: 'abandonne' }),
      ],
      '2026-10-21',
    )
    expect(r.upcoming.map((i) => i.id)).toEqual(['a'])
    expect(r.recent.map((i) => i.id)).toEqual(['b'])
  })
  it('ne rafraîchit que ce qui est utile', () => {
    const now = Date.parse('2026-10-21T12:00:00Z')
    const list = [
      item({ id: 'serie', type: 'serie', source: 'tmdb', source_id: '1', media_status: 'Returning Series' }),
      item({ id: 'finie', type: 'serie', source: 'tmdb', source_id: '2', media_status: 'Ended' }),
      item({ id: 'recent', type: 'serie', source: 'tmdb', source_id: '3', refreshed_at: '2026-10-21T08:00:00Z' }),
      item({ id: 'filmFutur', type: 'film', source: 'tmdb', source_id: '4', release_date: '2027-01-01' }),
      item({ id: 'livre', type: 'livre', source: 'gbooks', source_id: '5' }),
    ]
    expect(needsRefresh(list, now).map((i) => i.id)).toEqual(['serie', 'filmFutur'])
  })
})

describe('IA Ollama', () => {
  const lib = [item({ title: 'Alien', rating: 9, genres: ['Horreur'], status: 'termine' })]
  it('prompt contient les goûts', () => {
    const p = buildPrompt(lib, 'film', 'frisson')
    expect(p).toContain('Alien')
    expect(p).toContain('Frisson')
  })
  it('filtre les titres déjà présents et les mauvais types', () => {
    const s = parseSuggestions(
      JSON.stringify({ suggestions: [{ titre: 'alien', type: 'film', raison: 'x' }, { titre: 'The Thing', annee: 1982, type: 'film', raison: 'Horreur culte' }, { titre: 'Jeu', type: 'jeu', raison: '' }] }),
      lib,
      'film',
    )
    expect(s.map((x) => x.titre)).toEqual(['The Thing'])
  })
  it('tolère du texte autour du JSON', () => {
    expect(parseSuggestions('Voici : {"suggestions":[{"titre":"X","type":"livre","raison":"r"}]} bonne lecture', [], 'tout')).toHaveLength(1)
  })
})

describe('divers', () => {
  it('dates automatiques selon le statut', () => {
    const p = statusSideEffects(undefined, { status: 'termine' })
    expect(p.finished_at).toBeTruthy()
    expect(p.started_at).toBeTruthy()
    expect(statusSideEffects(item({ status: 'termine' }), { status: 'a_voir' }).finished_at).toBeNull()
  })
  it('formats', () => {
    expect(duration(95)).toBe('1 h 35')
    expect(duration(45)).toBe('45 min')
    expect(relativeDays('2026-10-22', '2026-10-21')).toBe('demain')
    expect(relativeDays('2026-10-31', '2026-10-21')).toBe('dans 10 jours')
  })
})

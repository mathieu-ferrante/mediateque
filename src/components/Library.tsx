import { useMemo, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { norm } from '../lib/picker'
import { STATUS_GENERIC, TYPES, TYPE_PLURAL, type MediaType, type Status } from '../lib/types'
import { Card } from './Card'
import { Icon } from './Icon'

type Sort = 'recent' | 'ancien' | 'note' | 'titre' | 'annee'

const SORTS: { id: Sort; label: string }[] = [
  { id: 'recent', label: 'Ajout récent' },
  { id: 'ancien', label: 'Plus ancien dans la pile' },
  { id: 'note', label: 'Note' },
  { id: 'titre', label: 'Titre' },
  { id: 'annee', label: 'Année' },
]
const STATUS_FILTERS: (Status | 'all')[] = ['all', 'a_voir', 'en_cours', 'termine', 'abandonne', 'attendu']

export function Library({ onAdd }: { onAdd: () => void }) {
  const { items, loading } = useApp()
  const [type, setType] = useState<MediaType | 'all'>('all')
  const [status, setStatus] = useState<Status | 'all'>('all')
  const [genre, setGenre] = useState('')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<Sort>('recent')
  const [favOnly, setFavOnly] = useState(false)

  const genres = useMemo(() => {
    const m = new Map<string, number>()
    for (const i of items) if (type === 'all' || i.type === type) for (const g of i.genres) m.set(g, (m.get(g) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([g]) => g)
  }, [items, type])

  const list = useMemo(() => {
    const nq = norm(q.trim())
    const out = items.filter(
      (i) =>
        (type === 'all' || i.type === type) &&
        (status === 'all' || i.status === status) &&
        (!genre || i.genres.includes(genre)) &&
        (!favOnly || i.favorite) &&
        (!nq || norm(`${i.title} ${i.original_title ?? ''} ${i.creator ?? ''}`).includes(nq)),
    )
    const cmp: Record<Sort, (a: (typeof out)[0], b: (typeof out)[0]) => number> = {
      recent: (a, b) => b.added_at.localeCompare(a.added_at),
      ancien: (a, b) => a.added_at.localeCompare(b.added_at),
      note: (a, b) => (b.rating ?? -1) - (a.rating ?? -1),
      titre: (a, b) => a.title.localeCompare(b.title, 'fr'),
      annee: (a, b) => (b.year ?? 0) - (a.year ?? 0),
    }
    return out.sort(cmp[sort])
  }, [items, type, status, genre, q, sort, favOnly])

  const byType = (t: MediaType | 'all') => (t === 'all' ? items : items.filter((i) => i.type === t))
  const scoped = byType(type)

  const reset = () => {
    setType('all')
    setStatus('all')
    setGenre('')
    setQ('')
    setFavOnly(false)
  }

  return (
    <>
      <div className="lib-head">
        <div className="title">
          <h1 className="h1">Bibliothèque</h1>
          <span className="mono ink2" style={{ fontSize: 12 }}>
            {items.length} titre{items.length > 1 ? 's' : ''}
          </span>
        </div>
        <div className="lib-ctrls">
          <label className="searchbox">
            <Icon name="search" size={17} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher dans tes titres" aria-label="Chercher dans tes titres" />
          </label>
          <label className="selectbox">
            <span className="ink2">Tri</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="filters">
        <div className="chips">
          {(['all', ...TYPES] as const).map((t) => (
            <button
              key={t}
              className={`chip disp ${t !== 'all' ? `ty-${t}` : ''}`}
              aria-pressed={type === t}
              onClick={() => {
                setType(t)
                setGenre('')
              }}
            >
              {t !== 'all' && <span className="dot" style={{ background: 'var(--tc)' }} />}
              {t === 'all' ? 'Tout' : TYPE_PLURAL[t]}
              <span className="n">{byType(t).length}</span>
            </button>
          ))}
        </div>
        <div className="filters-row">
          {STATUS_FILTERS.map((s) => (
            <button key={s} className="tab-chip" aria-pressed={status === s} onClick={() => setStatus(s)}>
              {s === 'all' ? 'Tous statuts' : s === 'a_voir' ? 'À voir' : STATUS_GENERIC[s]}
              {s !== 'all' && <span className="n">{scoped.filter((i) => i.status === s).length}</span>}
            </button>
          ))}
          <span className="spacer" />
          <button className="chip" aria-pressed={favOnly} onClick={() => setFavOnly(!favOnly)}>
            <Icon name="heart" size={15} stroke={1.8} fill={favOnly ? 'currentColor' : 'none'} />
            Favoris
          </button>
          {genres.length > 0 && (
            <label className="selectbox thin">
              <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre">
                <option value="">Tous les genres</option>
                {genres.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid" aria-busy="true">
          {Array.from({ length: 8 }, (_, k) => (
            <div key={k} className="skel">
              <div style={{ aspectRatio: '2/3' }} />
              <div style={{ height: 14, width: '80%' }} />
              <div style={{ height: 10, width: '50%' }} />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="empty">
          <div className="empty-jq">
            <div className="jq-strip" />
            <div className="jq-strip" />
          </div>
          <h2 className="disp" style={{ fontSize: 40, lineHeight: 0.9 }}>
            Ta bibliothèque est vide
          </h2>
          <p>Ajoute un film, une série, un jeu ou un livre. Tape son nom : l’affiche, l’année et la durée se remplissent seules.</p>
          <button className="btn-acc" onClick={onAdd}>
            <Icon name="plus" size={18} stroke={2.2} />
            Ajouter un titre
            <span className="kbd">N</span>
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="empty" style={{ padding: '40px 0', gap: 10 }}>
          <h2 className="disp" style={{ fontSize: 32 }}>
            Aucun titre avec ces filtres
          </h2>
          <p>Enlève un filtre ou vérifie l’orthographe de ta recherche.</p>
          <button className="btn" onClick={reset}>
            Effacer les filtres
          </button>
        </div>
      ) : (
        <div className="grid">
          {list.map((i) => (
            <Card key={i.id} item={i} />
          ))}
        </div>
      )}
    </>
  )
}

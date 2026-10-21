import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { todayIso } from '../lib/format'
import { mediaDetails, searchMedia } from '../lib/providers'
import { sameMedia } from '../lib/store'
import { DONE_LABEL, emptyInfo, statusLabel, TYPES, TYPE_LABEL, type MediaInfo, type MediaType, type Status } from '../lib/types'
import { Icon } from './Icon'
import { Thumb } from './Poster'

const PH: Record<MediaType, string> = {
  film: 'Nom du film',
  serie: 'Nom de la série',
  jeu: 'Nom du jeu',
  livre: 'Titre ou auteur du livre',
}

export function AddDialog({ onClose, initial }: { onClose: () => void; initial?: { type: MediaType; q: string } }) {
  const { items, add, openItem } = useApp()
  const [type, setType] = useState<MediaType>(initial?.type ?? 'film')
  const [q, setQ] = useState(initial?.q ?? '')
  const [results, setResults] = useState<MediaInfo[]>([])
  const [busy, setBusy] = useState(false)
  const [searched, setSearched] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)
  const [manual, setManual] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const reqId = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => inputRef.current?.focus(), [type, manual])

  useEffect(() => {
    const query = q.trim()
    if (query.length < 2) {
      setResults([])
      setErr(null)
      setSearched('')
      return
    }
    const id = ++reqId.current
    const t = setTimeout(async () => {
      setBusy(true)
      setErr(null)
      try {
        const r = await searchMedia(type, query)
        if (id === reqId.current) {
          setResults(r)
          setSearched(query)
        }
      } catch (e) {
        if (id === reqId.current) {
          setResults([])
          setErr(e instanceof Error ? e.message : String(e))
        }
      } finally {
        if (id === reqId.current) setBusy(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [q, type])

  async function doAdd(r: MediaInfo, status: Status) {
    const key = `${r.source}:${r.source_id}`
    setAdding(key)
    let info = r
    try {
      info = await mediaDetails(r)
    } catch {
      /* on garde les infos de la recherche */
    }
    await add({ ...info, status })
    setAdding(null)
  }

  const defaultStatus = (r: MediaInfo): Status => (r.release_date && r.release_date > todayIso() ? 'attendu' : 'a_voir')

  return (
    <div className="modal-wrap" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Ajouter un titre">
        <div className="modal-head">
          <h2>{manual ? 'Ajouter à la main' : 'Ajouter un titre'}</h2>
          <span className="kbd ink2" style={{ borderColor: 'var(--line)' }}>
            Échap
          </span>
          <button className="icon-btn" style={{ color: 'var(--ink)' }} onClick={onClose} aria-label="Fermer">
            <Icon name="close" size={20} stroke={1.8} />
          </button>
        </div>
        <div className="modal-top">
          <div role="radiogroup" aria-label="Type" className="type-seg">
            {TYPES.map((t) => (
              <button key={t} role="radio" aria-checked={type === t} className={`ty-${t}`} onClick={() => setType(t)}>
                <Icon name={t} size={16} stroke={1.8} />
                {TYPE_LABEL[t]}
              </button>
            ))}
          </div>
          {!manual && (
            <label className="big-search">
              {busy ? <span className="spinner" style={{ width: 17, height: 17 }} /> : <Icon name="search" size={19} stroke={1.8} />}
              <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder={PH[type]} aria-label="Nom du titre" />
            </label>
          )}
        </div>

        <div className="modal-body">
          {manual ? (
            <ManualForm type={type} initialTitle={q} onDone={onClose} />
          ) : (
            <>
              {results.map((r) => {
                const existing = items.find((i) => sameMedia(i, r))
                const key = `${r.source}:${r.source_id}`
                const ds = defaultStatus(r)
                return (
                  <div className="result" key={key}>
                    <Thumb url={r.poster_url} type={r.type} large />
                    <div className="row-main">
                      <span style={{ fontWeight: 600, fontSize: 17, lineHeight: 1.2 }}>
                        {r.title}{' '}
                        {r.year && (
                          <span className="mono ink2" style={{ fontSize: 12, fontWeight: 400 }}>
                            {r.year}
                          </span>
                        )}
                      </span>
                      <span className="meta">{[r.creator, r.genres.slice(0, 3).join(', '), r.pages ? `${r.pages} p.` : ''].filter(Boolean).join(' · ')}</span>
                      {r.overview && <span className="clamp">{r.overview}</span>}
                    </div>
                    <div className="result-actions">
                      {existing ? (
                        <button
                          className="already"
                          onClick={() => {
                            openItem(existing.id)
                            onClose()
                          }}
                        >
                          <Icon name="check" size={15} stroke={2} />
                          Déjà là
                        </button>
                      ) : (
                        <>
                          <button className="btn-acc xs" disabled={adding === key} onClick={() => doAdd(r, ds)}>
                            {adding === key ? 'Ajout…' : `+ ${statusLabel(r.type, ds)}`}
                          </button>
                          {ds !== 'attendu' && (
                            <button className="btn sm" disabled={adding === key} onClick={() => doAdd(r, 'termine')}>
                              {DONE_LABEL[r.type]}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )
              })}
              {err && (
                <div className="msg err">
                  <span className="t">La recherche n’a pas abouti.</span>
                  <span className="d">{err}</span>
                </div>
              )}
              {!err && !busy && searched && results.length === 0 && (
                <div className="msg">
                  <span className="t">Aucun résultat pour « {searched} ».</span>
                  <span className="d">Vérifie l’orthographe, change de type, ou ajoute-le à la main.</span>
                </div>
              )}
              {!q.trim() && (
                <div className="msg">
                  <span className="d">Tape au moins deux lettres. L’affiche, l’année et la durée se remplissent seules.</span>
                </div>
              )}
            </>
          )}
        </div>

        {!manual && (
          <div className="modal-foot">
            <span className="sub">Pas dans la liste ?</span>
            <button className="link-btn" onClick={() => setManual(true)}>
              Ajouter à la main
            </button>
          </div>
        )}
        {manual && (
          <div className="modal-foot">
            <button className="link-btn muted" onClick={() => setManual(false)}>
              Retour à la recherche
            </button>
            <span className="spacer" />
            <button className="btn-acc sm" type="submit" form="manual-form">
              Ajouter
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ManualForm({ type, initialTitle, onDone }: { type: MediaType; initialTitle: string; onDone: () => void }) {
  const { add } = useApp()
  const [title, setTitle] = useState(initialTitle)
  const [year, setYear] = useState('')
  const [creator, setCreator] = useState('')
  const [genres, setGenres] = useState('')
  const [dur, setDur] = useState('')
  const [status, setStatus] = useState<Status>('a_voir')
  const [tried, setTried] = useState(false)
  const durLabel = { film: 'Durée (min)', serie: 'Durée d’un épisode (min)', jeu: 'Durée estimée (h)', livre: 'Pages' }[type]
  const byLabel = { film: 'Réalisation', serie: 'Création', jeu: 'Studio', livre: 'Auteur' }[type]
  const missing = tried && !title.trim()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTried(true)
    if (!title.trim()) return
    const n = Number(dur) || null
    const ok = await add({
      ...emptyInfo(type, title.trim()),
      year: Number(year) || null,
      creator: creator.trim() || null,
      genres: genres.split(',').map((g) => g.trim()).filter(Boolean),
      runtime_min: type === 'film' || type === 'serie' ? n : null,
      total_min: type === 'film' ? n : type === 'jeu' && n ? n * 60 : null,
      pages: type === 'livre' ? n : null,
      status,
    })
    if (ok) onDone()
  }

  return (
    <form id="manual-form" className="manual" onSubmit={submit}>
      <label className="field span2">
        <span className="label">Titre</span>
        <input className={`input on-bg ${missing ? 'err' : ''}`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        {missing && <span className="field-err">Le titre est obligatoire.</span>}
      </label>
      <label className="field">
        <span className="label">Année</span>
        <input className="input on-bg" value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" placeholder="2024" />
      </label>
      <label className="field">
        <span className="label">{durLabel}</span>
        <input className="input on-bg" value={dur} onChange={(e) => setDur(e.target.value)} inputMode="numeric" />
      </label>
      <label className="field">
        <span className="label">{byLabel}</span>
        <input className="input on-bg" value={creator} onChange={(e) => setCreator(e.target.value)} />
      </label>
      <label className="field">
        <span className="label">Genres</span>
        <input className="input on-bg" value={genres} onChange={(e) => setGenres(e.target.value)} placeholder="Drame, Aventure" />
      </label>
      <label className="field">
        <span className="label">Statut</span>
        <select className="input on-bg" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          {(['a_voir', 'en_cours', 'termine', 'attendu'] as Status[]).map((s) => (
            <option key={s} value={s}>
              {statusLabel(type, s)}
            </option>
          ))}
        </select>
      </label>
    </form>
  )
}

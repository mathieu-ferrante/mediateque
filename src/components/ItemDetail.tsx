import { useEffect, useRef, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { duration, frDate, relativeDays } from '../lib/format'
import { canRefresh, mediaDetails, sourceFields } from '../lib/providers'
import { remainingMinutes } from '../lib/stats'
import { STATUSES, statusLabel, TYPE_LABEL, type Item } from '../lib/types'
import { metaLine } from './Card'
import { Icon } from './Icon'
import { Poster } from './Poster'

const SOURCE: Record<string, { label: string; url: (it: Item) => string }> = {
  tmdb: { label: 'Voir sur TMDB', url: (it) => `https://www.themoviedb.org/${it.type === 'film' ? 'movie' : 'tv'}/${it.source_id}?language=fr-FR` },
  igdb: { label: 'Voir sur IGDB', url: (it) => `https://www.igdb.com/search?type=1&q=${encodeURIComponent(it.title)}` },
  gbooks: { label: 'Voir sur Google Books', url: (it) => `https://books.google.fr/books?id=${it.source_id}` },
  openlibrary: { label: 'Voir sur Open Library', url: (it) => `https://openlibrary.org/works/${it.source_id}` },
}
const PROD: Record<string, string> = {
  Ended: 'Terminée', 'Returning Series': 'En production', Canceled: 'Annulée', 'In Production': 'En production', Released: 'Sorti',
}
const WHERE_PH: Record<Item['type'], string> = { film: 'ex. 1 h 10', serie: 'ex. S2E5', jeu: 'ex. 22 h, chapitre 4 ou 60 %', livre: 'ex. page 120' }

export function ItemDetail() {
  const { items, openedId, openItem, update, remove, toast } = useApp()
  const it = items.find((i) => i.id === openedId)
  const [review, setReview] = useState('')
  const [progress, setProgress] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [sumOpen, setSumOpen] = useState(false)

  useEffect(() => {
    setReview(it?.review ?? '')
    setProgress(it?.progress ?? '')
    setConfirmDel(false)
    setSumOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [it?.id])

  const closeRef = useRef<() => void>(() => openItem(null))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!it) return null

  const save = () => {
    const patch: Partial<Item> = {}
    if ((review || null) !== it.review) patch.review = review || null
    if ((progress || null) !== it.progress) patch.progress = progress || null
    if (Object.keys(patch).length) update(it.id, patch)
  }
  const close = () => {
    save()
    openItem(null)
  }
  closeRef.current = close

  async function refresh() {
    if (!it) return
    setRefreshing(true)
    try {
      await update(it.id, sourceFields(await mediaDetails(it)))
      toast('Fiche mise à jour')
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), 'err')
    } finally {
      setRefreshing(false)
    }
  }

  const rem = it.status === 'en_cours' || it.status === 'a_voir' ? remainingMinutes(it) : null
  const infos: [string, string][] = []
  if (it.genres.length) infos.push(['Genres', it.genres.join(', ')])
  if (it.type === 'film' && it.runtime_min) infos.push(['Durée', duration(it.runtime_min)])
  if (it.type === 'serie' && it.seasons) infos.push(['Format', `${it.seasons} saison${it.seasons > 1 ? 's' : ''} · ${it.episodes ?? '?'} épisodes${it.runtime_min ? ` · ${it.runtime_min} min` : ''}`])
  if (it.type === 'jeu' && it.total_min) infos.push(['Pour le finir', `≈ ${Math.round(it.total_min / 60)} h`])
  if (it.type === 'jeu' && it.platforms.length) infos.push(['Plateformes', it.platforms.join(', ')])
  if (it.type === 'livre' && it.pages) infos.push(['Pages', String(it.pages)])
  if (rem && rem.min > 0) infos.push(['Reste', `≈ ${duration(rem.min)}${rem.known ? '' : ' (estimation)'}`])
  if (it.media_status && it.type === 'serie') infos.push(['Production', PROD[it.media_status] ?? it.media_status])
  const src = SOURCE[it.source]
  const sum = it.overview ?? ''
  const sumLong = sum.length > 280
  const dates = [`Ajouté le ${frDate(it.added_at)}`, it.status === 'termine' && it.finished_at ? `terminé le ${frDate(it.finished_at)}` : ''].filter(Boolean).join(' · ')

  return (
    <>
      <div className="backdrop" onClick={close} />
      <aside className={`panel ty-${it.type}`} role="dialog" aria-modal="true" aria-label={it.title}>
        <div className="panel-head">
          <Icon name={it.type} size={18} stroke={1.8} style={{ color: 'var(--tc)' }} />
          <span className="label">Fiche · {TYPE_LABEL[it.type]}</span>
          <button
            className="icon-btn"
            aria-pressed={it.favorite}
            aria-label="Favori"
            style={{ color: it.favorite ? '#E35D3F' : undefined }}
            onClick={() => update(it.id, { favorite: !it.favorite })}
          >
            <Icon name="heart" size={20} stroke={1.8} fill={it.favorite ? 'currentColor' : 'none'} />
          </button>
          <button className="icon-btn" aria-label="Fermer" style={{ color: 'var(--ink)' }} onClick={close}>
            <Icon name="close" size={20} stroke={1.8} />
          </button>
        </div>
        <div className="panel-body">
          <div className="d-top">
            <Poster url={it.poster_url} title={it.title} type={it.type} year={it.year} size="md" />
            <div className="d-info">
              <span className="meta" style={{ fontSize: 12 }}>
                {[TYPE_LABEL[it.type], metaLine(it)].filter(Boolean).join(' · ')}
              </span>
              <h2 className="d-title">{it.title}</h2>
              {it.original_title && it.original_title !== it.title && <span className="sub">Titre original : {it.original_title}</span>}
              {it.creator && <span style={{ fontSize: 15 }}>{it.creator}</span>}
            </div>
          </div>

          {it.next_release_date && (
            <div className="next-box">
              <Icon name="sorties" size={20} />
              <div>
                <span className="label" style={{ fontSize: 14, color: 'var(--acc)' }}>Prochaine sortie</span>
                <span className="mono">
                  {it.next_release_label ?? `Sortie le ${frDate(it.next_release_date)}`} · {relativeDays(it.next_release_date)}
                </span>
              </div>
            </div>
          )}

          <div className="field">
            <span className="label">Statut</span>
            <div role="radiogroup" aria-label="Statut" className="st-seg">
              {STATUSES.map((s) => (
                <button key={s} role="radio" aria-checked={it.status === s} className={`st-${s}`} onClick={() => update(it.id, { status: s })}>
                  {statusLabel(it.type, s)}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <div className="rate-head">
              <span className="label">Ma note</span>
              <span>
                <span className="mono" style={{ fontSize: 13, fontWeight: 500 }}>
                  {it.rating ? `${it.rating}/10` : 'Pas encore notée'}
                </span>
                {it.rating != null && (
                  <button className="link-btn muted" style={{ height: 32, fontSize: 14 }} onClick={() => update(it.id, { rating: null })}>
                    Effacer
                  </button>
                )}
              </span>
            </div>
            <div role="radiogroup" aria-label="Note sur 10" className="rate">
              {Array.from({ length: 10 }, (_, k) => k + 1).map((n) => (
                <button
                  key={n}
                  role="radio"
                  aria-checked={it.rating === n}
                  aria-label={`${n} sur 10`}
                  className={it.rating != null && n <= it.rating ? 'on' : ''}
                  onClick={() => update(it.id, { rating: n })}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <label className="field">
            <span className="label">Où j’en suis</span>
            <input className="input mono on-bg" value={progress} placeholder={WHERE_PH[it.type]} onChange={(e) => setProgress(e.target.value)} onBlur={save} />
          </label>
          <label className="field">
            <span className="label">Mon avis</span>
            <textarea className="input on-bg" rows={3} value={review} placeholder="Ce que tu en as pensé, en quelques mots" onChange={(e) => setReview(e.target.value)} onBlur={save} />
          </label>

          {infos.length > 0 && (
            <dl className="infos">
              {infos.map(([k, v]) => (
                <div key={k} style={{ display: 'contents' }}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}

          {sum && (
            <div className="field">
              <span className="label">Résumé</span>
              <p className="sum">{sumLong && !sumOpen ? `${sum.slice(0, 280).trimEnd()}…` : sum}</p>
              {sumLong && (
                <button className="link-btn" style={{ alignSelf: 'flex-start', height: 32, padding: 0, fontWeight: 600 }} aria-expanded={sumOpen} onClick={() => setSumOpen(!sumOpen)}>
                  {sumOpen ? 'Réduire' : 'Lire la suite'}
                </button>
              )}
            </div>
          )}

          <span className="mono ink2" style={{ fontSize: 12 }}>{dates}</span>

          {confirmDel && (
            <div className="confirm" role="alertdialog">
              <span style={{ fontWeight: 600 }}>Supprimer « {it.title} » de ta bibliothèque ?</span>
              <span className="sub">Ta note, ton avis et ta progression seront perdus.</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn danger-solid"
                  onClick={() => {
                    remove(it.id)
                    openItem(null)
                    toast(`« ${it.title} » supprimé`)
                  }}
                >
                  Supprimer
                </button>
                <button className="btn quiet" onClick={() => setConfirmDel(false)}>
                  Annuler
                </button>
              </div>
            </div>
          )}

          <div className="d-foot">
            {src && (
              <a href={src.url(it)} target="_blank" rel="noreferrer">
                {src.label}
                <Icon name="external" size={14} stroke={1.8} />
              </a>
            )}
            <span className="spacer" />
            {canRefresh(it) && (
              <button className="btn" onClick={refresh} disabled={refreshing}>
                <Icon name="refresh" size={15} stroke={2} />
                {refreshing ? 'Mise à jour…' : 'Mettre à jour'}
              </button>
            )}
            <button className="btn danger" onClick={() => setConfirmDel(true)}>
              <Icon name="trash" size={15} stroke={1.8} />
              Supprimer
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

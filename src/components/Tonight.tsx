import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { duration } from '../lib/format'
import { MOODS, pickTonight, scoreCandidates, type Candidate, type Mood } from '../lib/picker'
import { TYPES, TYPE_LABEL, TYPE_PLURAL, type MediaType } from '../lib/types'
import { metaLine } from './Card'
import { Icon } from './Icon'
import { Poster } from './Poster'

const TIMES: { v: number | null; label: string }[] = [
  { v: 30, label: '30 min' },
  { v: 60, label: '1 h' },
  { v: 90, label: '1 h 30' },
  { v: 120, label: '2 h' },
  { v: 180, label: '3 h et +' },
  { v: null, label: 'Peu importe' },
]
const MOOD_SHORT: Record<Mood, string> = {
  detente: 'Détente', frisson: 'Frisson', action: 'Action', emotion: 'Émotion', reflexion: 'Réfléchir', evasion: 'Évasion',
}

function nextTicketNumber(): number {
  try {
    const n = Number(localStorage.getItem('mediatheque.tickets') ?? '0') + 1
    localStorage.setItem('mediatheque.tickets', String(n))
    return n
  } catch {
    return Math.floor(Math.random() * 900) + 100
  }
}

const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

export function Tonight() {
  const { items, update, openItem } = useApp()
  const [time, setTime] = useState<number | null>(120)
  const [mood, setMood] = useState<Mood | null>(null)
  const [types, setTypes] = useState<MediaType[]>(['film', 'serie'])
  const [pick, setPick] = useState<Candidate | null>(null)
  const [phase, setPhase] = useState<'idle' | 'shuffle' | 'shown' | 'none'>('idle')
  const [shuffle, setShuffle] = useState('')
  const [num, setNum] = useState(0)
  const seen = useRef<string[]>([])
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])

  const cands = useMemo(() => scoreCandidates(items, { time, mood, types }), [items, time, mood, types])

  function draw(again: boolean) {
    timers.current.forEach((t) => clearTimeout(t))
    if (!again) seen.current = []
    else if (pick) seen.current.push(pick.item.id)
    let c = pickTonight(items, { time, mood, types, exclude: seen.current })
    if (!c && again) {
      seen.current = pick ? [pick.item.id] : []
      c = pickTonight(items, { time, mood, types, exclude: seen.current })
    }
    if (!c) {
      setPick(null)
      setPhase('none')
      return
    }
    const chosen = c
    if (reduced() || cands.length < 2) {
      setPick(chosen)
      setNum(nextTicketNumber())
      setPhase('shown')
      return
    }
    // petit défilement de titres avant le ticket
    setPhase('shuffle')
    const pool = cands.map((x) => x.item.title)
    const steps = 9
    for (let k = 0; k < steps; k++) {
      timers.current.push(window.setTimeout(() => setShuffle(pool[(k * 7 + 3) % pool.length]), 60 + k * k * 9))
    }
    timers.current.push(
      window.setTimeout(() => {
        setPick(chosen)
        setNum(nextTicketNumber())
        setPhase('shown')
      }, 60 + steps * steps * 9 + 120),
    )
  }

  const toggleType = (t: MediaType) =>
    setTypes((cur) => (cur.includes(t) ? (cur.length > 1 ? cur.filter((x) => x !== t) : cur) : [...cur, t]))

  const it = pick?.item
  const capacity =
    it?.type === 'serie' && it.runtime_min
      ? (() => {
          const n = time ? Math.max(1, Math.floor(time / it.runtime_min)) : null
          return n ? `${n} épisode${n > 1 ? 's' : ''} possible${n > 1 ? 's' : ''} ce soir` : `Épisodes de ${duration(it.runtime_min)}`
        })()
      : it?.type === 'film' && it.runtime_min
        ? `${duration(it.runtime_min)}${time ? (it.runtime_min <= time ? ', ça tient' : ', un peu juste') : ''}`
        : null
  const today = new Date()
  const dateStr = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getFullYear()).slice(2)}`

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h1 className="h1" style={{ lineHeight: 0.86 }}>
          Ce soir je fais quoi ?
        </h1>
        <span className="ink2">Dis combien de temps tu as et ce dont tu as envie. Le tirage pioche dans ta pile.</span>
      </div>

      <div className="criteria">
        <div>
          <span className="label">Temps dispo</span>
          <div className="chips tight">
            {TIMES.map((t) => (
              <button key={t.label} className="chip mono" aria-pressed={time === t.v} onClick={() => setTime(t.v)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Humeur</span>
          <div className="chips tight">
            {MOODS.map((m) => (
              <button key={m.id} className="chip" aria-pressed={mood === m.id} onClick={() => setMood(mood === m.id ? null : m.id)}>
                {MOOD_SHORT[m.id]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Types</span>
          <div className="chips tight">
            {TYPES.map((t) => (
              <button key={t} className={`chip ty-${t}`} aria-pressed={types.includes(t)} onClick={() => toggleType(t)}>
                <Icon name={t} size={16} stroke={1.8} style={{ color: types.includes(t) ? undefined : 'var(--tc)' }} />
                {TYPE_PLURAL[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="draw-row">
        <button className="btn-draw" onClick={() => draw(phase === 'shown')} disabled={phase === 'shuffle'}>
          <Icon name="soir" size={22} stroke={1.8} />
          {phase === 'shown' ? 'Tirer à nouveau' : 'Tirer un titre'}
        </button>
        <span className="mono ink2" style={{ fontSize: 12 }}>
          {cands.length} titre{cands.length > 1 ? 's' : ''} possible{cands.length > 1 ? 's' : ''}
        </span>
      </div>

      {phase === 'shuffle' && (
        <div className="shuffle" aria-live="polite">
          <span className="meta">Tirage en cours</span>
          <span className="disp">{shuffle}</span>
        </div>
      )}

      {phase === 'none' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '24px 0' }}>
          <h2 className="disp" style={{ fontSize: 30 }}>
            Rien ne colle à ces critères
          </h2>
          <span className="ink2">Prends plus de temps, change d’humeur ou ajoute un type.</span>
        </div>
      )}

      {phase === 'shown' && it && pick && (
        <div className="ticket" key={`${it.id}-${num}`}>
          <div className="stub">
            <span className="disp">Ce soir</span>
            <span className="mono">N° {String(num).padStart(4, '0')}</span>
            <span className="mono">{dateStr}</span>
          </div>
          <span className="notch a" />
          <span className="notch b" />
          <div className="tk-body">
            <Poster url={it.poster_url} title={it.title} type={it.type} year={it.year} size="md" />
            <div className="tk-info">
              <span className="meta">
                {[TYPE_LABEL[it.type], metaLine(it)].filter(Boolean).join(' · ')}
              </span>
              <h2 className="tk-title">{it.title}</h2>
              {it.creator && <span className="by">{it.creator}</span>}
              {pick.reasons.length > 0 && (
                <ul className="reasons">
                  {pick.reasons
                    .filter((r) => !/min|épisode/.test(r))
                    .map((r) => (r === 'colle à ton humeur' && mood ? `colle à ton humeur : ${MOOD_SHORT[mood].toLowerCase()}` : r))
                    .slice(0, 3)
                    .map((r) => (
                    <li key={r}>
                      <Icon name="check" size={18} stroke={2.2} />
                      {r.charAt(0).toUpperCase() + r.slice(1)}
                    </li>
                  ))}
                </ul>
              )}
              {capacity && <div className="capacity">{capacity}</div>}
              {it.overview && <p className="tk-sum">{it.overview.length > 320 ? `${it.overview.slice(0, 320)}…` : it.overview}</p>}
              <div className="tk-actions">
                <button
                  className="tk-go"
                  onClick={() => {
                    if (it.status !== 'en_cours') update(it.id, { status: 'en_cours' })
                    openItem(it.id)
                  }}
                >
                  <Icon name="play" size={16} />
                  C’est parti
                </button>
                <button className="tk-other" onClick={() => draw(true)}>
                  Autre chose
                </button>
                <button className="tk-link" onClick={() => openItem(it.id)}>
                  Fiche
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

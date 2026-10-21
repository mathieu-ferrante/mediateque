import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { OllamaError, recommend, type Suggestion } from '../lib/ollama'
import { affinityScore, computeAffinity, MOODS, norm, type Mood } from '../lib/picker'
import { loadSettings } from '../lib/settings'
import { TYPES, TYPE_LABEL, TYPE_PLURAL, type MediaType } from '../lib/types'
import { Row } from './Card'
import { Icon } from './Icon'
import { Thumb } from './Poster'

// Les suggestions survivent au changement d'écran (l'IA peut mettre une minute)
let lastRun: { sugs: Suggestion[]; type: MediaType | 'tout' } | null = null
let pending: Promise<Suggestion[]> | null = null

export function ForYou({ onSearch, goSettings }: { onSearch: (type: MediaType, q: string) => void; goSettings: () => void }) {
  const { items } = useApp()
  const [type, setType] = useState<MediaType | 'tout'>(lastRun?.type ?? 'film')
  const [mood, setMood] = useState<Mood | ''>('')
  const [busy, setBusy] = useState(!!pending)
  const [elapsed, setElapsed] = useState(0)
  const [err, setErr] = useState<string | null>(null)
  const [sugs, setSugs] = useState<Suggestion[]>(lastRun?.sugs ?? [])
  const [hidden, setHidden] = useState<string[]>([])
  const settings = loadSettings()
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (pending) pending.then((r) => setSugs(r)).finally(() => setBusy(false))
    return () => clearInterval(timer.current)
  }, [])

  const aff = useMemo(() => computeAffinity(items), [items])
  const topGenres = useMemo(
    () =>
      [...aff.byGenre.entries()]
        .filter(([, v]) => v.n >= 1)
        .sort((a, b) => b[1].avg - a[1].avg || b[1].n - a[1].n)
        .slice(0, 5),
    [aff],
  )
  const genreName = useMemo(() => {
    const m = new Map<string, string>()
    for (const i of items) for (const g of i.genres) m.set(norm(g), g)
    return m
  }, [items])
  const fromPile = useMemo(
    () =>
      items
        .filter((i) => i.status === 'a_voir')
        .map((i) => ({ i, s: affinityScore(i, aff) }))
        .filter((x) => x.s > 0.02)
        .sort((a, b) => b.s - a.s)
        .slice(0, 5),
    [items, aff],
  )
  const rated = items.filter((i) => i.rating != null).length

  async function ask() {
    if (!settings.ollamaModel) {
      setErr('Choisis d’abord un modèle Ollama dans les Réglages.')
      return
    }
    setBusy(true)
    setErr(null)
    setElapsed(0)
    const t0 = Date.now()
    timer.current = window.setInterval(() => setElapsed(Math.round((Date.now() - t0) / 1000)), 1000)
    pending = recommend(settings.ollamaUrl, settings.ollamaModel, items, type, mood || null)
    try {
      const r = await pending
      lastRun = { sugs: r, type }
      setSugs(r)
      setHidden([])
      if (!r.length) setErr('Plus d’idées pour ce type. Relance pour en avoir d’autres.')
    } catch (e) {
      setErr(e instanceof OllamaError ? e.message : `Erreur : ${e instanceof Error ? e.message : e}`)
    } finally {
      pending = null
      clearInterval(timer.current)
      setBusy(false)
    }
  }

  const reason = (genres: string[]) =>
    genres
      .filter((g) => (aff.byGenre.get(norm(g))?.avg ?? 0) >= aff.mean)
      .slice(0, 2)
      .join(', ')
      .replace(/^./, (c) => c.toUpperCase())

  const shown = sugs.filter((s) => !hidden.includes(s.titre))
  const added = (s: Suggestion) => items.some((i) => norm(i.title) === norm(s.titre))

  return (
    <>
      <h1 className="h1">Pour toi</h1>
      <div className="foryou-top">
        <div className="list wide">
          <div className="section-head">
            <h2 className="h2">Dans ta pile, ça devrait te plaire</h2>
            <span className="sub">Calculé à partir de tes notes.</span>
          </div>
          {rated < 3 ? (
            <span className="sub" style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
              Note au moins 3 titres pour que l’appli apprenne tes goûts.
            </span>
          ) : fromPile.length ? (
            fromPile.map(({ i }) => <Row key={i.id} item={i} right={reason(i.genres) ? `Tu aimes : ${reason(i.genres)}` : ''} rightClass="txt" />)
          ) : (
            <span className="sub" style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>Rien qui ressorte nettement pour l’instant.</span>
          )}
        </div>
        <div className="list">
          <h2 className="h2" style={{ marginBottom: 12 }}>Tes genres préférés</h2>
          {topGenres.length ? (
            topGenres.map(([g, v]) => (
              <div key={g} className="genre-row">
                <span style={{ fontWeight: 600 }}>{genreName.get(g) ?? g}</span>
                <div className="bar">
                  <div style={{ width: `${v.avg * 10}%` }} />
                </div>
                <span className="mono" style={{ fontSize: 12, textAlign: 'right' }}>
                  {v.avg.toFixed(1).replace('.', ',')}
                </span>
              </div>
            ))
          ) : (
            <span className="sub" style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>Pas encore de notes.</span>
          )}
          <span className="sub" style={{ marginTop: 8, fontSize: 13 }}>Moyenne de tes notes sur 10, par genre.</span>
        </div>
      </div>

      <div className="ai-block">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <h2 className="h2">Découvertes par ton IA locale</h2>
          <span className="sub">
            Des titres que tu n’as pas encore, proposés par Ollama sur ta machine
            {settings.ollamaModel ? ` (${settings.ollamaModel})` : ''}.{' '}
            <button className="link-btn" style={{ height: 'auto', padding: 0, fontSize: 14 }} onClick={goSettings}>
              Réglages
            </button>
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <div role="radiogroup" aria-label="Type" className="seg">
            {(['tout', ...TYPES] as const).map((t) => (
              <button key={t} role="radio" aria-checked={type === t} onClick={() => setType(t)}>
                {t !== 'tout' && <Icon name={t} size={15} stroke={1.8} />}
                {t === 'tout' ? 'Tout' : TYPE_PLURAL[t]}
              </button>
            ))}
          </div>
          <label className="selectbox" style={{ background: 'none' }}>
            <span className="ink2">Humeur</span>
            <select value={mood} onChange={(e) => setMood(e.target.value as Mood | '')}>
              <option value="">Peu importe</option>
              {MOODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-acc sm" onClick={ask} disabled={busy}>
            {busy ? 'Ça réfléchit…' : sugs.length ? 'Relancer' : 'Me proposer des titres'}
          </button>
        </div>

        {busy && (
          <div className="ai-wait" role="status">
            <span className="spinner" />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: 600 }}>Ton IA réfléchit · {elapsed} s</span>
              <span className="sub">Ça peut prendre jusqu’à une minute. Tu peux changer d’écran, le résultat t’attendra.</span>
            </div>
          </div>
        )}
        {err && !busy && (
          <span style={{ color: 'var(--err)', fontWeight: 600, paddingTop: 12, borderTop: '1px solid var(--line)' }}>{err}</span>
        )}

        {!busy && shown.length > 0 && (
          <div className="list">
            {shown.map((s) => (
              <div key={s.titre} className="ai-row">
                <Thumb url={null} type={s.type} />
                <div className="row-main">
                  <span style={{ fontWeight: 600, fontSize: 17 }}>{s.titre}</span>
                  <span className="meta">{[TYPE_LABEL[s.type], s.annee].filter(Boolean).join(' · ')}</span>
                  <span style={{ fontSize: 15, textWrap: 'pretty' }}>{s.raison}</span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {added(s) ? (
                    <span className="added">
                      <Icon name="check" size={16} stroke={2.2} />
                      Dans ta pile
                    </span>
                  ) : (
                    <>
                      <button className="btn solid" onClick={() => onSearch(s.type, s.titre)}>
                        + Ajouter
                      </button>
                      <button className="btn quiet" onClick={() => setHidden((h) => [...h, s.titre])}>
                        Bof
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

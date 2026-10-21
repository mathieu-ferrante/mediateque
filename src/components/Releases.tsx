import { useMemo } from 'react'
import { useApp } from '../lib/AppContext'
import { frDate, relativeDays } from '../lib/format'
import { loadSettings } from '../lib/settings'
import { isDemo } from '../lib/supabase'
import { releases } from '../lib/stats'
import { TYPE_LABEL, type Item } from '../lib/types'
import { Row } from './Card'
import { Icon } from './Icon'

function lastCheckLabel(ts: number): string {
  if (!ts) return 'jamais'
  const d = new Date(ts)
  const today = new Date()
  const hm = `${d.getHours()} h ${String(d.getMinutes()).padStart(2, '0')}`
  if (d.toDateString() === today.toDateString()) return `aujourd’hui à ${hm}`
  return `le ${frDate(d.toISOString())} à ${hm}`
}

const label = (i: Item) => i.next_release_label ?? `Sortie le ${frDate(i.next_release_date)}`

export function Releases() {
  const { items, refreshFromSources, refreshing } = useApp()
  const r = useMemo(() => releases(items), [items])
  const last = loadSettings().lastRefresh

  const sub = (i: Item) => `${label(i)} · ${relativeDays(i.next_release_date!)}`

  return (
    <>
      <div className="head-row">
        <h1 className="h1">Sorties</h1>
        <div className="right">
          <span className="sub">{isDemo ? 'Mode démo : pas de vérification en ligne' : `Dernière vérification : ${lastCheckLabel(last)}`}</span>
          {!isDemo && (
            <button className="btn-outline-disp" onClick={() => refreshFromSources(true)} disabled={refreshing}>
              {refreshing ? <span className="spinner" /> : <Icon name="refresh" size={16} stroke={2} />}
              {refreshing ? 'Vérification…' : 'Vérifier maintenant'}
            </button>
          )}
        </div>
      </div>

      {r.recent.length > 0 && (
        <div className="list">
          <div className="section-head">
            <h2 className="h2">Sorti récemment</h2>
            <span className="sub">Ces 14 derniers jours.</span>
          </div>
          {r.recent.map((i) => (
            <Row key={i.id} item={i} sub={`${TYPE_LABEL[i.type]} · ${sub(i)}`} tag={<span className="ticket-tag">Nouveau</span>} />
          ))}
        </div>
      )}

      <div className="list">
        <div className="section-head">
          <h2 className="h2">À venir</h2>
          <span className="sub">Prochains épisodes, saisons, films et jeux attendus. Vérifié chaque jour à l’ouverture.</span>
        </div>
        {r.upcoming.length ? (
          r.upcoming.map((i) => (
            <Row key={i.id} item={i} sub={`${TYPE_LABEL[i.type]}${i.year ? ` · ${i.year}` : ''}`} right={sub(i)} rightClass="ink2" />
          ))
        ) : (
          <span className="sub" style={{ paddingTop: 12, borderTop: '1px solid var(--line)' }}>
            Rien d’annoncé pour l’instant. Les séries en cours et les titres « attendus » apparaîtront ici.
          </span>
        )}
      </div>
    </>
  )
}

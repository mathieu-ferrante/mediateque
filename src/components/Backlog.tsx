import { useMemo } from 'react'
import { useApp } from '../lib/AppContext'
import { duration } from '../lib/format'
import { backlogStats, lastMonths, progressInfo, remainingMinutes } from '../lib/stats'
import { TYPE_LABEL, TYPE_PLURAL, type Item } from '../lib/types'
import { metaLine, Row } from './Card'
import { Icon } from './Icon'

const short = (min: number) => (min < 60 ? `${Math.max(5, Math.round(min / 5) * 5)} min` : `${Math.round(min / 60)} h`)

function ago(iso: string): string {
  const d = (Date.now() - Date.parse(iso)) / 86_400_000
  if (d < 60) return `${Math.max(1, Math.round(d / 7))} sem.`
  return `${Math.round(d / 30)} mois`
}

const subOf = (i: Item) => [i.progress, TYPE_LABEL[i.type]].filter(Boolean).join(' · ')

export function Backlog() {
  const { items } = useApp()
  const s = useMemo(() => backlogStats(items), [items])
  const months = useMemo(() => lastMonths(items), [items])
  const maxM = Math.max(1, ...months.flatMap((m) => [m.added, m.done]))
  const inProgress = useMemo(
    () => items.filter((i) => i.status === 'en_cours').sort((a, b) => remainingMinutes(a).min - remainingMinutes(b).min),
    [items],
  )
  const quick = useMemo(
    () =>
      items
        .filter((i) => i.status === 'a_voir')
        .map((i) => ({ i, r: remainingMinutes(i) }))
        .filter((x) => x.r.known)
        .sort((a, b) => a.r.min - b.r.min)
        .slice(0, 5),
    [items],
  )
  const totalH = Math.round(s.totalMinutes / 60)
  const perMonth = s.finishedMinutesLast90 / 3 / 60
  const added90 = months.reduce((a, m) => a + m.added, 0)
  const done90 = months.reduce((a, m) => a + m.done, 0)

  return (
    <>
      <h1 className="h1">Ma pile</h1>
      <div className="pile-top">
        <div>
          <span className="label">Pour tout finir</span>
          <span className="big-num">
            {totalH}
            <small> h</small>
          </span>
          <span style={{ fontWeight: 600 }}>
            pour {s.totalCount === 1 ? 'le seul titre' : `les ${s.totalCount} titres`} en attente
          </span>
          <span className="ink2" style={{ textWrap: 'pretty' }}>
            {s.monthsToClear != null
              ? `À ton rythme des 3 derniers mois (≈ ${Math.round(perMonth)} h par mois), il te faut environ ${
                  s.monthsToClear < 1 ? 'moins d’un mois' : s.monthsToClear < 24 ? `${Math.round(s.monthsToClear)} mois` : `${(s.monthsToClear / 12).toFixed(1).replace('.', ',')} ans`
                } pour la vider.`
              : 'Termine un titre pour voir combien de temps il te faudrait pour vider la pile.'}
          </span>
        </div>
        <div>
          <span className="label">Par type</span>
          <div className="typebar">
            {s.byType
              .filter((t) => t.minutes > 0)
              .map((t) => (
                <div key={t.type} className={`ty-${t.type}`} style={{ width: `${(t.minutes / Math.max(1, s.totalMinutes)) * 100}%`, background: 'var(--tc)' }} title={TYPE_PLURAL[t.type]} />
              ))}
          </div>
          <div>
            {s.byType.map((t) => (
              <div key={t.type} className={`trow ty-${t.type}`}>
                <Icon name={t.type} size={17} stroke={1.8} style={{ color: 'var(--tc)' }} />
                <b>{TYPE_PLURAL[t.type]}</b>
                <span className="mono ink2" style={{ width: 70 }}>
                  {t.count} titre{t.count > 1 ? 's' : ''}
                </span>
                <span className="mono" style={{ width: 56, textAlign: 'right' }}>
                  {t.count ? `${Math.round(t.minutes / 60)} h` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Ajoutés et terminés · 90 jours</span>
          <div className="chart90">
            {months.map((m) => (
              <div key={m.label}>
                <div style={{ height: `${(m.added / maxM) * 100}%`, background: 'var(--ink2)' }} title={`${m.added} ajouté(s)`} />
                <div style={{ height: `${(m.done / maxM) * 100}%`, background: 'var(--acc)' }} title={`${m.done} terminé(s)`} />
              </div>
            ))}
          </div>
          <div className="chart90-x">
            {months.map((m) => (
              <span key={m.label}>{m.label}</span>
            ))}
          </div>
          <div className="legend">
            <span>
              <i style={{ background: 'var(--ink2)' }} />
              {added90} ajouté{added90 > 1 ? 's' : ''}
            </span>
            <span>
              <i style={{ background: 'var(--acc)' }} />
              {done90} terminé{done90 > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      <div className="cols3">
        <div className="list">
          <div className="section-head">
            <h2 className="h2" style={{ fontSize: 26 }}>En cours à finir</h2>
            <span className="sub">Ce que tu as commencé.</span>
          </div>
          {inProgress.length ? (
            inProgress.map((i) => {
              const r = remainingMinutes(i)
              return <Row key={i.id} item={i} sub={subOf(i)} bar={progressInfo(i)?.pct ?? null} right={r.min ? short(r.min) : ''} />
            })
          ) : (
            <span className="sub" style={{ paddingTop: 10, borderTop: '1px solid var(--line)' }}>Rien en cours pour l’instant.</span>
          )}
        </div>
        <div className="list">
          <div className="section-head">
            <h2 className="h2" style={{ fontSize: 26 }}>Vite fait bien fait</h2>
            <span className="sub">Les plus courts de ta pile.</span>
          </div>
          {quick.map(({ i, r }) => (
            <Row key={i.id} item={i} right={duration(r.min) ? short(r.min) : ''} />
          ))}
        </div>
        <div className="list">
          <div className="section-head">
            <h2 className="h2" style={{ fontSize: 26 }}>Ça traîne depuis longtemps</h2>
            <span className="sub">Ajoutés il y a le plus longtemps.</span>
          </div>
          {s.oldest.slice(0, 5).map((i) => (
            <Row key={i.id} item={i} sub={[TYPE_LABEL[i.type], metaLine(i)].filter(Boolean).join(' · ')} right={ago(i.added_at)} rightStyle={{ color: 'var(--acc)' }} />
          ))}
        </div>
      </div>
    </>
  )
}


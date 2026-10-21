import { useApp } from '../lib/AppContext'
import { duration } from '../lib/format'
import { progressInfo } from '../lib/stats'
import { statusLabel, TYPE_LABEL, type Item } from '../lib/types'
import { Icon } from './Icon'
import { Poster, Thumb } from './Poster'

/** "2024 · 1 H 25", "2022 · 2 SAISONS", "2025 · ≈ 40 H", "2008 · 440 P." */
export function metaLine(it: Item): string {
  const parts: string[] = []
  if (it.year) parts.push(String(it.year))
  if (it.type === 'film') parts.push(it.runtime_min ? duration(it.runtime_min) : it.status === 'attendu' ? 'Durée à venir' : '')
  if (it.type === 'serie' && it.seasons) parts.push(`${it.seasons} saison${it.seasons > 1 ? 's' : ''}`)
  if (it.type === 'jeu' && it.total_min) parts.push(`≈ ${Math.round(it.total_min / 60)} h`)
  if (it.type === 'livre' && it.pages) parts.push(`${it.pages} p.`)
  return parts.filter(Boolean).join(' · ')
}

export function Card({ item }: { item: Item }) {
  const { openItem } = useApp()
  const pr = progressInfo(item)
  return (
    <button className="card" onClick={() => openItem(item.id)} aria-label={`${item.title}, ${statusLabel(item.type, item.status)}`}>
      <Poster url={item.poster_url} title={item.title} type={item.type} year={item.year} by={item.creator}>
        <span className={`st-tag st-${item.status}`}>{statusLabel(item.type, item.status)}</span>
        {item.favorite && (
          <span className="fav-dot" aria-label="Favori">
            <Icon name="heart" size={15} fill="currentColor" stroke={0} />
          </span>
        )}
      </Poster>
      {pr && (
        <div className="prog">
          {pr.pct != null && (
            <div className="bar">
              <div style={{ width: `${Math.round(pr.pct * 100)}%` }} />
            </div>
          )}
          <div className="prog-line">
            <b>{pr.label}</b>
            <span>{pr.right}</span>
          </div>
        </div>
      )}
      <div className="card-foot">
        <div className="card-text">
          <span className="card-title">{item.title}</span>
          <span className="meta">{metaLine(item)}</span>
        </div>
        {item.rating != null && <span className="rating-box">{item.rating}/10</span>}
      </div>
    </button>
  )
}

export function Row({
  item,
  sub,
  right,
  rightClass,
  rightStyle,
  bar,
  tag,
}: {
  item: Item
  sub?: string
  right?: React.ReactNode
  rightClass?: string
  rightStyle?: React.CSSProperties
  bar?: number | null
  tag?: React.ReactNode
}) {
  const { openItem } = useApp()
  return (
    <button className="row" onClick={() => openItem(item.id)}>
      <Thumb url={item.poster_url} type={item.type} />
      <div className="row-main">
        <span className="row-title">{item.title}</span>
        <span className="meta">{sub ?? [item.year, TYPE_LABEL[item.type]].filter(Boolean).join(' · ')}</span>
        {bar != null && (
          <div className="bar thin">
            <div style={{ width: `${Math.round(bar * 100)}%` }} />
          </div>
        )}
      </div>
      {tag}
      {right != null && right !== '' && (
        <span className={`row-right ${rightClass ?? ''}`} style={rightStyle}>
          {right}
        </span>
      )}
    </button>
  )
}

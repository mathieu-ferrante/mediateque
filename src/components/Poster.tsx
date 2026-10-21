import { useState } from 'react'
import type { MediaType } from '../lib/types'
import { TYPE_LABEL } from '../lib/types'
import { Icon } from './Icon'

interface P {
  url: string | null
  title: string
  type: MediaType
  year?: number | null
  by?: string | null
}

/** Grande affiche, ou "jaquette" typographique quand il n'y a pas d'image. */
export function Poster({ url, title, type, year, by, size = 'card', children }: P & { size?: 'card' | 'md'; children?: React.ReactNode }) {
  const [broken, setBroken] = useState(false)
  const show = url && !broken
  return (
    <div className={`poster ty-${type} ${size === 'md' ? 'md' : 'card-p'}`}>
      {show ? (
        <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <div className="jq">
          <div className="jq-strip" />
          <div className="jq-body">
            <span className="jq-kicker">
              {TYPE_LABEL[type]}
              {year ? ` · ${year}` : ''}
            </span>
            <span className="jq-title">{title}</span>
            {by && size === 'card' && <span className="jq-by">{by}</span>}
          </div>
          <div className="jq-strip" />
        </div>
      )}
      {children}
    </div>
  )
}

/** Petite vignette pour les listes. */
export function Thumb({ url, type, large }: { url: string | null; type: MediaType; large?: boolean }) {
  const [broken, setBroken] = useState(false)
  return (
    <div className={`thumb ty-${type} ${large ? 'lg' : ''}`}>
      {url && !broken ? (
        <img src={url} alt="" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <div className="thumb-jq">
          <Icon name={type} size={20} />
        </div>
      )}
    </div>
  )
}

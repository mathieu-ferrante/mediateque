import type { MediaInfo, MediaType } from '../../supabase/functions/media/index.ts'

export type { MediaInfo, MediaType }

export type Status = 'a_voir' | 'en_cours' | 'termine' | 'abandonne' | 'attendu'

export interface Item extends MediaInfo {
  id: string
  status: Status
  rating: number | null
  review: string | null
  progress: string | null
  favorite: boolean
  added_at: string
  updated_at: string
  started_at: string | null
  finished_at: string | null
  refreshed_at: string | null
}

export const TYPES: MediaType[] = ['film', 'serie', 'jeu', 'livre']

export const TYPE_LABEL: Record<MediaType, string> = {
  film: 'Film',
  serie: 'Série',
  jeu: 'Jeu',
  livre: 'Livre',
}
export const TYPE_PLURAL: Record<MediaType, string> = {
  film: 'Films',
  serie: 'Séries',
  jeu: 'Jeux',
  livre: 'Livres',
}

export const STATUSES: Status[] = ['a_voir', 'en_cours', 'termine', 'abandonne', 'attendu']

const A_FAIRE: Record<MediaType, string> = { film: 'À voir', serie: 'À voir', jeu: 'À jouer', livre: 'À lire' }
/** Libellé du bouton « déjà fait » à l'ajout. */
export const DONE_LABEL: Record<MediaType, string> = { film: 'Déjà vu', serie: 'Déjà vue', jeu: 'Terminé', livre: 'Déjà lu' }
export const STATUS_GENERIC: Record<Status, string> = {
  a_voir: 'À faire',
  en_cours: 'En cours',
  termine: 'Terminé',
  abandonne: 'Abandonné',
  attendu: 'Attendu',
}
export const statusLabel = (type: MediaType, s: Status) => (s === 'a_voir' ? A_FAIRE[type] : STATUS_GENERIC[s])

/** Statuts qui composent "la pile" (ce qui reste à faire). */
export const BACKLOG: Status[] = ['a_voir', 'en_cours']

export function emptyInfo(type: MediaType, title: string): MediaInfo {
  return {
    type,
    title,
    original_title: null,
    year: null,
    poster_url: null,
    overview: null,
    genres: [],
    creator: null,
    platforms: [],
    runtime_min: null,
    total_min: null,
    pages: null,
    seasons: null,
    episodes: null,
    source: 'manuel',
    source_id: '',
    release_date: null,
    next_release_date: null,
    next_release_label: null,
    media_status: null,
  }
}

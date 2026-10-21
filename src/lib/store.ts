import { supabase } from './supabase'
import type { Item, MediaInfo, Status } from './types'
import { demoSeed } from './demoSeed'

export type NewItem = MediaInfo & Partial<Pick<Item, 'status' | 'rating' | 'review' | 'progress' | 'favorite'>>
export type Patch = Partial<Omit<Item, 'id' | 'added_at'>>

export interface Store {
  list(): Promise<Item[]>
  add(info: NewItem): Promise<Item>
  update(id: string, patch: Patch): Promise<Item>
  remove(id: string): Promise<void>
  /** Import en masse (restauration d'une sauvegarde) : ignore les doublons. */
  importMany(items: NewItem[]): Promise<number>
}

/** Champs de dates automatiques quand le statut change. */
export function statusSideEffects(prev: Item | undefined, patch: Patch): Patch {
  const s = patch.status as Status | undefined
  if (!s || (prev && prev.status === s)) return patch
  const now = new Date().toISOString()
  const extra: Patch = {}
  if (s === 'en_cours' && !prev?.started_at) extra.started_at = now
  if (s === 'termine') {
    extra.finished_at = now
    if (!prev?.started_at) extra.started_at = now
  }
  if (s === 'a_voir' || s === 'attendu') extra.finished_at = null
  return { ...extra, ...patch }
}

export const sameMedia = (a: Pick<Item, 'source' | 'source_id'>, b: Pick<Item, 'source' | 'source_id'>) =>
  !!a.source_id && a.source === b.source && a.source_id === b.source_id

function toItem(info: NewItem, id: string): Item {
  const now = new Date().toISOString()
  const base: Item = {
    ...info,
    id,
    status: info.status ?? 'a_voir',
    rating: info.rating ?? null,
    review: info.review ?? null,
    progress: info.progress ?? null,
    favorite: info.favorite ?? false,
    added_at: now,
    updated_at: now,
    started_at: null,
    finished_at: null,
    refreshed_at: null,
  }
  return { ...base, ...statusSideEffects(undefined, { status: base.status }) } as Item
}

// ---------------- Mode démo : tout dans le navigateur ----------------

const KEY = 'mediatheque.demo.items'

export class DemoStore implements Store {
  private read(): Item[] {
    try {
      const raw = localStorage.getItem(KEY)
      if (raw) return JSON.parse(raw)
    } catch {
      /* stockage indisponible */
    }
    const seed = demoSeed().map(({ info, extra }) => ({ ...toItem(info, crypto.randomUUID()), ...extra }))
    this.write(seed)
    return seed
  }
  private write(items: Item[]) {
    try {
      localStorage.setItem(KEY, JSON.stringify(items))
    } catch {
      /* ignore */
    }
  }
  async list() {
    return this.read()
  }
  async add(info: NewItem) {
    const items = this.read()
    const dup = items.find((i) => sameMedia(i, info))
    if (dup) throw new Error('Déjà dans ta médiathèque')
    const it = toItem(info, crypto.randomUUID())
    this.write([it, ...items])
    return it
  }
  async update(id: string, patch: Patch) {
    const items = this.read()
    const idx = items.findIndex((i) => i.id === id)
    if (idx < 0) throw new Error('Introuvable')
    const next = { ...items[idx], ...statusSideEffects(items[idx], patch), updated_at: new Date().toISOString() }
    items[idx] = next
    this.write(items)
    return next
  }
  async remove(id: string) {
    this.write(this.read().filter((i) => i.id !== id))
  }
  async importMany(list: NewItem[]) {
    const items = this.read()
    let n = 0
    for (const info of list) {
      if (items.some((i) => sameMedia(i, info) || (i.title === info.title && i.type === info.type))) continue
      items.push({ ...toItem(info, crypto.randomUUID()), ...pickDates(info) })
      n++
    }
    this.write(items)
    return n
  }
}

function pickDates(info: NewItem): Partial<Item> {
  const x = info as Partial<Item>
  const out: Partial<Item> = {}
  for (const k of ['added_at', 'started_at', 'finished_at'] as const) if (x[k]) out[k] = x[k]
  return out
}

// ---------------- Supabase ----------------

const COLUMNS = [
  'type', 'title', 'original_title', 'year', 'poster_url', 'overview', 'genres', 'creator', 'platforms',
  'runtime_min', 'total_min', 'pages', 'seasons', 'episodes', 'status', 'rating', 'review', 'progress',
  'favorite', 'source', 'source_id', 'release_date', 'next_release_date', 'next_release_label', 'media_status',
  'added_at', 'started_at', 'finished_at', 'refreshed_at',
] as const

function clean(obj: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const k of COLUMNS) if (k in obj && obj[k] !== undefined) out[k] = obj[k]
  if (out.source_id === '') out.source_id = null
  return out
}

function fromRow(r: Record<string, unknown>): Item {
  return { ...(r as unknown as Item), source_id: (r.source_id as string) ?? '' }
}

export class SupabaseStore implements Store {
  private cache = new Map<string, Item>()
  private get db() {
    return supabase!.from('items')
  }
  async list() {
    const all: Item[] = []
    // pagination par 1000 (limite par défaut de l'API)
    for (let from = 0; ; from += 1000) {
      const { data, error } = await this.db.select('*').order('added_at', { ascending: false }).range(from, from + 999)
      if (error) throw error
      all.push(...data.map(fromRow))
      if (data.length < 1000) break
    }
    this.cache = new Map(all.map((i) => [i.id, i]))
    return all
  }
  async add(info: NewItem) {
    const row = clean({ ...info, ...statusSideEffects(undefined, { status: info.status ?? 'a_voir' }) })
    const { data, error } = await this.db.insert(row).select().single()
    if (error) throw error.code === '23505' ? new Error('Déjà dans ta médiathèque') : error
    const it = fromRow(data)
    this.cache.set(it.id, it)
    return it
  }
  async update(id: string, patch: Patch) {
    const row = clean(statusSideEffects(this.cache.get(id), patch) as Record<string, unknown>)
    const { data, error } = await this.db.update(row).eq('id', id).select().single()
    if (error) throw error
    const it = fromRow(data)
    this.cache.set(it.id, it)
    return it
  }
  async remove(id: string) {
    const { error } = await this.db.delete().eq('id', id)
    if (error) throw error
    this.cache.delete(id)
  }
  async importMany(list: NewItem[]) {
    const existing = await this.list()
    const fresh = list.filter(
      (info) => !existing.some((i) => sameMedia(i, info) || (i.title === info.title && i.type === info.type)),
    )
    for (let i = 0; i < fresh.length; i += 200) {
      const { error } = await this.db.insert(fresh.slice(i, i + 200).map((x) => clean(x as unknown as Record<string, unknown>)))
      if (error) throw error
    }
    return fresh.length
  }
}

export const store: Store = supabase ? new SupabaseStore() : new DemoStore()

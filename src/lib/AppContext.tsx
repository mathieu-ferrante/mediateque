import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { refreshMany, sourceFields } from './providers'
import { loadSettings, saveSettings } from './settings'
import { needsRefresh } from './stats'
import { store, sameMedia, type NewItem, type Patch } from './store'
import type { Item } from './types'

interface Toast {
  id: number
  text: string
  kind: 'ok' | 'err'
}

interface Ctx {
  items: Item[]
  loading: boolean
  error: string | null
  add(info: NewItem): Promise<Item | null>
  update(id: string, patch: Patch): Promise<void>
  remove(id: string): Promise<void>
  reload(): Promise<void>
  refreshFromSources(force?: boolean): Promise<void>
  refreshing: boolean
  openItem(id: string | null): void
  openedId: string | null
  toast(text: string, kind?: 'ok' | 'err'): void
  toasts: Toast[]
}

const AppCtx = createContext<Ctx | null>(null)

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp hors du fournisseur')
  return c
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e))

export function AppProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openedId, openItem] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const toast = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'err' ? 6000 : 3500)
  }, [])

  const reload = useCallback(async () => {
    try {
      setItems(await store.list())
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const add = useCallback(
    async (info: NewItem) => {
      try {
        const it = await store.add(info)
        setItems((list) => [it, ...list])
        toast(`« ${it.title} » ajouté`)
        return it
      } catch (e) {
        toast(errMsg(e), 'err')
        return null
      }
    },
    [toast],
  )

  const update = useCallback(
    async (id: string, patch: Patch) => {
      // mise à jour optimiste
      const before = itemsRef.current
      setItems((list) => list.map((i) => (i.id === id ? ({ ...i, ...patch } as Item) : i)))
      try {
        const it = await store.update(id, patch)
        setItems((list) => list.map((i) => (i.id === id ? it : i)))
      } catch (e) {
        setItems(before)
        toast(errMsg(e), 'err')
      }
    },
    [toast],
  )

  const remove = useCallback(
    async (id: string) => {
      try {
        await store.remove(id)
        setItems((list) => list.filter((i) => i.id !== id))
      } catch (e) {
        toast(errMsg(e), 'err')
      }
    },
    [toast],
  )

  const refreshFromSources = useCallback(
    async (force = false) => {
      const targets = force
        ? itemsRef.current.filter((i) => i.source === 'tmdb' || i.source === 'igdb')
        : needsRefresh(itemsRef.current)
      if (!targets.length) {
        if (force) toast('Rien à mettre à jour')
        return
      }
      setRefreshing(true)
      try {
        const fresh = await refreshMany(targets)
        let newReleases = 0
        for (const m of fresh) {
          const it = itemsRef.current.find((i) => sameMedia(i, m))
          if (!it) continue
          if (m.next_release_date && m.next_release_date !== it.next_release_date) newReleases++
          const updated = await store.update(it.id, sourceFields(m))
          setItems((list) => list.map((i) => (i.id === it.id ? updated : i)))
        }
        saveSettings({ lastRefresh: Date.now() })
        if (force || newReleases) {
          toast(`${fresh.length} fiche(s) à jour${newReleases ? ` · ${newReleases} nouvelle(s) date(s) de sortie` : ''}`)
        }
      } catch (e) {
        if (force) toast(`Mise à jour impossible : ${errMsg(e)}`, 'err')
      } finally {
        setRefreshing(false)
      }
    },
    [toast],
  )

  // Chargement initial + mise à jour auto des sorties (une fois toutes les 20 h)
  useEffect(() => {
    reload().then(() => {
      if (Date.now() - loadSettings().lastRefresh > 20 * 3600_000) refreshFromSources()
    })
  }, [reload, refreshFromSources])

  // Resynchro quand on revient sur l'appli (ex : modifié sur l'autre ordi)
  useEffect(() => {
    let last = Date.now()
    const onVis = () => {
      if (document.visibilityState === 'visible' && Date.now() - last > 30_000) {
        last = Date.now()
        reload()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onVis)
    }
  }, [reload])

  const value = useMemo(
    () => ({ items, loading, error, add, update, remove, reload, refreshFromSources, refreshing, openItem, openedId, toast, toasts }),
    [items, loading, error, add, update, remove, reload, refreshFromSources, refreshing, openedId, toast, toasts],
  )
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

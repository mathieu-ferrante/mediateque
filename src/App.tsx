import { useEffect, useRef, useState } from 'react'
import { AddDialog } from './components/AddDialog'
import { Auth } from './components/Auth'
import { Backlog } from './components/Backlog'
import { ForYou } from './components/ForYou'
import { Icon, type IconName } from './components/Icon'
import { ItemDetail } from './components/ItemDetail'
import { Library } from './components/Library'
import { Releases } from './components/Releases'
import { Settings } from './components/Settings'
import { Tonight } from './components/Tonight'
import { AppProvider, useApp } from './lib/AppContext'
import { releases } from './lib/stats'
import { isDemo, supabase } from './lib/supabase'
import type { MediaType } from './lib/types'

type Tab = 'biblio' | 'soir' | 'pile' | 'sorties' | 'pourtoi' | 'reglages'

const TABS: { id: Tab; label: string; short: string; icon: IconName }[] = [
  { id: 'biblio', label: 'Bibliothèque', short: 'Biblio', icon: 'lib' },
  { id: 'soir', label: 'Ce soir', short: 'Ce soir', icon: 'soir' },
  { id: 'pile', label: 'Ma pile', short: 'Ma pile', icon: 'pile' },
  { id: 'sorties', label: 'Sorties', short: 'Sorties', icon: 'sorties' },
  { id: 'pourtoi', label: 'Pour toi', short: 'Pour toi', icon: 'pourtoi' },
  { id: 'reglages', label: 'Réglages', short: 'Réglages', icon: 'reglages' },
]

function readTab(): Tab {
  const h = location.hash.slice(1) as Tab
  return TABS.some((t) => t.id === h) ? h : 'biblio'
}

function useIsMobile() {
  const q = '(max-width: 760px)'
  const [m, setM] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(q).matches)
  useEffect(() => {
    const mq = matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return m
}

function useOnline() {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const up = () => setOn(true)
    const down = () => setOn(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return on
}

function Shell({ email }: { email: string | null }) {
  const { items, openedId, toasts, error, reload } = useApp()
  const [tab, setTab] = useState<Tab>(readTab)
  const [adding, setAdding] = useState<{ type: MediaType; q: string } | null>(null)
  const mobile = useIsMobile()
  const online = useOnline()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onHash = () => setTab(readTab())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  const go = (t: Tab) => {
    history.replaceState(null, '', `#${t}`)
    setTab(t)
    scrollRef.current?.scrollTo(0, 0)
  }
  const openAdd = () => setAdding({ type: 'film', q: '' })

  // Touche N : ajouter
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !adding && !openedId) {
        e.preventDefault()
        openAdd()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [adding, openedId])

  const recent = releases(items).recent.length
  const badge = (id: Tab) => (id === 'sorties' && recent > 0 ? <span className="count-badge">{recent}</span> : null)

  return (
    <div className="shell">
      {!mobile && (
        <aside className="side">
          <div className="brand">Médiathèque</div>
          <nav className="nav">
            {TABS.map((t) => (
              <button key={t.id} className="nav-btn" aria-current={tab === t.id ? 'page' : undefined} onClick={() => go(t.id)}>
                <Icon name={t.icon} size={19} />
                <span>{t.label}</span>
                {badge(t.id)}
              </button>
            ))}
          </nav>
          <div className="side-add">
            <button className="btn-add" onClick={openAdd} title="Ajouter un titre (touche N)">
              <span>
                <Icon name="plus" size={18} stroke={2.2} />
                Ajouter
              </span>
              <span className="kbd">N</span>
            </button>
          </div>
        </aside>
      )}

      <div className="main-col">
        {mobile && (
          <header className="m-head">
            <span className="brand">Médiathèque</span>
            {(['pourtoi', 'reglages'] as Tab[]).map((id) => {
              const t = TABS.find((x) => x.id === id)!
              return (
                <button key={id} className="icon-btn" aria-label={t.label} aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
                  <Icon name={t.icon} size={22} />
                </button>
              )
            })}
          </header>
        )}
        {isDemo && (
          <div className="banner info" role="status">
            <Icon name="info" size={18} stroke={1.8} />
            <span>Mode démo : titres d’exemple enregistrés dans ce navigateur. Branche ta base Supabase pour synchroniser le Mac et le PC.</span>
          </div>
        )}
        {!online && (
          <div className="banner info" role="status">
            <Icon name="wifi" size={18} stroke={1.8} />
            <span>Hors ligne : tu peux consulter ta pile, mais les changements ne seront pas enregistrés.</span>
          </div>
        )}
        {error && online && (
          <div className="banner err" role="alert">
            <Icon name="alert" size={18} stroke={1.8} />
            <span>Connexion à ta base impossible : {error}</span>
            <button onClick={reload}>Réessayer</button>
          </div>
        )}

        <div className="scroll" ref={scrollRef}>
          <div className="page">
            {tab === 'biblio' && <Library onAdd={openAdd} />}
            {tab === 'soir' && <Tonight />}
            {tab === 'pile' && <Backlog />}
            {tab === 'sorties' && <Releases />}
            {tab === 'pourtoi' && <ForYou onSearch={(type, q) => setAdding({ type, q })} goSettings={() => go('reglages')} />}
            {tab === 'reglages' && <Settings email={email} />}
          </div>
        </div>

        {mobile && (
          <nav className="m-nav">
            {(['biblio', 'soir', 'add', 'pile', 'sorties'] as const).map((id) => {
              if (id === 'add')
                return (
                  <button key="add" className="m-add" onClick={openAdd} aria-label="Ajouter un titre">
                    <Icon name="plus" size={24} stroke={2.4} />
                  </button>
                )
              const t = TABS.find((x) => x.id === id)!
              return (
                <button key={id} className="m-tab" aria-current={tab === id ? 'page' : undefined} onClick={() => go(id)}>
                  <Icon name={t.icon} size={21} />
                  {t.short}
                  {badge(id)}
                </button>
              )
            })}
          </nav>
        )}
      </div>

      {adding && <AddDialog initial={adding} onClose={() => setAdding(null)} />}
      {openedId && <ItemDetail />}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`} role="status">
            <Icon name={t.kind === 'err' ? 'alert' : 'check'} size={18} stroke={2.2} style={{ color: t.kind === 'err' ? 'var(--err)' : 'var(--ok)' }} />
            {t.text}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [ready, setReady] = useState(isDemo)
  const [email, setEmail] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null)
      setEmail(data.session?.user.email ?? null)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null)
      setEmail(session?.user.email ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!ready) return <div className="login ink2">Chargement…</div>
  if (!isDemo && !userId) return <Auth />
  return (
    <AppProvider key={userId ?? 'demo'}>
      <Shell email={email} />
    </AppProvider>
  )
}

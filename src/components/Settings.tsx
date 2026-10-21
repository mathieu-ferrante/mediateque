import { useRef, useState } from 'react'
import { useApp } from '../lib/AppContext'
import { listModels } from '../lib/ollama'
import { applyTheme, loadSettings, saveSettings, type Settings as S } from '../lib/settings'
import { store, type NewItem } from '../lib/store'
import { isDemo, supabase } from '../lib/supabase'

const THEMES: { v: S['theme']; l: string }[] = [
  { v: 'system', l: 'Système' },
  { v: 'light', l: 'Clair' },
  { v: 'dark', l: 'Sombre' },
]

export function Settings({ email }: { email: string | null }) {
  const { items, reload, refreshFromSources, refreshing, toast } = useApp()
  const [s, setS] = useState(loadSettings())
  const [models, setModels] = useState<string[] | null>(null)
  const [testing, setTesting] = useState(false)
  const [test, setTest] = useState<{ ok: boolean; text: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<S>) => setS(saveSettings(patch))

  async function testOllama() {
    setTesting(true)
    setTest(null)
    try {
      const m = await listModels(s.ollamaUrl)
      setModels(m)
      if (!m.length) setTest({ ok: false, text: 'Ollama répond, mais aucun modèle n’est installé (ollama pull qwen2.5:3b).' })
      else {
        setTest({ ok: true, text: `Connecté · ${m.length} modèle${m.length > 1 ? 's' : ''}` })
        if (!s.ollamaModel || !m.includes(s.ollamaModel)) set({ ollamaModel: m[0] })
      }
    } catch (e) {
      setModels(null)
      setTest({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setTesting(false)
    }
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ app: 'mediatheque', version: 1, exported_at: new Date().toISOString(), items }, null, 2)], {
      type: 'application/json',
    })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `mediatheque-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function importJson(file: File) {
    try {
      const data = JSON.parse(await file.text())
      const list: NewItem[] = (Array.isArray(data) ? data : (data.items ?? [])).map((x: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, user_id, updated_at, ...rest } = x
        return rest as unknown as NewItem
      })
      const n = await store.importMany(list)
      await reload()
      toast(`${n} titre${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}${list.length - n ? `, ${list.length - n} déjà présent${list.length - n > 1 ? 's' : ''}` : ''}`)
    } catch (e) {
      toast(`Import impossible : ${e instanceof Error ? e.message : e}`, 'err')
    }
  }

  return (
    <>
      <h1 className="h1">Réglages</h1>
      <div className="settings">
        <section className="set-sec">
          <h2>Compte et synchro</h2>
          {isDemo ? (
            <div>
              <span style={{ fontWeight: 600 }}>Mode démo</span>
              <span className="status-dot" style={{ color: 'var(--warn)' }}>
                <i />
                <span style={{ color: 'var(--ink2)' }}>Données d’exemple dans ce navigateur, sans synchro.</span>
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  onClick={() => {
                    try {
                      localStorage.removeItem('mediatheque.demo.items')
                    } catch {
                      /* ignore */
                    }
                    reload()
                    toast('Démo réinitialisée')
                  }}
                >
                  Réinitialiser la démo
                </button>
              </div>
            </div>
          ) : (
            <div>
              <span style={{ fontWeight: 600 }}>{email}</span>
              <span className="status-dot" style={{ color: 'var(--ok)' }}>
                <i />
                <span style={{ color: 'var(--ink2)' }}>Synchronisé entre tes appareils</span>
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn"
                  disabled={syncing}
                  onClick={async () => {
                    setSyncing(true)
                    await reload()
                    setSyncing(false)
                    toast('Synchronisé')
                  }}
                >
                  {syncing ? 'Synchronisation…' : 'Synchroniser maintenant'}
                </button>
                <button className="btn quiet" onClick={() => refreshFromSources(true)} disabled={refreshing}>
                  {refreshing ? 'Mise à jour…' : 'Mettre à jour les fiches'}
                </button>
                <button className="link-btn muted" onClick={() => supabase!.auth.signOut()}>
                  Se déconnecter
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="set-sec">
          <h2>IA locale</h2>
          <div>
            <label className="field">
              <span className="label">Adresse d’Ollama</span>
              <input className="input mono" value={s.ollamaUrl} onChange={(e) => set({ ollamaUrl: e.target.value })} />
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <button className="btn" onClick={testOllama} disabled={testing}>
                {testing ? 'Test en cours…' : 'Tester la connexion'}
              </button>
              {test && (
                <span className="status-dot" style={{ color: test.ok ? 'var(--ok)' : 'var(--err)', fontWeight: 600 }}>
                  <i />
                  {test.text}
                </span>
              )}
            </div>
            {(models?.length || s.ollamaModel) && (
              <label className="field">
                <span className="label">Modèle</span>
                {models?.length ? (
                  <select className="input mono" value={s.ollamaModel} onChange={(e) => set({ ollamaModel: e.target.value })}>
                    {models.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                ) : (
                  <input className="input mono" value={s.ollamaModel} onChange={(e) => set({ ollamaModel: e.target.value })} />
                )}
              </label>
            )}
            <span className="sub">Réglage propre à cet appareil. Avec 8 Go de RAM : qwen2.5:3b, llama3.2:3b ou gemma3:4b.</span>
          </div>
        </section>

        <section className="set-sec">
          <h2>Thème</h2>
          <div role="radiogroup" aria-label="Thème" className="seg">
            {THEMES.map((t) => (
              <button
                key={t.v}
                role="radio"
                aria-checked={s.theme === t.v}
                onClick={() => {
                  set({ theme: t.v })
                  applyTheme(t.v)
                }}
              >
                {t.l}
              </button>
            ))}
          </div>
        </section>

        <section className="set-sec">
          <h2>Sauvegarde</h2>
          <div>
            <span className="ink2" style={{ fontSize: 15 }}>
              Un fichier JSON avec tous tes titres, notes et avis ({items.length} titres).
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={exportJson}>
                Exporter
              </button>
              <button className="btn quiet" onClick={() => fileRef.current?.click()}>
                Importer un fichier
              </button>
              <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
            </div>
          </div>
        </section>

        <section className="set-sec">
          <h2>Installer l’appli</h2>
          <dl className="howto">
            <dt>MAC</dt>
            <dd>Chrome ou Edge : icône d’installation à droite de la barre d’adresse. Safari : Fichier, puis Ajouter au Dock.</dd>
            <dt>PC</dt>
            <dd>Chrome ou Edge : icône d’installation à droite de la barre d’adresse.</dd>
            <dt>TÉL.</dt>
            <dd>Menu Partager, puis Sur l’écran d’accueil.</dd>
          </dl>
        </section>
      </div>
    </>
  )
}

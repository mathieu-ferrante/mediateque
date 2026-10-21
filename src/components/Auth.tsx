import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!password) {
      setMsg({ ok: false, text: 'Mot de passe manquant. Tape-le pour continuer.' })
      return
    }
    setBusy(true)
    setMsg(null)
    const { data, error } =
      mode === 'login'
        ? await supabase!.auth.signInWithPassword({ email, password })
        : await supabase!.auth.signUp({ email, password, options: { emailRedirectTo: location.href } })
    setBusy(false)
    if (error) {
      const t = error.message.includes('Invalid login')
        ? 'Email ou mot de passe incorrect.'
        : error.message.includes('Email not confirmed')
          ? 'Confirme d’abord ton email avec le lien reçu, puis reconnecte-toi.'
          : error.message.includes('Password should be')
            ? 'Le mot de passe doit faire au moins 6 caractères.'
            : error.message
      setMsg({ ok: false, text: t })
    } else if (mode === 'signup' && !data.session) {
      setMsg({ ok: true, text: 'Compte créé. Clique sur le lien reçu par email, puis reviens te connecter.' })
      setMode('login')
    }
  }

  return (
    <div className="login">
      <form className="login-box" onSubmit={submit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="perf" />
          <h1>Médiathèque</h1>
          <span className="ink2">
            {mode === 'login' ? 'Connecte-toi pour retrouver ta pile sur ce Mac ou ce PC.' : 'Crée ton compte. Utilise le même sur tous tes appareils.'}
          </span>
        </div>
        <label className="field">
          <span className="label">Email</span>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="field">
          <span className="label">Mot de passe</span>
          <input
            className={`input ${msg && !msg.ok && !password ? 'err' : ''}`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </label>
        {msg && <span className={msg.ok ? 'ok-msg' : 'field-err'}>{msg.text}</span>}
        <button className="btn-acc" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>
        <button type="button" className="link-btn muted" onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setMsg(null) }}>
          {mode === 'login' ? 'Première fois ? Créer un compte' : 'J’ai déjà un compte'}
        </button>
      </form>
    </div>
  )
}

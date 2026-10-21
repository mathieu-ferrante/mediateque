export interface Settings {
  ollamaUrl: string
  ollamaModel: string
  lastRefresh: number
  theme: 'system' | 'light' | 'dark'
}

const KEY = 'mediatheque.settings'
const DEFAULTS: Settings = { ollamaUrl: 'http://localhost:11434', ollamaModel: '', lastRefresh: 0, theme: 'system' }

export function loadSettings(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...loadSettings(), ...patch }
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}

/** Applique le thème choisi (attribut data-theme sur <html>). */
export function applyTheme(theme: Settings['theme'] = loadSettings().theme) {
  const el = document.documentElement
  if (theme === 'system') el.removeAttribute('data-theme')
  else el.setAttribute('data-theme', theme)
}

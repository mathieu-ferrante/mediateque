import { norm, type Mood, MOODS } from './picker'
import type { Item, MediaType } from './types'
import { TYPE_LABEL } from './types'

export interface Suggestion {
  titre: string
  annee: number | null
  type: MediaType
  raison: string
}

export class OllamaError extends Error {}

export async function listModels(url: string): Promise<string[]> {
  let res: Response
  try {
    res = await fetch(`${url.replace(/\/$/, '')}/api/tags`, { signal: AbortSignal.timeout(5000) })
  } catch {
    throw new OllamaError(
      "Impossible de joindre Ollama. Vérifie qu'il tourne sur cette machine et qu'il autorise cette appli (voir le guide : OLLAMA_ORIGINS).",
    )
  }
  if (!res.ok) throw new OllamaError(`Ollama a répondu ${res.status}`)
  const data = await res.json()
  return (data.models ?? []).map((m: { name: string }) => m.name)
}

const line = (i: Item) =>
  `- ${i.title}${i.year ? ` (${i.year})` : ''} [${TYPE_LABEL[i.type]}]${i.rating ? ` note ${i.rating}/10` : ''}${
    i.genres.length ? ` — ${i.genres.slice(0, 3).join(', ')}` : ''
  }`

export function buildPrompt(items: Item[], type: MediaType | 'tout', mood: Mood | null, count = 6): string {
  const rated = items.filter((i) => i.rating != null).sort((a, b) => b.rating! - a.rating!)
  const loved = rated.filter((i) => i.rating! >= 8 || i.favorite).slice(0, 25)
  const disliked = rated.filter((i) => i.rating! <= 5).slice(0, 10)
  const current = items.filter((i) => i.status === 'en_cours').slice(0, 8)
  const moodLabel = mood ? MOODS.find((m) => m.id === mood)?.label : null
  const what = type === 'tout' ? 'films, séries, jeux vidéo ou livres (mélange)' : `${TYPE_LABEL[type].toLowerCase()}s`

  return [
    `Tu es un conseiller culturel. Propose ${count} ${what} que cette personne n'a PAS encore et qui devraient lui plaire.`,
    moodLabel ? `Humeur du moment : ${moodLabel}.` : '',
    loved.length ? `Ce qu'elle a adoré :\n${loved.map(line).join('\n')}` : "Elle n'a encore rien noté : propose des valeurs sûres variées.",
    disliked.length ? `Ce qu'elle n'a pas aimé (à éviter dans le même style) :\n${disliked.map(line).join('\n')}` : '',
    current.length ? `En cours actuellement :\n${current.map(line).join('\n')}` : '',
    'Règles : uniquement des œuvres qui existent réellement, titre tel que connu en France, ' +
      'année de sortie exacte si tu la connais, raison courte (une phrase) qui fait le lien avec ses goûts. ' +
      `Champ "type" parmi : film, serie, jeu, livre. Réponds en JSON.`,
  ]
    .filter(Boolean)
    .join('\n\n')
}

const SCHEMA = {
  type: 'object',
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          titre: { type: 'string' },
          annee: { type: ['integer', 'null'] },
          type: { type: 'string', enum: ['film', 'serie', 'jeu', 'livre'] },
          raison: { type: 'string' },
        },
        required: ['titre', 'type', 'raison'],
      },
    },
  },
  required: ['suggestions'],
}

export function parseSuggestions(content: string, items: Item[], type: MediaType | 'tout'): Suggestion[] {
  let data: { suggestions?: Partial<Suggestion>[] }
  try {
    data = JSON.parse(content)
  } catch {
    const m = content.match(/\{[\s\S]*\}/)
    if (!m) throw new OllamaError("Réponse de l'IA illisible, réessaie.")
    data = JSON.parse(m[0])
  }
  const known = new Set(items.flatMap((i) => [norm(i.title), i.original_title ? norm(i.original_title) : '']).filter(Boolean))
  const types: MediaType[] = ['film', 'serie', 'jeu', 'livre']
  return (data.suggestions ?? [])
    .filter((s): s is Suggestion => !!s?.titre && types.includes(s.type as MediaType))
    .filter((s) => type === 'tout' || s.type === type)
    .filter((s) => !known.has(norm(s.titre)))
    .map((s) => ({ titre: s.titre, annee: s.annee ?? null, type: s.type, raison: s.raison ?? '' }))
}

export async function recommend(
  url: string,
  model: string,
  items: Item[],
  type: MediaType | 'tout',
  mood: Mood | null,
): Promise<Suggestion[]> {
  const prompt = buildPrompt(items, type, mood)
  let res: Response
  try {
    res = await fetch(`${url.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: SCHEMA,
        options: { temperature: 0.8 },
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(180_000),
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') throw new OllamaError("L'IA a mis trop de temps à répondre.")
    throw new OllamaError("Impossible de joindre Ollama depuis cette machine.")
  }
  if (!res.ok) throw new OllamaError(`Ollama a répondu ${res.status} : ${(await res.text()).slice(0, 200)}`)
  const data = await res.json()
  return parseSuggestions(data.message?.content ?? '', items, type)
}

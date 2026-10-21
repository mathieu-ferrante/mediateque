import type { NewItem } from './store'
import { emptyInfo, type Item, type MediaType, type Status } from './types'

const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString()
const dayIso = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10)

interface Seed {
  info: NewItem
  extra: Partial<Item>
}

function s(
  type: MediaType,
  title: string,
  o: Partial<NewItem> & { status: Status; addedDaysAgo: number; finishedDaysAgo?: number },
): Seed {
  const { addedDaysAgo, finishedDaysAgo, ...rest } = o
  return {
    info: { ...emptyInfo(type, title), source: 'demo', source_id: `${type}-${title}`, ...rest },
    extra: {
      added_at: daysAgo(addedDaysAgo),
      finished_at: finishedDaysAgo != null ? daysAgo(finishedDaysAgo) : null,
      started_at: o.status === 'en_cours' || finishedDaysAgo != null ? daysAgo((finishedDaysAgo ?? 0) + 5) : null,
    },
  }
}

/** Quelques fiches d'exemple pour essayer l'appli sans rien configurer. */
export function demoSeed(): Seed[] {
  return [
    s('film', 'Dune : Deuxième partie', { year: 2024, runtime_min: 166, genres: ['Science-Fiction', 'Aventure'], creator: 'Denis Villeneuve', status: 'termine', rating: 9, addedDaysAgo: 200, finishedDaysAgo: 40 }),
    s('film', 'Le Comte de Monte-Cristo', { year: 2024, runtime_min: 178, genres: ['Aventure', 'Drame', 'Histoire'], status: 'a_voir', addedDaysAgo: 320 }),
    s('film', 'The Grand Budapest Hotel', { year: 2014, runtime_min: 100, genres: ['Comédie', 'Drame'], creator: 'Wes Anderson', status: 'a_voir', addedDaysAgo: 40 }),
    s('film', 'Alien : Romulus', { year: 2024, runtime_min: 119, genres: ['Horreur', 'Science-Fiction', 'Thriller'], status: 'a_voir', addedDaysAgo: 12 }),
    s('film', 'Oppenheimer', { year: 2023, runtime_min: 180, genres: ['Drame', 'Histoire'], status: 'termine', rating: 8, addedDaysAgo: 400, finishedDaysAgo: 75 }),
    s('serie', 'Severance', { year: 2022, runtime_min: 50, seasons: 2, episodes: 19, total_min: 950, genres: ['Science-Fiction', 'Mystère', 'Drame'], status: 'en_cours', progress: 'S2E4', addedDaysAgo: 90 }),
    s('serie', 'The Bear', { year: 2022, runtime_min: 30, seasons: 4, episodes: 38, total_min: 1140, genres: ['Comédie', 'Drame'], status: 'a_voir', addedDaysAgo: 60, next_release_date: dayIso(18), next_release_label: 'Saison 5 bientôt' }),
    s('serie', 'Arcane', { year: 2021, runtime_min: 40, seasons: 2, episodes: 18, total_min: 720, genres: ['Animation', 'Science-Fiction & Fantastique', 'Action & Aventure'], status: 'termine', rating: 10, favorite: true, addedDaysAgo: 500, finishedDaysAgo: 18 }),
    s('serie', 'Shōgun', { year: 2024, runtime_min: 60, seasons: 1, episodes: 10, total_min: 600, genres: ['Drame', 'War & Politics'], status: 'a_voir', addedDaysAgo: 250 }),
    s('jeu', 'Hades II', { year: 2025, total_min: 30 * 60, genres: ['Role-playing (RPG)', 'Hack and slash/Beat \'em up', 'Indie'], platforms: ['PC', 'Switch 2'], status: 'en_cours', addedDaysAgo: 30 }),
    s('jeu', 'The Witcher 3: Wild Hunt', { year: 2015, total_min: 52 * 60, genres: ['Role-playing (RPG)', 'Adventure'], platforms: ['PC', 'PS5'], status: 'a_voir', addedDaysAgo: 700 }),
    s('jeu', 'Outer Wilds', { year: 2019, total_min: 22 * 60, genres: ['Adventure', 'Puzzle', 'Indie'], platforms: ['PC'], status: 'termine', rating: 9, addedDaysAgo: 365, finishedDaysAgo: 55 }),
    s('jeu', 'Jeu très attendu (exemple)', { year: null, genres: ['Adventure'], status: 'attendu', addedDaysAgo: 5, next_release_date: dayIso(45), next_release_label: null }),
    s('livre', 'Projet Dernière Chance', { year: 2021, pages: 496, genres: ['Science-fiction'], creator: 'Andy Weir', status: 'a_voir', addedDaysAgo: 120 }),
    s('livre', 'Le Problème à trois corps', { year: 2016, pages: 432, genres: ['Science-fiction'], creator: 'Liu Cixin', status: 'en_cours', progress: 'page 180', addedDaysAgo: 45 }),
    s('livre', 'Le Nom du vent', { year: 2009, pages: 662, genres: ['Fantasy'], creator: 'Patrick Rothfuss', status: 'termine', rating: 8, addedDaysAgo: 600, finishedDaysAgo: 420 }),
  ]
}

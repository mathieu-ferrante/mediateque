# Médiathèque

Appli perso pour suivre films, séries, jeux vidéo et livres, synchronisée entre Mac et PC.

- **Bibliothèque** : ajout en tapant le titre (fiches auto via TMDB, IGDB, Google Books), statuts, notes sur 10, avis, progression, favoris, filtres et tri
- **Ce soir** : tirage selon le temps dispo, l'humeur et le type, en tenant compte de ce que tu as commencé et de ce que tu notes bien
- **Ma pile** : ce qui reste, temps estimé pour tout finir, rythme, titres courts à liquider, titres qui traînent
- **Sorties** : prochains épisodes et saisons, films et jeux attendus (vérifiés chaque jour)
- **Pour toi** : suggestions dans ta pile selon tes goûts, et découvertes proposées par ton IA locale (Ollama)
- **Réglages** : export et import JSON, configuration d'Ollama

Techno : React + Vite (PWA installable), Supabase (base, comptes, fonction edge), hébergement GitHub Pages.

Sans configuration, l'appli démarre en **mode démo** (données d'exemple dans le navigateur).

➡️ Mise en ligne : voir [INSTALLATION.md](INSTALLATION.md).

## Structure

```
src/
  App.tsx                 navigation, en-tête
  components/             écrans (Library, Tonight, Backlog, Releases, ForYou, Settings, AddDialog, ItemDetail, Auth)
  lib/
    store.ts              accès aux données (Supabase ou mode démo)
    providers.ts          recherche (livres en direct, films/séries/jeux via la fonction edge)
    picker.ts             « Ce soir je fais quoi ? » + affinités de genres
    stats.ts              pile, sorties, ce qu'il faut rafraîchir
    ollama.ts             recommandations IA locales
supabase/
  migrations/001_mediatheque.sql   table + sécurité (RLS)
  functions/media/index.ts         proxy TMDB / IGDB (clés en secrets)
tests/logic.test.ts       tests de la logique (npm test)
.github/workflows/        publication GitHub Pages + anti-pause Supabase
```

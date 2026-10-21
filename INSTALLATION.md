# Médiathèque : mise en ligne pas à pas

Compte environ 30 minutes, à faire une seule fois depuis le Mac. À la fin, l'appli est en ligne à une adresse du type `https://TON-PSEUDO.github.io/mediatheque/`, installable sur le Mac et sur le PC, avec la synchro automatique.

Ce que tu vas faire :

1. Préparer la base Supabase (table + compte)
2. Créer les deux clés gratuites (TMDB pour films et séries, Twitch pour les jeux)
3. Installer la fonction de recherche dans Supabase
4. Mettre le code sur GitHub et activer la publication
5. Installer l'appli sur le Mac et le PC
6. (Optionnel) Brancher Ollama pour les recommandations IA

Les livres n'ont besoin d'aucune clé (Google Books, avec Open Library en secours).

---

## 1. Supabase

1. Sur [supabase.com/dashboard](https://supabase.com/dashboard) : **New project**.
   - Nom : `mediatheque`
   - Mot de passe de la base : génère-le et garde-le (il ne servira presque jamais)
   - Région : **West EU (Paris)**
2. Une fois le projet prêt : menu **SQL Editor** → **New query**. Colle tout le contenu du fichier `supabase/migrations/001_mediatheque.sql`, puis **Run**. Le message « Success. No rows returned » est normal.
3. Menu **Authentication** → **Sign In / Providers** → **Email** : laisse activé. Pour aller plus vite, tu peux désactiver **Confirm email** (sinon tu devras cliquer sur un lien reçu par mail à la création du compte).
4. Menu **Project Settings** → **API Keys** (ou **Data API**) : note deux valeurs, elles serviront à l'étape 4.
   - **Project URL** : `https://xxxxxxxx.supabase.co`
   - La clé publique : **anon public**, ou **publishable** (`sb_publishable_…`) sur les projets récents

> La clé publique peut se trouver dans le code de la page sans risque : la table est protégée, chacun ne voit que ses propres fiches (règles RLS du fichier SQL). Ne mets **jamais** la clé `service_role` / `secret` dans l'appli.

## 2. Les clés gratuites

### TMDB (films et séries)

1. Crée un compte sur [themoviedb.org](https://www.themoviedb.org/signup).
2. Va dans **Paramètres** → **API** → demande une clé (type « Developer », usage personnel ; le formulaire est rapide).
3. Copie le **Jeton d'accès en lecture à l'API** (API Read Access Token, une longue chaîne qui commence par `eyJ…`). C'est lui qu'il faut, pas la « Clé d'API » courte.

### Twitch (jeux, via IGDB)

1. Connecte-toi sur [dev.twitch.tv/console](https://dev.twitch.tv/console) avec un compte Twitch. Twitch exige que l'**authentification à deux facteurs** soit activée sur ce compte.
2. **Applications** → **Enregistrer votre application** :
   - Nom : `mediatheque-perso` (le nom doit être unique, ajoute ton pseudo si besoin)
   - URL de redirection OAuth : `http://localhost`
   - Catégorie : **Application Integration**
   - Type de client : **Confidentiel**
3. Ouvre l'application créée → copie l'**ID client** → clique **Nouveau secret** et copie le **secret client**.

## 3. La fonction de recherche dans Supabase

Elle fait le lien avec TMDB et IGDB en gardant tes clés secrètes côté serveur.

1. Dans Supabase : menu **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Nom de la fonction : `media` (exactement).
3. Remplace tout le code d'exemple par le contenu du fichier `supabase/functions/media/index.ts`, puis **Deploy function**.
4. Toujours dans **Edge Functions** → **Secrets** → ajoute trois secrets :

| Nom | Valeur |
|---|---|
| `TMDB_TOKEN` | le jeton TMDB `eyJ…` |
| `TWITCH_CLIENT_ID` | l'ID client Twitch |
| `TWITCH_CLIENT_SECRET` | le secret client Twitch |

Laisse l'option **Verify JWT** activée : seule ton appli, une fois connectée, peut utiliser la fonction.

> Alternative en ligne de commande, si tu préfères : `npx supabase login`, puis `npx supabase link --project-ref xxxxxxxx` et `npx supabase functions deploy media`.

## 4. GitHub : mise en ligne

### 4.1 Créer le dépôt et envoyer le code

1. Sur GitHub : **New repository** → nom `mediatheque` → **Public** (GitHub Pages est gratuit pour les dépôts publics ; aucune clé secrète n'est dans le code) → **Create repository** sans README.
2. Dans le Terminal du Mac, depuis le dossier décompressé :

```bash
cd ~/chemin/vers/mediatheque
git init
git add .
git commit -m "Médiathèque v1"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/mediatheque.git
git push -u origin main
```

Si `git` n'est pas installé, macOS proposera de l'installer (outils de développement Xcode). Pour le mot de passe demandé au `push`, GitHub n'accepte plus le mot de passe du compte. Utilise soit **GitHub Desktop** (Add existing repository → Publish), soit `gh auth login` si tu as l'outil `gh`.

> Le dossier `.github` est masqué dans le Finder (Cmd + Maj + . pour l'afficher). Il doit bien partir sur GitHub, car il contient la publication automatique.

### 4.2 Donner les clés Supabase à GitHub

Dépôt → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**, deux fois :

| Nom | Valeur |
|---|---|
| `SUPABASE_URL` | la Project URL de l'étape 1 |
| `SUPABASE_ANON_KEY` | la clé publique de l'étape 1 |

### 4.3 Activer GitHub Pages

1. Dépôt → **Settings** → **Pages** → **Source** : **GitHub Actions**.
2. Onglet **Actions** → workflow **Déploiement** → **Run workflow**. Il relance aussi les tests automatiquement.
3. Au bout d'une minute environ, l'adresse s'affiche dans le workflow : `https://TON-PSEUDO.github.io/mediatheque/`.

### 4.4 Dernier réglage Supabase

**Authentication** → **URL Configuration** → **Site URL** : colle l'adresse GitHub Pages. Les éventuels mails de confirmation pointeront alors vers ton appli.

## 5. Première utilisation

1. Ouvre l'adresse → **Créer mon compte** (email + mot de passe). Utilise **le même compte** sur le Mac et le PC : c'est ce qui synchronise tout.
2. Installe-la comme une appli :
   - **Mac, Chrome ou Edge** : icône « Installer » à droite de la barre d'adresse
   - **Mac, Safari** : menu Fichier → **Ajouter au Dock**
   - **PC Windows, Chrome ou Edge** : icône « Installer » dans la barre d'adresse (ou menu ⋯ → Applications → Installer)
3. Teste l'ajout : bouton **+ Ajouter** (ou touche **N**), puis cherche un film, une série, un jeu ou un livre.

La synchro est automatique : chaque modification part tout de suite dans la base, et l'appli se recharge quand tu reviens dessus. Les dates de sortie (nouvelles saisons, épisodes, jeux attendus) sont vérifiées une fois par jour à l'ouverture, ou à la demande dans **Sorties** → **Vérifier maintenant**.

## 6. Recommandations avec Ollama (optionnel)

Ça marche sur la machine où Ollama tourne (le Mac). L'appli sur le PC fonctionne normalement, juste sans cette partie, sauf si tu installes aussi Ollama sur le PC.

1. Autorise ton appli à parler à Ollama. Dans le Terminal du Mac (remplace TON-PSEUDO) :

```bash
launchctl setenv OLLAMA_ORIGINS "https://TON-PSEUDO.github.io"
```

Ensuite, quitte Ollama (icône dans la barre des menus → Quit) et relance-le. Ce réglage saute au redémarrage du Mac : pour le rendre permanent, ajoute la même commande dans un fichier lancé à la connexion, ou relance-la après un redémarrage.

2. Un petit modèle adapté à 8 Go de RAM, si tu n'en as pas déjà un :

```bash
ollama pull qwen2.5:3b
```

3. Dans l'appli : **Réglages** → **IA locale** → **Tester la connexion** → choisis le modèle.
4. **Pour toi** → **Me proposer des découvertes**.

À savoir :

- **Utilise l'appli installée via Chrome ou Edge pour l'IA.** Safari peut bloquer l'accès d'un site en ligne à `localhost`.
- Chrome peut demander l'autorisation « accéder aux appareils du réseau local » : accepte.
- Un modèle de 3B met de 20 secondes à 1 minute à répondre sur un M2 avec 8 Go.

## Entretien

- **Anti-mise en pause** : le workflow `Anti-pause Supabase` interroge la base tous les 3 jours, donc elle ne s'endort jamais. GitHub coupe les tâches planifiées d'un dépôt public après 60 jours sans commit et prévient par mail : il suffit alors de cliquer **Enable workflow** dans l'onglet Actions. Si la base s'est quand même endormie, clique **Restore** dans le tableau de bord Supabase (rien n'est perdu).
- **Sauvegarde** : **Réglages** → **Exporter** produit un fichier JSON, réimportable n'importe quand.
- **Mettre à jour l'appli** : modifie le code puis `git push`. La publication se refait seule, et l'appli installée se met à jour à la prochaine ouverture.

## Tester en local (facultatif)

Il faut Node.js 20 ou plus.

```bash
npm install
npm run dev        # mode démo si aucune base n'est configurée
npm test           # tests automatiques
```

Pour utiliser ta vraie base en local : copie `.env.example` en `.env.local` et remplis les deux valeurs.

## En cas de souci

| Symptôme | Cause probable |
|---|---|
| « Clé TMDB manquante » ou « Clés Twitch/IGDB manquantes » | secret absent ou mal nommé (étape 3) |
| Recherche film/jeu : erreur 401 ou « Invalid JWT » | tu n'es pas connecté, ou la fonction ne s'appelle pas `media` |
| « TMDB 401 » | tu as copié la clé courte au lieu du jeton `eyJ…` |
| « Twitch 400/403 » | ID ou secret Twitch erroné ; régénère le secret |
| Page blanche sur GitHub Pages | secrets `SUPABASE_URL` / `SUPABASE_ANON_KEY` manquants, ou Source Pages pas réglée sur GitHub Actions |
| « Impossible de joindre Ollama » | `OLLAMA_ORIGINS` pas pris en compte (relance Ollama), ou tu es sur Safari |

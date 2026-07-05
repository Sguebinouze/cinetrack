# CineTrack

Application mobile-first de suivi de films et séries.

## Stack

- **Client** : React + Vite + TailwindCSS + React Query
- **Server** : Node.js + Express + Prisma + SQLite
- **Data** : TMDB API

## Démarrage

### Prérequis

- Node.js 18+
- Clé API TMDB (gratuite sur [themoviedb.org](https://www.themoviedb.org/settings/api))

### Installation

```bash
# Server
cd server
npm install
cp .env.example .env
# Remplir TMDB_API_KEY dans .env
npx prisma migrate dev
npm run dev

# Client (dans un autre terminal)
cd client
npm install
npm run dev
```

L'app est accessible sur `http://localhost:5173`

## Fonctionnalités

- Recherche et découverte via TMDB (films, séries, tendances)
- Watchlist avec statuts : À voir / En cours / Vu / Abandonné
- Notes (étoiles) et avis privés
- Suivi d'épisodes pour les séries
- Statistiques : temps visionné, genres favoris, activité mensuelle
- Design mobile-first (PWA-ready)

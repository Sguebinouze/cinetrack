-- Programme TV de la TNT française (30 chaînes), fenêtre glissante J-2 → J+4.
--
-- Ces deux tables sont un miroir local de xmltvfr.fr, peuplé UNIQUEMENT par
-- scripts/import-tv-guide.mjs (lancé chaque jour par GitHub Actions). Rien dans
-- l'API n'y écrit : les Pages Functions n'ont pas de cron et le plan gratuit
-- plafonne à 10 ms de CPU, parser 7 Mo de XML y est impossible.
--
-- Aucun lien avec Media / WatchEntry : le programme TV est une donnée de flux,
-- jetable et réimportée en entier chaque nuit, pas du catalogue personnel.
-- Migration purement additive.

CREATE TABLE IF NOT EXISTS TvChannel (
  -- Identifiant XMLTV de la source (« TF1.fr »), stable d'un import à l'autre.
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  logo     TEXT,
  -- Ordre d'apparition dans le flux, qui est l'ordre des canaux TNT (TF1 = 0).
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS TvProgram (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  channelId   TEXT NOT NULL REFERENCES TvChannel(id) ON DELETE CASCADE,
  -- ISO 8601 avec décalage (« 2026-09-20T21:10:00+02:00 »).
  startsAt    TEXT NOT NULL,
  endsAt      TEXT,
  -- Jour de GRILLE 'AAAA-MM-JJ', pas le jour calendaire : ce qui commence avant
  -- 5h du matin appartient encore à la soirée de la veille, comme dans n'importe
  -- quel magazine TV. C'est la colonne sur laquelle la page filtre.
  day         TEXT NOT NULL,
  title       TEXT NOT NULL,
  -- Titre d'épisode pour les séries, sujet du numéro pour les magazines.
  subTitle    TEXT,
  description TEXT,
  -- Tableau JSON (« ["Film","Action"] »), comme Media.genres.
  categories  TEXT,
  imageUrl    TEXT,
  year        INTEGER,
  director    TEXT,
  actors      TEXT,
  -- « S3E4 », dérivé de episode-num ; NULL si la source ne numérote pas.
  episodeLabel TEXT,
  -- Signalétique CSA (« Tout public », « Déconseillé aux moins de 10 ans »).
  csa         TEXT,
  -- Ce qui rend l'import idempotent : un réimport partiel ne duplique rien.
  UNIQUE(channelId, startsAt)
);

-- L'écran affiche un jour entier, chaîne par chaîne, dans l'ordre horaire :
-- l'index couvre la requête de bout en bout, sans tri à faire.
CREATE INDEX IF NOT EXISTS idx_tvprogram_day ON TvProgram(day, channelId, startsAt);

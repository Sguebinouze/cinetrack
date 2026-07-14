-- Enrichissement TVmaze : TMDB ne fournit qu'une date de diffusion, et elle est
-- systématiquement fausse d'un jour sur les séries Apple TV+ (Silo S2 : TMDB dit
-- jeudi, Apple a diffusé le vendredi). TVmaze donne la bonne date, et l'instant
-- exact (airstamp) pour les chaînes linéaires.
--
-- Migration purement additive : aucune colonne existante n'est modifiée ni supprimée.

-- Identifiant TVmaze de la série, résolu une seule fois via l'imdb_id de TMDB.
-- Stable dans le temps : jamais recalculé une fois renseigné.
ALTER TABLE Media ADD COLUMN tvmazeId INTEGER;

-- Instant de diffusion ISO-8601 avec fuseau (« 2026-07-19T01:00:00+00:00 »).
-- NULL tant que la série n'a pas été enrichie, ou si TVmaze ne la connaît pas :
-- dans ce cas airDate (TMDB) reste la seule source, et le repli est transparent.
ALTER TABLE Episode ADD COLUMN airstamp TEXT;

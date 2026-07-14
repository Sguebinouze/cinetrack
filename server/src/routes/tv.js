const router = require('express').Router()
const prisma = require('../lib/prisma')
const tvmaze = require('../services/tvmaze')

// GET /api/tv/:tmdbId/next-episode — prochain épisode, dates TVmaze.
//
// Volontairement indépendant de la synchro : le badge doit s'afficher même sur une
// série qu'on vient de découvrir. Renvoie null si TVmaze ne connaît pas la série —
// le client retombe alors sur next_episode_to_air de TMDB.
router.get('/:tmdbId/next-episode', async (req, res) => {
  try {
    const tmdbId = Number(req.params.tmdbId)

    // L'id TVmaze est mis en cache sur Media : le mapping est stable, jamais recalculé.
    const media = await prisma.media.findUnique({ where: { tmdbId } })
    let showId = media?.tvmazeId
    if (!showId) {
      showId = await tvmaze.resolveShowId(tmdbId)
      if (!showId) return res.json(null)
      if (media) await prisma.media.update({ where: { id: media.id }, data: { tvmazeId: showId } })
    }

    const show = await tvmaze.getShowWithNextEpisode(showId)
    const next = show?._embedded?.nextepisode
    if (!next) return res.json(null)

    res.json({
      kind: tvmaze.showKind(show),
      channel: tvmaze.showChannel(show),
      season: next.season,
      episode: next.number,
      name: next.name || null,
      airdate: next.airdate,
      // airtime vide ⇒ pas d'heure réelle (plateforme). airstamp ne vaut alors rien.
      airtime: next.airtime || null,
      airstamp: next.airstamp || null,
    })
  } catch {
    res.json(null) // TVmaze indisponible : repli silencieux sur TMDB
  }
})

module.exports = router

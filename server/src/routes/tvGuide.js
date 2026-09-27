const router = require('express').Router()
const prisma = require('../lib/prisma')

// Miroir dev de la section « PROGRAMME TV » de functions/api/[[path]].js.
// Lecture seule : les tables sont remplies par `npm run tv:import:local`.
//
// La grille est servie SANS les résumés — 700 programmes par jour × 500 caractères
// de texte qu'on jetterait pour afficher des horaires. Le détail est chargé à
// l'ouverture d'un programme.

const parseJsonColumn = (v) => { try { return v ? JSON.parse(v) : [] } catch { return [] } }

// GET /api/tv-guide?day=AAAA-MM-JJ — la grille d'un jour, chaîne par chaîne
router.get('/', async (req, res) => {
  try {
    const [days, channels] = await Promise.all([
      prisma.tvProgram.findMany({ distinct: ['day'], select: { day: true }, orderBy: { day: 'asc' } }),
      prisma.tvChannel.findMany({ select: { id: true, name: true, logo: true }, orderBy: { position: 'asc' } }),
    ])
    // Jour de GRILLE courant (avant 5h ⇒ soirée de la veille, comme TvProgram.day).
    // On ne sert rien d'antérieur à la veille : entre minuit et le cron du matin, la
    // base contient encore l'avant-veille, qui ne doit pas réapparaître.
    const tvDay = (offsetDays) =>
      new Date(Date.now() - 5 * 3_600_000 + offsetDays * 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
    const today = tvDay(0)
    const yesterday = tvDay(-1)
    const available = days.map(d => d.day).filter(d => d >= yesterday)
    if (!available.length) return res.json({ days: [], day: null, channels: [] })

    const asked = req.query.day
    // Jour demandé, ou ce soir s'il est dans la fenêtre, ou le premier connu.
    const day = available.includes(asked) ? asked : (available.includes(today) ? today : available[0])

    const programs = await prisma.tvProgram.findMany({
      where: { day },
      select: {
        id: true, channelId: true, startsAt: true, endsAt: true,
        title: true, subTitle: true, categories: true, episodeLabel: true,
      },
      orderBy: [{ channelId: 'asc' }, { startsAt: 'asc' }],
    })

    // `channelId` sert au regroupement puis disparaît : il est déjà porté par la
    // chaîne qui contient la liste, le répéter 800 fois ne fait qu'alourdir.
    const byChannel = new Map(channels.map(ch => [ch.id, []]))
    for (const { channelId, categories, ...p } of programs) {
      byChannel.get(channelId)?.push({ ...p, categories: parseJsonColumn(categories) })
    }

    res.json({
      days: available,
      day,
      // Une chaîne sans programme ce jour-là n'a rien à montrer.
      channels: channels
        .map(ch => ({ ...ch, programs: byChannel.get(ch.id) || [] }))
        .filter(ch => ch.programs.length),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// GET /api/tv-guide/program/:id — la fiche complète, résumé et casting inclus
router.get('/program/:id', async (req, res) => {
  try {
    const program = await prisma.tvProgram.findUnique({
      where: { id: Number(req.params.id) },
      include: { channel: { select: { id: true, name: true, logo: true } } },
    })
    if (!program) return res.status(404).json({ error: 'Program not found' })
    res.json({
      ...program,
      categories: parseJsonColumn(program.categories),
      actors: parseJsonColumn(program.actors),
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router

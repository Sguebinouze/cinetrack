const router = require('express').Router()
const prisma = require('../lib/prisma')

// GET /api/lists — toutes les listes avec leurs items
router.get('/', async (req, res) => {
  try {
    const lists = await prisma.customList.findMany({
      include: { items: { include: { media: true } } },
      orderBy: { createdAt: 'desc' },
    })
    res.json(lists)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/lists — créer une liste
router.post('/', async (req, res) => {
  try {
    const { name } = req.body
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' })
    const list = await prisma.customList.create({ data: { name: name.trim() } })
    res.json({ ...list, items: [] })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/lists/:id
router.delete('/:id', async (req, res) => {
  try {
    await prisma.customList.delete({ where: { id: Number(req.params.id) } })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// POST /api/lists/:id/items — ajouter un titre à une liste
router.post('/:id/items', async (req, res) => {
  try {
    const { tmdbId } = req.body
    const media = await prisma.media.findUnique({ where: { tmdbId: Number(tmdbId) } })
    if (!media) return res.status(404).json({ error: 'Media not found — ajoute-le d\'abord à ta liste principale' })

    const item = await prisma.customListItem.upsert({
      where: { listId_mediaId: { listId: Number(req.params.id), mediaId: media.id } },
      update: {},
      create: { listId: Number(req.params.id), mediaId: media.id },
      include: { media: true },
    })
    res.json(item)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// DELETE /api/lists/:id/items/:mediaId
router.delete('/:id/items/:mediaId', async (req, res) => {
  try {
    await prisma.customListItem.delete({
      where: { listId_mediaId: { listId: Number(req.params.id), mediaId: Number(req.params.mediaId) } },
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

module.exports = router

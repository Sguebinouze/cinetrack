#!/usr/bin/env node
/**
 * Import du programme TV de la TNT française dans la D1.
 *
 * Source : https://xmltvfr.fr (généré chaque nuit par racacax/XML-TV-Fr, qui
 * agrège programme-tv.net & co). Le fichier TNT couvre 30 chaînes sur J-1 → J+8.
 *
 * ⚠️ Pourquoi un script Node et pas une route de l'API ?
 * Les Pages Functions n'ont pas de cron trigger (c'est une fonctionnalité Workers),
 * et le plan gratuit plafonne à 10 ms de CPU par invocation — parser 7 Mo de XML
 * est hors de portée. L'ingestion vit donc dans GitHub Actions (.github/workflows/
 * tv-guide.yml), et l'API se contente d'un SELECT.
 *
 * On ne garde que J-2 → J+4. J-2 n'est jamais dans le fichier source : il vient de
 * l'exécution de l'avant-veille, d'où le fait qu'on purge par fenêtre et qu'on ne
 * réécrit QUE les jours réellement présents dans le flux.
 *
 * Usage :
 *   node scripts/import-tv-guide.mjs            # génère les .sql dans var/tv-guide/
 *   node scripts/import-tv-guide.mjs --apply    # …puis les pousse dans la D1 (wrangler --remote)
 *   node scripts/import-tv-guide.mjs --apply --local   # …dans server/dev.db (backend Express)
 *
 * ⚠️ `--local` vise `server/dev.db`, la base du serveur de dev Express/Prisma —
 * PAS la D1 locale de `wrangler pages dev`, qui est un troisième magasin encore.
 */

import { gunzipSync } from 'node:zlib'
import { mkdirSync, writeFileSync, rmSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const SOURCE = 'https://xmltvfr.fr/xmltv/xmltv_tnt.xml.gz'
const OUT_DIR = 'var/tv-guide'
const DEV_DB = 'server/dev.db'
const DAYS_BEFORE = 2
const DAYS_AFTER = 4

// La grille d'une chaîne se lit par soirée : ce qui commence à 00h30 appartient
// encore au programme de la veille. Avant 5h du matin ⇒ jour TV précédent.
const TV_DAY_CUTOFF_HOUR = 5

// Un résumé de plus de 500 caractères n'est jamais lu en entier sur mobile, et
// multiplier ça par ~5 600 lignes ferait exploser la taille des fichiers SQL.
const MAX_DESC = 500
const MAX_ACTORS = 5

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const LOCAL = args.includes('--local')

// ── Parsing XMLTV ─────────────────────────────────────────
// Pas de dépendance : le format est plat et régulier, et ajouter un parseur XML
// aux deps racine (installées à chaque déploiement Pages) pour un script de CI
// serait payer tout le temps ce qui ne sert qu'une fois par jour.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, e) => ENTITIES[e])
    .replace(/\s+/g, ' ')
    .trim()

const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`))
  return m ? decode(m[1]) : null
}

const tagAll = (xml, name) =>
  [...xml.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g'))].map(m => decode(m[1]))

const attr = (xml, name, a) => {
  const m = xml.match(new RegExp(`<${name}[^>]*\\s${a}="([^"]*)"`))
  return m ? decode(m[1]) : null
}

/** `20260920211000 +0200` → `2026-09-20T21:10:00+02:00` (l'heure lue est déjà l'heure de Paris). */
function toIso(stamp) {
  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{2})(\d{2})$/)
  if (!m) return null
  const [, y, mo, d, h, mi, s, offH, offM] = m
  return `${y}-${mo}-${d}T${h}:${mi}:${s}${offH}:${offM}`
}

/** Jour de grille : la nuit (< 5h) appartient à la soirée précédente. */
function tvDay(stamp) {
  const m = stamp.match(/^(\d{4})(\d{2})(\d{2})(\d{2})/)
  if (!m) return null
  const [, y, mo, d, h] = m
  const date = new Date(Date.UTC(+y, +mo - 1, +d))
  if (+h < TV_DAY_CUTOFF_HOUR) date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().slice(0, 10)
}

/**
 * `<episode-num system="xmltv_ns">2.3.</episode-num>` — indices à partir de 0,
 * champs vides fréquents. On ne produit « S3E4 » que si les deux sont lisibles.
 */
function episodeLabel(xml) {
  const m = xml.match(/<episode-num system="xmltv_ns">([^<]*)<\/episode-num>/)
  if (!m) return null
  const [season, episode] = m[1].split('.').map(p => p.split('/')[0].trim())
  const s = season === '' ? null : Number(season) + 1
  const e = episode === '' || episode === undefined ? null : Number(episode) + 1
  if (!Number.isFinite(e)) return null
  return Number.isFinite(s) ? `S${s}E${e}` : `E${e}`
}

/**
 * Signalétique CSA. Le contenu de `<rating>` est lui-même balisé
 * (`<rating system="CSA"><value>Tout public</value></rating>`) : on descend
 * jusqu'au `<value>`, sinon on stocke le XML tel quel.
 */
function csaValue(xml) {
  const block = xml.match(/<rating[^>]*>([\s\S]*?)<\/rating>/)
  return block ? tag(block[1], 'value') : null
}

// Certaines chaînes suffixent le numéro de diffusion au titre
// (« Les Feux de l'amour (n°9571) ») : illisible en grille, et ça casserait tout
// rapprochement ultérieur avec TMDB.
const cleanTitle = (t) => t.replace(/\s*\(n°\s*\d+\)\s*$/i, '').trim()

function parse(xml) {
  const channels = [...xml.matchAll(/<channel id="([^"]+)">([\s\S]*?)<\/channel>/g)].map((m, i) => ({
    id: m[1],
    name: tag(m[2], 'display-name') || m[1],
    logo: attr(m[2], 'icon', 'src'),
    position: i,
  }))

  const programs = []
  for (const m of xml.matchAll(/<programme start="([^"]+)" stop="([^"]*)" channel="([^"]+)">([\s\S]*?)<\/programme>/g)) {
    const [, start, stop, channelId, body] = m
    const startsAt = toIso(start)
    const day = tvDay(start)
    const title = tag(body, 'title')
    if (!startsAt || !day || !title) continue

    const desc = tag(body, 'desc')
    // `<guest>` est pollué par les sociétés de production (« Sony Pictures
    // Entertainment » listé comme invité) : inexploitable, on l'ignore.
    const actors = tagAll(body, 'actor').slice(0, MAX_ACTORS)
    const year = Number(tag(body, 'date'))

    programs.push({
      channelId,
      startsAt,
      endsAt: stop ? toIso(stop) : null,
      day,
      title: cleanTitle(title),
      subTitle: tag(body, 'sub-title'),
      description: desc && desc.length > MAX_DESC ? `${desc.slice(0, MAX_DESC).trimEnd()}…` : desc,
      categories: tagAll(body, 'category'),
      imageUrl: attr(body, 'icon', 'src'),
      year: Number.isFinite(year) && year > 1800 ? year : null,
      director: tagAll(body, 'director')[0] || null,
      actors,
      episodeLabel: episodeLabel(body),
      csa: csaValue(body),
    })
  }
  return { channels, programs }
}

// ── Génération SQL ────────────────────────────────────────

const q = (v) => {
  if (v === null || v === undefined || v === '') return 'NULL'
  if (typeof v === 'number') return String(v)
  return `'${String(v).replace(/'/g, "''")}'`
}

const PROGRAM_COLS = '(channelId, startsAt, endsAt, day, title, subTitle, description, categories, imageUrl, year, director, actors, episodeLabel, csa)'

const programRow = (p) => `(${[
  q(p.channelId), q(p.startsAt), q(p.endsAt), q(p.day), q(p.title), q(p.subTitle), q(p.description),
  q(p.categories.length ? JSON.stringify(p.categories) : null), q(p.imageUrl), q(p.year), q(p.director),
  q(p.actors.length ? JSON.stringify(p.actors) : null), q(p.episodeLabel), q(p.csa),
].join(',')})`

/** Découpe en fichiers : `wrangler d1 execute --file` rechigne sur les gros payloads. */
const MAX_FILE_BYTES = 700_000

// ⚠️ D1 plafonne la LONGUEUR d'une instruction SQL (SQLITE_TOOBIG au-delà de
// ~100 Ko). Grouper par nombre de lignes ne protège de rien — un lot de films aux
// longs résumés pèse cinq fois un lot de bulletins météo. On groupe donc par
// taille, avec de la marge. SQLite en local avale les instructions géantes sans
// broncher : seule la D1 distante refuse, et l'import échouerait à moitié écrit.
const MAX_STATEMENT_BYTES = 40_000

/** Découpe les lignes en INSERT dont aucun ne dépasse MAX_STATEMENT_BYTES. */
function insertStatements(rows) {
  const statements = []
  let batch = []
  let size = 0
  const flush = () => {
    if (!batch.length) return
    statements.push(`INSERT OR IGNORE INTO TvProgram ${PROGRAM_COLS} VALUES\n${batch.join(',\n')};`)
    batch = []
    size = 0
  }
  for (const row of rows) {
    if (batch.length && size + row.length > MAX_STATEMENT_BYTES) flush()
    batch.push(row)
    size += row.length + 2
  }
  flush()
  return statements
}

function writeChunks(statements) {
  rmSync(OUT_DIR, { recursive: true, force: true })
  mkdirSync(OUT_DIR, { recursive: true })
  let buf = []
  let size = 0
  let n = 0
  const flush = () => {
    if (!buf.length) return
    writeFileSync(join(OUT_DIR, `${String(++n).padStart(3, '0')}.sql`), `${buf.join('\n')}\n`)
    buf = []
    size = 0
  }
  for (const s of statements) {
    if (size + s.length > MAX_FILE_BYTES) flush()
    buf.push(s)
    size += s.length
  }
  flush()
  return n
}

// ── Main ──────────────────────────────────────────────────

function windowDays() {
  const days = []
  const today = new Date(`${new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })}T00:00:00Z`)
  for (let i = -DAYS_BEFORE; i <= DAYS_AFTER; i++) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() + i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

const log = (...a) => console.log('[tv-guide]', ...a)

async function main() {
  log('téléchargement', SOURCE)
  const res = await fetch(SOURCE)
  if (!res.ok) throw new Error(`source injoignable : HTTP ${res.status}`)
  const xml = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8')
  log(`${(xml.length / 1e6).toFixed(1)} Mo de XML`)

  const { channels, programs } = parse(xml)
  log(`${channels.length} chaînes, ${programs.length} programmes dans le flux`)

  const days = windowDays()
  const from = days[0]
  const to = days[days.length - 1]
  const kept = programs.filter(p => p.day >= from && p.day <= to)
  const daysInPayload = [...new Set(kept.map(p => p.day))].sort()
  log(`fenêtre ${from} → ${to} : ${kept.length} programmes sur ${daysInPayload.join(', ')}`)

  if (!kept.length) throw new Error('aucun programme dans la fenêtre — flux suspect, on n’écrit rien')

  // Le flux commence au milieu d'un jour de grille : les programmes de J-1 entre
  // 00h et 5h sont rattachés à J-2, qui n'est donc présent que sous forme de bout
  // de nuit. Remplacer ce jour-là effacerait l'archive complète qu'on tient de
  // l'exécution d'avant-hier — on ne réécrit que les jours couverts de bout en bout
  // (l'heure murale suffit à comparer, le flux est entièrement en heure de Paris).
  const firstStart = kept.reduce((min, p) => (p.startsAt < min ? p.startsAt : min), kept[0].startsAt).slice(0, 19)
  const completeDays = daysInPayload.filter(d => `${d}T0${TV_DAY_CUTOFF_HOUR}:00:00` >= firstStart)
  const partial = daysInPayload.filter(d => !completeDays.includes(d))
  if (partial.length) log(`jours partiels conservés en l'état : ${partial.join(', ')}`)

  const statements = []
  for (const ch of channels) {
    statements.push(
      `INSERT INTO TvChannel (id, name, logo, position) VALUES (${q(ch.id)},${q(ch.name)},${q(ch.logo)},${ch.position}) ` +
      'ON CONFLICT(id) DO UPDATE SET name=excluded.name, logo=excluded.logo, position=excluded.position;'
    )
  }
  // Purge hors fenêtre : c'est ce qui fait expirer J-3 et au-delà.
  statements.push(`DELETE FROM TvProgram WHERE day < ${q(from)} OR day > ${q(to)};`)
  // Puis remplacement jour par jour, uniquement pour les jours complets. Les jours
  // partiels sont complétés sans rien effacer : le INSERT OR IGNORE ci-dessous
  // s'appuie sur UNIQUE(channelId, startsAt) pour ignorer ce qui est déjà là.
  for (const day of completeDays) statements.push(`DELETE FROM TvProgram WHERE day = ${q(day)};`)

  statements.push(...insertStatements(kept.map(programRow)))

  const files = writeChunks(statements)
  const bytes = readdirSync(OUT_DIR).reduce((t, f) => t + statSync(join(OUT_DIR, f)).size, 0)
  log(`${files} fichier(s) SQL dans ${OUT_DIR}/ (${(bytes / 1e6).toFixed(2)} Mo)`)

  if (!APPLY) return log('généré sans appliquer (--apply pour écrire dans la D1)')

  for (const f of readdirSync(OUT_DIR).sort()) {
    const file = join(OUT_DIR, f)
    log('application', f, LOCAL ? '→ server/dev.db' : '→ D1')
    if (LOCAL) {
      execFileSync('sqlite3', [DEV_DB], { input: `.read ${file}\n`, stdio: ['pipe', 'inherit', 'inherit'] })
    } else {
      execFileSync('npx', ['wrangler', 'd1', 'execute', 'cinetrack-db', '--remote', '--yes', '--file', file], {
        stdio: 'inherit',
      })
    }
  }
  log('terminé')
}

main().catch((e) => {
  console.error('[tv-guide] échec :', e.message)
  process.exit(1)
})

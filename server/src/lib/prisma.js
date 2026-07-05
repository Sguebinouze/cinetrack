require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')

const dbPath = (process.env.DATABASE_URL || 'file:./dev.db').replace('file:', '')
const adapter = new PrismaBetterSqlite3({ url: dbPath })

const prisma = new PrismaClient({ adapter })

module.exports = prisma

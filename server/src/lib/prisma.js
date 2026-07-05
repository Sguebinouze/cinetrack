require('dotenv').config()
const { PrismaClient } = require('@prisma/client')
const Database = require('better-sqlite3')
const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')

const dbPath = (process.env.DATABASE_URL || 'file:./dev.db').replace('file:', '')
const db = new Database(dbPath)
const adapter = new PrismaBetterSqlite3(db)

const prisma = new PrismaClient({ adapter })

module.exports = prisma

import { config } from 'dotenv'

// Même raison que lib/db/seed.ts : dotenv doit tourner avant tout import local.
config({ path: '.env.local' })

async function main() {
  const { Pool } = await import('pg')
  const { drizzle } = await import('drizzle-orm/node-postgres')
  const { migrate } = await import('drizzle-orm/node-postgres/migrator')

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL is not set — expected a postgres:// connection string.')

  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1') ? false : { rejectUnauthorized: false },
  })
  const db = drizzle(pool)

  await migrate(db, { migrationsFolder: './lib/db/migrations' })
  console.log('Migrations appliquées.')
  await pool.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

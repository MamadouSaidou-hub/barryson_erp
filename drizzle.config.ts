import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — expected a postgres:// connection string.')
}

// `npm run db:push` reste pratique en itération locale, mais à partir de la Phase 6 (migrations
// versionnées) ne jamais l'utiliser contre une base partagée/staging/prod : `npm run db:generate`
// puis relire le SQL généré, puis `npm run db:migrate`.

export default defineConfig({
  schema: ['./lib/db/schema.ts', './lib/db/auth-schema.ts'],
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
})

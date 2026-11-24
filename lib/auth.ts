import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { nextCookies } from 'better-auth/next-js'
import { admin } from 'better-auth/plugins'
import { db } from './db/client'
import { account, session, user, verification } from './db/auth-schema'

// Garde-fou démarrage (§14 sécurité) : un secret de dev connu ne doit jamais tourner en
// production — mieux vaut un crash au boot qu'un déploiement silencieusement signé avec une clé
// publique. On ne se fie pas à `NODE_ENV === 'production'` seul : `next build` le force aussi en
// local (`.env.local` garde alors `BETTER_AUTH_URL=http://localhost:3000`), ce qui casserait la
// vérification locale habituelle. Le vrai signal d'un déploiement réel est une URL non-locale.
const DEV_SECRET_PLACEHOLDER = 'dev-only-secret-change-before-production-5f8a2c9e1b4d6f3a'
const authUrl = process.env.BETTER_AUTH_URL ?? ''
const looksLikeRealDeployment = authUrl !== '' && !authUrl.includes('localhost') && !authUrl.includes('127.0.0.1')
if (looksLikeRealDeployment && process.env.BETTER_AUTH_SECRET === DEV_SECRET_PLACEHOLDER) {
  throw new Error('BETTER_AUTH_SECRET est encore le secret de développement — générez-en un nouveau avant de déployer en production.')
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema: { user, session, account, verification },
  }),
  emailAndPassword: {
    enabled: true,
  },
  // §14 : limite les tentatives de connexion/changement de mot de passe (better-auth applique
  // déjà des règles plus strictes sur /sign-in, /sign-up, /change-password — ici on force
  // `enabled: true` explicitement plutôt que de dépendre de la détection automatique via
  // NODE_ENV, pour que ce soit actif dès maintenant, pas seulement "en prod".
  rateLimit: {
    enabled: true,
    window: 10,
    max: 100,
  },
  // Documente explicitement l'origine autorisée pour les requêtes state-changing, plutôt que de
  // dépendre uniquement de la détection implicite par better-auth.
  trustedOrigins: process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : [],
  user: {
    additionalFields: {
      role: {
        type: 'string',
        defaultValue: 'resp_stock',
        input: false,
      },
    },
  },
  plugins: [
    admin({
      defaultRole: 'resp_stock',
      adminRoles: ['admin'],
    }),
    // nextCookies() must be the last plugin — it auto-attaches Set-Cookie headers to the current
    // Next.js response for whichever better-auth endpoint just ran in this request.
    nextCookies(),
  ],
})

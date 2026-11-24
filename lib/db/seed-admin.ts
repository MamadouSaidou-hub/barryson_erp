import { config } from 'dotenv'

// Static imports are hoisted above this call by the compiler, so project-local imports are done
// dynamically inside main() instead, after dotenv has actually run.
config({ path: '.env.local' })

const ADMIN_EMAIL = 'admin.demo@barryson.local'
const ADMIN_PASSWORD = 'ChangeMoi123!'
const ADMIN_NAME = 'Administrateur'

async function main() {
  const { eq } = await import('drizzle-orm')
  const { auth } = await import('../auth')
  const { db } = await import('./client')
  const { user } = await import('./auth-schema')

  const [existing] = await db.select().from(user).where(eq(user.email, ADMIN_EMAIL))
  if (existing) {
    console.log(`Un compte admin existe déjà (${ADMIN_EMAIL}).`)
    return
  }

  await auth.api.signUpEmail({
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME },
  })

  await db.update(user).set({ role: 'admin' }).where(eq(user.email, ADMIN_EMAIL))

  console.log('Compte administrateur créé :')
  console.log(`  E-mail : ${ADMIN_EMAIL}`)
  console.log(`  Mot de passe : ${ADMIN_PASSWORD}`)
  console.log('Pensez à changer ce mot de passe après la première connexion.')
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

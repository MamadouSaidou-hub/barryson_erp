import { eq } from 'drizzle-orm'
import { db } from '../client'
import { employes } from '../schema'
import { slugCode, uniqueCode } from '../code'

export async function createEmploye(input: { name: string; poste: string; phone?: string; email?: string; dateEmbauche?: string }) {
  const code = await uniqueCode(slugCode(input.name), async (candidate) => {
    const [existing] = await db.select({ id: employes.id }).from(employes).where(eq(employes.code, candidate))
    return !!existing
  })

  const [employe] = await db
    .insert(employes)
    .values({
      code,
      name: input.name,
      poste: input.poste,
      phone: input.phone ?? null,
      email: input.email ?? null,
      dateEmbauche: input.dateEmbauche ?? null,
    })
    .returning()

  return employe
}

export async function updateEmploye(
  id: number,
  input: { name?: string; poste?: string; phone?: string | null; email?: string | null; dateEmbauche?: string | null },
) {
  const [employe] = await db.update(employes).set(input).where(eq(employes.id, id)).returning()
  if (!employe) throw new Error('Employé introuvable.')
  return employe
}

export async function setEmployeActive(id: number, active: boolean) {
  const [employe] = await db.update(employes).set({ active }).where(eq(employes.id, id)).returning()
  if (!employe) throw new Error('Employé introuvable.')
  return employe
}

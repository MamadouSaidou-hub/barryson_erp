import { eq } from 'drizzle-orm'
import { db } from '../client'
import { fournisseurs } from '../schema'
import { slugCode, uniqueCode } from '../code'

export async function createFournisseur(input: {
  name: string
  country?: string
  phone?: string
  email?: string
  address?: string
  paymentTerms?: string
  leadTimeDays?: number
}) {
  const code = await uniqueCode(slugCode(input.name), async (candidate) => {
    const [existing] = await db.select({ id: fournisseurs.id }).from(fournisseurs).where(eq(fournisseurs.code, candidate))
    return !!existing
  })

  const [fournisseur] = await db
    .insert(fournisseurs)
    .values({
      code,
      name: input.name,
      country: input.country ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      address: input.address ?? null,
      paymentTerms: input.paymentTerms ?? null,
      leadTimeDays: input.leadTimeDays ?? null,
    })
    .returning()

  return fournisseur
}

export async function updateFournisseur(
  id: number,
  input: { name?: string; country?: string | null; phone?: string | null; email?: string | null; address?: string | null; paymentTerms?: string | null; leadTimeDays?: number | null },
) {
  const [fournisseur] = await db.update(fournisseurs).set(input).where(eq(fournisseurs.id, id)).returning()
  if (!fournisseur) throw new Error('Fournisseur introuvable.')
  return fournisseur
}

export async function setFournisseurActive(id: number, active: boolean) {
  const [fournisseur] = await db.update(fournisseurs).set({ active }).where(eq(fournisseurs.id, id)).returning()
  if (!fournisseur) throw new Error('Fournisseur introuvable.')
  return fournisseur
}

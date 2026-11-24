import { eq } from 'drizzle-orm'
import { db } from '../client'
import { clients } from '../schema'
import { slugCode, uniqueCode } from '../code'
import { toGnfOrNull } from '../../money'

export async function createClient(input: {
  name: string
  segment?: string
  zone?: string
  delaiPaiementJours?: number
  plafondEncours?: number
}) {
  const code = await uniqueCode(slugCode(input.name), async (candidate) => {
    const [existing] = await db.select({ id: clients.id }).from(clients).where(eq(clients.code, candidate))
    return !!existing
  })

  const [client] = await db
    .insert(clients)
    .values({
      code,
      name: input.name,
      segment: input.segment ?? null,
      zone: input.zone ?? null,
      delaiPaiementJours: input.delaiPaiementJours ?? null,
      plafondEncours: toGnfOrNull(input.plafondEncours),
    })
    .returning()

  return client
}

export async function updateClient(
  id: number,
  input: { name?: string; segment?: string | null; zone?: string | null; delaiPaiementJours?: number | null; plafondEncours?: number | null },
) {
  const [client] = await db
    .update(clients)
    .set({ ...input, plafondEncours: input.plafondEncours === undefined ? undefined : toGnfOrNull(input.plafondEncours) })
    .where(eq(clients.id, id))
    .returning()
  if (!client) throw new Error('Client introuvable.')
  return client
}

export async function setClientActive(id: number, active: boolean) {
  const [client] = await db.update(clients).set({ active }).where(eq(clients.id, id)).returning()
  if (!client) throw new Error('Client introuvable.')
  return client
}

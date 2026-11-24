import { asc } from 'drizzle-orm'
import { db } from '../client'
import { fournisseurs } from '../schema'

export async function getFournisseursList() {
  return db.select().from(fournisseurs).orderBy(asc(fournisseurs.name))
}

export async function getActiveFournisseurOptions() {
  const rows = await db.select().from(fournisseurs).orderBy(asc(fournisseurs.name))
  return rows.filter((row) => row.active)
}

import { asc } from 'drizzle-orm'
import { db } from '../client'
import { clients } from '../schema'

export async function getClientsList() {
  return db.select().from(clients).orderBy(asc(clients.name))
}

export async function getActiveClientOptions() {
  const rows = await getClientsList()
  return rows.filter((row) => row.active)
}

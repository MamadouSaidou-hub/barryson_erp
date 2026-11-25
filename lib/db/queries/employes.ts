import { asc } from 'drizzle-orm'
import { db } from '../client'
import { employes } from '../schema'

export async function getEmployesList() {
  return db.select().from(employes).orderBy(asc(employes.name))
}

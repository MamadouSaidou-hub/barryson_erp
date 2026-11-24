import { asc } from 'drizzle-orm'
import { db } from '../client'
import { articles } from '../schema'

export async function getArticlesList() {
  return db.select().from(articles).orderBy(asc(articles.name))
}

export async function getActiveArticleOptions() {
  const rows = await db.select().from(articles).orderBy(asc(articles.name))
  return rows.filter((row) => row.active)
}

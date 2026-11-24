import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { articles, tarifsClients } from '../schema'

export async function getTarifsClientList(clientId: number) {
  return db
    .select({
      articleId: tarifsClients.articleId,
      articleName: articles.name,
      articleUnit: articles.unit,
      prixUnitaire: tarifsClients.prixUnitaire,
    })
    .from(tarifsClients)
    .innerJoin(articles, eq(tarifsClients.articleId, articles.id))
    .where(eq(tarifsClients.clientId, clientId))
}

export async function getTarifClient(clientId: number, articleId: number): Promise<number | null> {
  const [row] = await db
    .select({ prixUnitaire: tarifsClients.prixUnitaire })
    .from(tarifsClients)
    .where(and(eq(tarifsClients.clientId, clientId), eq(tarifsClients.articleId, articleId)))
  return row?.prixUnitaire ?? null
}

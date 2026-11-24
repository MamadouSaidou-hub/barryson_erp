import { and, eq } from 'drizzle-orm'
import { db } from '../client'
import { articles, tarifsClients } from '../schema'
import { toGnf } from '../../money'

export async function setTarifClient(input: { clientId: number; articleId: number; prixUnitaire: number }) {
  const [article] = await db.select({ id: articles.id, level: articles.level, name: articles.name }).from(articles).where(eq(articles.id, input.articleId))
  if (!article) throw new Error('Article introuvable.')
  if (article.level !== 'produit_fini') throw new Error(`"${article.name}" n'est pas un produit fini — seuls les produits finis peuvent avoir un tarif client.`)
  if (input.prixUnitaire < 0) throw new Error('Le prix ne peut pas être négatif.')

  const [tarif] = await db
    .insert(tarifsClients)
    .values({ clientId: input.clientId, articleId: input.articleId, prixUnitaire: toGnf(input.prixUnitaire) })
    .onConflictDoUpdate({
      target: [tarifsClients.clientId, tarifsClients.articleId],
      set: { prixUnitaire: toGnf(input.prixUnitaire) },
    })
    .returning()
  return tarif
}

export async function removeTarifClient(clientId: number, articleId: number) {
  await db.delete(tarifsClients).where(and(eq(tarifsClients.clientId, clientId), eq(tarifsClients.articleId, articleId)))
}

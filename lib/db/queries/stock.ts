import { desc, eq, type SQL } from 'drizzle-orm'
import { db } from '../client'
import { articles, stockMouvements, stockNiveaux } from '../schema'

export async function getStockOverview() {
  const rows = await db
    .select({
      articleId: articles.id,
      code: articles.code,
      name: articles.name,
      level: articles.level,
      unit: articles.unit,
      seuilMin: articles.seuilMin,
      seuilMax: articles.seuilMax,
      active: articles.active,
      quantite: stockNiveaux.quantite,
    })
    .from(articles)
    .leftJoin(stockNiveaux, eq(articles.id, stockNiveaux.articleId))
    .where(eq(articles.active, true))
    .orderBy(articles.name)

  return rows.map((row) => {
    const quantite = row.quantite ?? 0
    return {
      ...row,
      quantite,
      presqueFini: row.seuilMin !== null && quantite <= row.seuilMin,
      negatif: quantite < 0,
    }
  })
}

export async function getStockHistory(articleId?: number) {
  const whereClause: SQL | undefined = articleId ? eq(stockMouvements.articleId, articleId) : undefined

  return db
    .select({
      id: stockMouvements.id,
      articleId: stockMouvements.articleId,
      articleName: articles.name,
      articleUnit: articles.unit,
      type: stockMouvements.type,
      quantite: stockMouvements.quantite,
      motif: stockMouvements.motif,
      auteurName: stockMouvements.auteurName,
      date: stockMouvements.date,
    })
    .from(stockMouvements)
    .innerJoin(articles, eq(stockMouvements.articleId, articles.id))
    .where(whereClause)
    .orderBy(desc(stockMouvements.date))
    .limit(200)
}

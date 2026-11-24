import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, stockMouvements, stockNiveaux } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { recordManualStockMovement } from '../lib/db/mutations/stock'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Stock' }

let articleId: number

beforeAll(async () => {
  const article = await createArticle({ name: `Stock Démo ${runId}`, level: 'semi_fini', unit: 'kg' })
  articleId = article.id
})

afterAll(async () => {
  await db.delete(stockMouvements).where(eq(stockMouvements.articleId, articleId))
  await db.delete(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
  await db.delete(articles).where(inArray(articles.id, [articleId]))
})

describe('recordManualStockMovement', () => {
  it('une entrée augmente le solde et une sortie le diminue', async () => {
    await recordManualStockMovement({ articleId, direction: 'entree', quantite: 100, motif: 'Stock de départ' }, actor)
    let [niveau] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
    expect(niveau.quantite).toBe(100)

    await recordManualStockMovement({ articleId, direction: 'sortie', quantite: 30 }, actor)
    ;[niveau] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
    expect(niveau.quantite).toBe(70)
  })

  it('refuse une sortie supérieure au stock disponible, avec un message clair', async () => {
    await expect(recordManualStockMovement({ articleId, direction: 'sortie', quantite: 1_000_000 }, actor)).rejects.toThrow(/stock insuffisant/i)

    const [niveau] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
    expect(niveau.quantite).toBe(70) // inchangé après le refus
  })

  it('conserve chaque mouvement avec son auteur et son motif (historique)', async () => {
    const mouvements = await db.select().from(stockMouvements).where(eq(stockMouvements.articleId, articleId))
    expect(mouvements.length).toBe(2)
    expect(mouvements[0].auteurName).toBe('Test Stock')
    expect(mouvements.some((m) => m.motif === 'Stock de départ')).toBe(true)
  })
})

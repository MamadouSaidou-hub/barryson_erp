import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, stockMouvements, stockNiveaux } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { recordManualStockMovement, reconcileStockLevels } from '../lib/db/mutations/stock'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Reconcile' }

let articleId: number

beforeAll(async () => {
  const article = await createArticle({ name: `Reconcile ${runId}`, level: 'semi_fini', unit: 'kg' })
  articleId = article.id
})

afterAll(async () => {
  await db.delete(stockMouvements).where(eq(stockMouvements.articleId, articleId))
  await db.delete(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
  await db.delete(articles).where(inArray(articles.id, [articleId]))
})

describe('reconcileStockLevels', () => {
  it("après une séquence normale de mouvements, le cache correspond exactement aux mouvements (zéro écart)", async () => {
    await recordManualStockMovement({ articleId, direction: 'entree', quantite: 100 }, actor)
    await recordManualStockMovement({ articleId, direction: 'sortie', quantite: 30 }, actor)
    await recordManualStockMovement({ articleId, direction: 'entree', quantite: 12.5 }, actor) // fractionnaire (kg)

    const { ecarts } = await reconcileStockLevels({ articleId })
    expect(ecarts).toHaveLength(0)

    const [niveau] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
    expect(niveau.quantite).toBeCloseTo(82.5, 6)
  })

  it('détecte un cache corrompu et le corrige pour correspondre aux mouvements', async () => {
    // Corruption délibérée du cache (simule une divergence qui ne devrait jamais arriver).
    await db.update(stockNiveaux).set({ quantite: 999 }).where(eq(stockNiveaux.articleId, articleId))

    const detect = await reconcileStockLevels({ articleId })
    expect(detect.ecarts).toHaveLength(1)
    expect(detect.ecarts[0]).toMatchObject({ articleId, cache: 999 })
    expect(detect.ecarts[0].reel).toBeCloseTo(82.5, 6)

    const repair = await reconcileStockLevels({ articleId, fix: true })
    expect(repair.corrige).toBe(true)

    const [niveau] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
    expect(niveau.quantite).toBeCloseTo(82.5, 6)

    // Après correction, plus aucun écart.
    const after = await reconcileStockLevels({ articleId })
    expect(after.ecarts).toHaveLength(0)
  })
})

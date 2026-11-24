import { describe, it, expect, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles } from '../lib/db/schema'
import { createArticle, setArticleActive, updateArticle } from '../lib/db/mutations/articles'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const articleIds: number[] = []

afterAll(async () => {
  if (articleIds.length > 0) await db.delete(articles).where(inArray(articles.id, articleIds))
})

describe('createArticle', () => {
  it("déduit un code unique à partir du nom et crée l'article actif", async () => {
    const article = await createArticle({ name: `Article Démo ${runId}`, level: 'semi_fini', unit: 'kg' })
    articleIds.push(article.id)

    expect(article.code).toContain('ARTICLE-DEMO')
    expect(article.level).toBe('semi_fini')
    expect(article.unit).toBe('kg')
    expect(article.active).toBe(true)
  })

  it('génère des codes distincts pour deux noms qui se réduisent au même slug', async () => {
    const first = await createArticle({ name: `Même Nom ${runId}`, level: 'matiere_premiere', unit: 'kg' })
    const second = await createArticle({ name: `Même Nom ${runId}`, level: 'matiere_premiere', unit: 'kg' })
    articleIds.push(first.id, second.id)

    expect(first.code).not.toBe(second.code)
  })
})

describe('updateArticle', () => {
  it('met à jour le nom et le seuil, et refuse un identifiant inconnu', async () => {
    const article = await createArticle({ name: `Avant ${runId}`, level: 'produit_fini', unit: 'carton' })
    articleIds.push(article.id)

    const updated = await updateArticle(article.id, { name: `Après ${runId}`, seuilMin: 10 })
    expect(updated.name).toBe(`Après ${runId}`)
    expect(updated.seuilMin).toBe(10)

    await expect(updateArticle(-1, { name: 'x' })).rejects.toThrow(/introuvable/i)
  })
})

describe('setArticleActive', () => {
  it('désactive puis réactive un article sans jamais le supprimer', async () => {
    const article = await createArticle({ name: `Désactivable ${runId}`, level: 'semi_fini', unit: 'piece' })
    articleIds.push(article.id)

    const deactivated = await setArticleActive(article.id, false)
    expect(deactivated.active).toBe(false)

    const [stillThere] = await db.select().from(articles).where(eq(articles.id, article.id))
    expect(stillThere).toBeDefined()

    const reactivated = await setArticleActive(article.id, true)
    expect(reactivated.active).toBe(true)
  })
})

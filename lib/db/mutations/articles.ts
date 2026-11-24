import { eq } from 'drizzle-orm'
import { db } from '../client'
import { articles, type ArticleLevel, type ArticleUnit } from '../schema'
import { slugCode, uniqueCode } from '../code'

type Executor = Pick<typeof db, 'select' | 'insert' | 'update' | 'transaction'>

export async function createArticle(
  input: { name: string; level: ArticleLevel; unit: ArticleUnit; seuilMin?: number; seuilMax?: number },
  executor: Executor = db,
) {
  const code = await uniqueCode(slugCode(input.name), async (candidate) => {
    const [existing] = await executor.select({ id: articles.id }).from(articles).where(eq(articles.code, candidate))
    return !!existing
  })

  const [article] = await executor
    .insert(articles)
    .values({
      code,
      name: input.name,
      level: input.level,
      unit: input.unit,
      seuilMin: input.seuilMin ?? null,
      seuilMax: input.seuilMax ?? null,
    })
    .returning()

  return article
}

export async function updateArticle(id: number, input: { name?: string; seuilMin?: number | null; seuilMax?: number | null }) {
  const [article] = await db
    .update(articles)
    .set({ name: input.name, seuilMin: input.seuilMin, seuilMax: input.seuilMax })
    .where(eq(articles.id, id))
    .returning()
  if (!article) throw new Error('Article introuvable.')
  return article
}

export async function setArticleActive(id: number, active: boolean) {
  const [article] = await db.update(articles).set({ active }).where(eq(articles.id, id)).returning()
  if (!article) throw new Error('Article introuvable.')
  return article
}

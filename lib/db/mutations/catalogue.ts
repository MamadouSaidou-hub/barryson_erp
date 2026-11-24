import { eq } from 'drizzle-orm'
import { db } from '../client'
import { catalogueProduits, type ArticleLevel, type ArticleUnit } from '../schema'
import { createArticle } from './articles'

type CatalogueFields = {
  finish?: string
  supplierRef?: string
  typicalNetWeightKg?: number
  typicalLengthM?: number
  usualPrice?: number
  usualCurrency?: string
}

/** §5.2 "+ Autre produit" : crée un article à la volée et l'ajoute immédiatement au catalogue,
 * pour qu'il reste disponible dans les prochaines commandes. */
export async function createCatalogueProduitWithNewArticle(input: {
  name: string
  level: ArticleLevel
  unit: ArticleUnit
  label?: string
} & CatalogueFields) {
  return db.transaction(async (tx) => {
    const article = await createArticle({ name: input.name, level: input.level, unit: input.unit }, tx)
    const [catalogueProduit] = await tx
      .insert(catalogueProduits)
      .values({
        articleId: article.id,
        label: input.label ?? input.name,
        finish: input.finish ?? null,
        supplierRef: input.supplierRef ?? null,
        typicalNetWeightKg: input.typicalNetWeightKg ?? null,
        typicalLengthM: input.typicalLengthM ?? null,
        usualPrice: input.usualPrice ?? null,
        usualCurrency: input.usualCurrency ?? null,
      })
      .returning()
    return { article, catalogueProduit }
  })
}

export async function createCatalogueProduitForArticle(articleId: number, input: { label: string } & CatalogueFields) {
  const [existing] = await db.select({ id: catalogueProduits.id }).from(catalogueProduits).where(eq(catalogueProduits.articleId, articleId))
  if (existing) throw new Error('Cet article a déjà une fiche catalogue.')

  const [catalogueProduit] = await db
    .insert(catalogueProduits)
    .values({
      articleId,
      label: input.label,
      finish: input.finish ?? null,
      supplierRef: input.supplierRef ?? null,
      typicalNetWeightKg: input.typicalNetWeightKg ?? null,
      typicalLengthM: input.typicalLengthM ?? null,
      usualPrice: input.usualPrice ?? null,
      usualCurrency: input.usualCurrency ?? null,
    })
    .returning()
  return catalogueProduit
}

export async function updateCatalogueProduit(id: number, input: { label?: string } & CatalogueFields) {
  const [catalogueProduit] = await db.update(catalogueProduits).set(input).where(eq(catalogueProduits.id, id)).returning()
  if (!catalogueProduit) throw new Error('Produit du catalogue introuvable.')
  return catalogueProduit
}

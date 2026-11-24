import { asc, eq } from 'drizzle-orm'
import { db } from '../client'
import { articles, catalogueProduits } from '../schema'

export async function getCatalogueList() {
  return db
    .select({
      id: catalogueProduits.id,
      articleId: catalogueProduits.articleId,
      label: catalogueProduits.label,
      finish: catalogueProduits.finish,
      supplierRef: catalogueProduits.supplierRef,
      typicalNetWeightKg: catalogueProduits.typicalNetWeightKg,
      typicalLengthM: catalogueProduits.typicalLengthM,
      usualPrice: catalogueProduits.usualPrice,
      usualCurrency: catalogueProduits.usualCurrency,
      articleName: articles.name,
      articleCode: articles.code,
      articleUnit: articles.unit,
      articleActive: articles.active,
    })
    .from(catalogueProduits)
    .innerJoin(articles, eq(catalogueProduits.articleId, articles.id))
    .orderBy(asc(catalogueProduits.label))
}

export async function getActiveCatalogueOptions() {
  const rows = await getCatalogueList()
  return rows.filter((row) => row.articleActive)
}

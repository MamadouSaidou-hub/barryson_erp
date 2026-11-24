import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { articles, clients, devis, devisLignes } from '../schema'
import { estExpire } from '../mutations/devis'

export async function getDevisList() {
  const rows = await db
    .select({
      id: devis.id,
      numero: devis.numero,
      clientId: devis.clientId,
      clientName: clients.name,
      commercial: devis.commercial,
      dateDevis: devis.dateDevis,
      validiteJours: devis.validiteJours,
      etat: devis.etat,
      commandeClientId: devis.commandeClientId,
      // `::double precision` : même raison que `getCommandesClientsList` — sum() sur du `bigint`
      // renvoie une chaîne côté pg.
      total: sql<number>`coalesce(sum(${devisLignes.quantite} * ${devisLignes.prixUnitaire}), 0)::double precision`,
    })
    .from(devis)
    .innerJoin(clients, eq(devis.clientId, clients.id))
    .leftJoin(devisLignes, eq(devisLignes.devisId, devis.id))
    .groupBy(devis.id, devis.clientId, clients.name)
    .orderBy(desc(devis.createdAt))

  return rows.map((row) => ({ ...row, expire: row.etat === 'brouillon' && estExpire(row.dateDevis, row.validiteJours) }))
}

export async function getDevisDetail(id: number) {
  const [row] = await db
    .select({
      id: devis.id,
      numero: devis.numero,
      clientId: devis.clientId,
      clientName: clients.name,
      commercial: devis.commercial,
      dateDevis: devis.dateDevis,
      validiteJours: devis.validiteJours,
      reference: devis.reference,
      commentaire: devis.commentaire,
      etat: devis.etat,
      commandeClientId: devis.commandeClientId,
    })
    .from(devis)
    .innerJoin(clients, eq(devis.clientId, clients.id))
    .where(eq(devis.id, id))
  if (!row) return null

  const lignes = await db
    .select({
      id: devisLignes.id,
      articleId: devisLignes.articleId,
      articleUnit: articles.unit,
      nomAffiche: devisLignes.nomAffiche,
      quantite: devisLignes.quantite,
      prixUnitaire: devisLignes.prixUnitaire,
    })
    .from(devisLignes)
    .innerJoin(articles, eq(devisLignes.articleId, articles.id))
    .where(eq(devisLignes.devisId, id))

  return { ...row, expire: row.etat === 'brouillon' && estExpire(row.dateDevis, row.validiteJours), lignes }
}

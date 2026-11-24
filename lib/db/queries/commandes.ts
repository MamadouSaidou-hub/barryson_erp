import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { articles, commandeLignes, commandes, fournisseurs, receptionLignes } from '../schema'

export async function getCommandesList() {
  const rows = await db
    .select({
      id: commandes.id,
      numero: commandes.numero,
      fournisseurId: commandes.fournisseurId,
      fournisseurName: fournisseurs.name,
      devise: commandes.devise,
      tauxChange: commandes.tauxChange,
      etat: commandes.etat,
      dateArriveePrevue: commandes.dateArriveePrevue,
      createdAt: commandes.createdAt,
      total: sql<number>`coalesce(sum(${commandeLignes.quantite} * ${commandeLignes.prixUnitaire}), 0)`,
    })
    .from(commandes)
    .innerJoin(fournisseurs, eq(commandes.fournisseurId, fournisseurs.id))
    .leftJoin(commandeLignes, eq(commandeLignes.commandeId, commandes.id))
    .groupBy(commandes.id, commandes.fournisseurId, fournisseurs.name)
    .orderBy(desc(commandes.createdAt))

  return rows
}

export async function getCommandeDetail(id: number) {
  const [commande] = await db
    .select({
      id: commandes.id,
      numero: commandes.numero,
      fournisseurId: commandes.fournisseurId,
      fournisseurName: fournisseurs.name,
      devise: commandes.devise,
      tauxChange: commandes.tauxChange,
      dateArriveePrevue: commandes.dateArriveePrevue,
      reference: commandes.reference,
      commentaire: commandes.commentaire,
      etat: commandes.etat,
    })
    .from(commandes)
    .innerJoin(fournisseurs, eq(commandes.fournisseurId, fournisseurs.id))
    .where(eq(commandes.id, id))
  if (!commande) return null

  const lignes = await db
    .select({
      id: commandeLignes.id,
      articleId: commandeLignes.articleId,
      articleUnit: articles.unit,
      catalogueProduitId: commandeLignes.catalogueProduitId,
      nomAffiche: commandeLignes.nomAffiche,
      description: commandeLignes.description,
      quantite: commandeLignes.quantite,
      prixUnitaire: commandeLignes.prixUnitaire,
      finish: commandeLignes.finish,
      quantiteAcceptee: sql<number>`coalesce((select sum(${receptionLignes.quantiteAcceptee}) from ${receptionLignes} where ${receptionLignes.commandeLigneId} = ${commandeLignes.id}), 0)`,
    })
    .from(commandeLignes)
    .innerJoin(articles, eq(commandeLignes.articleId, articles.id))
    .where(eq(commandeLignes.commandeId, id))

  return { ...commande, lignes }
}

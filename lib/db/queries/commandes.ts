import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { articles, commandeLignes, commandes, fournisseurs, paiementsFournisseurs, receptionLignes } from '../schema'

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
      totalPaye: sql<number>`coalesce((select sum(${paiementsFournisseurs.montant}) from ${paiementsFournisseurs} where ${paiementsFournisseurs.commandeId} = ${commandes.id}), 0)`,
    })
    .from(commandes)
    .innerJoin(fournisseurs, eq(commandes.fournisseurId, fournisseurs.id))
    .leftJoin(commandeLignes, eq(commandeLignes.commandeId, commandes.id))
    .groupBy(commandes.id, commandes.fournisseurId, fournisseurs.name)
    .orderBy(desc(commandes.createdAt))

  return rows.map((row) => ({ ...row, solde: row.total - row.totalPaye }))
}

// Agrégat trésorerie (§ comptable) : par devise, ce qui a été commandé vs payé vs reste dû — ces
// montants en devise étrangère restent indicatifs (cf. commentaire sur `gnf` dans schema.ts),
// jamais convertis ni sommés avec les montants GNF des ventes.
export async function getTresorerieAchats() {
  const rows = await getCommandesList()
  const retenues = rows.filter((row) => row.etat !== 'brouillon' && row.etat !== 'annulee')

  const parDevise = new Map<string, { devise: string; totalCommande: number; totalPaye: number }>()
  for (const row of retenues) {
    const entry = parDevise.get(row.devise) ?? { devise: row.devise, totalCommande: 0, totalPaye: 0 }
    entry.totalCommande += row.total
    entry.totalPaye += row.totalPaye
    parDevise.set(row.devise, entry)
  }

  return [...parDevise.values()].map((entry) => ({ ...entry, solde: entry.totalCommande - entry.totalPaye }))
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

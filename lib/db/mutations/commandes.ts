import { eq } from 'drizzle-orm'
import { db } from '../client'
import { catalogueProduits, commandeLignes, commandes, paiementsFournisseurs } from '../schema'
import { finalNumero, placeholderNumero } from '../numero'
import { writeAuditLog, type Actor } from './audit'

export type CommandeLigneInput = {
  articleId: number
  catalogueProduitId?: number
  nomAffiche: string
  description?: string
  quantite: number
  prixUnitaire?: number
  finish?: string
}

export type CommandeInput = {
  fournisseurId: number
  devise: string
  tauxChange?: number
  dateArriveePrevue?: string
  reference?: string
  commentaire?: string
  lignes: CommandeLigneInput[]
}

function assertLignes(lignes: CommandeLigneInput[]) {
  if (lignes.length === 0) throw new Error('Ajoutez au moins une ligne à la commande.')
  for (const ligne of lignes) {
    if (ligne.quantite <= 0) throw new Error('Chaque quantité doit être strictement positive.')
  }
}

export async function createCommande(input: CommandeInput) {
  assertLignes(input.lignes)

  return db.transaction(async (tx) => {
    const [commande] = await tx
      .insert(commandes)
      .values({
        numero: placeholderNumero(),
        fournisseurId: input.fournisseurId,
        devise: input.devise,
        tauxChange: input.tauxChange ?? null,
        dateArriveePrevue: input.dateArriveePrevue ?? null,
        reference: input.reference ?? null,
        commentaire: input.commentaire ?? null,
        etat: 'brouillon',
      })
      .returning()

    await tx.update(commandes).set({ numero: finalNumero('BCA', commande.id) }).where(eq(commandes.id, commande.id))

    await tx.insert(commandeLignes).values(
      input.lignes.map((ligne) => ({
        commandeId: commande.id,
        articleId: ligne.articleId,
        catalogueProduitId: ligne.catalogueProduitId ?? null,
        nomAffiche: ligne.nomAffiche,
        description: ligne.description ?? null,
        quantite: ligne.quantite,
        prixUnitaire: ligne.prixUnitaire ?? null,
        finish: ligne.finish ?? null,
      })),
    )

    return { ...commande, numero: finalNumero('BCA', commande.id) }
  })
}

/** §5.2 point 7 : la commande reste modifiable (lignes, fournisseur, devise...) tant qu'elle est
 * en brouillon. On remplace les lignes plutôt que de les patcher une par une — aucune réception
 * ne peut encore exister puisqu'elle n'a pas été "passée". */
export async function updateCommande(id: number, input: CommandeInput) {
  assertLignes(input.lignes)

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(commandes).where(eq(commandes.id, id)).for('update')
    if (!existing) throw new Error('Commande introuvable.')
    if (existing.etat !== 'brouillon') throw new Error('Cette commande a déjà été passée au fournisseur — elle n\'est plus modifiable.')

    const [commande] = await tx
      .update(commandes)
      .set({
        fournisseurId: input.fournisseurId,
        devise: input.devise,
        tauxChange: input.tauxChange ?? null,
        dateArriveePrevue: input.dateArriveePrevue ?? null,
        reference: input.reference ?? null,
        commentaire: input.commentaire ?? null,
      })
      .where(eq(commandes.id, id))
      .returning()

    await tx.delete(commandeLignes).where(eq(commandeLignes.commandeId, id))
    await tx.insert(commandeLignes).values(
      input.lignes.map((ligne) => ({
        commandeId: id,
        articleId: ligne.articleId,
        catalogueProduitId: ligne.catalogueProduitId ?? null,
        nomAffiche: ligne.nomAffiche,
        description: ligne.description ?? null,
        quantite: ligne.quantite,
        prixUnitaire: ligne.prixUnitaire ?? null,
        finish: ligne.finish ?? null,
      })),
    )

    return commande
  })
}

/** §5.2 point 7 : "Passer la commande au fournisseur" verrouille les lignes (traçabilité de ce
 * qui a été réellement demandé) et ouvre la possibilité de recevoir. */
export async function passerCommande(id: number, actor: Actor) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(commandes).where(eq(commandes.id, id)).for('update')
    if (!existing) throw new Error('Commande introuvable.')
    if (existing.etat !== 'brouillon') throw new Error('Cette commande a déjà été passée.')

    const lignes = await tx.select().from(commandeLignes).where(eq(commandeLignes.commandeId, id))
    if (lignes.length === 0) throw new Error('Ajoutez au moins une ligne avant de passer la commande.')

    const [commande] = await tx.update(commandes).set({ etat: 'commandee' }).where(eq(commandes.id, id)).returning()

    await writeAuditLog(tx, {
      entityType: 'commande',
      entityId: id,
      action: 'update',
      actor,
      beforeData: existing,
      afterData: commande,
    })

    return commande
  })
}

export async function annulerCommande(id: number, actor: Actor, reason?: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(commandes).where(eq(commandes.id, id)).for('update')
    if (!existing) throw new Error('Commande introuvable.')
    if (existing.etat === 'annulee') throw new Error('Cette commande est déjà annulée.')
    if (existing.etat === 'recue' || existing.etat === 'partiellement_recue') {
      throw new Error('Cette commande a déjà des réceptions — elle ne peut plus être annulée.')
    }

    const [commande] = await tx.update(commandes).set({ etat: 'annulee' }).where(eq(commandes.id, id)).returning()

    await writeAuditLog(tx, {
      entityType: 'commande',
      entityId: id,
      action: 'update',
      actor,
      reason,
      beforeData: existing,
      afterData: commande,
    })

    return commande
  })
}

// Utilisé par l'écran Commander pour proposer un libellé/prix par défaut quand une ligne est
// ajoutée depuis le catalogue (§5.2 point 1).
export async function getCatalogueDefaults(catalogueProduitId: number) {
  const [row] = await db.select().from(catalogueProduits).where(eq(catalogueProduits.id, catalogueProduitId))
  return row ?? null
}

// Symétrique de enregistrerPaiementClient (lib/db/mutations/ventes.ts) : qui porte la commande
// (resp_stock/dg/admin) saisit le paiement au fournisseur ; le comptable reste lecteur.
export async function enregistrerPaiementFournisseur(commandeId: number, input: { montant: number; methode: string; date: string }) {
  if (input.montant <= 0) throw new Error('Le montant doit être strictement positif.')

  const [commande] = await db.select().from(commandes).where(eq(commandes.id, commandeId))
  if (!commande) throw new Error('Commande introuvable.')

  const [paiement] = await db
    .insert(paiementsFournisseurs)
    .values({ commandeId, montant: input.montant, methode: input.methode, date: input.date })
    .returning()
  return paiement
}

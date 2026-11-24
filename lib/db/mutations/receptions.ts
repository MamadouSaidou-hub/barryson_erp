import { eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { commandeLignes, commandes, receptionLignes, receptions } from '../schema'
import { finalNumero, placeholderNumero } from '../numero'
import { insertStockMouvement } from './stock'
import type { Actor } from './audit'

export type ReceptionLigneInput = {
  commandeLigneId: number
  quantiteRecue: number
  quantiteAcceptee: number
  motifEcart?: string
}

export type ReceptionInput = {
  commandeId: number
  date: string
  referenceDocument?: string
  documentsConformes: boolean
  lignes: ReceptionLigneInput[]
}

/** §5.3 : un seul écran. Chaque ligne acceptée entre en stock immédiatement, et l'état de la
 * commande est recalculé automatiquement (jamais choisi à la main) en comparant ce qui a été
 * accepté au total à ce qui a été commandé. */
export async function createReception(input: ReceptionInput, actor: Actor) {
  if (input.lignes.length === 0) throw new Error('Aucune ligne à réceptionner.')
  for (const ligne of input.lignes) {
    if (ligne.quantiteRecue < 0 || ligne.quantiteAcceptee < 0) throw new Error('Les quantités ne peuvent pas être négatives.')
    if (ligne.quantiteAcceptee > ligne.quantiteRecue) throw new Error('La quantité conforme ne peut pas dépasser la quantité reçue.')
  }

  return db.transaction(async (tx) => {
    const [commande] = await tx.select().from(commandes).where(eq(commandes.id, input.commandeId)).for('update')
    if (!commande) throw new Error('Commande introuvable.')
    if (commande.etat !== 'commandee' && commande.etat !== 'partiellement_recue') {
      throw new Error('Cette commande n\'est pas en attente de réception.')
    }

    const lignesCommande = await tx.select().from(commandeLignes).where(eq(commandeLignes.commandeId, input.commandeId))
    const lignesCommandeById = new Map(lignesCommande.map((ligne) => [ligne.id, ligne]))

    const [reception] = await tx
      .insert(receptions)
      .values({
        commandeId: input.commandeId,
        numero: placeholderNumero(),
        date: input.date,
        referenceDocument: input.referenceDocument ?? null,
        documentsConformes: input.documentsConformes,
      })
      .returning()
    reception.numero = finalNumero('REC', reception.id)
    await tx.update(receptions).set({ numero: reception.numero }).where(eq(receptions.id, reception.id))

    for (const ligne of input.lignes) {
      const commandeLigne = lignesCommandeById.get(ligne.commandeLigneId)
      if (!commandeLigne) throw new Error('Ligne de commande introuvable.')

      const [receptionLigne] = await tx
        .insert(receptionLignes)
        .values({
          receptionId: reception.id,
          commandeLigneId: ligne.commandeLigneId,
          quantiteRecue: ligne.quantiteRecue,
          quantiteAcceptee: ligne.quantiteAcceptee,
          motifEcart: ligne.motifEcart ?? null,
        })
        .returning()

      if (ligne.quantiteAcceptee > 0) {
        await insertStockMouvement(tx, {
          articleId: commandeLigne.articleId,
          type: 'reception',
          quantite: ligne.quantiteAcceptee,
          motif: ligne.motifEcart,
          actor,
          receptionLigneId: receptionLigne.id,
          date: input.date,
        })
      }
    }

    // État déduit (§5.2 : "jamais choisis à la main") en comparant, pour chaque ligne de la
    // commande, le total accepté jusqu'ici à la quantité commandée.
    const [{ totalCommande, totalAccepte }] = await tx
      .select({
        totalCommande: sql<number>`coalesce(sum(${commandeLignes.quantite}), 0)`,
        totalAccepte: sql<number>`coalesce((
          select sum(${receptionLignes.quantiteAcceptee})
          from ${receptionLignes}
          where ${receptionLignes.commandeLigneId} in (select id from ${commandeLignes} where ${commandeLignes.commandeId} = ${input.commandeId})
        ), 0)`,
      })
      .from(commandeLignes)
      .where(eq(commandeLignes.commandeId, input.commandeId))

    const nextEtat = totalAccepte <= 0 ? commande.etat : totalAccepte >= totalCommande ? 'recue' : 'partiellement_recue'
    await tx.update(commandes).set({ etat: nextEtat }).where(eq(commandes.id, input.commandeId))

    return reception
  })
}

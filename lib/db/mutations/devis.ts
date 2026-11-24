import { eq } from 'drizzle-orm'
import { db } from '../client'
import { devis, devisLignes } from '../schema'
import { finalNumero, placeholderNumero } from '../numero'
import { assertArticlesProduitFini, assertLignes, insertCommandeClientTx, type CommandeClientLigneInput } from './ventes'
import { writeAuditLog, type Actor } from './audit'
import { toGnf } from '../../money'

export type DevisInput = {
  clientId: number
  commercial?: string
  dateDevis: string
  validiteJours?: number
  reference?: string
  commentaire?: string
  lignes: CommandeClientLigneInput[]
}

function estExpire(dateDevis: string, validiteJours: number | null): boolean {
  if (validiteJours === null) return false
  const today = new Date().toISOString().slice(0, 10)
  const expirationDate = new Date(`${dateDevis}T00:00:00Z`)
  expirationDate.setUTCDate(expirationDate.getUTCDate() + validiteJours)
  return expirationDate.toISOString().slice(0, 10) < today
}

export async function createDevis(input: DevisInput) {
  assertLignes(input.lignes)
  await assertArticlesProduitFini(db, input.lignes)

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(devis)
      .values({
        numero: placeholderNumero(),
        clientId: input.clientId,
        commercial: input.commercial ?? null,
        dateDevis: input.dateDevis,
        validiteJours: input.validiteJours ?? null,
        reference: input.reference ?? null,
        commentaire: input.commentaire ?? null,
        etat: 'brouillon',
      })
      .returning()

    await tx.update(devis).set({ numero: finalNumero('DEV', row.id) }).where(eq(devis.id, row.id))

    await tx.insert(devisLignes).values(
      input.lignes.map((ligne) => ({
        devisId: row.id,
        articleId: ligne.articleId,
        nomAffiche: ligne.nomAffiche,
        quantite: ligne.quantite,
        prixUnitaire: toGnf(ligne.prixUnitaire),
      })),
    )

    return { ...row, numero: finalNumero('DEV', row.id) }
  })
}

export async function updateDevis(id: number, input: DevisInput) {
  assertLignes(input.lignes)
  await assertArticlesProduitFini(db, input.lignes)

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(devis).where(eq(devis.id, id)).for('update')
    if (!existing) throw new Error('Devis introuvable.')
    if (existing.etat !== 'brouillon') throw new Error("Ce devis a déjà été accepté ou refusé — il n'est plus modifiable.")

    const [row] = await tx
      .update(devis)
      .set({
        clientId: input.clientId,
        commercial: input.commercial ?? null,
        dateDevis: input.dateDevis,
        validiteJours: input.validiteJours ?? null,
        reference: input.reference ?? null,
        commentaire: input.commentaire ?? null,
      })
      .where(eq(devis.id, id))
      .returning()

    await tx.delete(devisLignes).where(eq(devisLignes.devisId, id))
    await tx.insert(devisLignes).values(
      input.lignes.map((ligne) => ({
        devisId: id,
        articleId: ligne.articleId,
        nomAffiche: ligne.nomAffiche,
        quantite: ligne.quantite,
        prixUnitaire: toGnf(ligne.prixUnitaire),
      })),
    )

    return row
  })
}

/** "Accepter" fait les deux choses en un clic (décision validée avec le client) : marque le
 * devis `accepte` ET crée la commande client (brouillon) avec les mêmes lignes, dans la même
 * transaction. */
export async function accepterDevis(id: number, actor: Actor) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(devis).where(eq(devis.id, id)).for('update')
    if (!existing) throw new Error('Devis introuvable.')
    if (existing.etat !== 'brouillon') throw new Error('Ce devis a déjà été accepté ou refusé.')
    if (estExpire(existing.dateDevis, existing.validiteJours)) throw new Error('Ce devis a expiré — il ne peut plus être accepté.')

    const lignes = await tx.select().from(devisLignes).where(eq(devisLignes.devisId, id))
    if (lignes.length === 0) throw new Error('Ce devis n\'a aucune ligne.')

    const commande = await insertCommandeClientTx(tx, {
      clientId: existing.clientId,
      commercial: existing.commercial ?? undefined,
      dateCommande: new Date().toISOString().slice(0, 10),
      reference: existing.reference ?? undefined,
      commentaire: existing.commentaire ?? undefined,
      lignes: lignes.map((ligne) => ({
        articleId: ligne.articleId,
        nomAffiche: ligne.nomAffiche,
        quantite: ligne.quantite,
        prixUnitaire: ligne.prixUnitaire,
      })),
    })

    const [updated] = await tx.update(devis).set({ etat: 'accepte', commandeClientId: commande.id }).where(eq(devis.id, id)).returning()

    await writeAuditLog(tx, {
      entityType: 'devis',
      entityId: id,
      action: 'update',
      actor,
      beforeData: existing,
      afterData: updated,
    })

    return { devis: updated, commande }
  })
}

export async function refuserDevis(id: number, actor: Actor, reason?: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(devis).where(eq(devis.id, id)).for('update')
    if (!existing) throw new Error('Devis introuvable.')
    if (existing.etat !== 'brouillon') throw new Error('Ce devis a déjà été accepté ou refusé.')

    const [updated] = await tx.update(devis).set({ etat: 'refuse' }).where(eq(devis.id, id)).returning()

    await writeAuditLog(tx, {
      entityType: 'devis',
      entityId: id,
      action: 'update',
      actor,
      reason,
      beforeData: existing,
      afterData: updated,
    })

    return updated
  })
}

export { estExpire }

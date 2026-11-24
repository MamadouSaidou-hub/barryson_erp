import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '../client'
import { articles, clients, commandeClientEtats, commandesClients, commandesClientsLignes, livraisonsClients, livraisonsClientsLignes, paiementsClients } from '../schema'
import { finalNumero, placeholderNumero } from '../numero'
import { insertStockMouvement } from './stock'
import { writeAuditLog, type Actor } from './audit'
import { toGnf } from '../../money'

type Executor = Pick<typeof db, 'select' | 'insert' | 'update' | 'transaction'>

export type CommandeClientLigneInput = {
  articleId: number
  nomAffiche: string
  quantite: number
  prixUnitaire: number
}

export type CommandeClientInput = {
  clientId: number
  commercial?: string
  dateCommande: string
  reference?: string
  commentaire?: string
  lignes: CommandeClientLigneInput[]
}

export function assertLignes(lignes: CommandeClientLigneInput[]) {
  if (lignes.length === 0) throw new Error('Ajoutez au moins une ligne à la commande.')
  for (const ligne of lignes) {
    if (ligne.quantite <= 0) throw new Error('Chaque quantité doit être strictement positive.')
    if (ligne.prixUnitaire < 0) throw new Error('Le prix ne peut pas être négatif.')
  }
}

export async function assertArticlesProduitFini(executor: Executor, lignes: CommandeClientLigneInput[]) {
  const ids = [...new Set(lignes.map((l) => l.articleId))]
  const rows = await executor.select({ id: articles.id, level: articles.level, name: articles.name }).from(articles).where(inArray(articles.id, ids))
  const byId = new Map(rows.map((r) => [r.id, r]))
  for (const id of ids) {
    const article = byId.get(id)
    if (!article) throw new Error('Article introuvable.')
    if (article.level !== 'produit_fini') throw new Error(`"${article.name}" n'est pas un produit fini — seuls les produits finis peuvent être vendus.`)
  }
}

/** Cœur de la création d'une commande client, exécuté dans une transaction déjà ouverte — permet
 * à `accepterDevis` de créer la commande dans sa propre transaction (atomique avec le changement
 * d'état du devis), sans dupliquer cette logique. */
export async function insertCommandeClientTx(tx: Executor, input: CommandeClientInput) {
  const [commande] = await tx
    .insert(commandesClients)
    .values({
      numero: placeholderNumero(),
      clientId: input.clientId,
      commercial: input.commercial ?? null,
      dateCommande: input.dateCommande,
      reference: input.reference ?? null,
      commentaire: input.commentaire ?? null,
      etat: 'brouillon',
    })
    .returning()

  await tx.update(commandesClients).set({ numero: finalNumero('BCC', commande.id) }).where(eq(commandesClients.id, commande.id))

  await tx.insert(commandesClientsLignes).values(
    input.lignes.map((ligne) => ({
      commandeClientId: commande.id,
      articleId: ligne.articleId,
      nomAffiche: ligne.nomAffiche,
      quantite: ligne.quantite,
      prixUnitaire: toGnf(ligne.prixUnitaire),
    })),
  )

  return { ...commande, numero: finalNumero('BCC', commande.id) }
}

export async function createCommandeClient(input: CommandeClientInput) {
  assertLignes(input.lignes)
  await assertArticlesProduitFini(db, input.lignes)
  return db.transaction((tx) => insertCommandeClientTx(tx, input))
}

export async function updateCommandeClient(id: number, input: CommandeClientInput) {
  assertLignes(input.lignes)
  await assertArticlesProduitFini(db, input.lignes)

  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(commandesClients).where(eq(commandesClients.id, id)).for('update')
    if (!existing) throw new Error('Commande introuvable.')
    if (existing.etat !== 'brouillon') throw new Error("Cette commande a déjà été confirmée — elle n'est plus modifiable.")

    const [commande] = await tx
      .update(commandesClients)
      .set({
        clientId: input.clientId,
        commercial: input.commercial ?? null,
        dateCommande: input.dateCommande,
        reference: input.reference ?? null,
        commentaire: input.commentaire ?? null,
      })
      .where(eq(commandesClients.id, id))
      .returning()

    await tx.delete(commandesClientsLignes).where(eq(commandesClientsLignes.commandeClientId, id))
    await tx.insert(commandesClientsLignes).values(
      input.lignes.map((ligne) => ({
        commandeClientId: id,
        articleId: ligne.articleId,
        nomAffiche: ligne.nomAffiche,
        quantite: ligne.quantite,
        prixUnitaire: toGnf(ligne.prixUnitaire),
      })),
    )

    return commande
  })
}

/** Somme des soldes (total - payé) des commandes de ce client qui engagent réellement du crédit
 * (ni brouillon — pas encore réel —, ni annulée). Utilisée par `confirmerCommandeClient` pour le
 * contrôle de plafond, et exposée en lecture par `lib/db/queries/ventes.ts` pour l'affichage.
 *
 * Calculé en JS plutôt qu'avec une sous-requête corrélée imbriquée dans un `sum()` : cette
 * dernière forme s'est révélée peu fiable avec le query builder de Drizzle (résultat erroné,
 * ne sommant pas correctement sur plusieurs commandes) malgré un SQL manuellement vérifié
 * correct — préférer des requêtes simples + une réduction JS, plus lisible et plus sûr. */
export async function calculerEncoursClient(executor: Executor, clientId: number): Promise<number> {
  const commandesEngagees = await executor
    .select({ id: commandesClients.id })
    .from(commandesClients)
    .where(and(eq(commandesClients.clientId, clientId), inArray(commandesClients.etat, ['confirmee', 'partiellement_livree', 'livree'])))
  if (commandesEngagees.length === 0) return 0

  const ids = commandesEngagees.map((c) => c.id)
  const [lignes, paiements] = await Promise.all([
    executor.select({ commandeClientId: commandesClientsLignes.commandeClientId, quantite: commandesClientsLignes.quantite, prixUnitaire: commandesClientsLignes.prixUnitaire }).from(commandesClientsLignes).where(inArray(commandesClientsLignes.commandeClientId, ids)),
    executor.select({ montant: paiementsClients.montant }).from(paiementsClients).where(inArray(paiementsClients.commandeClientId, ids)),
  ])

  const totalLignes = lignes.reduce((sum, ligne) => sum + ligne.quantite * ligne.prixUnitaire, 0)
  const totalPaye = paiements.reduce((sum, paiement) => sum + paiement.montant, 0)
  return totalLignes - totalPaye
}

export async function confirmerCommandeClient(id: number, actor: Actor) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(commandesClients).where(eq(commandesClients.id, id)).for('update')
    if (!existing) throw new Error('Commande introuvable.')
    if (existing.etat !== 'brouillon') throw new Error('Cette commande a déjà été confirmée.')

    const lignes = await tx.select().from(commandesClientsLignes).where(eq(commandesClientsLignes.commandeClientId, id))
    if (lignes.length === 0) throw new Error('Ajoutez au moins une ligne avant de confirmer.')
    const totalCommande = lignes.reduce((sum, ligne) => sum + ligne.quantite * ligne.prixUnitaire, 0)

    const [client] = await tx.select().from(clients).where(eq(clients.id, existing.clientId))
    if (!client) throw new Error('Client introuvable.')

    if (client.plafondEncours !== null) {
      const encoursActuel = await calculerEncoursClient(tx, client.id)
      const marge = client.plafondEncours - encoursActuel
      if (totalCommande > marge) {
        throw new Error(
          `Plafond d'encours dépassé pour ${client.name} : encours actuel ${Math.round(encoursActuel)}, ` +
            `plafond ${Math.round(client.plafondEncours)}, marge restante ${Math.round(marge)} — ` +
            `cette commande de ${Math.round(totalCommande)} la dépasse de ${Math.round(totalCommande - marge)}.`,
        )
      }
    }

    const [commande] = await tx.update(commandesClients).set({ etat: 'confirmee' }).where(eq(commandesClients.id, id)).returning()

    await writeAuditLog(tx, {
      entityType: 'commande_client',
      entityId: id,
      action: 'update',
      actor,
      beforeData: existing,
      afterData: commande,
    })

    return commande
  })
}

export async function annulerCommandeClient(id: number, actor: Actor, reason?: string) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(commandesClients).where(eq(commandesClients.id, id)).for('update')
    if (!existing) throw new Error('Commande introuvable.')
    if (existing.etat === 'annulee') throw new Error('Cette commande est déjà annulée.')
    if (existing.etat === 'livree' || existing.etat === 'partiellement_livree') {
      throw new Error('Cette commande a déjà des livraisons — elle ne peut plus être annulée.')
    }

    const [commande] = await tx.update(commandesClients).set({ etat: 'annulee' }).where(eq(commandesClients.id, id)).returning()

    await writeAuditLog(tx, {
      entityType: 'commande_client',
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

// ---------------------------------------------------------------------------
// Livraisons
// ---------------------------------------------------------------------------

export type LivraisonClientLigneInput = { commandeClientLigneId: number; quantiteLivree: number }

export async function createLivraisonClient(input: { commandeClientId: number; date: string; lignes: LivraisonClientLigneInput[] }, actor: Actor) {
  const lignesAvecQuantite = input.lignes.filter((l) => l.quantiteLivree > 0)
  if (lignesAvecQuantite.length === 0) throw new Error('Indiquez au moins une quantité à livrer.')

  return db.transaction(async (tx) => {
    const [commande] = await tx.select().from(commandesClients).where(eq(commandesClients.id, input.commandeClientId)).for('update')
    if (!commande) throw new Error('Commande introuvable.')
    if (commande.etat !== 'confirmee' && commande.etat !== 'partiellement_livree') {
      throw new Error("Cette commande n'est pas en attente de livraison.")
    }

    const lignesCommande = await tx.select().from(commandesClientsLignes).where(eq(commandesClientsLignes.commandeClientId, input.commandeClientId))
    const lignesCommandeById = new Map(lignesCommande.map((ligne) => [ligne.id, ligne]))

    const [livraison] = await tx
      .insert(livraisonsClients)
      .values({ commandeClientId: input.commandeClientId, numero: placeholderNumero(), date: input.date })
      .returning()
    livraison.numero = finalNumero('BL', livraison.id)
    await tx.update(livraisonsClients).set({ numero: livraison.numero }).where(eq(livraisonsClients.id, livraison.id))

    for (const ligne of lignesAvecQuantite) {
      const commandeLigne = lignesCommandeById.get(ligne.commandeClientLigneId)
      if (!commandeLigne) throw new Error('Ligne de commande introuvable.')

      await tx.insert(livraisonsClientsLignes).values({
        livraisonId: livraison.id,
        commandeClientLigneId: ligne.commandeClientLigneId,
        quantiteLivree: ligne.quantiteLivree,
      })

      await insertStockMouvement(tx, {
        articleId: commandeLigne.articleId,
        type: 'vente',
        quantite: ligne.quantiteLivree,
        motif: `Livraison ${livraison.numero}`,
        actor,
        date: input.date,
      })
    }

    // État déduit (jamais choisi à la main) en comparant, pour chaque ligne de la commande, le
    // total livré jusqu'ici à la quantité commandée — même calcul que pour les réceptions achat.
    const [{ totalCommande, totalLivre }] = await tx
      .select({
        totalCommande: sql<number>`coalesce(sum(${commandesClientsLignes.quantite}), 0)`,
        totalLivre: sql<number>`coalesce((
          select sum(${livraisonsClientsLignes.quantiteLivree})
          from ${livraisonsClientsLignes}
          where ${livraisonsClientsLignes.commandeClientLigneId} in (select id from ${commandesClientsLignes} where ${commandesClientsLignes.commandeClientId} = ${input.commandeClientId})
        ), 0)`,
      })
      .from(commandesClientsLignes)
      .where(eq(commandesClientsLignes.commandeClientId, input.commandeClientId))

    const nextEtat = totalLivre >= totalCommande ? 'livree' : 'partiellement_livree'
    await tx.update(commandesClients).set({ etat: nextEtat }).where(eq(commandesClients.id, input.commandeClientId))

    return livraison
  })
}

// ---------------------------------------------------------------------------
// Paiements
// ---------------------------------------------------------------------------

export async function enregistrerPaiementClient(commandeClientId: number, input: { montant: number; methode: string; date: string }) {
  if (input.montant <= 0) throw new Error('Le montant doit être strictement positif.')

  const [commande] = await db.select().from(commandesClients).where(eq(commandesClients.id, commandeClientId))
  if (!commande) throw new Error('Commande introuvable.')

  const [paiement] = await db
    .insert(paiementsClients)
    .values({ commandeClientId, montant: toGnf(input.montant), methode: input.methode, date: input.date })
    .returning()
  return paiement
}

export { commandeClientEtats }

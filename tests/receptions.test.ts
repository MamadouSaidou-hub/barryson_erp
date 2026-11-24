import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, commandeLignes, commandes, fournisseurs, receptionLignes, receptions, stockMouvements, stockNiveaux } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { createFournisseur } from '../lib/db/mutations/fournisseurs'
import { createCommande, passerCommande } from '../lib/db/mutations/commandes'
import { createReception } from '../lib/db/mutations/receptions'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Receptions' }

let fournisseurId: number
let articleId: number
const commandeIds: number[] = []
const receptionIds: number[] = []

beforeAll(async () => {
  const fournisseur = await createFournisseur({ name: `Fournisseur Reception ${runId}` })
  fournisseurId = fournisseur.id
  const article = await createArticle({ name: `Article Reception ${runId}`, level: 'semi_fini', unit: 'rouleau' })
  articleId = article.id
})

afterAll(async () => {
  if (receptionIds.length > 0) {
    await db.delete(stockMouvements).where(eq(stockMouvements.articleId, articleId))
    await db.delete(receptionLignes).where(inArray(receptionLignes.receptionId, receptionIds))
    await db.delete(receptions).where(inArray(receptions.id, receptionIds))
  }
  if (commandeIds.length > 0) {
    await db.delete(commandeLignes).where(inArray(commandeLignes.commandeId, commandeIds))
    await db.delete(commandes).where(inArray(commandes.id, commandeIds))
  }
  await db.delete(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
  await db.delete(articles).where(eq(articles.id, articleId))
  await db.delete(fournisseurs).where(eq(fournisseurs.id, fournisseurId))
})

async function commandePassee(quantite: number) {
  const commande = await createCommande({ fournisseurId, devise: 'USD', lignes: [{ articleId, nomAffiche: `Ligne ${runId}`, quantite, prixUnitaire: 100 }] })
  commandeIds.push(commande.id)
  await passerCommande(commande.id, actor)
  const [ligne] = await db.select().from(commandeLignes).where(eq(commandeLignes.commandeId, commande.id))
  return { commandeId: commande.id, commandeLigneId: ligne.id }
}

describe('createReception', () => {
  it('une réception partielle passe la commande à "partiellement_recue" et met à jour le stock', async () => {
    const { commandeId, commandeLigneId } = await commandePassee(10)

    const reception = await createReception(
      { commandeId, date: '2026-01-01', documentsConformes: true, lignes: [{ commandeLigneId, quantiteRecue: 6, quantiteAcceptee: 6 }] },
      actor,
    )
    receptionIds.push(reception.id)

    const [commande] = await db.select().from(commandes).where(eq(commandes.id, commandeId))
    expect(commande.etat).toBe('partiellement_recue')

    const [niveau] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
    expect(niveau.quantite).toBeGreaterThanOrEqual(6)
  })

  it('réceptionner le reste passe la commande à "recue"', async () => {
    const { commandeId, commandeLigneId } = await commandePassee(10)

    const reception1 = await createReception(
      { commandeId, date: '2026-01-01', documentsConformes: true, lignes: [{ commandeLigneId, quantiteRecue: 4, quantiteAcceptee: 4 }] },
      actor,
    )
    receptionIds.push(reception1.id)

    const reception2 = await createReception(
      { commandeId, date: '2026-01-02', documentsConformes: true, lignes: [{ commandeLigneId, quantiteRecue: 6, quantiteAcceptee: 6 }] },
      actor,
    )
    receptionIds.push(reception2.id)

    const [commande] = await db.select().from(commandes).where(eq(commandes.id, commandeId))
    expect(commande.etat).toBe('recue')
  })

  it("une ligne non conforme n'entre en stock que pour la quantité acceptée", async () => {
    const { commandeId, commandeLigneId } = await commandePassee(10)
    const [avant] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))

    const reception = await createReception(
      {
        commandeId,
        date: '2026-01-01',
        documentsConformes: false,
        lignes: [{ commandeLigneId, quantiteRecue: 10, quantiteAcceptee: 7, motifEcart: '3 rouleaux endommagés' }],
      },
      actor,
    )
    receptionIds.push(reception.id)

    const [apres] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
    expect(apres.quantite - (avant?.quantite ?? 0)).toBe(7)

    const [commande] = await db.select().from(commandes).where(eq(commandes.id, commandeId))
    expect(commande.etat).toBe('partiellement_recue')
  })

  it("refuse de réceptionner une commande qui n'est pas en attente (brouillon)", async () => {
    const commande = await createCommande({ fournisseurId, devise: 'USD', lignes: [{ articleId, nomAffiche: `Ligne ${runId}`, quantite: 5, prixUnitaire: 100 }] })
    commandeIds.push(commande.id)
    const [ligne] = await db.select().from(commandeLignes).where(eq(commandeLignes.commandeId, commande.id))

    await expect(
      createReception({ commandeId: commande.id, date: '2026-01-01', documentsConformes: true, lignes: [{ commandeLigneId: ligne.id, quantiteRecue: 5, quantiteAcceptee: 5 }] }, actor),
    ).rejects.toThrow(/pas en attente de réception/i)
  })
})

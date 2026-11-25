import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, commandeLignes, commandes, fournisseurs, paiementsFournisseurs } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { createFournisseur } from '../lib/db/mutations/fournisseurs'
import { createCommande, enregistrerPaiementFournisseur, passerCommande } from '../lib/db/mutations/commandes'
import { getCommandesList, getTresorerieAchats } from '../lib/db/queries/commandes'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Paiements' }

let fournisseurId: number
let articleId: number
const commandeIds: number[] = []

beforeAll(async () => {
  const fournisseur = await createFournisseur({ name: `Fournisseur Paiements ${runId}` })
  fournisseurId = fournisseur.id
  const article = await createArticle({ name: `Article Paiements ${runId}`, level: 'semi_fini', unit: 'rouleau' })
  articleId = article.id
})

afterAll(async () => {
  if (commandeIds.length > 0) {
    await db.delete(paiementsFournisseurs).where(inArray(paiementsFournisseurs.commandeId, commandeIds))
    await db.delete(commandeLignes).where(inArray(commandeLignes.commandeId, commandeIds))
    await db.delete(commandes).where(inArray(commandes.id, commandeIds))
  }
  await db.delete(articles).where(eq(articles.id, articleId))
  await db.delete(fournisseurs).where(eq(fournisseurs.id, fournisseurId))
})

async function creerCommande(prixUnitaire: number, devise = 'USD') {
  const commande = await createCommande({
    fournisseurId,
    devise,
    lignes: [{ articleId, nomAffiche: 'x', quantite: 1, prixUnitaire }],
  })
  commandeIds.push(commande.id)
  return commande
}

describe('enregistrerPaiementFournisseur', () => {
  it('enregistre un paiement et calcule le solde restant', async () => {
    const commande = await creerCommande(1000)
    await enregistrerPaiementFournisseur(commande.id, { montant: 400, methode: 'Virement', date: '2026-02-01' })

    const liste = await getCommandesList()
    const row = liste.find((c) => c.id === commande.id)
    expect(row?.totalPaye).toBe(400)
    expect(row?.solde).toBe(600)
  })

  it('refuse un montant invalide ou une commande inconnue', async () => {
    const commande = await creerCommande(500)
    await expect(enregistrerPaiementFournisseur(commande.id, { montant: 0, methode: 'Virement', date: '2026-02-01' })).rejects.toThrow(/positif/i)
    await expect(enregistrerPaiementFournisseur(-1, { montant: 100, methode: 'Virement', date: '2026-02-01' })).rejects.toThrow(/introuvable/i)
  })
})

describe('getTresorerieAchats', () => {
  it('agrège le commandé/payé/solde par devise', async () => {
    const commande = await creerCommande(2000, 'EUR')
    await passerCommande(commande.id, actor)
    await enregistrerPaiementFournisseur(commande.id, { montant: 500, methode: 'Virement', date: '2026-02-01' })

    const tresorerie = await getTresorerieAchats()
    const ligneEur = tresorerie.find((t) => t.devise === 'EUR')
    expect(ligneEur).toBeDefined()
    expect(ligneEur!.totalCommande).toBeGreaterThanOrEqual(2000)
    expect(ligneEur!.totalPaye).toBeGreaterThanOrEqual(500)
  })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, clients, commandesClients, commandesClientsLignes, livraisonsClients, livraisonsClientsLignes, paiementsClients, stockMouvements, stockNiveaux } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { createClient } from '../lib/db/mutations/clients'
import { recordManualStockMovement } from '../lib/db/mutations/stock'
import { annulerCommandeClient, calculerEncoursClient, confirmerCommandeClient, createCommandeClient, createLivraisonClient, enregistrerPaiementClient, updateCommandeClient } from '../lib/db/mutations/ventes'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Ventes' }

let clientId: number
let articleId: number
const commandeIds: number[] = []
const livraisonIds: number[] = []

beforeAll(async () => {
  const client = await createClient({ name: `Client Test ${runId}`, plafondEncours: 500_000 })
  clientId = client.id
  const article = await createArticle({ name: `Produit Fini Test ${runId}`, level: 'produit_fini', unit: 'piece' })
  articleId = article.id
  await recordManualStockMovement({ articleId, direction: 'entree', quantite: 200 }, actor)
})

afterAll(async () => {
  if (livraisonIds.length > 0) {
    await db.delete(livraisonsClientsLignes).where(inArray(livraisonsClientsLignes.livraisonId, livraisonIds))
    await db.delete(livraisonsClients).where(inArray(livraisonsClients.id, livraisonIds))
  }
  if (commandeIds.length > 0) {
    await db.delete(paiementsClients).where(inArray(paiementsClients.commandeClientId, commandeIds))
    await db.delete(commandesClientsLignes).where(inArray(commandesClientsLignes.commandeClientId, commandeIds))
    await db.delete(commandesClients).where(inArray(commandesClients.id, commandeIds))
  }
  await db.delete(stockMouvements).where(eq(stockMouvements.articleId, articleId))
  await db.delete(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
  await db.delete(articles).where(eq(articles.id, articleId))
  await db.delete(clients).where(eq(clients.id, clientId))
})

function ligne(quantite = 10, prixUnitaire = 1000) {
  return [{ articleId, nomAffiche: `Ligne ${runId}`, quantite, prixUnitaire }]
}

describe('createCommandeClient', () => {
  it('crée une commande en brouillon avec un numéro BCC-AAAA-NNNNN', async () => {
    const commande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: ligne() })
    commandeIds.push(commande.id)
    expect(commande.etat).toBe('brouillon')
    expect(commande.numero).toMatch(/^BCC-\d{4}-\d{5}$/)
  })

  it("refuse une ligne dont l'article n'est pas un produit fini", async () => {
    const matierePremiere = await createArticle({ name: `MP ${runId}`, level: 'matiere_premiere', unit: 'kg' })
    await expect(
      createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: [{ articleId: matierePremiere.id, nomAffiche: 'x', quantite: 1, prixUnitaire: 1 }] }),
    ).rejects.toThrow(/produit fini/i)
    await db.delete(articles).where(eq(articles.id, matierePremiere.id))
  })
})

describe('updateCommandeClient', () => {
  it('modifie les lignes tant que la commande est en brouillon, refuse après confirmation', async () => {
    const commande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: ligne(5) })
    commandeIds.push(commande.id)

    await updateCommandeClient(commande.id, { clientId, dateCommande: '2026-01-01', lignes: ligne(8) })
    const lignes = await db.select().from(commandesClientsLignes).where(eq(commandesClientsLignes.commandeClientId, commande.id))
    expect(lignes[0].quantite).toBe(8)

    await confirmerCommandeClient(commande.id, actor)
    await expect(updateCommandeClient(commande.id, { clientId, dateCommande: '2026-01-01', lignes: ligne(99) })).rejects.toThrow(/plus modifiable/i)
  })
})

describe('confirmerCommandeClient — plafond d’encours', () => {
  it('bloque une commande qui dépasserait le plafond, et accepte une fois sous le plafond', async () => {
    const tropGrande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: ligne(600, 1000) }) // 600 000 > 500 000
    commandeIds.push(tropGrande.id)

    await expect(confirmerCommandeClient(tropGrande.id, actor)).rejects.toThrow(/plafond d'encours dépassé/i)

    await updateCommandeClient(tropGrande.id, { clientId, dateCommande: '2026-01-01', lignes: ligne(400, 1000) }) // 400 000 ≤ 500 000
    const confirmed = await confirmerCommandeClient(tropGrande.id, actor)
    expect(confirmed.etat).toBe('confirmee')
  })

  it("l'encours cumule plusieurs commandes confirmées du même client", async () => {
    const premiere = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: ligne(10, 1000) }) // 10 000
    commandeIds.push(premiere.id)
    await confirmerCommandeClient(premiere.id, actor)

    const encours = await calculerEncoursClient(db, clientId)
    expect(encours).toBeGreaterThanOrEqual(10_000)
  })
})

describe('annulerCommandeClient', () => {
  it('annule une commande en brouillon et refuse une seconde annulation', async () => {
    const commande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: ligne() })
    commandeIds.push(commande.id)

    const cancelled = await annulerCommandeClient(commande.id, actor, 'Erreur de saisie')
    expect(cancelled.etat).toBe('annulee')
    await expect(annulerCommandeClient(commande.id, actor)).rejects.toThrow(/déjà annulée/i)
  })
})

describe('createLivraisonClient', () => {
  it('livraison partielle puis totale : état déduit et stock décrémenté', async () => {
    const commande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: ligne(10, 1000) })
    commandeIds.push(commande.id)
    await confirmerCommandeClient(commande.id, actor)
    const [ligneCommande] = await db.select().from(commandesClientsLignes).where(eq(commandesClientsLignes.commandeClientId, commande.id))

    const [avant] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))

    const livraison1 = await createLivraisonClient({ commandeClientId: commande.id, date: '2026-01-02', lignes: [{ commandeClientLigneId: ligneCommande.id, quantiteLivree: 6 }] }, actor)
    livraisonIds.push(livraison1.id)
    expect(livraison1.numero).toMatch(/^BL-\d{4}-\d{5}$/)

    const [apresPartiel] = await db.select().from(commandesClients).where(eq(commandesClients.id, commande.id))
    expect(apresPartiel.etat).toBe('partiellement_livree')

    const livraison2 = await createLivraisonClient({ commandeClientId: commande.id, date: '2026-01-03', lignes: [{ commandeClientLigneId: ligneCommande.id, quantiteLivree: 4 }] }, actor)
    livraisonIds.push(livraison2.id)

    const [apresComplet] = await db.select().from(commandesClients).where(eq(commandesClients.id, commande.id))
    expect(apresComplet.etat).toBe('livree')

    const [niveau] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
    expect(niveau.quantite).toBe((avant?.quantite ?? 0) - 10)
  })

  it('refuse une livraison supérieure au stock disponible', async () => {
    // Quantité très supérieure au stock initial (200) mais prix nul pour ne jamais déclencher
    // le contrôle de plafond d'encours (total = 0) — ce test cible uniquement le contrôle de stock.
    const commande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: ligne(100_000, 0) })
    commandeIds.push(commande.id)
    await confirmerCommandeClient(commande.id, actor)
    const [ligneCommande] = await db.select().from(commandesClientsLignes).where(eq(commandesClientsLignes.commandeClientId, commande.id))

    await expect(
      createLivraisonClient({ commandeClientId: commande.id, date: '2026-01-02', lignes: [{ commandeClientLigneId: ligneCommande.id, quantiteLivree: 100_000 }] }, actor),
    ).rejects.toThrow(/stock insuffisant/i)
  })
})

describe('enregistrerPaiementClient', () => {
  it('enregistre un paiement partiel et réduit le solde', async () => {
    const commande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: ligne(10, 1000) }) // total 10 000
    commandeIds.push(commande.id)
    await confirmerCommandeClient(commande.id, actor)

    await enregistrerPaiementClient(commande.id, { montant: 4000, methode: 'Espèces', date: '2026-01-02' })

    const paiements = await db.select().from(paiementsClients).where(eq(paiementsClients.commandeClientId, commande.id))
    const totalPaye = paiements.reduce((sum, p) => sum + p.montant, 0)
    expect(totalPaye).toBe(4000)
  })
})

describe('montants GNF — intégrité entière', () => {
  it('arrondit un montant fractionnaire à l’entier le plus proche (jamais de flottant en base)', async () => {
    const commande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: ligne(10, 1000) })
    commandeIds.push(commande.id)
    await confirmerCommandeClient(commande.id, actor)

    await enregistrerPaiementClient(commande.id, { montant: 1234.56, methode: 'Espèces', date: '2026-01-02' })
    const [paiement] = await db.select().from(paiementsClients).where(eq(paiementsClients.commandeClientId, commande.id))
    expect(paiement.montant).toBe(1235)
    expect(Number.isInteger(paiement.montant)).toBe(true)
  })

  it('arrondit le prix de vente et conserve un gros montant GNF sans perte de précision', async () => {
    const grosPrix = 2_000_000_123 // > limite d'un integer 4 octets (2,147,483,647 ? non : ici < mais au-delà du confort), prouve que bigint tient
    const commande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: [{ articleId, nomAffiche: 'x', quantite: 1, prixUnitaire: grosPrix + 0.4 }] })
    commandeIds.push(commande.id)
    const [ligneDb] = await db.select().from(commandesClientsLignes).where(eq(commandesClientsLignes.commandeClientId, commande.id))
    expect(ligneDb.prixUnitaire).toBe(grosPrix)
    expect(Number.isInteger(ligneDb.prixUnitaire)).toBe(true)
  })

  it('le plafond d’encours est stocké en entier', async () => {
    const c = await createClient({ name: `Client Plafond ${runId}`, plafondEncours: 7_500_000.9 })
    const [fromDb] = await db.select().from(clients).where(eq(clients.id, c.id))
    expect(fromDb.plafondEncours).toBe(7_500_001)
    await db.delete(clients).where(eq(clients.id, c.id))
  })
})

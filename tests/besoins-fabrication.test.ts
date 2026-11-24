import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, clients, commandesClients, commandesClientsLignes, livraisonsClients, livraisonsClientsLignes, stockMouvements, stockNiveaux } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { createClient } from '../lib/db/mutations/clients'
import { recordManualStockMovement } from '../lib/db/mutations/stock'
import { confirmerCommandeClient, createCommandeClient, createLivraisonClient } from '../lib/db/mutations/ventes'
import { getBesoinsFabricationList } from '../lib/db/queries/besoins-fabrication'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Besoins' }

let clientId: number
let articleId: number
const commandeIds: number[] = []
const livraisonIds: number[] = []

beforeAll(async () => {
  const client = await createClient({ name: `Client Besoin ${runId}` })
  clientId = client.id
  const article = await createArticle({ name: `Produit Fini Besoin ${runId}`, level: 'produit_fini', unit: 'piece' })
  articleId = article.id
  await recordManualStockMovement({ articleId, direction: 'entree', quantite: 50 }, actor)
})

afterAll(async () => {
  if (livraisonIds.length > 0) {
    await db.delete(livraisonsClientsLignes).where(inArray(livraisonsClientsLignes.livraisonId, livraisonIds))
    await db.delete(livraisonsClients).where(inArray(livraisonsClients.id, livraisonIds))
  }
  if (commandeIds.length > 0) {
    await db.delete(commandesClientsLignes).where(inArray(commandesClientsLignes.commandeClientId, commandeIds))
    await db.delete(commandesClients).where(inArray(commandesClients.id, commandeIds))
  }
  await db.delete(stockMouvements).where(eq(stockMouvements.articleId, articleId))
  await db.delete(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
  await db.delete(articles).where(eq(articles.id, articleId))
  await db.delete(clients).where(eq(clients.id, clientId))
})

describe('getBesoinsFabricationList', () => {
  it("n'apparaît pas tant que le stock couvre la demande confirmée", async () => {
    const commande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: [{ articleId, nomAffiche: 'x', quantite: 30, prixUnitaire: 1000 }] })
    commandeIds.push(commande.id)
    await confirmerCommandeClient(commande.id, actor)

    const besoins = await getBesoinsFabricationList()
    expect(besoins.find((b) => b.articleId === articleId)).toBeUndefined()
  })

  it('apparaît avec le manque exact quand la demande confirmée dépasse le stock, puis disparaît une fois livrée/stock reconstitué', async () => {
    const commande = await createCommandeClient({ clientId, dateCommande: '2026-01-01', lignes: [{ articleId, nomAffiche: 'x', quantite: 60, prixUnitaire: 1000 }] })
    commandeIds.push(commande.id)
    await confirmerCommandeClient(commande.id, actor)

    // Demande cumulée (30 + 60) = 90, stock = 50 → manque 40.
    let besoins = await getBesoinsFabricationList()
    expect(besoins.find((b) => b.articleId === articleId)?.manque).toBe(40)

    await recordManualStockMovement({ articleId, direction: 'entree', quantite: 40 }, actor)
    besoins = await getBesoinsFabricationList()
    expect(besoins.find((b) => b.articleId === articleId)).toBeUndefined()
  })
})

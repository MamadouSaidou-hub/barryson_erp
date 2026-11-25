import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, clients, commandesClients, commandesClientsLignes } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { createClient } from '../lib/db/mutations/clients'
import { confirmerCommandeClient, createCommandeClient, annulerCommandeClient } from '../lib/db/mutations/ventes'
import { getPerformanceClients } from '../lib/db/queries/ventes'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Performance' }

let articleId: number
const clientIds: number[] = []
const commandeIds: number[] = []

beforeAll(async () => {
  const article = await createArticle({ name: `Produit Performance ${runId}`, level: 'produit_fini', unit: 'piece' })
  articleId = article.id
})

afterAll(async () => {
  if (commandeIds.length > 0) {
    await db.delete(commandesClientsLignes).where(inArray(commandesClientsLignes.commandeClientId, commandeIds))
    await db.delete(commandesClients).where(inArray(commandesClients.id, commandeIds))
  }
  if (clientIds.length > 0) await db.delete(clients).where(inArray(clients.id, clientIds))
  await db.delete(articles).where(eq(articles.id, articleId))
})

describe('getPerformanceClients', () => {
  it('calcule CA cumulé, panier moyen, dernière commande et encours, en excluant brouillon/annulée', async () => {
    const client = await createClient({ name: `Client Performance ${runId}`, plafondEncours: 100_000 })
    clientIds.push(client.id)

    const c1 = await createCommandeClient({ clientId: client.id, dateCommande: '2026-01-10', lignes: [{ articleId, nomAffiche: 'x', quantite: 1, prixUnitaire: 20_000 }] })
    commandeIds.push(c1.id)
    await confirmerCommandeClient(c1.id, actor)

    const c2 = await createCommandeClient({ clientId: client.id, dateCommande: '2026-01-20', lignes: [{ articleId, nomAffiche: 'x', quantite: 1, prixUnitaire: 30_000 }] })
    commandeIds.push(c2.id)
    await confirmerCommandeClient(c2.id, actor)

    const c3 = await createCommandeClient({ clientId: client.id, dateCommande: '2026-01-25', lignes: [{ articleId, nomAffiche: 'x', quantite: 1, prixUnitaire: 999_000 }] })
    commandeIds.push(c3.id)
    await annulerCommandeClient(c3.id, actor)

    const liste = await getPerformanceClients()
    const row = liste.find((c) => c.clientId === client.id)
    expect(row).toBeDefined()
    expect(row!.caCumule).toBe(50_000)
    expect(row!.nombreCommandes).toBe(2)
    expect(row!.panierMoyen).toBe(25_000)
    expect(row!.derniereCommande).toBe('2026-01-20')
    expect(row!.encours).toBe(50_000)
    expect(row!.pctPlafond).toBe(0.5)
    expect(row!.procheDuPlafond).toBe(false)
  })

  it("retourne pctPlafond null quand le client n'a pas de plafond, et procheDuPlafond quand l'encours s'en approche", async () => {
    const sansPlafond = await createClient({ name: `Client Sans Plafond ${runId}` })
    clientIds.push(sansPlafond.id)
    const liste1 = await getPerformanceClients()
    expect(liste1.find((c) => c.clientId === sansPlafond.id)?.pctPlafond).toBeNull()

    const procheDuPlafond = await createClient({ name: `Client Proche Plafond ${runId}`, plafondEncours: 10_000 })
    clientIds.push(procheDuPlafond.id)
    const commande = await createCommandeClient({ clientId: procheDuPlafond.id, dateCommande: '2026-01-10', lignes: [{ articleId, nomAffiche: 'x', quantite: 1, prixUnitaire: 9_000 }] })
    commandeIds.push(commande.id)
    await confirmerCommandeClient(commande.id, actor)

    const liste2 = await getPerformanceClients()
    expect(liste2.find((c) => c.clientId === procheDuPlafond.id)?.procheDuPlafond).toBe(true)
  })
})

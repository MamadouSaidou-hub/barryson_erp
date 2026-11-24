import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, clients, commandesClients, commandesClientsLignes, paiementsClients, relancesClients } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { createClient } from '../lib/db/mutations/clients'
import { confirmerCommandeClient, createCommandeClient, enregistrerPaiementClient } from '../lib/db/mutations/ventes'
import { enregistrerRelanceClient, getRelancesClient } from '../lib/db/mutations/relances-clients'
import { getCreancesList } from '../lib/db/queries/ventes'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Relances' }

let clientId: number
let articleId: number
const commandeIds: number[] = []

beforeAll(async () => {
  // delaiPaiementJours: 0 + dateCommande ancienne → échéance largement dépassée, pour forcer un
  // retard de plus de 30 jours (niveau 3) sans dépendre de "aujourd'hui" côté test.
  const client = await createClient({ name: `Client Relance ${runId}`, delaiPaiementJours: 0 })
  clientId = client.id
  const article = await createArticle({ name: `Produit Fini Relance ${runId}`, level: 'produit_fini', unit: 'piece' })
  articleId = article.id
})

afterAll(async () => {
  if (commandeIds.length > 0) {
    await db.delete(relancesClients).where(inArray(relancesClients.commandeClientId, commandeIds))
    await db.delete(paiementsClients).where(inArray(paiementsClients.commandeClientId, commandeIds))
    await db.delete(commandesClientsLignes).where(inArray(commandesClientsLignes.commandeClientId, commandeIds))
    await db.delete(commandesClients).where(inArray(commandesClients.id, commandeIds))
  }
  await db.delete(articles).where(eq(articles.id, articleId))
  await db.delete(clients).where(eq(clients.id, clientId))
})

async function creerCommandeEnRetard(joursRetard: number) {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - joursRetard)
  const dateCommande = d.toISOString().slice(0, 10)
  const commande = await createCommandeClient({ clientId, dateCommande, lignes: [{ articleId, nomAffiche: 'x', quantite: 1, prixUnitaire: 10_000 }] })
  commandeIds.push(commande.id)
  await confirmerCommandeClient(commande.id, actor)
  return commande
}

describe('enregistrerRelanceClient', () => {
  it('enregistre une relance et refuse si la commande est déjà réglée', async () => {
    const commande = await creerCommandeEnRetard(40)
    const relance = await enregistrerRelanceClient(commande.id, { niveau: 3, canal: 'Téléphone', commentaire: 'Client injoignable', date: '2026-02-01' }, actor)
    expect(relance.niveau).toBe(3)

    const historique = await getRelancesClient(commande.id)
    expect(historique).toHaveLength(1)

    await enregistrerPaiementClient(commande.id, { montant: 10_000, methode: 'Espèces', date: '2026-02-05' })
    await expect(enregistrerRelanceClient(commande.id, { niveau: 1, canal: 'SMS', date: '2026-02-06' }, actor)).rejects.toThrow(/déjà réglée/i)
  })

  it('refuse un niveau ou un canal invalide', async () => {
    const commande = await creerCommandeEnRetard(10)
    await expect(enregistrerRelanceClient(commande.id, { niveau: 9 as 1 | 2 | 3, canal: 'Téléphone', date: '2026-02-01' }, actor)).rejects.toThrow(/niveau/i)
    await expect(enregistrerRelanceClient(commande.id, { niveau: 1, canal: '', date: '2026-02-01' }, actor)).rejects.toThrow(/canal/i)
  })
})

describe('getCreancesList — niveau de relance suggéré', () => {
  it('calcule le niveau automatiquement selon le retard, et expose la dernière relance enregistrée', async () => {
    const commandeNiveau3 = await creerCommandeEnRetard(45)
    const commandeNiveau1 = await creerCommandeEnRetard(5)
    await enregistrerRelanceClient(commandeNiveau3.id, { niveau: 2, canal: 'Visite', date: '2026-01-15' }, actor)

    const creances = await getCreancesList()
    const row3 = creances.find((c) => c.id === commandeNiveau3.id)
    const row1 = creances.find((c) => c.id === commandeNiveau1.id)

    expect(row3?.niveauRelanceSuggere).toBe(3)
    expect(row3?.derniereRelance?.niveau).toBe(2)
    expect(row1?.niveauRelanceSuggere).toBe(1)
  })
})

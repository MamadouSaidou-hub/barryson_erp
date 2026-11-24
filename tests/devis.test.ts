import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, clients, commandesClients, commandesClientsLignes, devis, devisLignes } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { createClient } from '../lib/db/mutations/clients'
import { accepterDevis, createDevis, refuserDevis, updateDevis } from '../lib/db/mutations/devis'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Devis' }

let clientId: number
let articleId: number
const devisIds: number[] = []
const commandeIds: number[] = []

beforeAll(async () => {
  const client = await createClient({ name: `Client Devis ${runId}` })
  clientId = client.id
  const article = await createArticle({ name: `Produit Fini Devis ${runId}`, level: 'produit_fini', unit: 'piece' })
  articleId = article.id
})

afterAll(async () => {
  if (devisIds.length > 0) {
    await db.delete(devisLignes).where(inArray(devisLignes.devisId, devisIds))
    await db.delete(devis).where(inArray(devis.id, devisIds))
  }
  if (commandeIds.length > 0) {
    await db.delete(commandesClientsLignes).where(inArray(commandesClientsLignes.commandeClientId, commandeIds))
    await db.delete(commandesClients).where(inArray(commandesClients.id, commandeIds))
  }
  await db.delete(articles).where(eq(articles.id, articleId))
  await db.delete(clients).where(eq(clients.id, clientId))
})

function ligne(quantite = 10, prixUnitaire = 1000) {
  return [{ articleId, nomAffiche: `Ligne ${runId}`, quantite, prixUnitaire }]
}

describe('createDevis', () => {
  it('crée un devis en brouillon avec un numéro DEV-AAAA-NNNNN', async () => {
    const d = await createDevis({ clientId, dateDevis: '2026-01-01', lignes: ligne() })
    devisIds.push(d.id)
    expect(d.etat).toBe('brouillon')
    expect(d.numero).toMatch(/^DEV-\d{4}-\d{5}$/)
  })
})

describe('updateDevis', () => {
  it('modifie les lignes tant que le devis est en brouillon', async () => {
    const d = await createDevis({ clientId, dateDevis: '2026-01-01', lignes: ligne(5) })
    devisIds.push(d.id)

    await updateDevis(d.id, { clientId, dateDevis: '2026-01-01', lignes: ligne(8) })
    const lignes = await db.select().from(devisLignes).where(eq(devisLignes.devisId, d.id))
    expect(lignes[0].quantite).toBe(8)
  })
})

describe('accepterDevis', () => {
  it('marque le devis accepté et crée la commande client avec les mêmes lignes', async () => {
    const d = await createDevis({ clientId, commercial: 'Mamadou', dateDevis: '2026-01-01', lignes: ligne(12, 5000) })
    devisIds.push(d.id)

    const { devis: updated, commande } = await accepterDevis(d.id, actor)
    commandeIds.push(commande.id)

    expect(updated.etat).toBe('accepte')
    expect(updated.commandeClientId).toBe(commande.id)
    expect(commande.etat).toBe('brouillon')

    const lignes = await db.select().from(commandesClientsLignes).where(eq(commandesClientsLignes.commandeClientId, commande.id))
    expect(lignes).toHaveLength(1)
    expect(lignes[0].quantite).toBe(12)
    expect(lignes[0].prixUnitaire).toBe(5000)
  })

  it('refuse d’accepter un devis déjà accepté', async () => {
    const d = await createDevis({ clientId, dateDevis: '2026-01-01', lignes: ligne() })
    devisIds.push(d.id)
    const { commande } = await accepterDevis(d.id, actor)
    commandeIds.push(commande.id)

    await expect(accepterDevis(d.id, actor)).rejects.toThrow(/déjà été accepté/i)
  })

  it('refuse un devis expiré', async () => {
    const d = await createDevis({ clientId, dateDevis: '2020-01-01', validiteJours: 30, lignes: ligne() })
    devisIds.push(d.id)
    await expect(accepterDevis(d.id, actor)).rejects.toThrow(/expiré/i)
  })
})

describe('refuserDevis', () => {
  it('marque le devis refusé, sans créer de commande', async () => {
    const d = await createDevis({ clientId, dateDevis: '2026-01-01', lignes: ligne() })
    devisIds.push(d.id)

    const refused = await refuserDevis(d.id, actor, 'Prix trop élevé pour le client')
    expect(refused.etat).toBe('refuse')

    await expect(updateDevis(d.id, { clientId, dateDevis: '2026-01-01', lignes: ligne() })).rejects.toThrow(/déjà été accepté ou refusé/i)
  })
})

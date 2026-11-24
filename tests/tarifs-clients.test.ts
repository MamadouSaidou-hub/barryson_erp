import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, clients, tarifsClients } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { createClient } from '../lib/db/mutations/clients'
import { removeTarifClient, setTarifClient } from '../lib/db/mutations/tarifs-clients'
import { getTarifClient, getTarifsClientList } from '../lib/db/queries/tarifs-clients'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`

let clientId: number
let produitFiniId: number
let matierePremiereId: number

beforeAll(async () => {
  const client = await createClient({ name: `Client Tarif ${runId}` })
  clientId = client.id
  const produitFini = await createArticle({ name: `Produit Fini Tarif ${runId}`, level: 'produit_fini', unit: 'piece' })
  produitFiniId = produitFini.id
  const matierePremiere = await createArticle({ name: `MP Tarif ${runId}`, level: 'matiere_premiere', unit: 'kg' })
  matierePremiereId = matierePremiere.id
})

afterAll(async () => {
  await db.delete(tarifsClients).where(eq(tarifsClients.clientId, clientId))
  await db.delete(clients).where(eq(clients.id, clientId))
  await db.delete(articles).where(eq(articles.id, produitFiniId))
  await db.delete(articles).where(eq(articles.id, matierePremiereId))
})

describe('setTarifClient', () => {
  it('crée puis met à jour (upsert) le prix courant pour un client et un article', async () => {
    await setTarifClient({ clientId, articleId: produitFiniId, prixUnitaire: 15000 })
    expect(await getTarifClient(clientId, produitFiniId)).toBe(15000)

    await setTarifClient({ clientId, articleId: produitFiniId, prixUnitaire: 18000.6 })
    expect(await getTarifClient(clientId, produitFiniId)).toBe(18001) // arrondi entier GNF
  })

  it("refuse un article qui n'est pas un produit fini", async () => {
    await expect(setTarifClient({ clientId, articleId: matierePremiereId, prixUnitaire: 1000 })).rejects.toThrow(/produit fini/i)
  })

  it('retourne null pour un tarif inexistant', async () => {
    const autreClient = await createClient({ name: `Client Tarif Vide ${runId}` })
    expect(await getTarifClient(autreClient.id, produitFiniId)).toBeNull()
    await db.delete(clients).where(eq(clients.id, autreClient.id))
  })
})

describe('removeTarifClient', () => {
  it('retire un tarif existant', async () => {
    await setTarifClient({ clientId, articleId: produitFiniId, prixUnitaire: 20000 })
    expect(await getTarifClient(clientId, produitFiniId)).toBe(20000)

    await removeTarifClient(clientId, produitFiniId)
    expect(await getTarifClient(clientId, produitFiniId)).toBeNull()
  })
})

describe('getTarifsClientList', () => {
  it('liste les tarifs avec le nom et l’unité de l’article', async () => {
    await setTarifClient({ clientId, articleId: produitFiniId, prixUnitaire: 25000 })
    const tarifs = await getTarifsClientList(clientId)
    expect(tarifs).toEqual([{ articleId: produitFiniId, articleName: `Produit Fini Tarif ${runId}`, articleUnit: 'piece', prixUnitaire: 25000 }])
  })
})

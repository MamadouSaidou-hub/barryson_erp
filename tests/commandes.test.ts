import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { articles, commandeLignes, commandes, fournisseurs } from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { createFournisseur } from '../lib/db/mutations/fournisseurs'
import { annulerCommande, createCommande, passerCommande, updateCommande } from '../lib/db/mutations/commandes'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Commandes' }

let fournisseurId: number
let articleId: number
const commandeIds: number[] = []

beforeAll(async () => {
  const fournisseur = await createFournisseur({ name: `Fournisseur Test ${runId}` })
  fournisseurId = fournisseur.id
  const article = await createArticle({ name: `Article Commande ${runId}`, level: 'semi_fini', unit: 'rouleau' })
  articleId = article.id
})

afterAll(async () => {
  if (commandeIds.length > 0) {
    await db.delete(commandeLignes).where(inArray(commandeLignes.commandeId, commandeIds))
    await db.delete(commandes).where(inArray(commandes.id, commandeIds))
  }
  await db.delete(articles).where(eq(articles.id, articleId))
  await db.delete(fournisseurs).where(eq(fournisseurs.id, fournisseurId))
})

function ligne(quantite = 10, prixUnitaire = 100) {
  return [{ articleId, nomAffiche: `Ligne ${runId}`, quantite, prixUnitaire }]
}

describe('createCommande', () => {
  it('crée une commande en brouillon avec un numéro BCA-AAAA-NNNNN', async () => {
    const commande = await createCommande({ fournisseurId, devise: 'USD', lignes: ligne() })
    commandeIds.push(commande.id)

    expect(commande.etat).toBe('brouillon')
    expect(commande.numero).toMatch(/^BCA-\d{4}-\d{5}$/)
  })

  it('refuse une commande sans ligne', async () => {
    await expect(createCommande({ fournisseurId, devise: 'USD', lignes: [] })).rejects.toThrow(/au moins une ligne/i)
  })
})

describe('updateCommande', () => {
  it('modifie les lignes tant que la commande est en brouillon', async () => {
    const commande = await createCommande({ fournisseurId, devise: 'USD', lignes: ligne(5) })
    commandeIds.push(commande.id)

    await updateCommande(commande.id, { fournisseurId, devise: 'USD', lignes: ligne(20) })

    const lignes = await db.select().from(commandeLignes).where(eq(commandeLignes.commandeId, commande.id))
    expect(lignes).toHaveLength(1)
    expect(lignes[0].quantite).toBe(20)
  })

  it('refuse de modifier une commande déjà passée au fournisseur', async () => {
    const commande = await createCommande({ fournisseurId, devise: 'USD', lignes: ligne() })
    commandeIds.push(commande.id)
    await passerCommande(commande.id, actor)

    await expect(updateCommande(commande.id, { fournisseurId, devise: 'USD', lignes: ligne(99) })).rejects.toThrow(/n'est plus modifiable/i)
  })
})

describe('passerCommande', () => {
  it('verrouille la commande (etat commandee) et refuse un second passage', async () => {
    const commande = await createCommande({ fournisseurId, devise: 'USD', lignes: ligne() })
    commandeIds.push(commande.id)

    const passed = await passerCommande(commande.id, actor)
    expect(passed.etat).toBe('commandee')

    await expect(passerCommande(commande.id, actor)).rejects.toThrow(/déjà été passée/i)
  })
})

describe('annulerCommande', () => {
  it('annule une commande en brouillon', async () => {
    const commande = await createCommande({ fournisseurId, devise: 'USD', lignes: ligne() })
    commandeIds.push(commande.id)

    const cancelled = await annulerCommande(commande.id, actor, 'Erreur de saisie')
    expect(cancelled.etat).toBe('annulee')
  })

  it('refuse d’annuler deux fois la même commande', async () => {
    const commande = await createCommande({ fournisseurId, devise: 'USD', lignes: ligne() })
    commandeIds.push(commande.id)
    await annulerCommande(commande.id, actor)

    await expect(annulerCommande(commande.id, actor)).rejects.toThrow(/déjà annulée/i)
  })
})

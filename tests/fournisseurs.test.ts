import { describe, it, expect, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { fournisseurs } from '../lib/db/schema'
import { createFournisseur, setFournisseurActive, updateFournisseur } from '../lib/db/mutations/fournisseurs'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const fournisseurIds: number[] = []

afterAll(async () => {
  if (fournisseurIds.length > 0) await db.delete(fournisseurs).where(inArray(fournisseurs.id, fournisseurIds))
})

describe('createFournisseur', () => {
  it('déduit un code unique à partir du nom', async () => {
    const fournisseur = await createFournisseur({ name: `Fournisseur Chine ${runId}`, country: 'Chine' })
    fournisseurIds.push(fournisseur.id)

    expect(fournisseur.code).toContain('FOURNISSEUR-CHINE')
    expect(fournisseur.country).toBe('Chine')
    expect(fournisseur.active).toBe(true)
  })
})

describe('updateFournisseur', () => {
  it('met à jour les coordonnées et refuse un identifiant inconnu', async () => {
    const fournisseur = await createFournisseur({ name: `Avant ${runId}` })
    fournisseurIds.push(fournisseur.id)

    const updated = await updateFournisseur(fournisseur.id, { name: `Après ${runId}`, phone: '+224600000000' })
    expect(updated.name).toBe(`Après ${runId}`)
    expect(updated.phone).toBe('+224600000000')

    await expect(updateFournisseur(-1, { name: 'x' })).rejects.toThrow(/introuvable/i)
  })
})

describe('setFournisseurActive', () => {
  it('désactive puis réactive sans supprimer la ligne', async () => {
    const fournisseur = await createFournisseur({ name: `Désactivable ${runId}` })
    fournisseurIds.push(fournisseur.id)

    const deactivated = await setFournisseurActive(fournisseur.id, false)
    expect(deactivated.active).toBe(false)

    const [stillThere] = await db.select().from(fournisseurs).where(eq(fournisseurs.id, fournisseur.id))
    expect(stillThere).toBeDefined()

    const reactivated = await setFournisseurActive(fournisseur.id, true)
    expect(reactivated.active).toBe(true)
  })
})

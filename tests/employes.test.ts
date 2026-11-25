import { describe, it, expect, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { employes } from '../lib/db/schema'
import { createEmploye, setEmployeActive, updateEmploye } from '../lib/db/mutations/employes'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const employeIds: number[] = []

afterAll(async () => {
  if (employeIds.length > 0) await db.delete(employes).where(inArray(employes.id, employeIds))
})

describe('createEmploye', () => {
  it('déduit un code unique à partir du nom', async () => {
    const employe = await createEmploye({ name: `Mamadou Diallo ${runId}`, poste: 'Opérateur machine' })
    employeIds.push(employe.id)

    expect(employe.code).toContain('MAMADOU-DIALLO')
    expect(employe.poste).toBe('Opérateur machine')
    expect(employe.active).toBe(true)
  })
})

describe('updateEmploye', () => {
  it('met à jour les informations et refuse un identifiant inconnu', async () => {
    const employe = await createEmploye({ name: `Avant ${runId}`, poste: 'Caissier' })
    employeIds.push(employe.id)

    const updated = await updateEmploye(employe.id, { name: `Après ${runId}`, poste: 'Chef d\'équipe', phone: '+224600000000' })
    expect(updated.name).toBe(`Après ${runId}`)
    expect(updated.poste).toBe("Chef d'équipe")
    expect(updated.phone).toBe('+224600000000')

    await expect(updateEmploye(-1, { name: 'x' })).rejects.toThrow(/introuvable/i)
  })
})

describe('setEmployeActive', () => {
  it('désactive puis réactive sans supprimer la ligne', async () => {
    const employe = await createEmploye({ name: `Désactivable ${runId}`, poste: 'Agent de sécurité' })
    employeIds.push(employe.id)

    const deactivated = await setEmployeActive(employe.id, false)
    expect(deactivated.active).toBe(false)

    const [stillThere] = await db.select().from(employes).where(eq(employes.id, employe.id))
    expect(stillThere).toBeDefined()

    const reactivated = await setEmployeActive(employe.id, true)
    expect(reactivated.active).toBe(true)
  })
})

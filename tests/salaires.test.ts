import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import { employes, paiementsSalaires, salairesEmployes } from '../lib/db/schema'
import { createEmploye } from '../lib/db/mutations/employes'
import { setSalaireBase, enregistrerPaiementSalaire } from '../lib/db/mutations/salaires'
import { getSalairesList, getPaiementsSalaire } from '../lib/db/queries/salaires'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`

const employeIds: number[] = []

afterAll(async () => {
  if (employeIds.length > 0) {
    await db.delete(paiementsSalaires).where(inArray(paiementsSalaires.employeId, employeIds))
    await db.delete(salairesEmployes).where(inArray(salairesEmployes.employeId, employeIds))
    await db.delete(employes).where(inArray(employes.id, employeIds))
  }
})

describe('setSalaireBase', () => {
  it('crée puis met à jour le salaire de base (upsert), et refuse une valeur non positive', async () => {
    const employe = await createEmploye({ name: `Employé Salaire ${runId}`, poste: 'Opérateur' })
    employeIds.push(employe.id)

    const salaire1 = await setSalaireBase(employe.id, 1_500_000)
    expect(salaire1.salaireBase).toBe(1_500_000)

    const salaire2 = await setSalaireBase(employe.id, 1_600_000)
    expect(salaire2.salaireBase).toBe(1_600_000)

    const rows = await db.select().from(salairesEmployes).where(eq(salairesEmployes.employeId, employe.id))
    expect(rows).toHaveLength(1)

    await expect(setSalaireBase(employe.id, 0)).rejects.toThrow(/positif/i)
    await expect(setSalaireBase(-1, 1_000_000)).rejects.toThrow(/introuvable/i)
  })
})

describe('enregistrerPaiementSalaire et getSalairesList', () => {
  it("expose le salaire de base et le total payé ce mois dans getSalairesList, et l'historique dans getPaiementsSalaire", async () => {
    const employe = await createEmploye({ name: `Employé Paiement ${runId}`, poste: 'Caissier' })
    employeIds.push(employe.id)
    await setSalaireBase(employe.id, 1_000_000)

    const periodeCourante = new Date().toISOString().slice(0, 7)
    await enregistrerPaiementSalaire(employe.id, { montant: 600_000, periode: periodeCourante, methode: 'Virement', date: `${periodeCourante}-05` })
    await enregistrerPaiementSalaire(employe.id, { montant: 400_000, periode: periodeCourante, methode: 'Espèces', date: `${periodeCourante}-20` })

    const liste = await getSalairesList()
    const row = liste.find((r) => r.employeId === employe.id)
    expect(row?.salaireBase).toBe(1_000_000)
    expect(row?.payeCeMois).toBe(1_000_000)

    const historique = await getPaiementsSalaire(employe.id)
    expect(historique).toHaveLength(2)

    await expect(enregistrerPaiementSalaire(employe.id, { montant: 0, periode: periodeCourante, methode: 'Virement', date: '2026-01-01' })).rejects.toThrow(/positif/i)
    await expect(enregistrerPaiementSalaire(employe.id, { montant: 100_000, periode: 'invalide', methode: 'Virement', date: '2026-01-01' })).rejects.toThrow(/période/i)
  })

  it('employé sans salaire configuré : salaireBase null, payeCeMois à 0', async () => {
    const employe = await createEmploye({ name: `Employé Sans Salaire ${runId}`, poste: 'Stagiaire' })
    employeIds.push(employe.id)

    const liste = await getSalairesList()
    const row = liste.find((r) => r.employeId === employe.id)
    expect(row?.salaireBase).toBeNull()
    expect(row?.payeCeMois).toBe(0)
  })
})

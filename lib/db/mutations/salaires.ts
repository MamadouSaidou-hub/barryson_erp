import { eq } from 'drizzle-orm'
import { db } from '../client'
import { employes, paiementsSalaires, salairesEmployes } from '../schema'
import { toGnf } from '@/lib/money'

export async function setSalaireBase(employeId: number, salaireBase: number) {
  if (salaireBase <= 0) throw new Error('Le salaire de base doit être strictement positif.')

  const [employe] = await db.select({ id: employes.id }).from(employes).where(eq(employes.id, employeId))
  if (!employe) throw new Error('Employé introuvable.')

  const [salaire] = await db
    .insert(salairesEmployes)
    .values({ employeId, salaireBase: toGnf(salaireBase) })
    .onConflictDoUpdate({
      target: salairesEmployes.employeId,
      set: { salaireBase: toGnf(salaireBase) },
    })
    .returning()
  return salaire
}

export async function enregistrerPaiementSalaire(employeId: number, input: { montant: number; periode: string; methode: string; date: string }) {
  if (input.montant <= 0) throw new Error('Le montant doit être strictement positif.')
  if (!/^\d{4}-\d{2}$/.test(input.periode)) throw new Error('La période doit être au format AAAA-MM.')

  const [employe] = await db.select({ id: employes.id }).from(employes).where(eq(employes.id, employeId))
  if (!employe) throw new Error('Employé introuvable.')

  const [paiement] = await db
    .insert(paiementsSalaires)
    .values({ employeId, montant: toGnf(input.montant), periode: input.periode, methode: input.methode, date: input.date })
    .returning()
  return paiement
}

import { asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { employes, paiementsSalaires, salairesEmployes } from '../schema'

function periodeCourante(): string {
  return new Date().toISOString().slice(0, 7)
}

// Jointure confidentielle (§3) : n'est jamais importée par une route gardée par `canAccess` —
// seulement par les routes de app/api/salaires/*, gardées par `hasSalaryAccess`. `salaireBase`
// est en left join (nullable) : un employé peut ne pas encore avoir de salaire configuré.
export async function getSalairesList() {
  const periode = periodeCourante()
  const rows = await db
    .select({
      employeId: employes.id,
      code: employes.code,
      name: employes.name,
      poste: employes.poste,
      active: employes.active,
      salaireBase: salairesEmployes.salaireBase,
      payeCeMois: sql<number>`coalesce((select sum(${paiementsSalaires.montant}) from ${paiementsSalaires} where ${paiementsSalaires.employeId} = ${employes.id} and ${paiementsSalaires.periode} = ${periode}), 0)::double precision`,
    })
    .from(employes)
    .leftJoin(salairesEmployes, eq(salairesEmployes.employeId, employes.id))
    .orderBy(asc(employes.name))

  return rows
}

export async function getPaiementsSalaire(employeId: number) {
  return db.select().from(paiementsSalaires).where(eq(paiementsSalaires.employeId, employeId)).orderBy(desc(paiementsSalaires.date))
}

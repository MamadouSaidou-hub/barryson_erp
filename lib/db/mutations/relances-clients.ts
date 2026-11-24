import { eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { commandesClients, commandesClientsLignes, paiementsClients, relancesClients } from '../schema'
import type { Actor } from './audit'

const NIVEAUX = [1, 2, 3] as const

export async function enregistrerRelanceClient(
  commandeClientId: number,
  input: { niveau: 1 | 2 | 3; canal: string; commentaire?: string; date: string },
  actor: Actor,
) {
  if (!NIVEAUX.includes(input.niveau)) throw new Error('Niveau de relance invalide.')
  if (!input.canal.trim()) throw new Error('Indiquez le canal utilisé (téléphone, SMS, email, visite...).')

  const [commande] = await db.select().from(commandesClients).where(eq(commandesClients.id, commandeClientId))
  if (!commande) throw new Error('Commande introuvable.')

  const [lignes, paiements] = await Promise.all([
    db.select({ quantite: commandesClientsLignes.quantite, prixUnitaire: commandesClientsLignes.prixUnitaire }).from(commandesClientsLignes).where(eq(commandesClientsLignes.commandeClientId, commandeClientId)),
    db.select({ montant: paiementsClients.montant }).from(paiementsClients).where(eq(paiementsClients.commandeClientId, commandeClientId)),
  ])
  const total = lignes.reduce((sum, ligne) => sum + ligne.quantite * ligne.prixUnitaire, 0)
  const totalPaye = paiements.reduce((sum, paiement) => sum + paiement.montant, 0)
  if (total - totalPaye <= 0) throw new Error('Cette commande est déjà réglée — aucune relance nécessaire.')

  const [relance] = await db
    .insert(relancesClients)
    .values({
      commandeClientId,
      niveau: input.niveau,
      canal: input.canal.trim(),
      commentaire: input.commentaire ?? null,
      date: input.date,
      auteurId: actor.userId,
      auteurName: actor.userName,
    })
    .returning()
  return relance
}

export async function getRelancesClient(commandeClientId: number) {
  return db.select().from(relancesClients).where(eq(relancesClients.commandeClientId, commandeClientId)).orderBy(relancesClients.date)
}

export async function getDernieresRelancesParCommande(commandeClientIds: number[]) {
  if (commandeClientIds.length === 0) return new Map<number, { date: string; niveau: number }>()
  const rows = await db
    .select({ commandeClientId: relancesClients.commandeClientId, date: relancesClients.date, niveau: relancesClients.niveau })
    .from(relancesClients)
    .where(inArray(relancesClients.commandeClientId, commandeClientIds))

  const latest = new Map<number, { date: string; niveau: number }>()
  for (const row of rows) {
    const current = latest.get(row.commandeClientId)
    if (!current || row.date > current.date) latest.set(row.commandeClientId, { date: row.date, niveau: row.niveau })
  }
  return latest
}

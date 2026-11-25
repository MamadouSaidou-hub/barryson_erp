import { desc, eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { articles, clients, commandesClients, commandesClientsLignes, livraisonsClientsLignes, paiementsClients } from '../schema'
import { calculerEncoursClient } from '../mutations/ventes'
import { getDernieresRelancesParCommande } from '../mutations/relances-clients'
import { getClientsList } from './clients'

function addDaysToDateString(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function joursEntre(date: string, today: string): number {
  const diffMs = new Date(`${today}T00:00:00Z`).getTime() - new Date(`${date}T00:00:00Z`).getTime()
  return Math.max(0, Math.floor(diffMs / 86_400_000))
}

// Pas d'envoi réel (aucune intégration SMS/email) — seul le niveau d'urgence est calculé
// automatiquement ici ; le commercial contacte le client lui-même puis enregistre la relance
// faite (`enregistrerRelanceClient`). Même esprit que `DOCTOR_REWINDER_ALERTE_JOURS`.
const NIVEAU_RELANCE_SEUILS = [15, 30] as const

// Seuil d'alerte proactive (§ directeur commercial) : un client atteignant ce pourcentage de son
// plafond d'encours est "à surveiller" avant le blocage sec à 100 % déjà appliqué par
// `confirmerCommandeClient` (lib/db/mutations/ventes.ts).
const PLAFOND_ALERTE_SEUIL = 0.8

function niveauRelanceSuggere(joursRetard: number): 1 | 2 | 3 {
  if (joursRetard < NIVEAU_RELANCE_SEUILS[0]) return 1
  if (joursRetard < NIVEAU_RELANCE_SEUILS[1]) return 2
  return 3
}

export async function getCommandesClientsList() {
  const rows = await db
    .select({
      id: commandesClients.id,
      numero: commandesClients.numero,
      clientId: commandesClients.clientId,
      clientName: clients.name,
      delaiPaiementJours: clients.delaiPaiementJours,
      commercial: commandesClients.commercial,
      dateCommande: commandesClients.dateCommande,
      etat: commandesClients.etat,
      // `::double precision` : une somme SQL sur une colonne `bigint` (prix/montant GNF) est
      // renvoyée par pg comme une chaîne ; le cast garantit un `number` JS exploitable directement.
      total: sql<number>`coalesce(sum(${commandesClientsLignes.quantite} * ${commandesClientsLignes.prixUnitaire}), 0)::double precision`,
      totalPaye: sql<number>`coalesce((select sum(${paiementsClients.montant}) from ${paiementsClients} where ${paiementsClients.commandeClientId} = ${commandesClients.id}), 0)::double precision`,
    })
    .from(commandesClients)
    .innerJoin(clients, eq(commandesClients.clientId, clients.id))
    .leftJoin(commandesClientsLignes, eq(commandesClientsLignes.commandeClientId, commandesClients.id))
    .groupBy(commandesClients.id, commandesClients.clientId, clients.name, clients.delaiPaiementJours)
    .orderBy(desc(commandesClients.createdAt))

  const today = new Date().toISOString().slice(0, 10)

  return rows.map((row) => {
    const solde = row.total - row.totalPaye
    const echeance = row.delaiPaiementJours !== null ? addDaysToDateString(row.dateCommande, row.delaiPaiementJours) : null
    const enRetard = echeance !== null && echeance < today && solde > 0
    return { ...row, solde, echeance, enRetard }
  })
}

export async function getCreancesList() {
  const rows = await getCommandesClientsList()
  const creances = rows.filter((row) => row.solde > 0 && row.etat !== 'annulee' && row.etat !== 'brouillon')

  const today = new Date().toISOString().slice(0, 10)
  const dernieresRelances = await getDernieresRelancesParCommande(creances.map((c) => c.id))

  return creances
    .map((row) => {
      const joursRetard = row.enRetard && row.echeance ? joursEntre(row.echeance, today) : 0
      return {
        ...row,
        joursRetard,
        niveauRelanceSuggere: row.enRetard ? niveauRelanceSuggere(joursRetard) : null,
        derniereRelance: dernieresRelances.get(row.id) ?? null,
      }
    })
    .sort((a, b) => {
      if (a.enRetard !== b.enRetard) return a.enRetard ? -1 : 1
      if (a.echeance && b.echeance) return a.echeance < b.echeance ? -1 : 1
      return 0
    })
}

// Agrégat trésorerie (§ comptable) : montants GNF exacts, somme directe des totalPaye/solde déjà
// calculés par ligne dans getCommandesClientsList — jamais mélangés avec les montants d'achat en
// devise étrangère (cf. commentaire sur `gnf` dans schema.ts).
export async function getTresorerieVentes() {
  const rows = await getCommandesClientsList()
  const retenues = rows.filter((row) => row.etat !== 'brouillon' && row.etat !== 'annulee')

  const totalEncaisse = retenues.reduce((sum, row) => sum + row.totalPaye, 0)
  const totalACaisser = retenues.filter((row) => row.solde > 0).reduce((sum, row) => sum + row.solde, 0)

  return { totalEncaisse, totalACaisser }
}

// Performance + encours par client (§ directeur commercial) : CA cumulé, panier moyen, dernière
// commande, et pourcentage du plafond d'encours déjà engagé — pour prioriser les relances
// commerciales, par opposition aux Créances/Relances qui ne regardent que les retards de
// paiement. `encours` reprend exactement la définition de `calculerEncoursClient`
// (lib/db/mutations/ventes.ts) — somme des soldes des commandes engagées (confirmee,
// partiellement_livree, livree) — mais en regroupant les lignes déjà calculées par
// getCommandesClientsList() plutôt qu'en rappelant cette fonction par client (évite un N+1).
export async function getPerformanceClients() {
  const [commandes, clientsRows] = await Promise.all([getCommandesClientsList(), getClientsList()])

  const parClient = new Map<number, typeof commandes>()
  for (const commande of commandes) {
    const liste = parClient.get(commande.clientId) ?? []
    liste.push(commande)
    parClient.set(commande.clientId, liste)
  }

  const performances = clientsRows.map((client) => {
    const commandesClient = parClient.get(client.id) ?? []
    const retenues = commandesClient.filter((c) => c.etat !== 'brouillon' && c.etat !== 'annulee')
    const caCumule = retenues.reduce((sum, c) => sum + c.total, 0)
    const nombreCommandes = retenues.length
    const panierMoyen = nombreCommandes > 0 ? caCumule / nombreCommandes : 0
    const derniereCommande = retenues.reduce<string | null>((max, c) => (max === null || c.dateCommande > max ? c.dateCommande : max), null)

    const engagees = commandesClient.filter((c) => c.etat === 'confirmee' || c.etat === 'partiellement_livree' || c.etat === 'livree')
    const encours = engagees.reduce((sum, c) => sum + c.solde, 0)
    const pctPlafond = client.plafondEncours ? encours / client.plafondEncours : null

    return {
      clientId: client.id,
      clientName: client.name,
      caCumule,
      nombreCommandes,
      panierMoyen,
      derniereCommande,
      encours,
      plafondEncours: client.plafondEncours,
      pctPlafond,
      procheDuPlafond: pctPlafond !== null && pctPlafond >= PLAFOND_ALERTE_SEUIL,
    }
  })

  return performances.sort((a, b) => b.caCumule - a.caCumule)
}

export async function getCommandeClientDetail(id: number) {
  const [commande] = await db
    .select({
      id: commandesClients.id,
      numero: commandesClients.numero,
      clientId: commandesClients.clientId,
      clientName: clients.name,
      commercial: commandesClients.commercial,
      dateCommande: commandesClients.dateCommande,
      reference: commandesClients.reference,
      commentaire: commandesClients.commentaire,
      etat: commandesClients.etat,
    })
    .from(commandesClients)
    .innerJoin(clients, eq(commandesClients.clientId, clients.id))
    .where(eq(commandesClients.id, id))
  if (!commande) return null

  const lignes = await db
    .select({
      id: commandesClientsLignes.id,
      articleId: commandesClientsLignes.articleId,
      articleUnit: articles.unit,
      nomAffiche: commandesClientsLignes.nomAffiche,
      quantite: commandesClientsLignes.quantite,
      prixUnitaire: commandesClientsLignes.prixUnitaire,
      quantiteLivree: sql<number>`coalesce((select sum(${livraisonsClientsLignes.quantiteLivree}) from ${livraisonsClientsLignes} where ${livraisonsClientsLignes.commandeClientLigneId} = ${commandesClientsLignes.id}), 0)`,
    })
    .from(commandesClientsLignes)
    .innerJoin(articles, eq(commandesClientsLignes.articleId, articles.id))
    .where(eq(commandesClientsLignes.commandeClientId, id))

  return { ...commande, lignes }
}

export async function getEncoursClient(clientId: number) {
  return calculerEncoursClient(db, clientId)
}

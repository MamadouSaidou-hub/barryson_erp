import { eq, inArray } from 'drizzle-orm'
import { db } from '../client'
import { articles, commandesClients, commandesClientsLignes, livraisonsClientsLignes, stockNiveaux } from '../schema'

export type BesoinFabrication = { articleId: number; articleName: string; unit: string; demandeRestante: number; stockDisponible: number; manque: number }

/** §10 : "une commande non satisfaite peut générer un besoin de fabrication visible du chef de
 * production" — entièrement dérivé, jamais stocké (même principe que les résultats de
 * fabrication). Deux requêtes simples + réduction JS plutôt qu'une sous-requête corrélée dans un
 * `sum()` : cette forme s'est révélée peu fiable avec Drizzle (cf. le bug historique de
 * `calculerEncoursClient`). N'expose volontairement ni client, ni prix, ni numéro de commande —
 * seulement l'article et la quantité manquante, car le chef de production n'a pas accès au
 * module Ventes. */
export async function getBesoinsFabricationList(): Promise<BesoinFabrication[]> {
  const lignes = await db
    .select({ ligneId: commandesClientsLignes.id, articleId: commandesClientsLignes.articleId, quantite: commandesClientsLignes.quantite })
    .from(commandesClientsLignes)
    .innerJoin(commandesClients, eq(commandesClientsLignes.commandeClientId, commandesClients.id))
    .where(inArray(commandesClients.etat, ['confirmee', 'partiellement_livree']))

  if (lignes.length === 0) return []

  const ligneIds = lignes.map((l) => l.ligneId)
  const livrees = await db
    .select({ commandeClientLigneId: livraisonsClientsLignes.commandeClientLigneId, quantiteLivree: livraisonsClientsLignes.quantiteLivree })
    .from(livraisonsClientsLignes)
    .where(inArray(livraisonsClientsLignes.commandeClientLigneId, ligneIds))

  const livreParLigne = new Map<number, number>()
  for (const l of livrees) {
    livreParLigne.set(l.commandeClientLigneId, (livreParLigne.get(l.commandeClientLigneId) ?? 0) + l.quantiteLivree)
  }

  const demandeParArticle = new Map<number, number>()
  for (const ligne of lignes) {
    const reste = Math.max(0, ligne.quantite - (livreParLigne.get(ligne.ligneId) ?? 0))
    demandeParArticle.set(ligne.articleId, (demandeParArticle.get(ligne.articleId) ?? 0) + reste)
  }

  const articleIds = [...demandeParArticle.keys()]
  const [articlesRows, stockRows] = await Promise.all([
    db.select({ id: articles.id, name: articles.name, unit: articles.unit }).from(articles).where(inArray(articles.id, articleIds)),
    db.select({ articleId: stockNiveaux.articleId, quantite: stockNiveaux.quantite }).from(stockNiveaux).where(inArray(stockNiveaux.articleId, articleIds)),
  ])
  const stockParArticle = new Map(stockRows.map((s) => [s.articleId, s.quantite]))

  const besoins: BesoinFabrication[] = []
  for (const article of articlesRows) {
    const demandeRestante = demandeParArticle.get(article.id) ?? 0
    const stockDisponible = stockParArticle.get(article.id) ?? 0
    const manque = demandeRestante - stockDisponible
    if (manque > 0) besoins.push({ articleId: article.id, articleName: article.name, unit: article.unit, demandeRestante, stockDisponible, manque })
  }
  return besoins
}

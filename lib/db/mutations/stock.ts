import { eq, sql } from 'drizzle-orm'
import { db } from '../client'
import { articles, stockMouvements, stockNiveaux, type StockMouvementType } from '../schema'
import type { Actor } from './audit'

type Executor = Pick<typeof db, 'select' | 'insert' | 'update' | 'transaction'>

// Source UNIQUE du signe de chaque type de mouvement sur le solde de stock : +1 = entrée,
// −1 = sortie, 0 = sans effet sur le solde. Utilisée à la fois pour APPLIQUER un mouvement
// (`insertStockMouvement`) et pour RECALCULER le solde depuis la vérité (`reconcileStockLevels`) —
// ces deux chemins partageant la même table, le cache `stockNiveaux` ne peut pas diverger des
// `stockMouvements` par construction. Toute ambiguïté future (ajustement/inventaire +/−) devra se
// modéliser avec une direction explicite avant d'être utilisée en production.
const MOVEMENT_SIGN: Record<StockMouvementType, 1 | -1 | 0> = {
  reception: 1,
  entree_manuelle: 1,
  entree_directe: 1,
  transformation: 1,
  sortie_manuelle: -1,
  sortie_exceptionnelle: -1,
  consommation: -1,
  vente: -1,
  rebut: 0, // pertes définitives — traçabilité seule, les pièces n'ont jamais été en stock
  ajustement: 1, // non implémenté : à modéliser avec une direction explicite avant usage
  inventaire: 1, // idem
}

export function movementSignedDelta(type: StockMouvementType, quantite: number): number {
  return MOVEMENT_SIGN[type] * quantite
}

/** §11 : un stock n'est jamais modifié directement — toujours via un mouvement, et le cache
 * `stockNiveaux` est recalculé dans la même transaction que ce mouvement.
 *
 * `GREATEST(delta, 0)` dans la ligne candidate de l'INSERT : Postgres valide les contraintes
 * CHECK de la ligne candidate d'un `INSERT ... ON CONFLICT DO UPDATE` *avant* de détecter le
 * conflit — donc même quand une ligne existante va réellement être mise à jour (jamais insérée
 * négative), un `delta` négatif sur la toute première écriture ferait échouer
 * `stock_niveaux_quantite_check` sur la ligne candidate elle-même. Le garde-fou applicatif dans
 * `insertStockMouvement` garantit déjà qu'un `delta` négatif n'arrive ici que lorsqu'une ligne
 * existante avec un solde suffisant est présente (donc la branche `DO UPDATE`, pas `INSERT`, sera
 * réellement appliquée) — le clamp ne change donc jamais le résultat réel, il évite seulement que
 * Postgres rejette la ligne candidate hypothétique. */
async function adjustStockLevel(tx: Executor, articleId: number, delta: number) {
  await tx
    .insert(stockNiveaux)
    .values({ articleId, quantite: sql`greatest(${delta}::double precision, 0)` })
    .onConflictDoUpdate({
      target: stockNiveaux.articleId,
      set: { quantite: sql`${stockNiveaux.quantite} + ${delta}` },
    })
}

export async function getCurrentStock(executor: Executor, articleId: number): Promise<number> {
  const [row] = await executor.select({ quantite: stockNiveaux.quantite }).from(stockNiveaux).where(eq(stockNiveaux.articleId, articleId))
  return row?.quantite ?? 0
}

/** Mouvement interne (réception) — n'est jamais appelé par une route exposant un choix de
 * `type` arbitraire au client ; les réceptions passent toujours `type: 'reception'`. */
export async function insertStockMouvement(
  tx: Executor,
  input: { articleId: number; type: StockMouvementType; quantite: number; motif?: string | null; actor: Actor; receptionLigneId?: number; date?: string },
) {
  if (input.quantite <= 0) throw new Error('La quantité doit être strictement positive.')

  // Une sortie (signe −1) ne peut pas dépasser le stock disponible.
  if (MOVEMENT_SIGN[input.type] < 0) {
    const current = await getCurrentStock(tx, input.articleId)
    if (input.quantite > current) {
      throw new Error(`Stock insuffisant : il reste ${current} en stock.`)
    }
  }

  const [mouvement] = await tx
    .insert(stockMouvements)
    .values({
      articleId: input.articleId,
      type: input.type,
      quantite: input.quantite,
      motif: input.motif ?? null,
      auteurId: input.actor.userId,
      auteurName: input.actor.userName,
      receptionLigneId: input.receptionLigneId ?? null,
      date: input.date ?? new Date().toISOString(),
    })
    .returning()

  const delta = movementSignedDelta(input.type, input.quantite)
  if (delta !== 0) await adjustStockLevel(tx, input.articleId, delta)

  return mouvement
}

/** Les deux seuls mouvements que l'écran Stock (§5.4) expose directement : "+ Entrée" / "− Sortie". */
export async function recordManualStockMovement(input: { articleId: number; direction: 'entree' | 'sortie'; quantite: number; motif?: string }, actor: Actor) {
  const [article] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, input.articleId))
  if (!article) throw new Error('Article introuvable.')

  return db.transaction(async (tx) => {
    return insertStockMouvement(tx, {
      articleId: input.articleId,
      type: input.direction === 'entree' ? 'entree_manuelle' : 'sortie_manuelle',
      quantite: input.quantite,
      motif: input.motif,
      actor,
    })
  })
}

export type StockEcart = { articleId: number; cache: number; reel: number }

/** Filet de sécurité d'intégrité : recalcule le solde RÉEL de chaque article directement depuis
 * la vérité (`stockMouvements`, via `movementSignedDelta` — le même signe par type que lors de
 * l'application), le compare au cache (`stockNiveaux`), et retourne les écarts. Si `fix` est vrai,
 * corrige le cache dans une transaction. Sous un flux normal le résultat doit toujours être vide
 * (invariant prouvé par les tests) ; cette fonction sert de garde-fou et d'outil ops. Un
 * `articleId` optionnel limite le contrôle à un seul article (utilisé par les tests pour éviter
 * toute interférence entre fichiers de test parallèles). */
export async function reconcileStockLevels({ fix = false, articleId }: { fix?: boolean; articleId?: number } = {}) {
  const mouvementsQuery = db.select({ articleId: stockMouvements.articleId, type: stockMouvements.type, quantite: stockMouvements.quantite }).from(stockMouvements)
  const mouvements = articleId ? await mouvementsQuery.where(eq(stockMouvements.articleId, articleId)) : await mouvementsQuery

  const reel = new Map<number, number>()
  for (const m of mouvements) {
    reel.set(m.articleId, (reel.get(m.articleId) ?? 0) + movementSignedDelta(m.type, m.quantite))
  }

  const niveauxQuery = db.select({ articleId: stockNiveaux.articleId, quantite: stockNiveaux.quantite }).from(stockNiveaux)
  const niveaux = articleId ? await niveauxQuery.where(eq(stockNiveaux.articleId, articleId)) : await niveauxQuery
  const cache = new Map(niveaux.map((n) => [n.articleId, n.quantite]))

  const articleIds = new Set<number>([...reel.keys(), ...cache.keys()])
  const ecarts: StockEcart[] = []
  for (const id of articleIds) {
    const vrai = reel.get(id) ?? 0
    const cached = cache.get(id) ?? 0
    // Tolérance pour les quantités fractionnaires (kg, m) et l'arithmétique flottante.
    if (Math.abs(vrai - cached) > 1e-6) ecarts.push({ articleId: id, cache: cached, reel: vrai })
  }

  if (fix && ecarts.length > 0) {
    await db.transaction(async (tx) => {
      for (const e of ecarts) {
        await tx
          .insert(stockNiveaux)
          .values({ articleId: e.articleId, quantite: e.reel })
          .onConflictDoUpdate({ target: stockNiveaux.articleId, set: { quantite: e.reel } })
      }
    })
  }

  return { ecarts, corrige: fix }
}

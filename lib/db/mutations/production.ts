import { eq } from 'drizzle-orm'
import { db } from '../client'
import { doctorRewinderDossiers, fabrications, modelesRuban, type ModeleRubanFamille } from '../schema'
import { finalNumero, placeholderNumero } from '../numero'
import { insertStockMouvement } from './stock'
import type { Actor } from './audit'

// ---------------------------------------------------------------------------
// Modèles de ruban — simplement modifiables (§12 : "Production en version simple d'emblée"),
// même anatomie que lib/db/mutations/articles.ts.
// ---------------------------------------------------------------------------

export async function createModeleRuban(input: {
  name: string
  famille: ModeleRubanFamille
  largeurMm: number
  longueurRouleauM: number
  piecesParTour: number
  piecesParCarton: number
  piecesParPaquet?: number
  plastiqueKgParPaquet?: number
  finish?: string
  moule?: string
  bobineArticleId: number
  tubeArticleId: number
  cartonArticleId: number
  plastiqueArticleId?: number
  produitFiniArticleId: number
}) {
  const [modele] = await db
    .insert(modelesRuban)
    .values({
      name: input.name,
      famille: input.famille,
      largeurMm: input.largeurMm,
      longueurRouleauM: input.longueurRouleauM,
      piecesParTour: input.piecesParTour,
      piecesParCarton: input.piecesParCarton,
      piecesParPaquet: input.piecesParPaquet ?? null,
      plastiqueKgParPaquet: input.plastiqueKgParPaquet ?? null,
      finish: input.finish ?? null,
      moule: input.moule ?? null,
      bobineArticleId: input.bobineArticleId,
      tubeArticleId: input.tubeArticleId,
      cartonArticleId: input.cartonArticleId,
      plastiqueArticleId: input.plastiqueArticleId ?? null,
      produitFiniArticleId: input.produitFiniArticleId,
    })
    .returning()
  return modele
}

export async function updateModeleRuban(
  id: number,
  input: {
    name?: string
    largeurMm?: number
    longueurRouleauM?: number
    piecesParTour?: number
    piecesParCarton?: number
    piecesParPaquet?: number | null
    plastiqueKgParPaquet?: number | null
    plastiqueArticleId?: number | null
    finish?: string | null
    moule?: string | null
  },
) {
  const [modele] = await db.update(modelesRuban).set(input).where(eq(modelesRuban.id, id)).returning()
  if (!modele) throw new Error('Modèle de ruban introuvable.')
  return modele
}

export async function setModeleRubanActive(id: number, active: boolean) {
  const [modele] = await db.update(modelesRuban).set({ active }).where(eq(modelesRuban.id, id)).returning()
  if (!modele) throw new Error('Modèle de ruban introuvable.')
  return modele
}

// ---------------------------------------------------------------------------
// Fabrications (§5.5, §8)
// ---------------------------------------------------------------------------

export function calculerPrevision(input: { metrageEngage: number; longueurRouleauM: number; piecesParTour: number; piecesParCarton: number }) {
  const toursComplets = Math.floor(input.metrageEngage / input.longueurRouleauM)
  const piecesTheoriques = toursComplets * input.piecesParTour
  const cartonsPrevision = Math.floor(piecesTheoriques / input.piecesParCarton)
  const piecesRestantesPrevision = piecesTheoriques - cartonsPrevision * input.piecesParCarton
  return { toursComplets, piecesTheoriques, cartonsPrevision, piecesRestantesPrevision }
}

export function calculerResultat(input: {
  toursTotal: number
  toursDefectueux: number
  piecesDefectueusesSupp: number
  piecesDoctorRewinder: number
  piecesPerdues: number
  piecesParTour: number
  piecesParCarton: number
  piecesTheoriques: number
  // Étape de groupage (§ réel usine) : paquets de pièces filmés au plastique rétractable avant
  // mise en carton. Nullable — tant que l'usine n'a pas renseigné ces deux réglages sur le
  // modèle, aucune consommation de plastique n'est calculée (pas de valeur inventée).
  piecesParPaquet?: number | null
  plastiqueKgParPaquet?: number | null
}) {
  const piecesBrutes = input.toursTotal * input.piecesParTour
  const piecesNonConformes = input.toursDefectueux * input.piecesParTour + input.piecesDefectueusesSupp

  // Contrôle bloquant (§8) : un double comptage ou une omission se détecte immédiatement, avant
  // toute écriture en base, plutôt que de laisser un résultat incohérent entrer en stock.
  if (piecesNonConformes !== input.piecesDoctorRewinder + input.piecesPerdues) {
    throw new Error(
      `Écart de comptage : ${piecesNonConformes} pièce(s) non conforme(s) attendue(s) (tours défectueux + pièces défectueuses en plus), ` +
        `mais ${input.piecesDoctorRewinder} envoyée(s) au Doctor Rewinder + ${input.piecesPerdues} perdue(s) = ${input.piecesDoctorRewinder + input.piecesPerdues}. ` +
        `Vérifiez les quatre nombres (double comptage ou omission).`,
    )
  }

  const piecesConformes = piecesBrutes - piecesNonConformes
  const cartonsReel = Math.floor(piecesConformes / input.piecesParCarton)
  const ecart = piecesConformes - input.piecesTheoriques
  const rendement = input.piecesTheoriques > 0 ? piecesConformes / input.piecesTheoriques : 0

  // Seules les pièces conformes sont groupées et filmées (celles envoyées au Doctor Rewinder ou
  // perdues ne sont jamais emballées). `ceil` : un paquet entamé consomme quand même son film.
  const paquetsReel = input.piecesParPaquet ? Math.ceil(piecesConformes / input.piecesParPaquet) : 0
  const plastiqueKgConsomme = input.plastiqueKgParPaquet ? paquetsReel * input.plastiqueKgParPaquet : 0

  return { piecesBrutes, piecesNonConformes, piecesConformes, cartonsReel, ecart, rendement, paquetsReel, plastiqueKgConsomme }
}

export async function createFabrication(input: { modeleRubanId: number; metrageEngage: number; dateDebut: string }, actor: Actor) {
  if (input.metrageEngage <= 0) throw new Error('Le métrage engagé doit être strictement positif.')

  return db.transaction(async (tx) => {
    const [modele] = await tx.select().from(modelesRuban).where(eq(modelesRuban.id, input.modeleRubanId))
    if (!modele) throw new Error('Modèle de ruban introuvable.')

    // Consomme 1 rouleau de la bobine choisie dès l'ouverture de la fabrication — c'est le moment
    // où la bobine physique est réellement engagée sur la rembobineuse.
    await insertStockMouvement(tx, {
      articleId: modele.bobineArticleId,
      type: 'sortie_manuelle',
      quantite: 1,
      motif: 'Engagée en fabrication',
      actor,
    })

    const [fabrication] = await tx
      .insert(fabrications)
      .values({
        numero: placeholderNumero(),
        modeleRubanId: input.modeleRubanId,
        metrageEngage: input.metrageEngage,
        dateDebut: input.dateDebut,
        etat: 'ouverte',
      })
      .returning()

    fabrication.numero = finalNumero('FAB', fabrication.id)
    await tx.update(fabrications).set({ numero: fabrication.numero }).where(eq(fabrications.id, fabrication.id))

    return fabrication
  })
}

export async function annulerFabrication(id: number, actor: Actor, reason?: string) {
  return db.transaction(async (tx) => {
    const [fabrication] = await tx.select().from(fabrications).where(eq(fabrications.id, id)).for('update')
    if (!fabrication) throw new Error('Fabrication introuvable.')
    if (fabrication.etat !== 'ouverte') throw new Error('Seule une fabrication ouverte peut être annulée.')

    const [modele] = await tx.select().from(modelesRuban).where(eq(modelesRuban.id, fabrication.modeleRubanId))
    if (!modele) throw new Error('Modèle de ruban introuvable.')

    // Restitue le rouleau de bobine consommé à l'ouverture — jamais d'édition du mouvement
    // d'origine, toujours un mouvement compensatoire qui garde la trace des deux événements.
    await insertStockMouvement(tx, {
      articleId: modele.bobineArticleId,
      type: 'entree_manuelle',
      quantite: 1,
      motif: reason ?? 'Fabrication annulée',
      actor,
    })

    const [updated] = await tx.update(fabrications).set({ etat: 'annulee' }).where(eq(fabrications.id, id)).returning()
    return updated
  })
}

export async function enregistrerResultatFabrication(
  id: number,
  input: { toursTotal: number; toursDefectueux: number; piecesDefectueusesSupp: number; piecesDoctorRewinder: number; piecesPerdues: number; dateResultat: string },
  actor: Actor,
) {
  return db.transaction(async (tx) => {
    const [fabrication] = await tx.select().from(fabrications).where(eq(fabrications.id, id)).for('update')
    if (!fabrication) throw new Error('Fabrication introuvable.')
    if (fabrication.etat !== 'ouverte') throw new Error('Le résultat de cette fabrication a déjà été saisi.')

    const [modele] = await tx.select().from(modelesRuban).where(eq(modelesRuban.id, fabrication.modeleRubanId))
    if (!modele) throw new Error('Modèle de ruban introuvable.')

    const { piecesTheoriques } = calculerPrevision({
      metrageEngage: fabrication.metrageEngage,
      longueurRouleauM: modele.longueurRouleauM,
      piecesParTour: modele.piecesParTour,
      piecesParCarton: modele.piecesParCarton,
    })

    // Lève avant toute écriture si le compte n'y est pas (contrôle bloquant §8).
    const { piecesBrutes, piecesConformes, cartonsReel, plastiqueKgConsomme } = calculerResultat({
      toursTotal: input.toursTotal,
      toursDefectueux: input.toursDefectueux,
      piecesDefectueusesSupp: input.piecesDefectueusesSupp,
      piecesDoctorRewinder: input.piecesDoctorRewinder,
      piecesPerdues: input.piecesPerdues,
      piecesParTour: modele.piecesParTour,
      piecesParCarton: modele.piecesParCarton,
      piecesTheoriques,
      piecesParPaquet: modele.piecesParPaquet,
      plastiqueKgParPaquet: modele.plastiqueKgParPaquet,
    })

    await insertStockMouvement(tx, {
      articleId: modele.tubeArticleId,
      type: 'consommation',
      quantite: piecesBrutes,
      motif: `Fabrication ${fabrication.numero}`,
      actor,
      date: input.dateResultat,
    })

    if (cartonsReel > 0) {
      await insertStockMouvement(tx, {
        articleId: modele.cartonArticleId,
        type: 'consommation',
        quantite: cartonsReel,
        motif: `Fabrication ${fabrication.numero}`,
        actor,
        date: input.dateResultat,
      })
    }

    if (plastiqueKgConsomme > 0 && modele.plastiqueArticleId) {
      await insertStockMouvement(tx, {
        articleId: modele.plastiqueArticleId,
        type: 'consommation',
        quantite: plastiqueKgConsomme,
        motif: `Fabrication ${fabrication.numero}`,
        actor,
        date: input.dateResultat,
      })
    }

    if (piecesConformes > 0) {
      await insertStockMouvement(tx, {
        articleId: modele.produitFiniArticleId,
        type: 'transformation',
        quantite: piecesConformes,
        motif: `Fabrication ${fabrication.numero}`,
        actor,
        date: input.dateResultat,
      })
    }

    if (input.piecesDoctorRewinder > 0) {
      await tx.insert(doctorRewinderDossiers).values({
        fabricationId: id,
        quantiteEnvoyee: input.piecesDoctorRewinder,
        dateEnvoi: input.dateResultat,
        statut: 'en_cours',
      })
    }

    const [updated] = await tx
      .update(fabrications)
      .set({
        etat: 'terminee',
        toursTotal: input.toursTotal,
        toursDefectueux: input.toursDefectueux,
        piecesDefectueusesSupp: input.piecesDefectueusesSupp,
        piecesDoctorRewinder: input.piecesDoctorRewinder,
        piecesPerdues: input.piecesPerdues,
        dateResultat: input.dateResultat,
      })
      .where(eq(fabrications.id, id))
      .returning()

    return updated
  })
}

// ---------------------------------------------------------------------------
// Doctor Rewinder (§5.6)
// ---------------------------------------------------------------------------

export async function enregistrerRetourDoctorRewinder(dossierId: number, input: { quantiteRecuperee: number; quantitePerdue: number }, actor: Actor) {
  if (input.quantiteRecuperee < 0 || input.quantitePerdue < 0) throw new Error('Les quantités ne peuvent pas être négatives.')

  return db.transaction(async (tx) => {
    const [dossier] = await tx.select().from(doctorRewinderDossiers).where(eq(doctorRewinderDossiers.id, dossierId)).for('update')
    if (!dossier) throw new Error('Dossier Doctor Rewinder introuvable.')
    if (dossier.statut !== 'en_cours') throw new Error('Ce dossier a déjà été clôturé.')

    if (input.quantiteRecuperee + input.quantitePerdue !== dossier.quantiteEnvoyee) {
      throw new Error(
        `Le total ne correspond pas : ${dossier.quantiteEnvoyee} pièce(s) envoyée(s), mais ${input.quantiteRecuperee} récupérée(s) + ` +
          `${input.quantitePerdue} perdue(s) = ${input.quantiteRecuperee + input.quantitePerdue}.`,
      )
    }

    const [fabrication] = await tx.select().from(fabrications).where(eq(fabrications.id, dossier.fabricationId))
    if (!fabrication) throw new Error('Fabrication d’origine introuvable.')
    const [modele] = await tx.select().from(modelesRuban).where(eq(modelesRuban.id, fabrication.modeleRubanId))
    if (!modele) throw new Error('Modèle de ruban introuvable.')

    const dateRetour = new Date().toISOString().slice(0, 10)

    if (input.quantiteRecuperee > 0) {
      await insertStockMouvement(tx, {
        articleId: modele.produitFiniArticleId,
        type: 'transformation',
        quantite: input.quantiteRecuperee,
        motif: `Retour Doctor Rewinder — ${fabrication.numero}`,
        actor,
        date: dateRetour,
      })
    }

    const [updated] = await tx
      .update(doctorRewinderDossiers)
      .set({ quantiteRecuperee: input.quantiteRecuperee, quantitePerdue: input.quantitePerdue, dateRetour, statut: 'cloture' })
      .where(eq(doctorRewinderDossiers.id, dossierId))
      .returning()

    return updated
  })
}

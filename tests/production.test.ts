import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { eq, inArray } from 'drizzle-orm'
import { db } from '../lib/db/client'
import {
  articles,
  doctorRewinderDossiers,
  fabrications,
  modelesRuban,
  stockMouvements,
  stockNiveaux,
} from '../lib/db/schema'
import { createArticle } from '../lib/db/mutations/articles'
import { recordManualStockMovement } from '../lib/db/mutations/stock'
import {
  annulerFabrication,
  createFabrication,
  createModeleRuban,
  enregistrerResultatFabrication,
  enregistrerRetourDoctorRewinder,
} from '../lib/db/mutations/production'

const runId = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}`
const actor = { userId: `${runId}-user`, userName: 'Test Production' }

let bobineId: number
let tubeId: number
let cartonId: number
let produitFiniId: number
let modeleId: number
const fabricationIds: number[] = []

beforeAll(async () => {
  const bobine = await createArticle({ name: `Bobine ${runId}`, level: 'semi_fini', unit: 'rouleau' })
  const tube = await createArticle({ name: `Tube ${runId}`, level: 'semi_fini', unit: 'carton' })
  const carton = await createArticle({ name: `Carton ${runId}`, level: 'semi_fini', unit: 'carton' })
  const produitFini = await createArticle({ name: `BSG test ${runId}`, level: 'produit_fini', unit: 'piece' })
  bobineId = bobine.id
  tubeId = tube.id
  cartonId = carton.id
  produitFiniId = produitFini.id

  await recordManualStockMovement({ articleId: bobineId, direction: 'entree', quantite: 10 }, actor)
  await recordManualStockMovement({ articleId: tubeId, direction: 'entree', quantite: 50_000 }, actor)
  await recordManualStockMovement({ articleId: cartonId, direction: 'entree', quantite: 1000 }, actor)

  const modele = await createModeleRuban({
    name: `BSG 30 ${runId}`,
    famille: 'bopp',
    largeurMm: 45,
    longueurRouleauM: 25,
    piecesParTour: 28,
    piecesParCarton: 90,
    bobineArticleId: bobineId,
    tubeArticleId: tubeId,
    cartonArticleId: cartonId,
    produitFiniArticleId: produitFiniId,
  })
  modeleId = modele.id
})

afterAll(async () => {
  await db.delete(doctorRewinderDossiers).where(inArray(doctorRewinderDossiers.fabricationId, fabricationIds))
  if (fabricationIds.length > 0) await db.delete(fabrications).where(inArray(fabrications.id, fabricationIds))
  await db.delete(modelesRuban).where(eq(modelesRuban.id, modeleId))
  await db.delete(stockMouvements).where(inArray(stockMouvements.articleId, [bobineId, tubeId, cartonId, produitFiniId]))
  await db.delete(stockNiveaux).where(inArray(stockNiveaux.articleId, [bobineId, tubeId, cartonId, produitFiniId]))
  await db.delete(articles).where(inArray(articles.id, [bobineId, tubeId, cartonId, produitFiniId]))
})

describe('calcul de prévision (§8, cas de test §15.7)', () => {
  it.each([
    { metrage: 3900, toursComplets: 156, piecesTheoriques: 4368, cartons: 48, restantes: 48 },
    { metrage: 4000, toursComplets: 160, piecesTheoriques: 4480, cartons: 49, restantes: 70 },
    { metrage: 4100, toursComplets: 164, piecesTheoriques: 4592, cartons: 51, restantes: 2 },
  ])('$metrage m → $toursComplets tours, $piecesTheoriques pièces, $cartons cartons + $restantes', async ({ metrage, toursComplets, piecesTheoriques, cartons, restantes }) => {
    const fabrication = await createFabrication({ modeleRubanId: modeleId, metrageEngage: metrage, dateDebut: '2026-01-01' }, actor)
    fabricationIds.push(fabrication.id)

    const { calculerPrevision } = await import('../lib/db/mutations/production')
    const prevision = calculerPrevision({ metrageEngage: metrage, longueurRouleauM: 25, piecesParTour: 28, piecesParCarton: 90 })

    expect(prevision.toursComplets).toBe(toursComplets)
    expect(prevision.piecesTheoriques).toBe(piecesTheoriques)
    expect(prevision.cartonsPrevision).toBe(cartons)
    expect(prevision.piecesRestantesPrevision).toBe(restantes)
  })
})

describe('createFabrication', () => {
  it('consomme un rouleau de la bobine à la création', async () => {
    const [before] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, bobineId))
    const fabrication = await createFabrication({ modeleRubanId: modeleId, metrageEngage: 3900, dateDebut: '2026-01-01' }, actor)
    fabricationIds.push(fabrication.id)
    const [after] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, bobineId))
    expect(after.quantite).toBe(before.quantite - 1)
  })
})

describe('annulerFabrication', () => {
  it('restitue le rouleau consommé', async () => {
    const [before] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, bobineId))
    const fabrication = await createFabrication({ modeleRubanId: modeleId, metrageEngage: 3900, dateDebut: '2026-01-01' }, actor)
    fabricationIds.push(fabrication.id)
    await annulerFabrication(fabrication.id, actor)
    const [after] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, bobineId))
    expect(after.quantite).toBe(before.quantite)
  })
})

describe('enregistrerResultatFabrication', () => {
  it("refuse un résultat incohérent (double comptage ou omission) et n'écrit rien", async () => {
    const fabrication = await createFabrication({ modeleRubanId: modeleId, metrageEngage: 3900, dateDebut: '2026-01-01' }, actor)
    fabricationIds.push(fabrication.id)

    await expect(
      enregistrerResultatFabrication(
        fabrication.id,
        { toursTotal: 156, toursDefectueux: 2, piecesDefectueusesSupp: 5, piecesDoctorRewinder: 40, piecesPerdues: 20, dateResultat: '2026-01-02' },
        actor,
      ),
    ).rejects.toThrow(/Écart de comptage/i)

    const [stillOpen] = await db.select().from(fabrications).where(eq(fabrications.id, fabrication.id))
    expect(stillOpen.etat).toBe('ouverte')
  })

  it('un résultat cohérent met à jour le stock et crée un dossier Doctor Rewinder', async () => {
    const fabrication = await createFabrication({ modeleRubanId: modeleId, metrageEngage: 3900, dateDebut: '2026-01-01' }, actor)
    fabricationIds.push(fabrication.id)

    const [produitAvant] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, produitFiniId))

    const updated = await enregistrerResultatFabrication(
      fabrication.id,
      { toursTotal: 156, toursDefectueux: 2, piecesDefectueusesSupp: 5, piecesDoctorRewinder: 40, piecesPerdues: 21, dateResultat: '2026-01-02' },
      actor,
    )
    expect(updated.etat).toBe('terminee')

    const [produitApres] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, produitFiniId))
    // piecesBrutes = 156*28 = 4368 ; nonConformes = 2*28+5 = 61 ; conformes = 4307
    expect(produitApres.quantite).toBe((produitAvant?.quantite ?? 0) + 4307)

    const [dossier] = await db.select().from(doctorRewinderDossiers).where(eq(doctorRewinderDossiers.fabricationId, fabrication.id))
    expect(dossier).toBeDefined()
    expect(dossier.quantiteEnvoyee).toBe(40)
    expect(dossier.statut).toBe('en_cours')
  })
})

describe('enregistrerRetourDoctorRewinder', () => {
  it('refuse un retour dont le total ne correspond pas, puis accepte le retour correct et incrémente le stock', async () => {
    const fabrication = await createFabrication({ modeleRubanId: modeleId, metrageEngage: 3900, dateDebut: '2026-01-01' }, actor)
    fabricationIds.push(fabrication.id)
    await enregistrerResultatFabrication(
      fabrication.id,
      { toursTotal: 156, toursDefectueux: 2, piecesDefectueusesSupp: 5, piecesDoctorRewinder: 40, piecesPerdues: 21, dateResultat: '2026-01-02' },
      actor,
    )
    const [dossier] = await db.select().from(doctorRewinderDossiers).where(eq(doctorRewinderDossiers.fabricationId, fabrication.id))

    await expect(enregistrerRetourDoctorRewinder(dossier.id, { quantiteRecuperee: 25, quantitePerdue: 10 }, actor)).rejects.toThrow(/total ne correspond pas/i)

    const [produitAvant] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, produitFiniId))
    const closed = await enregistrerRetourDoctorRewinder(dossier.id, { quantiteRecuperee: 30, quantitePerdue: 10 }, actor)
    expect(closed.statut).toBe('cloture')

    const [produitApres] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, produitFiniId))
    expect(produitApres.quantite).toBe(produitAvant.quantite + 30)
  })
})

describe('groupage et consommation de plastique rétractable', () => {
  let plastiqueId: number
  let modeleGroupageId: number
  const fabricationGroupageIds: number[] = []

  beforeAll(async () => {
    const plastique = await createArticle({ name: `Plastique rétractable ${runId}`, level: 'semi_fini', unit: 'kg' })
    plastiqueId = plastique.id
    await recordManualStockMovement({ articleId: plastiqueId, direction: 'entree', quantite: 500 }, actor)

    const modele = await createModeleRuban({
      name: `BSG 30 groupage ${runId}`,
      famille: 'bopp',
      largeurMm: 45,
      longueurRouleauM: 25,
      piecesParTour: 28,
      piecesParCarton: 90,
      bobineArticleId: bobineId,
      tubeArticleId: tubeId,
      cartonArticleId: cartonId,
      produitFiniArticleId: produitFiniId,
      piecesParPaquet: 10,
      plastiqueKgParPaquet: 0.25,
      plastiqueArticleId: plastiqueId,
    })
    modeleGroupageId = modele.id
  })

  afterAll(async () => {
    await db.delete(doctorRewinderDossiers).where(inArray(doctorRewinderDossiers.fabricationId, fabricationGroupageIds))
    if (fabricationGroupageIds.length > 0) await db.delete(fabrications).where(inArray(fabrications.id, fabricationGroupageIds))
    await db.delete(modelesRuban).where(eq(modelesRuban.id, modeleGroupageId))
    await db.delete(stockMouvements).where(eq(stockMouvements.articleId, plastiqueId))
    await db.delete(stockNiveaux).where(eq(stockNiveaux.articleId, plastiqueId))
    await db.delete(articles).where(eq(articles.id, plastiqueId))
  })

  it('consomme le plastique rétractable au prorata des paquets réellement formés avec les pièces conformes', async () => {
    const fabrication = await createFabrication({ modeleRubanId: modeleGroupageId, metrageEngage: 3900, dateDebut: '2026-01-01' }, actor)
    fabricationGroupageIds.push(fabrication.id)

    const [plastiqueAvant] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, plastiqueId))

    // toursTotal 156, toursDefectueux 2 → piecesTheoriques 4368 (28 pièces/tour)
    // conformes = (156-2)*28 - 5 (défectueuses supp) - 40 (doctor rewinder) - 21 (perdues) = 3246
    await enregistrerResultatFabrication(
      fabrication.id,
      { toursTotal: 156, toursDefectueux: 2, piecesDefectueusesSupp: 5, piecesDoctorRewinder: 40, piecesPerdues: 21, dateResultat: '2026-01-02' },
      actor,
    )

    const piecesConformes = 156 * 28 - (2 * 28 + 5)
    const paquetsAttendus = Math.ceil(piecesConformes / 10)
    const plastiqueAttendu = paquetsAttendus * 0.25

    const [plastiqueApres] = await db.select().from(stockNiveaux).where(eq(stockNiveaux.articleId, plastiqueId))
    expect(plastiqueApres.quantite).toBeCloseTo(plastiqueAvant.quantite - plastiqueAttendu, 6)
  })
})

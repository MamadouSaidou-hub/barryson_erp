import { asc, desc, eq } from 'drizzle-orm'
import { db } from '../client'
import { articles, doctorRewinderDossiers, fabrications, modelesRuban } from '../schema'
import { calculerPrevision, calculerResultat } from '../mutations/production'

export async function getModelesRubanList() {
  const rows = await db
    .select({
      id: modelesRuban.id,
      name: modelesRuban.name,
      famille: modelesRuban.famille,
      largeurMm: modelesRuban.largeurMm,
      longueurRouleauM: modelesRuban.longueurRouleauM,
      piecesParTour: modelesRuban.piecesParTour,
      piecesParCarton: modelesRuban.piecesParCarton,
      piecesParPaquet: modelesRuban.piecesParPaquet,
      plastiqueKgParPaquet: modelesRuban.plastiqueKgParPaquet,
      finish: modelesRuban.finish,
      moule: modelesRuban.moule,
      bobineArticleId: modelesRuban.bobineArticleId,
      tubeArticleId: modelesRuban.tubeArticleId,
      cartonArticleId: modelesRuban.cartonArticleId,
      plastiqueArticleId: modelesRuban.plastiqueArticleId,
      produitFiniArticleId: modelesRuban.produitFiniArticleId,
      active: modelesRuban.active,
    })
    .from(modelesRuban)
    .orderBy(asc(modelesRuban.name))
  return rows
}

export async function getActiveModeleRubanOptions() {
  const rows = await getModelesRubanList()
  return rows.filter((row) => row.active)
}

export async function getFabricationsList() {
  const rows = await db
    .select({
      id: fabrications.id,
      numero: fabrications.numero,
      modeleRubanId: fabrications.modeleRubanId,
      modeleNom: modelesRuban.name,
      produitFiniArticleId: modelesRuban.produitFiniArticleId,
      tubeArticleId: modelesRuban.tubeArticleId,
      cartonArticleId: modelesRuban.cartonArticleId,
      plastiqueArticleId: modelesRuban.plastiqueArticleId,
      piecesParTour: modelesRuban.piecesParTour,
      piecesParCarton: modelesRuban.piecesParCarton,
      piecesParPaquet: modelesRuban.piecesParPaquet,
      plastiqueKgParPaquet: modelesRuban.plastiqueKgParPaquet,
      longueurRouleauM: modelesRuban.longueurRouleauM,
      metrageEngage: fabrications.metrageEngage,
      dateDebut: fabrications.dateDebut,
      etat: fabrications.etat,
      toursTotal: fabrications.toursTotal,
      toursDefectueux: fabrications.toursDefectueux,
      piecesDefectueusesSupp: fabrications.piecesDefectueusesSupp,
      piecesDoctorRewinder: fabrications.piecesDoctorRewinder,
      piecesPerdues: fabrications.piecesPerdues,
      dateResultat: fabrications.dateResultat,
    })
    .from(fabrications)
    .innerJoin(modelesRuban, eq(fabrications.modeleRubanId, modelesRuban.id))
    .orderBy(desc(fabrications.dateDebut))

  return rows.map((row) => {
    const prevision = calculerPrevision({
      metrageEngage: row.metrageEngage,
      longueurRouleauM: row.longueurRouleauM,
      piecesParTour: row.piecesParTour,
      piecesParCarton: row.piecesParCarton,
    })

    const resultat =
      row.etat === 'terminee' &&
      row.toursTotal !== null &&
      row.toursDefectueux !== null &&
      row.piecesDefectueusesSupp !== null &&
      row.piecesDoctorRewinder !== null &&
      row.piecesPerdues !== null
        ? calculerResultat({
            toursTotal: row.toursTotal,
            toursDefectueux: row.toursDefectueux,
            piecesDefectueusesSupp: row.piecesDefectueusesSupp,
            piecesDoctorRewinder: row.piecesDoctorRewinder,
            piecesPerdues: row.piecesPerdues,
            piecesParTour: row.piecesParTour,
            piecesParCarton: row.piecesParCarton,
            piecesTheoriques: prevision.piecesTheoriques,
            piecesParPaquet: row.piecesParPaquet,
            plastiqueKgParPaquet: row.plastiqueKgParPaquet,
          })
        : null

    return { ...row, prevision, resultat }
  })
}

export async function getFabricationDetail(id: number) {
  const list = await getFabricationsList()
  return list.find((row) => row.id === id) ?? null
}

export async function getDoctorRewinderDossiers() {
  const rows = await db
    .select({
      id: doctorRewinderDossiers.id,
      fabricationId: doctorRewinderDossiers.fabricationId,
      fabricationNumero: fabrications.numero,
      quantiteEnvoyee: doctorRewinderDossiers.quantiteEnvoyee,
      quantiteRecuperee: doctorRewinderDossiers.quantiteRecuperee,
      quantitePerdue: doctorRewinderDossiers.quantitePerdue,
      dateEnvoi: doctorRewinderDossiers.dateEnvoi,
      dateRetour: doctorRewinderDossiers.dateRetour,
      statut: doctorRewinderDossiers.statut,
    })
    .from(doctorRewinderDossiers)
    .innerJoin(fabrications, eq(doctorRewinderDossiers.fabricationId, fabrications.id))
    .orderBy(desc(doctorRewinderDossiers.dateEnvoi))
  return rows
}

export async function getDoctorRewinderIndicateurs() {
  const dossiers = await getDoctorRewinderDossiers()
  const enCours = dossiers.filter((d) => d.statut === 'en_cours')
  const clotures = dossiers.filter((d) => d.statut === 'cloture')

  const totalEnvoyeClotures = clotures.reduce((sum, d) => sum + d.quantiteEnvoyee, 0)
  const totalRecupereClotures = clotures.reduce((sum, d) => sum + (d.quantiteRecuperee ?? 0), 0)
  const tauxRecuperation = totalEnvoyeClotures > 0 ? totalRecupereClotures / totalEnvoyeClotures : null

  const today = Date.now()
  const anciennetesJours = enCours.map((d) => Math.max(0, Math.floor((today - new Date(d.dateEnvoi).getTime()) / 86_400_000)))
  const ancienneteMoyenne = anciennetesJours.length > 0 ? Math.round(anciennetesJours.reduce((a, b) => a + b, 0) / anciennetesJours.length) : null

  return {
    encoursCount: enCours.length,
    tauxRecuperation,
    ancienneteMoyenneJours: ancienneteMoyenne,
  }
}

// Utilisé par le formulaire "+ Nouvelle fabrication" / Réglages → Modèles de ruban pour choisir
// les articles liés (bobine, tube, carton, produit fini).
export async function getArticleOptionsByLevel() {
  return db.select({ id: articles.id, name: articles.name, level: articles.level, unit: articles.unit, active: articles.active }).from(articles)
}

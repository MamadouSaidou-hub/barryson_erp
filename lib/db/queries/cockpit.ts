import { getStockOverview } from './stock'
import { getCommandesList } from './commandes'
import { getFabricationsList, getDoctorRewinderIndicateurs, getDoctorRewinderDossiers } from './production'
import { getCommandesClientsList, getCreancesList } from './ventes'
import { getBesoinsFabricationList } from './besoins-fabrication'

// Seuil d'ancienneté (jours) au-delà duquel un dossier Doctor Rewinder encore ouvert remonte en
// alerte sur le Cockpit DG. En dur pour l'instant — ajustable plus tard si le client le demande.
const DOCTOR_REWINDER_ALERTE_JOURS = 14

export async function getCockpitDGSummary() {
  const [stock, commandesAchat, fabrications, doctorRewinderIndicateurs, doctorRewinderDossiers, commandesClients, creances, besoinsFabrication] = await Promise.all([
    getStockOverview(),
    getCommandesList(),
    getFabricationsList(),
    getDoctorRewinderIndicateurs(),
    getDoctorRewinderDossiers(),
    getCommandesClientsList(),
    getCreancesList(),
    getBesoinsFabricationList(),
  ])

  const today = new Date().toISOString().slice(0, 10)

  const stockAlertes = stock.filter((item) => item.negatif || item.presqueFini)

  const achatsEnCours = commandesAchat.filter((c) => c.etat === 'commandee' || c.etat === 'partiellement_recue')
  const achatsEnRetard = achatsEnCours.filter((c) => c.dateArriveePrevue && c.dateArriveePrevue < today)

  const fabricationsEnCours = fabrications.filter((f) => f.etat === 'ouverte')
  const fabricationsTerminees = fabrications.filter((f) => f.etat === 'terminee' && f.resultat)
  const rendementMoyen =
    fabricationsTerminees.length > 0 ? fabricationsTerminees.reduce((sum, f) => sum + (f.resultat?.rendement ?? 0), 0) / fabricationsTerminees.length : null

  const doctorRewinderAnciens = doctorRewinderDossiers.filter((d) => {
    if (d.statut !== 'en_cours') return false
    const ancienneteJours = Math.floor((Date.now() - new Date(d.dateEnvoi).getTime()) / 86_400_000)
    return ancienneteJours > DOCTOR_REWINDER_ALERTE_JOURS
  })

  const ventesEnCours = commandesClients.filter((c) => c.etat === 'confirmee' || c.etat === 'partiellement_livree')
  const creancesEnRetard = creances.filter((c) => c.enRetard)
  const totalCreances = creances.reduce((sum, c) => sum + c.solde, 0)
  const totalCreancesEnRetard = creancesEnRetard.reduce((sum, c) => sum + c.solde, 0)

  const alertes = [
    stockAlertes.length > 0 && { label: `${stockAlertes.length} article(s) de stock à surveiller`, href: '/stock' },
    achatsEnRetard.length > 0 && { label: `${achatsEnRetard.length} commande(s) fournisseur en retard de réception`, href: '/recevoir' },
    creancesEnRetard.length > 0 && { label: `${creancesEnRetard.length} créance(s) client en retard`, href: '/creances' },
    doctorRewinderAnciens.length > 0 && { label: `${doctorRewinderAnciens.length} dossier(s) Doctor Rewinder ouverts depuis plus de ${DOCTOR_REWINDER_ALERTE_JOURS} jours`, href: '/doctor-rewinder' },
    besoinsFabrication.length > 0 && { label: `${besoinsFabrication.length} produit(s) fini(s) en rupture face à la demande client`, href: '/ventes' },
  ].filter(Boolean) as { label: string; href: string }[]

  return {
    achatsEnCoursCount: achatsEnCours.length,
    fabricationsEnCoursCount: fabricationsEnCours.length,
    rendementMoyen,
    doctorRewinderIndicateurs,
    ventesEnCoursCount: ventesEnCours.length,
    totalCreances,
    totalCreancesEnRetard,
    alertes,
  }
}

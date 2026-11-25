'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ClipboardList, PackageCheck, PackagePlus, ShoppingCart, Stethoscope, TriangleAlert, Wallet, Wrench } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney, formatQuantity } from '@/lib/format'

type Access = {
  commander: boolean
  recevoir: boolean
  stock: boolean
  production: boolean
  doctorRewinder: boolean
  ventes: boolean
  creances: boolean
  reglages: boolean
}

type StockRow = { articleId: number; name: string; unit: string; quantite: number; presqueFini: boolean; negatif: boolean }
type CommandeAchatRow = { id: number; numero: string; fournisseurName: string; etat: string; dateArriveePrevue: string | null }
type Mouvement = { id: number; articleName: string; articleUnit: string; type: string; quantite: number; date: string }
type Fabrication = { id: number; numero: string; modeleNom: string; etat: 'ouverte' | 'terminee' | 'annulee'; prevision: { piecesTheoriques: number } }
type DoctorRewinderIndicateurs = { encoursCount: number; tauxRecuperation: number | null; ancienneteMoyenneJours: number | null }
type DoctorRewinderDossier = { id: number; fabricationNumero: string; dateEnvoi: string; statut: 'en_cours' | 'cloture' }
type CommandeClientRow = { id: number; numero: string; clientName: string; etat: string; solde: number }
type Creance = { id: number; numero: string; clientName: string; echeance: string | null; solde: number; enRetard: boolean }
type BesoinFabrication = { articleId: number; articleName: string; unit: string; manque: number }
type PerformanceClient = { clientId: number; procheDuPlafond: boolean }

const ETAT_ACHAT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  commandee: 'Commandée',
  partiellement_recue: 'Partiellement reçue',
  recue: 'Reçue',
  soldee: 'Soldée',
  annulee: 'Annulée',
}
const ETAT_VENTE_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  confirmee: 'Confirmée',
  partiellement_livree: 'Partiellement livrée',
  livree: 'Livrée',
  annulee: 'Annulée',
}
const TYPE_LABELS: Record<string, string> = {
  reception: 'Réception',
  entree_manuelle: 'Entrée',
  entree_directe: 'Entrée directe',
  sortie_manuelle: 'Sortie',
  sortie_exceptionnelle: 'Sortie exceptionnelle',
  ajustement: 'Ajustement',
  inventaire: 'Inventaire',
  consommation: 'Consommation',
  transformation: 'Transformation',
  vente: 'Vente',
}

const DOCTOR_REWINDER_ALERTE_JOURS = 14

export function HomeView({ userName, access }: { userName: string; access: Access }) {
  const [stock, setStock] = useState<StockRow[] | null>(null)
  const [commandesAchat, setCommandesAchat] = useState<CommandeAchatRow[] | null>(null)
  const [mouvements, setMouvements] = useState<Mouvement[] | null>(null)
  const [fabrications, setFabrications] = useState<Fabrication[] | null>(null)
  const [drIndicateurs, setDrIndicateurs] = useState<DoctorRewinderIndicateurs | null>(null)
  const [drDossiers, setDrDossiers] = useState<DoctorRewinderDossier[] | null>(null)
  const [commandesClients, setCommandesClients] = useState<CommandeClientRow[] | null>(null)
  const [creances, setCreances] = useState<Creance[] | null>(null)
  const [besoins, setBesoins] = useState<BesoinFabrication[] | null>(null)
  const [performanceClients, setPerformanceClients] = useState<PerformanceClient[] | null>(null)

  useEffect(() => {
    if (access.stock) {
      fetchJson<{ items: StockRow[] }>('/api/stock').then((res) => setStock(res.items))
      fetchJson<{ mouvements: Mouvement[] }>('/api/stock/mouvements').then((res) => setMouvements(res.mouvements))
    }
    if (access.commander || access.recevoir) {
      fetchJson<{ commandes: CommandeAchatRow[] }>('/api/commandes').then((res) => setCommandesAchat(res.commandes))
    }
    if (access.production) {
      fetchJson<{ fabrications: Fabrication[] }>('/api/fabrications').then((res) => setFabrications(res.fabrications))
      fetchJson<{ besoins: BesoinFabrication[] }>('/api/besoins-fabrication').then((res) => setBesoins(res.besoins))
    }
    if (access.doctorRewinder) {
      fetchJson<{ dossiers: DoctorRewinderDossier[]; indicateurs: DoctorRewinderIndicateurs }>('/api/doctor-rewinder').then((res) => {
        setDrIndicateurs(res.indicateurs)
        setDrDossiers(res.dossiers)
      })
    }
    if (access.ventes) {
      fetchJson<{ commandes: CommandeClientRow[] }>('/api/ventes-commandes').then((res) => setCommandesClients(res.commandes))
      fetchJson<{ clients: PerformanceClient[] }>('/api/clients/performance').then((res) => setPerformanceClients(res.clients))
    }
    if (access.creances) {
      fetchJson<{ creances: Creance[] }>('/api/creances').then((res) => setCreances(res.creances))
    }
  }, [access.stock, access.commander, access.recevoir, access.production, access.doctorRewinder, access.ventes, access.creances])

  const stockAlerts = stock?.filter((item) => item.negatif || item.presqueFini) ?? []
  const commandesAchatEnRoute = commandesAchat?.filter((c) => c.etat === 'commandee' || c.etat === 'partiellement_recue') ?? []
  const today = new Date().toISOString().slice(0, 10)
  const commandesAchatEnRetard = commandesAchatEnRoute.filter((c) => c.dateArriveePrevue && c.dateArriveePrevue < today)

  const fabricationsEnCours = fabrications?.filter((f) => f.etat === 'ouverte') ?? []
  const drDossiersAnciens = (drDossiers ?? []).filter((d) => d.statut === 'en_cours' && Math.floor((Date.now() - new Date(d.dateEnvoi).getTime()) / 86_400_000) > DOCTOR_REWINDER_ALERTE_JOURS)
  const commandesClientsEnCours = commandesClients?.filter((c) => c.etat === 'confirmee' || c.etat === 'partiellement_livree') ?? []
  const creancesEnRetard = creances?.filter((c) => c.enRetard) ?? []
  const totalCreances = (creances ?? []).reduce((sum, c) => sum + c.solde, 0)
  const clientsProchesDuPlafond = performanceClients?.filter((c) => c.procheDuPlafond) ?? []

  const taches = [
    stock && stockAlerts.length > 0 && { label: `${stockAlerts.length} article(s) de stock à surveiller`, href: '/stock' },
    commandesAchat && commandesAchatEnRetard.length > 0 && { label: `${commandesAchatEnRetard.length} commande(s) arrivée prévue dépassée — à contrôler`, href: '/recevoir' },
    drDossiers && drDossiersAnciens.length > 0 && { label: `${drDossiersAnciens.length} dossier(s) Doctor Rewinder ouverts depuis plus de ${DOCTOR_REWINDER_ALERTE_JOURS} jours`, href: '/doctor-rewinder' },
    besoins && besoins.length > 0 && { label: `${besoins.length} produit(s) en rupture face à la demande client — fabrication à prévoir`, href: '/production' },
    creances && creancesEnRetard.length > 0 && { label: `${creancesEnRetard.length} créance(s) client en retard`, href: '/creances' },
    performanceClients && clientsProchesDuPlafond.length > 0 && { label: `${clientsProchesDuPlafond.length} client(s) proche(s) de leur plafond d'encours`, href: '/ventes/clients' },
  ].filter(Boolean) as { label: string; href: string }[]

  const aucunModule = !access.stock && !access.commander && !access.recevoir && !access.production && !access.doctorRewinder && !access.ventes && !access.creances

  return (
    <AppShell breadcrumb="Barryson" section="Accueil">
      <div className="page-heading">
        <div>
          <p className="eyebrow">BIENVENUE</p>
          <h1>Bonjour, <span>{userName}</span></h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {access.commander && <Link href="/commander" className="btn-primary"><ClipboardList size={14} /> Nouvelle commande</Link>}
          {access.ventes && <Link href="/ventes" className="btn-primary"><ShoppingCart size={14} /> Nouvelle vente</Link>}
          {access.stock && <Link href="/stock" className="btn-secondary"><PackagePlus size={14} /> Entrée / sortie de stock</Link>}
        </div>
      </div>

      <div className="metrics-grid">
        {access.stock && (
          <Link href="/stock" className="metric-card" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="metric-topline"><div className="metric-icon metric-icon-blue"><PackageCheck size={15} /></div></div>
            <p className="metric-label">Produits en stock</p>
            <p className="metric-value">{stock ? stock.length : '—'}</p>
            {stock && stockAlerts.length > 0 && <p className="metric-helper">{stockAlerts.length} à surveiller</p>}
          </Link>
        )}
        {(access.commander || access.recevoir) && (
          <Link href="/recevoir" className="metric-card" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="metric-topline"><div className="metric-icon metric-icon-orange"><ClipboardList size={15} /></div></div>
            <p className="metric-label">Commandes en route</p>
            <p className="metric-value">{commandesAchat ? commandesAchatEnRoute.length : '—'}</p>
            {commandesAchat && commandesAchatEnRetard.length > 0 && <p className="metric-helper">{commandesAchatEnRetard.length} arrivée(s) dépassée(s)</p>}
          </Link>
        )}
        {access.production && (
          <Link href="/production" className="metric-card" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="metric-topline"><div className="metric-icon metric-icon-navy"><Wrench size={15} /></div></div>
            <p className="metric-label">Fabrications en cours</p>
            <p className="metric-value">{fabrications ? fabricationsEnCours.length : '—'}</p>
          </Link>
        )}
        {access.doctorRewinder && (
          <Link href="/doctor-rewinder" className="metric-card" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="metric-topline"><div className="metric-icon metric-icon-orange"><Stethoscope size={15} /></div></div>
            <p className="metric-label">Doctor Rewinder — récupération</p>
            <p className="metric-value">{drIndicateurs?.tauxRecuperation !== null && drIndicateurs?.tauxRecuperation !== undefined ? `${(drIndicateurs.tauxRecuperation * 100).toFixed(0)} %` : '—'}</p>
            {drIndicateurs && <p className="metric-helper">{drIndicateurs.encoursCount} en cours</p>}
          </Link>
        )}
        {access.ventes && (
          <Link href="/ventes" className="metric-card" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="metric-topline"><div className="metric-icon metric-icon-blue"><ShoppingCart size={15} /></div></div>
            <p className="metric-label">Commandes clients en cours</p>
            <p className="metric-value">{commandesClients ? commandesClientsEnCours.length : '—'}</p>
          </Link>
        )}
        {access.creances && (
          <Link href="/creances" className="metric-card" style={{ textDecoration: 'none', display: 'block' }}>
            <div className="metric-topline"><div className="metric-icon metric-icon-green"><Wallet size={15} /></div></div>
            <p className="metric-label">Total créances</p>
            <p className="metric-value">{creances ? formatMoney(totalCreances) : '—'}</p>
            {creances && creancesEnRetard.length > 0 && <p className="metric-helper">{creancesEnRetard.length} en retard</p>}
          </Link>
        )}
      </div>

      <div className="table-panel" style={{ marginBottom: 20, padding: 18 }}>
        <p className="section-title">À faire</p>
        {taches.length === 0 && <p className="section-subtitle">Rien à signaler.</p>}
        {taches.map((tache) => (
          <Link key={tache.href + tache.label} href={tache.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', textDecoration: 'none', color: 'var(--text)' }}>
            <TriangleAlert size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
            <span>{tache.label}</span>
          </Link>
        ))}
      </div>

      <div className="bottom-grid">
        {access.stock && (
          <div className="table-panel">
            <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="section-title" style={{ margin: 0 }}>Stock — alertes</p>
              <Link href="/stock" className="text-link">Tout le stock</Link>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Article</th><th>En stock</th><th>Alerte</th></tr></thead>
                <tbody>
                  {stock && stockAlerts.length === 0 && <tr><td colSpan={3} className="table-empty">Aucune alerte.</td></tr>}
                  {stockAlerts.slice(0, 6).map((item) => (
                    <tr key={item.articleId}>
                      <td>{item.name}</td>
                      <td>{formatQuantity(item.quantite, item.unit)}</td>
                      <td>{item.negatif ? <span className="badge badge-red">Négatif</span> : <span className="badge badge-orange">Presque fini</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {(access.commander || access.recevoir) && (
          <div className="table-panel">
            <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="section-title" style={{ margin: 0 }}>Commandes en route</p>
              <Link href="/recevoir" className="text-link">Recevoir</Link>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Numéro</th><th>Fournisseur</th><th>Arrivée prévue</th><th>État</th></tr></thead>
                <tbody>
                  {commandesAchat && commandesAchatEnRoute.length === 0 && <tr><td colSpan={4} className="table-empty">Aucune commande en route.</td></tr>}
                  {commandesAchatEnRoute.slice(0, 6).map((commande) => (
                    <tr key={commande.id}>
                      <td>{commande.numero}</td>
                      <td>{commande.fournisseurName}</td>
                      <td>{commande.dateArriveePrevue ?? '—'}</td>
                      <td><span className="badge badge-blue">{ETAT_ACHAT_LABELS[commande.etat]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {access.production && (
          <div className="table-panel">
            <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="section-title" style={{ margin: 0 }}>Fabrications en cours</p>
              <Link href="/production" className="text-link">Production</Link>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Numéro</th><th>Modèle</th><th>Prévision</th></tr></thead>
                <tbody>
                  {fabrications && fabricationsEnCours.length === 0 && <tr><td colSpan={3} className="table-empty">Aucune fabrication en cours.</td></tr>}
                  {fabricationsEnCours.slice(0, 6).map((f) => (
                    <tr key={f.id}>
                      <td>{f.numero}</td>
                      <td>{f.modeleNom}</td>
                      <td>{f.prevision.piecesTheoriques} pièces</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {access.ventes && (
          <div className="table-panel">
            <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="section-title" style={{ margin: 0 }}>Commandes clients en cours</p>
              <Link href="/ventes" className="text-link">Ventes</Link>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Numéro</th><th>Client</th><th>Solde</th><th>État</th></tr></thead>
                <tbody>
                  {commandesClients && commandesClientsEnCours.length === 0 && <tr><td colSpan={4} className="table-empty">Aucune commande en cours.</td></tr>}
                  {commandesClientsEnCours.slice(0, 6).map((c) => (
                    <tr key={c.id}>
                      <td>{c.numero}</td>
                      <td>{c.clientName}</td>
                      <td>{formatMoney(c.solde)}</td>
                      <td><span className="badge badge-blue">{ETAT_VENTE_LABELS[c.etat]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {access.creances && (
          <div className="table-panel">
            <div style={{ padding: '16px 18px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p className="section-title" style={{ margin: 0 }}>Créances en retard</p>
              <Link href="/creances" className="text-link">Toutes les créances</Link>
            </div>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>Numéro</th><th>Client</th><th>Échéance</th><th>Solde</th></tr></thead>
                <tbody>
                  {creances && creancesEnRetard.length === 0 && <tr><td colSpan={4} className="table-empty">Aucune créance en retard.</td></tr>}
                  {creancesEnRetard.slice(0, 6).map((c) => (
                    <tr key={c.id}>
                      <td>{c.numero}</td>
                      <td>{c.clientName}</td>
                      <td>{c.echeance ?? '—'}</td>
                      <td style={{ fontWeight: 700 }}>{formatMoney(c.solde)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {access.stock && (
        <div className="table-panel" style={{ marginTop: 16 }}>
          <p className="section-title" style={{ padding: '16px 18px 0' }}>Derniers mouvements</p>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Article</th><th>Type</th><th>Quantité</th></tr></thead>
              <tbody>
                {mouvements && mouvements.length === 0 && <tr><td colSpan={4} className="table-empty">Aucun mouvement.</td></tr>}
                {(mouvements ?? []).slice(0, 6).map((mouvement) => (
                  <tr key={mouvement.id}>
                    <td>{mouvement.date.slice(0, 10)}</td>
                    <td>{mouvement.articleName}</td>
                    <td>{TYPE_LABELS[mouvement.type] ?? mouvement.type}</td>
                    <td>{formatQuantity(mouvement.quantite, mouvement.articleUnit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {aucunModule && (
        <div className="table-panel" style={{ padding: 24 }}>
          <p className="section-subtitle" style={{ margin: 0 }}>
            <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
            Aucun module n&apos;est encore ouvert pour votre profil.
          </p>
        </div>
      )}
    </AppShell>
  )
}

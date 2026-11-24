'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'

type CommandeRow = {
  id: number
  numero: string
  fournisseurName: string
  devise: string
  etat: string
  dateArriveePrevue: string | null
  total: number
}

const ETAT_LABELS: Record<string, string> = {
  commandee: 'Commandée',
  partiellement_recue: 'Partiellement reçue',
}

export function RecevoirListView() {
  const [commandes, setCommandes] = useState<CommandeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJson<{ commandes: CommandeRow[] }>('/api/commandes')
      .then((res) => setCommandes(res.commandes.filter((c) => c.etat === 'commandee' || c.etat === 'partiellement_recue')))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Achats" section="Recevoir">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACHATS</p>
          <h1>Recevoir</h1>
          <p className="heading-subtitle">Commandes en attente de réception.</p>
        </div>
      </div>
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Numéro</th><th>Fournisseur</th><th>Total</th><th>Arrivée prévue</th><th>État</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && commandes.length === 0 && <tr><td colSpan={6} className="table-empty">Aucune commande à recevoir.</td></tr>}
              {commandes.map((commande) => (
                <tr key={commande.id} className="clickable-row" onClick={() => (window.location.href = `/recevoir/${commande.id}`)}>
                  <td>{commande.numero}</td>
                  <td>{commande.fournisseurName}</td>
                  <td>{formatMoney(commande.total, commande.devise)}</td>
                  <td>{commande.dateArriveePrevue ?? '—'}</td>
                  <td><span className="badge badge-orange">{ETAT_LABELS[commande.etat]}</span></td>
                  <td><a href={`/recevoir/${commande.id}`} className="btn-ghost">Réceptionner</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}

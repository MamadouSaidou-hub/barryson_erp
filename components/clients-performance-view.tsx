'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'

type PerformanceClient = {
  clientId: number
  clientName: string
  caCumule: number
  nombreCommandes: number
  panierMoyen: number
  derniereCommande: string | null
  encours: number
  plafondEncours: number | null
  pctPlafond: number | null
  procheDuPlafond: boolean
}

function plafondBadge(pctPlafond: number | null) {
  if (pctPlafond === null) return null
  if (pctPlafond >= 1) return <span className="badge badge-red">{Math.round(pctPlafond * 100)} % du plafond</span>
  if (pctPlafond >= 0.8) return <span className="badge badge-orange">{Math.round(pctPlafond * 100)} % du plafond</span>
  return <span className="cell-secondary">{Math.round(pctPlafond * 100)} % du plafond</span>
}

export function ClientsPerformanceView() {
  const [clients, setClients] = useState<PerformanceClient[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchJson<{ clients: PerformanceClient[] }>('/api/clients/performance')
      .then((res) => setClients(res.clients))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Ventes" section="Clients">
      <div className="page-heading">
        <div>
          <p className="eyebrow">VENTES</p>
          <h1>Performance clients</h1>
          <p className="heading-subtitle">CA cumulé, panier moyen et encours — pour prioriser les relances commerciales.</p>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Client</th><th>CA cumulé</th><th>Panier moyen</th><th>Commandes</th><th>Dernière commande</th><th>Encours</th></tr>
            </thead>
            <tbody>
              {!loading && clients.length === 0 && <tr><td colSpan={6} className="table-empty">Aucun client.</td></tr>}
              {clients.map((client) => (
                <tr key={client.clientId}>
                  <td>{client.clientName}</td>
                  <td>{formatMoney(client.caCumule)}</td>
                  <td>{formatMoney(client.panierMoyen)}</td>
                  <td>{client.nombreCommandes}</td>
                  <td className="cell-secondary">{client.derniereCommande ?? '—'}</td>
                  <td>
                    {formatMoney(client.encours)}
                    {client.plafondEncours && <div style={{ marginTop: 2 }}>{plafondBadge(client.pctPlafond)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}

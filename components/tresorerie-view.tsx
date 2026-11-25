'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'

type TresorerieVentes = { totalEncaisse: number; totalACaisser: number }
type TresorerieAchat = { devise: string; totalCommande: number; totalPaye: number; solde: number }
type Tresorerie = { ventes: TresorerieVentes; achats: TresorerieAchat[] }

export function TresorerieView() {
  const [data, setData] = useState<Tresorerie | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchJson<Tresorerie>('/api/tresorerie')
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Comptabilité" section="Trésorerie">
      <div className="page-heading">
        <div>
          <p className="eyebrow">COMPTABILITÉ</p>
          <h1>Trésorerie</h1>
          <p className="heading-subtitle">Encaissements clients et décaissements fournisseurs — jamais combinés, car dans des devises différentes.</p>
        </div>
      </div>

      {loading && <p className="table-empty">Chargement...</p>}

      {data && (
        <>
          <p className="section-title">Encaissements clients (GNF)</p>
          <div className="metrics-grid" style={{ marginBottom: 24 }}>
            <div className="metric-card">
              <p className="metric-label">Total encaissé</p>
              <p className="metric-value">{formatMoney(data.ventes.totalEncaisse)}</p>
            </div>
            <div className="metric-card">
              <p className="metric-label">Reste à encaisser</p>
              <p className="metric-value">{formatMoney(data.ventes.totalACaisser)}</p>
            </div>
          </div>

          <p className="section-title">Décaissements fournisseurs (par devise, indicatif)</p>
          <p className="section-subtitle" style={{ marginBottom: 8 }}>
            Les prix d&apos;achat en devise étrangère sont des estimations — ces montants ne sont jamais convertis ni additionnés aux encaissements GNF ci-dessus.
          </p>
          {data.achats.length === 0 && <p className="table-empty">Aucun achat en cours.</p>}
          <div className="metrics-grid">
            {data.achats.map((achat) => (
              <div className="metric-card" key={achat.devise}>
                <p className="metric-label">{achat.devise}</p>
                <p className="metric-value">{formatMoney(achat.solde, achat.devise)} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--muted)' }}>restant dû</span></p>
                <p className="cell-secondary">Commandé {formatMoney(achat.totalCommande, achat.devise)} · Payé {formatMoney(achat.totalPaye, achat.devise)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </AppShell>
  )
}

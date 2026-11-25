'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, Percent, ShoppingCart, Stethoscope, TriangleAlert, Wallet, Wrench } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'

type CockpitSummary = {
  achatsEnCoursCount: number
  fabricationsEnCoursCount: number
  rendementMoyen: number | null
  doctorRewinderIndicateurs: { encoursCount: number; tauxRecuperation: number | null; ancienneteMoyenneJours: number | null }
  ventesEnCoursCount: number
  totalCreances: number
  totalCreancesEnRetard: number
  alertes: { label: string; href: string }[]
}

function MetricCard({ label, value, icon: Icon, tone, helper }: { label: string; value: string; icon: typeof Wrench; tone: 'navy' | 'green' | 'orange' | 'blue'; helper?: string }) {
  return (
    <article className="metric-card">
      <div className="metric-topline"><span className={`metric-icon metric-icon-${tone}`}><Icon aria-hidden="true" /></span></div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      {helper && <p className="metric-helper">{helper}</p>}
    </article>
  )
}

export function CockpitDGView() {
  const [summary, setSummary] = useState<CockpitSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchJson<CockpitSummary>('/api/cockpit-dg')
      .then(setSummary)
      .finally(() => setLoading(false))
  }, [])

  return (
    <AppShell breadcrumb="Direction" section="Cockpit DG">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DIRECTION</p>
          <h1>Cockpit <span>DG</span></h1>
          <p className="heading-subtitle">Synthèse achats, production, ventes et créances.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard label="Commandes fournisseur en cours" value={loading ? '—' : `${summary?.achatsEnCoursCount ?? 0}`} icon={ClipboardList} tone="blue" />
        <MetricCard label="Fabrications en cours" value={loading ? '—' : `${summary?.fabricationsEnCoursCount ?? 0}`} icon={Wrench} tone="navy" />
        <MetricCard
          label="Rendement moyen production"
          value={loading || summary?.rendementMoyen === null || summary?.rendementMoyen === undefined ? '—' : `${(summary.rendementMoyen * 100).toFixed(1)} %`}
          icon={Percent}
          tone="green"
        />
        <MetricCard
          label="Doctor Rewinder — récupération"
          value={
            loading || summary?.doctorRewinderIndicateurs.tauxRecuperation === null || summary?.doctorRewinderIndicateurs.tauxRecuperation === undefined
              ? '—'
              : `${(summary.doctorRewinderIndicateurs.tauxRecuperation * 100).toFixed(0)} %`
          }
          icon={Stethoscope}
          tone="orange"
          helper={summary ? `${summary.doctorRewinderIndicateurs.encoursCount} en cours` : undefined}
        />
        <MetricCard label="Commandes clients en cours" value={loading ? '—' : `${summary?.ventesEnCoursCount ?? 0}`} icon={ShoppingCart} tone="blue" />
        <MetricCard
          label="Total créances"
          value={loading ? '—' : formatMoney(summary?.totalCreances ?? 0)}
          icon={Wallet}
          tone="navy"
          helper={summary && summary.totalCreancesEnRetard > 0 ? `dont ${formatMoney(summary.totalCreancesEnRetard)} en retard` : undefined}
        />
      </div>

      <div className="table-panel" style={{ padding: 18 }}>
        <p className="section-title">Alertes</p>
        {!loading && (summary?.alertes.length ?? 0) === 0 && <p className="section-subtitle">Rien à signaler.</p>}
        {summary?.alertes.map((alerte) => (
          <Link key={alerte.href + alerte.label} href={alerte.href} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', textDecoration: 'none', color: 'var(--text)' }}>
            <TriangleAlert size={14} style={{ color: 'var(--orange)', flexShrink: 0 }} />
            <span>{alerte.label}</span>
          </Link>
        ))}
      </div>
    </AppShell>
  )
}

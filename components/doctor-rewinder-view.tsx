'use client'

import { useEffect, useState } from 'react'
import { Clock, Percent, Sparkles } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'

type Dossier = {
  id: number
  fabricationId: number
  fabricationNumero: string
  quantiteEnvoyee: number
  quantiteRecuperee: number | null
  quantitePerdue: number | null
  dateEnvoi: string
  dateRetour: string | null
  statut: 'en_cours' | 'cloture'
}

type Indicateurs = { encoursCount: number; tauxRecuperation: number | null; ancienneteMoyenneJours: number | null }

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Sparkles; tone: 'navy' | 'green' | 'orange' | 'blue' }) {
  return (
    <article className="metric-card">
      <div className="metric-topline"><span className={`metric-icon metric-icon-${tone}`}><Icon aria-hidden="true" /></span></div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </article>
  )
}

function RetourForm({ dossier, onDone }: { dossier: Dossier; onDone: () => void }) {
  const [quantiteRecuperee, setQuantiteRecuperee] = useState('')
  const [quantitePerdue, setQuantitePerdue] = useState('0')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const total = (Number(quantiteRecuperee) || 0) + (Number(quantitePerdue) || 0)
  const coherent = total === dossier.quantiteEnvoyee

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/doctor-rewinder/${dossier.id}/retour`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantiteRecuperee, quantitePerdue }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Une erreur est survenue.')
        return
      }
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <p className="section-subtitle">{dossier.quantiteEnvoyee} pièce(s) envoyée(s) depuis la fabrication {dossier.fabricationNumero}.</p>
      <div className="form-row">
        <div className="form-field"><label>Récupérées</label><input required type="number" value={quantiteRecuperee} onChange={(event) => setQuantiteRecuperee(event.target.value)} /></div>
        <div className="form-field"><label>Irrécupérables (perdues)</label><input type="number" value={quantitePerdue} onChange={(event) => setQuantitePerdue(event.target.value)} /></div>
      </div>
      {!coherent && <p className="form-error">Le total ({total}) doit être égal à {dossier.quantiteEnvoyee} pièce(s) envoyée(s).</p>}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer le retour'}</button>
      </div>
    </form>
  )
}

export function DoctorRewinderView() {
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [indicateurs, setIndicateurs] = useState<Indicateurs | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [retourFor, setRetourFor] = useState<Dossier | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchJson<{ dossiers: Dossier[]; indicateurs: Indicateurs }>('/api/doctor-rewinder')
      .then((res) => {
        setDossiers(res.dossiers)
        setIndicateurs(res.indicateurs)
      })
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setRetourFor(null)
    setRefreshKey((value) => value + 1)
  }

  return (
    <AppShell breadcrumb="Production" section="Doctor Rewinder">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRODUCTION</p>
          <h1>Doctor Rewinder</h1>
          <p className="heading-subtitle">Retraitement des pièces défectueuses.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <MetricCard label="En cours" value={`${indicateurs?.encoursCount ?? 0}`} icon={Sparkles} tone="blue" />
        <MetricCard
          label="Taux de récupération"
          value={indicateurs?.tauxRecuperation !== null && indicateurs?.tauxRecuperation !== undefined ? `${(indicateurs.tauxRecuperation * 100).toFixed(0)} %` : '—'}
          icon={Percent}
          tone="green"
        />
        <MetricCard
          label="Ancienneté moyenne (en cours)"
          value={indicateurs?.ancienneteMoyenneJours !== null && indicateurs?.ancienneteMoyenneJours !== undefined ? `${indicateurs.ancienneteMoyenneJours} j` : '—'}
          icon={Clock}
          tone="orange"
        />
      </div>

      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Fabrication</th><th>Envoyé</th><th>Récupéré</th><th>Perdu</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && dossiers.length === 0 && <tr><td colSpan={6} className="table-empty">Aucun dossier Doctor Rewinder.</td></tr>}
              {dossiers.map((dossier) => (
                <tr key={dossier.id}>
                  <td data-label="Fabrication">{dossier.fabricationNumero}</td>
                  <td data-label="Envoyé">{dossier.quantiteEnvoyee}</td>
                  <td data-label="Récupéré">{dossier.quantiteRecuperee ?? '—'}</td>
                  <td data-label="Perdu">{dossier.quantitePerdue ?? '—'}</td>
                  <td data-label="Statut">
                    {dossier.statut === 'en_cours' ? <span className="badge badge-orange">En cours</span> : <span className="badge badge-green">Clôturé</span>}
                  </td>
                  <td>{dossier.statut === 'en_cours' && <button className="btn-ghost" onClick={() => setRetourFor(dossier)}>Retour</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={retourFor !== null} onClose={() => setRetourFor(null)} title="Retour Doctor Rewinder">
        {retourFor && <RetourForm dossier={retourFor} onDone={refresh} />}
      </Modal>
    </AppShell>
  )
}

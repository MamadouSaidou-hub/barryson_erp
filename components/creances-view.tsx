'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'
import { EncaisserForm } from '@/components/ventes-view'
import { authClient } from '@/lib/auth-client'

type Creance = {
  id: number
  numero: string
  clientName: string
  dateCommande: string
  echeance: string | null
  solde: number
  enRetard: boolean
  joursRetard: number
  niveauRelanceSuggere: 1 | 2 | 3 | null
  derniereRelance: { date: string; niveau: number } | null
}

type Relance = { id: number; niveau: number; canal: string; commentaire: string | null; date: string; auteurName: string }

const NIVEAU_BADGE: Record<1 | 2 | 3, string> = { 1: 'badge-orange', 2: 'badge-orange', 3: 'badge-red' }
const NIVEAU_LABEL: Record<1 | 2 | 3, string> = { 1: 'Relance niveau 1', 2: 'Relance niveau 2', 3: 'Relance niveau 3 — urgent' }

function RelancerForm({ creance, onDone }: { creance: Creance; onDone: () => void }) {
  const [niveau, setNiveau] = useState<1 | 2 | 3>(creance.niveauRelanceSuggere ?? 1)
  const [canal, setCanal] = useState('Téléphone')
  const [commentaire, setCommentaire] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [historique, setHistorique] = useState<Relance[] | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchJson<{ relances: Relance[] }>(`/api/ventes-commandes/${creance.id}/relances`).then((res) => setHistorique(res.relances))
  }, [creance.id])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ventes-commandes/${creance.id}/relances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ niveau, canal, commentaire: commentaire || undefined, date }),
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
      <p className="section-subtitle">{creance.joursRetard > 0 ? `En retard de ${creance.joursRetard} jour(s).` : 'Pas encore en retard.'}</p>
      <div className="form-row">
        <div className="form-field">
          <label>Niveau</label>
          <select value={niveau} onChange={(event) => setNiveau(Number(event.target.value) as 1 | 2 | 3)}>
            <option value={1}>Niveau 1</option>
            <option value={2}>Niveau 2</option>
            <option value={3}>Niveau 3 — urgent</option>
          </select>
        </div>
        <div className="form-field">
          <label>Canal</label>
          <select value={canal} onChange={(event) => setCanal(event.target.value)}>
            <option value="Téléphone">Téléphone</option>
            <option value="SMS">SMS</option>
            <option value="Email">Email</option>
            <option value="Visite">Visite</option>
          </select>
        </div>
      </div>
      <div className="form-field"><label>Date</label><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
      <div className="form-field"><label>Commentaire (optionnel)</label><input value={commentaire} onChange={(event) => setCommentaire(event.target.value)} /></div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer la relance'}</button>
      </div>

      {historique && historique.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p className="section-title">Historique</p>
          {historique.map((relance) => (
            <p key={relance.id} className="cell-secondary" style={{ margin: '4px 0' }}>
              {relance.date} — {NIVEAU_LABEL[relance.niveau as 1 | 2 | 3]} · {relance.canal}{relance.commentaire ? ` — ${relance.commentaire}` : ''} ({relance.auteurName})
            </p>
          ))}
        </div>
      )}
    </form>
  )
}

export function CreancesView() {
  const { data: session } = authClient.useSession()
  const role = (session?.user as { role?: string })?.role
  const readOnly = role === 'comptable'

  const [creances, setCreances] = useState<Creance[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [encaisserFor, setEncaisserFor] = useState<Creance | null>(null)
  const [relancerFor, setRelancerFor] = useState<Creance | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchJson<{ creances: Creance[] }>('/api/creances')
      .then((res) => setCreances(res.creances))
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setEncaisserFor(null)
    setRelancerFor(null)
    setRefreshKey((value) => value + 1)
  }

  const totalCreances = creances.reduce((sum, c) => sum + c.solde, 0)
  const totalEnRetard = creances.filter((c) => c.enRetard).reduce((sum, c) => sum + c.solde, 0)

  return (
    <AppShell breadcrumb="Ventes" section="Créances">
      <div className="page-heading">
        <div>
          <p className="eyebrow">VENTES</p>
          <h1>Créances</h1>
          <p className="heading-subtitle">Commandes clients avec un solde restant à encaisser.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <p className="metric-label">Total créances</p>
          <p className="metric-value">{formatMoney(totalCreances)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Dont en retard</p>
          <p className="metric-value" style={{ color: totalEnRetard > 0 ? 'var(--red)' : undefined }}>{formatMoney(totalEnRetard)}</p>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Numéro</th><th>Client</th><th>Date</th><th>Échéance</th><th>Solde</th><th></th></tr></thead>
            <tbody>
              {!loading && creances.length === 0 && <tr><td colSpan={6} className="table-empty">Aucune créance en cours.</td></tr>}
              {creances.map((creance) => (
                <tr key={creance.id}>
                  <td data-label="Numéro">{creance.numero}</td>
                  <td data-label="Client">{creance.clientName}</td>
                  <td data-label="Date" className="cell-secondary">{creance.dateCommande}</td>
                  <td data-label="Échéance">
                    {creance.echeance ?? '—'}
                    {creance.enRetard && <span className="badge badge-red" style={{ marginLeft: 6 }}>En retard</span>}
                    {creance.niveauRelanceSuggere && <span className={`badge ${NIVEAU_BADGE[creance.niveauRelanceSuggere]}`} style={{ marginLeft: 6 }}>{NIVEAU_LABEL[creance.niveauRelanceSuggere]}</span>}
                  </td>
                  <td data-label="Solde" style={{ fontWeight: 700 }}>{formatMoney(creance.solde)}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!readOnly && <button className="btn-ghost" onClick={() => setEncaisserFor(creance)}>Encaisser</button>}
                    {!readOnly && <button className="btn-ghost" onClick={() => setRelancerFor(creance)}>Relancer</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={encaisserFor !== null} onClose={() => setEncaisserFor(null)} title={`Encaisser — ${encaisserFor?.numero ?? ''}`}>
        {encaisserFor && <EncaisserForm commandeId={encaisserFor.id} solde={encaisserFor.solde} onDone={refresh} />}
      </Modal>
      <Modal open={relancerFor !== null} onClose={() => setRelancerFor(null)} title={`Relancer — ${relancerFor?.numero ?? ''}`}>
        {relancerFor && <RelancerForm creance={relancerFor} onDone={refresh} />}
      </Modal>
    </AppShell>
  )
}

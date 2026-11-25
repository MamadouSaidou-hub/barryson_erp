'use client'

import { useEffect, useState } from 'react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'

type SalaireRow = {
  employeId: number
  code: string
  name: string
  poste: string
  active: boolean
  salaireBase: number | null
  payeCeMois: number
}

type PaiementSalaire = { id: number; montant: number; periode: string; methode: string; date: string }

function periodeCourante() {
  return new Date().toISOString().slice(0, 7)
}

function SalaireBaseForm({ row, onDone }: { row: SalaireRow; onDone: () => void }) {
  const [salaireBase, setSalaireBase] = useState(row.salaireBase?.toString() ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/salaires/${row.employeId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ salaireBase }),
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
      <div className="form-field"><label>Salaire de base (GNF)</label><input required type="number" value={salaireBase} onChange={(event) => setSalaireBase(event.target.value)} /></div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

function PaiementSalaireForm({ row, onDone }: { row: SalaireRow; onDone: () => void }) {
  const [montant, setMontant] = useState(row.salaireBase ? String(row.salaireBase) : '')
  const [periode, setPeriode] = useState(periodeCourante())
  const [methode, setMethode] = useState('Virement')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/salaires/${row.employeId}/paiements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montant, periode, methode, date }),
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
      <div className="form-row">
        <div className="form-field"><label>Montant (GNF)</label><input required type="number" value={montant} onChange={(event) => setMontant(event.target.value)} /></div>
        <div className="form-field"><label>Période (AAAA-MM)</label><input required type="month" value={periode} onChange={(event) => setPeriode(event.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Mode de règlement</label>
          <select value={methode} onChange={(event) => setMethode(event.target.value)}>
            <option value="Virement">Virement</option>
            <option value="Espèces">Espèces</option>
            <option value="Mobile money">Mobile money</option>
          </select>
        </div>
        <div className="form-field"><label>Date</label><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer le paiement'}</button>
      </div>
    </form>
  )
}

export function SalairesView() {
  const [salaires, setSalaires] = useState<SalaireRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [editingSalaire, setEditingSalaire] = useState<SalaireRow | null>(null)
  const [payerFor, setPayerFor] = useState<SalaireRow | null>(null)
  const [historiqueFor, setHistoriqueFor] = useState<SalaireRow | null>(null)
  const [historique, setHistorique] = useState<PaiementSalaire[] | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchJson<{ salaires: SalaireRow[] }>('/api/salaires')
      .then((res) => setSalaires(res.salaires))
      .finally(() => setLoading(false))
  }, [refreshKey])

  useEffect(() => {
    if (!historiqueFor) {
      setHistorique(null)
      return
    }
    fetchJson<{ paiements: PaiementSalaire[] }>(`/api/salaires/${historiqueFor.employeId}/paiements`).then((res) => setHistorique(res.paiements))
  }, [historiqueFor])

  function refresh() {
    setEditingSalaire(null)
    setPayerFor(null)
    setRefreshKey((value) => value + 1)
  }

  return (
    <AppShell breadcrumb="RH" section="Salaires">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RH</p>
          <h1>Salaires</h1>
          <p className="heading-subtitle">Salaire de base et paiements par employé — confidentiel.</p>
        </div>
      </div>

      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Nom</th><th>Poste</th><th>Salaire de base</th><th>Payé ce mois</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && salaires.length === 0 && <tr><td colSpan={5} className="table-empty">Aucun employé.</td></tr>}
              {salaires.map((row) => (
                <tr key={row.employeId}>
                  <td>{row.name}{!row.active && <span className="badge badge-muted" style={{ marginLeft: 6 }}>Inactif</span>}</td>
                  <td>{row.poste}</td>
                  <td>{row.salaireBase ? formatMoney(row.salaireBase) : '—'}</td>
                  <td>{formatMoney(row.payeCeMois)}</td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn-ghost" onClick={() => setEditingSalaire(row)}>{row.salaireBase ? 'Modifier' : 'Définir le salaire'}</button>
                    {row.salaireBase && <button className="btn-ghost" onClick={() => setPayerFor(row)}>Payer</button>}
                    <button className="btn-ghost" onClick={() => setHistoriqueFor(row)}>Historique</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={editingSalaire !== null} onClose={() => setEditingSalaire(null)} title={`Salaire de base — ${editingSalaire?.name ?? ''}`}>
        {editingSalaire && <SalaireBaseForm row={editingSalaire} onDone={refresh} />}
      </Modal>
      <Modal open={payerFor !== null} onClose={() => setPayerFor(null)} title={`Payer — ${payerFor?.name ?? ''}`}>
        {payerFor && <PaiementSalaireForm row={payerFor} onDone={refresh} />}
      </Modal>
      <Modal open={historiqueFor !== null} onClose={() => setHistoriqueFor(null)} title={`Historique — ${historiqueFor?.name ?? ''}`} wide>
        <div className="table-panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Période</th><th>Montant</th><th>Mode</th></tr></thead>
              <tbody>
                {historique && historique.length === 0 && <tr><td colSpan={4} className="table-empty">Aucun paiement enregistré.</td></tr>}
                {historique?.map((paiement) => (
                  <tr key={paiement.id}>
                    <td>{paiement.date}</td>
                    <td>{paiement.periode}</td>
                    <td>{formatMoney(paiement.montant)}</td>
                    <td>{paiement.methode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>
    </AppShell>
  )
}

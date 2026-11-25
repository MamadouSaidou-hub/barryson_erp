'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'

type Employe = {
  id: number
  code: string
  name: string
  poste: string
  phone: string | null
  email: string | null
  dateEmbauche: string | null
  active: boolean
}

function NewEmployeForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [poste, setPoste] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [dateEmbauche, setDateEmbauche] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/employes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          poste,
          phone: phone || undefined,
          email: email || undefined,
          dateEmbauche: dateEmbauche || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Une erreur est survenue.')
        return
      }
      onCreated()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-field"><label>Nom</label><input required value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="form-field"><label>Poste</label><input required value={poste} onChange={(event) => setPoste(event.target.value)} /></div>
      <div className="form-row">
        <div className="form-field"><label>Téléphone (optionnel)</label><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
        <div className="form-field"><label>E-mail (optionnel)</label><input value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      </div>
      <div className="form-field"><label>Date d&apos;embauche (optionnel)</label><input type="date" value={dateEmbauche} onChange={(event) => setDateEmbauche(event.target.value)} /></div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer'}</button>
      </div>
    </form>
  )
}

function EditEmployeForm({ employe, onDone, onClose }: { employe: Employe; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState(employe.name)
  const [poste, setPoste] = useState(employe.poste)
  const [phone, setPhone] = useState(employe.phone ?? '')
  const [email, setEmail] = useState(employe.email ?? '')
  const [dateEmbauche, setDateEmbauche] = useState(employe.dateEmbauche ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/employes/${employe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, poste, phone, email, dateEmbauche: dateEmbauche || null }),
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

  async function handleToggleActive() {
    setSubmitting(true)
    try {
      await fetch(`/api/employes/${employe.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !employe.active }),
      })
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-field"><label>Nom</label><input required value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="form-field"><label>Poste</label><input required value={poste} onChange={(event) => setPoste(event.target.value)} /></div>
      <div className="form-row">
        <div className="form-field"><label>Téléphone</label><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
        <div className="form-field"><label>E-mail</label><input value={email} onChange={(event) => setEmail(event.target.value)} /></div>
      </div>
      <div className="form-field"><label>Date d&apos;embauche</label><input type="date" value={dateEmbauche} onChange={(event) => setDateEmbauche(event.target.value)} /></div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={handleToggleActive} disabled={submitting}>
          {employe.active ? 'Désactiver' : 'Réactiver'}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

export function EmployesView() {
  const [employes, setEmployes] = useState<Employe[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<Employe | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchJson<{ employes: Employe[] }>('/api/employes')
      .then((res) => setEmployes(res.employes))
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setNewOpen(false)
    setEditing(null)
    setRefreshKey((value) => value + 1)
  }

  return (
    <AppShell breadcrumb="RH" section="Employés">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RH</p>
          <h1>Employés</h1>
          <p className="heading-subtitle">La liste des employés de l&apos;usine.</p>
        </div>
      </div>
      <div className="toolbar-panel" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} /> Nouvel employé</button>
      </div>
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Nom</th><th>Poste</th><th>Téléphone</th><th>E-mail</th><th>Embauché le</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && employes.length === 0 && <tr><td colSpan={8} className="table-empty">Aucun employé. Cliquez sur "Nouvel employé" pour en créer un.</td></tr>}
              {employes.map((employe) => (
                <tr key={employe.id}>
                  <td>{employe.code}</td>
                  <td>{employe.name}</td>
                  <td>{employe.poste}</td>
                  <td>{employe.phone ?? '—'}</td>
                  <td>{employe.email ?? '—'}</td>
                  <td>{employe.dateEmbauche ?? '—'}</td>
                  <td><span className={`badge ${employe.active ? 'badge-green' : 'badge-muted'}`}>{employe.active ? 'Actif' : 'Inactif'}</span></td>
                  <td><button className="btn-ghost" onClick={() => setEditing(employe)}>Modifier</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nouvel employé">
        <NewEmployeForm onCreated={refresh} />
      </Modal>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier l'employé">
        {editing && <EditEmployeForm employe={editing} onDone={refresh} onClose={() => setEditing(null)} />}
      </Modal>
    </AppShell>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'

type Fournisseur = {
  id: number
  code: string
  name: string
  country: string | null
  phone: string | null
  email: string | null
  address: string | null
  paymentTerms: string | null
  leadTimeDays: number | null
  active: boolean
}

type CommandeRow = {
  id: number
  numero: string
  fournisseurId: number
  devise: string
  etat: string
  total: number
  createdAt: string
}

const ETAT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  commandee: 'Commandée',
  partiellement_recue: 'Partiellement reçue',
  recue: 'Reçue',
  soldee: 'Soldée',
  annulee: 'Annulée',
}

function NewFournisseurForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [leadTimeDays, setLeadTimeDays] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/fournisseurs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          country: country || undefined,
          phone: phone || undefined,
          email: email || undefined,
          address: address || undefined,
          paymentTerms: paymentTerms || undefined,
          leadTimeDays: leadTimeDays || undefined,
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
      <div className="form-row">
        <div className="form-field"><label>Pays (optionnel)</label><input value={country} onChange={(event) => setCountry(event.target.value)} /></div>
        <div className="form-field"><label>Téléphone (optionnel)</label><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label>E-mail (optionnel)</label><input value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="form-field"><label>Délai de livraison en jours (optionnel)</label><input type="number" value={leadTimeDays} onChange={(event) => setLeadTimeDays(event.target.value)} /></div>
      </div>
      <div className="form-field"><label>Adresse (optionnel)</label><input value={address} onChange={(event) => setAddress(event.target.value)} /></div>
      <div className="form-field"><label>Conditions de paiement (optionnel)</label><input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} /></div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer'}</button>
      </div>
    </form>
  )
}

function EditFournisseurForm({ fournisseur, onDone, onClose }: { fournisseur: Fournisseur; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState(fournisseur.name)
  const [country, setCountry] = useState(fournisseur.country ?? '')
  const [phone, setPhone] = useState(fournisseur.phone ?? '')
  const [email, setEmail] = useState(fournisseur.email ?? '')
  const [address, setAddress] = useState(fournisseur.address ?? '')
  const [paymentTerms, setPaymentTerms] = useState(fournisseur.paymentTerms ?? '')
  const [leadTimeDays, setLeadTimeDays] = useState(fournisseur.leadTimeDays?.toString() ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/fournisseurs/${fournisseur.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, country, phone, email, address, paymentTerms, leadTimeDays: leadTimeDays || null }),
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
      await fetch(`/api/fournisseurs/${fournisseur.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !fournisseur.active }),
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
      <div className="form-row">
        <div className="form-field"><label>Pays</label><input value={country} onChange={(event) => setCountry(event.target.value)} /></div>
        <div className="form-field"><label>Téléphone</label><input value={phone} onChange={(event) => setPhone(event.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label>E-mail</label><input value={email} onChange={(event) => setEmail(event.target.value)} /></div>
        <div className="form-field"><label>Délai de livraison en jours</label><input type="number" value={leadTimeDays} onChange={(event) => setLeadTimeDays(event.target.value)} /></div>
      </div>
      <div className="form-field"><label>Adresse</label><input value={address} onChange={(event) => setAddress(event.target.value)} /></div>
      <div className="form-field"><label>Conditions de paiement</label><input value={paymentTerms} onChange={(event) => setPaymentTerms(event.target.value)} /></div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={handleToggleActive} disabled={submitting}>
          {fournisseur.active ? 'Désactiver' : 'Réactiver'}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

export function FournisseursView() {
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [commandes, setCommandes] = useState<CommandeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<Fournisseur | null>(null)
  const [historyFor, setHistoryFor] = useState<Fournisseur | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ fournisseurs: Fournisseur[] }>('/api/fournisseurs'),
      fetchJson<{ commandes: CommandeRow[] }>('/api/commandes'),
    ])
      .then(([fournisseursRes, commandesRes]) => {
        setFournisseurs(fournisseursRes.fournisseurs)
        setCommandes(commandesRes.commandes)
      })
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setNewOpen(false)
    setEditing(null)
    setRefreshKey((value) => value + 1)
  }

  function commandeCount(fournisseurId: number) {
    return commandes.filter((c) => c.fournisseurId === fournisseurId).length
  }

  return (
    <AppShell breadcrumb="Réglages" section="Fournisseurs">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RÉGLAGES</p>
          <h1>Fournisseurs</h1>
          <p className="heading-subtitle">Les fournisseurs utilisés pour les commandes d&apos;achat.</p>
        </div>
      </div>
      <div className="toolbar-panel" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} /> Nouveau fournisseur</button>
      </div>
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Nom</th><th>Pays</th><th>Téléphone</th><th>E-mail</th><th>Commandes</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && fournisseurs.length === 0 && <tr><td colSpan={8} className="table-empty">Aucun fournisseur. Cliquez sur "Nouveau fournisseur" pour en créer un.</td></tr>}
              {fournisseurs.map((fournisseur) => (
                <tr key={fournisseur.id}>
                  <td>{fournisseur.code}</td>
                  <td>{fournisseur.name}</td>
                  <td>{fournisseur.country ?? '—'}</td>
                  <td>{fournisseur.phone ?? '—'}</td>
                  <td>{fournisseur.email ?? '—'}</td>
                  <td><button className="btn-ghost" onClick={() => setHistoryFor(fournisseur)}>{commandeCount(fournisseur.id)} commande(s)</button></td>
                  <td><span className={`badge ${fournisseur.active ? 'badge-green' : 'badge-muted'}`}>{fournisseur.active ? 'Actif' : 'Inactif'}</span></td>
                  <td><button className="btn-ghost" onClick={() => setEditing(fournisseur)}>Modifier</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nouveau fournisseur">
        <NewFournisseurForm onCreated={refresh} />
      </Modal>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier le fournisseur">
        {editing && <EditFournisseurForm fournisseur={editing} onDone={refresh} onClose={() => setEditing(null)} />}
      </Modal>
      <Modal open={historyFor !== null} onClose={() => setHistoryFor(null)} title={`Commandes — ${historyFor?.name ?? ''}`} wide>
        <div className="table-panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Numéro</th><th>État</th><th>Total</th><th>Date</th></tr></thead>
              <tbody>
                {historyFor && commandes.filter((c) => c.fournisseurId === historyFor.id).length === 0 && (
                  <tr><td colSpan={4} className="table-empty">Aucune commande pour ce fournisseur.</td></tr>
                )}
                {historyFor &&
                  commandes
                    .filter((c) => c.fournisseurId === historyFor.id)
                    .map((commande) => (
                      <tr key={commande.id}>
                        <td>{commande.numero}</td>
                        <td><span className="badge badge-muted">{ETAT_LABELS[commande.etat] ?? commande.etat}</span></td>
                        <td>{formatMoney(commande.total, commande.devise)}</td>
                        <td>{commande.createdAt?.slice(0, 10)}</td>
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

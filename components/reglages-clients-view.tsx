'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'

type Client = {
  id: number
  code: string
  name: string
  segment: string | null
  zone: string | null
  delaiPaiementJours: number | null
  plafondEncours: number | null
  active: boolean
}

type ArticleOption = { id: number; name: string; unit: string; level: string; active: boolean }
type Tarif = { articleId: number; articleName: string; articleUnit: string; prixUnitaire: number }

function TarifsClientModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const [articleOptions, setArticleOptions] = useState<ArticleOption[]>([])
  const [tarifs, setTarifs] = useState<Tarif[]>([])
  const [prix, setPrix] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([
      fetchJson<{ articles: ArticleOption[] }>('/api/articles'),
      fetchJson<{ tarifs: Tarif[] }>(`/api/clients/${client.id}/tarifs`),
    ]).then(([articlesRes, tarifsRes]) => {
      setArticleOptions(articlesRes.articles.filter((a) => a.active && a.level === 'produit_fini'))
      setTarifs(tarifsRes.tarifs)
      setPrix(Object.fromEntries(tarifsRes.tarifs.map((t) => [t.articleId, String(t.prixUnitaire)])))
      setLoading(false)
    })
  }, [client.id])

  async function handleSave(articleId: number) {
    const prixUnitaire = Number(prix[articleId])
    if (!Number.isFinite(prixUnitaire) || prixUnitaire < 0) return
    setSavingId(articleId)
    try {
      await fetch(`/api/clients/${client.id}/tarifs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ articleId, prixUnitaire }) })
      setTarifs((value) => {
        const article = articleOptions.find((a) => a.id === articleId)
        const next = value.filter((t) => t.articleId !== articleId)
        if (article) next.push({ articleId, articleName: article.name, articleUnit: article.unit, prixUnitaire })
        return next
      })
    } finally {
      setSavingId(null)
    }
  }

  async function handleRemove(articleId: number) {
    setSavingId(articleId)
    try {
      await fetch(`/api/clients/${client.id}/tarifs?articleId=${articleId}`, { method: 'DELETE' })
      setTarifs((value) => value.filter((t) => t.articleId !== articleId))
      setPrix((value) => ({ ...value, [articleId]: '' }))
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <p className="table-empty">Chargement...</p>

  return (
    <div>
      <p className="section-subtitle" style={{ marginBottom: 10 }}>
        Prix préremplis automatiquement pour {client.name} lors d&apos;une nouvelle commande — toujours modifiables à la main.
      </p>
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Produit fini</th><th>Prix (GNF)</th><th></th></tr></thead>
            <tbody>
              {articleOptions.map((article) => {
                const tarifExistant = tarifs.find((t) => t.articleId === article.id)
                return (
                  <tr key={article.id}>
                    <td>{article.name}</td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 120 }}
                        value={prix[article.id] ?? ''}
                        onChange={(event) => setPrix((value) => ({ ...value, [article.id]: event.target.value }))}
                        placeholder="Saisie libre"
                      />
                    </td>
                    <td style={{ display: 'flex', gap: 6 }}>
                      <button type="button" className="btn-ghost" disabled={savingId === article.id} onClick={() => handleSave(article.id)}>Enregistrer</button>
                      {tarifExistant && <button type="button" className="btn-ghost" disabled={savingId === article.id} onClick={() => handleRemove(article.id)}>Retirer</button>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={onClose}>Fermer</button>
      </div>
    </div>
  )
}

function NewClientForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [segment, setSegment] = useState('')
  const [zone, setZone] = useState('')
  const [delaiPaiementJours, setDelaiPaiementJours] = useState('')
  const [plafondEncours, setPlafondEncours] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, segment: segment || undefined, zone: zone || undefined, delaiPaiementJours: delaiPaiementJours || undefined, plafondEncours: plafondEncours || undefined }),
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
        <div className="form-field"><label>Segment (optionnel)</label><input value={segment} onChange={(event) => setSegment(event.target.value)} placeholder="Entreprise, revendeur..." /></div>
        <div className="form-field"><label>Zone (optionnel)</label><input value={zone} onChange={(event) => setZone(event.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label>Délai de paiement (jours, optionnel)</label><input type="number" value={delaiPaiementJours} onChange={(event) => setDelaiPaiementJours(event.target.value)} /></div>
        <div className="form-field"><label>Plafond d&apos;encours (GNF, optionnel)</label><input type="number" value={plafondEncours} onChange={(event) => setPlafondEncours(event.target.value)} /></div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer'}</button>
      </div>
    </form>
  )
}

function EditClientForm({ client, onDone, onClose }: { client: Client; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState(client.name)
  const [segment, setSegment] = useState(client.segment ?? '')
  const [zone, setZone] = useState(client.zone ?? '')
  const [delaiPaiementJours, setDelaiPaiementJours] = useState(client.delaiPaiementJours?.toString() ?? '')
  const [plafondEncours, setPlafondEncours] = useState(client.plafondEncours?.toString() ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, segment, zone, delaiPaiementJours: delaiPaiementJours === '' ? null : delaiPaiementJours, plafondEncours: plafondEncours === '' ? null : plafondEncours }),
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
      await fetch(`/api/clients/${client.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !client.active }) })
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
        <div className="form-field"><label>Segment</label><input value={segment} onChange={(event) => setSegment(event.target.value)} /></div>
        <div className="form-field"><label>Zone</label><input value={zone} onChange={(event) => setZone(event.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label>Délai de paiement (jours)</label><input type="number" value={delaiPaiementJours} onChange={(event) => setDelaiPaiementJours(event.target.value)} /></div>
        <div className="form-field"><label>Plafond d&apos;encours (GNF)</label><input type="number" value={plafondEncours} onChange={(event) => setPlafondEncours(event.target.value)} /></div>
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={handleToggleActive} disabled={submitting}>{client.active ? 'Désactiver' : 'Réactiver'}</button>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

export function ClientsView() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [tarifsFor, setTarifsFor] = useState<Client | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchJson<{ clients: Client[] }>('/api/clients')
      .then((res) => setClients(res.clients))
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setNewOpen(false)
    setEditing(null)
    setRefreshKey((value) => value + 1)
  }

  return (
    <AppShell breadcrumb="Réglages" section="Clients">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RÉGLAGES</p>
          <h1>Clients</h1>
          <p className="heading-subtitle">Les clients utilisés pour les commandes de vente.</p>
        </div>
      </div>
      <div className="toolbar-panel" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} /> Nouveau client</button>
      </div>
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Nom</th><th>Segment</th><th>Zone</th><th>Délai paiement</th><th>Plafond d&apos;encours</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && clients.length === 0 && <tr><td colSpan={8} className="table-empty">Aucun client. Cliquez sur &quot;Nouveau client&quot; pour en créer un.</td></tr>}
              {clients.map((client) => (
                <tr key={client.id}>
                  <td>{client.code}</td>
                  <td>{client.name}</td>
                  <td className="cell-secondary">{client.segment ?? '—'}</td>
                  <td className="cell-secondary">{client.zone ?? '—'}</td>
                  <td className="cell-secondary">{client.delaiPaiementJours ? `${client.delaiPaiementJours} j` : '—'}</td>
                  <td>{client.plafondEncours ? formatMoney(client.plafondEncours) : '—'}</td>
                  <td><span className={`badge ${client.active ? 'badge-green' : 'badge-muted'}`}>{client.active ? 'Actif' : 'Inactif'}</span></td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button className="btn-ghost" onClick={() => setEditing(client)}>Modifier</button>
                    <button className="btn-ghost" onClick={() => setTarifsFor(client)}>Tarifs</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nouveau client">
        <NewClientForm onCreated={refresh} />
      </Modal>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier le client">
        {editing && <EditClientForm client={editing} onDone={refresh} onClose={() => setEditing(null)} />}
      </Modal>
      <Modal open={tarifsFor !== null} onClose={() => setTarifsFor(null)} title={`Tarifs — ${tarifsFor?.name ?? ''}`} wide>
        {tarifsFor && <TarifsClientModal client={tarifsFor} onClose={() => setTarifsFor(null)} />}
      </Modal>
    </AppShell>
  )
}

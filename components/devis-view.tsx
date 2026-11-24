'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'

type DevisRow = {
  id: number
  numero: string
  clientName: string
  commercial: string | null
  dateDevis: string
  validiteJours: number | null
  etat: 'brouillon' | 'accepte' | 'refuse'
  commandeClientId: number | null
  total: number
  expire: boolean
}

type ArticleOption = { id: number; name: string; unit: string; level: string; active: boolean }
type ClientOption = { id: number; name: string }

const ETAT_LABELS: Record<DevisRow['etat'], string> = { brouillon: 'Brouillon', accepte: 'Accepté', refuse: 'Refusé' }
const ETAT_BADGES: Record<DevisRow['etat'], string> = { brouillon: 'badge-muted', accepte: 'badge-green', refuse: 'badge-red' }

type Ligne = { key: string; articleId: number; nomAffiche: string; quantite: string; prixUnitaire: string; unit: string }

function DevisForm({ onSubmit, submitLabel }: { onSubmit: (payload: Record<string, unknown>) => Promise<string | void>; submitLabel: string }) {
  const [articleOptions, setArticleOptions] = useState<ArticleOption[]>([])
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([])
  const [clientId, setClientId] = useState(0)
  const [articleChoice, setArticleChoice] = useState(0)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [moreOpen, setMoreOpen] = useState(false)
  const [commercial, setCommercial] = useState('')
  const [validiteJours, setValiditeJours] = useState('30')
  const [reference, setReference] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchJson<{ articles: ArticleOption[] }>('/api/articles'),
      fetchJson<{ clients: ClientOption[] }>('/api/clients?actifs=1'),
    ]).then(([articlesRes, clientsRes]) => {
      const produitsFinis = articlesRes.articles.filter((a) => a.active && a.level === 'produit_fini')
      setArticleOptions(produitsFinis)
      setClientOptions(clientsRes.clients)
      if (produitsFinis[0]) setArticleChoice(produitsFinis[0].id)
      if (clientsRes.clients[0]) setClientId(clientsRes.clients[0].id)
    })
  }, [])

  function addLigne() {
    const article = articleOptions.find((a) => a.id === articleChoice)
    if (!article) return
    setLignes((value) => [...value, { key: `${Date.now()}-${Math.random()}`, articleId: article.id, nomAffiche: article.name, quantite: '1', prixUnitaire: '', unit: article.unit }])
  }

  function updateLigne(key: string, patch: Partial<Ligne>) {
    setLignes((value) => value.map((ligne) => (ligne.key === key ? { ...ligne, ...patch } : ligne)))
  }

  function removeLigne(key: string) {
    setLignes((value) => value.filter((ligne) => ligne.key !== key))
  }

  const total = lignes.reduce((sum, ligne) => sum + (Number(ligne.quantite) || 0) * (Number(ligne.prixUnitaire) || 0), 0)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (!clientId) {
      setError('Choisissez un client.')
      return
    }
    if (lignes.length === 0) {
      setError('Ajoutez au moins une ligne.')
      return
    }
    setSubmitting(true)
    try {
      const result = await onSubmit({
        clientId,
        commercial: commercial || undefined,
        validiteJours: validiteJours || undefined,
        reference: reference || undefined,
        commentaire: commentaire || undefined,
        lignes: lignes.map((ligne) => ({ articleId: ligne.articleId, nomAffiche: ligne.nomAffiche, quantite: Number(ligne.quantite), prixUnitaire: Number(ligne.prixUnitaire) })),
      })
      if (result) setError(result)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-field">
        <label>Client</label>
        <select value={clientId} onChange={(event) => setClientId(Number(event.target.value))}>
          <option value={0}>— Choisir —</option>
          {clientOptions.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
        </select>
      </div>

      <p className="section-title" style={{ marginTop: 16 }}>Produits</p>
      <div className="form-row">
        <div className="form-field">
          <label>Produit fini</label>
          <select value={articleChoice} onChange={(event) => setArticleChoice(Number(event.target.value))}>
            {articleOptions.map((article) => <option key={article.id} value={article.id}>{article.name}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ flexDirection: 'row', display: 'flex', alignItems: 'end' }}>
          <button type="button" className="btn-secondary" onClick={addLigne} style={{ marginBottom: 14 }}>Ajouter</button>
        </div>
      </div>

      {lignes.map((ligne) => (
        <div key={ligne.key} className="table-panel" style={{ padding: 12, marginBottom: 10 }}>
          <div className="form-row">
            <div className="form-field"><label>Quantité ({ligne.unit})</label><input type="number" value={ligne.quantite} onChange={(event) => updateLigne(ligne.key, { quantite: event.target.value })} /></div>
            <div className="form-field"><label>Prix unitaire (GNF)</label><input type="number" value={ligne.prixUnitaire} onChange={(event) => updateLigne(ligne.key, { prixUnitaire: event.target.value })} /></div>
          </div>
          <button type="button" className="btn-ghost" onClick={() => removeLigne(ligne.key)}>Retirer cette ligne</button>
        </div>
      ))}
      {lignes.length === 0 && <p className="table-empty">Aucune ligne pour l&apos;instant.</p>}

      <div className="total-row">
        <span>Total</span>
        <strong>{formatMoney(total)}</strong>
      </div>

      <div className="form-field" style={{ marginTop: 10 }}>
        <label>Validité (jours, optionnel — laisser vide si pas de date d&apos;expiration)</label>
        <input type="number" value={validiteJours} onChange={(event) => setValiditeJours(event.target.value)} />
      </div>

      <button type="button" className="btn-ghost" onClick={() => setMoreOpen((value) => !value)} style={{ display: 'block', marginTop: 10, marginBottom: 10 }}>
        {moreOpen ? 'Moins d’options' : 'Plus d’options'}
      </button>
      {moreOpen && (
        <>
          <div className="form-field"><label>Commercial (optionnel)</label><input value={commercial} onChange={(event) => setCommercial(event.target.value)} /></div>
          <div className="form-field"><label>Référence (optionnel)</label><input value={reference} onChange={(event) => setReference(event.target.value)} /></div>
          <div className="form-field"><label>Commentaire (optionnel)</label><input value={commentaire} onChange={(event) => setCommentaire(event.target.value)} /></div>
        </>
      )}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : submitLabel}</button>
      </div>
    </form>
  )
}

export function DevisView() {
  const [rows, setRows] = useState<DevisRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newOpen, setNewOpen] = useState(false)
  const [notice, setNotice] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchJson<{ devis: DevisRow[] }>('/api/devis')
      .then((res) => setRows(res.devis))
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setNewOpen(false)
    setRefreshKey((value) => value + 1)
  }

  async function handleAccepter(id: number) {
    const res = await fetch(`/api/devis/${id}/accepter`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? 'Une erreur est survenue.')
      return
    }
    setNotice(`Devis accepté → commande ${json.commande.numero} créée.`)
    refresh()
  }

  async function handleRefuser(id: number) {
    if (!confirm('Refuser ce devis ?')) return
    const res = await fetch(`/api/devis/${id}/refuser`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const json = await res.json()
    if (!res.ok) alert(json.error ?? 'Une erreur est survenue.')
    refresh()
  }

  return (
    <AppShell breadcrumb="Devis" section="Devis">
      <div className="page-heading">
        <div>
          <p className="eyebrow">VENTES</p>
          <h1>Devis</h1>
        </div>
      </div>
      {notice && (
        <div className="table-panel" style={{ padding: 12, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{notice} <a href="/ventes" className="text-link">Voir dans Ventes</a></span>
          <button className="btn-ghost" onClick={() => setNotice('')}>Fermer</button>
        </div>
      )}
      <div className="toolbar-panel" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} /> Nouveau devis</button>
      </div>
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Numéro</th><th>Client</th><th>Total</th><th>État</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && rows.length === 0 && <tr><td colSpan={5} className="table-empty">Aucun devis.</td></tr>}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.numero}</td>
                  <td>{row.clientName}{row.commercial ? ` · ${row.commercial}` : ''}</td>
                  <td>{formatMoney(row.total)}</td>
                  <td>
                    <span className={`badge ${ETAT_BADGES[row.etat]}`}>{ETAT_LABELS[row.etat]}</span>
                    {row.expire && <span className="badge badge-red" style={{ marginLeft: 6 }}>Expiré</span>}
                  </td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {row.etat === 'brouillon' && !row.expire && <button className="btn-ghost" onClick={() => handleAccepter(row.id)}>Accepter → commande</button>}
                    {row.etat === 'brouillon' && <button className="btn-ghost" onClick={() => handleRefuser(row.id)}>Refuser</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nouveau devis" wide>
        <DevisForm
          submitLabel="Enregistrer le devis"
          onSubmit={async (payload) => {
            const res = await fetch('/api/devis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            const json = await res.json()
            if (!res.ok) return json.error ?? 'Une erreur est survenue.'
            refresh()
          }}
        />
      </Modal>
    </AppShell>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'
import { authClient } from '@/lib/auth-client'

type CommandeRow = {
  id: number
  numero: string
  clientName: string
  commercial: string | null
  dateCommande: string
  etat: 'brouillon' | 'confirmee' | 'partiellement_livree' | 'livree' | 'annulee'
  total: number
  totalPaye: number
  solde: number
  echeance: string | null
  enRetard: boolean
}

type ArticleOption = { id: number; name: string; unit: string; level: string; active: boolean }
type ClientOption = { id: number; name: string }

const ETAT_LABELS: Record<CommandeRow['etat'], string> = {
  brouillon: 'Brouillon',
  confirmee: 'Confirmée',
  partiellement_livree: 'Partiellement livrée',
  livree: 'Livrée',
  annulee: 'Annulée',
}
const ETAT_BADGES: Record<CommandeRow['etat'], string> = {
  brouillon: 'badge-muted',
  confirmee: 'badge-blue',
  partiellement_livree: 'badge-orange',
  livree: 'badge-green',
  annulee: 'badge-red',
}

type Ligne = { key: string; articleId: number; nomAffiche: string; quantite: string; prixUnitaire: string; unit: string }

function CommandeForm({ onSubmit, submitLabel }: { onSubmit: (payload: Record<string, unknown>) => Promise<string | void>; submitLabel: string }) {
  const [articleOptions, setArticleOptions] = useState<ArticleOption[]>([])
  const [clientOptions, setClientOptions] = useState<ClientOption[]>([])
  const [clientId, setClientId] = useState(0)
  const [articleChoice, setArticleChoice] = useState(0)
  const [lignes, setLignes] = useState<Ligne[]>([])
  const [tarifsClient, setTarifsClient] = useState<Record<number, number>>({})
  const [moreOpen, setMoreOpen] = useState(false)
  const [commercial, setCommercial] = useState('')
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

  useEffect(() => {
    if (!clientId) {
      setTarifsClient({})
      return
    }
    fetchJson<{ tarifs: { articleId: number; prixUnitaire: number }[] }>(`/api/clients/${clientId}/tarifs`).then((res) => {
      setTarifsClient(Object.fromEntries(res.tarifs.map((t) => [t.articleId, t.prixUnitaire])))
    })
  }, [clientId])

  function addLigne() {
    const article = articleOptions.find((a) => a.id === articleChoice)
    if (!article) return
    const prixTarif = tarifsClient[article.id]
    setLignes((value) => [...value, { key: `${Date.now()}-${Math.random()}`, articleId: article.id, nomAffiche: article.name, quantite: '1', prixUnitaire: prixTarif !== undefined ? String(prixTarif) : '', unit: article.unit }])
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

      <button type="button" className="btn-ghost" onClick={() => setMoreOpen((value) => !value)} style={{ display: 'block', marginTop: 10, marginBottom: 10 }}>
        {moreOpen ? 'Moins d’options' : 'Plus d’options'}
      </button>
      {moreOpen && (
        <>
          <div className="form-field"><label>Commercial (optionnel — vente de terrain)</label><input value={commercial} onChange={(event) => setCommercial(event.target.value)} /></div>
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

function LivrerForm({ commandeId, onDone }: { commandeId: number; onDone: () => void }) {
  const [lignes, setLignes] = useState<{ id: number; nomAffiche: string; unit: string; commande: number; dejaLivre: number; aLivrer: string }[] | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchJson<{ commande: { lignes: { id: number; nomAffiche: string; articleUnit: string; quantite: number; quantiteLivree: number }[] } }>(`/api/ventes-commandes/${commandeId}`).then((res) => {
      setLignes(
        res.commande.lignes.map((ligne) => {
          const reste = ligne.quantite - ligne.quantiteLivree
          return { id: ligne.id, nomAffiche: ligne.nomAffiche, unit: ligne.articleUnit, commande: ligne.quantite, dejaLivre: ligne.quantiteLivree, aLivrer: reste > 0 ? String(reste) : '0' }
        }),
      )
    })
  }, [commandeId])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (!lignes) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ventes-commandes/${commandeId}/livraisons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lignes: lignes.map((ligne) => ({ commandeClientLigneId: ligne.id, quantiteLivree: Number(ligne.aLivrer) || 0 })) }),
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

  if (!lignes) return <p className="table-empty">Chargement...</p>

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Produit</th><th>Commandé</th><th>Déjà livré</th><th>À livrer</th></tr></thead>
            <tbody>
              {lignes.map((ligne, index) => (
                <tr key={ligne.id}>
                  <td>{ligne.nomAffiche}</td>
                  <td>{ligne.commande} {ligne.unit}</td>
                  <td>{ligne.dejaLivre} {ligne.unit}</td>
                  <td>
                    <input
                      type="number"
                      style={{ width: 90 }}
                      value={ligne.aLivrer}
                      onChange={(event) => setLignes((value) => value!.map((l, i) => (i === index ? { ...l, aLivrer: event.target.value } : l)))}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer la livraison'}</button>
      </div>
    </form>
  )
}

export function EncaisserForm({ commandeId, solde, onDone }: { commandeId: number; solde: number; onDone: () => void }) {
  const [montant, setMontant] = useState(solde > 0 ? String(solde) : '')
  const [methode, setMethode] = useState('Espèces')
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/ventes-commandes/${commandeId}/paiements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ montant, methode, date }),
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
      <p className="section-subtitle">Solde restant : {formatMoney(solde)}</p>
      <div className="form-row">
        <div className="form-field"><label>Montant (GNF)</label><input required type="number" value={montant} onChange={(event) => setMontant(event.target.value)} /></div>
        <div className="form-field">
          <label>Mode de règlement</label>
          <select value={methode} onChange={(event) => setMethode(event.target.value)}>
            <option value="Espèces">Espèces</option>
            <option value="Mobile money">Mobile money</option>
            <option value="Virement">Virement</option>
            <option value="Chèque">Chèque</option>
          </select>
        </div>
      </div>
      <div className="form-field"><label>Date</label><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Encaisser'}</button>
      </div>
    </form>
  )
}

export function VentesView() {
  const { data: session } = authClient.useSession()
  const role = (session?.user as { role?: string })?.role
  const readOnly = role === 'comptable'

  const [commandes, setCommandes] = useState<CommandeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newOpen, setNewOpen] = useState(false)
  const [livrerFor, setLivrerFor] = useState<CommandeRow | null>(null)
  const [encaisserFor, setEncaisserFor] = useState<CommandeRow | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchJson<{ commandes: CommandeRow[] }>('/api/ventes-commandes')
      .then((res) => setCommandes(res.commandes))
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setNewOpen(false)
    setLivrerFor(null)
    setEncaisserFor(null)
    setRefreshKey((value) => value + 1)
  }

  async function handleConfirmer(id: number) {
    const res = await fetch(`/api/ventes-commandes/${id}/confirmer`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) alert(json.error ?? 'Une erreur est survenue.')
    refresh()
  }

  async function handleAnnuler(id: number) {
    if (!confirm('Annuler cette commande ?')) return
    const res = await fetch(`/api/ventes-commandes/${id}/annuler`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const json = await res.json()
    if (!res.ok) alert(json.error ?? 'Une erreur est survenue.')
    refresh()
  }

  return (
    <AppShell breadcrumb="Ventes" section="Ventes">
      <div className="page-heading">
        <div>
          <p className="eyebrow">VENTES</p>
          <h1>Commandes clients</h1>
        </div>
      </div>
      {!readOnly && (
        <div className="toolbar-panel" style={{ justifyContent: 'flex-end' }}>
          <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} /> Nouvelle commande</button>
        </div>
      )}
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Numéro</th><th>Client</th><th>Total</th><th>Solde</th><th>État</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && commandes.length === 0 && <tr><td colSpan={6} className="table-empty">Aucune commande.</td></tr>}
              {commandes.map((commande) => (
                <tr key={commande.id}>
                  <td>{commande.numero}</td>
                  <td>{commande.clientName}{commande.commercial ? ` · ${commande.commercial}` : ''}</td>
                  <td>{formatMoney(commande.total)}</td>
                  <td>
                    {formatMoney(commande.solde)}
                    {commande.enRetard && <span className="badge badge-red" style={{ marginLeft: 6 }}>En retard</span>}
                  </td>
                  <td><span className={`badge ${ETAT_BADGES[commande.etat]}`}>{ETAT_LABELS[commande.etat]}</span></td>
                  <td style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!readOnly && commande.etat === 'brouillon' && <button className="btn-ghost" onClick={() => handleConfirmer(commande.id)}>Confirmer</button>}
                    {!readOnly && commande.etat === 'brouillon' && <button className="btn-ghost" onClick={() => handleAnnuler(commande.id)}>Annuler</button>}
                    {!readOnly && (commande.etat === 'confirmee' || commande.etat === 'partiellement_livree') && (
                      <button className="btn-ghost" onClick={() => setLivrerFor(commande)}>Livrer</button>
                    )}
                    {!readOnly && commande.solde > 0 && commande.etat !== 'brouillon' && commande.etat !== 'annulee' && (
                      <button className="btn-ghost" onClick={() => setEncaisserFor(commande)}>Encaisser</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {!readOnly && (
        <>
          <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nouvelle commande client" wide>
            <CommandeForm
              submitLabel="Enregistrer la commande"
              onSubmit={async (payload) => {
                const res = await fetch('/api/ventes-commandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
                const json = await res.json()
                if (!res.ok) return json.error ?? 'Une erreur est survenue.'
                refresh()
              }}
            />
          </Modal>
          <Modal open={livrerFor !== null} onClose={() => setLivrerFor(null)} title={`Livrer — ${livrerFor?.numero ?? ''}`} wide>
            {livrerFor && <LivrerForm commandeId={livrerFor.id} onDone={refresh} />}
          </Modal>
          <Modal open={encaisserFor !== null} onClose={() => setEncaisserFor(null)} title={`Encaisser — ${encaisserFor?.numero ?? ''}`}>
            {encaisserFor && <EncaisserForm commandeId={encaisserFor.id} solde={encaisserFor.solde} onDone={refresh} />}
          </Modal>
        </>
      )}
    </AppShell>
  )
}

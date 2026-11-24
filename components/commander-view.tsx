'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'
import { formatMoney } from '@/lib/format'

type CommandeRow = {
  id: number
  numero: string
  fournisseurName: string
  devise: string
  tauxChange: number | null
  etat: string
  dateArriveePrevue: string | null
  total: number
}

type CatalogueOption = {
  id: number
  articleId: number
  label: string
  finish: string | null
  usualPrice: number | null
  usualCurrency: string | null
  articleUnit: string
}

type ArticleOption = { id: number; name: string; unit: string; active: boolean }
type FournisseurOption = { id: number; name: string }

type Ligne = {
  key: string
  articleId: number
  catalogueProduitId?: number
  nomAffiche: string
  description: string
  quantite: string
  prixUnitaire: string
  finish: string
  unit: string
}

const ETAT_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  commandee: 'Commandée',
  partiellement_recue: 'Partiellement reçue',
  recue: 'Reçue',
  soldee: 'Soldée',
  annulee: 'Annulée',
}
const ETAT_BADGES: Record<string, string> = {
  brouillon: 'badge-muted',
  commandee: 'badge-blue',
  partiellement_recue: 'badge-orange',
  recue: 'badge-green',
  soldee: 'badge-green',
  annulee: 'badge-red',
}

function NewFournisseurMiniForm({ onCreated }: { onCreated: (fournisseur: FournisseurOption) => void }) {
  const [name, setName] = useState('')
  const [country, setCountry] = useState('')
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
        body: JSON.stringify({ name, country: country || undefined }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Une erreur est survenue.')
        return
      }
      onCreated(json.fournisseur)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-field"><label>Nom du fournisseur</label><input required value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="form-field"><label>Pays (optionnel)</label><input value={country} onChange={(event) => setCountry(event.target.value)} /></div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Création...' : 'Créer et utiliser'}</button>
      </div>
    </form>
  )
}

function CommandeForm({
  initial,
  onSubmit,
  submitLabel,
}: {
  initial?: { fournisseurId: number; devise: string; tauxChange?: number | null; dateArriveePrevue?: string | null; reference?: string | null; commentaire?: string | null; lignes: Ligne[] }
  onSubmit: (payload: Record<string, unknown>) => Promise<string | void>
  submitLabel: string
}) {
  const [catalogue, setCatalogue] = useState<CatalogueOption[]>([])
  const [articles, setArticles] = useState<ArticleOption[]>([])
  const [fournisseurs, setFournisseurs] = useState<FournisseurOption[]>([])
  const [lignes, setLignes] = useState<Ligne[]>(initial?.lignes ?? [])
  const [catalogueChoice, setCatalogueChoice] = useState(0)
  const [articleChoice, setArticleChoice] = useState(0)
  const [fournisseurId, setFournisseurId] = useState(initial?.fournisseurId ?? 0)
  const [devise, setDevise] = useState(initial?.devise ?? 'USD')
  const [moreOpen, setMoreOpen] = useState(false)
  const [tauxChange, setTauxChange] = useState(initial?.tauxChange?.toString() ?? '')
  const [dateArriveePrevue, setDateArriveePrevue] = useState(initial?.dateArriveePrevue ?? '')
  const [reference, setReference] = useState(initial?.reference ?? '')
  const [commentaire, setCommentaire] = useState(initial?.commentaire ?? '')
  const [newProduitOpen, setNewProduitOpen] = useState(false)
  const [newFournisseurOpen, setNewFournisseurOpen] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      fetchJson<{ catalogue: CatalogueOption[] }>('/api/catalogue?actifs=1'),
      fetchJson<{ articles: ArticleOption[] }>('/api/articles'),
      fetchJson<{ fournisseurs: FournisseurOption[] }>('/api/fournisseurs?actifs=1'),
    ]).then(([catalogueRes, articlesRes, fournisseursRes]) => {
      setCatalogue(catalogueRes.catalogue)
      setArticles(articlesRes.articles.filter((a) => a.active))
      setFournisseurs(fournisseursRes.fournisseurs)
      if (catalogueRes.catalogue[0]) setCatalogueChoice(catalogueRes.catalogue[0].id)
      if (articlesRes.articles[0]) setArticleChoice(articlesRes.articles[0].id)
    })
  }, [])

  function addFromCatalogue() {
    const item = catalogue.find((c) => c.id === catalogueChoice)
    if (!item) return
    setLignes((value) => [
      ...value,
      {
        key: `${Date.now()}-${Math.random()}`,
        articleId: item.articleId,
        catalogueProduitId: item.id,
        nomAffiche: item.label,
        description: '',
        quantite: '1',
        prixUnitaire: item.usualPrice?.toString() ?? '',
        finish: item.finish ?? '',
        unit: item.articleUnit,
      },
    ])
  }

  function addFromArticle() {
    const item = articles.find((a) => a.id === articleChoice)
    if (!item) return
    setLignes((value) => [
      ...value,
      { key: `${Date.now()}-${Math.random()}`, articleId: item.id, nomAffiche: item.name, description: '', quantite: '1', prixUnitaire: '', finish: '', unit: item.unit },
    ])
  }

  function updateLigne(key: string, patch: Partial<Ligne>) {
    setLignes((value) => value.map((ligne) => (ligne.key === key ? { ...ligne, ...patch } : ligne)))
  }

  function removeLigne(key: string) {
    setLignes((value) => value.filter((ligne) => ligne.key !== key))
  }

  const total = lignes.reduce((sum, ligne) => sum + (Number(ligne.quantite) || 0) * (Number(ligne.prixUnitaire) || 0), 0)
  const hasMissingPrice = lignes.some((ligne) => !ligne.prixUnitaire)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (lignes.length === 0) {
      setError('Ajoutez au moins une ligne.')
      return
    }
    if (!fournisseurId) {
      setError('Choisissez un fournisseur.')
      return
    }
    setSubmitting(true)
    try {
      const result = await onSubmit({
        fournisseurId,
        devise,
        tauxChange: tauxChange || undefined,
        dateArriveePrevue: dateArriveePrevue || undefined,
        reference: reference || undefined,
        commentaire: commentaire || undefined,
        lignes: lignes.map((ligne) => ({
          articleId: ligne.articleId,
          catalogueProduitId: ligne.catalogueProduitId,
          nomAffiche: ligne.nomAffiche,
          description: ligne.description || undefined,
          quantite: Number(ligne.quantite),
          prixUnitaire: ligne.prixUnitaire ? Number(ligne.prixUnitaire) : undefined,
          finish: ligne.finish || undefined,
        })),
      })
      if (result) setError(result)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}

      <p className="section-title">1. Produits</p>
      <div className="form-row">
        <div className="form-field">
          <label>Depuis le catalogue</label>
          <select value={catalogueChoice} onChange={(event) => setCatalogueChoice(Number(event.target.value))}>
            {catalogue.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ justifyContent: 'flex-end', flexDirection: 'row', display: 'flex', alignItems: 'end' }}>
          <button type="button" className="btn-secondary" onClick={addFromCatalogue} style={{ marginBottom: 14 }}>Ajouter</button>
        </div>
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Ou un autre article existant</label>
          <select value={articleChoice} onChange={(event) => setArticleChoice(Number(event.target.value))}>
            {articles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ flexDirection: 'row', display: 'flex', alignItems: 'end' }}>
          <button type="button" className="btn-secondary" onClick={addFromArticle} style={{ marginBottom: 14 }}>Ajouter</button>
        </div>
      </div>
      <button type="button" className="item-add-link" onClick={() => setNewProduitOpen(true)}><Plus size={13} /> Autre produit (pas dans la liste)</button>

      {lignes.map((ligne) => (
        <div key={ligne.key} className="table-panel" style={{ padding: 12, marginBottom: 10 }}>
          <div className="form-field"><label>Nom</label><input value={ligne.nomAffiche} onChange={(event) => updateLigne(ligne.key, { nomAffiche: event.target.value })} /></div>
          <div className="form-row">
            <div className="form-field"><label>Quantité ({ligne.unit})</label><input type="number" value={ligne.quantite} onChange={(event) => updateLigne(ligne.key, { quantite: event.target.value })} /></div>
            <div className="form-field"><label>Prix unitaire</label><input type="number" value={ligne.prixUnitaire} onChange={(event) => updateLigne(ligne.key, { prixUnitaire: event.target.value })} /></div>
          </div>
          <div className="form-row">
            <div className="form-field"><label>Finition (bobines, optionnel)</label><input value={ligne.finish} onChange={(event) => updateLigne(ligne.key, { finish: event.target.value })} /></div>
            <div className="form-field"><label>Description (optionnel)</label><input value={ligne.description} onChange={(event) => updateLigne(ligne.key, { description: event.target.value })} /></div>
          </div>
          <button type="button" className="btn-ghost" onClick={() => removeLigne(ligne.key)}>Retirer cette ligne</button>
        </div>
      ))}
      {lignes.length === 0 && <p className="table-empty">Aucune ligne pour l&apos;instant.</p>}

      <div className="total-row">
        <span>Total {hasMissingPrice ? '(partiel — prix manquant)' : ''}</span>
        <strong>
          {formatMoney(total, devise)}
          {Number(tauxChange) > 0 && <span style={{ color: 'var(--muted)', fontWeight: 400, marginLeft: 8 }}>≈ {formatMoney(total * Number(tauxChange), 'GNF')}</span>}
        </strong>
      </div>

      <p className="section-title" style={{ marginTop: 20 }}>2. Pour quel fournisseur ?</p>
      <div className="form-row">
        <div className="form-field">
          <label>Fournisseur</label>
          <select value={fournisseurId} onChange={(event) => setFournisseurId(Number(event.target.value))}>
            <option value={0}>— Choisir —</option>
            {fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label>Devise</label>
          <select value={devise} onChange={(event) => setDevise(event.target.value)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="CNY">CNY</option>
          </select>
        </div>
      </div>
      <button type="button" className="item-add-link" onClick={() => setNewFournisseurOpen(true)}><Plus size={13} /> Nouveau fournisseur</button>
      <button type="button" className="btn-ghost" onClick={() => setMoreOpen((value) => !value)} style={{ display: 'block', marginBottom: 10 }}>
        {moreOpen ? 'Moins d’options' : 'Plus d’options'}
      </button>
      {moreOpen && (
        <div className="form-row">
          <div className="form-field"><label>Taux du jour en GNF (optionnel)</label><input type="number" value={tauxChange} onChange={(event) => setTauxChange(event.target.value)} /></div>
          <div className="form-field"><label>Date d&apos;arrivée prévue</label><input type="date" value={dateArriveePrevue} onChange={(event) => setDateArriveePrevue(event.target.value)} /></div>
        </div>
      )}
      {moreOpen && (
        <>
          <div className="form-field"><label>Référence fournisseur (optionnel)</label><input value={reference} onChange={(event) => setReference(event.target.value)} /></div>
          <div className="form-field"><label>Commentaire (optionnel)</label><input value={commentaire} onChange={(event) => setCommentaire(event.target.value)} /></div>
        </>
      )}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : submitLabel}</button>
      </div>
    </form>

      <Modal open={newProduitOpen} onClose={() => setNewProduitOpen(false)} title="Autre produit">
        <NewProduitMiniForm
          onCreated={(article, catalogueProduit) => {
            setNewProduitOpen(false)
            setLignes((value) => [
              ...value,
              {
                key: `${Date.now()}-${Math.random()}`,
                articleId: article.id,
                catalogueProduitId: catalogueProduit?.id,
                nomAffiche: article.name,
                description: '',
                quantite: '1',
                prixUnitaire: '',
                finish: '',
                unit: article.unit,
              },
            ])
          }}
        />
      </Modal>
      <Modal open={newFournisseurOpen} onClose={() => setNewFournisseurOpen(false)} title="Nouveau fournisseur">
        <NewFournisseurMiniForm
          onCreated={(f) => {
            setFournisseurs((value) => [...value, f])
            setFournisseurId(f.id)
            setNewFournisseurOpen(false)
          }}
        />
      </Modal>
    </>
  )
}

function NewProduitMiniForm({ onCreated }: { onCreated: (article: { id: number; name: string; unit: string }, catalogueProduit?: { id: number }) => void }) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState('matiere_premiere')
  const [unit, setUnit] = useState('kg')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, level, unit, label: name }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Une erreur est survenue.')
        return
      }
      onCreated(json.article, json.catalogueProduit)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-field"><label>Nom</label><input required value={name} onChange={(event) => setName(event.target.value)} /></div>
      <div className="form-row">
        <div className="form-field">
          <label>Type</label>
          <select value={level} onChange={(event) => setLevel(event.target.value)}>
            <option value="matiere_premiere">Matière première</option>
            <option value="semi_fini">Semi-fini</option>
            <option value="produit_fini">Produit fini</option>
          </select>
        </div>
        <div className="form-field">
          <label>Unité</label>
          <select value={unit} onChange={(event) => setUnit(event.target.value)}>
            {['kg', 'm', 'rouleau', 'piece', 'panier', 'carton'].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Création...' : 'Créer et ajouter'}</button>
      </div>
    </form>
  )
}

type CommandeDetail = {
  fournisseurId: number
  devise: string
  tauxChange: number | null
  dateArriveePrevue: string | null
  reference: string | null
  commentaire: string | null
  lignes: { articleId: number; catalogueProduitId: number | null; articleUnit: string; nomAffiche: string; description: string | null; quantite: number; prixUnitaire: number | null; finish: string | null }[]
}

function EditCommandeModal({ commandeId, onClose, onDone }: { commandeId: number; onClose: () => void; onDone: () => void }) {
  const [detail, setDetail] = useState<CommandeDetail | null>(null)

  useEffect(() => {
    fetchJson<{ commande: CommandeDetail }>(`/api/commandes/${commandeId}`).then((res) => setDetail(res.commande))
  }, [commandeId])

  if (!detail) return <p className="table-empty">Chargement...</p>

  return (
    <CommandeForm
      submitLabel="Enregistrer les modifications"
      initial={{
        fournisseurId: detail.fournisseurId,
        devise: detail.devise,
        tauxChange: detail.tauxChange,
        dateArriveePrevue: detail.dateArriveePrevue,
        reference: detail.reference,
        commentaire: detail.commentaire,
        lignes: detail.lignes.map((ligne) => ({
          key: `${ligne.articleId}-${Math.random()}`,
          articleId: ligne.articleId,
          catalogueProduitId: ligne.catalogueProduitId ?? undefined,
          nomAffiche: ligne.nomAffiche,
          description: ligne.description ?? '',
          quantite: String(ligne.quantite),
          prixUnitaire: ligne.prixUnitaire?.toString() ?? '',
          finish: ligne.finish ?? '',
          unit: ligne.articleUnit,
        })),
      }}
      onSubmit={async (payload) => {
        const res = await fetch(`/api/commandes/${commandeId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        const json = await res.json()
        if (!res.ok) return json.error ?? 'Une erreur est survenue.'
        onDone()
      }}
    />
  )
}

export function CommanderView() {
  const [commandes, setCommandes] = useState<CommandeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newOpen, setNewOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchJson<{ commandes: CommandeRow[] }>('/api/commandes')
      .then((res) => setCommandes(res.commandes))
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setNewOpen(false)
    setEditingId(null)
    setRefreshKey((value) => value + 1)
  }

  async function handlePasser(id: number) {
    if (!confirm('Passer cette commande au fournisseur ? Les lignes ne seront plus modifiables.')) return
    const res = await fetch(`/api/commandes/${id}/passer`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) alert(json.error ?? 'Une erreur est survenue.')
    refresh()
  }

  async function handleAnnuler(id: number) {
    if (!confirm('Annuler cette commande ?')) return
    const res = await fetch(`/api/commandes/${id}/annuler`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const json = await res.json()
    if (!res.ok) alert(json.error ?? 'Une erreur est survenue.')
    refresh()
  }

  return (
    <AppShell breadcrumb="Achats" section="Commander">
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACHATS</p>
          <h1>Commander</h1>
          <p className="heading-subtitle">Préparez une commande pour un fournisseur.</p>
        </div>
      </div>
      <div className="toolbar-panel" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} /> Nouvelle commande</button>
      </div>
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Numéro</th><th>Fournisseur</th><th>Total</th><th>Arrivée prévue</th><th>État</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && commandes.length === 0 && <tr><td colSpan={6} className="table-empty">Aucune commande.</td></tr>}
              {commandes.map((commande) => (
                <tr key={commande.id}>
                  <td>{commande.numero}</td>
                  <td>{commande.fournisseurName}</td>
                  <td>
                    {formatMoney(commande.total, commande.devise)}
                    {commande.tauxChange && <div style={{ fontSize: 10, color: 'var(--faint)' }}>≈ {formatMoney(commande.total * commande.tauxChange, 'GNF')}</div>}
                  </td>
                  <td>{commande.dateArriveePrevue ?? '—'}</td>
                  <td><span className={`badge ${ETAT_BADGES[commande.etat]}`}>{ETAT_LABELS[commande.etat]}</span></td>
                  <td>
                    {commande.etat === 'brouillon' && (
                      <>
                        <button className="btn-ghost" onClick={() => setEditingId(commande.id)}>Modifier</button>
                        <button className="btn-ghost" onClick={() => handlePasser(commande.id)}>Passer la commande</button>
                        <button className="btn-ghost" onClick={() => handleAnnuler(commande.id)}>Annuler</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nouvelle commande" wide>
        <CommandeForm
          submitLabel="Enregistrer la commande"
          onSubmit={async (payload) => {
            const res = await fetch('/api/commandes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            const json = await res.json()
            if (!res.ok) return json.error ?? 'Une erreur est survenue.'
            refresh()
          }}
        />
      </Modal>
      <Modal open={editingId !== null} onClose={() => setEditingId(null)} title="Modifier la commande" wide>
        {editingId !== null && <EditCommandeModal commandeId={editingId} onClose={() => setEditingId(null)} onDone={refresh} />}
      </Modal>
    </AppShell>
  )
}

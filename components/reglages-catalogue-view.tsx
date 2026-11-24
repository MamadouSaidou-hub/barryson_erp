'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'

type CatalogueRow = {
  id: number
  articleId: number
  label: string
  finish: string | null
  supplierRef: string | null
  usualPrice: number | null
  usualCurrency: string | null
  articleName: string
  articleCode: string
  articleUnit: string
  articleActive: boolean
}

type ArticleOption = { id: number; name: string; code: string; active: boolean }

const LEVELS = [
  { value: 'matiere_premiere', label: 'Matière première' },
  { value: 'semi_fini', label: 'Semi-fini' },
  { value: 'produit_fini', label: 'Produit fini' },
]
const UNITS = ['kg', 'm', 'rouleau', 'piece', 'panier', 'carton']

function NewCatalogueForm({ articleOptions, onCreated }: { articleOptions: ArticleOption[]; onCreated: () => void }) {
  const [mode, setMode] = useState<'existant' | 'nouveau'>('existant')
  const [articleId, setArticleId] = useState(articleOptions[0]?.id ?? 0)
  const [label, setLabel] = useState('')
  const [name, setName] = useState('')
  const [level, setLevel] = useState('semi_fini')
  const [unit, setUnit] = useState(UNITS[0])
  const [usualPrice, setUsualPrice] = useState('')
  const [usualCurrency, setUsualCurrency] = useState('USD')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const body =
        mode === 'existant'
          ? { articleId, label: label || articleOptions.find((a) => a.id === articleId)?.name, usualPrice: usualPrice || undefined, usualCurrency }
          : { name, level, unit, label: label || name, usualPrice: usualPrice || undefined, usualCurrency }

      const res = await fetch('/api/catalogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
      <div className="form-field">
        <label>Article</label>
        <select value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
          <option value="existant">Un article déjà créé</option>
          <option value="nouveau">Un nouvel article</option>
        </select>
      </div>
      {mode === 'existant' ? (
        <div className="form-field">
          <label>Choisir l&apos;article</label>
          <select value={articleId} onChange={(event) => setArticleId(Number(event.target.value))}>
            {articleOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.name}</option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div className="form-field"><label>Nom du nouvel article</label><input required value={name} onChange={(event) => setName(event.target.value)} /></div>
          <div className="form-row">
            <div className="form-field">
              <label>Niveau</label>
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                {LEVELS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Unité</label>
              <select value={unit} onChange={(event) => setUnit(event.target.value)}>
                {UNITS.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </div>
          </div>
        </>
      )}
      <div className="form-field"><label>Libellé affiché (optionnel)</label><input value={label} onChange={(event) => setLabel(event.target.value)} /></div>
      <div className="form-row">
        <div className="form-field"><label>Prix habituel (optionnel)</label><input type="number" value={usualPrice} onChange={(event) => setUsualPrice(event.target.value)} /></div>
        <div className="form-field">
          <label>Devise</label>
          <select value={usualCurrency} onChange={(event) => setUsualCurrency(event.target.value)}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="CNY">CNY</option>
          </select>
        </div>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Ajouter au catalogue'}</button>
      </div>
    </form>
  )
}

export function ProduitsFournisseurView() {
  const [catalogue, setCatalogue] = useState<CatalogueRow[]>([])
  const [articleOptions, setArticleOptions] = useState<ArticleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newOpen, setNewOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ catalogue: CatalogueRow[] }>('/api/catalogue'),
      fetchJson<{ articles: ArticleOption[] }>('/api/articles'),
    ])
      .then(([catalogueRes, articlesRes]) => {
        setCatalogue(catalogueRes.catalogue)
        setArticleOptions(articlesRes.articles.filter((a) => a.active))
      })
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setNewOpen(false)
    setRefreshKey((value) => value + 1)
  }

  return (
    <AppShell breadcrumb="Réglages" section="Produits du fournisseur">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RÉGLAGES</p>
          <h1>Produits <span>du fournisseur</span></h1>
          <p className="heading-subtitle">La liste de ce que l&apos;usine commande habituellement, sans lien obligatoire avec un fournisseur précis.</p>
        </div>
      </div>
      <div className="toolbar-panel" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} /> Nouveau produit</button>
      </div>
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Libellé</th><th>Finition</th><th>Référence fournisseur</th><th>Article</th><th>Prix habituel</th></tr>
            </thead>
            <tbody>
              {!loading && catalogue.length === 0 && <tr><td colSpan={5} className="table-empty">Aucun produit dans le catalogue.</td></tr>}
              {catalogue.map((row) => (
                <tr key={row.id}>
                  <td>{row.label}</td>
                  <td>{row.finish ?? '—'}</td>
                  <td>{row.supplierRef ?? '—'}</td>
                  <td>{row.articleCode} ({row.articleUnit})</td>
                  <td>{row.usualPrice ? `${row.usualPrice} ${row.usualCurrency ?? ''}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nouveau produit du catalogue">
        <NewCatalogueForm articleOptions={articleOptions} onCreated={refresh} />
      </Modal>
    </AppShell>
  )
}

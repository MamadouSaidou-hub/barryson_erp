'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'

type Article = {
  id: number
  code: string
  name: string
  level: 'matiere_premiere' | 'semi_fini' | 'produit_fini'
  unit: string
  seuilMin: number | null
  seuilMax: number | null
  active: boolean
}

const LEVEL_LABELS: Record<Article['level'], string> = {
  matiere_premiere: 'Matière première',
  semi_fini: 'Semi-fini',
  produit_fini: 'Produit fini',
}

const UNITS = ['kg', 'm', 'rouleau', 'piece', 'panier', 'carton']

function NewArticleForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [level, setLevel] = useState<Article['level']>('semi_fini')
  const [unit, setUnit] = useState(UNITS[0])
  const [seuilMin, setSeuilMin] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, level, unit, seuilMin: seuilMin || undefined }),
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
        <label>Nom</label>
        <input required value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="form-row">
        <div className="form-field">
          <label>Niveau de stock</label>
          <select value={level} onChange={(event) => setLevel(event.target.value as Article['level'])}>
            {Object.entries(LEVEL_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Unité</label>
          <select value={unit} onChange={(event) => setUnit(event.target.value)}>
            {UNITS.map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-field">
        <label>Seuil d&apos;alerte (optionnel)</label>
        <input type="number" value={seuilMin} onChange={(event) => setSeuilMin(event.target.value)} />
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer'}</button>
      </div>
    </form>
  )
}

function EditArticleForm({ article, onDone, onClose }: { article: Article; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState(article.name)
  const [seuilMin, setSeuilMin] = useState(article.seuilMin?.toString() ?? '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, seuilMin: seuilMin === '' ? null : seuilMin }),
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
      await fetch(`/api/articles/${article.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !article.active }),
      })
      onDone()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && <p className="form-error">{error}</p>}
      <div className="form-field">
        <label>Nom</label>
        <input required value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="form-field">
        <label>Seuil d&apos;alerte (optionnel)</label>
        <input type="number" value={seuilMin} onChange={(event) => setSeuilMin(event.target.value)} />
      </div>
      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={handleToggleActive} disabled={submitting}>
          {article.active ? 'Désactiver' : 'Réactiver'}
        </button>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

export function ArticlesFournisseursView() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newArticleOpen, setNewArticleOpen] = useState(false)
  const [editingArticle, setEditingArticle] = useState<Article | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchJson<{ articles: Article[] }>('/api/articles')
      .then((res) => setArticles(res.articles))
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setNewArticleOpen(false)
    setEditingArticle(null)
    setRefreshKey((value) => value + 1)
  }

  return (
    <AppShell breadcrumb="Réglages" section="Articles">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RÉGLAGES</p>
          <h1>Articles</h1>
          <p className="heading-subtitle">Matières premières, semi-finis et produits finis de l&apos;usine.</p>
        </div>
      </div>
      <div className="toolbar-panel" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => setNewArticleOpen(true)}><Plus size={14} /> Nouvel article</button>
      </div>
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Nom</th><th>Niveau</th><th>Unité</th><th>Seuil min</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && articles.length === 0 && <tr><td colSpan={7} className="table-empty">Aucun article.</td></tr>}
              {articles.map((article) => (
                <tr key={article.id}>
                  <td>{article.code}</td>
                  <td>{article.name}</td>
                  <td>{LEVEL_LABELS[article.level]}</td>
                  <td>{article.unit}</td>
                  <td>{article.seuilMin ?? '—'}</td>
                  <td><span className={`badge ${article.active ? 'badge-green' : 'badge-muted'}`}>{article.active ? 'Actif' : 'Inactif'}</span></td>
                  <td><button className="btn-ghost" onClick={() => setEditingArticle(article)}>Modifier</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={newArticleOpen} onClose={() => setNewArticleOpen(false)} title="Nouvel article">
        <NewArticleForm onCreated={refresh} />
      </Modal>
      <Modal open={editingArticle !== null} onClose={() => setEditingArticle(null)} title="Modifier l'article">
        {editingArticle && <EditArticleForm article={editingArticle} onDone={refresh} onClose={() => setEditingArticle(null)} />}
      </Modal>
    </AppShell>
  )
}

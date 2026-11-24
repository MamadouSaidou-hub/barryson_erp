'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, History, Layers, Package, PackageMinus, PackagePlus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'
import { formatQuantity } from '@/lib/format'

type StockRow = {
  articleId: number
  code: string
  name: string
  level: 'matiere_premiere' | 'semi_fini' | 'produit_fini'
  unit: string
  quantite: number
  seuilMin: number | null
  presqueFini: boolean
  negatif: boolean
}

const LEVEL_LABELS: Record<StockRow['level'], string> = {
  matiere_premiere: 'Matière première',
  semi_fini: 'Semi-fini',
  produit_fini: 'Produit fini',
}

const LEVEL_FILTERS: { value: StockRow['level'] | 'tous'; label: string }[] = [
  { value: 'tous', label: 'Tous' },
  { value: 'matiere_premiere', label: 'Matières premières' },
  { value: 'semi_fini', label: 'Semi-finis' },
  { value: 'produit_fini', label: 'Produits finis' },
]

type Mouvement = {
  id: number
  articleName: string
  articleUnit: string
  type: string
  quantite: number
  motif: string | null
  auteurName: string
  date: string
}

const TYPE_LABELS: Record<string, string> = {
  reception: 'Réception',
  entree_manuelle: 'Entrée',
  entree_directe: 'Entrée directe',
  sortie_manuelle: 'Sortie',
  sortie_exceptionnelle: 'Sortie exceptionnelle',
  ajustement: 'Ajustement',
  inventaire: 'Inventaire',
}

function MetricCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Package; tone: 'navy' | 'green' | 'orange' | 'blue' }) {
  return (
    <article className="metric-card">
      <div className="metric-topline"><span className={`metric-icon metric-icon-${tone}`}><Icon aria-hidden="true" /></span></div>
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </article>
  )
}

function MouvementForm({ article, direction, onDone }: { article: StockRow; direction: 'entree' | 'sortie'; onDone: () => void }) {
  const [quantite, setQuantite] = useState('')
  const [motif, setMotif] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/stock/mouvements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: article.articleId, direction, quantite, motif: motif || undefined }),
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
      <p className="section-subtitle">{article.name} — en stock : {formatQuantity(article.quantite, article.unit)}</p>
      <div className="form-field">
        <label>Quantité ({article.unit})</label>
        <input required type="number" value={quantite} onChange={(event) => setQuantite(event.target.value)} />
      </div>
      <div className="form-field">
        <label>Motif (optionnel)</label>
        <select value={motif} onChange={(event) => setMotif(event.target.value)}>
          <option value="">—</option>
          <option value="Stock de départ">Stock de départ</option>
          <option value="Retour">Retour</option>
          <option value="Casse">Casse</option>
          <option value="Don">Don</option>
          <option value="Autre">Autre</option>
        </select>
      </div>
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

export function StockView() {
  const [items, setItems] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [levelFilter, setLevelFilter] = useState<StockRow['level'] | 'tous'>('tous')
  const [movementTarget, setMovementTarget] = useState<{ article: StockRow; direction: 'entree' | 'sortie' } | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<Mouvement[]>([])

  const visibleItems = levelFilter === 'tous' ? items : items.filter((item) => item.level === levelFilter)

  useEffect(() => {
    setLoading(true)
    fetchJson<{ items: StockRow[] }>('/api/stock')
      .then((res) => setItems(res.items))
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setMovementTarget(null)
    setRefreshKey((value) => value + 1)
  }

  function openHistory() {
    setHistoryOpen(true)
    fetchJson<{ mouvements: Mouvement[] }>('/api/stock/mouvements').then((res) => setHistory(res.mouvements))
  }

  return (
    <AppShell breadcrumb="Stock" section="Stock">
      <div className="page-heading">
        <div>
          <p className="eyebrow">STOCK</p>
          <h1>Stock</h1>
        </div>
        <button className="btn-secondary" onClick={openHistory}><History size={14} /> Historique</button>
      </div>
      <div className="metrics-grid">
        <MetricCard label="Articles référencés" value={`${items.length}`} icon={Package} tone="navy" />
        <MetricCard label="Matières premières" value={`${items.filter((i) => i.level === 'matiere_premiere').length}`} icon={Layers} tone="blue" />
        <MetricCard label="Semi-finis" value={`${items.filter((i) => i.level === 'semi_fini').length}`} icon={Layers} tone="blue" />
        <MetricCard label="Articles en alerte" value={`${items.filter((i) => i.negatif || i.presqueFini).length}`} icon={AlertTriangle} tone="orange" />
      </div>
      <div className="filter-chip-row">
        {LEVEL_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={`filter-chip ${levelFilter === filter.value ? 'active' : ''}`}
            onClick={() => setLevelFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>
      <div className="store-card-grid">
        {loading && Array.from({ length: 6 }).map((_, index) => (
          <article className="store-card skeleton-card" key={index}>
            <div className="store-card-head">
              <span className="skeleton-block" style={{ width: 36, height: 36, borderRadius: 9 }} />
              <div style={{ flex: 1 }}>
                <span className="skeleton-block" style={{ width: '70%', height: 13 }} />
                <span className="skeleton-block" style={{ width: '50%', height: 10, marginTop: 6 }} />
              </div>
            </div>
          </article>
        ))}
        {!loading && visibleItems.length === 0 && <p className="table-empty">Aucun article dans cette catégorie.</p>}
        {!loading && visibleItems.map((item) => {
          const statut = item.negatif ? 'Négatif' : item.presqueFini ? 'Presque fini' : 'OK'
          const statutBadge = item.negatif ? 'badge-red' : item.presqueFini ? 'badge-orange' : 'badge-green'
          return (
            <article className="store-card" key={item.articleId}>
              <div className="store-card-head">
                <span className="store-card-icon"><Package aria-hidden="true" /></span>
                <div><strong>{item.name}</strong><span>{item.code} · {LEVEL_LABELS[item.level]}</span></div>
              </div>
              <div className="store-card-stats">
                <div><label>En stock</label><b>{formatQuantity(item.quantite, item.unit)}</b></div>
                <div><label>Statut</label><b><span className={`badge ${statutBadge}`}>{statut}</span></b></div>
              </div>
              <div className="store-card-actions">
                <button className="btn-ghost" onClick={() => setMovementTarget({ article: item, direction: 'entree' })}><PackagePlus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Entrée</button>
                <button className="btn-ghost" onClick={() => setMovementTarget({ article: item, direction: 'sortie' })}><PackageMinus size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Sortie</button>
              </div>
            </article>
          )
        })}
      </div>

      <Modal
        open={movementTarget !== null}
        onClose={() => setMovementTarget(null)}
        title={movementTarget?.direction === 'entree' ? 'Entrée de stock' : 'Sortie de stock'}
      >
        {movementTarget && <MouvementForm article={movementTarget.article} direction={movementTarget.direction} onDone={refresh} />}
      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="Historique du stock" wide>
        <div className="table-panel">
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Article</th><th>Type</th><th>Quantité</th><th>Motif</th><th>Auteur</th></tr>
              </thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={6} className="table-empty">Aucun mouvement.</td></tr>}
                {history.map((mouvement) => (
                  <tr key={mouvement.id}>
                    <td data-label="Date">{mouvement.date.slice(0, 10)}</td>
                    <td data-label="Article">{mouvement.articleName}</td>
                    <td data-label="Type">{TYPE_LABELS[mouvement.type] ?? mouvement.type}</td>
                    <td data-label="Quantité" style={{ fontWeight: 700 }}>{formatQuantity(mouvement.quantite, mouvement.articleUnit)}</td>
                    <td data-label="Motif" className="cell-secondary">{mouvement.motif ?? '—'}</td>
                    <td data-label="Auteur" className="cell-secondary">{mouvement.auteurName}</td>
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

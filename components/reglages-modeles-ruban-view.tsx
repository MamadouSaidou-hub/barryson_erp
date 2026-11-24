'use client'

import { useEffect, useState } from 'react'
import { Plus } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'

type ArticleOption = { id: number; name: string; level: string; unit: string; active: boolean }

type Modele = {
  id: number
  name: string
  famille: 'bopp' | 'pvc_electrique' | 'masquage'
  largeurMm: number
  longueurRouleauM: number
  piecesParTour: number
  piecesParCarton: number
  piecesParPaquet: number | null
  plastiqueKgParPaquet: number | null
  finish: string | null
  moule: string | null
  bobineArticleId: number
  tubeArticleId: number
  cartonArticleId: number
  plastiqueArticleId: number | null
  produitFiniArticleId: number
  active: boolean
}

const FAMILLE_LABELS: Record<Modele['famille'], string> = {
  bopp: 'BOPP',
  pvc_electrique: 'PVC électrique',
  masquage: 'Masquage',
}

function ArticleSelect({
  label,
  value,
  onChange,
  options,
  levelHint,
}: {
  label: string
  value: number
  onChange: (id: number) => void
  options: ArticleOption[]
  levelHint?: string
}) {
  const filtered = levelHint ? options.filter((o) => o.level === levelHint && o.active) : options.filter((o) => o.active)
  return (
    <div className="form-field">
      <label>{label}</label>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))}>
        <option value={0}>— Choisir —</option>
        {filtered.map((option) => (
          <option key={option.id} value={option.id}>{option.name}</option>
        ))}
      </select>
    </div>
  )
}

function NewModeleForm({ articleOptions, onCreated }: { articleOptions: ArticleOption[]; onCreated: () => void }) {
  const [name, setName] = useState('')
  const [famille, setFamille] = useState<Modele['famille']>('bopp')
  const [largeurMm, setLargeurMm] = useState('')
  const [longueurRouleauM, setLongueurRouleauM] = useState('')
  const [piecesParTour, setPiecesParTour] = useState('')
  const [piecesParCarton, setPiecesParCarton] = useState('')
  const [piecesParPaquet, setPiecesParPaquet] = useState('')
  const [plastiqueKgParPaquet, setPlastiqueKgParPaquet] = useState('')
  const [finish, setFinish] = useState('')
  const [moule, setMoule] = useState('')
  const [bobineArticleId, setBobineArticleId] = useState(0)
  const [tubeArticleId, setTubeArticleId] = useState(0)
  const [cartonArticleId, setCartonArticleId] = useState(0)
  const [plastiqueArticleId, setPlastiqueArticleId] = useState(0)
  const [produitFiniArticleId, setProduitFiniArticleId] = useState(0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/modeles-ruban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          famille,
          largeurMm,
          longueurRouleauM,
          piecesParTour,
          piecesParCarton,
          piecesParPaquet: piecesParPaquet || undefined,
          plastiqueKgParPaquet: plastiqueKgParPaquet || undefined,
          finish: finish || undefined,
          moule: moule || undefined,
          bobineArticleId,
          tubeArticleId,
          cartonArticleId,
          plastiqueArticleId: plastiqueArticleId || undefined,
          produitFiniArticleId,
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
      <div className="form-field"><label>Nom</label><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex : BSG 30" /></div>
      <div className="form-row">
        <div className="form-field">
          <label>Famille</label>
          <select value={famille} onChange={(event) => setFamille(event.target.value as Modele['famille'])}>
            {Object.entries(FAMILLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="form-field"><label>Finition (optionnel)</label><input value={finish} onChange={(event) => setFinish(event.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label>Largeur (mm)</label><input required type="number" value={largeurMm} onChange={(event) => setLargeurMm(event.target.value)} /></div>
        <div className="form-field"><label>Longueur de rouleau (m)</label><input required type="number" value={longueurRouleauM} onChange={(event) => setLongueurRouleauM(event.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label>Pièces par tour</label><input required type="number" value={piecesParTour} onChange={(event) => setPiecesParTour(event.target.value)} /></div>
        <div className="form-field"><label>Pièces par carton</label><input required type="number" value={piecesParCarton} onChange={(event) => setPiecesParCarton(event.target.value)} /></div>
      </div>
      <div className="form-field"><label>Moule (optionnel)</label><input value={moule} onChange={(event) => setMoule(event.target.value)} /></div>
      <ArticleSelect label="Article bobine (matière engagée)" value={bobineArticleId} onChange={setBobineArticleId} options={articleOptions} />
      <ArticleSelect label="Article tube / mandrin" value={tubeArticleId} onChange={setTubeArticleId} options={articleOptions} />
      <ArticleSelect label="Article carton vide" value={cartonArticleId} onChange={setCartonArticleId} options={articleOptions} />
      <ArticleSelect label="Article produit fini" value={produitFiniArticleId} onChange={setProduitFiniArticleId} options={articleOptions} levelHint="produit_fini" />

      <p className="section-title" style={{ marginTop: 20 }}>Groupage et plastique rétractable (optionnel)</p>
      <p className="section-subtitle">Si l&apos;usine regroupe les pièces conformes en paquets filmés avant mise en carton pour ce modèle. Laissez vide si non applicable.</p>
      <div className="form-row">
        <div className="form-field"><label>Pièces par paquet</label><input type="number" value={piecesParPaquet} onChange={(event) => setPiecesParPaquet(event.target.value)} /></div>
        <div className="form-field"><label>Kg de plastique par paquet</label><input type="number" step="0.01" value={plastiqueKgParPaquet} onChange={(event) => setPlastiqueKgParPaquet(event.target.value)} /></div>
      </div>
      <ArticleSelect label="Article plastique rétractable" value={plastiqueArticleId} onChange={setPlastiqueArticleId} options={articleOptions} />

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Créer'}</button>
      </div>
    </form>
  )
}

function EditModeleForm({ modele, articleOptions, onDone, onClose }: { modele: Modele; articleOptions: ArticleOption[]; onDone: () => void; onClose: () => void }) {
  const [name, setName] = useState(modele.name)
  const [piecesParTour, setPiecesParTour] = useState(String(modele.piecesParTour))
  const [piecesParCarton, setPiecesParCarton] = useState(String(modele.piecesParCarton))
  const [piecesParPaquet, setPiecesParPaquet] = useState(modele.piecesParPaquet?.toString() ?? '')
  const [plastiqueKgParPaquet, setPlastiqueKgParPaquet] = useState(modele.plastiqueKgParPaquet?.toString() ?? '')
  const [plastiqueArticleId, setPlastiqueArticleId] = useState(modele.plastiqueArticleId ?? 0)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/modeles-ruban/${modele.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          piecesParTour,
          piecesParCarton,
          piecesParPaquet: piecesParPaquet === '' ? '' : piecesParPaquet,
          plastiqueKgParPaquet: plastiqueKgParPaquet === '' ? '' : plastiqueKgParPaquet,
          plastiqueArticleId: plastiqueArticleId || '',
        }),
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
      await fetch(`/api/modeles-ruban/${modele.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !modele.active }),
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
        <div className="form-field"><label>Pièces par tour</label><input type="number" value={piecesParTour} onChange={(event) => setPiecesParTour(event.target.value)} /></div>
        <div className="form-field"><label>Pièces par carton</label><input type="number" value={piecesParCarton} onChange={(event) => setPiecesParCarton(event.target.value)} /></div>
      </div>

      <p className="section-title" style={{ marginTop: 16 }}>Groupage et plastique rétractable (optionnel)</p>
      <div className="form-row">
        <div className="form-field"><label>Pièces par paquet</label><input type="number" value={piecesParPaquet} onChange={(event) => setPiecesParPaquet(event.target.value)} /></div>
        <div className="form-field"><label>Kg de plastique par paquet</label><input type="number" step="0.01" value={plastiqueKgParPaquet} onChange={(event) => setPlastiqueKgParPaquet(event.target.value)} /></div>
      </div>
      <ArticleSelect label="Article plastique rétractable" value={plastiqueArticleId} onChange={setPlastiqueArticleId} options={articleOptions} />

      <div className="form-actions">
        <button type="button" className="btn-secondary" onClick={handleToggleActive} disabled={submitting}>{modele.active ? 'Désactiver' : 'Réactiver'}</button>
        <button type="button" className="btn-secondary" onClick={onClose} disabled={submitting}>Annuler</button>
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Enregistrer'}</button>
      </div>
    </form>
  )
}

export function ModelesRubanView() {
  const [modeles, setModeles] = useState<Modele[]>([])
  const [articleOptions, setArticleOptions] = useState<ArticleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newOpen, setNewOpen] = useState(false)
  const [editing, setEditing] = useState<Modele | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ modeles: Modele[] }>('/api/modeles-ruban'),
      fetchJson<{ articles: ArticleOption[] }>('/api/articles'),
    ])
      .then(([modelesRes, articlesRes]) => {
        setModeles(modelesRes.modeles)
        setArticleOptions(articlesRes.articles)
      })
      .finally(() => setLoading(false))
  }, [refreshKey])

  function refresh() {
    setNewOpen(false)
    setEditing(null)
    setRefreshKey((value) => value + 1)
  }

  function articleName(id: number) {
    return articleOptions.find((a) => a.id === id)?.name ?? '—'
  }

  return (
    <AppShell breadcrumb="Réglages" section="Modèles de ruban">
      <div className="page-heading">
        <div>
          <p className="eyebrow">RÉGLAGES</p>
          <h1>Modèles <span>de ruban</span></h1>
          <p className="heading-subtitle">Famille, dimensions, pièces par tour/carton et articles consommés par la production.</p>
        </div>
      </div>
      <div className="toolbar-panel" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => setNewOpen(true)}><Plus size={14} /> Nouveau modèle</button>
      </div>
      <div className="table-panel">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Nom</th><th>Famille</th><th>Dimensions</th><th>Pièces/tour</th><th>Pièces/carton</th><th>Groupage</th><th>Bobine</th><th>Produit fini</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {!loading && modeles.length === 0 && <tr><td colSpan={10} className="table-empty">Aucun modèle de ruban.</td></tr>}
              {modeles.map((modele) => (
                <tr key={modele.id}>
                  <td>{modele.name}</td>
                  <td>{FAMILLE_LABELS[modele.famille]}</td>
                  <td>{modele.largeurMm} mm × {modele.longueurRouleauM} m</td>
                  <td>{modele.piecesParTour}</td>
                  <td>{modele.piecesParCarton}</td>
                  <td className="cell-secondary">
                    {modele.piecesParPaquet && modele.plastiqueKgParPaquet
                      ? `${modele.piecesParPaquet} pièces/paquet · ${modele.plastiqueKgParPaquet} kg`
                      : <span style={{ color: 'var(--faint)' }}>Non configuré</span>}
                  </td>
                  <td className="cell-secondary">{articleName(modele.bobineArticleId)}</td>
                  <td className="cell-secondary">{articleName(modele.produitFiniArticleId)}</td>
                  <td><span className={`badge ${modele.active ? 'badge-green' : 'badge-muted'}`}>{modele.active ? 'Actif' : 'Inactif'}</span></td>
                  <td><button className="btn-ghost" onClick={() => setEditing(modele)}>Modifier</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={newOpen} onClose={() => setNewOpen(false)} title="Nouveau modèle de ruban" wide>
        <NewModeleForm articleOptions={articleOptions} onCreated={refresh} />
      </Modal>
      <Modal open={editing !== null} onClose={() => setEditing(null)} title="Modifier le modèle">
        {editing && <EditModeleForm modele={editing} articleOptions={articleOptions} onDone={refresh} onClose={() => setEditing(null)} />}
      </Modal>
    </AppShell>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Plus, Wrench } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { Modal } from '@/components/modal'
import { fetchJson } from '@/lib/fetch-json'

type Modele = {
  id: number
  name: string
  longueurRouleauM: number
  piecesParTour: number
  piecesParCarton: number
  piecesParPaquet: number | null
  plastiqueKgParPaquet: number | null
  tubeArticleId: number
  cartonArticleId: number
  plastiqueArticleId: number | null
  produitFiniArticleId: number
}

type ArticleOption = { id: number; name: string; unit: string }

type BesoinFabrication = { articleId: number; articleName: string; unit: string; demandeRestante: number; stockDisponible: number; manque: number }

type Fabrication = {
  id: number
  numero: string
  modeleRubanId: number
  modeleNom: string
  piecesParTour: number
  piecesParCarton: number
  piecesParPaquet: number | null
  plastiqueKgParPaquet: number | null
  tubeArticleId: number
  cartonArticleId: number
  plastiqueArticleId: number | null
  metrageEngage: number
  dateDebut: string
  etat: 'ouverte' | 'terminee' | 'annulee'
  prevision: { toursComplets: number; piecesTheoriques: number; cartonsPrevision: number; piecesRestantesPrevision: number }
  resultat: {
    piecesBrutes: number
    piecesNonConformes: number
    piecesConformes: number
    cartonsReel: number
    ecart: number
    rendement: number
    paquetsReel: number
    plastiqueKgConsomme: number
  } | null
}

const ETAT_LABELS: Record<Fabrication['etat'], string> = { ouverte: 'Ouverte', terminee: 'Terminée', annulee: 'Annulée' }
const ETAT_BADGES: Record<Fabrication['etat'], string> = { ouverte: 'badge-blue', terminee: 'badge-green', annulee: 'badge-muted' }

function NewFabricationForm({
  modeles,
  onCreated,
  initialModeleId,
  initialMetrage,
}: {
  modeles: Modele[]
  onCreated: () => void
  initialModeleId?: number
  initialMetrage?: number
}) {
  const [modeleId, setModeleId] = useState(initialModeleId ?? modeles[0]?.id ?? 0)
  const [metrageEngage, setMetrageEngage] = useState(initialMetrage ? String(initialMetrage) : '')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const modele = modeles.find((m) => m.id === modeleId)
  const metrage = Number(metrageEngage) || 0
  const toursComplets = modele && metrage > 0 ? Math.floor(metrage / modele.longueurRouleauM) : 0
  const piecesTheoriques = modele ? toursComplets * modele.piecesParTour : 0
  const cartonsPrevision = modele && modele.piecesParCarton > 0 ? Math.floor(piecesTheoriques / modele.piecesParCarton) : 0
  const piecesRestantes = piecesTheoriques - cartonsPrevision * (modele?.piecesParCarton ?? 1)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/fabrications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modeleRubanId: modeleId, metrageEngage }),
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
        <label>Modèle de ruban</label>
        <select value={modeleId} onChange={(event) => setModeleId(Number(event.target.value))}>
          {modeles.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label>Métrage engagé (m)</label>
        <input required type="number" value={metrageEngage} onChange={(event) => setMetrageEngage(event.target.value)} />
      </div>
      {metrage > 0 && modele && (
        <div className="total-row">
          <span>Prévision</span>
          <strong>{piecesTheoriques} pièces ({cartonsPrevision} cartons + {piecesRestantes})</strong>
        </div>
      )}
      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting || !modeleId}>{submitting ? 'Enregistrement...' : 'Lancer la fabrication'}</button>
      </div>
    </form>
  )
}

function ResultatForm({ fabrication, articleOptions, onDone }: { fabrication: Fabrication; articleOptions: ArticleOption[]; onDone: () => void }) {
  const [toursTotal, setToursTotal] = useState('')
  const [toursDefectueux, setToursDefectueux] = useState('0')
  const [piecesDefectueusesSupp, setPiecesDefectueusesSupp] = useState('0')
  const [piecesDoctorRewinder, setPiecesDoctorRewinder] = useState('0')
  const [piecesPerdues, setPiecesPerdues] = useState('0')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function articleName(id: number | null) {
    return id ? articleOptions.find((a) => a.id === id)?.name ?? `#${id}` : null
  }

  const modelePiecesParTour = fabrication.piecesParTour
  const total = Number(toursTotal) || 0
  const defectueux = Number(toursDefectueux) || 0
  const defSupp = Number(piecesDefectueusesSupp) || 0
  const doctorRewinder = Number(piecesDoctorRewinder) || 0
  const perdues = Number(piecesPerdues) || 0

  const piecesBrutes = total * modelePiecesParTour
  const piecesNonConformes = defectueux * modelePiecesParTour + defSupp
  const coherent = piecesNonConformes === doctorRewinder + perdues
  const piecesConformes = piecesBrutes - piecesNonConformes
  const cartonsReel = fabrication.piecesParCarton > 0 ? Math.floor(piecesConformes / fabrication.piecesParCarton) : 0
  const paquetsReel = fabrication.piecesParPaquet ? Math.ceil(piecesConformes / fabrication.piecesParPaquet) : 0
  const plastiqueKgConsomme = fabrication.plastiqueKgParPaquet ? paquetsReel * fabrication.plastiqueKgParPaquet : 0

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`/api/fabrications/${fabrication.id}/resultat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toursTotal, toursDefectueux, piecesDefectueusesSupp, piecesDoctorRewinder, piecesPerdues }),
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
      <p className="section-subtitle">Prévision : {fabrication.prevision.piecesTheoriques} pièces ({fabrication.prevision.cartonsPrevision} cartons).</p>
      <div className="form-row">
        <div className="form-field"><label>Tours faits (total)</label><input required type="number" value={toursTotal} onChange={(event) => setToursTotal(event.target.value)} /></div>
        <div className="form-field"><label>Tours défectueux</label><input type="number" value={toursDefectueux} onChange={(event) => setToursDefectueux(event.target.value)} /></div>
      </div>
      <div className="form-row">
        <div className="form-field"><label>Pièces défectueuses en plus</label><input type="number" value={piecesDefectueusesSupp} onChange={(event) => setPiecesDefectueusesSupp(event.target.value)} /></div>
        <div className="form-field"><label>Envoyées au Doctor Rewinder</label><input type="number" value={piecesDoctorRewinder} onChange={(event) => setPiecesDoctorRewinder(event.target.value)} /></div>
      </div>
      <div className="form-field"><label>Perdues</label><input type="number" value={piecesPerdues} onChange={(event) => setPiecesPerdues(event.target.value)} /></div>

      {total > 0 && (
        <div className="total-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <span>Pièces non conformes : {piecesNonConformes} — Doctor Rewinder + perdues : {doctorRewinder + perdues}</span>
          {!coherent && <span style={{ color: 'var(--red)' }}>Écart de comptage — le total ne correspond pas, corrigez avant d&apos;enregistrer.</span>}
          {coherent && <strong>Pièces conformes : {piecesConformes}</strong>}
        </div>
      )}

      {total > 0 && coherent && (
        <div className="table-panel" style={{ padding: 14, marginBottom: 14, background: 'var(--surface-alt)' }}>
          <p className="section-title" style={{ marginBottom: 8 }}>À la validation, ceci sera consommé du stock</p>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text)' }}>
            <li>{piecesBrutes} tube(s)/mandrin(s) — {articleName(fabrication.tubeArticleId)}</li>
            {cartonsReel > 0 && <li>{cartonsReel} carton(s) vide(s) — {articleName(fabrication.cartonArticleId)}</li>}
            {plastiqueKgConsomme > 0 && fabrication.plastiqueArticleId ? (
              <li>{plastiqueKgConsomme.toFixed(2)} kg de plastique rétractable ({paquetsReel} paquet(s) de {fabrication.piecesParPaquet}) — {articleName(fabrication.plastiqueArticleId)}</li>
            ) : (
              <li style={{ color: 'var(--faint)' }}>Plastique rétractable : non configuré pour ce modèle (voir Réglages → Modèles de ruban)</li>
            )}
          </ul>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Enregistrement...' : 'Terminer'}</button>
      </div>
    </form>
  )
}

export function ProductionView() {
  const [fabrications, setFabrications] = useState<Fabrication[]>([])
  const [modeles, setModeles] = useState<Modele[]>([])
  const [articleOptions, setArticleOptions] = useState<ArticleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [newOpen, setNewOpen] = useState(false)
  const [resultatFor, setResultatFor] = useState<Fabrication | null>(null)
  const [besoins, setBesoins] = useState<BesoinFabrication[]>([])
  const [besoinPrefill, setBesoinPrefill] = useState<{ modeleId: number; metrage: number } | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchJson<{ fabrications: Fabrication[] }>('/api/fabrications'),
      fetchJson<{ modeles: Modele[] }>('/api/modeles-ruban?actifs=1'),
      fetchJson<{ articles: ArticleOption[] }>('/api/articles'),
      fetchJson<{ besoins: BesoinFabrication[] }>('/api/besoins-fabrication'),
    ])
      .then(([fabricationsRes, modelesRes, articlesRes, besoinsRes]) => {
        setFabrications(fabricationsRes.fabrications)
        setModeles(modelesRes.modeles)
        setArticleOptions(articlesRes.articles)
        setBesoins(besoinsRes.besoins)
      })
      .finally(() => setLoading(false))
  }, [refreshKey])

  function articleName(id: number | null) {
    return id ? articleOptions.find((a) => a.id === id)?.name ?? `#${id}` : null
  }

  function refresh() {
    setNewOpen(false)
    setResultatFor(null)
    setBesoinPrefill(null)
    setRefreshKey((value) => value + 1)
  }

  // Résout le(s) modèle(s) dont le produit fini correspond au besoin, et suggère un métrage
  // couvrant le manque (arrondi au tour complet supérieur, cohérent avec calculerPrevision qui ne
  // compte que les tours complets).
  function modelesPourBesoin(besoin: BesoinFabrication) {
    return modeles.filter((modele) => modele.produitFiniArticleId === besoin.articleId)
  }

  function handleLancerBesoin(besoin: BesoinFabrication, modele: Modele) {
    const toursNecessaires = Math.ceil(besoin.manque / modele.piecesParTour)
    setBesoinPrefill({ modeleId: modele.id, metrage: toursNecessaires * modele.longueurRouleauM })
    setNewOpen(true)
  }

  // Rendement dans le temps (§ chef de production) : chaque fabrication reste isolée dans la
  // grille ci-dessous — ce tableau regroupe les fabrications terminées par modèle pour repérer
  // une dérive (dernier rendement vs moyenne), sans requête serveur supplémentaire.
  const rendementParModele = (() => {
    const parModele = new Map<string, Fabrication[]>()
    for (const fabrication of fabrications) {
      if (fabrication.etat !== 'terminee' || !fabrication.resultat) continue
      const liste = parModele.get(fabrication.modeleNom) ?? []
      liste.push(fabrication)
      parModele.set(fabrication.modeleNom, liste)
    }
    return [...parModele.entries()].map(([modeleNom, liste]) => {
      const triee = [...liste].sort((a, b) => (a.dateDebut < b.dateDebut ? -1 : 1))
      const rendementMoyen = triee.reduce((sum, f) => sum + (f.resultat?.rendement ?? 0), 0) / triee.length
      const dernierRendement = triee[triee.length - 1].resultat?.rendement ?? 0
      return { modeleNom, nombre: triee.length, rendementMoyen, dernierRendement }
    })
  })()

  async function handleAnnuler(id: number) {
    if (!confirm('Annuler cette fabrication ? La bobine engagée sera restituée au stock.')) return
    const res = await fetch(`/api/fabrications/${id}/annuler`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    const json = await res.json()
    if (!res.ok) alert(json.error ?? 'Une erreur est survenue.')
    refresh()
  }

  return (
    <AppShell breadcrumb="Production" section="Production">
      <div className="page-heading">
        <div>
          <p className="eyebrow">PRODUCTION</p>
          <h1>Fabrications</h1>
          <p className="heading-subtitle">Refendage et conditionnement.</p>
        </div>
      </div>
      {besoins.length > 0 && (
        <div className="table-panel" style={{ padding: 14, marginBottom: 16 }}>
          <p className="section-title">Besoins de fabrication</p>
          <p className="section-subtitle" style={{ marginBottom: 8 }}>Demande client non couverte par le stock actuel.</p>
          {besoins.map((besoin) => {
            const candidats = modelesPourBesoin(besoin)
            return (
              <p key={besoin.articleId} style={{ margin: '4px 0', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>
                  <strong>{besoin.articleName}</strong> : manque {besoin.manque} {besoin.unit} (demande {besoin.demandeRestante}, stock {besoin.stockDisponible})
                </span>
                {candidats.length === 1 && (
                  <button className="btn-ghost" onClick={() => handleLancerBesoin(besoin, candidats[0])}>Lancer la fabrication</button>
                )}
                {candidats.length > 1 && (
                  <select onChange={(event) => { const modele = candidats.find((m) => m.id === Number(event.target.value)); if (modele) handleLancerBesoin(besoin, modele) }} defaultValue="">
                    <option value="" disabled>Lancer avec…</option>
                    {candidats.map((modele) => <option key={modele.id} value={modele.id}>{modele.name}</option>)}
                  </select>
                )}
              </p>
            )
          })}
        </div>
      )}

      {rendementParModele.length > 0 && (
        <div className="table-panel" style={{ marginBottom: 16 }}>
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Modèle</th><th>Fabrications terminées</th><th>Rendement moyen</th><th>Dernier rendement</th></tr></thead>
              <tbody>
                {rendementParModele.map((ligne) => (
                  <tr key={ligne.modeleNom}>
                    <td>{ligne.modeleNom}</td>
                    <td>{ligne.nombre}</td>
                    <td>{(ligne.rendementMoyen * 100).toFixed(1)} %</td>
                    <td style={{ color: ligne.dernierRendement < ligne.rendementMoyen ? 'var(--red)' : 'var(--green)' }}>{(ligne.dernierRendement * 100).toFixed(1)} %</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="toolbar-panel" style={{ justifyContent: 'flex-end' }}>
        <button className="btn-primary" onClick={() => { setBesoinPrefill(null); setNewOpen(true) }}><Plus size={14} /> Nouvelle fabrication</button>
      </div>

      <div className="store-card-grid">
        {!loading && fabrications.length === 0 && <p className="table-empty">Aucune fabrication pour l&apos;instant.</p>}
        {fabrications.map((fabrication) => (
          <article className="store-card" key={fabrication.id}>
            <div className="store-card-head">
              <span className="store-card-icon"><Wrench aria-hidden="true" /></span>
              <div><strong>{fabrication.numero}</strong><span>{fabrication.modeleNom} · {fabrication.metrageEngage} m</span></div>
            </div>
            <div className="store-card-stats">
              <div><label>Statut</label><b><span className={`badge ${ETAT_BADGES[fabrication.etat]}`}>{ETAT_LABELS[fabrication.etat]}</span></b></div>
              <div><label>{fabrication.resultat ? 'Pièces conformes' : 'Prévision'}</label><b>{fabrication.resultat ? fabrication.resultat.piecesConformes : fabrication.prevision.piecesTheoriques} pièces</b></div>
              {fabrication.resultat && (
                <>
                  <div><label>Rendement</label><b>{(fabrication.resultat.rendement * 100).toFixed(1)} %</b></div>
                  <div><label>Écart vs prévision</label><b style={{ color: fabrication.resultat.ecart < 0 ? 'var(--red)' : 'var(--green)' }}>{fabrication.resultat.ecart >= 0 ? '+' : ''}{fabrication.resultat.ecart}</b></div>
                </>
              )}
            </div>
            {fabrication.resultat && (
              <div className="store-card-actions" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4, fontSize: 11, color: 'var(--muted)' }}>
                <span style={{ fontWeight: 700, color: 'var(--ink)' }}>Consommé :</span>
                <span>{fabrication.resultat.piecesBrutes} {articleName(fabrication.tubeArticleId)}</span>
                {fabrication.resultat.cartonsReel > 0 && <span>{fabrication.resultat.cartonsReel} {articleName(fabrication.cartonArticleId)}</span>}
                {fabrication.resultat.plastiqueKgConsomme > 0 && <span>{fabrication.resultat.plastiqueKgConsomme.toFixed(2)} kg {articleName(fabrication.plastiqueArticleId)}</span>}
              </div>
            )}
            {fabrication.etat === 'ouverte' && (
              <div className="store-card-actions">
                <button className="btn-ghost" onClick={() => setResultatFor(fabrication)}>Saisir le résultat</button>
                <button className="btn-ghost" onClick={() => handleAnnuler(fabrication.id)}>Annuler</button>
              </div>
            )}
          </article>
        ))}
      </div>

      <Modal open={newOpen} onClose={() => { setNewOpen(false); setBesoinPrefill(null) }} title="Nouvelle fabrication">
        <NewFabricationForm modeles={modeles} onCreated={refresh} initialModeleId={besoinPrefill?.modeleId} initialMetrage={besoinPrefill?.metrage} />
      </Modal>
      <Modal open={resultatFor !== null} onClose={() => setResultatFor(null)} title={`Résultat — ${resultatFor?.numero ?? ''}`} wide>
        {resultatFor && <ResultatForm fabrication={resultatFor} articleOptions={articleOptions} onDone={refresh} />}
      </Modal>
    </AppShell>
  )
}

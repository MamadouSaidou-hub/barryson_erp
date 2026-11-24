'use client'

import { Fragment, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil } from 'lucide-react'
import { AppShell } from '@/components/app-shell'
import { fetchJson } from '@/lib/fetch-json'

type CommandeDetail = {
  numero: string
  fournisseurName: string
  etat: string
  lignes: { id: number; nomAffiche: string; articleUnit: string; quantite: number; quantiteAcceptee: number }[]
}

type LigneState = {
  commandeLigneId: number
  nomAffiche: string
  unit: string
  commande: number
  dejaRecu: number
  reste: number
  quantiteRecue: string
  conforme: boolean
  editing: boolean
  quantiteAccepteeOverride: string
  motifEcart: string
}

export function RecevoirDetailView({ commandeId }: { commandeId: number }) {
  const router = useRouter()
  const [commande, setCommande] = useState<CommandeDetail | null>(null)
  const [lignes, setLignes] = useState<LigneState[]>([])
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [referenceDocument, setReferenceDocument] = useState('')
  const [documentsConformes, setDocumentsConformes] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetchJson<{ commande: CommandeDetail }>(`/api/commandes/${commandeId}`).then((res) => {
      setCommande(res.commande)
      setLignes(
        res.commande.lignes.map((ligne) => {
          const reste = ligne.quantite - ligne.quantiteAcceptee
          return {
            commandeLigneId: ligne.id,
            nomAffiche: ligne.nomAffiche,
            unit: ligne.articleUnit,
            commande: ligne.quantite,
            dejaRecu: ligne.quantiteAcceptee,
            reste,
            quantiteRecue: reste > 0 ? String(reste) : '0',
            conforme: true,
            editing: false,
            quantiteAccepteeOverride: '0',
            motifEcart: '',
          }
        }),
      )
    })
  }, [commandeId])

  function updateLigne(commandeLigneId: number, patch: Partial<LigneState>) {
    setLignes((value) => value.map((ligne) => (ligne.commandeLigneId === commandeLigneId ? { ...ligne, ...patch } : ligne)))
  }

  function ouvrirCorrection(ligne: LigneState) {
    updateLigne(ligne.commandeLigneId, { conforme: false, editing: true, quantiteAccepteeOverride: ligne.quantiteRecue })
  }

  function annulerCorrection(ligne: LigneState) {
    updateLigne(ligne.commandeLigneId, { conforme: true, editing: false, motifEcart: '' })
  }

  function toutCocher() {
    setLignes((value) => value.map((ligne) => ({ ...ligne, conforme: true, editing: false, motifEcart: '' })))
  }

  async function submit(overrideLignes?: LigneState[]) {
    setError('')
    setSubmitting(true)
    try {
      const source = overrideLignes ?? lignes
      const payload = {
        date,
        referenceDocument: referenceDocument || undefined,
        documentsConformes,
        lignes: source
          .filter((ligne) => Number(ligne.quantiteRecue) > 0 || !ligne.conforme)
          .map((ligne) => ({
            commandeLigneId: ligne.commandeLigneId,
            quantiteRecue: Number(ligne.quantiteRecue) || 0,
            quantiteAcceptee: ligne.conforme ? Number(ligne.quantiteRecue) || 0 : Number(ligne.quantiteAccepteeOverride) || 0,
            motifEcart: ligne.conforme ? undefined : ligne.motifEcart || 'Non conforme',
          })),
      }
      const res = await fetch(`/api/commandes/${commandeId}/receptions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Une erreur est survenue.')
        return
      }
      router.push('/recevoir')
    } finally {
      setSubmitting(false)
    }
  }

  function refuserTout() {
    const motif = prompt('Quel est le problème ?') ?? ''
    if (!motif) return
    const refusedLignes = lignes.map((ligne) => ({ ...ligne, conforme: false, quantiteAccepteeOverride: '0', motifEcart: motif }))
    setLignes(refusedLignes)
    submit(refusedLignes)
  }

  if (!commande) return <AppShell breadcrumb="Achats" section="Recevoir"><p>Chargement...</p></AppShell>

  return (
    <AppShell breadcrumb="Achats" section={`Recevoir — ${commande.numero}`}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ACHATS</p>
          <h1>Recevoir <span>{commande.numero}</span></h1>
          <p className="heading-subtitle">{commande.fournisseurName}</p>
        </div>
      </div>
      {error && <p className="form-error">{error}</p>}

      <div className="table-panel" style={{ marginBottom: 16 }}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Produit</th><th>Commandé</th><th>Déjà reçu</th><th>Reçu</th><th>Statut</th><th></th></tr>
            </thead>
            <tbody>
              {lignes.map((ligne) => (
                <Fragment key={ligne.commandeLigneId}>
                  <tr>
                    <td>{ligne.nomAffiche}</td>
                    <td>{ligne.commande} {ligne.unit}</td>
                    <td>{ligne.dejaRecu} {ligne.unit}</td>
                    <td>
                      <input
                        type="number"
                        style={{ width: 90 }}
                        value={ligne.quantiteRecue}
                        onChange={(event) => updateLigne(ligne.commandeLigneId, { quantiteRecue: event.target.value })}
                      />
                    </td>
                    <td>
                      <span className={`badge ${ligne.conforme ? 'badge-green' : 'badge-red'}`}>{ligne.conforme ? 'Conforme' : 'Non conforme'}</span>
                    </td>
                    <td>
                      {ligne.conforme ? (
                        <button type="button" className="btn-ghost" onClick={() => ouvrirCorrection(ligne)}><Pencil size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Modifier</button>
                      ) : (
                        <button type="button" className="btn-ghost" onClick={() => annulerCorrection(ligne)}>Marquer conforme</button>
                      )}
                    </td>
                  </tr>
                  {ligne.editing && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--surface-alt)' }}>
                        <div className="form-row" style={{ margin: '8px 0' }}>
                          <div className="form-field">
                            <label>Quantité conforme à garder ({ligne.unit})</label>
                            <input
                              type="number"
                              value={ligne.quantiteAccepteeOverride}
                              onChange={(event) => updateLigne(ligne.commandeLigneId, { quantiteAccepteeOverride: event.target.value })}
                            />
                          </div>
                          <div className="form-field">
                            <label>Quel problème ?</label>
                            <input value={ligne.motifEcart} onChange={(event) => updateLigne(ligne.commandeLigneId, { motifEcart: event.target.value })} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="form-row">
        <div className="form-field"><label>Date</label><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
        <div className="form-field"><label>Numéro de facture / conteneur (optionnel)</label><input value={referenceDocument} onChange={(event) => setReferenceDocument(event.target.value)} /></div>
      </div>
      <div className="form-field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, flexDirection: 'row' }}>
          <input type="checkbox" checked={documentsConformes} onChange={(event) => setDocumentsConformes(event.target.checked)} />
          Documents conformes (facture, packing list)
        </label>
      </div>

      <div className="form-actions" style={{ justifyContent: 'space-between' }}>
        <div>
          <button type="button" className="btn-secondary" onClick={toutCocher} disabled={submitting}>Tout cocher</button>
          <button type="button" className="btn-ghost" onClick={refuserTout} disabled={submitting}>Refuser toute la marchandise</button>
        </div>
        <button type="button" className="btn-primary" onClick={() => submit()} disabled={submitting}>
          {submitting ? 'Enregistrement...' : 'Tout est conforme : enregistrer en stock'}
        </button>
      </div>
    </AppShell>
  )
}

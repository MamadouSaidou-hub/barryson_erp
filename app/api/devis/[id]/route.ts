import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess, canReadVentes } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getDevisDetail } from '@/lib/db/queries/devis'
import { updateDevis } from '@/lib/db/mutations/devis'
import type { CommandeClientLigneInput } from '@/lib/db/mutations/ventes'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canReadVentes(ctx.role)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const { id } = await params
  const devis = await getDevisDetail(Number(id))
  if (!devis) return NextResponse.json({ error: 'Devis introuvable.' }, { status: 404 })
  return NextResponse.json({ devis })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'ventes')) return NextResponse.json({ error: 'Réservé à Ventes.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const lignesInput = Array.isArray(body.lignes) ? body.lignes : []
  const lignes: CommandeClientLigneInput[] = lignesInput.map((ligne: Record<string, unknown>) => ({
    articleId: Number(ligne.articleId),
    nomAffiche: String(ligne.nomAffiche ?? ''),
    quantite: Number(ligne.quantite),
    prixUnitaire: Number(ligne.prixUnitaire),
  }))

  try {
    const devis = await updateDevis(Number(id), {
      clientId: Number(body.clientId),
      commercial: typeof body.commercial === 'string' ? body.commercial.trim() || undefined : undefined,
      dateDevis: typeof body.dateDevis === 'string' && body.dateDevis ? body.dateDevis : new Date().toISOString().slice(0, 10),
      validiteJours: body.validiteJours !== undefined && body.validiteJours !== '' ? Number(body.validiteJours) : undefined,
      reference: typeof body.reference === 'string' ? body.reference.trim() || undefined : undefined,
      commentaire: typeof body.commentaire === 'string' ? body.commentaire.trim() || undefined : undefined,
      lignes,
    })
    return NextResponse.json({ devis })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

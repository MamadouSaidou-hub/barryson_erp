import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getCommandeDetail } from '@/lib/db/queries/commandes'
import { updateCommande, type CommandeLigneInput } from '@/lib/db/mutations/commandes'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'commander') && !canAccess(ctx.role, 'recevoir')) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const { id } = await params
  const commande = await getCommandeDetail(Number(id))
  if (!commande) return NextResponse.json({ error: 'Commande introuvable.' }, { status: 404 })
  return NextResponse.json({ commande })
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'commander')) return NextResponse.json({ error: 'Réservé à Commander.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const lignesInput = Array.isArray(body.lignes) ? body.lignes : []
  const lignes: CommandeLigneInput[] = lignesInput.map((ligne: Record<string, unknown>) => ({
    articleId: Number(ligne.articleId),
    catalogueProduitId: ligne.catalogueProduitId ? Number(ligne.catalogueProduitId) : undefined,
    nomAffiche: String(ligne.nomAffiche ?? ''),
    description: typeof ligne.description === 'string' ? ligne.description : undefined,
    quantite: Number(ligne.quantite),
    prixUnitaire: ligne.prixUnitaire !== undefined && ligne.prixUnitaire !== '' ? Number(ligne.prixUnitaire) : undefined,
    finish: typeof ligne.finish === 'string' ? ligne.finish : undefined,
  }))

  try {
    const commande = await updateCommande(Number(id), {
      fournisseurId: Number(body.fournisseurId),
      devise: String(body.devise ?? ''),
      tauxChange: body.tauxChange !== undefined && body.tauxChange !== '' ? Number(body.tauxChange) : undefined,
      dateArriveePrevue: typeof body.dateArriveePrevue === 'string' && body.dateArriveePrevue ? body.dateArriveePrevue : undefined,
      reference: typeof body.reference === 'string' ? body.reference.trim() || undefined : undefined,
      commentaire: typeof body.commentaire === 'string' ? body.commentaire.trim() || undefined : undefined,
      lignes,
    })
    return NextResponse.json({ commande })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getCommandesList } from '@/lib/db/queries/commandes'
import { createCommande, type CommandeLigneInput } from '@/lib/db/mutations/commandes'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'commander') && !canAccess(ctx.role, 'recevoir')) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  return NextResponse.json({ commandes: await getCommandesList() })
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'commander')) return NextResponse.json({ error: 'Réservé à Commander.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const fournisseurId = Number(body.fournisseurId)
  const devise = typeof body.devise === 'string' ? body.devise.trim() : ''
  const lignesInput = Array.isArray(body.lignes) ? body.lignes : []

  if (!Number.isFinite(fournisseurId)) return NextResponse.json({ error: 'Choisissez un fournisseur.' }, { status: 400 })
  if (!devise) return NextResponse.json({ error: 'La devise est obligatoire.' }, { status: 400 })

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
    const commande = await createCommande({
      fournisseurId,
      devise,
      tauxChange: body.tauxChange !== undefined && body.tauxChange !== '' ? Number(body.tauxChange) : undefined,
      dateArriveePrevue: typeof body.dateArriveePrevue === 'string' && body.dateArriveePrevue ? body.dateArriveePrevue : undefined,
      reference: typeof body.reference === 'string' ? body.reference.trim() || undefined : undefined,
      commentaire: typeof body.commentaire === 'string' ? body.commentaire.trim() || undefined : undefined,
      lignes,
    })
    return NextResponse.json({ commande }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

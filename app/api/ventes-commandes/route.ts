import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canReadVentes, canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getCommandesClientsList } from '@/lib/db/queries/ventes'
import { createCommandeClient, type CommandeClientLigneInput } from '@/lib/db/mutations/ventes'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canReadVentes(ctx.role)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  return NextResponse.json({ commandes: await getCommandesClientsList() })
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'ventes')) return NextResponse.json({ error: 'Réservé à Ventes.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const clientId = Number(body.clientId)
  const lignesInput = Array.isArray(body.lignes) ? body.lignes : []

  if (!Number.isFinite(clientId)) return NextResponse.json({ error: 'Choisissez un client.' }, { status: 400 })

  const lignes: CommandeClientLigneInput[] = lignesInput.map((ligne: Record<string, unknown>) => ({
    articleId: Number(ligne.articleId),
    nomAffiche: String(ligne.nomAffiche ?? ''),
    quantite: Number(ligne.quantite),
    prixUnitaire: Number(ligne.prixUnitaire),
  }))

  try {
    const commande = await createCommandeClient({
      clientId,
      commercial: typeof body.commercial === 'string' ? body.commercial.trim() || undefined : undefined,
      dateCommande: typeof body.dateCommande === 'string' && body.dateCommande ? body.dateCommande : new Date().toISOString().slice(0, 10),
      reference: typeof body.reference === 'string' ? body.reference.trim() || undefined : undefined,
      commentaire: typeof body.commentaire === 'string' ? body.commentaire.trim() || undefined : undefined,
      lignes,
    })
    return NextResponse.json({ commande }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

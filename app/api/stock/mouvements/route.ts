import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getStockHistory } from '@/lib/db/queries/stock'
import { recordManualStockMovement } from '@/lib/db/mutations/stock'

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'stock')) return NextResponse.json({ error: 'Réservé au Stock.' }, { status: 403 })

  const articleId = new URL(request.url).searchParams.get('articleId')
  const mouvements = await getStockHistory(articleId ? Number(articleId) : undefined)
  return NextResponse.json({ mouvements })
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'stock')) return NextResponse.json({ error: 'Réservé au Stock.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const articleId = Number(body.articleId)
  const direction = body.direction
  const quantite = Number(body.quantite)

  if (!Number.isFinite(articleId)) return NextResponse.json({ error: 'Choisissez un article.' }, { status: 400 })
  if (direction !== 'entree' && direction !== 'sortie') return NextResponse.json({ error: 'Mouvement invalide.' }, { status: 400 })
  if (!Number.isFinite(quantite) || quantite <= 0) return NextResponse.json({ error: 'La quantité doit être positive.' }, { status: 400 })

  try {
    const mouvement = await recordManualStockMovement(
      { articleId, direction, quantite, motif: typeof body.motif === 'string' ? body.motif.trim() || undefined : undefined },
      { userId: ctx.userId, userName: ctx.userName },
    )
    return NextResponse.json({ mouvement }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { createLivraisonClient, type LivraisonClientLigneInput } from '@/lib/db/mutations/ventes'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'ventes')) return NextResponse.json({ error: 'Réservé à Ventes.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const lignesInput = Array.isArray(body.lignes) ? body.lignes : []
  const lignes: LivraisonClientLigneInput[] = lignesInput.map((ligne: Record<string, unknown>) => ({
    commandeClientLigneId: Number(ligne.commandeClientLigneId),
    quantiteLivree: Number(ligne.quantiteLivree),
  }))

  try {
    const livraison = await createLivraisonClient(
      { commandeClientId: Number(id), date: typeof body.date === 'string' && body.date ? body.date : new Date().toISOString().slice(0, 10), lignes },
      { userId: ctx.userId, userName: ctx.userName },
    )
    return NextResponse.json({ livraison }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

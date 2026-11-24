import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { annulerCommandeClient } from '@/lib/db/mutations/ventes'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'ventes')) return NextResponse.json({ error: 'Réservé à Ventes.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const reason = typeof body.reason === 'string' && body.reason.trim() ? body.reason.trim() : undefined

  try {
    const commande = await annulerCommandeClient(Number(id), { userId: ctx.userId, userName: ctx.userName }, reason)
    return NextResponse.json({ commande })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

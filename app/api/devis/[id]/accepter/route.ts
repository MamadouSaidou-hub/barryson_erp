import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { accepterDevis } from '@/lib/db/mutations/devis'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'ventes')) return NextResponse.json({ error: 'Réservé à Ventes.' }, { status: 403 })

  const { id } = await params
  try {
    const result = await accepterDevis(Number(id), { userId: ctx.userId, userName: ctx.userName })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

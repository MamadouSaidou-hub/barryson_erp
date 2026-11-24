import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { refuserDevis } from '@/lib/db/mutations/devis'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'ventes')) return NextResponse.json({ error: 'Réservé à Ventes.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  try {
    const devis = await refuserDevis(Number(id), { userId: ctx.userId, userName: ctx.userName }, typeof body.reason === 'string' ? body.reason : undefined)
    return NextResponse.json({ devis })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

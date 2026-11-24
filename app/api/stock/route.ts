import { NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { getStockOverview } from '@/lib/db/queries/stock'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'stock')) return NextResponse.json({ error: 'Réservé au Stock.' }, { status: 403 })

  return NextResponse.json({ items: await getStockOverview() })
}

import { NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { getBesoinsFabricationList } from '@/lib/db/queries/besoins-fabrication'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'production') && !canAccess(ctx.role, 'cockpit_dg')) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  return NextResponse.json({ besoins: await getBesoinsFabricationList() })
}

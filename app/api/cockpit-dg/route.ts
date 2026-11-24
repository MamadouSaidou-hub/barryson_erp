import { NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { getCockpitDGSummary } from '@/lib/db/queries/cockpit'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'cockpit_dg')) return NextResponse.json({ error: 'Réservé au Cockpit DG.' }, { status: 403 })

  return NextResponse.json(await getCockpitDGSummary())
}

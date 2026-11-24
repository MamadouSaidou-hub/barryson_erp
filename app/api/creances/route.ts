import { NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canReadVentes } from '@/lib/permissions'
import { getCreancesList } from '@/lib/db/queries/ventes'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canReadVentes(ctx.role)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  return NextResponse.json({ creances: await getCreancesList() })
}

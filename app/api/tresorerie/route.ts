import { NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { getTresorerieVentes } from '@/lib/db/queries/ventes'
import { getTresorerieAchats } from '@/lib/db/queries/commandes'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'tresorerie')) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const [ventes, achats] = await Promise.all([getTresorerieVentes(), getTresorerieAchats()])
  return NextResponse.json({ ventes, achats })
}

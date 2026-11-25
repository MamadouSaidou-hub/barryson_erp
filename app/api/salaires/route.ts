import { NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { hasSalaryAccess } from '@/lib/permissions'
import { getSalairesList } from '@/lib/db/queries/salaires'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!hasSalaryAccess(ctx.role)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  return NextResponse.json({ salaires: await getSalairesList() })
}

import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { hasSalaryAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { setSalaireBase } from '@/lib/db/mutations/salaires'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ employeId: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!hasSalaryAccess(ctx.role)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const { employeId } = await params
  const body = await request.json().catch(() => ({}))
  const salaireBase = Number(body.salaireBase)
  if (!Number.isFinite(salaireBase) || salaireBase <= 0) return NextResponse.json({ error: 'Le salaire de base doit être positif.' }, { status: 400 })

  try {
    const salaire = await setSalaireBase(Number(employeId), salaireBase)
    return NextResponse.json({ salaire })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

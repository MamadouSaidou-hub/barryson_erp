import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getFabricationsList } from '@/lib/db/queries/production'
import { createFabrication } from '@/lib/db/mutations/production'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'production')) return NextResponse.json({ error: 'Réservé à Production.' }, { status: 403 })

  return NextResponse.json({ fabrications: await getFabricationsList() })
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'production')) return NextResponse.json({ error: 'Réservé à Production.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const modeleRubanId = Number(body.modeleRubanId)
  const metrageEngage = Number(body.metrageEngage)
  const dateDebut = typeof body.dateDebut === 'string' && body.dateDebut ? body.dateDebut : new Date().toISOString().slice(0, 10)

  if (!Number.isFinite(modeleRubanId)) return NextResponse.json({ error: 'Choisissez un modèle de ruban.' }, { status: 400 })
  if (!Number.isFinite(metrageEngage) || metrageEngage <= 0) return NextResponse.json({ error: 'Le métrage engagé doit être positif.' }, { status: 400 })

  try {
    const fabrication = await createFabrication({ modeleRubanId, metrageEngage, dateDebut }, { userId: ctx.userId, userName: ctx.userName })
    return NextResponse.json({ fabrication }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

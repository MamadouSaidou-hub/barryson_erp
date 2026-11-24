import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess, canReadVentes } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { enregistrerRelanceClient, getRelancesClient } from '@/lib/db/mutations/relances-clients'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canReadVentes(ctx.role)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const { id } = await params
  return NextResponse.json({ relances: await getRelancesClient(Number(id)) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'ventes')) return NextResponse.json({ error: 'Réservé à Ventes.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const niveau = Number(body.niveau)
  const canal = typeof body.canal === 'string' ? body.canal.trim() : ''
  const date = typeof body.date === 'string' && body.date ? body.date : new Date().toISOString().slice(0, 10)

  if (![1, 2, 3].includes(niveau)) return NextResponse.json({ error: 'Niveau de relance invalide.' }, { status: 400 })
  if (!canal) return NextResponse.json({ error: 'Indiquez le canal utilisé.' }, { status: 400 })

  try {
    const relance = await enregistrerRelanceClient(
      Number(id),
      { niveau: niveau as 1 | 2 | 3, canal, commentaire: typeof body.commentaire === 'string' ? body.commentaire.trim() || undefined : undefined, date },
      { userId: ctx.userId, userName: ctx.userName },
    )
    return NextResponse.json({ relance }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

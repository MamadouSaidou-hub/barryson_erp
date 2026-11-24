import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getActiveClientOptions, getClientsList } from '@/lib/db/queries/clients'
import { createClient } from '@/lib/db/mutations/clients'

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const activeOnly = new URL(request.url).searchParams.get('actifs') === '1'
  if (activeOnly) {
    if (!canAccess(ctx.role, 'ventes')) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
    return NextResponse.json({ clients: await getActiveClientOptions() })
  }

  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })
  return NextResponse.json({ clients: await getClientsList() })
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages') && !canAccess(ctx.role, 'ventes')) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 })

  try {
    const client = await createClient({
      name,
      segment: typeof body.segment === 'string' ? body.segment.trim() || undefined : undefined,
      zone: typeof body.zone === 'string' ? body.zone.trim() || undefined : undefined,
      delaiPaiementJours: Number.isFinite(Number(body.delaiPaiementJours)) && body.delaiPaiementJours !== '' ? Number(body.delaiPaiementJours) : undefined,
      plafondEncours: Number.isFinite(Number(body.plafondEncours)) && body.plafondEncours !== '' ? Number(body.plafondEncours) : undefined,
    })
    return NextResponse.json({ client }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

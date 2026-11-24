import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { setClientActive, updateClient } from '@/lib/db/mutations/clients'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })

  const { id } = await params
  const clientId = Number(id)
  if (!Number.isFinite(clientId)) return NextResponse.json({ error: 'Client invalide.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))

  try {
    if (typeof body.active === 'boolean') {
      const client = await setClientActive(clientId, body.active)
      return NextResponse.json({ client })
    }

    const client = await updateClient(clientId, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      segment: body.segment ?? undefined,
      zone: body.zone ?? undefined,
      delaiPaiementJours: body.delaiPaiementJours === '' || body.delaiPaiementJours === null ? null : Number(body.delaiPaiementJours),
      plafondEncours: body.plafondEncours === '' || body.plafondEncours === null ? null : Number(body.plafondEncours),
    })
    return NextResponse.json({ client })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

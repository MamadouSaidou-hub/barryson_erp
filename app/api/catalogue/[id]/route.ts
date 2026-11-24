import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { updateCatalogueProduit } from '@/lib/db/mutations/catalogue'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })

  const { id } = await params
  const catalogueId = Number(id)
  if (!Number.isFinite(catalogueId)) return NextResponse.json({ error: 'Produit du catalogue invalide.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))

  try {
    const catalogueProduit = await updateCatalogueProduit(catalogueId, {
      label: typeof body.label === 'string' ? body.label.trim() : undefined,
      finish: body.finish ?? undefined,
      supplierRef: body.supplierRef ?? undefined,
      typicalNetWeightKg: body.typicalNetWeightKg === '' || body.typicalNetWeightKg === null ? undefined : Number(body.typicalNetWeightKg),
      typicalLengthM: body.typicalLengthM === '' || body.typicalLengthM === null ? undefined : Number(body.typicalLengthM),
      usualPrice: body.usualPrice === '' || body.usualPrice === null ? undefined : Number(body.usualPrice),
      usualCurrency: body.usualCurrency ?? undefined,
    })
    return NextResponse.json({ catalogueProduit })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

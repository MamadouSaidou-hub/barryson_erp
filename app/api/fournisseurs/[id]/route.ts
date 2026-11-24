import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { setFournisseurActive, updateFournisseur } from '@/lib/db/mutations/fournisseurs'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })

  const { id } = await params
  const fournisseurId = Number(id)
  if (!Number.isFinite(fournisseurId)) return NextResponse.json({ error: 'Fournisseur invalide.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))

  try {
    if (typeof body.active === 'boolean') {
      const fournisseur = await setFournisseurActive(fournisseurId, body.active)
      return NextResponse.json({ fournisseur })
    }

    const fournisseur = await updateFournisseur(fournisseurId, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      country: body.country ?? undefined,
      phone: body.phone ?? undefined,
      email: body.email ?? undefined,
      address: body.address ?? undefined,
      paymentTerms: body.paymentTerms ?? undefined,
      leadTimeDays: body.leadTimeDays === '' || body.leadTimeDays === null ? null : Number(body.leadTimeDays),
    })
    return NextResponse.json({ fournisseur })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

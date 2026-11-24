import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getFournisseursList, getActiveFournisseurOptions } from '@/lib/db/queries/fournisseurs'
import { createFournisseur } from '@/lib/db/mutations/fournisseurs'

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  // Les options actives pour le sélecteur "Pour quel fournisseur ?" de Commander (§5.2) sont
  // accessibles à qui peut commander ; la liste complète (avec inactifs) reste réservée aux
  // réglages.
  const activeOnly = new URL(request.url).searchParams.get('actifs') === '1'
  if (activeOnly) {
    if (!canAccess(ctx.role, 'commander')) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
    return NextResponse.json({ fournisseurs: await getActiveFournisseurOptions() })
  }

  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })
  return NextResponse.json({ fournisseurs: await getFournisseursList() })
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  // Un fournisseur peut être créé depuis les réglages ou "sur place" pendant une commande (§5.2
  // point 5) — les deux rôles autorisés à commander ou aux réglages peuvent donc créer.
  if (!canAccess(ctx.role, 'reglages') && !canAccess(ctx.role, 'commander')) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 })

  try {
    const fournisseur = await createFournisseur({
      name,
      country: typeof body.country === 'string' ? body.country.trim() || undefined : undefined,
      phone: typeof body.phone === 'string' ? body.phone.trim() || undefined : undefined,
      email: typeof body.email === 'string' ? body.email.trim() || undefined : undefined,
      address: typeof body.address === 'string' ? body.address.trim() || undefined : undefined,
      paymentTerms: typeof body.paymentTerms === 'string' ? body.paymentTerms.trim() || undefined : undefined,
      leadTimeDays: Number.isFinite(Number(body.leadTimeDays)) && body.leadTimeDays !== '' ? Number(body.leadTimeDays) : undefined,
    })
    return NextResponse.json({ fournisseur }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

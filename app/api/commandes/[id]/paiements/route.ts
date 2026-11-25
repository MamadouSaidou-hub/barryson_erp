import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { enregistrerPaiementFournisseur } from '@/lib/db/mutations/commandes'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'commander')) return NextResponse.json({ error: 'Réservé à Commander.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const montant = Number(body.montant)
  const methode = typeof body.methode === 'string' ? body.methode.trim() : ''
  const date = typeof body.date === 'string' && body.date ? body.date : new Date().toISOString().slice(0, 10)

  if (!Number.isFinite(montant) || montant <= 0) return NextResponse.json({ error: 'Le montant doit être positif.' }, { status: 400 })
  if (!methode) return NextResponse.json({ error: 'Choisissez un mode de règlement.' }, { status: 400 })

  try {
    const paiement = await enregistrerPaiementFournisseur(Number(id), { montant, methode, date })
    return NextResponse.json({ paiement }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

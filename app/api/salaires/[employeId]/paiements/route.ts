import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { hasSalaryAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { enregistrerPaiementSalaire } from '@/lib/db/mutations/salaires'
import { getPaiementsSalaire } from '@/lib/db/queries/salaires'

export async function GET(request: NextRequest, { params }: { params: Promise<{ employeId: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!hasSalaryAccess(ctx.role)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const { employeId } = await params
  return NextResponse.json({ paiements: await getPaiementsSalaire(Number(employeId)) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ employeId: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!hasSalaryAccess(ctx.role)) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })

  const { employeId } = await params
  const body = await request.json().catch(() => ({}))
  const montant = Number(body.montant)
  const periode = typeof body.periode === 'string' ? body.periode.trim() : ''
  const methode = typeof body.methode === 'string' ? body.methode.trim() : ''
  const date = typeof body.date === 'string' && body.date ? body.date : new Date().toISOString().slice(0, 10)

  if (!Number.isFinite(montant) || montant <= 0) return NextResponse.json({ error: 'Le montant doit être positif.' }, { status: 400 })
  if (!methode) return NextResponse.json({ error: 'Choisissez un mode de règlement.' }, { status: 400 })

  try {
    const paiement = await enregistrerPaiementSalaire(Number(employeId), { montant, periode, methode, date })
    return NextResponse.json({ paiement }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

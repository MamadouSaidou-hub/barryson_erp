import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { enregistrerRetourDoctorRewinder } from '@/lib/db/mutations/production'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'doctor_rewinder')) return NextResponse.json({ error: 'Réservé à Doctor Rewinder.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const quantiteRecuperee = Number(body.quantiteRecuperee)
  const quantitePerdue = Number(body.quantitePerdue)

  if (!Number.isFinite(quantiteRecuperee) || !Number.isFinite(quantitePerdue)) {
    return NextResponse.json({ error: 'Renseignez la quantité récupérée et la quantité perdue.' }, { status: 400 })
  }

  try {
    const dossier = await enregistrerRetourDoctorRewinder(Number(id), { quantiteRecuperee, quantitePerdue }, { userId: ctx.userId, userName: ctx.userName })
    return NextResponse.json({ dossier })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

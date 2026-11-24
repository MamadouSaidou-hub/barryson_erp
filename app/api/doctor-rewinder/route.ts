import { NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { getDoctorRewinderDossiers, getDoctorRewinderIndicateurs } from '@/lib/db/queries/production'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'doctor_rewinder')) return NextResponse.json({ error: 'Réservé à Doctor Rewinder.' }, { status: 403 })

  const [dossiers, indicateurs] = await Promise.all([getDoctorRewinderDossiers(), getDoctorRewinderIndicateurs()])
  return NextResponse.json({ dossiers, indicateurs })
}

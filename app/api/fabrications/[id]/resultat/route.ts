import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { enregistrerResultatFabrication } from '@/lib/db/mutations/production'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'production')) return NextResponse.json({ error: 'Réservé à Production.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))

  const toursTotal = Number(body.toursTotal)
  const toursDefectueux = Number(body.toursDefectueux)
  const piecesDefectueusesSupp = Number(body.piecesDefectueusesSupp)
  const piecesDoctorRewinder = Number(body.piecesDoctorRewinder)
  const piecesPerdues = Number(body.piecesPerdues)
  const dateResultat = typeof body.dateResultat === 'string' && body.dateResultat ? body.dateResultat : new Date().toISOString().slice(0, 10)

  if ([toursTotal, toursDefectueux, piecesDefectueusesSupp, piecesDoctorRewinder, piecesPerdues].some((n) => !Number.isFinite(n) || n < 0)) {
    return NextResponse.json({ error: 'Tous les nombres doivent être renseignés et positifs ou nuls.' }, { status: 400 })
  }

  try {
    const fabrication = await enregistrerResultatFabrication(
      Number(id),
      { toursTotal, toursDefectueux, piecesDefectueusesSupp, piecesDoctorRewinder, piecesPerdues, dateResultat },
      { userId: ctx.userId, userName: ctx.userName },
    )
    return NextResponse.json({ fabrication })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

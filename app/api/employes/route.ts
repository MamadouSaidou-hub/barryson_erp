import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getEmployesList } from '@/lib/db/queries/employes'
import { createEmploye } from '@/lib/db/mutations/employes'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'rh')) return NextResponse.json({ error: 'Réservé au RH.' }, { status: 403 })

  return NextResponse.json({ employes: await getEmployesList() })
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'rh')) return NextResponse.json({ error: 'Réservé au RH.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const poste = typeof body.poste === 'string' ? body.poste.trim() : ''
  if (!name) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 })
  if (!poste) return NextResponse.json({ error: 'Le poste est obligatoire.' }, { status: 400 })

  try {
    const employe = await createEmploye({
      name,
      poste,
      phone: typeof body.phone === 'string' ? body.phone.trim() || undefined : undefined,
      email: typeof body.email === 'string' ? body.email.trim() || undefined : undefined,
      dateEmbauche: typeof body.dateEmbauche === 'string' ? body.dateEmbauche.trim() || undefined : undefined,
    })
    return NextResponse.json({ employe }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { setEmployeActive, updateEmploye } from '@/lib/db/mutations/employes'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'rh')) return NextResponse.json({ error: 'Réservé au RH.' }, { status: 403 })

  const { id } = await params
  const employeId = Number(id)
  if (!Number.isFinite(employeId)) return NextResponse.json({ error: 'Employé invalide.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))

  try {
    if (typeof body.active === 'boolean') {
      const employe = await setEmployeActive(employeId, body.active)
      return NextResponse.json({ employe })
    }

    const employe = await updateEmploye(employeId, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      poste: typeof body.poste === 'string' ? body.poste.trim() : undefined,
      phone: body.phone ?? undefined,
      email: body.email ?? undefined,
      dateEmbauche: body.dateEmbauche ?? undefined,
    })
    return NextResponse.json({ employe })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

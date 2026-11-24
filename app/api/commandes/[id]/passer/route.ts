import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { passerCommande } from '@/lib/db/mutations/commandes'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'commander')) return NextResponse.json({ error: 'Réservé à Commander.' }, { status: 403 })

  const { id } = await params
  try {
    const commande = await passerCommande(Number(id), { userId: ctx.userId, userName: ctx.userName })
    return NextResponse.json({ commande })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

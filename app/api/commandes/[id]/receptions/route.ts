import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { createReception, type ReceptionLigneInput } from '@/lib/db/mutations/receptions'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'recevoir')) return NextResponse.json({ error: 'Réservé à Recevoir.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const lignesInput = Array.isArray(body.lignes) ? body.lignes : []

  const lignes: ReceptionLigneInput[] = lignesInput.map((ligne: Record<string, unknown>) => ({
    commandeLigneId: Number(ligne.commandeLigneId),
    quantiteRecue: Number(ligne.quantiteRecue),
    quantiteAcceptee: Number(ligne.quantiteAcceptee),
    motifEcart: typeof ligne.motifEcart === 'string' ? ligne.motifEcart.trim() || undefined : undefined,
  }))

  try {
    const reception = await createReception(
      {
        commandeId: Number(id),
        date: typeof body.date === 'string' && body.date ? body.date : new Date().toISOString().slice(0, 10),
        referenceDocument: typeof body.referenceDocument === 'string' ? body.referenceDocument.trim() || undefined : undefined,
        documentsConformes: Boolean(body.documentsConformes),
        lignes,
      },
      { userId: ctx.userId, userName: ctx.userName },
    )
    return NextResponse.json({ reception }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

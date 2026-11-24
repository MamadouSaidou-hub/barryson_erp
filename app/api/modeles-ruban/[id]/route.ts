import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { setModeleRubanActive, updateModeleRuban } from '@/lib/db/mutations/production'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })

  const { id } = await params
  const modeleId = Number(id)
  if (!Number.isFinite(modeleId)) return NextResponse.json({ error: 'Modèle invalide.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))

  try {
    if (typeof body.active === 'boolean') {
      const modele = await setModeleRubanActive(modeleId, body.active)
      return NextResponse.json({ modele })
    }

    const modele = await updateModeleRuban(modeleId, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      largeurMm: body.largeurMm !== undefined ? Number(body.largeurMm) : undefined,
      longueurRouleauM: body.longueurRouleauM !== undefined ? Number(body.longueurRouleauM) : undefined,
      piecesParTour: body.piecesParTour !== undefined ? Number(body.piecesParTour) : undefined,
      piecesParCarton: body.piecesParCarton !== undefined ? Number(body.piecesParCarton) : undefined,
      piecesParPaquet: body.piecesParPaquet === '' ? null : body.piecesParPaquet !== undefined ? Number(body.piecesParPaquet) : undefined,
      plastiqueKgParPaquet: body.plastiqueKgParPaquet === '' ? null : body.plastiqueKgParPaquet !== undefined ? Number(body.plastiqueKgParPaquet) : undefined,
      plastiqueArticleId: body.plastiqueArticleId === '' ? null : body.plastiqueArticleId !== undefined ? Number(body.plastiqueArticleId) : undefined,
      finish: body.finish === '' ? null : body.finish ?? undefined,
      moule: body.moule === '' ? null : body.moule ?? undefined,
    })
    return NextResponse.json({ modele })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getActiveModeleRubanOptions, getModelesRubanList } from '@/lib/db/queries/production'
import { createModeleRuban } from '@/lib/db/mutations/production'
import { modeleRubanFamilles } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const activeOnly = new URL(request.url).searchParams.get('actifs') === '1'
  if (activeOnly) {
    if (!canAccess(ctx.role, 'production')) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
    return NextResponse.json({ modeles: await getActiveModeleRubanOptions() })
  }

  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })
  return NextResponse.json({ modeles: await getModelesRubanList() })
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const famille = body.famille
  const largeurMm = Number(body.largeurMm)
  const longueurRouleauM = Number(body.longueurRouleauM)
  const piecesParTour = Number(body.piecesParTour)
  const piecesParCarton = Number(body.piecesParCarton)
  const bobineArticleId = Number(body.bobineArticleId)
  const tubeArticleId = Number(body.tubeArticleId)
  const cartonArticleId = Number(body.cartonArticleId)
  const produitFiniArticleId = Number(body.produitFiniArticleId)

  if (!name) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 })
  if (!modeleRubanFamilles.includes(famille)) return NextResponse.json({ error: 'Famille invalide.' }, { status: 400 })
  if (![largeurMm, longueurRouleauM, piecesParTour, piecesParCarton].every((n) => Number.isFinite(n) && n > 0)) {
    return NextResponse.json({ error: 'Largeur, longueur de rouleau, pièces par tour et pièces par carton doivent être positifs.' }, { status: 400 })
  }
  if (![bobineArticleId, tubeArticleId, cartonArticleId, produitFiniArticleId].every((n) => Number.isFinite(n))) {
    return NextResponse.json({ error: 'Choisissez un article pour la bobine, le tube, le carton et le produit fini.' }, { status: 400 })
  }

  const piecesParPaquet = body.piecesParPaquet !== undefined && body.piecesParPaquet !== '' ? Number(body.piecesParPaquet) : undefined
  const plastiqueKgParPaquet = body.plastiqueKgParPaquet !== undefined && body.plastiqueKgParPaquet !== '' ? Number(body.plastiqueKgParPaquet) : undefined
  const plastiqueArticleId = body.plastiqueArticleId !== undefined && body.plastiqueArticleId !== '' ? Number(body.plastiqueArticleId) : undefined

  try {
    const modele = await createModeleRuban({
      name,
      famille,
      largeurMm,
      longueurRouleauM,
      piecesParTour,
      piecesParCarton,
      piecesParPaquet,
      plastiqueKgParPaquet,
      finish: typeof body.finish === 'string' ? body.finish.trim() || undefined : undefined,
      moule: typeof body.moule === 'string' ? body.moule.trim() || undefined : undefined,
      bobineArticleId,
      tubeArticleId,
      cartonArticleId,
      plastiqueArticleId,
      produitFiniArticleId,
    })
    return NextResponse.json({ modele }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

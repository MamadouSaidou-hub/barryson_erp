import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getActiveCatalogueOptions, getCatalogueList } from '@/lib/db/queries/catalogue'
import { createCatalogueProduitForArticle, createCatalogueProduitWithNewArticle } from '@/lib/db/mutations/catalogue'
import { articleLevels, articleUnits } from '@/lib/db/schema'

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })

  const activeOnly = new URL(request.url).searchParams.get('actifs') === '1'
  if (activeOnly) {
    if (!canAccess(ctx.role, 'commander')) return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
    return NextResponse.json({ catalogue: await getActiveCatalogueOptions() })
  }

  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })
  return NextResponse.json({ catalogue: await getCatalogueList() })
}

// §5.2 point 4 "+ Autre produit" : crée un article à la volée et l'ajoute au catalogue — accessible
// à qui peut commander, pas seulement aux réglages, puisque ça se passe en plein milieu d'une
// commande.
export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages') && !canAccess(ctx.role, 'commander')) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const body = await request.json().catch(() => ({}))

  try {
    if (body.articleId) {
      const articleId = Number(body.articleId)
      if (!Number.isFinite(articleId)) return NextResponse.json({ error: 'Article invalide.' }, { status: 400 })
      const label = typeof body.label === 'string' && body.label.trim() ? body.label.trim() : undefined
      if (!label) return NextResponse.json({ error: 'Le libellé est obligatoire.' }, { status: 400 })
      const catalogueProduit = await createCatalogueProduitForArticle(articleId, { label, ...catalogueFieldsFromBody(body) })
      return NextResponse.json({ catalogueProduit }, { status: 201 })
    }

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const level = body.level
    const unit = body.unit
    if (!name) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 })
    if (!articleLevels.includes(level)) return NextResponse.json({ error: 'Niveau de stock invalide.' }, { status: 400 })
    if (!articleUnits.includes(unit)) return NextResponse.json({ error: 'Unité invalide.' }, { status: 400 })

    const result = await createCatalogueProduitWithNewArticle({ name, level, unit, ...catalogueFieldsFromBody(body) })
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

function catalogueFieldsFromBody(body: Record<string, unknown>) {
  return {
    finish: typeof body.finish === 'string' ? body.finish.trim() || undefined : undefined,
    supplierRef: typeof body.supplierRef === 'string' ? body.supplierRef.trim() || undefined : undefined,
    typicalNetWeightKg: Number.isFinite(Number(body.typicalNetWeightKg)) && body.typicalNetWeightKg !== '' ? Number(body.typicalNetWeightKg) : undefined,
    typicalLengthM: Number.isFinite(Number(body.typicalLengthM)) && body.typicalLengthM !== '' ? Number(body.typicalLengthM) : undefined,
    usualPrice: Number.isFinite(Number(body.usualPrice)) && body.usualPrice !== '' ? Number(body.usualPrice) : undefined,
    usualCurrency: typeof body.usualCurrency === 'string' ? body.usualCurrency.trim() || undefined : undefined,
  }
}

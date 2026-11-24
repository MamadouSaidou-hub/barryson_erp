import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getTarifsClientList } from '@/lib/db/queries/tarifs-clients'
import { removeTarifClient, setTarifClient } from '@/lib/db/mutations/tarifs-clients'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  // Le commercial doit pouvoir lire les prix pour préremplir une nouvelle commande — la gestion
  // (POST/DELETE) reste réservée aux réglages (admin/dg), comme le reste de la fiche client.
  if (!canAccess(ctx.role, 'reglages') && !canAccess(ctx.role, 'ventes')) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 403 })
  }

  const { id } = await params
  return NextResponse.json({ tarifs: await getTarifsClientList(Number(id)) })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const articleId = Number(body.articleId)
  const prixUnitaire = Number(body.prixUnitaire)
  if (!Number.isFinite(articleId)) return NextResponse.json({ error: 'Choisissez un article.' }, { status: 400 })
  if (!Number.isFinite(prixUnitaire)) return NextResponse.json({ error: 'Prix invalide.' }, { status: 400 })

  try {
    const tarif = await setTarifClient({ clientId: Number(id), articleId, prixUnitaire })
    return NextResponse.json({ tarif })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })

  const { id } = await params
  const articleId = Number(new URL(request.url).searchParams.get('articleId'))
  if (!Number.isFinite(articleId)) return NextResponse.json({ error: 'Article invalide.' }, { status: 400 })

  await removeTarifClient(Number(id), articleId)
  return NextResponse.json({ ok: true })
}

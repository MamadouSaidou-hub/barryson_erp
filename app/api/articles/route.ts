import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { getArticlesList } from '@/lib/db/queries/articles'
import { createArticle } from '@/lib/db/mutations/articles'
import { articleLevels, articleUnits } from '@/lib/db/schema'

export async function GET() {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })

  const articles = await getArticlesList()
  return NextResponse.json({ articles })
}

export async function POST(request: NextRequest) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })

  const body = await request.json().catch(() => ({}))
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const level = body.level
  const unit = body.unit
  if (!name) return NextResponse.json({ error: 'Le nom est obligatoire.' }, { status: 400 })
  if (!articleLevels.includes(level)) return NextResponse.json({ error: 'Niveau de stock invalide.' }, { status: 400 })
  if (!articleUnits.includes(unit)) return NextResponse.json({ error: 'Unité invalide.' }, { status: 400 })

  try {
    const article = await createArticle({
      name,
      level,
      unit,
      seuilMin: Number.isFinite(Number(body.seuilMin)) && body.seuilMin !== '' ? Number(body.seuilMin) : undefined,
      seuilMax: Number.isFinite(Number(body.seuilMax)) && body.seuilMax !== '' ? Number(body.seuilMax) : undefined,
    })
    return NextResponse.json({ article }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

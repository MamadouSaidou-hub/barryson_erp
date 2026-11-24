import { NextRequest, NextResponse } from 'next/server'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { toApiErrorMessage } from '@/lib/api-error'
import { setArticleActive, updateArticle } from '@/lib/db/mutations/articles'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx) return NextResponse.json({ error: 'Non authentifié.' }, { status: 401 })
  if (!canAccess(ctx.role, 'reglages')) return NextResponse.json({ error: 'Réservé aux réglages.' }, { status: 403 })

  const { id } = await params
  const articleId = Number(id)
  if (!Number.isFinite(articleId)) return NextResponse.json({ error: 'Article invalide.' }, { status: 400 })

  const body = await request.json().catch(() => ({}))

  try {
    if (typeof body.active === 'boolean') {
      const article = await setArticleActive(articleId, body.active)
      return NextResponse.json({ article })
    }

    const article = await updateArticle(articleId, {
      name: typeof body.name === 'string' ? body.name.trim() : undefined,
      seuilMin: body.seuilMin === '' || body.seuilMin === null ? null : Number(body.seuilMin),
      seuilMax: body.seuilMax === '' || body.seuilMax === null ? null : Number(body.seuilMax),
    })
    return NextResponse.json({ article })
  } catch (error) {
    return NextResponse.json({ error: toApiErrorMessage(error) }, { status: 400 })
  }
}

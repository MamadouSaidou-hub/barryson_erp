import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { RecevoirDetailView } from '@/components/recevoir-detail-view'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await getSessionContext()
  if (!ctx || !canAccess(ctx.role, 'recevoir')) notFound()
  const { id } = await params
  return <RecevoirDetailView commandeId={Number(id)} />
}

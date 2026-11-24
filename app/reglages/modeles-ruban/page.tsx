import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { ModelesRubanView } from '@/components/reglages-modeles-ruban-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canAccess(ctx.role, 'reglages')) notFound()
  return <ModelesRubanView />
}

import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { ProductionView } from '@/components/production-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canAccess(ctx.role, 'production')) notFound()
  return <ProductionView />
}

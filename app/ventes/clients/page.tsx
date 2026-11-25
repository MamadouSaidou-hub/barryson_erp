import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { ClientsPerformanceView } from '@/components/clients-performance-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canAccess(ctx.role, 'ventes')) notFound()
  return <ClientsPerformanceView />
}

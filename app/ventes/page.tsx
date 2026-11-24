import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { VentesView } from '@/components/ventes-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canAccess(ctx.role, 'ventes')) notFound()
  return <VentesView />
}

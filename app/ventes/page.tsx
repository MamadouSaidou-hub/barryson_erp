import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canReadVentes } from '@/lib/permissions'
import { VentesView } from '@/components/ventes-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canReadVentes(ctx.role)) notFound()
  return <VentesView />
}

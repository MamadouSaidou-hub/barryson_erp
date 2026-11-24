import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canReadVentes } from '@/lib/permissions'
import { CreancesView } from '@/components/creances-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canReadVentes(ctx.role)) notFound()
  return <CreancesView />
}

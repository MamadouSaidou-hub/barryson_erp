import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { RecevoirListView } from '@/components/recevoir-list-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canAccess(ctx.role, 'recevoir')) notFound()
  return <RecevoirListView />
}

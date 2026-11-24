import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { FournisseursView } from '@/components/reglages-fournisseurs-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canAccess(ctx.role, 'reglages')) notFound()
  return <FournisseursView />
}

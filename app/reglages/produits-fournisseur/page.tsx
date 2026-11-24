import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { ProduitsFournisseurView } from '@/components/reglages-catalogue-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canAccess(ctx.role, 'reglages')) notFound()
  return <ProduitsFournisseurView />
}

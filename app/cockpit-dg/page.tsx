import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { CockpitDGView } from '@/components/cockpit-dg-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canAccess(ctx.role, 'cockpit_dg')) notFound()
  return <CockpitDGView />
}

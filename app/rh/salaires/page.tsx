import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { hasSalaryAccess } from '@/lib/permissions'
import { SalairesView } from '@/components/salaires-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !hasSalaryAccess(ctx.role)) notFound()
  return <SalairesView />
}

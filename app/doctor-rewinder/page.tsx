import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess } from '@/lib/permissions'
import { DoctorRewinderView } from '@/components/doctor-rewinder-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canAccess(ctx.role, 'doctor_rewinder')) notFound()
  return <DoctorRewinderView />
}

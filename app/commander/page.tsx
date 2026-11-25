import { notFound } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canReadAchats } from '@/lib/permissions'
import { CommanderView } from '@/components/commander-view'

export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx || !canReadAchats(ctx.role)) notFound()
  return <CommanderView />
}

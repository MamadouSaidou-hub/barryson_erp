import { headers } from 'next/headers'
import { auth } from './auth'
import type { Role } from './permissions'

export type SessionContext = {
  userId: string
  userName: string
  role: Role
}

export async function getSessionContext(): Promise<SessionContext | null> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return null

  return {
    userId: session.user.id,
    userName: session.user.name ?? 'Inconnu',
    role: ((session.user as { role?: string }).role ?? 'resp_stock') as Role,
  }
}

export function isAdmin(ctx: SessionContext) {
  return ctx.role === 'admin'
}

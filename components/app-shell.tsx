'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Banknote,
  ClipboardList,
  Download,
  FileText,
  Gauge,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PackageCheck,
  Settings,
  ShoppingCart,
  Sparkles,
  Truck,
  UserRound,
  Users,
  Wallet,
  Wrench,
  X,
} from 'lucide-react'
import { authClient } from '@/lib/auth-client'
import { companyInfo } from '@/lib/company-info'
import { canAccess, canReadAchats, canReadVentes, hasSalaryAccess, ROLE_LABELS, type Role } from '@/lib/permissions'

// Menu court du cahier des charges (§4) : Accueil · Commander · Recevoir · Stock · Production ·
// Doctor Rewinder (si droit), puis Réglages. Ventes/Créances (§10) viennent après le noyau
// usine. `moduleKey: 'ventes_read'`/`'commander_read'` sont des cas spéciaux gérés par
// `visible()` ci-dessous : le comptable voit Ventes/Commander/Créances en lecture seule sans
// avoir le reste de l'accès `ventes`/`commander` (les boutons de mutation sont eux-mêmes masqués
// dans chaque vue, cf. `VentesView`/`CommanderView`/`CreancesView`).
const navItems = [
  { href: '/', label: 'Accueil', icon: LayoutDashboard, moduleKey: null as string | null },
  { href: '/commander', label: 'Commander', icon: ClipboardList, moduleKey: 'commander_read' as string | null },
  { href: '/recevoir', label: 'Recevoir', icon: PackageCheck, moduleKey: 'recevoir' as string | null },
  { href: '/stock', label: 'Stock', icon: Package, moduleKey: 'stock' as string | null },
  { href: '/production', label: 'Production', icon: Wrench, moduleKey: 'production' as string | null },
  { href: '/doctor-rewinder', label: 'Doctor Rewinder', icon: Sparkles, moduleKey: 'doctor_rewinder' as string | null },
  { href: '/devis', label: 'Devis', icon: FileText, moduleKey: 'ventes' as string | null },
  { href: '/ventes', label: 'Ventes', icon: ShoppingCart, moduleKey: 'ventes_read' as string | null },
  { href: '/ventes/clients', label: 'Clients', icon: Users, moduleKey: 'ventes' as string | null },
  { href: '/creances', label: 'Créances', icon: Wallet, moduleKey: 'ventes_read' as string | null },
  { href: '/tresorerie', label: 'Trésorerie', icon: Wallet, moduleKey: 'tresorerie' as string | null },
  { href: '/cockpit-dg', label: 'Cockpit DG', icon: Gauge, moduleKey: 'cockpit_dg' as string | null },
  { href: '/rh', label: 'Employés', icon: UserRound, moduleKey: 'rh' as string | null },
  { href: '/rh/salaires', label: 'Salaires', icon: Banknote, moduleKey: 'salaires' as string | null },
]

const reglagesItems = [
  { href: '/reglages/clients', label: 'Clients', icon: Users, moduleKey: 'reglages' as const },
  { href: '/reglages/fournisseurs', label: 'Fournisseurs', icon: Truck, moduleKey: 'reglages' as const },
  { href: '/reglages/produits-fournisseur', label: 'Produits du fournisseur', icon: Settings, moduleKey: 'reglages' as const },
  { href: '/reglages/articles-fournisseurs', label: 'Articles', icon: Settings, moduleKey: 'reglages' as const },
  { href: '/reglages/modeles-ruban', label: 'Modèles de ruban', icon: Settings, moduleKey: 'reglages' as const },
]

function UserChip() {
  const router = useRouter()
  const { data: session } = authClient.useSession()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const name = session?.user?.name ?? '…'
  const role = ((session?.user as { role?: string })?.role ?? 'resp_stock') as Role
  const roleLabel = ROLE_LABELS[role] ?? role
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  async function handleLogout() {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="user-chip"
        style={{ border: 0, background: 'none', width: '100%', cursor: 'pointer', font: 'inherit', textAlign: 'left' }}
        onClick={() => setOpen((value) => !value)}
      >
        <div className="avatar">{initials || '…'}</div>
        <div><strong>{name}</strong><span>{roleLabel}</span></div>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: 0,
            right: 0,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            marginBottom: 6,
            overflow: 'hidden',
            boxShadow: '0 4px 14px rgba(16,25,41,.25)',
          }}
        >
          <button type="button" className="nav-link" onClick={handleLogout}>
            <LogOut size={16} />Se déconnecter
          </button>
        </div>
      )}
    </div>
  )
}

export function AppShell({
  breadcrumb,
  section,
  children,
  onExport,
}: {
  breadcrumb: string
  section: string
  children: ReactNode
  onExport?: () => void
}) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const { data: session } = authClient.useSession()
  const role = ((session?.user as { role?: string })?.role ?? 'resp_stock') as Role

  function visible(moduleKey: string | null) {
    if (moduleKey === null) return true
    if (moduleKey === 'ventes_read') return canReadVentes(role)
    if (moduleKey === 'commander_read') return canReadAchats(role)
    if (moduleKey === 'salaires') return hasSalaryAccess(role)
    return canAccess(role, moduleKey as Parameters<typeof canAccess>[1])
  }

  return (
    <div className="app-frame">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><img src="/brand/logo-barryson.jpg" alt={companyInfo.displayName} /></div>
          <div><strong>{companyInfo.shortName}</strong><span>{companyInfo.tagline}</span></div>
          <button className="mobile-close" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><X /></button>
        </div>
        <nav className="nav-list" aria-label="Navigation principale">
          {navItems.filter((item) => visible(item.moduleKey)).map((item) => (
            <Link key={item.href} className={`nav-link ${pathname === item.href ? 'active' : ''}`} href={item.href}>
              <item.icon />{item.label}
            </Link>
          ))}
          {reglagesItems.some((item) => visible(item.moduleKey)) && <p className="nav-caption nav-caption-spaced">RÉGLAGES</p>}
          {reglagesItems.filter((item) => visible(item.moduleKey)).map((item) => (
            <Link key={item.href} className={`nav-link ${pathname === item.href ? 'active' : ''}`} href={item.href}>
              <item.icon />{item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer">
          <UserChip />
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(true)} aria-label="Ouvrir le menu"><Menu /></button>
          <div className="breadcrumb"><span>{breadcrumb}</span><strong>{section}</strong></div>
          <div className="topbar-actions">
            {onExport && <button className="export-button" onClick={onExport}><Download /> Exporter</button>}
          </div>
        </header>
        <div className="page-body">{children}</div>
      </main>
    </div>
  )
}

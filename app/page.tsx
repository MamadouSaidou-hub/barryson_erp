import { redirect } from 'next/navigation'
import { getSessionContext } from '@/lib/session'
import { canAccess, canReadVentes } from '@/lib/permissions'
import { HomeView } from '@/components/home-view'

// Tableau de bord §5.1 : tuiles + alertes + opérations en cours, adapté au profil connecté —
// chaque responsable (resp_stock, chef_prod, dir_commercial, comptable...) ne voit que les
// sections qui concernent son métier, pour pouvoir travailler depuis son propre Accueil sans
// naviguer dans les modules des autres. Le DG/admin, ayant accès à tout, voit tout ici aussi,
// en plus du Cockpit DG qui lui est réservé (synthèse cross-module avec alertes cliquables).
export default async function Page() {
  const ctx = await getSessionContext()
  if (!ctx) redirect('/login')

  return (
    <HomeView
      userName={ctx.userName}
      access={{
        commander: canAccess(ctx.role, 'commander'),
        recevoir: canAccess(ctx.role, 'recevoir'),
        stock: canAccess(ctx.role, 'stock'),
        production: canAccess(ctx.role, 'production'),
        doctorRewinder: canAccess(ctx.role, 'doctor_rewinder'),
        ventes: canAccess(ctx.role, 'ventes'),
        creances: canReadVentes(ctx.role),
        reglages: canAccess(ctx.role, 'reglages'),
      }}
    />
  )
}

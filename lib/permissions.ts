// Fixed set of roles from the cahier des charges §3 — not reconfigurable by the user, so this is
// a code-level permission map rather than a database table (in the spirit of "ultra simple").
export const ROLES = ['dg', 'resp_stock', 'chef_prod', 'dir_commercial', 'comptable', 'rh', 'admin'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  dg: 'Directeur général',
  resp_stock: 'Responsable stock et approvisionnement',
  chef_prod: 'Chef de production',
  dir_commercial: 'Directeur commercial',
  comptable: 'Comptable',
  rh: 'Responsable RH',
  admin: 'Administrateur',
}

// Which roles can reach a given module. §3's table, restated per screen rather than per profile —
// this is the shape every page/route guard and the nav actually consume.
export const MODULE_ACCESS: Record<string, Role[]> = {
  reglages: ['admin', 'dg'],
  commander: ['resp_stock', 'dg', 'admin'],
  recevoir: ['resp_stock', 'dg', 'admin'],
  stock: ['resp_stock', 'chef_prod', 'dg', 'admin'],
  production: ['chef_prod', 'dg', 'admin'],
  doctor_rewinder: ['chef_prod', 'dg', 'admin'],
  ventes: ['dir_commercial', 'dg', 'admin'],
  cockpit_dg: ['dg', 'admin'],
  rh: ['rh', 'dg', 'admin'],
  tresorerie: ['comptable', 'dg', 'admin'],
}

export function canAccess(role: string, moduleKey: keyof typeof MODULE_ACCESS): boolean {
  return (MODULE_ACCESS[moduleKey] as string[]).includes(role)
}

// §3 : le comptable "voit" Ventes/Créances/Achats en lecture seule (il ne saisit que des
// synthèses) — utilisé uniquement par les routes GET de Ventes/Créances, jamais par les routes
// de mutation qui restent `canAccess(role, 'ventes')`.
export function canReadVentes(role: string): boolean {
  return canAccess(role, 'ventes') || role === 'comptable'
}

// Symétrique de canReadVentes côté achats : le comptable lit les commandes fournisseurs et leurs
// paiements, mais ne les saisit jamais (cf. commentaire ci-dessus).
export function canReadAchats(role: string): boolean {
  return canAccess(role, 'commander') || role === 'comptable'
}

// Salary/HR data is confidential to RH + DG even from the admin (§3: "Administrateur — sans
// accès aux données salariales"). Not used until the RH module exists, but the rule is a direct
// cahier-des-charges requirement, so it's declared alongside the rest of the permission map now.
export function hasSalaryAccess(role: string): boolean {
  return role === 'rh' || role === 'dg'
}

/** Normalise un montant GNF en entier. Point d'entrée unique pour garantir qu'aucune valeur
 * fractionnaire (saisie accidentelle, calcul UI) ne soit jamais écrite dans une colonne GNF
 * entière — voir le commentaire `gnf` dans lib/db/schema.ts pour le pourquoi. */
export function toGnf(value: number): number {
  if (!Number.isFinite(value)) throw new Error('Montant invalide.')
  return Math.round(value)
}

export function toGnfOrNull(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return toGnf(value)
}

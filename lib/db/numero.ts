import { randomUUID } from 'node:crypto'

/** Inserts a row with a temporary unique placeholder, then rewrites it to the final
 * `PREFIX-YYYY-NNNNN` number built from the row's own serial id — avoids a race between "count
 * existing rows this year" and the insert under concurrent requests, at the cost of a gap-free
 * sequential look only within a given year's digit count (acceptable: the number only needs to
 * be unique and traceable, the cahier des charges doesn't require strict gapless sequencing). */
export function placeholderNumero() {
  return `TEMP-${randomUUID()}`
}

export function finalNumero(prefix: string, id: number) {
  const year = new Date().getFullYear()
  return `${prefix}-${year}-${String(id).padStart(5, '0')}`
}

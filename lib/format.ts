import { businessConfig } from './business-config'

export function formatMoney(value: number, currency: string = businessConfig.currency) {
  // toLocaleString('fr-FR') separates thousands with a narrow no-break space (U+202F), which
  // renders as a stray glyph in some PDF exports — a plain space is safe everywhere, HTML included.
  const digits = Math.round(value).toLocaleString('fr-FR').replace(/[  ]/g, ' ')
  return `${digits} ${currency}`
}

export function formatQuantity(value: number, unit: string) {
  const digits = value.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/[  ]/g, ' ')
  return `${digits} ${unit}`
}

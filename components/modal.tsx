'use client'

import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  wide,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  wide?: boolean
  children: ReactNode
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Piège à focus (§ accessibilité clavier) : à l'ouverture, le focus part sur le premier élément
  // focusable du panneau ; Tab/Shift+Tab bouclent à l'intérieur plutôt que de ressortir vers la
  // page sous la modale.
  useEffect(() => {
    if (!open) return
    const panel = panelRef.current
    const focusables = panel ? Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)) : []
    focusables[0]?.focus()

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const current = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
      if (current.length === 0) return
      const first = current[0]
      const last = current[current.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div ref={panelRef} className={`modal-panel ${wide ? 'modal-wide' : ''}`} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
          <button className="modal-close" onClick={onClose} aria-label="Fermer"><X size={14} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

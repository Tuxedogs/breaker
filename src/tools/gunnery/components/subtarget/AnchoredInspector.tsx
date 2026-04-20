import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import { useAnchoredPosition } from '../../hooks/useAnchoredPosition'

type Props = {
  anchorRect: DOMRect | null
  children: ReactNode
  isOpen: boolean
  labelledBy: string
  onClose: () => void
  version?: number
}

export function AnchoredInspector({ anchorRect, children, isOpen, labelledBy, onClose, version = 0 }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const position = useAnchoredPosition({
    isOpen,
    anchorRect,
    floatingRef: cardRef,
    version,
  })

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Node && cardRef.current?.contains(target)) return
      onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !position) return null

  const style = {
    left: position.left,
    top: position.top,
    '--inspector-arrow-x': `${position.arrowX}px`,
    '--inspector-arrow-y': `${position.arrowY}px`,
  } as CSSProperties

  return createPortal(
    <div
      ref={cardRef}
      className="gun-anchored-inspector"
      data-placement={position.placement}
      role="dialog"
      aria-modal="false"
      aria-labelledby={labelledBy}
      style={style}
    >
      {children}
    </div>,
    document.body
  )
}

import { useLayoutEffect, useState } from 'react'
import type { RefObject } from 'react'

type AnchorRect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom' | 'width' | 'height'> | null

export type AnchoredPlacement = 'right' | 'left' | 'bottom-sheet' | 'center'

export type AnchoredPosition = {
  left: number
  top: number
  placement: AnchoredPlacement
  arrowX: number
  arrowY: number
}

type Options = {
  isOpen: boolean
  anchorRect: AnchorRect
  floatingRef: RefObject<HTMLElement | null>
  gap?: number
  margin?: number
  fallbackWidth?: number
  fallbackHeight?: number
  version?: number
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

export function useAnchoredPosition({
  isOpen,
  anchorRect,
  floatingRef,
  gap = 12,
  margin = 12,
  fallbackWidth = 288,
  fallbackHeight = 260,
  version = 0,
}: Options) {
  const [position, setPosition] = useState<AnchoredPosition | null>(null)

  useLayoutEffect(() => {
    if (!isOpen || !anchorRect) {
      return
    }

    const update = () => {
      const viewportWidth = document.documentElement.clientWidth
      const viewportHeight = document.documentElement.clientHeight
      const measured = floatingRef.current?.getBoundingClientRect()
      const width = measured?.width && measured.width > 0 ? measured.width : fallbackWidth
      const height = measured?.height && measured.height > 0 ? measured.height : fallbackHeight

      const anchorCenterX = anchorRect.left + anchorRect.width / 2
      const anchorCenterY = anchorRect.top + anchorRect.height / 2
      const availableWidth = viewportWidth - margin * 2
      const availableHeight = viewportHeight - margin * 2

      if (availableWidth < 340 || availableHeight < 360) {
        if (availableHeight >= 300) {
          const sheetTop = Math.max(margin, viewportHeight - Math.min(height, availableHeight) - margin)
          setPosition({
            left: margin,
            top: sheetTop,
            placement: 'bottom-sheet',
            arrowX: clamp(anchorCenterX - margin, 16, Math.max(16, availableWidth - 16)),
            arrowY: 0,
          })
          return
        }

        setPosition({
          left: Math.max(margin, (viewportWidth - width) / 2),
          top: Math.max(margin, (viewportHeight - height) / 2),
          placement: 'center',
          arrowX: width / 2,
          arrowY: 0,
        })
        return
      }

      const fitsRight = anchorRect.right + gap + width <= viewportWidth - margin
      const preferredLeft = anchorRect.right + gap
      const flippedLeft = anchorRect.left - gap - width
      const placement: AnchoredPlacement = fitsRight || flippedLeft < margin ? 'right' : 'left'
      const left = placement === 'right'
        ? clamp(preferredLeft, margin, viewportWidth - width - margin)
        : clamp(flippedLeft, margin, viewportWidth - width - margin)
      const top = clamp(anchorCenterY - height / 2, margin, viewportHeight - height - margin)

      setPosition({
        left,
        top,
        placement,
        arrowX: placement === 'right' ? 0 : width,
        arrowY: clamp(anchorCenterY - top, 16, height - 16),
      })
    }

    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)

    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [anchorRect, fallbackHeight, fallbackWidth, floatingRef, gap, isOpen, margin, version])

  return isOpen && anchorRect ? position : null
}

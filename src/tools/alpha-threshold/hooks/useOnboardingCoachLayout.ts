import { useId, useLayoutEffect, useState, type RefObject } from 'react'

export type OnboardingCoachLayout = {
  vw: number
  vh: number
  holes: Array<{ x: number; y: number; w: number; h: number }>
  paths: string[]
}

function unionRect(elements: Element[]): DOMRect | null {
  if (elements.length === 0) return null
  let minL = Infinity
  let minT = Infinity
  let maxR = -Infinity
  let maxB = -Infinity
  for (const el of elements) {
    const r = el.getBoundingClientRect()
    minL = Math.min(minL, r.left)
    minT = Math.min(minT, r.top)
    maxR = Math.max(maxR, r.right)
    maxB = Math.max(maxB, r.bottom)
  }
  return new DOMRect(minL, minT, maxR - minL, maxB - minT)
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(n, hi))
}

function pointOnModalEdgeFacingTarget(modal: DOMRect, target: DOMRect): { x: number; y: number } {
  const tcx = target.left + target.width / 2
  const tcy = target.top + target.height / 2
  const mcx = modal.left + modal.width / 2
  const mcy = modal.top + modal.height / 2
  const dx = tcx - mcx
  const dy = tcy - mcy

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx < 0) {
      return { x: modal.left, y: clamp(tcy, modal.top, modal.bottom) }
    }
    return { x: modal.right, y: clamp(tcy, modal.top, modal.bottom) }
  }
  if (dy < 0) {
    return { x: clamp(tcx, modal.left, modal.right), y: modal.top }
  }
  return { x: clamp(tcx, modal.left, modal.right), y: modal.bottom }
}

function pointOnTargetEdgeFacingModal(modal: DOMRect, target: DOMRect): { x: number; y: number } {
  const mcx = modal.left + modal.width / 2
  const mcy = modal.top + modal.height / 2
  const tcx = target.left + target.width / 2
  const tcy = target.top + target.height / 2
  const dx = mcx - tcx
  const dy = mcy - tcy

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx > 0) {
      return { x: target.right, y: clamp(mcy, target.top, target.bottom) }
    }
    return { x: target.left, y: clamp(mcy, target.top, target.bottom) }
  }
  if (dy > 0) {
    return { x: clamp(mcx, target.left, target.right), y: target.bottom }
  }
  return { x: clamp(mcx, target.left, target.right), y: target.top }
}

const EDGE_EPS = 3

function orthoModalToTargetEdge(modal: DOMRect, target: DOMRect): string {
  const s = pointOnModalEdgeFacingTarget(modal, target)
  const e = pointOnTargetEdgeFacingModal(modal, target)

  const onLeft = Math.abs(s.x - modal.left) < EDGE_EPS
  const onRight = Math.abs(s.x - modal.right) < EDGE_EPS
  const onTop = Math.abs(s.y - modal.top) < EDGE_EPS
  const onBottom = Math.abs(s.y - modal.bottom) < EDGE_EPS

  if (onLeft || onRight) {
    const outward = onLeft ? e.x <= s.x : e.x >= s.x
    if (outward) {
      return `M ${s.x} ${s.y} L ${e.x} ${s.y} L ${e.x} ${e.y}`
    }
    return `M ${s.x} ${s.y} L ${s.x} ${e.y} L ${e.x} ${e.y}`
  }

  if (onTop || onBottom) {
    const outward = onTop ? e.y <= s.y : e.y >= s.y
    if (outward) {
      return `M ${s.x} ${s.y} L ${s.x} ${e.y} L ${e.x} ${e.y}`
    }
    return `M ${s.x} ${s.y} L ${e.x} ${s.y} L ${e.x} ${e.y}`
  }

  return `M ${s.x} ${s.y} L ${e.x} ${s.y} L ${e.x} ${e.y}`
}

/** Half stroke width (coach lines use strokeWidth 2) so the stroke terminates on the border, not past it. */
const COACH_STROKE_HALF = 1

/**
 * One orthogonal polyline for step 0 (Ship 1 + Weapon 1):
 * 1) Leave modal at left edge, 50% height.
 * 2) Horizontal left until x = 50% across weapon header width.
 * 3) 90° toward weapon header bottom edge (same x).
 * 4) Vertical to y = 50% of the ship header row (`.acm-ship-header`, or empty placeholder).
 * 5) 90° left to the ship **card** right border (highlight edge), inset for stroke.
 */
function buildStep0CombinedPath(modal: DOMRect, weaponEl: Element, shipEl: Element): string {
  const w = weaponEl.getBoundingClientRect()
  const ship = shipEl.getBoundingClientRect()

  const shipHeaderEl = shipEl.querySelector<HTMLElement>('.acm-ship-header')
  const shipEmptyEl = shipEl.querySelector<HTMLElement>('.acm-ship-empty')

  let headerMidY: number
  if (shipHeaderEl) {
    const hr = shipHeaderEl.getBoundingClientRect()
    headerMidY = hr.top + hr.height * 0.5
  } else if (shipEmptyEl) {
    const er = shipEmptyEl.getBoundingClientRect()
    headerMidY = er.top + er.height * 0.5
  } else {
    headerMidY = ship.top + ship.height * 0.5
  }

  const ml = modal.left
  const my = modal.top + modal.height * 0.5
  const wx = w.left + w.width * 0.5
  const wb = w.bottom
  const shy = headerMidY
  /** Ship column border = article right edge (matches onboarding highlight), inset so stroke doesn’t bleed past. */
  const shipBorderX = ship.right - COACH_STROKE_HALF

  return `M ${ml} ${my} L ${wx} ${my} L ${wx} ${wb} L ${wx} ${shy} L ${shipBorderX} ${shy}`
}

function buildPaths(modal: DOMRect, targets: Element[], step: number): string[] {
  if (targets.length === 0) return []

  if (step === 0 && targets.length >= 2) {
    const weaponEl = targets.find((t) => t.classList.contains('acm-weapon-header'))
    const shipEl = targets.find((t) => t.classList.contains('acm-ship-card'))
    if (weaponEl && shipEl) {
      return [buildStep0CombinedPath(modal, weaponEl, shipEl)]
    }
  }

  const sorted = [...targets].sort((a, b) => {
    const ra = a.getBoundingClientRect()
    const rb = b.getBoundingClientRect()
    return ra.top - rb.top
  })
  return sorted.map((el) => orthoModalToTargetEdge(modal, el.getBoundingClientRect()))
}

export function useOnboardingCoachLayout(
  step: number,
  modalRef: RefObject<HTMLElement | null>
): { layout: OnboardingCoachLayout | null; maskId: string } {
  const maskId = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const [layout, setLayout] = useState<OnboardingCoachLayout | null>(null)

  useLayoutEffect(() => {
    if (step >= 2) {
      return
    }

    const measure = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const modal = modalRef.current
          if (!modal) return

          const modalRect = modal.getBoundingClientRect()
          const targets = Array.from(
            document.querySelectorAll<HTMLElement>('.alpha-onboarding-target-highlight')
          )

          const vw = window.innerWidth
          const vh = window.innerHeight
          const pad = 6

          const holes: Array<{ x: number; y: number; w: number; h: number }> = []
          if (targets.length > 0) {
            if (step === 0 && targets.length > 1) {
              for (const el of targets) {
                const r = el.getBoundingClientRect()
                holes.push({
                  x: r.left - pad,
                  y: r.top - pad,
                  w: r.width + pad * 2,
                  h: r.height + pad * 2,
                })
              }
            } else {
              const u = unionRect(targets)
              if (u) {
                holes.push({
                  x: u.left - pad,
                  y: u.top - pad,
                  w: u.width + pad * 2,
                  h: u.height + pad * 2,
                })
              }
            }
          }

          const paths = buildPaths(modalRect, targets, step)

          setLayout({ vw, vh, holes, paths })
        })
      })
    }

    measure()

    const scrollEl = document.querySelector('.acm-scroll')
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    scrollEl?.addEventListener('scroll', measure, { passive: true })

    const ro = new ResizeObserver(measure)
    if (modalRef.current) ro.observe(modalRef.current)

    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
      scrollEl?.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [step, modalRef])

  return { layout, maskId }
}

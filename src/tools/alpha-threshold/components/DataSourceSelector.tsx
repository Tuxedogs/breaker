import { useEffect, useId, useRef, useState } from 'react'
import type { ThresholdDataSourceOption } from '../data/sourceOptions'
import type { ThresholdDataSourceKey } from '../types'

type Props = {
  activeSource: ThresholdDataSourceKey
  sourceOptions: ThresholdDataSourceOption[]
  onSourceChange: (source: ThresholdDataSourceKey) => void
}

export function DataSourceSelector({
  activeSource,
  sourceOptions,
  onSourceChange,
}: Props) {
  const activeOption = sourceOptions.find((option) => option.value === activeSource)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLElement | null>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <section
      ref={rootRef}
      className="data-source-card relative z-20 ml-auto w-fit overflow-visible"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((current) => !current)}
        className="alpha-chip alpha-chip-pass cursor-pointer"
      >
        {activeOption?.label ?? activeSource}
      </button>

      {open ? (
        <div
          id={listId}
          className="absolute right-0 top-full mt-3 flex min-w-44 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl"
          role="group"
          aria-label="Data source options"
        >
          {sourceOptions.map((option) => {
            const isActive = option.value === activeSource

            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  onSourceChange(option.value as ThresholdDataSourceKey)
                  setOpen(false)
                }}
                className={[
                  'alpha-chip text-left',
                  isActive ? 'alpha-chip-pass' : 'alpha-chip-muted',
                ].join(' ')}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

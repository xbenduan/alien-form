import * as React from 'react'
import { cn } from '../lib/utils'

// --- Select with multi-select support ---

export interface SelectOption {
  label: string
  value: any
  disabled?: boolean
}

export interface SelectProps {
  value?: any
  onChange?: (value: any) => void
  dataSource?: SelectOption[]
  multiple?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  ({ value, onChange, dataSource = [], multiple = false, placeholder = 'Select...', disabled, className }, ref) => {
    const [open, setOpen] = React.useState(false)
    const containerRef = React.useRef<HTMLDivElement>(null)

    // Close on outside click
    React.useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setOpen(false)
        }
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [])

    const selectedValues = React.useMemo(() => {
      if (multiple) return Array.isArray(value) ? value : value ? [value] : []
      return value !== undefined && value !== null ? [value] : []
    }, [value, multiple])

    const displayText = React.useMemo(() => {
      if (selectedValues.length === 0) return placeholder
      const labels = selectedValues
        .map((v: any) => dataSource.find((o) => o.value === v)?.label || String(v))
      if (multiple) return labels.join(', ')
      return labels[0]
    }, [selectedValues, dataSource, multiple, placeholder])

    const handleSelect = (optionValue: any) => {
      if (multiple) {
        const newValue = selectedValues.includes(optionValue)
          ? selectedValues.filter((v: any) => v !== optionValue)
          : [...selectedValues, optionValue]
        onChange?.(newValue)
      } else {
        onChange?.(optionValue)
        setOpen(false)
      }
    }

    return (
      <div ref={containerRef} className={cn('relative', className)}>
        <button
          ref={ref as any}
          type="button"
          disabled={disabled}
          onClick={() => setOpen(!open)}
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background',
            'placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            selectedValues.length === 0 && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{displayText}</span>
          <svg className="h-4 w-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95">
            <div className="max-h-[200px] overflow-auto">
              {dataSource.map((option) => {
                const isSelected = selectedValues.includes(option.value)
                return (
                  <button
                    key={String(option.value)}
                    type="button"
                    disabled={option.disabled}
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'relative flex w-full cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none',
                      'hover:bg-accent hover:text-accent-foreground',
                      'disabled:pointer-events-none disabled:opacity-50',
                      isSelected && 'bg-accent'
                    )}
                  >
                    {multiple && (
                      <span className={cn(
                        'mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary',
                        isSelected && 'bg-primary text-primary-foreground'
                      )}>
                        {isSelected && (
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                    )}
                    {option.label}
                    {!multiple && isSelected && (
                      <svg className="ml-auto h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                )
              })}
              {dataSource.length === 0 && (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">No options</div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }
)
Select.displayName = 'Select'

export { Select }

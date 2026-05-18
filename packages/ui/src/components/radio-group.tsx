import * as React from 'react'
import { cn } from '../lib/utils'

export interface RadioOption {
  label: string
  value: any
  disabled?: boolean
}

export interface RadioGroupProps {
  value?: any
  onChange?: (value: any) => void
  dataSource?: RadioOption[]
  disabled?: boolean
  direction?: 'horizontal' | 'vertical'
  className?: string
}

const RadioGroup = React.forwardRef<HTMLDivElement, RadioGroupProps>(
  ({ value, onChange, dataSource = [], disabled, direction = 'vertical', className }, ref) => {
    return (
      <div
        ref={ref}
        role="radiogroup"
        className={cn(
          'flex gap-3',
          direction === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
          className
        )}
      >
        {dataSource.map((option) => {
          const isSelected = value === option.value
          const isDisabled = disabled || option.disabled
          return (
            <label
              key={String(option.value)}
              className={cn(
                'flex items-center gap-2 cursor-pointer text-sm',
                isDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={isDisabled}
                onClick={() => onChange?.(option.value)}
                className={cn(
                  'h-4 w-4 rounded-full border border-primary shadow focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  'disabled:cursor-not-allowed',
                  isSelected && 'border-[5px]'
                )}
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
    )
  }
)
RadioGroup.displayName = 'RadioGroup'

export { RadioGroup }

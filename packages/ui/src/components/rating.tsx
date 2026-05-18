import * as React from 'react'
import { cn } from '../lib/utils'

export interface RatingProps {
  value?: number
  onChange?: (value: number) => void
  max?: number
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const Rating = React.forwardRef<HTMLDivElement, RatingProps>(
  ({ value = 0, onChange, max = 5, disabled, size = 'md', className }, ref) => {
    const [hoverValue, setHoverValue] = React.useState(0)

    const sizeClass = {
      sm: 'h-4 w-4',
      md: 'h-5 w-5',
      lg: 'h-6 w-6',
    }[size]

    return (
      <div
        ref={ref}
        className={cn('inline-flex gap-0.5', disabled && 'opacity-50 pointer-events-none', className)}
        onMouseLeave={() => setHoverValue(0)}
      >
        {Array.from({ length: max }, (_, i) => {
          const starValue = i + 1
          const isFilled = starValue <= (hoverValue || value)
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onChange?.(starValue === value ? 0 : starValue)}
              onMouseEnter={() => setHoverValue(starValue)}
              className={cn(
                'cursor-pointer transition-colors focus-visible:outline-none',
                'disabled:cursor-not-allowed'
              )}
            >
              <svg
                className={cn(sizeClass, 'transition-colors')}
                fill={isFilled ? 'currentColor' : 'none'}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={isFilled ? 0 : 1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>
          )
        })}
      </div>
    )
  }
)
Rating.displayName = 'Rating'

export { Rating }

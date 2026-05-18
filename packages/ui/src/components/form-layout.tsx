import * as React from 'react'
import { cn } from '../lib/utils'

export interface FormLayoutProps {
  direction?: 'horizontal' | 'vertical'
  gap?: number
  title?: string
  description?: string
  children?: React.ReactNode
  className?: string
}

const FormLayout = React.forwardRef<HTMLDivElement, FormLayoutProps>(
  ({ direction = 'vertical', gap = 4, title, description, children, className }, ref) => {
    return (
      <div ref={ref} className={cn('mb-4', className)}>
        {title && (
          <h4 className="text-sm font-medium mb-2">{title}</h4>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mb-3">{description}</p>
        )}
        <div
          className={cn(
            direction === 'horizontal' ? 'flex flex-wrap items-start' : 'flex flex-col',
          )}
          style={{ gap: `${gap * 4}px` }}
        >
          {children}
        </div>
      </div>
    )
  }
)
FormLayout.displayName = 'FormLayout'

export { FormLayout }

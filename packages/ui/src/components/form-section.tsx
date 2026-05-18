import * as React from 'react'
import { cn } from '../lib/utils'

export interface FormSectionProps {
  title?: string
  description?: string
  bordered?: boolean
  collapsible?: boolean
  defaultCollapsed?: boolean
  children?: React.ReactNode
  className?: string
}

const FormSection = React.forwardRef<HTMLDivElement, FormSectionProps>(
  ({ title, description, bordered = true, collapsible = false, defaultCollapsed = false, children, className }, ref) => {
    const [collapsed, setCollapsed] = React.useState(defaultCollapsed)

    return (
      <div
        ref={ref}
        className={cn(
          'mb-4',
          bordered && 'border rounded-lg p-4',
          className
        )}
      >
        {(title || description) && (
          <div className="mb-3">
            {title && (
              <div className="flex items-center gap-2">
                {collapsible && (
                  <button
                    type="button"
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex items-center justify-center h-5 w-5 rounded hover:bg-accent transition-colors"
                  >
                    <svg
                      className={cn('h-3.5 w-3.5 transition-transform', collapsed && '-rotate-90')}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
                <h3 className="text-base font-semibold">{title}</h3>
              </div>
            )}
            {description && (
              <p className="text-xs text-muted-foreground mt-1">{description}</p>
            )}
          </div>
        )}
        {!collapsed && (
          <div className="space-y-1">
            {children}
          </div>
        )}
      </div>
    )
  }
)
FormSection.displayName = 'FormSection'

export { FormSection }

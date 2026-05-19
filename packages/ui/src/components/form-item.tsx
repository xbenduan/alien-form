import * as React from 'react'
import { cn } from '../lib/utils'
import { Label } from './label'

export interface FormItemProps {
  label?: string
  required?: boolean
  errors?: Array<{ message: string }>
  warnings?: Array<{ message: string }>
  description?: string
  children?: React.ReactNode
  className?: string
}

const FormItem = React.forwardRef<HTMLDivElement, FormItemProps>(
  ({ label, required, errors = [], warnings = [], description, children, className }, ref) => {
    const hasError = errors.length > 0
    const hasWarning = warnings.length > 0

    return (
      <div ref={ref} className={cn('space-y-2 mb-4', className)}>
        {label && (
          <Label className="flex items-center gap-1">
            {label}
            {required && <span className="text-destructive">*</span>}
          </Label>
        )}
        <div>{children}</div>
        {description && !hasError && !hasWarning && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
        {hasError && (
          <p className="text-xs text-destructive">{errors.map((e) => e.message).join(', ')}</p>
        )}
        {!hasError && hasWarning && (
          <p className="text-xs text-yellow-600">{warnings.map((w) => w.message).join(', ')}</p>
        )}
      </div>
    )
  }
)
FormItem.displayName = 'FormItem'

export { FormItem }

import * as React from "react";
import { cn } from "../lib/utils";

export interface CheckboxProps {
  value?: boolean;
  onChange?: (value: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ value = false, onChange, disabled, label, className }, ref) => {
    return (
      <label
        className={cn(
          "flex items-center gap-2 cursor-pointer",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <button
          ref={ref}
          type="button"
          role="checkbox"
          aria-checked={value}
          disabled={disabled}
          onClick={() => onChange?.(!value)}
          className={cn(
            "peer h-4 w-4 shrink-0 rounded-sm border border-border/80 transition-colors",
            "focus:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50",
            value && "bg-primary text-primary-foreground border-primary",
          )}
        >
          {value && (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
        </button>
        {label && <span className="text-sm">{label}</span>}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };

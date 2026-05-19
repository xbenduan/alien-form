import * as React from "react";
import { cn } from "../lib/utils";

export interface DateInputProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  min?: string;
  max?: string;
  className?: string;
}

const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
  ({ value = "", onChange, disabled, placeholder, min, max, className }, ref) => {
    return (
      <div className={cn("relative", className)}>
        <input
          ref={ref}
          type="date"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          min={min}
          max={max}
          className={cn(
            "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors",
            "file:border-0 file:bg-transparent file:text-sm file:font-medium",
            "placeholder:text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
            "[&::-webkit-calendar-picker-indicator]:opacity-50",
            "[&::-webkit-calendar-picker-indicator]:hover:opacity-100",
          )}
        />
      </div>
    );
  },
);
DateInput.displayName = "DateInput";

export { DateInput };

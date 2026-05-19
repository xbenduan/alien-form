import * as React from "react";
import { cn } from "../lib/utils";

/**
 * ItemInput — A tag/chip input. Users can type values and press Enter to add them as items.
 * Items are displayed as removable chips/badges.
 */
export interface ItemInputProps {
  value?: string[];
  onChange?: (value: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  maxItems?: number;
  className?: string;
}

const ItemInput = React.forwardRef<HTMLInputElement, ItemInputProps>(
  (
    {
      value = [],
      onChange,
      disabled,
      placeholder = "Type and press Enter...",
      maxItems,
      className,
    },
    ref,
  ) => {
    const [inputValue, setInputValue] = React.useState("");
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useImperativeHandle(ref, () => inputRef.current!);

    const addItem = (item: string) => {
      const trimmed = item.trim();
      if (!trimmed) return;
      if (value.includes(trimmed)) return;
      if (maxItems && value.length >= maxItems) return;
      onChange?.([...value, trimmed]);
      setInputValue("");
    };

    const removeItem = (index: number) => {
      const newValue = [...value];
      newValue.splice(index, 1);
      onChange?.(newValue);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addItem(inputValue);
      } else if (e.key === "Backspace" && !inputValue && value.length > 0) {
        removeItem(value.length - 1);
      }
    };

    return (
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap gap-1 rounded-md border border-input bg-transparent px-3 py-1 shadow-sm transition-colors",
          "focus-within:ring-1 focus-within:ring-ring",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((item, index) => (
          <span
            key={`${item}-${index}`}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground"
          >
            {item}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeItem(index);
                }}
                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 hover:text-destructive"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
        />
      </div>
    );
  },
);
ItemInput.displayName = "ItemInput";

export { ItemInput };

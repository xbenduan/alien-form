import * as React from "react";
import { cn } from "../lib/utils";

export interface ArrayCardsProps {
  rows?: React.ReactNode[][];
  onAdd?: (initialValues?: Record<string, any>) => void;
  onRemove?: (index: number) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  disabled?: boolean;
  readOnly?: boolean;
  maxItems?: number;
  addText?: string;
  className?: string;
}

const ArrayCards = React.forwardRef<HTMLDivElement, ArrayCardsProps>(
  (
    {
      rows = [],
      onAdd,
      onRemove,
      onMoveUp,
      onMoveDown,
      disabled,
      readOnly,
      maxItems,
      addText = "+ Add Item",
      className,
    },
    ref,
  ) => {
    const canAdd = !disabled && !readOnly && (!maxItems || rows.length < maxItems);

    return (
      <div ref={ref} className={cn("space-y-3", className)}>
        {rows.map((rowFields, index) => (
          <div key={index} className="relative rounded-lg border bg-card p-4 shadow-sm">
            {/* Header with index and actions */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b">
              <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
              {!disabled && !readOnly && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMoveUp?.(index)}
                    disabled={index === 0}
                    className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move up"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 15l7-7 7 7"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onMoveDown?.(index)}
                    disabled={index === rows.length - 1}
                    className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move down"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemove?.(index)}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive"
                    title="Remove"
                  >
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
            {/* Field content */}
            <div className="space-y-1">{rowFields}</div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="text-center py-6 text-sm text-muted-foreground border border-dashed rounded-lg">
            No items yet. Click below to add one.
          </div>
        )}

        {canAdd && (
          <button
            type="button"
            onClick={() => onAdd?.()}
            className="w-full py-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors"
          >
            {addText}
          </button>
        )}
      </div>
    );
  },
);
ArrayCards.displayName = "ArrayCards";

export { ArrayCards };

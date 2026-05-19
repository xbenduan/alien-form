import * as React from "react";
import { cn } from "../lib/utils";

export interface ArrayTableProps {
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

const ArrayTable = React.forwardRef<HTMLDivElement, ArrayTableProps>(
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
      addText = "+ Add Row",
      className,
    },
    ref,
  ) => {
    const canAdd = !disabled && !readOnly && (!maxItems || rows.length < maxItems);

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        <div className="rounded-lg border overflow-hidden">
          {rows.map((rowFields, index) => (
            <div
              key={index}
              className={cn("flex items-start gap-3 p-3", index !== rows.length - 1 && "border-b")}
            >
              <span className="text-xs text-muted-foreground pt-2 w-6 shrink-0">{index + 1}.</span>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">{rowFields}</div>
              {!disabled && !readOnly && (
                <div className="flex items-center gap-0.5 pt-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onMoveUp?.(index)}
                    disabled={index === 0}
                    className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                    className="p-0.5 rounded hover:bg-destructive/10 text-destructive"
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
                </div>
              )}
            </div>
          ))}

          {rows.length === 0 && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              No rows. Add your first entry below.
            </div>
          )}
        </div>

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
ArrayTable.displayName = "ArrayTable";

export { ArrayTable };

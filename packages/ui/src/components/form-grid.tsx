import * as React from "react";
import { cn } from "../lib/utils";

export interface FormGridProps {
  columns?: number;
  gap?: number;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}

const FormGrid = React.forwardRef<HTMLDivElement, FormGridProps>(
  ({ columns = 2, gap = 4, title, description, children, className }, ref) => {
    const gridStyle: React.CSSProperties = {
      display: "grid",
      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      gap: `${gap * 4}px`,
    };

    return (
      <div ref={ref} className={cn("mb-4", className)}>
        {title && <h4 className="text-sm font-medium mb-2">{title}</h4>}
        {description && <p className="text-xs text-muted-foreground mb-3">{description}</p>}
        <div style={gridStyle}>{children}</div>
      </div>
    );
  },
);
FormGrid.displayName = "FormGrid";

export { FormGrid };

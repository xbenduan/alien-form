import type React from "react";

interface FilterItemProps {
  label?: string;
  children?: React.ReactNode;
}

export function FilterItem({ label, children }: FilterItemProps) {
  return (
    <div className="filter-form-item">
      {label ? <span>{label}：</span> : null}
      {children}
    </div>
  );
}

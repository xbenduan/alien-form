import type React from "react";

interface FilterItemProps {
  label?: string;
  required?: boolean;
  children?: React.ReactNode;
}

export function FilterItem({ label, required, children }: FilterItemProps) {
  return (
    <div className="filter-form-item">
      {label ? ( <span> {label}： </span> ) : null}
      {children}
    </div>
  );
}

export default FilterItem;

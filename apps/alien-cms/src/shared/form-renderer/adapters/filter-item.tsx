import type React from 'react';

export function FilterItem({ children }: { children?: React.ReactNode }) {
  return <div className="filter-form-item">{children}</div>;
}

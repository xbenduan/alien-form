import type React from "react";

interface TableCellItemProps {
  children?: React.ReactNode;
}

export function TableCellItem({ children }: TableCellItemProps) {
  return <>{children}</>;
}

export default TableCellItem;

import type { ReactNode } from "react";
import type { ComponentProps } from "@alien-form/react";

export function RecordPage({ children }: Partial<ComponentProps> & { title?: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-4">{children}</div>;
}

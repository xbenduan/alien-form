import type { ReactNode } from "react";

export function PageActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-10 px-(--app-page-padding-inline)">
      <div className="pointer-events-auto mx-auto flex w-full max-w-(--app-content-max-width) justify-end rounded-t-lg border border-[rgba(22,119,255,0.12)] bg-[var(--app-surface-strong,rgba(255,255,255,0.88))] p-[12px_16px] shadow-[0_-4px_16px_rgba(23,32,51,0.06)] backdrop-blur-[12px]">
        {children}
      </div>
    </div>
  );
}

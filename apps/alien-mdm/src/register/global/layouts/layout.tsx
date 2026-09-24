import type { ReactNode } from "react";
import { LayoutLoadingProvider } from "./loading-context";

export function Layout({
  slots,
  children,
}: {
  slots: Record<string, ReactNode>;
  children?: ReactNode;
}) {
  return (
    <LayoutLoadingProvider>
      <div className="flex h-[var(--app-layout-height,calc(100dvh-70px))] min-h-[520px] min-w-0 gap-4 overflow-hidden max-[900px]:h-auto max-[900px]:min-h-0 max-[900px]:flex-col max-[900px]:overflow-visible">
        {slots.left ? (
          <aside className="flex h-full min-h-0 w-[280px] min-w-[240px] flex-[0_0_280px] overflow-hidden [&>*]:h-full [&>*]:min-h-0 [&>*]:w-full max-[900px]:h-[240px] max-[900px]:w-full max-[900px]:min-w-0 max-[900px]:basis-auto">
            {slots.left}
          </aside>
        ) : null}
        <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-x-hidden overflow-y-auto pr-0.5 max-[900px]:h-auto max-[900px]:overflow-visible">
          {slots.content}
          {children}
        </main>
      </div>
    </LayoutLoadingProvider>
  );
}

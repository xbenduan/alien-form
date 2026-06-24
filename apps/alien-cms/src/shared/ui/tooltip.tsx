import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactElement, ReactNode } from "react";
import { cn } from "./cn";

const tooltipContentClass =
  "z-[1400] max-w-xs rounded-xl border border-[rgba(120,98,79,0.18)] bg-[#2E251E] px-2.5 py-1.5 text-xs leading-snug text-white shadow-[0_18px_36px_rgba(46,37,30,0.32)] data-[state=delayed-open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=delayed-open]:fade-in-0";

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <RadixTooltip.Provider delayDuration={200} skipDelayDuration={120}>
      {children}
    </RadixTooltip.Provider>
  );
}

export function Tooltip({
  children,
  title,
}: {
  children?: ReactNode;
  title?: ReactNode;
}) {
  if (title === undefined || title === null || title === "") {
    return <>{children}</>;
  }

  // Wrap non-element children in a span so Radix has a real DOM node to attach to.
  const trigger =
    typeof children === "object" && children !== null && "type" in (children as ReactElement) ? (
      (children as ReactElement)
    ) : (
      <span className="inline-flex">{children}</span>
    );

  return (
    <RadixTooltip.Provider delayDuration={200} skipDelayDuration={120}>
      <RadixTooltip.Root>
        <RadixTooltip.Trigger asChild>{trigger}</RadixTooltip.Trigger>
        <RadixTooltip.Portal>
          <RadixTooltip.Content sideOffset={6} className={cn(tooltipContentClass)}>
            {title}
            <RadixTooltip.Arrow className="fill-[#2E251E]" />
          </RadixTooltip.Content>
        </RadixTooltip.Portal>
      </RadixTooltip.Root>
    </RadixTooltip.Provider>
  );
}

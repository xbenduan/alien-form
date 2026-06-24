import { Children, type ReactElement, type ReactNode } from "react";
import { cn } from "./cn";

interface DescriptionsItemProps {
  label?: ReactNode;
  children?: ReactNode;
}

function DescriptionsItem({ children }: DescriptionsItemProps) {
  return <>{children}</>;
}

function DescriptionsRoot({
  children,
  className,
}: {
  children?: ReactNode;
  column?: number;
  size?: "small" | "middle" | "default";
  bordered?: boolean;
  className?: string;
}) {
  const items = Children.toArray(children) as Array<ReactElement<DescriptionsItemProps>>;
  return (
    <div
      className={cn(
        "ant-descriptions overflow-hidden rounded-[12px] border border-[rgba(120,98,79,0.14)] bg-[rgba(255,252,248,0.85)]",
        className,
      )}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="grid grid-cols-[112px_1fr] border-b border-[rgba(120,98,79,0.1)] px-3.5 py-2.5 last:border-b-0"
        >
          <div className="text-sm font-medium text-[rgba(80,63,50,0.68)]">
            {item.props.label}
          </div>
          <div className="min-w-0 text-sm text-[var(--af-text,#2f261f)]">
            {item.props.children}
          </div>
        </div>
      ))}
    </div>
  );
}

export const Descriptions = Object.assign(DescriptionsRoot, { Item: DescriptionsItem });

export function Steps({
  current = 0,
  items = [],
}: {
  current?: number;
  items?: Array<{ title?: ReactNode; description?: ReactNode }>;
}) {
  return (
    <div className="ant-steps grid gap-2.5 md:grid-cols-3">
      {items.map((item, index) => {
        const active = index === current;
        const done = index < current;
        return (
          <div
            key={index}
            className={cn(
              "rounded-[12px] border px-3.5 py-2.5",
              active && "border-[rgba(201,100,66,0.24)] bg-[rgba(201,100,66,0.08)]",
              done && "border-[rgba(103,133,103,0.22)] bg-[rgba(246,250,245,0.9)]",
              !active && !done && "border-[rgba(120,98,79,0.12)] bg-[rgba(255,252,248,0.7)]",
            )}
          >
            <div className="mb-1 flex items-center gap-2.5">
              <span
                className={cn(
                  "inline-flex h-6 w-6 items-center justify-center rounded-[8px] text-xs font-semibold",
                  active && "bg-[var(--af-primary,#C96442)] text-white",
                  done && "bg-[#678567] text-white",
                  !active && !done && "bg-[rgba(120,98,79,0.12)] text-[rgba(80,63,50,0.72)]",
                )}
              >
                {index + 1}
              </span>
              <span className="font-medium text-[var(--af-text,#2f261f)]">{item.title}</span>
            </div>
            {item.description ? (
              <div className="text-sm text-[rgba(80,63,50,0.62)]">{item.description}</div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

import type { Key, ReactNode } from "react";
import { cn } from "./cn";

export function Menu({
  items = [],
  selectedKeys = [],
  onClick,
  className,
}: {
  items?: Array<{ key: Key; icon?: ReactNode; label?: ReactNode }>;
  selectedKeys?: Key[];
  onClick?: (info: { key: Key }) => void;
  mode?: "inline" | "horizontal" | "vertical";
  className?: string;
}) {
  return (
    <div
      className={cn("ant-menu ant-menu-root ant-menu-inline grid gap-0.5", className)}
      role="menu"
    >
      {items.map((item) => {
        const active = selectedKeys.includes(item.key);
        return (
          <button
            key={String(item.key)}
            type="button"
            role="menuitem"
            aria-current={active}
            className={cn(
              "ant-menu-item flex w-full items-center gap-2.5 rounded-[10px] px-3 py-1.5 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(201,100,66,0.3)]",
              active
                ? "ant-menu-item-selected bg-[rgba(201,100,66,0.12)] font-medium text-[#A24E31]"
                : "text-[rgba(80,63,50,0.78)] hover:bg-[rgba(201,100,66,0.07)] hover:text-[#A24E31]",
            )}
            onClick={() => onClick?.({ key: item.key })}
          >
            {item.icon ? (
              <span className="inline-flex items-center text-base">{item.icon}</span>
            ) : null}
            <span className="min-w-0 truncate">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

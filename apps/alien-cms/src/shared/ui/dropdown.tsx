import * as RadixDropdown from "@radix-ui/react-dropdown-menu";
import type { Key, ReactElement, ReactNode } from "react";
import { cn } from "./cn";

interface DropdownMenuItem {
  key: Key;
  label?: ReactNode;
  disabled?: boolean;
  danger?: boolean;
}

export function Dropdown({
  children,
  menu,
}: {
  children: ReactElement;
  trigger?: Array<"click" | "hover">;
  menu: {
    items?: DropdownMenuItem[];
    onClick?: (info: { key: Key }) => void;
  };
}) {
  return (
    <RadixDropdown.Root>
      <RadixDropdown.Trigger asChild>{children}</RadixDropdown.Trigger>
      <RadixDropdown.Portal>
        <RadixDropdown.Content
          sideOffset={6}
          align="end"
          className={cn(
            "z-[1300] min-w-40 rounded-[12px] border border-[rgba(120,98,79,0.14)] bg-[rgba(255,251,246,0.98)] p-1.5 shadow-[0_14px_32px_rgba(68,49,33,0.16)] backdrop-blur outline-none",
          )}
        >
          {(menu.items ?? []).map((item) => (
            <RadixDropdown.Item
              key={String(item.key)}
              disabled={item.disabled}
              onSelect={() => menu.onClick?.({ key: item.key })}
              className={cn(
                "flex w-full cursor-pointer select-none items-center rounded-[8px] px-2.5 py-1.5 text-left text-sm text-[var(--af-text,#2f261f)] outline-none transition data-[highlighted]:bg-[rgba(201,100,66,0.08)] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-55",
                item.danger && "text-[#A24E31] data-[highlighted]:bg-[rgba(201,100,66,0.12)]",
              )}
            >
              {item.label}
            </RadixDropdown.Item>
          ))}
        </RadixDropdown.Content>
      </RadixDropdown.Portal>
    </RadixDropdown.Root>
  );
}

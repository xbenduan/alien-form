import type { ReactNode } from "react";
import { Card, Menu as AntMenu, type MenuProps } from "antd";
import type { ComponentProps } from "@alien-form/react";

export interface MenuItem {
  key: string;
  label: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  children?: MenuItem[];
}

interface AlienMenuProps extends ComponentProps {
  title?: ReactNode;
  items?: MenuItem[];
}

interface BuiltMenuProps {
  title?: ReactNode;
  items: MenuItem[];
  value?: unknown;
  onChange?: (value: unknown) => void;
}

function buildMenuProps(props: AlienMenuProps): BuiltMenuProps {
  return {
    title: props.title,
    items: Array.isArray(props.items) ? props.items : [],
    value: props.value,
    onChange: props.onChange,
  };
}

function toAntMenuItems(items: MenuItem[]): NonNullable<MenuProps["items"]> {
  return items.map((item) => {
    const children = item.children?.length ? toAntMenuItems(item.children) : undefined;
    return children
      ? { key: item.key, label: item.label, disabled: item.disabled, children }
      : { key: item.key, label: item.label, disabled: item.disabled };
  });
}

function findMenuItem(items: MenuItem[], key: string): MenuItem | undefined {
  for (const item of items) {
    if (item.key === key) return item;
    const nested = item.children ? findMenuItem(item.children, key) : undefined;
    if (nested) return nested;
  }
  return undefined;
}

export function Menu(props: AlienMenuProps) {
  const { title, items, value, onChange } = buildMenuProps(props);
  const selectedKey = value == null ? undefined : String(value);

  return (
    <Card
      className="box-border flex h-full min-h-0 w-full flex-col overflow-hidden"
      styles={{
        body: {
          display: "flex",
          height: "100%",
          minHeight: 0,
          flexDirection: "column",
          overflowY: "auto",
          padding: "12px 10px",
          scrollbarGutter: "stable",
        },
      }}
      role="navigation"
      aria-label={typeof title === "string" ? title : "菜单"}
    >
      {title ? <div className="px-3 pt-2 pb-3 text-[15px] font-semibold text-[#172033]">{title}</div> : null}
      <AntMenu
        className="min-h-0 flex-1 !border-e-0 !bg-transparent [&_.ant-menu-item]:my-1 [&_.ant-menu-item]:h-[38px] [&_.ant-menu-item]:rounded-[7px] [&_.ant-menu-item]:leading-[38px] [&_.ant-menu-item-selected]:!bg-[#eaf3ff] [&_.ant-menu-item-selected]:!font-semibold [&_.ant-menu-item-selected]:!text-[#1769e0] [&_.ant-menu-item-selected::after]:!hidden [&_.ant-menu-item:hover]:!bg-[#f2f6fc] [&_.ant-menu-item:hover]:!text-[#1769e0]"
        mode="inline"
        items={toAntMenuItems(items)}
        selectedKeys={selectedKey ? [selectedKey] : []}
        onClick={({ key }) => {
          findMenuItem(items, key)?.onClick?.();
          onChange?.(key === selectedKey ? undefined : key);
        }}
      />
    </Card>
  );
}

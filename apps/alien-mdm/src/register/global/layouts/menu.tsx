import type { ReactNode } from "react";
import { Menu as AntMenu, type MenuProps } from "antd";
import type { ComponentProps } from "@alien-form/react";
import styles from "./menu.module.css";

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
    <nav className={styles.menu} aria-label={typeof title === "string" ? title : "菜单"}>
      {title ? <div className={styles.title}>{title}</div> : null}
      <AntMenu
        className={styles.antdMenu}
        mode="inline"
        items={toAntMenuItems(items)}
        selectedKeys={selectedKey ? [selectedKey] : []}
        onClick={({ key }) => {
          findMenuItem(items, key)?.onClick?.();
          onChange?.(key === selectedKey ? undefined : key);
        }}
      />
    </nav>
  );
}

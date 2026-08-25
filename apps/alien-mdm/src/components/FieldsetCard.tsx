import type { ReactNode } from "react";
import styles from "./index.module.css";

interface FieldsetCardProps {
  title?: ReactNode;
  /** 透传到 fieldset 的额外类名（如布局跨度 / 填充高度）。 */
  className?: string;
  children?: ReactNode;
}

/** 虚线卡片：带 legend 标题的 fieldset 容器；内容超出时在内部滚动。 */
export const FieldsetCard = ({ title, className, children }: FieldsetCardProps) => (
  <fieldset className={`${styles.fieldsetCard}${className ? ` ${className}` : ""}`}>
    {title ? <legend className={styles.title}>{title}</legend> : null}
    <div className={styles.body}>{children}</div>
  </fieldset>
);

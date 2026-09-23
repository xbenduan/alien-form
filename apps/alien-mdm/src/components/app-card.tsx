import { Card, type CardProps } from "antd";
import styles from "./app-card.module.css";

export function AppCard({ className, ...props }: CardProps) {
  return <Card {...props} className={`${styles.card}${className ? ` ${className}` : ""}`} />;
}

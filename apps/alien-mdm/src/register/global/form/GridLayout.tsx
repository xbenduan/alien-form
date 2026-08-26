import type { FieldComponentProps } from "../../../types/shared";
import { renderGridChildren } from "@components/grid";
import styles from "../form.module.css";

/** 唯一的分组布局容器：栅格卡片。 */
export default function GridLayout(props: FieldComponentProps) {
  return (
    <fieldset className={`${styles.gridLayout} ${styles.layoutCard}`}>
      {props.title ? <legend className={styles.cardTitle}>{props.title}</legend> : null}
      {props.description ? (
        <div className={styles.cardDescription}>{props.description}</div>
      ) : null}
      {renderGridChildren(props.children, {
        gridSpan: props.gridSpan,
        columns: props.columns,
        gutter: props.gutter,
      })}
    </fieldset>
  );
}

import type { FieldComponentProps } from "../../../types/shared";
import { ComplexFieldFrame, readFieldPropTitle, TableComplexCell } from "@components/complex-frame";
import { renderGridChildren } from "@components/grid";
import styles from "../form.module.css";

/**
 * 对象字段容器：
 *  - isTable：折叠为摘要 + 详情按钮
 *  - form/detail：由 @alien-form/react 注入 children，直接渲染子字段
 */
export default function ObjectField(props: FieldComponentProps) {
  if (props.isTable) {
    return <TableComplexCell value={props.value} schema={props.schema} title={props.title} />;
  }
  const title = props.title ?? readFieldPropTitle(props.field);
  return (
    <ComplexFieldFrame title={title} description={props.description}>
      <div className={styles.objectField}>
        {renderGridChildren(props.children, {
          gridSpan: props.gridSpan,
          columns: props.columns,
          gutter: props.gutter,
        })}
      </div>
    </ComplexFieldFrame>
  );
}

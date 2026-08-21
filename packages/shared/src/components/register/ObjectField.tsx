import type { FieldComponentProps } from "../../types";
import { ComplexFieldFrame, readFieldPropTitle, TableComplexCell } from "../complex-frame";
import { renderGridChildren } from "../grid";

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
      <div className="af-object-field">
        {renderGridChildren(props.children, {
          gridSpan: props.gridSpan,
          columns: props.columns,
          gutter: props.gutter,
        })}
      </div>
    </ComplexFieldFrame>
  );
}

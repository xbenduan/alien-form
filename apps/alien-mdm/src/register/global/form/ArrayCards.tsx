import { PlusOutlined } from "@ant-design/icons";
import { Button, Empty } from "antd";
import { useFormScope } from "@alien-form/react";
import type { FieldComponentProps, FormScope } from "../../../types/shared";
import { ComplexFieldFrame, readFieldPropTitle, TableComplexCell } from "@components/complex-frame";
import { renderGridChildren } from "@components/grid";

/**
 * 对象数组卡片容器：
 *  - isTable：折叠为摘要 + 详情按钮
 *  - form：逐行渲染 + 增删按钮
 *  - detail：只读逐行渲染
 */
export default function ArrayCards(props: FieldComponentProps) {
  const { mode = "edit" } = useFormScope<FormScope>();

  if (props.isTable) {
    return <TableComplexCell value={props.value} schema={props.schema} title={props.title} />;
  }

  const rows = props.rows ?? [];
  const readonly = mode === "detail";
  const title = props.title ?? readFieldPropTitle(props.field);

  if (rows.length === 0) {
    return (
      <ComplexFieldFrame title={title} description={props.description}>
        <div className="af-array-cards-empty">
          <Empty description="暂无数据" style={{ paddingBlock: 16 }} />
          {readonly ? null : (
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => props.onAdd?.()}>
              添加一行
            </Button>
          )}
        </div>
      </ComplexFieldFrame>
    );
  }

  return (
    <ComplexFieldFrame title={title} description={props.description}>
      <div className="af-array-cards">
        {rows.map((row, index) => (
          <div className="af-array-card" key={props.rowNodes?.[index]?.id ?? index}>
            <div className="af-array-card-header">
              <span className="af-array-card-index">#{index + 1}</span>
              {readonly ? null : (
                <Button danger size="small" onClick={() => props.onRemove?.(index)}>
                  删除
                </Button>
              )}
            </div>
            <div className="af-array-card-body">
              {renderGridChildren(row, {
                gridSpan: props.gridSpan,
                columns: props.columns,
                gutter: props.gutter,
              })}
            </div>
          </div>
        ))}
        {readonly ? null : (
          <Button
            className="af-array-card-add"
            type="dashed"
            icon={<PlusOutlined />}
            onClick={() => props.onAdd?.()}
          >
            添加一行
          </Button>
        )}
      </div>
    </ComplexFieldFrame>
  );
}

import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  HolderOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Button, Empty, Tooltip } from "antd";
import type { ArrayFieldNode, RowNode } from "@alien-form/core";
import { useSignalValue } from "@alien-form/react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FieldNodes, type ComponentProps } from "@binding";
import type { CompiledNode } from "@alien-form/engine";
import { fieldGridStyle } from "@utils/field-grid";
import { ComplexFieldFrame, TableComplexCell } from "./complex-field";
import type { ComplexFieldProps } from "./shared";
import styles from "./index.module.css";

function ArrayCardsField({
  form,
  field,
  node,
  mode,
  domain,
  title,
  description,
  gridSpan,
  columns,
  gutter,
}: ComplexFieldProps) {
  const array = field as ArrayFieldNode;
  const rows = useSignalValue(array.rows);
  const readonly = mode === "detail";
  const gridStyle = fieldGridStyle({ gridSpan, columns, gutter });
  const template = node.items;
  if (!template) throw new Error(`Compiled array item template not found: ${field.path}`);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((row) => row.id === active.id);
    const to = rows.findIndex((row) => row.id === over.id);
    if (from < 0 || to < 0) return;
    array.move(from, to);
  };

  return (
    <ComplexFieldFrame title={title} description={description}>
      {rows.length === 0 ? (
        <>
          <Empty description="暂无数据" style={{ paddingBlock: 16 }} />
          {readonly ? null : (
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => array.push({})}>
              添加一行
            </Button>
          )}
        </>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
            <div className={styles.arrayCards}>
              {rows.map((row, index) => (
                <ArrayCardRow
                  key={row.id}
                  row={row}
                  index={index}
                  total={rows.length}
                  readonly={readonly}
                  gridStyle={gridStyle}
                  template={template}
                  form={form}
                  domain={domain}
                  onMoveUp={() => array.moveUp(index)}
                  onMoveDown={() => array.moveDown(index)}
                  onRemove={() => array.remove(index)}
                />
              ))}
            </div>
          </SortableContext>
          {readonly ? null : (
            <Button
              className={styles.arrayCardAdd}
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => array.push({})}
            >
              添加一行
            </Button>
          )}
        </DndContext>
      )}
    </ComplexFieldFrame>
  );
}

/** ArrayCards 单行：支持拖动排序、上/下移与删除，仅在可编辑态展示这些控件。 */
function ArrayCardRow({
  row,
  index,
  total,
  readonly,
  gridStyle,
  template,
  form,
  domain,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  row: RowNode;
  index: number;
  total: number;
  readonly: boolean;
  gridStyle: React.CSSProperties;
  template: CompiledNode;
  form: ComponentProps["form"];
  domain?: string;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: row.id,
    disabled: readonly,
  });

  return (
    <div
      ref={setNodeRef}
      className={`${styles.arrayCard}${isDragging ? ` ${styles.arrayCardDragging}` : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className={styles.arrayCardHeader}>
        <span className={styles.arrayCardIndexGroup}>
          {readonly ? null : (
            <span className={styles.arrayCardDragHandle} {...attributes} {...listeners}>
              <HolderOutlined />
            </span>
          )}
          <span className={styles.arrayCardIndex}>#{index + 1}</span>
        </span>
        {readonly ? null : (
          <span className={styles.arrayCardActions}>
            <Tooltip title="上移">
              <Button
                type="text"
                size="small"
                icon={<ArrowUpOutlined />}
                aria-label="上移"
                disabled={index === 0}
                onClick={onMoveUp}
              />
            </Tooltip>
            <Tooltip title="下移">
              <Button
                type="text"
                size="small"
                icon={<ArrowDownOutlined />}
                aria-label="下移"
                disabled={index === total - 1}
                onClick={onMoveDown}
              />
            </Tooltip>
            <Tooltip title="删除">
              <Button
                type="text"
                size="small"
                danger
                icon={<DeleteOutlined />}
                aria-label="删除"
                onClick={onRemove}
              />
            </Tooltip>
          </span>
        )}
      </div>
      <div className={styles.arrayCardBody} style={gridStyle}>
        <FieldNodes nodes={template.children} fields={row.children} form={form} domain={domain} />
      </div>
    </div>
  );
}

export function ArrayCards(props: ComplexFieldProps) {
  if (props.isTable) {
    return (
      <TableComplexCell
        value={props.value}
        schema={props.schema}
        title={props.title}
        domain={props.domain}
      />
    );
  }
  return <ArrayCardsField {...props} />;
}

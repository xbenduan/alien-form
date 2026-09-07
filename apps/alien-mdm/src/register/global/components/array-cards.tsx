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
import { fieldGridStyle } from "@utils/field-grid";
import { ComplexFieldFrame, TableComplexCell } from "./complex-field";
import { buildProps, type ComplexFieldProps } from "./shared";
import styles from "./array-cards.module.css";

function ArrayCardsField({
  field,
  mode,
  title,
  description,
  gridSpan,
  columns,
  gutter,
  renderRow,
}: {
  field: ArrayFieldNode;
  mode: "add" | "edit" | "detail";
  title?: string;
  description?: string;
  gridSpan?: unknown;
  columns?: unknown;
  gutter?: unknown;
  renderRow?: (row: RowNode) => React.ReactNode;
}) {
  const array = field;
  const rows = useSignalValue(array.rows);
  const readonly = mode === "detail";
  const gridStyle = fieldGridStyle({ columns, gutter });
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
    <ComplexFieldFrame title={title} description={description} gridSpan={gridSpan}>
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
                  renderRow={renderRow}
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
  renderRow,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  row: RowNode;
  index: number;
  total: number;
  readonly: boolean;
  gridStyle: React.CSSProperties;
  renderRow?: (row: RowNode) => React.ReactNode;
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
        {renderRow?.(row)}
      </div>
    </div>
  );
}

export function ArrayCards(props: ComplexFieldProps) {
  const built = buildProps(props);
  if (built.isTable) {
    return (
      <TableComplexCell
        value={built.value}
        schema={built.schema}
        title={built.title}
        domain={built.domain}
      />
    );
  }
  return (
    <ArrayCardsField
      field={built.field as ArrayFieldNode}
      mode={built.mode}
      title={built.title}
      description={built.description}
      gridSpan={built.gridSpan}
      columns={built.columns}
      gutter={built.gutter}
      renderRow={built.renderRow}
    />
  );
}

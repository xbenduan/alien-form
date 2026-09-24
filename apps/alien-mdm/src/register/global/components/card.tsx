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
import { FieldsetCard } from "../../../components/fieldset-card";
import { fieldGridStyle } from "@utils/field-grid";
import { TableComplexCell } from "./complex-field";
import { buildProps, type ComplexFieldProps } from "./shared";

/** 数组行：支持拖动排序、上/下移与删除，仅在可编辑态展示操作。 */
function ArrayRow({
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
      className={`box-border w-full min-w-0 max-w-full rounded-lg border border-[#d8dee8] bg-[var(--app-surface-muted,rgba(248,250,255,0.78))] px-3 pt-3 pb-1${isDragging ? " opacity-60 shadow-[0_6px_18px_rgba(23,32,51,0.12)]" : ""}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="mb-1.5 flex min-h-7 items-center justify-between">
        <span className="inline-flex items-center gap-1.5">
          {readonly ? null : (
            <span className="inline-flex cursor-grab text-[#86909c] active:cursor-grabbing" {...attributes} {...listeners}>
              <HolderOutlined />
            </span>
          )}
          <span className="font-semibold text-[#1677ff]">#{index + 1}</span>
        </span>
        {readonly ? null : (
          <span className="inline-flex items-center gap-0.5">
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
      <div
        className="grid w-full min-w-0 max-w-full grid-cols-[repeat(24,minmax(0,1fr))] gap-x-[var(--alien-grid-column-gap)] gap-y-[var(--alien-grid-row-gap)]"
        style={gridStyle}
      >
        {renderRow?.(row)}
      </div>
    </div>
  );
}

function ArrayContent({
  field,
  readonly,
  columns,
  gutter,
  renderRow,
}: {
  field: ArrayFieldNode;
  readonly: boolean;
  columns?: unknown;
  gutter?: unknown;
  renderRow?: (row: RowNode) => React.ReactNode;
}) {
  const rows = useSignalValue(field.rows);
  const gridStyle = fieldGridStyle({ columns, gutter });
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = rows.findIndex((row) => row.id === active.id);
    const to = rows.findIndex((row) => row.id === over.id);
    if (from >= 0 && to >= 0) field.move(from, to);
  };

  if (rows.length === 0) {
    return (
      <>
        <Empty description="暂无数据" style={{ paddingBlock: 16 }} />
        {readonly ? null : (
          <Button type="dashed" icon={<PlusOutlined />} onClick={() => field.push({})}>
            添加一行
          </Button>
        )}
      </>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={rows.map((row) => row.id)} strategy={verticalListSortingStrategy}>
        <div className="grid w-full min-w-0 max-w-full gap-2.5">
          {rows.map((row, index) => (
            <ArrayRow
              key={row.id}
              row={row}
              index={index}
              total={rows.length}
              readonly={readonly}
              gridStyle={gridStyle}
              renderRow={renderRow}
              onMoveUp={() => field.moveUp(index)}
              onMoveDown={() => field.moveDown(index)}
              onRemove={() => field.remove(index)}
            />
          ))}
        </div>
      </SortableContext>
      {readonly ? null : (
        <Button
          className="mt-2 justify-self-start"
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => field.push({})}
        >
          添加一行
        </Button>
      )}
    </DndContext>
  );
}

export function Card(props: ComplexFieldProps) {
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
  if (
    built.field.kind !== "array" &&
    built.field.kind !== "object" &&
    built.field.kind !== "void"
  ) {
    throw new Error(`Card 不支持 ${built.field.kind} 字段：${built.field.path}`);
  }

  return (
    <FieldsetCard title={built.title} description={built.description} gridSpan={built.gridSpan}>
      {built.field.kind === "array" ? (
        <ArrayContent
          field={built.field}
          readonly={built.mode === "detail"}
          columns={built.columns}
          gutter={built.gutter}
          renderRow={built.renderRow}
        />
      ) : (
        <div
          className="grid w-full min-w-0 max-w-full grid-cols-[repeat(24,minmax(0,1fr))] gap-x-[var(--alien-grid-column-gap)] gap-y-[var(--alien-grid-row-gap)]"
          style={fieldGridStyle({ columns: built.columns, gutter: built.gutter })}
        >
          {built.children}
        </div>
      )}
    </FieldsetCard>
  );
}

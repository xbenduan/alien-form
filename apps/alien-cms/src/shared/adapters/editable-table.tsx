import React, { useMemo, useState } from "react";
import { defineAdapter } from "@alien-form/cms";
import { DeleteOutlined, EditOutlined, PlusOutlined } from "../ui";
import { Button, Modal, Table } from "../ui";
import type { ColumnsType } from "../ui";

interface ChildSchema {
  type?: string;
  title?: string;
  order?: number;
}

interface EditableTableProps {
  field: {
    schema: {
      items?: { properties?: Record<string, ChildSchema> };
    };
  };
  rowNodes: Array<{ id?: string | number }>;
  rowFields: Array<Record<string, React.ReactNode>>;
  onAdd: (initialValues?: unknown) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
  addText?: string;
}

const COMPLEX_TYPES = new Set(["object", "array", "void"]);

interface TableRow {
  key: string | number;
  index: number;
}

interface ModalState {
  rowIndex: number;
  childKey: string;
  title: string;
}

function EditableTable({
  field,
  rowNodes,
  rowFields,
  onAdd,
  onRemove,
  disabled,
  addText = "+ 添加",
}: EditableTableProps) {
  const [modalState, setModalState] = useState<ModalState | null>(null);

  const properties = field.schema.items?.properties ?? {};

  const columnKeys = useMemo(() => {
    return Object.keys(properties).sort((left, right) => {
      const leftOrder = properties[left]?.order;
      const rightOrder = properties[right]?.order;
      if (typeof leftOrder === "number" && typeof rightOrder === "number") {
        return leftOrder - rightOrder;
      }
      if (typeof leftOrder === "number") {
        return -1;
      }
      if (typeof rightOrder === "number") {
        return 1;
      }
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties]);

  const dataSource: TableRow[] = rowFields.map((_, index) => ({
    key: rowNodes[index]?.id ?? index,
    index,
  }));

  const columns: ColumnsType<TableRow> = columnKeys.map((childKey) => {
    const childSchema = properties[childKey];
    const title = childSchema?.title ?? childKey;
    const isComplex = COMPLEX_TYPES.has(childSchema?.type ?? "");
    return {
      title,
      dataIndex: childKey,
      key: childKey,
      render: (_: unknown, row: TableRow) => {
        const node = rowFields[row.index]?.[childKey];
        if (isComplex) {
          const summary = node ? "已配置" : "—";
          return (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span>{summary}</span>
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => setModalState({ rowIndex: row.index, childKey, title })}
              />
            </span>
          );
        }
        return <div className="editable-table-cell">{node}</div>;
      },
    };
  });

  if (!disabled) {
    columns.push({
      title: "操作",
      key: "__actions__",
      width: 80,
      render: (_: unknown, row: TableRow) => (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={() => onRemove(row.index)}
        />
      ),
    });
  }

  const modalNode =
    modalState != null ? rowFields[modalState.rowIndex]?.[modalState.childKey] : null;

  return (
    <div>
      <Table<TableRow>
        size="small"
        pagination={false}
        rowKey="key"
        columns={columns}
        dataSource={dataSource}
      />
      {!disabled ? (
        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={() => onAdd()}
          style={{ marginTop: 12 }}
        >
          {addText}
        </Button>
      ) : null}
      <Modal
        open={modalState != null}
        title={modalState?.title}
        onCancel={() => setModalState(null)}
        onOk={() => setModalState(null)}
        okText="完成"
        cancelButtonProps={{ style: { display: "none" } }}
        destroyOnClose
      >
        {modalNode}
      </Modal>
    </div>
  );
}

export default defineAdapter(EditableTable, {
  key: "EditableTable",
  label: "可编辑表格",
  description: "对象数组表格编辑组件。",
  kind: "component",
  scenes: { form: {}, detail: { mode: "readonly", props: { disabled: true } } },
  meta: { fieldType: "array" },
});

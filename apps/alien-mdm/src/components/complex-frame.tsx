import type { ReactNode } from "react";
import { useState } from "react";
import { ProfileOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import type { FieldComponentProps } from "../types/shared";
import { FieldDetailModal } from "./FieldDetailModal";
import { toDisplayText } from "../compiler";
import styles from "./index.module.css";

/** 复杂字段（ObjectField / ArrayCards）的通用外观与详情单元格，供 register/ 中两者复用。 */
export function ComplexFieldFrame({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <fieldset className={styles.complexField}>
      {title ? <legend className={styles.complexFieldTitle}>{title}</legend> : null}
      {description ? <div className={styles.complexFieldDescription}>{description}</div> : null}
      <div className={styles.complexFieldBody}>{children}</div>
    </fieldset>
  );
}

export function readFieldPropTitle(field: unknown): string | undefined {
  const schema = (field as { schema?: { props?: Record<string, unknown> } } | undefined)?.schema;
  const title = schema?.props?.title;
  return typeof title === "string" ? title : undefined;
}

/** table 单元格中复杂字段的通用外观：摘要文本 + 详情按钮 + 详情弹窗。 */
export function TableComplexCell({
  value,
  schema,
  title,
}: {
  value: unknown;
  schema?: FieldComponentProps["schema"];
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className={styles.tableComplex}>
      <span className={styles.tableComplexSummary}>{toDisplayText(value)}</span>
      <Tooltip title={`查看${title ?? ""}详情`}>
        <Button
          type="link"
          size="small"
          icon={<ProfileOutlined />}
          aria-label={`查看${title ?? ""}详情`}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <FieldDetailModal
        open={open}
        title={title}
        field={schema}
        value={value}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

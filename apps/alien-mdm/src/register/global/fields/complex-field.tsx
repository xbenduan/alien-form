import { useCreateForm } from "@alien-form/react";
import { ProfileOutlined } from "@ant-design/icons";
import { Button, Empty, Modal, Tooltip } from "antd";
import { useMemo, useState, type ReactNode } from "react";
import { FormRenderer, useRuntime } from "@binding";
import { compileForm, type FieldSchema } from "@alien-form/engine";
import styles from "./index.module.css";

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

function isEmptyValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function complexValueSummary(value: unknown): string {
  if (isEmptyValue(value)) return "—";
  if (Array.isArray(value)) return `共 ${value.length} 项`;
  if (value && typeof value === "object") {
    const count = Object.values(value).filter((item) => !isEmptyValue(item)).length;
    return count > 0 ? `已配置 ${count} 项` : "—";
  }
  return String(value);
}

function DetailFieldForm({
  schema,
  value,
  domain,
}: {
  schema: FieldSchema;
  value: unknown;
  domain?: string;
}) {
  const runtime = useRuntime();
  const compiled = useMemo(() => {
    const detailField = { ...schema, title: undefined };
    return compileForm(
      { properties: { __detail__: detailField } },
      { "form-schema": { type: "object", properties: { __detail__: detailField } } },
    );
  }, [schema]);
  const form = useCreateForm(
    {
      schema: compiled.schema,
      initialValues: { __detail__: value },
      scope: runtime.createScope(domain, {}, "detail"),
    },
    [compiled.schema, domain, runtime, value],
  );

  return <FormRenderer form={form} nodes={compiled.nodes} domain={domain} />;
}

export function TableComplexCell({
  value,
  schema,
  title,
  domain,
}: {
  value: unknown;
  schema?: FieldSchema;
  title?: string;
  domain?: string;
}) {
  const [open, setOpen] = useState(false);
  const detailLabel = `查看${title ?? ""}详情`;

  return (
    <div className={styles.tableComplex}>
      <span className={styles.tableComplexSummary}>{complexValueSummary(value)}</span>
      <Tooltip title={detailLabel}>
        <Button
          type="link"
          size="small"
          icon={<ProfileOutlined />}
          aria-label={detailLabel}
          onClick={() => setOpen(true)}
        />
      </Tooltip>
      <Modal
        centered
        destroyOnHidden
        footer={null}
        width={640}
        title={title ? `${title}详情` : "字段详情"}
        open={open}
        onCancel={() => setOpen(false)}
      >
        {open && schema ? (
          <DetailFieldForm schema={schema} value={value} domain={domain} />
        ) : open ? (
          <Empty description="暂无字段详情" />
        ) : null}
      </Modal>
    </div>
  );
}

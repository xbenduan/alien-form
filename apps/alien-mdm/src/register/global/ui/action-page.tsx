import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Space, Spin } from "antd";
import { App } from "antd";
import { useQuery } from "@tanstack/react-query";
import {
  useBlock,
  usePage,
  useRuntime,
  FormBlockRenderer,
  type ComponentProps,
  type FormBlockRuntime,
} from "@alien-form/engine/react";
import type { ModelRecord } from "../../../runtime/types";
import { refValue } from "../../../compiler/shared";
import { FieldModeScope } from "../../../components/field-mode";
import { recordListPath } from "../../../app/router/paths";
import styles from "../ui.module.css";

/**
 * Unwrap reference objects {$ref, value, label} to plain values so alien-form
 * leaf fields (which reject objects) receive the scalar join key.
 */
function unwrapRecord(record: ModelRecord): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    result[key] = refValue(val);
  }
  return result;
}

export function RecordActionPageLayout({ node }: ComponentProps) {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const runtime = useRuntime();
  const page = usePage();
  const block = useBlock(node.block ?? "form") as FormBlockRuntime;
  const [submitting, setSubmitting] = useState(false);
  const initialized = useRef(false);

  const mode = (node.props?.mode as "add" | "edit" | "detail") ?? "add";
  const recordId = node.props?.recordId as string | undefined;
  const modelName = (node.props?.model as string | undefined) ?? page.domain;
  const isReadOnly = mode === "detail";

  const recordQuery = useQuery({
    queryKey: ["records", modelName, "detail", recordId],
    enabled: mode !== "add" && Boolean(recordId),
    queryFn: async () => {
      const svc = runtime.registry.services.resolve("records.get");
      if (!svc) throw new Error("records.get not registered");
      return (await svc.send({ model: modelName, id: recordId })) as ModelRecord;
    },
  });

  useEffect(() => {
    if (recordQuery.data && !initialized.current) {
      initialized.current = true;
      block.setValues(unwrapRecord(recordQuery.data));
    }
  }, [recordQuery.data, block]);

  const back = () => navigate(recordListPath(modelName));

  const handleSubmit = async () => {
    const valid = await block.form.validate();
    if (!valid) return;
    const values = block.form.values();
    setSubmitting(true);
    try {
      if (mode === "add") {
        const svc = runtime.registry.services.resolve("records.create");
        await svc?.send({ model: modelName, values });
        message.success("新增成功");
      } else {
        const svc = runtime.registry.services.resolve("records.update");
        await svc?.send({ model: modelName, id: recordId, values });
        message.success("保存成功");
      }
      runtime.bus.emit("record:changed", { model: modelName, mode });
      back();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  if (recordQuery.isLoading) {
    return (
      <div className={`${styles.actionBody} ${styles.actionLoading}`}>
        <Spin />
      </div>
    );
  }

  return (
    <>
      <div className={styles.actionBody}>
        <FieldModeScope value={mode}>
          <FormBlockRenderer blockName={node.block ?? "form"} />
        </FieldModeScope>
      </div>
      <div className={styles.actionFooterRoot}>
        <div className={styles.actionFooter}>
          <Space>
            <Button onClick={back}>返回</Button>
            {isReadOnly ? null : (
              <Button type="primary" loading={submitting} onClick={handleSubmit}>
                {mode === "add" ? "创建" : "保存"}
              </Button>
            )}
          </Space>
        </div>
      </div>
    </>
  );
}

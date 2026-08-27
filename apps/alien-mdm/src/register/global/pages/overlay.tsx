import { useEffect, useState } from "react";
import { Drawer, Modal, App, Button, Space } from "antd";
import {
  usePage,
  useRuntime,
  useConstant,
  FormBlockRenderer,
  type ComponentProps,
} from "@alien-form/engine/react";
import type { ModelRecord } from "@runtime/types";
import { refValue } from "@utils/field-values";
import styles from "../ui.module.css";

type OverlayMode = "add" | "edit" | "detail";
type OverlayOpenMode = "drawer" | "modal";

interface OverlayState {
  mode: OverlayMode;
  id?: string;
  model?: string;
  block?: string;
  openMode?: OverlayOpenMode;
}

/**
 * 引用对象 {$ref, value, label} 拍回标量，交给 alien-form 叶子字段（拒绝对象）。
 */
function unwrapRecord(record: ModelRecord): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) result[key] = refValue(val);
  return result;
}

/**
 * 记录叠加层：承接 drawer / modal 形态的新增/编辑/详情。
 * add/edit/detail 均由 overlay:open 事件触发，detail 只读且无提交按钮。
 */
export function RecordOverlay({ node }: ComponentProps) {
  const { message } = App.useApp();
  const page = usePage();
  const runtime = useRuntime();
  const [state, setState] = useState<OverlayState | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const TITLE_PREFIX = useConstant<Record<OverlayMode, string>>("overlayTitlePrefix");

  const drawerTitle = node.props?.title as string | undefined;
  const width = (node.props?.width as number) ?? 480;

  useEffect(() => {
    const off = runtime.bus.on("overlay:open", (payload) => {
      const p = payload as OverlayState;
      setState(p);
      const blockName = p.block ?? "form";
      const formBlock = page.block(blockName) as unknown as {
        reset: () => void;
        setValues: (v: Record<string, unknown>) => void;
        form: { setScope: (scope: Record<string, unknown>) => void };
      };
      formBlock.form.setScope({ mode: p.mode });
      formBlock.reset();
      if (p.mode !== "add" && p.id) loadRecord(p.model!, p.id, blockName);
    });
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, page]);

  const loadRecord = async (model: string, id: string, blockName: string) => {
    setLoading(true);
    try {
      const svc = runtime.registry.services.resolve("records.get");
      if (!svc) return;
      const data = (await svc.send({ model, id })) as ModelRecord;
      const formBlock = page.block(blockName) as unknown as {
        setValues: (v: Record<string, unknown>) => void;
      };
      formBlock.setValues(unwrapRecord(data));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => setState(null);

  const handleSubmit = async () => {
    if (!state || state.mode === "detail") return;
    const blockName = state.block ?? "form";
    const formBlock = page.block(blockName) as unknown as {
      form: { values: () => Record<string, unknown>; validate: () => Promise<boolean> };
    };

    const valid = await formBlock.form.validate();
    if (!valid) return;

    const values = formBlock.form.values();
    const model = state.model ?? page.domain;

    setSubmitting(true);
    try {
      if (state.mode === "add") {
        const svc = runtime.registry.services.resolve("records.create");
        await svc?.send({ model, values });
        message.success("创建成功");
      } else if (state.mode === "edit" && state.id) {
        const svc = runtime.registry.services.resolve("records.update");
        await svc?.send({ model, id: state.id, values });
        message.success("更新成功");
      }
      runtime.bus.emit("record:changed", { model, mode: state.mode });
      handleClose();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "操作失败");
    } finally {
      setSubmitting(false);
    }
  };

  const mode = state?.mode ?? "add";
  const isDetail = mode === "detail";
  const isModal = state?.openMode === "modal";
  const title = drawerTitle ? `${TITLE_PREFIX?.[mode] ?? ""} ${drawerTitle}`.trim() : undefined;

  const footer = isDetail ? null : (
    <Space>
      <Button onClick={handleClose}>取消</Button>
      <Button type="primary" loading={submitting} onClick={handleSubmit}>
        {mode === "add" ? "创建" : "保存"}
      </Button>
    </Space>
  );

  const body =
    state !== null ? (
      <div
        className={`${styles.recordActionOverlay}${
          loading ? ` ${styles.recordActionOverlayLoading}` : ""
        }`}
      >
        <FormBlockRenderer blockName={state.block ?? "form"} />
      </div>
    ) : null;

  if (isModal) {
    return (
      <Modal
        centered
        destroyOnHidden
        title={title}
        open={state !== null}
        width={width}
        loading={loading}
        onCancel={handleClose}
        footer={footer}
      >
        {body}
      </Modal>
    );
  }

  return (
    <Drawer
      title={title}
      size={width}
      open={state !== null}
      onClose={handleClose}
      loading={loading}
      destroyOnHidden
      footer={isDetail ? null : <div className={styles.overlayFooter}>{footer}</div>}
    >
      {body}
    </Drawer>
  );
}

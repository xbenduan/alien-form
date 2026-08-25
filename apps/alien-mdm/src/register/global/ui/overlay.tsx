import { useEffect, useState } from "react";
import { Drawer, App } from "antd";
import {
  usePage,
  useRuntime,
  FormBlockRenderer,
  type ComponentProps,
} from "@alien-form/engine/react";
import type { IFormSchema } from "@alien-form/core";
import type { ModelRecord } from "../../../runtime/types";

interface OverlayState {
  mode: "add" | "edit" | "detail";
  id?: string;
  model?: string;
  block?: string;
}

export function RecordOverlay({ node }: ComponentProps) {
  const { message } = App.useApp();
  const page = usePage();
  const runtime = useRuntime();
  const [state, setState] = useState<OverlayState | null>(null);
  const [record, setRecord] = useState<ModelRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const formSchema = node.props?.formSchema as IFormSchema | undefined;
  const drawerTitle = node.props?.title as string | undefined;
  const width = (node.props?.width as number) ?? 480;

  useEffect(() => {
    const off = runtime.bus.on("overlay:open", (payload) => {
      const p = payload as OverlayState;
      setState(p);
      if (p.mode !== "add" && p.id) {
        loadRecord(p.model!, p.id);
      } else {
        setRecord(null);
      }
    });
    return off;
  }, [runtime]);

  const loadRecord = async (model: string, id: string) => {
    setLoading(true);
    try {
      const svc = runtime.registry.services.resolve("records.get");
      if (svc) {
        const data = (await svc.send({ model, id })) as ModelRecord;
        setRecord(data);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setState(null);
    setRecord(null);
  };

  const handleSubmit = async () => {
    if (!state) return;
    const blockName = state.block ?? "form";
    const formBlock = page.block(blockName) as unknown as {
      form: { values: () => Record<string, unknown>; validate: () => Promise<boolean> };
      setValues: (v: Record<string, unknown>) => void;
    };

    if (state.mode === "detail") {
      handleClose();
      return;
    }

    const valid = await formBlock.form.validate();
    if (!valid) return;

    const values = formBlock.form.values();
    const model = state.model ?? page.schema.id;

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
    }
  };

  useEffect(() => {
    if (state && record && state.mode !== "add") {
      const blockName = state.block ?? "form";
      const formBlock = page.block(blockName) as unknown as {
        setValues: (v: Record<string, unknown>) => void;
      };
      formBlock?.setValues(record);
    }
  }, [state, record, page]);

  const isDetail = state?.mode === "detail";

  return (
    <Drawer
      title={
        drawerTitle
          ? `${state?.mode === "add" ? "新建" : state?.mode === "edit" ? "编辑" : "详情"} ${drawerTitle}`
          : undefined
      }
      width={width}
      open={state !== null}
      onClose={handleClose}
      loading={loading}
      destroyOnClose
      footer={
        isDetail ? null : (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              onClick={handleClose}
              style={{ padding: "6px 16px", border: "1px solid #d9d9d9", borderRadius: 6, cursor: "pointer" }}
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              style={{
                padding: "6px 16px",
                background: "#1677ff",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              提交
            </button>
          </div>
        )
      }
    >
      {formSchema ? <FormBlockRenderer blockName={state?.block ?? "form"} /> : null}
    </Drawer>
  );
}

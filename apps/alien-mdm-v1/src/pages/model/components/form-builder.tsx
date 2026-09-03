import { PlusOutlined } from "@ant-design/icons";
import { useCreateForm } from "@alien-form/react";
import { App, Button, Empty } from "antd";
import { useMemo, useState } from "react";
import { FormRenderer, useRuntime } from "@binding";
import { compileForm } from "@engine";
import {
  createField,
  encodeModel,
  type FieldNode,
  type ModelAction,
  type ModelDraft,
} from "../builder";
import { FieldBarTree } from "./field-bar-tree";
import { GroupEditor } from "./group-editor";
import { FormFieldModal } from "./form-field-modal";
import styles from "./builder.module.css";

interface EditorState {
  node: FieldNode;
  parentId?: string;
  isNew: boolean;
}

/** 收集全部字段 key（含嵌套），用于 key 唯一校验。 */
function collectKeys(fields: FieldNode[]): string[] {
  return fields.flatMap((node) => [node.key, ...collectKeys(node.children ?? [])]);
}

export function FormBuilder({
  draft,
  dispatch,
}: {
  draft: ModelDraft;
  dispatch: (action: ModelAction) => void;
}) {
  const runtime = useRuntime();
  const { message } = App.useApp();
  const [editor, setEditor] = useState<EditorState>();

  const existingKeys = useMemo(() => collectKeys(draft.fields), [draft.fields]);

  // 预览：把当前 draft 编译为 form-schema 渲染。
  const preview = useMemo(() => {
    try {
      const model = encodeModel(draft);
      const compiled = compileForm(model.definitions["form-schema"], model.definitions);
      return { compiled, error: undefined as string | undefined };
    } catch (reason) {
      return { compiled: undefined, error: reason instanceof Error ? reason.message : String(reason) };
    }
  }, [draft]);

  const compiled = preview.compiled;
  const form = useCreateForm(
    compiled
      ? {
          schema: compiled.schema,
          scope: runtime.createScope(draft.name, {}, "edit"),
        }
      : { schema: { type: "object", properties: {} } },
    [compiled, runtime, draft.name],
  );

  const addExtra = () => {
    setEditor({ node: createField(runtime, { source: "extra" }), isNew: true });
  };
  const addChild = (parentId: string) => {
    setEditor({ node: createField(runtime, { source: "extra" }), parentId, isNew: true });
  };

  return (
    <div className={styles.formBuilder}>
      <div className={styles.formTop}>
        <div className={styles.editorPane}>
          <div className={styles.paneHeader}>
            <span>字段编辑</span>
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={addExtra}>
              新增展示字段
            </Button>
          </div>
          <div className={styles.paneBody}>
            <FieldBarTree
              fields={draft.fields}
              runtime={runtime}
              domain={draft.name}
              onEdit={(node) => setEditor({ node, isNew: false })}
              onRemove={(node) => dispatch({ type: "field.remove", id: node.id })}
              onAddChild={addChild}
              onMove={(id, parentId, toIndex) =>
                dispatch({ type: "field.move", id, parentId, toIndex })
              }
            />
          </div>
        </div>
        <div className={styles.previewPane}>
          <div className={styles.paneHeader}>
            <span>表单预览</span>
          </div>
          <div className={styles.previewBody}>
            {preview.error ? (
              <Empty description={`无法预览：${preview.error}`} />
            ) : compiled && compiled.nodes.length ? (
              <FormRenderer form={form} nodes={compiled.nodes} domain={draft.name} />
            ) : (
              <Empty description="暂无可预览字段" />
            )}
          </div>
        </div>
      </div>
      <div className={styles.groupSection}>
        <GroupEditor draft={draft} dispatch={dispatch} />
      </div>
      <FormFieldModal
        open={Boolean(editor)}
        node={editor?.node}
        runtime={runtime}
        domain={draft.name}
        existingKeys={existingKeys}
        onCancel={() => setEditor(undefined)}
        onSubmit={(node) => {
          if (!editor) return;
          if (editor.isNew) {
            dispatch({ type: "field.add", node, parentId: editor.parentId });
          } else {
            dispatch({ type: "field.update", id: node.id, node });
          }
          setEditor(undefined);
          message.success(editor.isNew ? "字段已新增" : "字段已更新");
        }}
      />
    </div>
  );
}

import { useCreateForm } from "@alien-form/react";
import { App, Button, Card, Col, Empty, Flex, Input, Row, Segmented } from "antd";
import { useEffect, useMemo, useState } from "react";
import { FormRenderer, useRuntime } from "@binding";
import { compileForm } from "@engine";
import {
  applyFormSchema,
  createField,
  encodeModel,
  type FieldNode,
  type ModelAction,
  type ModelDraft,
} from "../builder";
import { FieldBarTree } from "./field-bar-tree";
import { FormFieldModal } from "./form-field-modal";
import { PlusOutlined } from "@ant-design/icons";
import styles from "./builder.module.css";

interface EditorState {
  node: FieldNode;
  parentId?: string;
  isNew: boolean;
}

type RightTab = "preview" | "source";

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
  const [rightTab, setRightTab] = useState<RightTab>("preview");

  const existingKeys = useMemo(() => collectKeys(draft.fields), [draft.fields]);

  // 预览：把当前 draft 编译为 form-schema 渲染。
  const preview = useMemo(() => {
    try {
      const model = encodeModel(draft);
      const compiled = compileForm(model.definitions["form-schema"], model.definitions);
      return {
        compiled,
        formSchema: model.definitions["form-schema"],
        error: undefined as string | undefined,
      };
    } catch (reason) {
      return {
        compiled: undefined,
        formSchema: undefined,
        error: reason instanceof Error ? reason.message : String(reason),
      };
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

  // 源码编辑：文本框内容随 draft 同步（除非用户正在编辑）。
  const sourceText = useMemo(
    () => (preview.formSchema ? JSON.stringify(preview.formSchema, null, 2) : ""),
    [preview.formSchema],
  );
  const [sourceDraft, setSourceDraft] = useState(sourceText);
  useEffect(() => setSourceDraft(sourceText), [sourceText]);

  const applySource = () => {
    try {
      const parsed = JSON.parse(sourceDraft) as {
        properties?: Record<string, FieldNode["form"] & { type?: string }>;
      };
      if (!parsed || typeof parsed !== "object" || !parsed.properties) {
        throw new Error("form-schema 必须包含 properties 对象");
      }
      dispatch({
        type: "fields.replace",
        fields: applyFormSchema(draft.fields, parsed.properties as never),
      });
      message.success("已应用源码修改");
    } catch (reason) {
      message.error(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const addExtra = () => {
    setEditor({ node: createField(runtime, { source: "extra" }), isNew: true });
  };
  const addChild = (parentId: string) => {
    setEditor({ node: createField(runtime, { source: "extra" }), parentId, isNew: true });
  };

  return (
    <>
      <Flex vertical gap={16}>
        <Row gutter={16}>
          <Col span={12}>
            <Card
              title="字段列表"
              extra={
                <Button type="link" icon={<PlusOutlined />} onClick={addExtra}>
                  新增字段
                </Button>
              }
              classNames={{ body: styles.formBuilderCardBody }}
            >
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
            </Card>
          </Col>
          <Col span={12}>
            <Card
              title={
                <Segmented<RightTab>
                  value={rightTab}
                  onChange={setRightTab}
                  options={[
                    { label: "表单预览", value: "preview" },
                    { label: "源码编辑", value: "source" },
                  ]}
                />
              }
              extra={
                rightTab !== "preview" && (
                  <Button type="link" onClick={applySource}>
                    应用
                  </Button>
                )
              }
              classNames={{ body: styles.formBuilderCardBody }}
            >
              {rightTab === "preview" ? (
                <>
                  {preview.error ? (
                    <Empty description={`无法预览：${preview.error}`} />
                  ) : compiled && compiled.nodes.length ? (
                    <FormRenderer form={form} nodes={compiled.nodes} domain={draft.name} />
                  ) : (
                    <Empty description="暂无可预览字段" />
                  )}
                </>
              ) : (
                <Input.TextArea
                  value={sourceDraft}
                  onChange={(event) => setSourceDraft(event.target.value)}
                  spellCheck={false}
                  className={styles.sourceJson}
                  style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
                />
              )}
            </Card>
          </Col>
        </Row>
      </Flex>
      <FormFieldModal
        open={Boolean(editor)}
        node={editor?.node}
        isNew={editor?.isNew}
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
    </>
  );
}

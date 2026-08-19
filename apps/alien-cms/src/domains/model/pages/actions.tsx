import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EyeOutlined, SaveOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Flex, Row, Space, Steps } from "antd";
import { PageError, PageLoading } from "../../../components";
import { modelListPath } from "../../../app/router/paths";
import { useModelBuilder } from "../hooks";
import {
  FieldEditor,
  FieldListEditor,
  GroupEditor,
  ModelMetaForm,
  SchemaPreview,
} from "../components";
import type { FieldDraft } from "../types";
import styles from "./actions.module.css";

const STEPS = [
  { title: "字段" },
  { title: "分组与元信息" },
  { title: "预览保存" },
];

function findField(fields: FieldDraft[], id?: string): FieldDraft | undefined {
  for (const field of fields) {
    if (field.id === id) return field;
    if (field.children) {
      const child = findField(field.children, id);
      if (child) return child;
    }
  }
  return undefined;
}

function replaceField(fields: FieldDraft[], next: FieldDraft): FieldDraft[] {
  return fields.map((field) => {
    if (field.id === next.id) return next;
    if (field.children) return { ...field, children: replaceField(field.children, next) };
    return field;
  });
}

interface ModelActionPageProps {
  mode: "add" | "edit";
}

/** 模型构建页（新开页面）：add / edit 共用，由 mode 区分。 */
export default function ModelActionPage({ mode }: ModelActionPageProps) {
  const navigate = useNavigate();
  const { modelName } = useParams();
  const { message } = App.useApp();
  const builder = useModelBuilder(mode === "edit" ? modelName : undefined);
  const [step, setStep] = useState(0);
  const [selectedFieldId, setSelectedFieldId] = useState<string>();

  const selectedField = useMemo(
    () => findField(builder.draft.fields, selectedFieldId) ?? builder.draft.fields[0],
    [builder.draft.fields, selectedFieldId],
  );

  if (builder.loading) return <PageLoading />;
  if (builder.loadError) {
    return <PageError title="模型加载失败" description={builder.loadError.message} />;
  }

  const handleSave = async () => {
    if (!builder.draft.name.trim()) {
      message.error("请填写模型名");
      return;
    }
    if (!/^[a-z][a-z0-9-]*$/.test(builder.draft.name.trim())) {
      message.error("模型名仅支持小写字母、数字和中划线，且以字母开头");
      return;
    }
    if (builder.preview.error) {
      message.error(builder.preview.error);
      return;
    }
    try {
      await builder.save();
      message.success(mode === "edit" ? "模型保存成功" : "模型创建成功");
      navigate(modelListPath());
    } catch (error) {
      message.error(error instanceof Error ? error.message : "保存失败");
    }
  };

  return (
    <Flex className={styles.page} vertical gap={16}>
      <Card styles={{ body: { padding: 20 } }}>
        <Steps current={step} items={STEPS} />
      </Card>

      <div className={styles.body}>
        {step === 0 ? (
          <Row gutter={[20, 20]}>
            <Col span={11}>
              <Card title="字段列表" styles={{ body: { padding: 16 } }}>
                <FieldListEditor
                  fields={builder.draft.fields}
                  selectedId={selectedField?.id}
                  onSelect={setSelectedFieldId}
                  onChange={(fields) => builder.setDraft({ ...builder.draft, fields })}
                />
              </Card>
            </Col>
            <Col span={13}>
              <Card title="字段配置" styles={{ body: { padding: 16 } }}>
                {selectedField ? (
                  <FieldEditor
                    field={selectedField}
                    onChange={(next) =>
                      builder.setDraft({
                        ...builder.draft,
                        fields: replaceField(builder.draft.fields, next),
                      })
                    }
                  />
                ) : null}
              </Card>
            </Col>
          </Row>
        ) : null}

        {step === 1 ? (
          <Row gutter={[20, 20]}>
            <Col span={13}>
              <Card title="模型信息" styles={{ body: { padding: 16 } }}>
                <ModelMetaForm
                  draft={builder.draft}
                  nameDisabled={mode === "edit"}
                  onChange={builder.setDraft}
                />
              </Card>
            </Col>
            <Col span={11}>
              <Card title="表单分组" styles={{ body: { padding: 16 } }}>
                <GroupEditor
                  groups={builder.draft.groups}
                  fields={builder.draft.fields}
                  onChange={(groups) => builder.setDraft({ ...builder.draft, groups })}
                />
              </Card>
            </Col>
          </Row>
        ) : null}

        {step === 2 ? (
          <Card styles={{ body: { padding: 16 } }}>
            <SchemaPreview schema={builder.preview.schema} error={builder.preview.error} />
          </Card>
        ) : null}
      </div>

      <div className={styles.footer}>
        <Space>
          <Button onClick={() => navigate(modelListPath())}>取消</Button>
          {step > 0 ? <Button onClick={() => setStep((s) => s - 1)}>上一步</Button> : null}
          {step < 2 ? (
            <Button type="primary" onClick={() => setStep((s) => s + 1)}>
              下一步
            </Button>
          ) : (
            <Button
              type="primary"
              icon={mode === "edit" ? <SaveOutlined /> : <EyeOutlined />}
              loading={builder.saving}
              onClick={handleSave}
            >
              {mode === "edit" ? "保存模型" : "创建模型"}
            </Button>
          )}
        </Space>
      </div>
    </Flex>
  );
}

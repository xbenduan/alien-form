import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { EyeOutlined, RedoOutlined, SaveOutlined, UndoOutlined } from "@ant-design/icons";
import { App, Button, Card, Col, Flex, Row, Space, Steps } from "antd";
import { BuilderProvider } from "@alien-form/builder/react";
import { PageBreadcrumb, PageError, PageLoading, FieldsetCard } from "../../../components";
import { modelListPath } from "../../../app/router/paths";
import { useModelBuilder } from "../hooks";
import {
  FieldListEditor,
  GroupEditor,
  LayoutEditor,
  ModelMetaForm,
  SchemaPreview,
} from "../components";
import styles from "./index.module.css";

const STEPS = [{ title: "基本信息" }, { title: "表单配置" }, { title: "页面布局" }];

interface ModelActionPageProps {
  mode: "add" | "edit";
}

/** 模型构建页（新开页面）：add / edit 共用，由 mode 区分。 */
export default function ModelActionPage({ mode }: ModelActionPageProps) {
  const { modelName } = useParams();
  const builder = useModelBuilder(mode === "edit" ? modelName : undefined);
  return (
    <BuilderProvider builder={builder.runtime}>
      <ModelActionContent mode={mode} builder={builder} />
    </BuilderProvider>
  );
}

function ModelActionContent({
  mode,
  builder,
}: ModelActionPageProps & { builder: ReturnType<typeof useModelBuilder> }) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  if (builder.loading) return <PageLoading />;
  if (builder.loadError) {
    return <PageError title="模型加载失败" description={builder.loadError.message} />;
  }

  const handleSave = async () => {
    const validationError = builder.errors[0];
    if (validationError) {
      message.error(
        typeof validationError === "string" ? validationError : validationError.message,
      );
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
    <Flex className={`${styles.actionsPage} ${styles.page}`} vertical gap={16}>
      <PageBreadcrumb
        items={[
          { title: "模型管理", to: modelListPath() },
          { title: mode === "edit" ? "编辑模型" : "新增模型" },
        ]}
      />
      <Card styles={{ body: { padding: 20 } }}>
        <Steps current={step} items={STEPS} />
      </Card>

      <div className={styles.body}>
        {step === 0 ? (
          <FieldsetCard title="模型信息">
            <ModelMetaForm nameDisabled={mode === "edit"} />
          </FieldsetCard>
        ) : null}

        {step === 1 ? (
          <div className={styles.formStep}>
            <Row gutter={16} align="stretch" className={styles.fieldsStep}>
              <Col span={16} className={styles.fill}>
                <FieldsetCard title="字段" className={styles.fill}>
                  <FieldListEditor />
                </FieldsetCard>
              </Col>
              <Col span={8} className={styles.fill}>
                <FieldsetCard title="实时验证" className={styles.fill}>
                  <SchemaPreview schema={builder.preview.schema} error={builder.preview.error} />
                </FieldsetCard>
              </Col>
            </Row>
            <FieldsetCard title="表单分组">
              <GroupEditor />
            </FieldsetCard>
          </div>
        ) : null}

        {step === 2 ? (
          <FieldsetCard title="页面布局（x-layout）">
            <LayoutEditor />
          </FieldsetCard>
        ) : null}
      </div>

      <div className={styles.footer}>
        <Space>
          <Button
            icon={<UndoOutlined />}
            disabled={!builder.canUndo}
            aria-label="撤销"
            onClick={() => builder.runtime.undo()}
          />
          <Button
            icon={<RedoOutlined />}
            disabled={!builder.canRedo}
            aria-label="重做"
            onClick={() => builder.runtime.redo()}
          />
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

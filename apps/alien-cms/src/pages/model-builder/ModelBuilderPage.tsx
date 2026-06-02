import { ArrowLeftOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { useSignalValue } from '@alien-form/react';
import { Alert, Breadcrumb, Button, Card, Col, Modal, Row, Space, Spin, Steps, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ModelBuilderDraft } from '@alien-form/cms';
import { buildModelPath } from '../../app/model-path';
import { cmsAppStore } from '../../data/cms-data-access';
import { FieldConfigPanel } from './FieldConfigPanel';
import { FieldListEditor } from './FieldListEditor';
import { ModelMetaForm } from './ModelMetaForm';
import { ModelPreviewPanel } from './ModelPreviewPanel';

function validateModelMeta(draft: ModelBuilderDraft, existingModelNames: string[], isEditMode: boolean) {
  if (!draft.modelName.trim()) {
    throw new Error('请先填写模型名');
  }
  if (!/^[a-z][a-z0-9-]*$/.test(draft.modelName.trim())) {
    throw new Error('模型名仅支持小写字母、数字和中划线，且必须以字母开头');
  }
  if (!isEditMode && existingModelNames.includes(draft.modelName.trim())) {
    throw new Error(`模型名 ${draft.modelName.trim()} 已存在`);
  }
  if (!draft.title.trim()) {
    throw new Error('请先填写模型标题');
  }
}

export default function ModelBuilderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams();
  const editModelName = params.modelName;
  const isEditMode = Boolean(editModelName);
  const store = useMemo(() => cmsAppStore.createModelBuilderStore(), []);
  const draft = useSignalValue(store.draft);
  const selectedFieldId = useSignalValue(store.selectedFieldId);
  const selectedField = useSignalValue(store.selectedField);
  const previewSchema = useSignalValue(store.previewSchema);
  const previewError = useSignalValue(store.previewError);
  const existingModels = useSignalValue(store.models);
  const saving = useSignalValue(store.saving);
  const loadingSchema = useSignalValue(store.loadingSchema);
  const loadingError = useSignalValue(store.loadingError);
  const [currentStep, setCurrentStep] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [previewJsonVisible, setPreviewJsonVisible] = useState(false);
  
  useEffect(() => {
    void store.fetchModels();
    return () => {
      store.dispose();
    };
  }, [store]);

  useEffect(() => {
    if (isEditMode && editModelName) {
      void store.loadForEdit(editModelName).catch(() => {});
      return;
    }

    store.resetDraft();
  }, [editModelName, isEditMode, store]);

  const existingModelNames = existingModels.map((item) => item.name);

  const stepItems = [
    { title: '模型信息', description: '配置模型基础信息与打开方式' },
    { title: '模型字段', description: '配置字段、容器字段与 handlers' },
    { title: '预览保存', description: '预览 schema 效果并最终保存' },
  ];

  const pageTitle = isEditMode ? '编辑模型' : '新增模型';

  // Show loading state when in edit mode and schema is still loading
  if (isEditMode && loadingSchema) {
    return (
      <>
        <div className="model-breadcrumb-bar">
          <div className="model-breadcrumb-content">
            <Breadcrumb items={[{ title: '模型管理' }, { title: pageTitle }, { title: '加载中' }]} />
          </div>
        </div>
        <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
          <div className="model-page-loading">
            <Spin size="large" />
          </div>
        </Card>
      </>
    );
  }

  if (isEditMode && loadingError) {
    return (
      <>
        <div className="model-breadcrumb-bar">
          <div className="model-breadcrumb-content">
            <Breadcrumb items={[{ title: '模型管理' }, { title: pageTitle }, { title: '加载失败' }]} />
          </div>
        </div>
        <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
          <Alert type="error" showIcon message="模型加载失败" description={loadingError} />
        </Card>
      </>
    );
  }

  return (
    <>
      {contextHolder}
      <div className="model-breadcrumb-bar">
        <div className="model-breadcrumb-content">
          <Breadcrumb
            items={[{ title: '模型管理' }, { title: pageTitle }, { title: stepItems[currentStep]?.title ?? '设计器' }]}
          />
          {isEditMode ? (
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(buildModelPath(editModelName!))}>
              返回
            </Button>
          ) : null}
        </div>
      </div>
      <Card className="model-query-card" styles={{ body: { padding: 20 } }}>
        <Steps current={currentStep} items={stepItems} />
      </Card>

      <div className="builder-step-body">
        {currentStep === 0 ? (
          <ModelMetaForm
            draft={draft}
            onChange={(nextDraft) => store.updateDraft(() => nextDraft)}
            hideTitle
            modelNameDisabled={isEditMode}
          />
        ) : null}

        {currentStep === 1 ? (
          <Row gutter={[20, 20]}>
            <Col span={12}>
              <FieldListEditor
                fields={draft.fields}
                selectedFieldId={selectedFieldId}
                onSelect={(fieldId) => store.setSelectedField(fieldId)}
                onAddField={(preset, parentId) => store.addField(preset, parentId)}
                onRemove={(fieldId) => store.removeField(fieldId)}
                onMove={(fromIndex, toIndex) => store.moveField(fromIndex, toIndex)}
              />
            </Col>
            <Col span={12}>
              <FieldConfigPanel
                field={selectedField}
                onChange={(nextField) => store.updateField(nextField.id, () => nextField)}
              />
            </Col>
          </Row>
        ) : null}

        {currentStep === 2 ? <ModelPreviewPanel schema={previewSchema} error={previewError} hideTitle /> : null}
      </div>

      <div className="model-breadcrumb-bar builder-bottom-actions">
        <div className="model-breadcrumb-content">
          <Space>
          {currentStep > 0 ? (
            <Button onClick={() => setCurrentStep((step) => step - 1)}>
              上一步
            </Button>
          ) : null}
          {currentStep < 2 ? (
            <Button
              type="primary"
              onClick={() => {
                if (currentStep === 0) {
                  try {
                    validateModelMeta(draft, existingModelNames, isEditMode);
                  } catch (error) {
                    messageApi.error(error instanceof Error ? error.message : '请完善模型信息');
                    return;
                  }
                }
                setCurrentStep((step) => step + 1);
              }}
            >
              下一步
            </Button>
          ) : (
            <>
              <Button
                icon={<EyeOutlined />}
                onClick={() => setPreviewJsonVisible(true)}
              >
                预览提交
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={async () => {
                  try {
                    const errors = store.validate();
                    if (errors.length > 0) {
                      throw new Error(errors[0]);
                    }

                    const success = isEditMode ? await store.updateModel() : await store.createModel();
                    if (!success) {
                      throw new Error(isEditMode ? '模型保存失败' : '模型创建失败');
                    }

                    const nextModelName = store.draft().modelName.trim();
                    await Promise.all([
                      queryClient.invalidateQueries({ queryKey: ['model-summaries'] }),
                      queryClient.invalidateQueries({ queryKey: ['model-schema', nextModelName] }),
                      queryClient.invalidateQueries({ queryKey: ['model-list', nextModelName] }),
                    ]);
                    messageApi.success(isEditMode ? '模型保存成功' : '模型创建成功');
                    navigate(buildModelPath(nextModelName));
                  } catch (error) {
                    messageApi.error(error instanceof Error ? error.message : (isEditMode ? '模型保存失败' : '模型创建失败'));
                  }
                }}
              >
                {isEditMode ? '保存模型' : '创建模型'}
              </Button>
            </>
          )}
          </Space>
        </div>
      </div>

      <Modal
        title="Schema JSON 预览"
        open={previewJsonVisible}
        footer={null}
        width={720}
        onCancel={() => setPreviewJsonVisible(false)}
      >
        <pre className="builder-json-preview">
          {previewSchema ? JSON.stringify(previewSchema, null, 2) : previewError ?? '无法生成'}
        </pre>
      </Modal>
    </>
  );
}

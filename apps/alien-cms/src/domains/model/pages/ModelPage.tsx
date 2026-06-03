import { ArrowLeftOutlined, EyeOutlined, SaveOutlined } from '@ant-design/icons';
import { Alert, Breadcrumb, Button, Card, Col, Modal, Row, Space, Spin, Steps, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buildModelSchema, schemaToBuilderDraft } from '@alien-form/cms';
import type {
  BuilderComponentName,
  BuilderFieldType,
  ModelBuilderDraft,
  ModelBuilderFieldDraft,
} from '@alien-form/cms';
import { buildModelListPath } from '../../../app/router/paths';
import { useModelSummaries, useSchemaDetail, useSchemaMutations } from '../../../hooks/use-schema-store';
import { FieldConfigPanel } from '../components/FieldConfigPanel';
import { FieldListEditor } from '../components/FieldListEditor';
import { ModelMetaForm } from '../components/ModelMetaForm';
import { ModelPreviewPanel } from '../components/ModelPreviewPanel';
import type { FieldPreset } from '../components/FieldPalette';

let fieldCounter = 0;

function createFieldDraft(type: BuilderFieldType, component: BuilderComponentName): ModelBuilderFieldDraft {
  const timestamp = Date.now();
  const suffix = `${(++fieldCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const defaultTitle: Record<BuilderFieldType, string> = {
    string: 'Text Field',
    number: 'Number Field',
    boolean: 'Boolean Field',
    object: 'Object Group',
    void: 'Layout Group',
    array: 'Array Field',
  };
  const isContainer = type === 'object' || type === 'void';
  const isObjectArray = type === 'array' && component === 'ArrayCards';

  return {
    id: `field-${timestamp}-${suffix}`,
    key: `field_${timestamp}_${suffix}`,
    title: defaultTitle[type],
    type,
    component,
    decorator: isContainer ? undefined : 'FormItem',
    required: false,
    defaultValueText: '',
    propsText: '{}',
    dataSourceText: '',
    tableWidthText: '',
    tableEllipsis: true,
    tableInlineFields: [],
    reactions: [],
    children: isContainer || isObjectArray ? [] : undefined,
    arrayMode: type === 'array' ? (component === 'ArrayCards' ? 'object' : 'tags') : undefined,
    itemTitle: isObjectArray ? 'Item' : undefined,
  };
}

function createInitialDraft(): ModelBuilderDraft {
  return {
    modelName: '',
    title: '新模型',
    subtitle: '',
    description: '',
    singularLabel: '记录',
    pluralLabel: '记录',
    defaultPageSize: 10,
    filterCount: 3,
    tableDefaultWidth: undefined,
    tableVisibleFields: [],
    openMode: { add: 'drawer', edit: 'drawer', detail: 'drawer' },
    fields: [createFieldDraft('string', 'Input')],
  };
}

function findFieldById(fields: ModelBuilderFieldDraft[], id?: string): ModelBuilderFieldDraft | undefined {
  for (const field of fields) {
    if (field.id === id) return field;
    if (field.children?.length) {
      const child = findFieldById(field.children, id);
      if (child) return child;
    }
  }
  return undefined;
}

function removeFieldById(fields: ModelBuilderFieldDraft[], id: string): ModelBuilderFieldDraft[] {
  return fields
    .filter((field) => field.id !== id)
    .map((field) => ({
      ...field,
      children: field.children ? removeFieldById(field.children, id) : field.children,
    }));
}

function updateFieldInTree(
  fields: ModelBuilderFieldDraft[],
  id: string,
  updater: (field: ModelBuilderFieldDraft) => ModelBuilderFieldDraft,
): ModelBuilderFieldDraft[] {
  return fields.map((field) => {
    if (field.id === id) {
      return updater(field);
    }
    if (field.children?.length) {
      return { ...field, children: updateFieldInTree(field.children, id, updater) };
    }
    return field;
  });
}

function collectFieldIds(fields: ModelBuilderFieldDraft[]): string[] {
  return fields.flatMap((field) => [field.id, ...(field.children ? collectFieldIds(field.children) : [])]);
}

function validateDraft(draft: ModelBuilderDraft, existingModelNames: string[], editingModelName?: string) {
  const errors: string[] = [];

  if (!draft.modelName.trim()) {
    errors.push('请先填写模型名');
  } else if (!/^[a-z][a-z0-9-]*$/.test(draft.modelName.trim())) {
    errors.push('模型名仅支持小写字母、数字和中划线，且必须以字母开头');
  } else if (existingModelNames.includes(draft.modelName.trim()) && editingModelName !== draft.modelName.trim()) {
    errors.push(`模型名 ${draft.modelName.trim()} 已存在`);
  }

  if (!draft.title.trim()) {
    errors.push('请先填写模型标题');
  }

  if (draft.fields.length === 0) {
    errors.push('请至少添加一个字段');
  }

  const validateFields = (fields: ModelBuilderFieldDraft[], path: string) => {
    const keys = new Set<string>();
    for (const field of fields) {
      const label = `${path} / ${field.title || '未命名字段'}`;
      if (!field.key.trim()) {
        errors.push(`${label} 缺少 key`);
      }
      if (keys.has(field.key.trim())) {
        errors.push(`${label} 的 key 重复：${field.key.trim()}`);
      }
      keys.add(field.key.trim());

      const needsChildren =
        field.type === 'object' ||
        field.type === 'void' ||
        (field.type === 'array' && field.arrayMode === 'object');
      if (needsChildren && (!field.children || field.children.length === 0)) {
        errors.push(`${label} 需要至少一个子字段`);
      }

      if (field.children?.length) {
        validateFields(field.children, label);
      }
    }
  };

  validateFields(draft.fields, draft.title.trim() || '模型');
  return errors;
}

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

export default function ModelPage() {
  const navigate = useNavigate();
  const params = useParams();
  const editModelName = params.modelName;
  const isEditMode = Boolean(editModelName);
  const existingModelsQuery = useModelSummaries();
  const editingSchemaQuery = useSchemaDetail(editModelName);
  const schemaMutations = useSchemaMutations();
  const [draft, setDraft] = useState<ModelBuilderDraft>(createInitialDraft);
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>(draft.fields[0]?.id);
  const [currentStep, setCurrentStep] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [previewJsonVisible, setPreviewJsonVisible] = useState(false);

  const selectedField = useMemo(() => findFieldById(draft.fields, selectedFieldId), [draft.fields, selectedFieldId]);
  const previewSchema = useMemo(() => {
    try {
      return buildModelSchema(draft);
    } catch {
      return undefined;
    }
  }, [draft]);
  const previewError = useMemo(() => {
    try {
      buildModelSchema(draft);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : 'Preview generation failed';
    }
  }, [draft]);
  const existingModels = existingModelsQuery.data ?? [];
  const saving = schemaMutations.creating || schemaMutations.updating;
  const loadingSchema = isEditMode && (editingSchemaQuery.isLoading || editingSchemaQuery.isFetching);
  const loadingError = editingSchemaQuery.error instanceof Error ? editingSchemaQuery.error.message : undefined;

  useEffect(() => {
    if (isEditMode && editingSchemaQuery.data) {
      const nextDraft = schemaToBuilderDraft(editingSchemaQuery.data);
      setDraft(nextDraft);
      setSelectedFieldId(nextDraft.fields[0]?.id);
      return;
    }

    if (!isEditMode) {
      const nextDraft = createInitialDraft();
      setDraft(nextDraft);
      setSelectedFieldId(nextDraft.fields[0]?.id);
    }
  }, [editingSchemaQuery.data, isEditMode]);

  useEffect(() => {
    const validFieldKeys = new Set(draft.fields.map((field) => field.key).filter(Boolean));
    const nextVisibleFields = draft.tableVisibleFields.filter((key) => validFieldKeys.has(key));
    if (nextVisibleFields.length !== draft.tableVisibleFields.length) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        tableVisibleFields: currentDraft.tableVisibleFields.filter((key) => validFieldKeys.has(key)),
      }));
    }
  }, [draft.fields, draft.tableVisibleFields]);

  const existingModelNames = existingModels.map((item) => item.name);
  const tableFieldOptions = draft.fields.map((field) => ({
    label: `${field.title || field.key} (${field.key})`,
    value: field.key,
  }));

  const stepItems = [
    { title: '模型字段', description: '配置字段、容器字段与 handlers' },
    { title: 'x-model 配置', description: '配置模型信息、列表白名单与打开方式' },
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
            <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(buildModelListPath())}>
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
          <Row gutter={[20, 20]}>
            <Col span={12}>
              <FieldListEditor
                fields={draft.fields}
                selectedFieldId={selectedFieldId}
                onSelect={(fieldId) => setSelectedFieldId(fieldId)}
                onAddField={(preset: FieldPreset, parentId?: string) => {
                  const nextField = createFieldDraft(preset.type, preset.component);
                  setDraft((currentDraft) => {
                    if (parentId) {
                      return {
                        ...currentDraft,
                        fields: updateFieldInTree(currentDraft.fields, parentId, (field) => ({
                          ...field,
                          children: [...(field.children ?? []), nextField],
                        })),
                      };
                    }
                    return {
                      ...currentDraft,
                      fields: [...currentDraft.fields, nextField],
                    };
                  });
                  setSelectedFieldId(nextField.id);
                }}
                onRemove={(fieldId) => {
                  const nextFields = removeFieldById(draft.fields, fieldId);
                  setDraft((currentDraft) => ({ ...currentDraft, fields: nextFields }));
                  const remainingIds = collectFieldIds(nextFields);
                  if (selectedFieldId && !remainingIds.includes(selectedFieldId)) {
                    setSelectedFieldId(remainingIds[0]);
                  }
                }}
                onMove={(fromIndex, toIndex) => {
                  const fields = [...draft.fields];
                  const [moved] = fields.splice(fromIndex, 1);
                  fields.splice(toIndex, 0, moved);
                  setDraft((currentDraft) => ({ ...currentDraft, fields }));
                }}
              />
            </Col>
            <Col span={12}>
              <FieldConfigPanel
                field={selectedField}
                onChange={(nextField) => {
                  setDraft((currentDraft) => ({
                    ...currentDraft,
                    fields: updateFieldInTree(currentDraft.fields, nextField.id, () => nextField),
                  }));
                }}
              />
            </Col>
          </Row>
        ) : null}

        {currentStep === 1 ? (
          <ModelMetaForm
            draft={draft}
            onChange={setDraft}
            hideTitle
            modelNameDisabled={isEditMode}
            tableFieldOptions={tableFieldOptions}
          />
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
                if (currentStep === 1) {
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
                    const errors = validateDraft(draft, existingModelNames, editModelName);
                    if (errors.length > 0) {
                      throw new Error(errors[0]);
                    }

                    const nextSchema = buildModelSchema(draft);
                    if (isEditMode && editModelName) {
                      await schemaMutations.updateModel(editModelName, nextSchema);
                    } else {
                      await schemaMutations.createModel(nextSchema);
                    }
                    messageApi.success(isEditMode ? '模型保存成功' : '模型创建成功');
                    navigate(buildModelListPath());
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

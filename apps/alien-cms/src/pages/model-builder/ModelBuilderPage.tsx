import { EyeOutlined, SaveOutlined } from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Breadcrumb, Button, Card, Col, Modal, Row, Space, Spin, Steps, message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { buildModelPath } from '../../app/model-path';
import { buildModelSchema } from '../../core/schema/build-model-schema';
import { loadSchema } from '../../core/schema/load-schema';
import { schemaToBuilderDraft } from '../../core/schema/schema-to-draft';
import { modelSchemaRepository } from '../../data/repository/model-schema-repository';
import { useModelSummaries } from '../../hooks/use-model-summaries';
import type { BuilderComponentName, BuilderFieldType, ModelBuilderDraft, ModelBuilderFieldDraft } from '../../types/model-builder';
import { FieldConfigPanel } from './FieldConfigPanel';
import { FieldListEditor } from './FieldListEditor';
import type { FieldPreset } from './FieldPalette';
import { ModelMetaForm } from './ModelMetaForm';
import { ModelPreviewPanel } from './ModelPreviewPanel';

let fieldCounter = 0;

function createFieldDraft(type: BuilderFieldType, component: BuilderComponentName): ModelBuilderFieldDraft {
  const timestamp = Date.now();
  const suffix = `${(++fieldCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const defaultTitle = {
    string: '文本字段',
    number: '数字字段',
    boolean: '布尔字段',
    object: '对象分组',
    void: '布局分组',
    array: '数组字段',
  }[type];
  const isContainer = type === 'object' || type === 'void';
  const isObjectArray = type === 'array' && component === 'ArrayCards';

  return {
    id: `field-${timestamp}-${suffix}`,
    key: `field_${timestamp}_${suffix}`,
    title: defaultTitle,
    type,
    component,
    decorator: isContainer ? undefined : 'FormItem',
    required: false,
    defaultValueText: '',
    propsText: '{}',
    dataSourceText: '',
    filterVisible: !isContainer && type !== 'array',
    filterDefaultVisible: false,
    tableVisible: !isContainer,
    tableWidthText: '',
    tableEllipsis: true,
    detailVisible: true,
    reactions: [],
    children: isContainer || isObjectArray ? [] : undefined,
    arrayMode: type === 'array' ? (component === 'ArrayCards' ? 'object' : 'tags') : undefined,
    itemTitle: isObjectArray ? '数组项' : undefined,
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
    defaultFilterCount: 3,
    openMode: {
      add: 'drawer',
      edit: 'drawer',
      detail: 'drawer',
    },
    fields: [createFieldDraft('string', 'Input')],
  };
}

function reorder<T>(items: T[], fromIndex: number, toIndex: number) {
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function findFieldById(fields: ModelBuilderFieldDraft[], fieldId?: string): ModelBuilderFieldDraft | undefined {
  for (const field of fields) {
    if (field.id === fieldId) {
      return field;
    }
    if (field.children?.length) {
      const child = findFieldById(field.children, fieldId);
      if (child) {
        return child;
      }
    }
  }
  return undefined;
}

function collectRemainingFieldIds(fields: ModelBuilderFieldDraft[]): string[] {
  return fields.flatMap((field) => [field.id, ...(field.children ? collectRemainingFieldIds(field.children) : [])]);
}

function validateDraft(draft: ModelBuilderDraft, existingModelNames: string[], isEditMode: boolean) {
  validateModelMeta(draft, existingModelNames, isEditMode);

  if (draft.fields.length === 0) {
    throw new Error('请至少添加一个字段');
  }

  const validateFields = (fields: ModelBuilderFieldDraft[], path: string) => {
    const fieldKeys = new Set<string>();
    for (const field of fields) {
      const fieldLabel = `${path} / ${field.title || '未命名字段'}`;
      if (!field.key.trim()) {
        throw new Error(`${fieldLabel} 缺少 key`);
      }
      if (fieldKeys.has(field.key.trim())) {
        throw new Error(`${fieldLabel} 的 key 重复：${field.key.trim()}`);
      }
      fieldKeys.add(field.key.trim());

      if ((field.type === 'object' || field.type === 'void' || (field.type === 'array' && field.arrayMode === 'object')) && (!field.children || field.children.length === 0)) {
        throw new Error(`${fieldLabel} 需要至少一个子字段`);
      }

      if (field.children?.length) {
        validateFields(field.children, fieldLabel);
      }
    }
  };

  validateFields(draft.fields, draft.title.trim() || '模型');
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

export default function ModelBuilderPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams();
  const editModelName = params.modelName;
  const isEditMode = Boolean(editModelName);

  const summariesQuery = useModelSummaries();
  const [draft, setDraft] = useState<ModelBuilderDraft>(() => createInitialDraft());
  const [draftInitialized, setDraftInitialized] = useState(!isEditMode);
  const [selectedFieldId, setSelectedFieldId] = useState<string | undefined>(draft.fields[0]?.id);
  const [currentStep, setCurrentStep] = useState(0);
  const [messageApi, contextHolder] = message.useMessage();
  const [previewJsonVisible, setPreviewJsonVisible] = useState(false);

  // Load existing schema when in edit mode
  const existingSchemaQuery = useQuery({
    queryKey: ['model-schema', editModelName],
    queryFn: () => loadSchema(editModelName!),
    enabled: isEditMode,
  });

  // Initialize draft from loaded schema
  useEffect(() => {
    if (isEditMode && existingSchemaQuery.data && !draftInitialized) {
      const loadedDraft = schemaToBuilderDraft(existingSchemaQuery.data);
      setDraft(loadedDraft);
      setSelectedFieldId(loadedDraft.fields[0]?.id);
      setDraftInitialized(true);
    }
  }, [isEditMode, existingSchemaQuery.data, draftInitialized]);

  const previewState = useMemo(() => {
    try {
      return {
        schema: buildModelSchema(draft),
        error: undefined,
      };
    } catch (error) {
      return {
        schema: undefined,
        error: error instanceof Error ? error.message : '预览生成失败',
      };
    }
  }, [draft]);

  const selectedField = findFieldById(draft.fields, selectedFieldId);
  const existingModelNames = (summariesQuery.data ?? []).map((item) => item.name);

  const saveMutation = useMutation({
    mutationFn: async () => {
      validateDraft(draft, existingModelNames, isEditMode);
      return modelSchemaRepository.save(buildModelSchema(draft));
    },
    onSuccess: async (record) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['model-summaries'] }),
        queryClient.invalidateQueries({ queryKey: ['model-schema', record.modelName] }),
        queryClient.invalidateQueries({ queryKey: ['model-list', record.modelName] }),
      ]);
      messageApi.success(isEditMode ? '模型保存成功' : '模型创建成功');
      navigate(buildModelPath(record.modelName));
    },
    onError: (error) => {
      messageApi.error(error instanceof Error ? error.message : (isEditMode ? '模型保存失败' : '模型创建失败'));
    },
  });

  const updateField = (fieldId: string, updater: (field: ModelBuilderFieldDraft) => ModelBuilderFieldDraft) => {
    const updateTree = (fields: ModelBuilderFieldDraft[]): ModelBuilderFieldDraft[] =>
      fields.map((field) => {
        if (field.id === fieldId) {
          return updater(field);
        }
        if (field.children?.length) {
          return {
            ...field,
            children: updateTree(field.children),
          };
        }
        return field;
      });

    setDraft((current) => ({
      ...current,
      fields: updateTree(current.fields),
    }));
  };

  const handleAddField = (preset: FieldPreset, parentId?: string) => {
    const nextField = createFieldDraft(preset.type, preset.component);
    if (parentId) {
      updateField(parentId, (field) => ({
        ...field,
        children: [...(field.children ?? []), nextField],
      }));
    } else {
      setDraft((current) => ({
        ...current,
        fields: [...current.fields, nextField],
      }));
    }
    setSelectedFieldId(nextField.id);
  };

  const removeFieldById = (fields: ModelBuilderFieldDraft[], fieldId: string): ModelBuilderFieldDraft[] =>
    fields
      .filter((field) => field.id !== fieldId)
      .map((field) => ({
        ...field,
        children: field.children ? removeFieldById(field.children, fieldId) : field.children,
      }));

  const stepItems = [
    { title: '模型信息', description: '配置模型基础信息与打开方式' },
    { title: '模型字段', description: '配置字段、容器字段与 handlers' },
    { title: '预览保存', description: '预览 schema 效果并最终保存' },
  ];

  const pageTitle = isEditMode ? '编辑模型' : '新增模型';

  // Show loading state when in edit mode and schema is still loading
  if (isEditMode && (existingSchemaQuery.isLoading || !draftInitialized)) {
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

  if (isEditMode && existingSchemaQuery.isError) {
    return (
      <>
        <div className="model-breadcrumb-bar">
          <div className="model-breadcrumb-content">
            <Breadcrumb items={[{ title: '模型管理' }, { title: pageTitle }, { title: '加载失败' }]} />
          </div>
        </div>
        <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
          <Alert type="error" showIcon message="模型加载失败" description={existingSchemaQuery.error?.message} />
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
        </div>
      </div>

      {summariesQuery.isError ? (
        <Alert
          type="error"
          showIcon
          className="model-query-card"
          message="模型列表加载失败"
          description={summariesQuery.error.message}
        />
      ) : null}

      <Card className="model-query-card" styles={{ body: { padding: 20 } }}>
        <Steps current={currentStep} items={stepItems} />
      </Card>

      <div className="builder-step-body">
        {currentStep === 0 ? (
          <ModelMetaForm draft={draft} onChange={setDraft} hideTitle modelNameDisabled={isEditMode} />
        ) : null}

        {currentStep === 1 ? (
          <Row gutter={[20, 20]}>
            <Col span={12}>
              <FieldListEditor
                fields={draft.fields}
                selectedFieldId={selectedFieldId}
                onSelect={setSelectedFieldId}
                onAddField={handleAddField}
                onRemove={(fieldId) => {
                  const nextFields = removeFieldById(draft.fields, fieldId);
                  setDraft((current) => ({
                    ...current,
                    fields: removeFieldById(current.fields, fieldId),
                  }));
                  if (selectedFieldId && !collectRemainingFieldIds(nextFields).includes(selectedFieldId)) {
                    setSelectedFieldId(collectRemainingFieldIds(nextFields)[0]);
                  }
                }}
                onMove={(fromIndex, toIndex) =>
                  setDraft((current) => ({
                    ...current,
                    fields: reorder(current.fields, fromIndex, toIndex),
                  }))
                }
              />
            </Col>
            <Col span={12}>
              <FieldConfigPanel
                field={selectedField}
                onChange={(nextField) => updateField(nextField.id, () => nextField)}
              />
            </Col>
          </Row>
        ) : null}

        {currentStep === 2 ? <ModelPreviewPanel schema={previewState.schema} error={previewState.error} hideTitle /> : null}
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
                loading={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
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
          {previewState.schema ? JSON.stringify(previewState.schema, null, 2) : previewState.error ?? '无法生成'}
        </pre>
      </Modal>
    </>
  );
}

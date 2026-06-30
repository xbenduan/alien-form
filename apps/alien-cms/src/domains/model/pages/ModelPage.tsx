import { EyeOutlined, SaveOutlined } from "../../../shared/ui";
import {
  Alert,
  Button,
  Card,
  Drawer,
  Flex,
  Modal,
  Space,
  Spin,
  Steps,
  message,
} from "../../../shared/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { buildModelSchema, schemaToBuilderDraft } from "@alien-form/cms";
import type {
  BuilderComponentName,
  BuilderFieldType,
  CmsModelSchema,
  ModelBuilderDraft,
  ModelBuilderFieldDraft,
} from "@alien-form/cms";
import { buildModelListPath } from "../../../app/router/paths";
import {
  useModelSummaries,
  useSchemaDetail,
  useSchemaMutations,
} from "../../../hooks/use-schema-store";
import { FieldConfigPanel } from "../components/FieldConfigPanel";
import { FieldListEditor } from "../components/FieldListEditor";
import { FieldPalette, type FieldPreset } from "../components/FieldPalette";
import { ModelMetaForm } from "../components/ModelMetaForm";
import { ModelSchemaImportModal } from "../components/ModelSchemaImportModal";
import { ModelPreviewPanel } from "../components/ModelPreviewPanel";
import "../model-builder.css";

let fieldCounter = 0;
const SYSTEM_FIELD_KEYS = ["id", "createdAt", "updatedAt"] as const;
type SystemFieldKey = (typeof SYSTEM_FIELD_KEYS)[number];

function isSystemFieldKey(key: string): key is SystemFieldKey {
  return SYSTEM_FIELD_KEYS.includes(key as SystemFieldKey);
}

function createDraftFieldId(prefix = "field") {
  const timestamp = Date.now();
  const suffix = `${(++fieldCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return `${prefix}-${timestamp}-${suffix}`;
}

function createFieldDraft(
  type: BuilderFieldType,
  component: BuilderComponentName,
): ModelBuilderFieldDraft {
  const timestamp = Date.now();
  const suffix = `${(++fieldCounter).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const defaultTitle: Record<BuilderFieldType, string> = {
    string: "Text Field",
    number: "Number Field",
    boolean: "Boolean Field",
    object: "Object Group",
    void: "Layout Group",
    array: "Array Field",
    tags: "Tags Field",
  };
  const isContainer = type === "object" || type === "void";
  const isObjectArray = type === "array";

  return {
    id: `field-${timestamp}-${suffix}`,
    key: `field_${timestamp}_${suffix}`,
    title: defaultTitle[type],
    type,
    component,
    decorator: isContainer ? undefined : "FormItem",
    required: false,
    defaultValueText: "",
    propsText: "{}",
    dataSourceText: "",
    tableWidthText: "",
    tableEllipsis: true,
    tableInlineFields: [],
    reactions: [],
    children: isContainer || isObjectArray ? [] : undefined,
    arrayMode: type === "array" ? "object" : undefined,
    itemTitle: isObjectArray ? "Item" : undefined,
  };
}

function createSystemFieldDraft(key: SystemFieldKey): ModelBuilderFieldDraft {
  if (key === "id") {
    return {
      id: createDraftFieldId("system-field"),
      key: "id",
      title: "ID",
      type: "string",
      component: "Input",
      decorator: "FormItem",
      required: false,
      defaultValueText: "",
      propsText: "{}",
      dataSourceText: "",
      tableWidthText: "",
      tableEllipsis: true,
      tableInlineFields: [],
      reactions: [],
    };
  }

  return {
    id: createDraftFieldId("system-field"),
    key,
    title: key === "createdAt" ? "创建时间" : "更新时间",
    type: "number",
    component: "NumberInput",
    decorator: "FormItem",
    required: false,
    defaultValueText: "",
    propsText: "{}",
    dataSourceText: "",
    tableWidthText: "",
    tableEllipsis: true,
    tableInlineFields: [],
    reactions: [],
  };
}

function normalizeSystemField(
  field: ModelBuilderFieldDraft,
  key: SystemFieldKey,
): ModelBuilderFieldDraft {
  const systemField = createSystemFieldDraft(key);
  return {
    ...field,
    key: systemField.key,
    title: field.title || systemField.title,
    type: systemField.type,
    component: systemField.component,
    decorator: systemField.decorator,
    required: false,
    defaultValueText: "",
    propsText: "{}",
    dataSourceText: "",
    tableInlineFields: [],
    reactions: [],
    children: undefined,
    arrayMode: undefined,
    itemTitle: undefined,
  };
}

function ensureSystemFields(fields: ModelBuilderFieldDraft[]): ModelBuilderFieldDraft[] {
  const nextFields = [...fields];

  for (const key of SYSTEM_FIELD_KEYS) {
    const index = nextFields.findIndex((field) => field.key === key);
    if (index >= 0) {
      nextFields[index] = normalizeSystemField(nextFields[index], key);
      continue;
    }
    nextFields.push(createSystemFieldDraft(key));
  }

  return nextFields;
}

function orderFieldsWithSystemFieldsFirst(
  fields: ModelBuilderFieldDraft[],
): ModelBuilderFieldDraft[] {
  const systemFieldMap = new Map<SystemFieldKey, ModelBuilderFieldDraft>();
  const normalFields: ModelBuilderFieldDraft[] = [];

  for (const field of fields) {
    if (isSystemFieldKey(field.key)) {
      systemFieldMap.set(field.key, field);
      continue;
    }
    normalFields.push(field);
  }

  return [
    ...SYSTEM_FIELD_KEYS.map((key) => systemFieldMap.get(key)).filter(
      (field): field is ModelBuilderFieldDraft => Boolean(field),
    ),
    ...normalFields,
  ];
}

function normalizeDraft(nextDraft: ModelBuilderDraft): ModelBuilderDraft {
  return {
    ...nextDraft,
    fields: orderFieldsWithSystemFieldsFirst(ensureSystemFields(nextDraft.fields)),
  };
}

function createInitialDraft(): ModelBuilderDraft {
  return normalizeDraft({
    modelName: "",
    title: "新模型",
    subtitle: "",
    description: "",
    singularLabel: "记录",
    pluralLabel: "记录",
    defaultPageSize: 10,
    filterCount: 3,
    tableDefaultWidth: undefined,
    tableVisibleFields: [],
    openMode: { add: "drawer", edit: "drawer", detail: "drawer" },
    fields: [createFieldDraft("string", "Input")],
  });
}

function findFieldById(
  fields: ModelBuilderFieldDraft[],
  id?: string,
): ModelBuilderFieldDraft | undefined {
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
  const targetField = findFieldById(fields, id);
  if (targetField && isSystemFieldKey(targetField.key)) {
    return fields;
  }
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
  return fields.flatMap((field) => [
    field.id,
    ...(field.children ? collectFieldIds(field.children) : []),
  ]);
}

function getPreferredSelectedFieldId(fields: ModelBuilderFieldDraft[]): string | undefined {
  return fields.find((field) => !isSystemFieldKey(field.key))?.id ?? fields[0]?.id;
}

function validateDraft(
  draft: ModelBuilderDraft,
  existingModelNames: string[],
  editingModelName?: string,
) {
  const errors: string[] = [];

  if (!draft.modelName.trim()) {
    errors.push("请先填写模型名");
  } else if (!/^[a-z][a-z0-9-]*$/.test(draft.modelName.trim())) {
    errors.push("模型名仅支持小写字母、数字和中划线，且必须以字母开头");
  } else if (
    existingModelNames.includes(draft.modelName.trim()) &&
    editingModelName !== draft.modelName.trim()
  ) {
    errors.push(`模型名 ${draft.modelName.trim()} 已存在`);
  }

  if (!draft.title.trim()) {
    errors.push("请先填写模型标题");
  }

  if (draft.fields.length === 0) {
    errors.push("请至少添加一个字段");
  }

  const validateFields = (fields: ModelBuilderFieldDraft[], path: string) => {
    const keys = new Set<string>();
    for (const field of fields) {
      const label = `${path} / ${field.title || "未命名字段"}`;
      if (!field.key.trim()) {
        errors.push(`${label} 缺少 key`);
      }
      if (keys.has(field.key.trim())) {
        errors.push(`${label} 的 key 重复：${field.key.trim()}`);
      }
      keys.add(field.key.trim());

      const needsChildren =
        field.type === "object" || field.type === "void" || field.type === "array";
      if (needsChildren && (!field.children || field.children.length === 0)) {
        errors.push(`${label} 需要至少一个子字段`);
      }

      if (field.children?.length) {
        validateFields(field.children, label);
      }
    }
  };

  validateFields(draft.fields, draft.title.trim() || "模型");
  return errors;
}

function validateModelMeta(
  draft: ModelBuilderDraft,
  existingModelNames: string[],
  isEditMode: boolean,
) {
  if (!draft.modelName.trim()) {
    throw new Error("请先填写模型名");
  }
  if (!/^[a-z][a-z0-9-]*$/.test(draft.modelName.trim())) {
    throw new Error("模型名仅支持小写字母、数字和中划线，且必须以字母开头");
  }
  if (!isEditMode && existingModelNames.includes(draft.modelName.trim())) {
    throw new Error(`模型名 ${draft.modelName.trim()} 已存在`);
  }
  if (!draft.title.trim()) {
    throw new Error("请先填写模型标题");
  }
}

const STEP_ITEMS = [
  { title: "模型字段", description: "配置字段、容器字段与 handlers" },
  { title: "x-model 配置", description: "配置模型信息、列表白名单与打开方式" },
  { title: "预览保存", description: "预览 schema 效果并最终保存" },
];

export default function ModelPage() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
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
  const [schemaImportVisible, setSchemaImportVisible] = useState(false);
  const [fieldConfigDraft, setFieldConfigDraft] = useState<ModelBuilderFieldDraft | undefined>();
  const editingFieldId = searchParams.get("field") ?? undefined;
  const editingField = useMemo(
    () => findFieldById(draft.fields, editingFieldId),
    [draft.fields, editingFieldId],
  );
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
      return error instanceof Error ? error.message : "Preview generation failed";
    }
  }, [draft]);
  const existingModels = existingModelsQuery.data ?? [];
  const saving = schemaMutations.creating || schemaMutations.updating;
  const loadingSchema =
    isEditMode && (editingSchemaQuery.isLoading || editingSchemaQuery.isFetching);
  const loadingError =
    editingSchemaQuery.error instanceof Error ? editingSchemaQuery.error.message : undefined;
  const existingModelNames = existingModels.map((item) => item.name);
  const tableFieldOptions = draft.fields.map((field) => ({
    label: `${field.title || field.key} (${field.key})`,
    value: field.key,
  }));

  const setFieldConfigSearchParamRef = useRef(setSearchParams);
  useEffect(() => {
    setFieldConfigSearchParamRef.current = setSearchParams;
  }, [setSearchParams]);

  const setFieldConfigSearchParam = useCallback((fieldId?: string) => {
    setFieldConfigSearchParamRef.current(
      (currentSearchParams) => {
        if ((currentSearchParams.get("field") ?? undefined) === fieldId) {
          return currentSearchParams;
        }

        const nextSearchParams = new URLSearchParams(currentSearchParams);
        if (fieldId) {
          nextSearchParams.set("field", fieldId);
        } else {
          nextSearchParams.delete("field");
        }
        return nextSearchParams;
      },
      { replace: true },
    );
  }, []);

  const closeFieldConfigDrawer = useCallback(() => {
    setFieldConfigSearchParam(undefined);
    setFieldConfigDraft(undefined);
  }, [setFieldConfigSearchParam]);

  const openFieldConfigDrawer = useCallback(
    (fieldId: string, fieldOverride?: ModelBuilderFieldDraft) => {
      const nextField = fieldOverride ?? findFieldById(draft.fields, fieldId);
      setSelectedFieldId(fieldId);
      if (!nextField) {
        return;
      }
      setFieldConfigDraft(nextField);
      setFieldConfigSearchParam(fieldId);
    },
    [draft.fields, setFieldConfigSearchParam],
  );

  const saveFieldConfig = useCallback(() => {
    if (!fieldConfigDraft) {
      return;
    }

    const nextField = fieldConfigDraft;
    setDraft((currentDraft) =>
      normalizeDraft({
        ...currentDraft,
        fields: updateFieldInTree(currentDraft.fields, nextField.id, () => nextField),
      }),
    );
    setSelectedFieldId(nextField.id);
    closeFieldConfigDrawer();
  }, [closeFieldConfigDrawer, fieldConfigDraft]);

  useEffect(() => {
    if (!isEditMode) {
      return;
    }
    if (!editingSchemaQuery.data) {
      return;
    }
    const nextDraft = normalizeDraft(schemaToBuilderDraft(editingSchemaQuery.data));
    setDraft(nextDraft);
    setSelectedFieldId(getPreferredSelectedFieldId(nextDraft.fields));
    closeFieldConfigDrawer();
  }, [closeFieldConfigDrawer, editingSchemaQuery.data, isEditMode]);

  useEffect(() => {
    if (!editingFieldId) {
      setFieldConfigDraft(undefined);
      return;
    }

    if (editingField) {
      setSelectedFieldId(editingField.id);
      setFieldConfigDraft((currentDraft) =>
        currentDraft?.id === editingField.id ? currentDraft : editingField,
      );
      return;
    }

    if (fieldConfigDraft?.id === editingFieldId) {
      setSelectedFieldId(editingFieldId);
      return;
    }

    setFieldConfigSearchParam(undefined);
  }, [editingField, editingFieldId, fieldConfigDraft?.id, setFieldConfigSearchParam]);

  useEffect(() => {
    const validFieldKeys = new Set(draft.fields.map((field) => field.key).filter(Boolean));
    const nextVisibleFields = draft.tableVisibleFields.filter((key) => validFieldKeys.has(key));
    if (nextVisibleFields.length !== draft.tableVisibleFields.length) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        tableVisibleFields: currentDraft.tableVisibleFields.filter((key) =>
          validFieldKeys.has(key),
        ),
      }));
    }
  }, [draft.fields, draft.tableVisibleFields]);

  const applyImportedSchema = (schemaText: string) => {
    let parsedSchema: CmsModelSchema;

    try {
      parsedSchema = JSON.parse(schemaText) as CmsModelSchema;
    } catch {
      messageApi.error("Schema JSON 解析失败，请检查格式");
      return;
    }

    try {
      const nextDraft = normalizeDraft(schemaToBuilderDraft(parsedSchema));
      setDraft(nextDraft);
      setSelectedFieldId(getPreferredSelectedFieldId(nextDraft.fields));
      closeFieldConfigDrawer();
      setSchemaImportVisible(false);
      messageApi.success("Schema 解析成功");
    } catch (error) {
      messageApi.error(
        error instanceof Error ? `Schema 解析失败：${error.message}` : "Schema 解析失败",
      );
    }
  };

  // Show loading state when in edit mode and schema is still loading
  if (isEditMode && loadingSchema) {
    return (
      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        <div className="model-page-loading">
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (isEditMode && loadingError) {
    return (
      <Card className="model-query-card" styles={{ body: { padding: 24 } }}>
        <Alert type="error" showIcon message="模型加载失败" description={loadingError} />
      </Card>
    );
  }

  return (
    <Flex vertical gap={16}>
      {contextHolder}
      <Card className="model-query-card builder-steps-card" styles={{ body: { padding: '14px 20px' } }}>
        <Steps current={currentStep} items={STEP_ITEMS} />
      </Card>

      <div className="builder-step-body">
        {currentStep === 0 ? (
          <div className="builder-step-grid">
            <FieldPalette
              onAddField={(preset: FieldPreset) => {
                const nextField = createFieldDraft(preset.type, preset.component);
                setDraft((currentDraft) =>
                  normalizeDraft({
                    ...currentDraft,
                    fields: [...currentDraft.fields, nextField],
                  }),
                );
                openFieldConfigDrawer(nextField.id, nextField);
              }}
            />
            <FieldListEditor
              fields={draft.fields}
              selectedFieldId={selectedFieldId}
              extra={
                <Button type="link" size="small" onClick={() => setSchemaImportVisible(true)}>
                  解析 Schema
                </Button>
              }
              isRemovable={(field) => !isSystemFieldKey(field.key)}
              onSelect={(fieldId) => openFieldConfigDrawer(fieldId)}
              onRemove={(fieldId) => {
                const nextFields = removeFieldById(draft.fields, fieldId);
                setDraft((currentDraft) => normalizeDraft({ ...currentDraft, fields: nextFields }));
                const remainingIds = collectFieldIds(nextFields);
                if (selectedFieldId && !remainingIds.includes(selectedFieldId)) {
                  setSelectedFieldId(getPreferredSelectedFieldId(nextFields));
                }
                if (editingFieldId && !remainingIds.includes(editingFieldId)) {
                  closeFieldConfigDrawer();
                }
              }}
              onMove={(fromIndex, toIndex) => {
                const fields = [...draft.fields];
                const [moved] = fields.splice(fromIndex, 1);
                fields.splice(toIndex, 0, moved);
                setDraft((currentDraft) => normalizeDraft({ ...currentDraft, fields }));
              }}
            />
          </div>
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

        {currentStep === 2 ? (
          <ModelPreviewPanel schema={previewSchema} error={previewError} hideTitle />
        ) : null}
      </div>

      <div className="builder-bottom-actions">
        <div className="builder-bottom-actions-content">
          <Space>
            {currentStep > 0 ? (
              <Button onClick={() => setCurrentStep((step) => step - 1)}>上一步</Button>
            ) : null}
            {currentStep < 2 ? (
              <Button
                type="primary"
                onClick={() => {
                  if (currentStep === 1) {
                    try {
                      validateModelMeta(draft, existingModelNames, isEditMode);
                    } catch (error) {
                      messageApi.error(error instanceof Error ? error.message : "请完善模型信息");
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
                <Button icon={<EyeOutlined />} onClick={() => setPreviewJsonVisible(true)}>
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
                      messageApi.success(isEditMode ? "模型保存成功" : "模型创建成功");
                      navigate(buildModelListPath());
                    } catch (error) {
                      messageApi.error(
                        error instanceof Error
                          ? error.message
                          : isEditMode
                            ? "模型保存失败"
                            : "模型创建失败",
                      );
                    }
                  }}
                >
                  {isEditMode ? "保存模型" : "创建模型"}
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
          {previewSchema ? JSON.stringify(previewSchema, null, 2) : (previewError ?? "无法生成")}
        </pre>
      </Modal>
      <ModelSchemaImportModal
        open={schemaImportVisible}
        onClose={() => setSchemaImportVisible(false)}
        onSubmit={applyImportedSchema}
      />
      <Drawer
        destroyOnHidden
        title={
          fieldConfigDraft
            ? `字段配置 · ${fieldConfigDraft.title || fieldConfigDraft.key || "未命名字段"}`
            : "字段配置"
        }
        open={Boolean(editingFieldId)}
        width={560}
        footer={
          fieldConfigDraft ? (
            <Space size={8}>
              <Button onClick={closeFieldConfigDrawer}>取消</Button>
              <Button type="primary" onClick={saveFieldConfig}>
                保存配置
              </Button>
            </Space>
          ) : null
        }
        onClose={closeFieldConfigDrawer}
        maskClosable={false}
      >
        <FieldConfigPanel
          field={fieldConfigDraft}
          withCard={false}
          onChange={(nextField) => setFieldConfigDraft(nextField)}
        />
      </Drawer>
    </Flex>
  );
}

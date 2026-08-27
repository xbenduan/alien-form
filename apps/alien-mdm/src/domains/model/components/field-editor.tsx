import { forwardRef, useImperativeHandle, useMemo } from "react";
import {
  Button,
  Divider,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Tabs,
  Tooltip,
} from "antd";
import { DeleteOutlined, InfoCircleOutlined, PlusOutlined } from "@ant-design/icons";
import type { Registry } from "@alien-form/engine";
import { useBuilder } from "@alien-form/builder/react";
import { getDefaultFieldSchema, getFieldDefinition } from "@runtime";
import { COLUMN_TYPE_OPTIONS, columnTypeToFieldType, type ColumnType } from "@app-types/shared";
import type { ModelFieldSchema } from "../builder";
import type { FieldDraft } from "../types";
import { componentDescription, fieldComponentOptions } from "../utils";
import type { ModelDraft } from "../builder";
import styles from "./index.module.css";

interface FieldEditorProps {
  field: FieldDraft;
}

export interface FieldEditorRef {
  submit: () => Promise<FieldDraft>;
}

interface DataSourceRow {
  label?: string;
  value?: string;
  extraText?: string;
}

export interface FieldFormValues {
  component: string;
  key: string;
  title?: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  display?: string;
  defaultText?: string;
  ref?: string;
  layout?: string;
  decorator?: string;
  propsText?: string;
  decoratorPropsText?: string;
  dataSourceMode?: "none" | "static" | "plugin";
  dataSource?: DataSourceRow[];
  dataSourcePluginText?: string;
  dataSourcePolicy?: string;
  service?: string;
  validateText?: string;
  reactionText?: string;
  effectText?: string;
  formatText?: string;
  tableEnabled?: boolean;
  tableWidth?: number;
  tableVisible?: boolean;
  tableEllipsis?: boolean;
  tableSortable?: boolean;
  databaseEnabled?: boolean;
  databaseType?: ColumnType;
  databaseNullable?: boolean;
  databaseDefaultText?: string;
  databaseUnique?: boolean;
  databaseIndex?: boolean;
  databaseFilterable?: boolean;
  databaseSortable?: boolean;
  databaseRelation?: "many-to-one" | "many-to-many";
  databaseTarget?: string;
  databaseThrough?: string;
}

function stringify(value: unknown): string {
  return value === undefined ? "" : JSON.stringify(value, null, 2);
}

function parseJsonObject(
  text: string | undefined,
  label: string,
): Record<string, unknown> | undefined {
  if (!text?.trim()) return undefined;
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}必须是 JSON 对象`);
  }
  return value as Record<string, unknown>;
}

function parseLoose(text?: string): unknown {
  if (!text?.trim()) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function fieldEditorValuesOf(field: ModelFieldSchema): FieldFormValues {
  const props = { ...field.props };
  const service = typeof props.service === "string" ? props.service : undefined;
  delete props.service;
  const dataSourceMode = Array.isArray(field.dataSource)
    ? "static"
    : field.dataSource
      ? "plugin"
      : "none";
  return {
    component: field.component ?? "Input",
    key: field.key ?? "",
    title: field.title,
    description: field.description,
    required: field.required === true,
    disabled: field.disabled,
    display: field.display ?? "visible",
    defaultText: stringify(field.default),
    ref: field.$ref,
    layout: field["x-layout"],
    decorator: field.decorator,
    propsText: stringify(props),
    decoratorPropsText: stringify(field.decoratorProps),
    dataSourceMode,
    dataSource: Array.isArray(field.dataSource)
      ? field.dataSource.map((item) => {
          const { label, value, ...extra } = item;
          return {
            label,
            value: stringify(value),
            extraText: Object.keys(extra).length ? stringify(extra) : "",
          };
        })
      : [],
    dataSourcePluginText:
      field.dataSource && !Array.isArray(field.dataSource) ? stringify(field.dataSource) : "",
    dataSourcePolicy: field.dataSourcePolicy,
    service,
    validateText: stringify(field["x-validate"]),
    reactionText: stringify(field["x-reaction"]),
    effectText: stringify(field["x-effect"]),
    formatText: stringify(field["x-format"]),
    tableEnabled: Boolean(field["x-table"]),
    tableWidth: field["x-table"]?.width,
    tableVisible: field["x-table"]?.visible ?? true,
    tableEllipsis: field["x-table"]?.ellipsis ?? true,
    tableSortable: field["x-table"]?.sortable,
    databaseEnabled: Boolean(field["x-database"]),
    databaseType: field["x-database"]?.type,
    databaseNullable: field["x-database"]?.nullable,
    databaseDefaultText: stringify(field["x-database"]?.default),
    databaseUnique: field["x-database"]?.unique,
    databaseIndex: field["x-database"]?.index,
    databaseFilterable: field["x-database"]?.filterable,
    databaseSortable: field["x-database"]?.sortable,
    databaseRelation: field["x-database"]?.relation,
    databaseTarget: field["x-database"]?.target,
    databaseThrough: field["x-database"]?.through,
  };
}

export function fieldEditorSchemaOf(
  registry: Registry,
  values: FieldFormValues,
  domain?: string,
): ModelFieldSchema {
  const definition = getFieldDefinition(registry, values.component, domain);
  const props = parseJsonObject(values.propsText, "组件属性") ?? {};
  if (values.service?.trim()) props.service = values.service.trim();
  let dataSource: ModelFieldSchema["dataSource"];
  if (values.dataSourceMode === "static") {
    dataSource = (values.dataSource ?? [])
      .filter((item) => item.label?.trim())
      .map((item) => ({
        ...parseJsonObject(item.extraText, "选项扩展属性"),
        label: item.label!.trim(),
        value: parseLoose(item.value),
      }));
  } else if (values.dataSourceMode === "plugin") {
    dataSource = parseJsonObject(values.dataSourcePluginText, "数据源插件") as
      | { plugin: string; [key: string]: unknown }
      | undefined;
  }

  const schema: ModelFieldSchema = {
    type: columnTypeToFieldType(values.databaseType) ?? definition?.fieldType ?? "string",
    component: values.component,
    key: values.key.trim(),
    title: values.title?.trim() || undefined,
    description: values.description?.trim() || undefined,
    default: parseLoose(values.defaultText),
    required: values.required,
    disabled: values.disabled,
    display: values.display as ModelFieldSchema["display"],
    $ref: values.ref?.trim() || undefined,
    "x-layout": values.layout?.trim() || undefined,
    decorator: values.decorator?.trim() || undefined,
    props: Object.keys(props).length ? props : undefined,
    decoratorProps: parseJsonObject(values.decoratorPropsText, "装饰器属性"),
    dataSource,
    dataSourcePolicy: values.dataSourcePolicy as ModelFieldSchema["dataSourcePolicy"],
    "x-validate": parseLoose(values.validateText) as ModelFieldSchema["x-validate"],
    "x-reaction": parseLoose(values.reactionText) as ModelFieldSchema["x-reaction"],
    "x-effect": parseLoose(values.effectText) as ModelFieldSchema["x-effect"],
    "x-format": parseLoose(values.formatText) as ModelFieldSchema["x-format"],
    "x-table": values.tableEnabled
      ? {
          width: values.tableWidth,
          visible: values.tableVisible,
          ellipsis: values.tableEllipsis,
          sortable: values.tableSortable,
        }
      : undefined,
    "x-database": values.databaseEnabled
      ? {
          type: values.databaseType || undefined,
          nullable: values.databaseNullable,
          default: parseLoose(values.databaseDefaultText) as string | number | boolean | undefined,
          unique: values.databaseUnique,
          index: values.databaseIndex,
          filterable: values.databaseFilterable,
          sortable: values.databaseSortable,
          relation: values.databaseRelation,
          target: values.databaseTarget?.trim() || undefined,
          through: values.databaseThrough?.trim() || undefined,
        }
      : undefined,
  };
  return Object.fromEntries(
    Object.entries(schema).filter(([, value]) => value !== undefined),
  ) as ModelFieldSchema;
}

const JsonArea = ({
  name,
  label,
  rows = 7,
}: {
  name: keyof FieldFormValues;
  label: string;
  rows?: number;
}) => (
  <Form.Item name={name} label={label}>
    <Input.TextArea rows={rows} spellCheck={false} className={styles.codeInput} />
  </Form.Item>
);

/** 完整字段配置器：已知结构可视化，开放结构使用 JSON 文本。 */
export const FieldEditor = forwardRef<FieldEditorRef, FieldEditorProps>(function FieldEditor(
  { field },
  ref,
) {
  const builder = useBuilder<ModelDraft>();
  const [form] = Form.useForm<FieldFormValues>();
  const component = Form.useWatch("component", form) ?? field.fields.component ?? "Input";
  const dataSourceMode = Form.useWatch("dataSourceMode", form);
  const databaseType = Form.useWatch("databaseType", form);
  const tableEnabled = Form.useWatch("tableEnabled", form);
  const databaseEnabled = Form.useWatch("databaseEnabled", form);
  const options = useMemo(
    () => fieldComponentOptions(builder.registry, builder.domain),
    [builder, builder.domain],
  );
  const description = componentDescription(builder.registry, component, builder.domain);

  useImperativeHandle(
    ref,
    () => ({
      submit: async () => {
        const values = await form.validateFields();
        const fields = fieldEditorSchemaOf(builder.registry, values, builder.domain);
        return {
          ...field,
          fields,
          children: getFieldDefinition(builder.registry, fields.component, builder.domain)
            ?.authoring.children
            ? field.children
            : undefined,
        };
      },
    }),
    [builder, field, form],
  );

  const resetForComponent = (next: string) => {
    const current = form.getFieldsValue();
    const schema = getDefaultFieldSchema(builder.registry, next, builder.domain);
    const defaults = fieldEditorValuesOf({
      ...schema,
      key: current.key,
      title: schema.title,
    });
    form.setFieldsValue(defaults);
  };

  return (
    <Form
      form={form}
      layout="vertical"
      className={styles.fieldEditor}
      initialValues={fieldEditorValuesOf(field.fields)}
    >
      <Tabs
        items={[
          {
            key: "basic",
            label: "基础",
            children: (
              <div className={styles.editorGrid}>
                <Form.Item
                  label={
                    <span className={styles.schemaLabel}>
                      组件
                      {description ? (
                        <Tooltip title={description}>
                          <InfoCircleOutlined className={styles.schemaInfo} />
                        </Tooltip>
                      ) : null}
                    </span>
                  }
                  name="component"
                >
                  <Select options={options} onChange={resetForComponent} />
                </Form.Item>
                <Form.Item label="Schema 类型">
                  <Input
                    disabled
                    value={
                      columnTypeToFieldType(databaseType) ??
                      getFieldDefinition(builder.registry, component, builder.domain)?.fieldType ??
                      "string"
                    }
                  />
                </Form.Item>
                <Form.Item
                  label="字段 Key"
                  name="key"
                  rules={[
                    { required: true, whitespace: true, message: "请填写字段 Key" },
                    {
                      pattern: /^[a-zA-Z_][\w-]*$/,
                      message: "只能使用字母、数字、下划线和中划线",
                    },
                  ]}
                >
                  <Input />
                </Form.Item>
                <Form.Item label="标题" name="title">
                  <Input />
                </Form.Item>
                <Form.Item label="描述" name="description" className={styles.fullSpan}>
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item label="默认值" name="defaultText" className={styles.fullSpan}>
                  <Input.TextArea rows={3} spellCheck={false} className={styles.codeInput} />
                </Form.Item>
                <Form.Item label="显示状态" name="display">
                  <Select
                    options={[
                      { label: "显示", value: "visible" },
                      { label: "隐藏但保留布局", value: "hidden" },
                      { label: "不渲染", value: "none" },
                    ]}
                  />
                </Form.Item>
                <Form.Item label="必填" name="required" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item label="禁用" name="disabled" valuePropName="checked">
                  <Switch />
                </Form.Item>
                <Form.Item label="$ref" name="ref">
                  <Input />
                </Form.Item>
                <Form.Item label="x-layout" name="layout">
                  <Input />
                </Form.Item>
                <Form.Item label="装饰器" name="decorator">
                  <Input />
                </Form.Item>
              </div>
            ),
          },
          {
            key: "props",
            label: "属性",
            children: (
              <>
                <JsonArea name="propsText" label="组件属性 props" rows={10} />
                <JsonArea name="decoratorPropsText" label="装饰器属性 decoratorProps" rows={6} />
              </>
            ),
          },
          {
            key: "dataSource",
            label: "数据源",
            children: (
              <>
                <div className={styles.editorGrid}>
                  <Form.Item label="数据源类型" name="dataSourceMode">
                    <Select
                      options={[
                        { label: "不配置", value: "none" },
                        { label: "静态选项", value: "static" },
                        { label: "插件配置", value: "plugin" },
                      ]}
                    />
                  </Form.Item>
                  <Form.Item label="远程服务 props.service" name="service">
                    <Input />
                  </Form.Item>
                  <Form.Item label="值失效策略" name="dataSourcePolicy">
                    <Select
                      allowClear
                      options={[
                        { label: "保留", value: "preserve" },
                        { label: "清空", value: "clear" },
                        { label: "过滤", value: "filter" },
                        { label: "选择第一项", value: "first" },
                      ]}
                    />
                  </Form.Item>
                </div>
                {dataSourceMode === "static" ? (
                  <Form.List name="dataSource">
                    {(items, { add, remove }) => (
                      <Space direction="vertical" className={styles.fullWidth}>
                        {items.map(({ key, name }) => (
                          <Space key={key} align="start" className={styles.dataSourceRow}>
                            <Form.Item name={[name, "label"]} rules={[{ required: true }]}>
                              <Input placeholder="显示名称" />
                            </Form.Item>
                            <Form.Item name={[name, "value"]}>
                              <Input placeholder='值，例如 "active" 或 1' />
                            </Form.Item>
                            <Form.Item name={[name, "extraText"]}>
                              <Input placeholder="扩展属性 JSON" />
                            </Form.Item>
                            <Button
                              danger
                              type="text"
                              icon={<DeleteOutlined />}
                              onClick={() => remove(name)}
                            />
                          </Space>
                        ))}
                        <Button type="dashed" icon={<PlusOutlined />} onClick={() => add()}>
                          添加选项
                        </Button>
                      </Space>
                    )}
                  </Form.List>
                ) : null}
                {dataSourceMode === "plugin" ? (
                  <JsonArea name="dataSourcePluginText" label="插件配置" rows={10} />
                ) : null}
              </>
            ),
          },
          {
            key: "rules",
            label: "规则",
            children: (
              <>
                <JsonArea name="validateText" label="校验 x-validate" />
                <JsonArea name="reactionText" label="联动 x-reaction" />
                <JsonArea name="effectText" label="副作用 x-effect" />
                <JsonArea name="formatText" label="格式化 x-format" />
              </>
            ),
          },
          {
            key: "projection",
            label: "表格与存储",
            children: (
              <>
                <Form.Item label="启用表格配置" name="tableEnabled" valuePropName="checked">
                  <Switch />
                </Form.Item>
                {tableEnabled ? (
                  <div className={styles.editorGrid}>
                    <Form.Item label="列宽" name="tableWidth">
                      <InputNumber min={40} />
                    </Form.Item>
                    <Form.Item label="显示列" name="tableVisible" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item label="内容省略" name="tableEllipsis" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item label="允许排序" name="tableSortable" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </div>
                ) : null}
                <Divider />
                <Form.Item label="启用数据库配置" name="databaseEnabled" valuePropName="checked">
                  <Switch />
                </Form.Item>
                {databaseEnabled ? (
                  <div className={styles.editorGrid}>
                    <Form.Item label="数据库类型" name="databaseType">
                      <Select allowClear options={COLUMN_TYPE_OPTIONS.slice()} />
                    </Form.Item>
                    <Form.Item label="默认值" name="databaseDefaultText">
                      <Input />
                    </Form.Item>
                    <Form.Item label="可空" name="databaseNullable" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item label="唯一" name="databaseUnique" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item label="索引" name="databaseIndex" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item label="可筛选" name="databaseFilterable" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item label="可排序" name="databaseSortable" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                    <Form.Item label="关联类型" name="databaseRelation">
                      <Select
                        allowClear
                        options={[
                          { label: "多对一", value: "many-to-one" },
                          { label: "多对多", value: "many-to-many" },
                        ]}
                      />
                    </Form.Item>
                    <Form.Item label="目标模型" name="databaseTarget">
                      <Input />
                    </Form.Item>
                    <Form.Item label="中间模型" name="databaseThrough">
                      <Input />
                    </Form.Item>
                  </div>
                ) : null}
              </>
            ),
          },
        ]}
      />
    </Form>
  );
});

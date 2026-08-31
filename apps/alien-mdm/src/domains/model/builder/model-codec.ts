import type { Registry, UiNode } from "@alien-form/engine";
import type { GroupConfig } from "@app-types/shared";
import { getFieldDefinition } from "@runtime";
import type { FieldDraft, GroupDraft, ModelDraft, ModelFieldSchema, ModelSchema } from "./types";

const DEFAULT_RECORD_SERVICES = {
  "query.list": "records.list",
  "query.filter": "records.list",
  "query.detail": "records.get",
  "create.record": "records.create",
  "update.record": "records.update",
  "delete.record": "records.delete",
  "delete.recordMany": "records.deleteMany",
};

export const DEFAULT_LAYOUT: UiNode = {
  component: "layout",
  props: { services: DEFAULT_RECORD_SERVICES },
  slots: {
    rightTop: { component: "filter", props: { scope: "main" } },
    rightBottom: {
      component: "table",
      props: { scope: "main" },
      children: [
        {
          component: "space",
          props: { size: 4 },
          children: [{ component: "detail" }, { component: "edit" }, { component: "delete" }],
        },
      ],
      slots: {
        toolbarLeft: { component: "action-batch-delete" },
        toolbarRight: {
          component: "space",
          props: { size: "small" },
          children: [{ component: "action-refresh" }, { component: "action-add" }],
        },
      },
    },
  },
};

export class ModelCodec {
  private readonly registry: Registry;
  private readonly createId: () => string;

  constructor(registry: Registry, createId = createIdFactory()) {
    this.registry = registry;
    this.createId = createId;
  }

  encode(draft: ModelDraft): ModelSchema {
    const groups: GroupConfig[] = draft.groups
      .filter((group) => group.keys.length > 0)
      .map((group) => ({
        component: group.component,
        keys: [...group.keys],
        props: {
          gridSpan: Math.min(24, Math.max(1, Math.floor(group.gridSpan || 12))),
          title: group.title || undefined,
        },
      }));
    return {
      type: "object",
      title: draft.title,
      description: draft.description,
      properties: this.encodeFields(draft.fields, draft.name),
      "x-layout": structuredClone(draft.layout),
      ...(groups.length > 0 ? { group: groups } : {}),
      ...(draft.i18n ? { i18n: structuredClone(draft.i18n) } : {}),
      ...(draft.constants ? { constants: structuredClone(draft.constants) } : {}),
      meta: {
        name: draft.name,
        title: draft.title,
        subtitle: draft.subtitle || undefined,
        description: draft.description || undefined,
        group: draft.group,
        singularLabel: draft.singularLabel || "记录",
        pluralLabel: draft.pluralLabel || "记录",
        defaultPageSize: draft.defaultPageSize,
        filterCount: draft.filterCount,
        openMode: { ...draft.openMode },
      },
    };
  }

  decode(schema: ModelSchema): ModelDraft {
    return {
      name: schema.meta.name,
      title: schema.meta.title,
      subtitle: schema.meta.subtitle ?? "",
      description: schema.meta.description ?? "",
      group: schema.meta.group ?? "other",
      singularLabel: schema.meta.singularLabel,
      pluralLabel: schema.meta.pluralLabel,
      defaultPageSize: schema.meta.defaultPageSize,
      filterCount: schema.meta.filterCount ?? 3,
      openMode: { ...schema.meta.openMode },
      fields: Object.entries(schema.properties)
        .sort(([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0))
        .map(([key, field]) => this.decodeField(key, field, schema.meta.name)),
      groups: (schema.group ?? []).map((group) => ({
        id: this.createId(),
        title: typeof group.props?.title === "string" ? group.props.title : (group.title ?? ""),
        component: group.component,
        keys: [...group.keys],
        gridSpan:
          typeof group.props?.gridSpan === "number" && group.props.gridSpan > 0
            ? group.props.gridSpan
            : 12,
      })),
      layout: structuredClone(schema["x-layout"]),
      i18n: schema.i18n ? structuredClone(schema.i18n) : undefined,
      constants: schema.constants ? structuredClone(schema.constants) : undefined,
    };
  }

  createModel(): ModelDraft {
    return {
      name: "",
      title: "新模型",
      subtitle: "",
      description: "",
      group: "other",
      singularLabel: "记录",
      pluralLabel: "记录",
      defaultPageSize: 10,
      filterCount: 3,
      openMode: { add: "drawer", edit: "drawer", detail: "drawer" },
      fields: [this.createField(), ...this.defaultFields()],
      groups: [],
      layout: structuredClone(DEFAULT_LAYOUT),
    };
  }

  /**
   * 每个模型的默认字段：id / status / 审计人与时间。
   * 统一策略：table 默认展示、表单不展示（display: hidden）、filter 展示（filterable）。
   * id / createdAt / updatedAt 是后端系统列（backend 自动维护）；createBy / updateBy / status
   * 是普通模版字段。status 用 Select，选项取自注册的 status 常量，默认值 normal。
   */
  private defaultFields(): FieldDraft[] {
    const auditText = (key: string, title: string): FieldDraft => ({
      id: this.createId(),
      fields: {
        type: "string",
        key,
        title,
        component: "Input",
        display: "hidden",
        "x-table": { visible: true, width: 160 },
        "x-database": { type: "text", filterable: true },
      },
    });
    const auditTime = (key: string, title: string): FieldDraft => ({
      id: this.createId(),
      fields: {
        type: "string",
        key,
        title,
        component: "DateInput",
        display: "hidden",
        "x-table": { visible: true, width: 170 },
        "x-database": { type: "text", filterable: true },
      },
    });
    return [
      {
        id: this.createId(),
        fields: {
          type: "string",
          key: "status",
          title: "状态",
          component: "Select",
          display: "hidden",
          default: "normal",
          dataSource: { plugin: "$af-constant", key: "status" },
          "x-table": { visible: true, width: 100 },
          "x-database": { type: "text", default: "normal", index: true, filterable: true },
        },
      },
      auditText("createBy", "创建人"),
      auditTime("createdAt", "创建时间"),
      auditText("updateBy", "更新人"),
      auditTime("updatedAt", "更新时间"),
      {
        id: this.createId(),
        fields: {
          type: "string",
          key: "id",
          title: "ID",
          component: "Input",
          display: "hidden",
          "x-table": { visible: true, width: 160 },
          "x-database": { type: "text", filterable: true },
        },
      },
    ];
  }

  createField(component = "Input", domain?: string): FieldDraft {
    const definition =
      getFieldDefinition(this.registry, component, domain) ??
      getFieldDefinition(this.registry, "Input", domain);
    if (!definition) throw new Error(`[alien-mdm] field definition "${component}" not found`);
    const suffix = this.createId().split("-").pop();
    return {
      id: this.createId(),
      fields: {
        ...definition.authoring.create(),
        key: `field_${suffix}`,
        title: "新字段",
      },
    };
  }

  createGroup(): GroupDraft {
    return {
      id: this.createId(),
      title: "新分组",
      component: "GridLayout",
      keys: [],
      gridSpan: 12,
    };
  }

  private encodeFields(fields: FieldDraft[], domain: string): Record<string, ModelFieldSchema> {
    return Object.fromEntries(
      fields.map((draft, index) => {
        const { key = `field_${index + 1}`, ...rest } = draft.fields;
        const field: ModelFieldSchema = { ...rest, order: (index + 1) * 10 };
        const fieldType = getFieldDefinition(this.registry, field.component, domain)?.fieldType;
        if (fieldType === "object") {
          field.type = "object";
          field.properties = this.encodeFields(draft.children ?? [], domain);
          delete field.items;
        } else if (fieldType === "array") {
          field.type = "array";
          field.items = {
            type: "object",
            properties: this.encodeFields(draft.children ?? [], domain),
          };
          delete field.properties;
        }
        return [key, field];
      }),
    );
  }

  private decodeField(key: string, field: ModelFieldSchema, domain: string): FieldDraft {
    const fieldType = getFieldDefinition(this.registry, field.component, domain)?.fieldType;
    const itemProperties =
      field.items && !Array.isArray(field.items) ? field.items.properties : undefined;
    const children =
      fieldType === "object"
        ? field.properties
        : fieldType === "array"
          ? itemProperties
          : undefined;
    const { properties: _properties, items: _items, ...rest } = field;
    return {
      id: this.createId(),
      fields: { key, ...rest },
      children: children
        ? Object.entries(children)
            .sort(([, left], [, right]) => (left.order ?? 0) - (right.order ?? 0))
            .map(([childKey, child]) => this.decodeField(childKey, child, domain))
        : undefined,
    };
  }
}

export function createIdFactory(): () => string {
  let counter = 0;
  return () => `af-${Date.now()}-${++counter}`;
}

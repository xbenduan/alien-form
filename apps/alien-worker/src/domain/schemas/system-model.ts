import type {
  FieldSchema,
  ModelFieldDatabase,
  ModelFieldSchema,
  PageSchema,
} from "@alien-form/protocol";

/** Creates a physical field owned by a built-in model. */
export function physicalField(
  model: string,
  key: string,
  database: ModelFieldDatabase,
  form: FieldSchema,
  options: Pick<ModelFieldSchema, "relation" | "table" | "filter"> = {},
): ModelFieldSchema {
  return {
    id: `${model}.${key}`,
    key,
    storage: "physical",
    database,
    form,
    ...options,
  };
}

/** Creates a JSON-backed virtual field owned by a built-in model. */
export function virtualField(model: string, key: string, form: FieldSchema): ModelFieldSchema {
  return {
    id: `${model}.${key}`,
    key,
    storage: "virtual",
    form,
  };
}

/** Creates the common ID and timestamp fields used by built-in models. */
export function systemFields(model: string): ModelFieldSchema[] {
  return [
    physicalField(
      model,
      "id",
      { type: "text", system: true, nullable: false, unique: true, index: true },
      { type: "string", title: "ID", display: "hidden" },
      { table: { title: "ID" } },
    ),
    physicalField(
      model,
      "createdAt",
      { type: "integer", valueType: "string", system: true, nullable: false },
      {
        type: "string",
        title: "创建时间",
        component: "DatePicker",
        props: { readOnly: true, showTime: true },
      },
      { table: { title: "创建时间" } },
    ),
    physicalField(
      model,
      "updatedAt",
      { type: "integer", valueType: "string", system: true, nullable: false },
      {
        type: "string",
        title: "更新时间",
        component: "DatePicker",
        props: { readOnly: true, showTime: true },
      },
      { table: { title: "更新时间" } },
    ),
  ];
}

/** Creates standard list/add/edit/detail pages for a built-in record model. */
export function recordPages(model: string, title: string, groupKeys: string[]): PageSchema[] {
  const formPages = (["add", "edit", "detail"] as const).map((mode) => ({
    router: mode,
    title: `${mode === "add" ? "新建" : mode === "edit" ? "编辑" : "详情"}${title}`,
    groups: [
      {
        component: "ObjectField",
        title: "基础信息",
        keys: groupKeys,
        props: { gridSpan: 12 },
      },
    ],
    properties: {
      form: {
        type: "void",
        component: "record-form",
        props: {
          ...(mode === "add" ? { ok: "确认新增" } : mode === "edit" ? { ok: "确认修改" } : {}),
          mode,
          modelCode: model,
          ...(mode === "add" ? {} : { recordId: "{{ $query.id }}" }),
          schema: { $ref: "form-schema" },
          ...(mode === "add"
            ? { submit: '{{ $service("record.add") }}' }
            : mode === "edit"
              ? { submit: '{{ $service("record.edit") }}' }
              : {}),
        },
      },
    },
  }));

  return [
    {
      router: "list",
      title,
      layout: { component: "layout" },
      properties: {
        filter: {
          type: "string",
          component: "filter",
          props: {
            schema: { $ref: "form-schema" },
            filterFields: "{{ $utils.schemaToFilterFields }}",
          },
        },
        table: {
          type: "void",
          component: "table",
          props: {
            rowKey: "id",
            modelCode: model,
            schema: { $ref: "form-schema" },
            columns: "{{ $utils.schemaToColumns }}",
            filter: '{{ $form.getFieldValue("filter") }}',
            loadData: '{{ $service("records.list") }}',
            rowActions: ["delete"],
            actionBtns: {
              add: { type: "primary", children: "新增", openMode: "page" },
              edit: { type: "link", children: "编辑", openMode: "page" },
              detail: { type: "link", children: "详情", openMode: "drawer" },
              batchDelete: {
                children: "批量删除",
                danger: true,
                service: '{{ $service("records.batchDelete") }}',
              },
            },
          },
          properties: {
            delete: {
              type: "void",
              component: "row-button",
              props: {
                danger: true,
                icon: "delete",
                children: "删除",
                confirm: "确认删除这条记录？",
                confirmDescription: "删除后无法恢复。",
                successMessage: "记录已删除",
                refreshAfterSuccess: true,
                onClick: `{{ ($row) => $service("records.delete")({ model: "${model}", id: $row.id, record: $row }) }}`,
              },
            },
          },
        },
      },
    },
    ...formPages,
  ];
}

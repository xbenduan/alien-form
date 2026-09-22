import type { FieldGroup, OpenMode, PageSchema } from "./model-schema.ts";

export interface PageTemplate {
  key: string;
  label: string;
  description?: string;
  build: (modelCode: string, title: string) => PageSchema;
}

export interface RecordPageOptions {
  groups?: FieldGroup[];
  actionOpenModes?: Partial<Record<"add" | "edit" | "detail", OpenMode>>;
}

/** Field keys managed by the runtime rather than record forms. */
export const SYSTEM_FIELD_KEYS = ["id", "createdAt", "updatedAt"] as const;

/** Shared detail-page group for generated system fields. */
export const SYSTEM_DETAIL_GROUP: FieldGroup = {
  component: "Card",
  title: "系统信息",
  keys: [...SYSTEM_FIELD_KEYS],
  props: { gridSpan: 12 },
};

const DEFAULT_OPEN_MODE: OpenMode = "drawer";

function buildListPage(
  modelCode: string,
  title: string,
  openModes: Record<"add" | "edit" | "detail", OpenMode>,
): PageSchema {
  const modelLiteral = JSON.stringify(modelCode);
  return {
    router: "list",
    title,
    permission: "read",
    layout: { component: "layout", slots: { content: ["filter", "table"] } },
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
          modelCode,
          schema: { $ref: "form-schema" },
          columns: "{{ $utils.schemaToColumns }}",
          filter: '{{ $form.getFieldValue("filter") }}',
          loadData: '{{ $service("records.list") }}',
        },
        slots: {
          toolbar: ["import", "export", "add"],
          batchActions: ["batchDelete"],
          rowActions: ["edit", "detail", "deactivate", "delete"],
        },
        properties: {
          add: {
            type: "void",
            component: "record-action",
            permission: "create",
            props: { mode: "add", openMode: openModes.add, children: "新增" },
          },
          edit: {
            type: "void",
            component: "record-action",
            permission: "update",
            props: { mode: "edit", openMode: openModes.edit, children: "编辑" },
          },
          detail: {
            type: "void",
            component: "record-action",
            permission: "read",
            props: { mode: "detail", openMode: openModes.detail, children: "详情" },
          },
          batchDelete: {
            type: "void",
            component: "batch-button",
            permission: "delete",
            props: {
              children: "批量删除",
              danger: true,
              confirm: "确认删除选中的记录吗？",
              successMessage: "记录已删除",
              refreshAfterSuccess: true,
              onClick: '{{ ($selection) => $service("records.batchDelete")($selection) }}',
            },
          },
          deactivate: {
            type: "void",
            component: "row-button",
            permission: "update",
            props: {
              danger: true,
              children: "停用",
              onClick: '{{ ($row) => $utils.message.info("功能未完善") }}',
            },
          },
          delete: {
            type: "void",
            component: "row-button",
            permission: "delete",
            props: {
              danger: true,
              icon: "delete",
              children: "删除",
              confirm: "确认删除这条记录？",
              confirmDescription: "删除后无法恢复。",
              successMessage: "记录已删除",
              refreshAfterSuccess: true,
              onClick: `{{ ($row) => $service("records.delete")({ model: ${modelLiteral}, id: $row.id, record: $row }) }}`,
            },
          },
          import: {
            type: "void",
            component: "Button",
            permission: "create",
            props: {
              children: "导入",
              onClick: '{{ () => $utils.message.info("功能未完善") }}',
            },
          },
          export: {
            type: "void",
            component: "Button",
            permission: "read",
            props: {
              children: "导出",
              onClick: '{{ () => $utils.message.info("功能未完善") }}',
            },
          },
        },
      },
    },
  };
}

function buildTreeListPage(modelCode: string, title: string): PageSchema {
  const page = buildListPage(modelCode, title, {
    add: DEFAULT_OPEN_MODE,
    edit: DEFAULT_OPEN_MODE,
    detail: DEFAULT_OPEN_MODE,
  });
  return {
    ...page,
    layout: {
      component: "layout",
      slots: { left: "left", content: ["filter", "table"] },
    },
    properties: {
      left: {
        type: "string",
        component: "tree",
        props: {
          title,
          model: modelCode,
          valueField: "id",
          parentField: "parentId",
          labelField: "name",
          showRoot: false,
          loadData: '{{ $utils.tree($service("records.subtree")) }}',
        },
      },
      ...page.properties,
      table: {
        ...page.properties.table,
        props: {
          ...page.properties.table.props,
          parentId: '{{ $form.getFieldValue("left") }}',
        },
        slots: {
          toolbar: ["add"],
          batchActions: ["batchDelete"],
          rowActions: ["edit", "detail", "delete"],
        },
      },
    },
  };
}

function buildRecordPage(
  mode: "add" | "edit" | "detail",
): (modelCode: string, title: string) => PageSchema {
  const prefix = mode === "add" ? "新建" : mode === "edit" ? "编辑" : "详情";
  return (modelCode, title) => ({
    router: mode,
    title: `${prefix}${title}`,
    permission: mode === "add" ? "create" : mode === "edit" ? "update" : "read",
    groups: mode === "detail" ? [SYSTEM_DETAIL_GROUP] : undefined,
    properties: {
      form: {
        type: "void",
        component: "record-form",
        props: {
          ...(mode === "detail" ? {} : { ok: mode === "add" ? "确认新增" : "确认修改" }),
          mode,
          modelCode,
          ...(mode === "add" ? {} : { recordId: "{{ $query.id }}" }),
          schema: { $ref: "form-schema" },
          ...(mode === "detail"
            ? {}
            : { submit: `{{ $service("record.${mode === "add" ? "add" : "edit"}") }}` }),
        },
      },
    },
  });
}

/** Canonical page templates. They are expanded once and remain freely editable AST. */
export const PAGE_TEMPLATES: readonly PageTemplate[] = [
  {
    key: "list",
    label: "列表页",
    description: "筛选 + 表格 + 行内操作按钮",
    build: (modelCode, title) =>
      buildListPage(modelCode, title, {
        add: DEFAULT_OPEN_MODE,
        edit: DEFAULT_OPEN_MODE,
        detail: DEFAULT_OPEN_MODE,
      }),
  },
  {
    key: "tree-list",
    label: "树形列表页",
    description: "左侧自关联树 + 右侧筛选与后代记录表格",
    build: buildTreeListPage,
  },
  {
    key: "add",
    label: "新建页",
    description: "record-form（新建模式）",
    build: buildRecordPage("add"),
  },
  {
    key: "edit",
    label: "编辑页",
    description: "record-form（编辑模式）",
    build: buildRecordPage("edit"),
  },
  {
    key: "detail",
    label: "详情页",
    description: "record-form（详情模式）",
    build: buildRecordPage("detail"),
  },
];

const DEFAULT_PAGE_TEMPLATE_KEYS = new Set(["list", "add", "edit", "detail"]);

export function findPageTemplate(key: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((template) => template.key === key);
}

export function createDefaultPages(modelCode: string, title: string): PageSchema[] {
  return PAGE_TEMPLATES.filter((template) => DEFAULT_PAGE_TEMPLATE_KEYS.has(template.key)).map(
    (template) => template.build(modelCode, title),
  );
}

/** Creates standard built-in pages from the same templates used by the editor. */
export function createRecordPages(
  modelCode: string,
  title: string,
  groupKeys: string[],
  options: RecordPageOptions = {},
): PageSchema[] {
  const openModes = {
    add: options.actionOpenModes?.add ?? "page",
    edit: options.actionOpenModes?.edit ?? "page",
    detail: options.actionOpenModes?.detail ?? "drawer",
  } satisfies Record<"add" | "edit" | "detail", OpenMode>;
  const listPage = buildListPage(modelCode, title, openModes);
  const table = listPage.properties.table!;
  const {
    import: _import,
    export: _export,
    deactivate: _deactivate,
    ...recordActions
  } = table.properties ?? {};
  return [
    {
      ...listPage,
      properties: {
        ...listPage.properties,
        table: {
          ...table,
          slots: {
            toolbar: ["add"],
            batchActions: ["batchDelete"],
            rowActions: ["edit", "detail", "delete"],
          },
          properties: recordActions,
        },
      },
    },
    ...(["add", "edit", "detail"] as const).map((mode) => {
      const page = buildRecordPage(mode)(modelCode, title);
      return {
        ...page,
        groups: [
          {
            component: "Card",
            title: "基础信息",
            keys: groupKeys,
            props: { gridSpan: 12 },
          },
          ...(mode === "detail" ? [SYSTEM_DETAIL_GROUP] : []),
          ...(options.groups ?? []),
        ],
      };
    }),
  ];
}

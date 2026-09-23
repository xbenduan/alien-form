import type { AlienFieldSchema, AlienSchema } from "./alien-schema.ts";

type OpenMode = "page" | "modal" | "drawer";

export interface PageTemplate {
  key: string;
  label: string;
  description?: string;
  build: (modelCode: string, title: string) => AlienSchema["pages"][number];
}

export interface RecordPageOptions {
  actionOpenModes?: Partial<Record<"add" | "edit" | "detail", OpenMode>>;
}

/** Field keys managed by the runtime rather than record forms. */
export const SYSTEM_FIELD_KEYS = ["id", "createdAt", "updatedAt"] as const;

const DEFAULT_OPEN_MODE: OpenMode = "drawer";

function recordActions(
  modelCode: string,
  openModes: Record<"add" | "edit" | "detail", OpenMode>,
): Record<string, AlienFieldSchema> {
  const modelLiteral = JSON.stringify(modelCode);
  return {
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
  };
}

function buildListPage(
  modelCode: string,
  title: string,
  openModes: Record<"add" | "edit" | "detail", OpenMode>,
): AlienSchema["pages"][number] {
  return {
    router: "list",
    title,
    permission: "read",
    type: "void",
    component: "layout",
    slots: {
      content: {
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
            toolbar: {
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
              add: {
                type: "void",
                component: "record-action",
                permission: "create",
                props: { mode: "add", openMode: openModes.add, children: "新增" },
              },
            },
            batchActions: {
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
            },
            rowActions: recordActions(modelCode, openModes),
          },
        },
      },
    },
  };
}

function buildTreeListPage(modelCode: string, title: string): AlienSchema["pages"][number] {
  const page = buildListPage(modelCode, title, {
    add: DEFAULT_OPEN_MODE,
    edit: DEFAULT_OPEN_MODE,
    detail: DEFAULT_OPEN_MODE,
  });
  const content = page.slots!.content!;
  const table = content.table!;
  return {
    ...page,
    slots: {
      left: {
        tree: {
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
      },
      content: {
        ...content,
        table: {
          ...table,
          props: {
            ...table.props,
            parentId: '{{ $form.getFieldValue("tree") }}',
          },
          slots: {
            toolbar: { add: table.slots!.toolbar!.add! },
            batchActions: table.slots!.batchActions!,
            rowActions: Object.fromEntries(
              Object.entries(table.slots!.rowActions!).filter(([key]) => key !== "deactivate"),
            ),
          },
        },
      },
    },
  };
}

function buildRecordPage(
  mode: "add" | "edit" | "detail",
): (modelCode: string, title: string) => AlienSchema["pages"][number] {
  const prefix = mode === "add" ? "新建" : mode === "edit" ? "编辑" : "详情";
  return (modelCode, title) => ({
    router: mode,
    title: `${prefix}${title}`,
    permission: mode === "add" ? "create" : mode === "edit" ? "update" : "read",
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

export function createDefaultPages(modelCode: string, title: string): AlienSchema["pages"] {
  return PAGE_TEMPLATES.filter((template) => DEFAULT_PAGE_TEMPLATE_KEYS.has(template.key)).map(
    (template) => template.build(modelCode, title),
  );
}

/** Creates standard built-in pages from the same templates used by the editor. */
export function createRecordPages(
  modelCode: string,
  title: string,
  _groupKeys: string[],
  options: RecordPageOptions = {},
): AlienSchema["pages"] {
  const openModes = {
    add: options.actionOpenModes?.add ?? "page",
    edit: options.actionOpenModes?.edit ?? "page",
    detail: options.actionOpenModes?.detail ?? "drawer",
  } satisfies Record<"add" | "edit" | "detail", OpenMode>;
  const listPage = buildListPage(modelCode, title, openModes);
  const content = listPage.slots!.content!;
  const table = content.table!;
  const rowActions = table.slots!.rowActions!;
  return [
    {
      ...listPage,
      slots: {
        content: {
          ...content,
          table: {
            ...table,
            slots: {
              toolbar: { add: table.slots!.toolbar!.add! },
              batchActions: table.slots!.batchActions!,
              rowActions: Object.fromEntries(
                Object.entries(rowActions).filter(([key]) => key !== "deactivate"),
              ),
            },
          },
        },
      },
    },
    ...(["add", "edit", "detail"] as const).map((mode) => buildRecordPage(mode)(modelCode, title)),
  ];
}

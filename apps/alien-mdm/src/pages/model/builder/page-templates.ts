import type { OpenMode, XPage } from "@alien-form/engine";

/**
 * 页面模版：由代码写死，供「页面配置」步骤新增页面时选择套用。
 * 模版通过 modelCode/title 生成完整 XPage，用户选择后覆盖 JSON 编辑器内容，可再纯手写调整。
 */
export interface PageTemplate {
  /** 模版唯一标识（下拉选项 value）。 */
  key: string;
  /** 模版展示名。 */
  label: string;
  /** 模版说明。 */
  description?: string;
  /** 依据模型生成一个 XPage。 */
  build: (modelCode: string, title: string) => XPage;
}

const OPEN_MODE: OpenMode = "drawer";

/** 列表页：筛选 + 表格 + 行内新增/编辑/详情/删除按钮。 */
function buildListPage(modelCode: string, title: string): XPage {
  const modelLiteral = JSON.stringify(modelCode);
  return {
    router: "list",
    title,
    layout: { component: "layout", props: { rightTop: "filter", rightBottom: "table" } },
    properties: {
      filter: {
        type: "string",
        component: "filter",
        props: {
          schema: { $ref: "form-schema" },
          filters: "{{ $utils.schemaToFilters }}",
          defaultValue: "{{ $query.keyword }}",
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
          filter: "{{ $values.filter }}",
          loadData: `{{ (params) => $service.records.list({ model: ${modelLiteral}, ...params }) }}`,
          rowActions: ["deactivate", "delete"],
          "action-btns": {
            add: { type: "primary", children: "新增", openMode: OPEN_MODE },
            edit: { type: "link", children: "编辑", openMode: OPEN_MODE },
            detail: { type: "link", children: "详情", openMode: OPEN_MODE },
            batchDelete: {
              children: "批量删除",
              danger: true,
              service: "{{ $service.records.batchDelete }}",
            },
          },
        },
        properties: {
          deactivate: {
            type: "void",
            component: "row-button",
            props: {
              danger: true,
              children: "停用",
              onClick: "{{ ($row) => $utils.message.info('功能未完善') }}",
            },
          },
          delete: {
            type: "void",
            component: "row-button",
            props: {
              danger: true,
              children: "删除",
              confirm: "确认删除这条记录？",
              confirmDescription: "删除后无法恢复。",
              successMessage: "记录已删除",
              refreshAfterSuccess: true,
              onClick: `{{ ($row) => $service.records.delete({ model: ${modelLiteral}, id: $row.id, record: $row }) }}`,
            },
          },
          import: {
            type: "void",
            component: "Button",
            props: {
              children: "导入",
              onClick: "{{ () => $utils.message.info('功能未完善') }}",
            },
          },
          export: {
            type: "void",
            component: "Button",
            props: {
              children: "导出",
              onClick: "{{ () => $utils.message.info('功能未完善') }}",
            },
          },
        },
      },
    },
  };
}

/** 记录表单页（新建/编辑/详情共用一套结构，仅 mode/router 不同）。 */
function buildRecordPage(
  mode: "add" | "edit" | "detail",
): (modelCode: string, title: string) => XPage {
  const prefix = mode === "add" ? "新建" : mode === "edit" ? "编辑" : "详情";
  return (modelCode, title) => ({
    router: mode,
    title: `${prefix}${title}`,
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
            : { submit: `{{ $service.record.${mode === "add" ? "add" : "edit"} }}` }),
        },
      },
    },
  });
}

/** 可选页面模版清单。 */
export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    key: "list",
    label: "列表页",
    description: "筛选 + 表格 + 行内操作按钮",
    build: buildListPage,
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

/** 依 key 取模版。 */
export function findPageTemplate(key: string): PageTemplate | undefined {
  return PAGE_TEMPLATES.find((template) => template.key === key);
}

/** 新建模型默认页面集合：list / add / edit / detail。 */
export function createDefaultPages(modelCode: string, title: string): XPage[] {
  return PAGE_TEMPLATES.map((template) => template.build(modelCode, title));
}

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
          "action-btns": {
            add: { type: "primary", children: "新增", openMode: OPEN_MODE },
            edit: { type: "text", children: "编辑", openMode: OPEN_MODE },
            detail: { type: "text", children: "详情", openMode: OPEN_MODE },
            delete: { type: "text", children: "删除", service: "{{ $service.records.delete }}" },
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
          mode,
          modelCode,
          ...(mode === "add" ? {} : { recordId: "{{ $query.id }}" }),
          schema: { $ref: "form-schema" },
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

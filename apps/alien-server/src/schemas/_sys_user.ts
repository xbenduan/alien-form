import type { DatabaseField, ModelFieldSchema, ModelSchema } from "../schema/types.ts";

export const SYS_ADMIN_ID = "_sys_admin";
export const SYS_ADMIN_USERNAME = "_sys_admin";
export const SYS_ADMIN_NICKNAME = "系统管理员";
export const SYS_ADMIN_DEFAULT_PASSWORD = "alien123456";

/** 物理表定义（存储真相源）。数组顺序即列序/表单序。 */
const fields: DatabaseField[] = [
  { key: "id", title: "ID", type: "text", system: true, filterable: true },
  {
    key: "username",
    title: "账号",
    type: "text",
    nullable: false,
    unique: true,
    index: true,
    filterable: true,
  },
  { key: "passwordHash", title: "密码", type: "text", visible: false },
  {
    key: "nickname",
    title: "昵称",
    type: "text",
    nullable: false,
    index: true,
    filterable: true,
  },
  { key: "remark", title: "备注", type: "text", visible: false },
  { key: "addressInfo", title: "住址信息", type: "json", valueType: "object" },
  { key: "studentRecords", title: "学籍信息", type: "json", valueType: "array" },
  { key: "createBy", title: "创建者", type: "text", default: SYS_ADMIN_ID, filterable: true },
  {
    key: "createdAt",
    title: "创建时间",
    type: "integer",
    valueType: "string",
    system: true,
    filterable: true,
  },
  {
    key: "updatedAt",
    title: "更新时间",
    type: "integer",
    valueType: "string",
    system: true,
    filterable: true,
  },
];

const properties: Record<string, ModelFieldSchema> = {
  id: { type: "string", title: "ID", display: "hidden" },
  username: {
    type: "string",
    title: "账号",
    component: "Input",
    required: true,
    props: { placeholder: "请输入登录账号" },
  },
  passwordHash: { type: "string", title: "密码", component: "Input", display: "none" },
  nickname: {
    type: "string",
    title: "昵称",
    component: "Input",
    required: true,
    props: { placeholder: "请输入昵称" },
  },
  remark: {
    type: "string",
    title: "备注",
    component: "TextArea",
    props: { rows: 3 },
  },
  addressInfo: {
    type: "object",
    title: "住址信息",
    component: "ObjectField",
    props: { gridSpan: 12 },
    properties: {
      nativePlace: {
        type: "string",
        title: "籍贯",
        component: "Input",
        props: { placeholder: "请输入籍贯" },
      },
      currentAddress: {
        type: "string",
        title: "现住址",
        component: "Input",
        props: { placeholder: "请输入现住址" },
      },
      idCardAddress: {
        type: "string",
        title: "身份证住址",
        component: "Input",
        props: { placeholder: "请输入身份证住址", gridSpan: 24 },
      },
    },
  },
  studentRecords: {
    type: "array",
    title: "学籍信息",
    component: "ArrayCards",
    props: { gridSpan: 12 },
    items: {
      type: "object",
      properties: {
        school: {
          type: "string",
          title: "学校",
          component: "Input",
          props: { placeholder: "请输入学校" },
        },
        headTeacher: {
          type: "string",
          title: "联系人（班主任）",
          component: "Input",
          props: { placeholder: "请输入班主任姓名或联系方式" },
        },
        enrollmentDate: {
          type: "string",
          title: "入学时间",
          component: "Input",
          props: { placeholder: "YYYY-MM-DD" },
        },
        graduationDate: {
          type: "string",
          title: "毕业时间",
          component: "Input",
          props: { placeholder: "YYYY-MM-DD" },
        },
      },
    },
  },
  createBy: {
    type: "string",
    title: "创建者",
    component: "Input",
    display: "hidden",
    default: SYS_ADMIN_ID,
  },
  createdAt: { type: "string", title: "创建时间", props: { readOnly: true } },
  updatedAt: { type: "string", title: "更新时间", props: { readOnly: true } },
};

export const sysUserSchema: ModelSchema = {
  meta: {
    name: "_sys_user",
    title: "用户管理",
    subtitle: "System Users",
    description: "系统登录账号管理。",
    group: "system",
    singularLabel: "用户",
    pluralLabel: "用户",
    defaultPageSize: 20,
  },
  fields,
  pages: [
    {
      router: "list",
      title: "用户管理",
      layout: {
        component: "layout",
        props: { rightTop: "filter", rightBottom: "table" },
      },
      properties: {
        filter: {
          type: "string",
          component: "filter",
          props: {
            schema: { $ref: "form-schema" },
            filters: '{{ $utils("schemaToFilters") }}',
            defaultValue: "{{ $query.keyword }}",
          },
        },
        table: {
          type: "void",
          component: "table",
          props: {
            rowKey: "id",
            modelCode: "_sys_user",
            schema: { $ref: "form-schema" },
            columns: '{{ $utils("schemaToColumns") }}',
            filter: "{{ $values.filter }}",
            loadData:
              "{{ (params) => $service(\"records.list\")({ model: '_sys_user', ...params }) }}",
            rowActions: ["deactivate", "delete"],
            "action-btns": {
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
            deactivate: {
              type: "void",
              component: "row-button",
              props: {
                danger: true,
                children: "停用",
                onClick: '{{ ($row) => $utils("message").info("功能未完善") }}',
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
                disabled: "{{ $row.id === '_sys_admin' }}",
                onClick:
                  '{{ ($row) => $service("records.delete")({ model: "_sys_user", id: $row.id, record: $row }) }}',
              },
            },
            import: {
              type: "void",
              component: "Button",
              props: {
                children: "导入",
                onClick: '{{ () => $utils("message").info("功能未完善") }}',
              },
            },
            export: {
              type: "void",
              component: "Button",
              props: {
                children: "导出",
                onClick: '{{ () => $utils("message").info("功能未完善") }}',
              },
            },
          },
        },
      },
    },
    ...(["add", "edit", "detail"] as const).map((mode) => ({
      router: mode,
      title: `${mode === "add" ? "新建" : mode === "edit" ? "编辑" : "详情"}用户`,
      properties: {
        form: {
          type: "void",
          component: "record-form",
          props: {
            ok: mode === "add" ? "确认新增" : mode === "edit" ? "确认修改" : undefined,
            mode,
            modelCode: "_sys_user",
            recordId: mode === "add" ? undefined : "{{ $query.id }}",
            schema: { $ref: "form-schema" },
            submit:
              mode === "add"
                ? '{{ $service("record.add") }}'
                : mode === "edit"
                  ? '{{ $service("record.edit") }}'
                  : undefined,
          },
        },
      },
    })),
  ],
  definitions: {
    "form-schema": {
      type: "object",
      properties,
      group: [
        {
          component: "ObjectField",
          title: "基础信息",
          keys: ["username", "nickname"],
          props: { gridSpan: 12 },
        },
      ],
    },
  },
};

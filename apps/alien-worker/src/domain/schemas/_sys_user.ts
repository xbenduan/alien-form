import type {
  FieldSchema,
  ModelFieldDatabase,
  ModelFieldSchema,
  ModelSchema,
} from "@alien-form/protocol";

export const SYS_ADMIN_ID = "MDM0000000000";
export const SYS_ADMIN_USERNAME = "_sys_admin";
export const SYS_ADMIN_NICKNAME = "系统管理员";
export const SYS_ADMIN_DEFAULT_PASSWORD = "alien123456";

function physical(
  key: string,
  database: ModelFieldDatabase,
  form: FieldSchema,
  options: Pick<ModelFieldSchema, "relation" | "table" | "filter"> = {},
): ModelFieldSchema {
  return {
    id: `_sys_user.${key}`,
    key,
    storage: "physical",
    database,
    form,
    ...options,
  };
}

function virtual(key: string, form: FieldSchema): ModelFieldSchema {
  return {
    id: `_sys_user.${key}`,
    key,
    storage: "virtual",
    form,
  };
}

const fields: ModelFieldSchema[] = [
  physical(
    "id",
    { type: "text", system: true, nullable: false, unique: true, index: true },
    { type: "string", title: "ID", display: "hidden" },
    { table: { title: "ID" } },
  ),
  physical(
    "username",
    { type: "text", nullable: false, unique: true, index: true },
    {
      type: "string",
      title: "账号",
      component: "Input",
      required: true,
      props: { placeholder: "请输入登录账号" },
    },
    { table: { title: "账号" } },
  ),
  physical(
    "passwordHash",
    { type: "text" },
    { type: "string", title: "密码", component: "Input", display: "none" },
    { table: { title: "密码", hidden: true }, filter: { hidden: true } },
  ),
  physical(
    "nickname",
    { type: "text", nullable: false, index: true },
    {
      type: "string",
      title: "昵称",
      component: "Input",
      required: true,
      props: { placeholder: "请输入昵称" },
    },
    { table: { title: "昵称" } },
  ),
  physical(
    "roleId",
    { type: "text", index: true },
    {
      type: "string",
      title: "组织角色",
      component: "RemoteSelect",
      props: {
        model: "rbac_role",
        valueField: "id",
        labelField: "roleName",
        pageSize: 50,
        loadOptions: '{{ $utils.relation($service("records.list")) }}',
      },
    },
    {
      relation: {
        kind: "many-to-one",
        target: "rbac_role",
        valueField: "id",
        labelField: "roleName",
      },
      table: { title: "组织角色" },
    },
  ),
  virtual("remark", {
    type: "string",
    title: "备注",
    component: "TextArea",
    props: { rows: 3 },
  }),
  virtual("addressInfo", {
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
  }),
  virtual("studentRecords", {
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
          component: "DatePicker",
        },
        graduationDate: {
          type: "string",
          title: "毕业时间",
          component: "DatePicker",
        },
      },
    },
  }),
  physical(
    "createBy",
    { type: "text", default: SYS_ADMIN_ID, index: true },
    {
      type: "string",
      title: "创建者",
      component: "Input",
      display: "hidden",
      default: SYS_ADMIN_ID,
    },
    { table: { title: "创建者" } },
  ),
  physical(
    "super",
    { type: "boolean", valueType: "boolean", default: false, index: true },
    {
      type: "boolean",
      title: "超级管理员",
      display: "hidden",
      default: false,
    },
    { table: { title: "超级管理员", hidden: true } },
  ),
  physical(
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
  physical(
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

const recordPages = (["add", "edit", "detail"] as const).map((mode) => ({
  router: mode,
  title: `${mode === "add" ? "新建" : mode === "edit" ? "编辑" : "详情"}用户`,
  groups: [
    {
      component: "ObjectField",
      title: "基础信息",
      keys: ["username", "nickname", "roleId"],
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
        modelCode: "_sys_user",
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

export const sysUserSchema: ModelSchema = {
  name: "_sys_user",
  title: "用户管理",
  version: 0,
  subtitle: "System Users",
  description: "系统登录账号管理。",
  group: "system",
  singularLabel: "用户",
  pluralLabel: "用户",
  defaultPageSize: 20,
  fields,
  pages: [
    {
      router: "list",
      title: "用户管理",
      layout: {
        component: "layout",
      },
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
            modelCode: "_sys_user",
            schema: { $ref: "form-schema" },
            columns: "{{ $utils.schemaToColumns }}",
            filter: "{{ $values.filter }}",
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
                disabled: "{{ $row.super }}",
                onClick:
                  '{{ ($row) => $service("records.delete")({ model: "_sys_user", id: $row.id, record: $row }) }}',
              },
            },
          },
        },
      },
    },
    ...recordPages,
  ],
};

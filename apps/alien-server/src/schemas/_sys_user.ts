import type { ModelSchema } from "../schema/types.ts";

/**
 * 系统用户模型（唯一内置模型，写死）：仅用于登录与账号管理。
 *
 * 字段收口到最小集合：账号 / 密码 / 昵称 / 创建时间 / 更新时间 / 备注 / 创建者。
 *  - username     登录账号（唯一）
 *  - passwordHash 登录凭证（pbkdf2 哈希，前后端脱敏，不下发）
 *  - nickname     昵称
 *  - remark       备注（改密等操作说明）
 *  - createBy     创建者（缺省或未指定统一填系统管理员 _sys_admin）
 *  - createdAt / updatedAt 由仓储统一管理（系统列，不建业务列）
 *
 * 每个部署启动时都会写入一个默认系统管理员（账号 _sys_admin，密码 alien123456）。
 */

/** 默认系统管理员账号常量（供后端 bootstrap 与前端登录默认值复用）。 */
export const SYS_ADMIN_ID = "_sys_admin";
export const SYS_ADMIN_USERNAME = "_sys_admin";
export const SYS_ADMIN_NICKNAME = "系统管理员";
export const SYS_ADMIN_DEFAULT_PASSWORD = "alien123456";

/** 记录型页面的默认 service 语义映射（与前端 DEFAULT_RECORD_SERVICES 同构）。 */
const RECORD_SERVICES = {
  "query.list": "records.list",
  "query.filter": "records.list",
  "query.detail": "records.get",
  "create.record": "records.create",
  "update.record": "records.update",
  "delete.record": "records.delete",
  "delete.recordMany": "records.deleteMany",
};

/** 系统用户页布局：过滤区 + 表格 + 增删改，无左侧组织树。 */
const sysUserLayout = {
  component: "layout",
  props: { services: RECORD_SERVICES },
  slots: {
    rightTop: { component: "filter", props: { scope: "main" } },
    rightBottom: {
      component: "table",
      props: { scope: "main" },
      slots: {
        toolbarLeft: { component: "action-batch-delete" },
        toolbarRight: {
          component: "space",
          props: { size: "small" },
          children: [{ component: "action-refresh" }, { component: "action-add" }],
        },
      },
      children: [
        {
          component: "space",
          props: { size: 4 },
          children: [{ component: "detail" }, { component: "edit" }, { component: "delete" }],
        },
      ],
    },
  },
} as const;

export const sysUserSchema: ModelSchema = {
  type: "object",
  "x-layout": sysUserLayout,
  title: "用户管理",
  description: "系统登录账号管理。",
  meta: {
    name: "_sys_user",
    title: "用户管理",
    subtitle: "System Users",
    description: "系统登录账号管理。",
    group: "system",
    singularLabel: "用户",
    pluralLabel: "用户",
    defaultPageSize: 10,
    filterCount: 3,
    openMode: { add: "drawer", edit: "page", detail: "modal" },
  },
  properties: {
    username: {
      type: "string",
      title: "账号",
      component: "Input",
      required: true,
      order: 10,
      props: { placeholder: "请输入登录账号" },
      "x-table": { width: 160 },
      "x-database": { type: "text", unique: true, index: true, filterable: true },
    },
    passwordHash: {
      type: "string",
      title: "密码",
      component: "Input",
      display: "none",
      order: 20,
      "x-table": { visible: false },
      "x-database": { type: "text" },
    },
    nickname: {
      type: "string",
      title: "昵称",
      component: "Input",
      required: true,
      order: 30,
      props: { placeholder: "请输入昵称" },
      "x-table": { width: 160 },
      "x-database": { type: "text", index: true, filterable: true },
    },
    remark: {
      type: "string",
      title: "备注",
      component: "Textarea",
      order: 40,
      props: { rows: 3, placeholder: "请输入备注（如修改密码说明）" },
      "x-table": { visible: false },
      "x-database": { type: "text" },
    },
    createBy: {
      type: "string",
      title: "创建者",
      component: "Input",
      display: "hidden",
      order: 50,
      default: SYS_ADMIN_ID,
      props: { placeholder: "默认系统管理员" },
      "x-table": { visible: true, width: 160 },
      "x-database": { type: "text", default: SYS_ADMIN_ID, filterable: true },
    },
    id: {
      type: "string",
      title: "ID",
      display: "hidden",
      order: 900,
      "x-table": { visible: true, width: 160 },
      "x-database": { type: "text", filterable: true },
    },
    createdAt: {
      type: "string",
      title: "创建时间",
      component: "DateInput",
      display: "hidden",
      order: 910,
      "x-table": { visible: true, width: 170 },
      "x-database": { type: "text", filterable: true },
    },
    updatedAt: {
      type: "string",
      title: "更新时间",
      component: "DateInput",
      display: "hidden",
      order: 920,
      "x-table": { visible: true, width: 170 },
      "x-database": { type: "text", filterable: true },
    },
  },
  group: [
    {
      component: "GridLayout",
      keys: ["username", "nickname"],
      props: { gridSpan: 12, title: "账号信息" },
    },
  ],
};

import type { ModelSchema } from "../schema/types.ts";
import { schoolDepartmentLayout } from "./layout.ts";

/**
 * 部门/组织模型：把「组织结构」从 school-user 的自连接人链里拆出来，独立成树。
 *
 * 设计要点：
 *  - 层级链：学校根（不展示）→ 学部 → 年级 → 班级；学部下还可挂独立于学生结构的
 *    党团组织（党支部/团支部/团委/学生会）。
 *  - 单向隶属：**部门只维护自己的层级（parentCode）与创建者/班主任，不持有成员集。**
 *    「谁属于这个部门」由 school-user.deptCode 反向指向，部门表不关心也不冗余存成员，
 *    避免双向维护成本，也让组织树能通过 user.deptCode IN [...] 直接过滤成员（多对多不可过滤）。
 *  - parentCode 存上级部门的 deptCode（自连接的连接键），是普通文本列，**不是外键**。
 *    父级选择走 TreeSelect 的 props 自取，避免把业务编码误当作外键 id。
 *  - homeroomTeacherId / creatorId 指向 school-user（many-to-one 标量外键）：
 *    班主任只对「班级」有意义；creatorId 是部门创建者，语义上必须是老师
 *    （由 seed 数据保证，前端 Select 也只从教师范围取值）。
 */
export const schoolDepartmentSchema: ModelSchema = {
  type: "object",
  "x-layout": schoolDepartmentLayout,
  title: "部门管理",
  description: "学校组织架构：学部 / 年级 / 班级，以及党团等非班级组织。",
  meta: {
    name: "school-department",
    title: "部门管理",
    subtitle: "School Departments",
    description: "学校组织架构：学部 / 年级 / 班级，以及党团等非班级组织。",
    group: "system",
    singularLabel: "部门",
    pluralLabel: "部门",
    defaultPageSize: 10,
    filterCount: 4,
    openMode: { add: "drawer", edit: "drawer", detail: "modal" },
  },
  properties: {
    deptCode: {
      type: "string",
      title: "部门编码",
      component: "Input",
      required: true,
      order: 10,
      props: { placeholder: "请输入部门编码，如 FAC-01 / CLASS-01-01-01" },
      "x-table": { width: 160 },
      "x-database": { type: "text", unique: true, index: true, filterable: true },
    },
    deptName: {
      type: "string",
      title: "部门名称",
      component: "Input",
      required: true,
      order: 20,
      props: { placeholder: "请输入部门名称" },
      "x-table": { width: 180 },
      "x-database": { type: "text", index: true, filterable: true },
    },
    deptType: {
      type: "string",
      title: "部门类型",
      component: "Select",
      required: true,
      order: 30,
      dataSource: [
        { label: "学部", value: "faculty" },
        { label: "年级", value: "grade" },
        { label: "班级", value: "class" },
        { label: "党团组织", value: "party-league" },
      ],
      props: { placeholder: "请选择部门类型" },
      "x-table": { width: 120 },
      "x-database": { type: "text", index: true, filterable: true },
    },
    parentCode: {
      type: "string",
      title: "上级部门",
      component: "TreeSelect",
      order: 40,
      props: {
        placeholder: "请选择上级部门（学校根节点不展示，可留空建学部）",
        // TreeSelect 自取：从本模型按 parentCode 拼树，选中节点回填其 deptCode。
        treeModel: "school-department",
        treeIdField: "deptCode",
        treeLabelField: "deptName",
        treeParentField: "parentCode",
      },
      "x-table": { width: 160 },
      // 关键：普通文本列，不声明 relation，避免把业务编码误当作外键。
      "x-database": { type: "text", index: true, filterable: true, nullable: true },
    },
    homeroomTeacherId: {
      type: "string",
      title: "班主任",
      component: "Select",
      order: 50,
      props: {
        placeholder: "仅班级需要，请选择班主任",
        service: {
          model: "school-user",
          valueKey: "id",
          labelKey: "displayName",
          remoteSearch: false,
        },
      },
      "x-table": { width: 120 },
      "x-database": { relation: "many-to-one", target: "school-user", nullable: true },
    },
    creatorId: {
      type: "string",
      title: "创建者",
      component: "Select",
      required: true,
      order: 60,
      props: {
        placeholder: "请选择创建者（必须为教师）",
        service: {
          model: "school-user",
          valueKey: "id",
          labelKey: "displayName",
          remoteSearch: false,
        },
      },
      "x-table": { width: 120 },
      "x-database": { relation: "many-to-one", target: "school-user", index: true },
    },
    sortOrder: {
      type: "number",
      title: "排序号",
      component: "NumberInput",
      order: 80,
      default: 0,
      props: { placeholder: "请输入排序号", min: 0 },
      "x-table": { width: 90 },
      "x-database": { type: "real", default: 0, sortable: true },
    },
    enabled: {
      type: "boolean",
      title: "是否启用",
      component: "Switch",
      order: 90,
      default: true,
      "x-table": { width: 100 },
      "x-database": { type: "boolean", default: true, filterable: true },
    },
    remark: {
      type: "string",
      title: "备注",
      component: "Textarea",
      order: 100,
      props: { rows: 3, placeholder: "请输入备注" },
      "x-table": { visible: false },
      "x-database": { type: "text" },
    },
    id: { type: "string", title: "ID", display: "none", order: 900, "x-table": { visible: false } },
    createdAt: {
      type: "string",
      title: "创建时间",
      display: "none",
      order: 910,
      "x-table": { visible: false },
    },
    updatedAt: {
      type: "string",
      title: "更新时间",
      display: "none",
      order: 920,
      "x-table": { visible: false },
    },
  },
  group: [
    {
      component: "GridLayout",
      keys: ["deptCode", "deptName", "deptType", "parentCode", "sortOrder", "enabled"],
      props: { gridSpan: 12, title: "部门信息" },
    },
    {
      component: "GridLayout",
      keys: ["homeroomTeacherId", "creatorId", "remark"],
      props: { gridSpan: 12, title: "负责人" },
    },
  ],
};

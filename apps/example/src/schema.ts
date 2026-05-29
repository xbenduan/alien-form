import type { IFormSchema } from "@alien-form/react";

/**
 * 示例 Schema：员工信息表单
 * 覆盖：基础字段、联动、数组、校验、dataSource 动态加载
 */
export const employeeSchema: IFormSchema = {
  type: "object",
  properties: {
    // ─── 基本信息 ──────────────────────────────────────────────────────
    name: {
      type: "string",
      title: "姓名",
      component: "Input",
      decorator: "FormItem",
      required: true,
      validate: { minLength: 2, maxLength: 20, message: "姓名长度 2-20 字符" },
      props: { placeholder: "请输入姓名" },
      order: 10,
    },
    email: {
      type: "string",
      title: "邮箱",
      component: "Input",
      decorator: "FormItem",
      required: true,
      validate: { format: "email" },
      props: { placeholder: "请输入邮箱" },
      order: 20,
    },
    phone: {
      type: "string",
      title: "手机号",
      component: "Input",
      decorator: "FormItem",
      validate: { format: "phone" },
      props: { placeholder: "请输入手机号" },
      order: 30,
    },
    department: {
      type: "string",
      title: "部门",
      component: "Select",
      decorator: "FormItem",
      required: true,
      dataSource: [
        { label: "工程", value: "engineering" },
        { label: "设计", value: "design" },
        { label: "产品", value: "product" },
        { label: "市场", value: "marketing" },
        { label: "人力", value: "hr" },
      ],
      props: { placeholder: "请选择部门" },
      order: 40,
    },

    // ─── 联动：部门 → 职级选项 ──────────────────────────────────────────
    level: {
      type: "string",
      title: "职级",
      component: "Select",
      decorator: "FormItem",
      props: { placeholder: "请先选择部门" },
      order: 50,
      "x-reaction": {
        "dataSource": {
          "type": "computed",
          "dependencies": ["department"],
          "handler": "fetchLevels"
        },
        "disabled": {
          "type": "expression",
          "dependencies": ["department"],
          "expression": "!$deps[0]"
        }
      },
    },

    // ─── 联动：是否全职 → 显示/隐藏入职日期 ─────────────────────────────
    isFullTime: {
      type: "boolean",
      title: "全职",
      component: "Switch",
      decorator: "FormItem",
      default: true,
      order: 60,
    },
    joinDate: {
      type: "string",
      title: "入职日期",
      component: "DateInput",
      decorator: "FormItem",
      order: 70,
      "x-reaction": {
        "display": {
          "type": "expression",
          "dependencies": ["isFullTime"],
          "expression": "$deps[0] ? 'visible' : 'hidden'"
        }
      },
    },

    // ─── 评分 ─────────────────────────────────────────────────────────
    rating: {
      type: "number",
      title: "绩效评分",
      component: "Rate",
      decorator: "FormItem",
      order: 75,
    },

    // ─── 备注 ─────────────────────────────────────────────────────────
    remark: {
      type: "string",
      title: "备注",
      component: "Textarea",
      decorator: "FormItem",
      props: { placeholder: "可选备注", rows: 3 },
      order: 80,
    },

    // ─── 数组字段：项目经历 ───────────────────────────────────────────
    projects: {
      type: "array",
      title: "项目经历",
      description: "添加过往项目经历",
      component: "ArrayCards",
      decorator: "FormItem",
      props: { addText: "+ 添加项目" },
      order: 90,
      items: {
        type: "object",
        properties: {
          projectName: {
            type: "string",
            title: "项目名称",
            component: "Input",
            decorator: "FormItem",
            required: true,
            props: { placeholder: "项目名称" },
            order: 10,
          },
          role: {
            type: "string",
            title: "角色",
            component: "Select",
            decorator: "FormItem",
            dataSource: [
              { label: "负责人", value: "lead" },
              { label: "核心开发", value: "core" },
              { label: "参与者", value: "participant" },
            ],
            order: 20,
          },
          startDate: {
            type: "string",
            title: "开始时间",
            component: "DateInput",
            decorator: "FormItem",
            order: 30,
          },
          endDate: {
            type: "string",
            title: "结束时间",
            component: "DateInput",
            decorator: "FormItem",
            order: 40,
          },
          description: {
            type: "string",
            title: "项目描述",
            component: "Textarea",
            decorator: "FormItem",
            props: { rows: 2, placeholder: "简要描述你的贡献" },
            order: 50,
          },
        },
      },
    },
  },
};

/** 编辑模式的模拟数据 */
export const mockEmployeeData = {
  name: "张三",
  email: "zhangsan@example.com",
  phone: "13800138000",
  department: "engineering",
  level: "senior",
  isFullTime: true,
  joinDate: "2023-06-01",
  rating: 4,
  remark: "表现优秀",
  projects: [
    {
      projectName: "Alien Form 重构",
      role: "lead",
      startDate: "2024-01-01",
      endDate: "2024-06-01",
      description: "主导 alien-form 核心架构从 version-bump 到 signal-per-property 的重构",
    },
    {
      projectName: "设计系统",
      role: "core",
      startDate: "2023-06-01",
      endDate: "2023-12-31",
      description: "参与公司级设计系统组件库的开发",
    },
  ],
};

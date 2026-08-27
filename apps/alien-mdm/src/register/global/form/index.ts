import { lazy } from "react";
import type { Runtime } from "@alien-form/engine";
import { FormItem, FilterItem } from "@components/decorators";
import {
  arrayProjection,
  base,
  objectProjection,
  registerFieldComponent,
  selectProjection,
} from "@utils/register-field-component";

export function registerFormComponents(runtime: Runtime): void {
  registerFieldComponent(
    runtime,
    "Input",
    lazy(() => import("./input")),
    "string",
    "单行文本",
    "leaf",
    "适用于姓名、标题等短文本。",
    base("string", "单行文本", "Input", { placeholder: "请输入" }, 100),
  );
  registerFieldComponent(
    runtime,
    "Textarea",
    lazy(() => import("./textarea")),
    "string",
    "多行文本",
    "leaf",
    "适用于备注、简介等长文本。",
    base("string", "多行文本", "Textarea", { placeholder: "请输入", rows: 4 }, 160),
  );
  registerFieldComponent(
    runtime,
    "NumberInput",
    lazy(() => import("./number-input")),
    "number",
    "数字",
    "leaf",
    "适用于金额、数量、年龄等数值。",
    base("number", "数字", "NumberInput", { placeholder: "请输入" }, 100),
  );
  registerFieldComponent(
    runtime,
    "Select",
    lazy(() => import("./select")),
    "string",
    "下拉选择",
    "leaf",
    "支持静态选项和通过 props.service 声明的远程选项。",
    {
      ...base("string", "下拉单选", "Select", { placeholder: "请选择" }, 100),
      dataSource: [
        { label: "选项 1", value: "1" },
        { label: "选项 2", value: "2" },
      ],
    },
    { projection: selectProjection },
  );
  registerFieldComponent(
    runtime,
    "DateInput",
    lazy(() => import("./date-input")),
    "string",
    "日期",
    "leaf",
    "值以 YYYY-MM-DD 字符串存储。",
    base("string", "日期", "DateInput", { placeholder: "请选择" }, 120),
  );
  registerFieldComponent(
    runtime,
    "TreeSelect",
    lazy(() => import("./tree-select")),
    "string",
    "树形单选",
    "leaf",
    "从模型的父子关系构建树形选项。",
    base(
      "string",
      "树形单选",
      "TreeSelect",
      {
        placeholder: "请选择",
        treeModel: "",
        treeIdField: "id",
        treeLabelField: "id",
        treeParentField: "parentCode",
      },
      160,
    ),
  );
  registerFieldComponent(
    runtime,
    "ObjectField",
    lazy(() => import("./object-field")),
    "object",
    "对象分组",
    "complex",
    "管理嵌套对象子字段。",
    {
      ...base("object", "对象分组", "ObjectField", { columns: 2, gutter: 16 }, 160),
      properties: {},
    },
    { children: "properties", projection: objectProjection },
  );
  registerFieldComponent(
    runtime,
    "ArrayCards",
    lazy(() => import("./array-cards")),
    "array",
    "对象数组",
    "complex",
    "以卡片列表管理同构对象数组。",
    {
      ...base("array", "对象数组", "ArrayCards", { columns: 2, gutter: 16 }, 160),
      items: { type: "object", properties: {} },
    },
    { children: "items", projection: arrayProjection },
  );
  registerFieldComponent(
    runtime,
    "GridLayout",
    lazy(() => import("./grid-layout")),
    "object",
    "栅格布局",
    "layout",
    "不占数据路径的表单栅格容器。",
    {
      type: "void",
      title: "栅格布局",
      component: "GridLayout",
      props: { columns: 2, gutter: 16 },
      display: "visible",
      properties: {},
    },
  );

  runtime.formDecorator({
    code: "FormItem",
    title: "表单项",
    description: "显示字段标题、描述和校验状态。",
    component: FormItem,
    authoring: {},
  });
  runtime.formDecorator({
    code: "FilterItem",
    title: "筛选项",
    description: "用于列表筛选区域的紧凑字段容器。",
    component: FilterItem,
    authoring: {},
  });
}

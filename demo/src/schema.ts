import type { IFormSchema } from "@alien-form/react";

/**
 * 商品表单 Schema
 * 分为两个 void 布局区域：基础信息 + 规格信息
 * skus 通过 x-reaction 联动 specs 自动生成笛卡尔积
 */
export const goodsFormSchema: IFormSchema = {
  type: "object",
  properties: {
    // ═══════════════════════════════════════════════════════════════════════════
    // 基础信息区域
    // ═══════════════════════════════════════════════════════════════════════════
    basicInfo: {
      type: "void",
      title: "基础信息",
      component: "SectionCard",
      order: 10,
      properties: {
        name: {
          type: "string",
          title: "商品名称",
          component: "Input",
          decorator: "FormItem",
          required: true,
          validate: { minLength: 2, maxLength: 100 },
          props: { placeholder: "请输入商品名称" },
          order: 10,
        },
        category: {
          type: "string",
          title: "商品分类",
          component: "Select",
          decorator: "FormItem",
          required: true,
          dataSource: [
            { label: "数码电子", value: "electronics" },
            { label: "服饰鞋包", value: "clothing" },
            { label: "家居生活", value: "home" },
            { label: "食品饮料", value: "food" },
            { label: "美妆个护", value: "beauty" },
          ],
          props: { placeholder: "请选择分类" },
          order: 20,
        },
        price: {
          type: "number",
          title: "基础售价（元）",
          component: "NumberInput",
          decorator: "FormItem",
          required: true,
          validate: { minimum: 0.01, message: "售价必须大于 0" },
          props: { placeholder: "请输入基础售价", min: 0 },
          order: 30,
        },
        stock: {
          type: "number",
          title: "总库存",
          component: "NumberInput",
          decorator: "FormItem",
          required: true,
          validate: { minimum: 0, message: "库存不能为负" },
          props: { placeholder: "请输入库存数量", min: 0 },
          order: 40,
        },
        status: {
          type: "string",
          title: "商品状态",
          component: "Select",
          decorator: "FormItem",
          required: true,
          dataSource: [
            { label: "生效中", value: "active" },
            { label: "审核中", value: "reviewing" },
            { label: "草稿", value: "draft" },
            { label: "已下架", value: "offline" },
          ],
          default: "draft",
          props: { placeholder: "请选择状态" },
          order: 50,
        },
        cover: {
          type: "string",
          title: "封面图",
          component: "Input",
          decorator: "FormItem",
          props: { placeholder: "请输入图片 URL" },
          order: 60,
        },
        description: {
          type: "string",
          title: "商品描述",
          component: "Textarea",
          decorator: "FormItem",
          props: { placeholder: "请输入商品描述", rows: 4 },
          order: 70,
        },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 规格信息区域
    // ═══════════════════════════════════════════════════════════════════════════
    specInfo: {
      type: "void",
      title: "规格信息",
      component: "SectionCard",
      order: 20,
      properties: {
        specs: {
          type: "array",
          title: "规格定义",
          description: "定义规格维度及其可选值，SKU 表将自动生成笛卡尔积",
          component: "ArrayCards",
          decorator: "FormItem",
          props: { addText: "+ 添加规格" },
          order: 10,
          items: {
            type: "object",
            properties: {
              name: {
                type: "string",
                title: "规格名",
                component: "Input",
                decorator: "FormItem",
                required: true,
                props: { placeholder: "如：颜色、尺码、存储" },
                order: 10,
              },
              values: {
                type: "array",
                title: "规格值",
                component: "TagsInput",
                decorator: "FormItem",
                required: true,
                props: { placeholder: "输入后按 Enter 添加" },
                order: 20,
              },
            },
          },
        },
        skus: {
          type: "array",
          title: "SKU 配置",
          description: "规格笛卡尔积生成的销售单元，可单独设置价格、库存和售卖状态",
          component: "SkuTable",
          decorator: "FormItem",
          order: 20,
          "x-reaction": {
            value: {
              type: "computed",
              dependencies: { specs: "specs" },
              handler: "generateSkus",
            },
          },
          items: {
            type: "object",
            properties: {
              specAttrs: { type: "object", order: 10 },
              price: { type: "number", title: "售价", order: 20 },
              stock: { type: "number", title: "库存", order: 30 },
              status: { type: "number", title: "售卖状态", order: 40 },
            },
          },
        },
      },
    },
  },
};

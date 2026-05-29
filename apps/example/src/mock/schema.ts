import { IFormSchema } from "@alien-form/react";
import { sleep } from ".";

export const getSchema = async (): Promise<IFormSchema> => {
  await sleep(300);
  return {
    type: "object",
    properties: {
      // ===== 基本信息 =====
      basicInfo: {
        type: "void",
        title: "基本信息",
        component: "Section",
        order: 1,
        properties: {
          name: {
            type: "string",
            title: "商品名称",
            required: true,
            component: "Input",
            decorator: "FormItem",
            props: { placeholder: "请输入商品名称，建议不超过 40 字" },
            validate: { maxLength: 40 },
            order: 10,
          },
          category: {
            type: "string",
            title: "商品类目",
            required: true,
            component: "Select",
            decorator: "FormItem",
            props: { placeholder: "请选择类目" },
            "x-reaction": {
              dataSource: {
                type: "computed",
                handler: "fetchCategories",
              },
            },
            order: 20,
          },
          subCategory: {
            type: "string",
            title: "子类目",
            component: "Select",
            decorator: "FormItem",
            props: { placeholder: "请先选择类目" },
            "x-reaction": {
              dataSource: {
                type: "computed",
                dependencies: { category: "category" },
                handler: "fetchSubCategories",
              },
              disabled: {
                type: "expression",
                dependencies: { category: "category" },
                expression: "!$deps.category",
              },
            },
            dataSourcePolicy: "clear",
            order: 30,
          },
          description: {
            type: "string",
            title: "商品描述",
            component: "Textarea",
            decorator: "FormItem",
            props: { placeholder: "请输入商品描述", rows: 3 },
            validate: { maxLength: 200 },
            order: 40,
          },
          status: {
            type: "string",
            title: "上架状态",
            component: "Select",
            decorator: "FormItem",
            default: "on",
            dataSource: [
              { label: "上架", value: "on" },
              { label: "下架", value: "off" },
            ],
            order: 50,
          },
        },
      },

      // ===== 规格与库存 =====
      specSection: {
        type: "void",
        title: "规格与库存",
        component: "Section",
        order: 2,
        properties: {
          specs: {
            type: "array",
            title: "规格定义",
            description: "定义规格维度与可选值，系统自动生成 SKU 组合。",
            component: "Specs",
            decorator: "FormItem",
            props: { addText: "+ 添加规格维度" },
            order: 10,
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  title: "规格名",
                  required: true,
                  component: "Input",
                  props: { placeholder: "例如：颜色、尺码" },
                  order: 10,
                },
                values: {
                  type: "array",
                  title: "规格值",
                  required: true,
                  component: "SpecValues",
                  order: 20,
                  items: {
                    type: "object",
                    properties: {
                      label: {
                        type: "string",
                        title: "规格值",
                        required: true,
                        component: "Input",
                        props: { placeholder: "规格值" },
                        order: 10,
                      },
                    },
                  },
                },
              },
            },
          },
          skus: {
            type: "array",
            title: "SKU 配置",
            description: "根据规格笛卡尔积生成，每行可设置价格与库存。",
            component: "SkuTable",
            decorator: "FormItem",
            props: {
              helperText: "规格变化后，已有 SKU 行会按 skuKey 保留价格和库存。",
            },
            order: 20,
            items: {
              type: "object",
              properties: {
                skuKey: {
                  type: "string",
                  title: "SKU Key",
                  display: "none",
                  order: 5,
                },
                specSummary: {
                  type: "string",
                  title: "销售规格",
                  component: "Input",
                  props: { disabled: true },
                  order: 10,
                },
                price: {
                  type: "number",
                  title: "售价（¥）",
                  component: "Input",
                  required: true,
                  props: { type: "number", placeholder: "0.00" },
                  validate: { minimum: 0 },
                  order: 20,
                },
                originalPrice: {
                  type: "number",
                  title: "原价（¥）",
                  component: "Input",
                  props: { type: "number", placeholder: "0.00" },
                  validate: { minimum: 0 },
                  order: 25,
                },
                stock: {
                  type: "number",
                  title: "库存",
                  component: "Input",
                  required: true,
                  props: { type: "number", placeholder: "0" },
                  validate: { minimum: 0 },
                  order: 30,
                },
                enabled: {
                  type: "boolean",
                  title: "启售",
                  component: "Switch",
                  default: true,
                  order: 40,
                },
              },
            },
          },
        },
      },
    },
  };
};

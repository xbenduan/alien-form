import { IFormSchema } from "@alien-form/react";
import { sleep } from ".";

export const getSchema = async (): Promise<IFormSchema> => {
  await sleep(500);
  return {
    type: "object",
    properties: {
      intro: {
        type: "string",
        title: "设计说明",
        default:
          "这个示例刻意没有把规格 + 销售矩阵做成一个 value(object)+onChange(object) 的超级组件。上半部分 specs 是规格定义，下半部分 skus 是派生出来的真实数组字段。",
        component: "Textarea",
        decorator: "FormItem",
        props: {
          rows: 4,
        },
        order: 5,
      },
      specs: {
        type: "array",
        title: "规格定义",
        description: "先定义规格维度与可选值，系统会自动根据规格值做笛卡尔积生成 SKU 组合。",
        component: "Specs",
        decorator: "FormItem",
        props: {
          addText: "+ 添加规格维度",
        },
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
                    props: { className: "h-7 text-xs", placeholder: "规格值" },
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
        title: "规格配置",
        description:
          "系统根据规格做笛卡尔积生成 SKU 行，每行可编辑售价、库存等销售配置。",
        component: "SkuTable",
        decorator: "FormItem",
        props: {
          helperText:
            "规格变化后，已有 SKU 行会按 skuKey 尽量保留价格和库存。",
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
              title: "售价",
              component: "Input",
              required: true,
              props: { type: "number", placeholder: "请输入售价" },
              order: 20,
            },
            stock: {
              type: "number",
              title: "库存",
              component: "Input",
              required: true,
              props: { type: "number", placeholder: "请输入库存" },
              order: 30,
            },
            enabled: {
              type: "boolean",
              title: "启售",
              component: "Switch",
              order: 40,
            },
          },
        },
      },
    },
  };
};

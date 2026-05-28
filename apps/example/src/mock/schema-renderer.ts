import type { FormConfig } from "@alien-form/react";
import { sleep } from ".";

type SelectOption = {
  label: string;
  value: string;
};

const categoryData: Record<string, SelectOption[]> = {
  tech: [
    { label: "前端", value: "frontend" },
    { label: "后端", value: "backend" },
    { label: "运维", value: "devops" },
    { label: "AI/机器学习", value: "ai" },
  ],
  design: [
    { label: "UI 设计", value: "ui" },
    { label: "用户研究", value: "ux" },
    { label: "品牌设计", value: "brand" },
  ],
  business: [
    { label: "市场", value: "marketing" },
    { label: "销售", value: "sales" },
    { label: "战略", value: "strategy" },
  ],
};

export const schemaRendererHandlers: FormConfig["handlers"] = {
  fetchCountries: async () => {
    await sleep(500);
    return [
      { label: "中国", value: "cn" },
      { label: "新加坡", value: "sg" },
      { label: "日本", value: "jp" },
      { label: "美国", value: "us" },
      { label: "英国", value: "uk" },
      { label: "德国", value: "de" },
    ];
  },
  fetchCategories: async () => {
    await sleep(500);
    return [
      { label: "技术", value: "tech" },
      { label: "设计", value: "design" },
      { label: "业务", value: "business" },
    ];
  },
  fetchSubCategories: async ({ deps }) => {
    await sleep(400);
    const category = deps.category;
    if (!category) return [];
    return categoryData[category] || [];
  },
  normalizeCode: ({ value }) =>
    String(value ?? "")
      .trim()
      .toUpperCase(),
  checkConfirmCode: async ({ value }) => {
    await sleep(300);
    return String(value ?? "")
      .trim()
      .toUpperCase() === "OK"
      ? []
      : [{ message: "确认码必须是 OK", type: "x-validate" }];
  },
};

import type { FormConfig } from "@alien-form/react";
import { sleep } from ".";

export const schemaRendererHandlers: FormConfig["handlers"] = {
  fetchCategories: async () => {
    await sleep(300);
    return [
      { label: "数码电子", value: "electronics" },
      { label: "服饰鞋包", value: "clothing" },
      { label: "食品饮料", value: "food" },
      { label: "家居百货", value: "home" },
      { label: "美妆个护", value: "beauty" },
    ];
  },
  fetchSubCategories: async ({ deps }) => {
    await sleep(200);
    const category = deps.category;
    if (!category) return [];
    const map: Record<string, { label: string; value: string }[]> = {
      electronics: [
        { label: "手机", value: "phone" },
        { label: "平板电脑", value: "tablet" },
        { label: "笔记本电脑", value: "laptop" },
        { label: "耳机", value: "headphone" },
        { label: "智能手表", value: "watch" },
      ],
      clothing: [
        { label: "上衣", value: "tops" },
        { label: "裤装", value: "pants" },
        { label: "裙装", value: "dress" },
        { label: "鞋靴", value: "shoes" },
        { label: "箱包", value: "bags" },
      ],
      food: [
        { label: "零食", value: "snack" },
        { label: "饮品", value: "beverage" },
        { label: "生鲜", value: "fresh" },
        { label: "粮油调味", value: "seasoning" },
      ],
      home: [
        { label: "家具", value: "furniture" },
        { label: "家纺", value: "textile" },
        { label: "厨具", value: "kitchen" },
        { label: "清洁用品", value: "cleaning" },
      ],
      beauty: [
        { label: "护肤", value: "skincare" },
        { label: "彩妆", value: "makeup" },
        { label: "香水", value: "perfume" },
        { label: "个人护理", value: "personal-care" },
      ],
    };
    return map[category] || [];
  },
};

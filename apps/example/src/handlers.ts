import type { FormConfig } from "@alien-form/react";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const levelMap: Record<string, { label: string; value: string }[]> = {
  engineering: [
    { label: "初级工程师", value: "junior" },
    { label: "中级工程师", value: "mid" },
    { label: "高级工程师", value: "senior" },
    { label: "专家", value: "expert" },
    { label: "架构师", value: "architect" },
  ],
  design: [
    { label: "初级设计师", value: "junior" },
    { label: "中级设计师", value: "mid" },
    { label: "高级设计师", value: "senior" },
    { label: "设计专家", value: "expert" },
  ],
  product: [
    { label: "助理 PM", value: "junior" },
    { label: "产品经理", value: "mid" },
    { label: "高级 PM", value: "senior" },
    { label: "产品总监", value: "director" },
  ],
  marketing: [
    { label: "市场专员", value: "junior" },
    { label: "市场经理", value: "mid" },
    { label: "市场总监", value: "director" },
  ],
  hr: [
    { label: "HR 专员", value: "junior" },
    { label: "HRBP", value: "mid" },
    { label: "HR 总监", value: "director" },
  ],
};

export const handlers: FormConfig["handlers"] = {
  fetchLevels: async ({ deps }) => {
    await sleep(300);
    const dept = Object.values(deps)[0] as string;
    if (!dept) return [];
    return levelMap[dept] || [];
  },
};

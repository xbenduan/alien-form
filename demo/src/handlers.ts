import type { FormConfig } from "@alien-form/react";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const levelMap: Record<string, { label: string; value: string }[]> = {
  engineering: [
    { label: "初级工程师", value: "junior" },
    { label: "中级工程师", value: "mid" },
    { label: "高级工程师", value: "senior" },
    { label: "架构师", value: "architect" },
  ],
  design: [
    { label: "初级设计师", value: "junior" },
    { label: "高级设计师", value: "senior" },
    { label: "设计专家", value: "expert" },
  ],
  product: [
    { label: "产品经理", value: "pm" },
    { label: "高级 PM", value: "senior-pm" },
    { label: "产品总监", value: "director" },
  ],
  marketing: [
    { label: "市场专员", value: "specialist" },
    { label: "市场经理", value: "manager" },
  ],
};

export const handlers: FormConfig["handlers"] = {
  fetchLevels: async ({ deps }) => {
    await sleep(300);
    const dept = Object.values(deps)[0] as string;
    return dept ? (levelMap[dept] || []) : [];
  },
};

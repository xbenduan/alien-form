import type { Runtime } from "@alien-form/engine";
import { registerUIComponents } from "./ui";
import { registerFormComponents } from "./form";

const globalConstant = {
  gender: [
    { label: "男", value: "male" },
    { label: "女", value: "female" },
    { label: "未知", value: "unknown" },
  ],
  grades: [
    { label: "一年级", value: "grade-1" },
    { label: "二年级", value: "grade-2" },
    { label: "三年级", value: "grade-3" },
    { label: "四年级", value: "grade-4" },
    { label: "五年级", value: "grade-5" },
    { label: "六年级", value: "grade-6" },
  ],
};

export function registerGlobal(runtime: Runtime): void {
  registerUIComponents(runtime);
  registerFormComponents(runtime);
  for (const [key, value] of Object.entries(globalConstant)) {
    runtime.constant(key, value);
  }
}

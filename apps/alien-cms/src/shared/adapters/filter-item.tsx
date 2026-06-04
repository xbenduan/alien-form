import type React from "react";
import { defineAdapter } from "@alien-form/cms";

function FilterItem({ children }: { children?: React.ReactNode }) {
  return <div className="filter-form-item">{children}</div>;
}

export default defineAdapter(FilterItem, {
  key: "FilterItem",
  label: "FilterItem",
  description: "筛选栏表单项装饰器。",
  kind: "decorator",
  scenes: ["recordFilter"],
  meta: { decorator: true },
});

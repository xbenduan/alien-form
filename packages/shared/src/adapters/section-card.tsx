import type React from "react";
import { defineAdapter } from "../adapter";

function SectionCard({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <fieldset className="schema-section-card">
      {title ? <legend className="schema-section-card-title">{title}</legend> : null}
      {description ? <div className="schema-section-card-description">{description}</div> : null}
      <div className="schema-section-card-content">{children}</div>
    </fieldset>
  );
}

export default defineAdapter(SectionCard, {
  key: "SectionCard",
  label: "SectionCard",
  description: "分组卡片容器组件。",
  kind: "component",
  scenes: { form: {}, detail: {}, filter: {} },
  meta: { fieldType: "object" },
});

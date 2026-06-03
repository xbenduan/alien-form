import { defineAdapter } from "@alien-form/cms";
import { Tag } from "antd";

function DisplayTags({ value }: { value?: unknown }) {
  if (!Array.isArray(value)) {
    return <>—</>;
  }

  if (value.length === 0) {
    return <>—</>;
  }

  return (
    <span className="readonly-tag-list">
      {value.map((item) => (
        <Tag key={String(item)} className="readonly-tag-item">
          {String(item)}
        </Tag>
      ))}
    </span>
  );
}

export default defineAdapter(
  DisplayTags,
  {
    key: "DisplayTags",
    label: "DisplayTags",
    description: "标签列表只读展示组件。",
    kind: "display",
    scenes: ["recordDetail", "tableCell"],
    meta: { displayType: "tags" },
  },
);

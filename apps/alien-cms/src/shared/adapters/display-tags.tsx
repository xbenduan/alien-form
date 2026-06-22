import { defineAdapter } from "@alien-form/cms";
import { EMPTY_TEXT, normalizeArrayItems, renderTagList } from "./display-utils";
import type { DisplayValueProps } from "./types";

function DisplayTags({ value, dataSource }: DisplayValueProps) {
  if (!Array.isArray(value)) {
    return <>{EMPTY_TEXT}</>;
  }

  return renderTagList(normalizeArrayItems(value, dataSource));
}

export default defineAdapter(DisplayTags, {
  key: "DisplayTags",
  label: "标签展示",
  description: "标签列表只读展示组件。",
  kind: "display",
  scenes: { detail: {}, table: {} },
  meta: { displayType: "tags" },
});

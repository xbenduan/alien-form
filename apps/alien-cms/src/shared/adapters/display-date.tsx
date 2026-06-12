import { defineAdapter } from "@alien-form/cms";
import DisplayText from "./display-text";
import type { DisplayValueProps } from "./types";

function DisplayDate(props: DisplayValueProps) {
  return <DisplayText {...props} format={props.format ?? "date"} />;
}

export default defineAdapter(DisplayDate, {
  key: "DisplayDate",
  label: "日期展示",
  description: "日期只读展示组件。",
  kind: "display",
  scenes: { recordDetail: { mode: "readonly" }, tableCell: { mode: "cell" } },
  meta: { displayType: "date" },
});

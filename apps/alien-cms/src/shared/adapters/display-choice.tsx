import { defineAdapter } from "@alien-form/cms";
import DisplayText from "./display-text";
import type { DisplayValueProps } from "./types";

function DisplayChoice(props: DisplayValueProps) {
  return <DisplayText {...props} />;
}

export default defineAdapter(DisplayChoice, {
  key: "DisplayChoice",
  label: "选项展示",
  description: "选项值只读展示组件。",
  kind: "display",
  scenes: { recordDetail: { mode: "readonly" }, tableCell: { mode: "cell" } },
  meta: { displayType: "choice" },
});

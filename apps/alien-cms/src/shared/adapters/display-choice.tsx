import { defineAdapter } from "@alien-form/cms";
import type { DataSourceItem } from "@alien-form/react";
import DisplayText from "./display-text";

interface DisplayValueProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: string;
  ellipsis?: boolean;
}

function DisplayChoice(props: DisplayValueProps) {
  return <DisplayText {...props} />;
}

export default defineAdapter(
  DisplayChoice,
  {
    key: "DisplayChoice",
    label: "DisplayChoice",
    description: "选项值只读展示组件。",
    kind: "display",
    scenes: ["recordDetail", "tableCell"],
    meta: { displayType: "choice" },
  },
);

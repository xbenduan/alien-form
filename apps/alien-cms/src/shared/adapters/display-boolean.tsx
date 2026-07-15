import { Typography } from "../ui";
import { getDisplaySummary } from "./get-display-summary";

export function DisplayBoolean({ value, ellipsis }: { value?: unknown; ellipsis?: boolean }) {
  const text = getDisplaySummary({ value, format: "boolean" }).text;
  return ellipsis ? (
    <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>
  ) : (
    <>{text}</>
  );
}

export default DisplayBoolean;

import { Image, Tag, Typography } from "../ui";
import { normalizeArrayItems, renderTagList } from "./display-utils";
import { getDisplaySummary } from "./get-display-summary";
import type { DisplayValueProps } from "./types";

function renderText(text: string, ellipsis?: boolean) {
  if (!ellipsis && text.length > 120) {
    return (
      <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
        {text}
      </Typography.Paragraph>
    );
  }

  if (ellipsis) {
    return <Typography.Text ellipsis={{ tooltip: text }}>{text}</Typography.Text>;
  }

  return <>{text}</>;
}

export function DisplayText({ value, dataSource, format, ellipsis }: DisplayValueProps) {
  const summary = getDisplaySummary({ value, dataSource, format });

  if (summary.kind === "image" && typeof value === "string") {
    return <Image src={value} alt={value} style={{ maxWidth: 160 }} />;
  }

  if (summary.kind === "link" && typeof value === "string") {
    return (
      <Typography.Link href={value} target="_blank" rel="noreferrer">
        {value}
      </Typography.Link>
    );
  }

  if (summary.kind === "status") {
    return <Tag color={summary.color}>{summary.text}</Tag>;
  }

  if (Array.isArray(value)) {
    return renderTagList(normalizeArrayItems(value, dataSource));
  }

  return renderText(summary.text, ellipsis);
}

export default DisplayText;

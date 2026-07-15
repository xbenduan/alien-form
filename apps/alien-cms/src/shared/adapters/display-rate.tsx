import type { DataSourceItem } from "@alien-form/react";
import { Rate } from "../ui";
import { EMPTY_TEXT } from "./display-utils";

interface DisplayValueProps {
  value?: unknown;
  dataSource?: DataSourceItem[];
  format?: string;
  ellipsis?: boolean;
}

export function DisplayRate({ value }: DisplayValueProps) {
  if (value === undefined || value === null || value === "") {
    return <>{EMPTY_TEXT}</>;
  }

  const numericValue = typeof value === "number" ? value : Number(value);
  if (Number.isNaN(numericValue)) {
    return <>{String(value)}</>;
  }

  return <Rate disabled value={numericValue} />;
}

export default DisplayRate;

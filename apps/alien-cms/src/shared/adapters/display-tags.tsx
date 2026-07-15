import { EMPTY_TEXT, normalizeArrayItems, renderTagList } from "./display-utils";
import type { DisplayValueProps } from "./types";

export function DisplayTags({ value, dataSource }: DisplayValueProps) {
  if (!Array.isArray(value)) {
    return <>{EMPTY_TEXT}</>;
  }

  return renderTagList(normalizeArrayItems(value, dataSource));
}

export default DisplayTags;

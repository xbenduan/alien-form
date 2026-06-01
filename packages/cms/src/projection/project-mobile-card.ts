import type { CmsFieldSchema, CmsModelSchema } from "../types/schema";
import type { MobileCardProjection } from "./types";
import { sortSchemaEntries } from "./shared";

/**
 * Projects a CmsModelSchema into a mobile card layout descriptor.
 * Used by mobile list views to render record cards.
 */
export function projectMobileCard(schema: CmsModelSchema): MobileCardProjection {
  const entries = sortSchemaEntries(schema.properties);
  const primaryField = schema["x-model"]?.primaryField;

  let titleField: string | undefined;
  let subtitleField: string | undefined;
  let tagField: string | undefined;
  const summaryFields: MobileCardProjection["summaryFields"] = [];

  for (const [key, field] of entries) {
    const mobile = field["x-cms"]?.mobile;

    if (mobile?.cardTitle) {
      titleField = key;
      continue;
    }
    if (mobile?.cardSubtitle) {
      subtitleField = key;
      continue;
    }
    if (mobile?.cardTag) {
      tagField = key;
      continue;
    }

    // Collect visible summary fields
    if (mobile?.listVisible !== false && field.type !== "object" && field.type !== "void") {
      summaryFields.push({
        key,
        title: field.title ?? key,
        format: field["x-cms"]?.detail?.format ?? field["x-cms"]?.table?.format,
        dataSource: field.dataSource,
      });
    }
  }

  // Fallbacks
  if (!titleField) {
    titleField = primaryField ?? entries.find(([, f]) => f.type === "string")?.[0] ?? entries[0]?.[0] ?? "id";
  }

  if (!tagField) {
    // Auto-detect: first field with dataSource that looks like a status
    const candidate = entries.find(
      ([key, f]) => key !== titleField && f.dataSource && f.dataSource.length <= 6,
    );
    if (candidate) {
      tagField = candidate[0];
    }
  }

  return {
    titleField,
    subtitleField,
    tagField,
    summaryFields: summaryFields
      .filter((f) => f.key !== titleField && f.key !== subtitleField && f.key !== tagField)
      .slice(0, 4),
  };
}

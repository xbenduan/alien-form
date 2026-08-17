import {
  registry,
  resolveSceneRender,
} from "@alien-form/shared";
import type {
  CmsFieldSchema,
  CmsModelSchema,
} from "../../model";
import { withoutCmsMetadata } from "./field-traversal";

export type RecordFormScene = "add" | "edit";

type SchemaScene = "form" | "detail";

function projectField(
  field: CmsFieldSchema,
  scene: SchemaScene,
  formMode?: RecordFormScene,
): CmsFieldSchema {
  const cms = field["x-cms"];
  const fieldSchema = withoutCmsMetadata(field);
  const sceneMeta = scene === "detail" ? cms?.detail : undefined;
  const resolved = resolveSceneRender(field, scene, registry, {
    props: sceneMeta?.format ? { format: sceneMeta.format } : {},
  });
  const formModes = cms?.form?.modes;
  const hiddenInForm =
    scene === "form" &&
    formMode !== undefined &&
    Array.isArray(formModes) &&
    !formModes.includes(formMode);

  const projected: CmsFieldSchema = {
    ...fieldSchema,
    display: hiddenInForm ? "none" : field.display,
    props: resolved?.props ?? field.props,
    "x-handler-params": cms?.reactions,
  };

  if (field.properties) {
    projected.properties = Object.fromEntries(
      Object.entries(field.properties).map(([key, child]) => [
        key,
        projectField(child, scene, formMode),
      ]),
    );
  }

  if (field.items && !Array.isArray(field.items)) {
    projected.items = projectField(field.items, scene, formMode);
  }

  return projected;
}

function projectSchema(
  schema: CmsModelSchema,
  scene: SchemaScene,
  formMode?: RecordFormScene,
): CmsModelSchema {
  return {
    ...schema,
    properties: Object.fromEntries(
      Object.entries(schema.properties ?? {}).map(([key, field]) => [
        key,
        projectField(field, scene, formMode),
      ]),
    ),
  };
}

export function projectFormSchema(
  schema: CmsModelSchema,
  mode: RecordFormScene,
): CmsModelSchema {
  return projectSchema(schema, "form", mode);
}

export function projectDetailSchema(schema: CmsModelSchema): CmsModelSchema {
  return projectSchema(schema, "detail");
}

export function projectDetailField(field: CmsFieldSchema): CmsFieldSchema {
  return projectField(field, "detail");
}

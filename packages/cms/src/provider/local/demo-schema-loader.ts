import { normalizeSchema } from "../../schema/normalize-schema";
import type { CmsModelSchema, ModelSummary } from "../../types/schema";
import nailBookingSchema from "./schema/nail-booking.json";
import nailEmployeeSchema from "./schema/nail-employee.json";
import nailServiceSchema from "./schema/nail-service.json";

export interface DemoSchemaEntry {
  modelName: string;
  schema: CmsModelSchema;
}

const demoSchemas: DemoSchemaEntry[] = [
  { modelName: "nail-booking", schema: nailBookingSchema as CmsModelSchema },
  { modelName: "nail-employee", schema: nailEmployeeSchema as CmsModelSchema },
  { modelName: "nail-service", schema: nailServiceSchema as CmsModelSchema },
];

export function listDemoSchemas(): DemoSchemaEntry[] {
  return demoSchemas
    .map(({ modelName, schema }) => ({
      modelName,
      schema: normalizeSchema(schema as never) as unknown as CmsModelSchema,
    }))
    .sort((left, right) => left.modelName.localeCompare(right.modelName));
}

export function listDemoModelSummaries(): ModelSummary[] {
  return listDemoSchemas().map(({ modelName, schema }) => ({
    name: modelName,
    title: schema["x-model"]?.title ?? schema.title ?? modelName,
    subtitle: schema["x-model"]?.subtitle,
    description: schema["x-model"]?.description ?? schema.description,
    source: "static",
    fieldCount: Object.keys(schema.properties ?? {}).length,
  }));
}

export function getDefaultDemoModelName() {
  return listDemoSchemas()[0]?.modelName;
}

export function loadDemoSchema(modelName: string): CmsModelSchema | undefined {
  return listDemoSchemas().find((item) => item.modelName === modelName)?.schema;
}

import type { AlienSchema } from "@alien-form/protocol";
import type { CompiledModel } from "../services/core/contracts.ts";
import { compileStorageManifest } from "./compiler.ts";
import { planFields } from "./field-plan.ts";

export type CompiledProtocolModel = Omit<CompiledModel, "lifecycle" | "commands" | "eventHandlers">;

/** Deterministically compiles one protocol version into immutable runtime plans. */
export function compileModel(schema: AlienSchema): CompiledProtocolModel {
  const fields = schema.fields.map((field) => [field.key, field] as const);
  return {
    key: `${schema.name}@${schema.version}`,
    schema,
    storage: compileStorageManifest(schema),
    query: {
      fields: new Map(planFields(schema).map((field) => [field.field, field])),
    },
    policy: {
      publicFields: new Set(
        schema.fields.filter((field) => !field.private).map((field) => field.key),
      ),
      privateFields: new Set(
        schema.fields.filter((field) => field.private).map((field) => field.key),
      ),
    },
    validation: {
      fields: new Map(fields),
    },
  };
}

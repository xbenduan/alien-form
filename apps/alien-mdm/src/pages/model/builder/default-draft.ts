import { createModelTemplate } from "@alien-form/protocol";
import { createId, decodeModel } from "./codec";
import type { ModelDraft } from "./types";

export function createDefaultDraft(): ModelDraft {
  const draft = decodeModel(createModelTemplate());
  return {
    ...draft,
    name: "",
    title: "",
    singularLabel: undefined,
    pluralLabel: undefined,
    fields: draft.fields.map((field) => ({ ...field, id: createId(), persisted: false })),
    pages: [],
  };
}

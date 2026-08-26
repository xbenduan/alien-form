import { describe, expect, it } from "vitest";
import { BuilderRuntime } from "@alien-form/builder";
import { fieldDefinitionRegistry, getFieldDefinition } from "../../../register/global/form/registry";
import { modelCommands } from "./commands";
import { ModelCodec } from "./model-codec";
import {
  buildModelPage,
  buildPreviewPage,
  projectColumns,
  projectFilter,
  projectForm,
} from "./model-page-builder";
import type { ModelDraft } from "./types";

function ids() {
  let id = 0;
  return () => `id-${++id}`;
}

describe("model builder", () => {
  it("encodes and decodes model drafts without losing schema data", () => {
    const codec = new ModelCodec(ids());
    const draft = codec.createModel();
    draft.name = "users";
    draft.constants = { active: true };
    draft.i18n = { title: { zh: "用户" } };
    draft.groups = [{ ...codec.createGroup(), keys: [draft.fields[0].fields.key!] }];
    const schema = codec.encode(draft);

    expect(codec.encode(codec.decode(schema))).toEqual(schema);
  });

  it("handles nested field commands with undo and redo", () => {
    const codec = new ModelCodec(ids());
    const parent = codec.createField("ObjectField");
    const child = codec.createField();
    const builder = new BuilderRuntime<ModelDraft>({
      document: { ...codec.createModel(), fields: [parent] },
      registry: fieldDefinitionRegistry,
      commands: modelCommands,
    });

    builder.dispatch("field.add", { field: child, parentId: parent.id });
    expect(builder.document.get().fields[0].children?.[0].id).toBe(child.id);
    builder.dispatch("field.move", { id: child.id, index: 0 });
    expect(builder.document.get().fields[0].id).toBe(child.id);
    builder.dispatch("field.remove", { id: child.id });
    expect(builder.document.get().fields).toHaveLength(1);
    builder.undo();
    expect(builder.document.get().fields[0].id).toBe(child.id);
    builder.redo();
    expect(builder.document.get().fields).toHaveLength(1);
  });

  it("changes groups, metadata, and JSON documents through commands", () => {
    const codec = new ModelCodec(ids());
    const builder = new BuilderRuntime<ModelDraft>({
      document: codec.createModel(),
      commands: modelCommands,
    });
    const first = codec.createGroup();
    const second = codec.createGroup();
    builder.dispatch("group.add", { group: first });
    builder.dispatch("group.add", { group: second });
    builder.dispatch("group.move", { from: 1, to: 0 });
    builder.dispatch("meta.update", { title: "用户" });

    expect(builder.document.get().groups.map((group) => group.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(builder.document.get().title).toBe("用户");

    builder.replaceDocument({ ...builder.document.get(), title: "JSON 用户" });
    expect(builder.document.get().title).toBe("JSON 用户");
  });

  it("uses field definitions for form, filter, and table projections", () => {
    const codec = new ModelCodec(ids());
    const draft = codec.createModel();
    draft.name = "users";
    draft.fields[0].fields["x-database"] = { index: true };
    const schema = codec.encode(draft);

    expect(getFieldDefinition("Input")?.authoring.create().component).toBe("Input");
    expect(projectForm(schema).properties?.[draft.fields[0].fields.key!]).toBeDefined();
    expect(projectFilter(schema).properties?.[draft.fields[0].fields.key!]).toBeDefined();
    expect(projectColumns(schema)[0].key).toBe(draft.fields[0].fields.key);
  });

  it("builds all scenes and keeps preview on the same form projection", () => {
    const codec = new ModelCodec(ids());
    const draft = codec.createModel();
    draft.name = "users";
    const schema = codec.encode(draft);

    for (const scene of ["list", "add", "edit", "detail"] as const) {
      const page = buildModelPage({ schema, scene, recordId: "1" });
      expect(page.meta?.scene).toBe(scene);
      expect(page.domain).toBe("users");
    }

    const preview = buildPreviewPage(schema);
    const add = buildModelPage({ schema, scene: "add" });
    expect(preview.blocks[0].formSchema).toEqual(add.blocks[0].formSchema);
    expect(preview.layout.component).toBe("builder-preview");
  });
});

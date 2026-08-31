import { describe, expect, it } from "vitest";
import { BuilderRuntime } from "@alien-form/builder";
import { getFieldDefinition } from "@runtime";
import type { UiComponentDefinition } from "@app-types/shared";
import { createAppRuntime } from "@runtime/create-runtime";
import { fieldEditorSchemaOf, fieldEditorValuesOf } from "../components/field-editor";
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
  const registry = createAppRuntime().registry;

  it("encodes and decodes model drafts without losing schema data", () => {
    const codec = new ModelCodec(registry, ids());
    const draft = codec.createModel();
    draft.name = "users";
    draft.constants = { active: true };
    draft.i18n = { title: { zh: "用户" } };
    draft.groups = [{ ...codec.createGroup(), keys: [draft.fields[0].fields.key!] }];
    const schema = codec.encode(draft);

    expect(codec.encode(codec.decode(schema))).toEqual(schema);
  });

  it("handles nested field commands with undo and redo", () => {
    const codec = new ModelCodec(registry, ids());
    const parent = codec.createField("ObjectField");
    const child = codec.createField();
    const builder = new BuilderRuntime<ModelDraft>({
      document: { ...codec.createModel(), fields: [parent] },
      registry,
      domain: "users",
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
    const codec = new ModelCodec(registry, ids());
    const builder = new BuilderRuntime<ModelDraft>({
      document: codec.createModel(),
      registry,
      domain: "users",
      commands: modelCommands,
    });
    const first = codec.createGroup();
    const second = codec.createGroup();
    builder.dispatch("group.add", { group: first });
    builder.dispatch("group.add", { group: second });
    builder.dispatch("group.move", { from: 1, to: 0 });
    builder.dispatch("meta.update", { title: "用户" });

    expect(builder.document.get().groups.map((group) => group.id)).toEqual([second.id, first.id]);
    expect(builder.document.get().title).toBe("用户");

    builder.dispatch("document.replace", { ...builder.document.get(), title: "JSON 用户" });
    expect(builder.document.get().title).toBe("JSON 用户");
    builder.undo();
    expect(builder.document.get().title).toBe("用户");
  });

  it("uses field definitions for form, filter, and table projections", () => {
    const codec = new ModelCodec(registry, ids());
    const draft = codec.createModel();
    draft.name = "users";
    draft.fields[0].fields["x-database"] = { index: true };
    const schema = codec.encode(draft);

    expect(getFieldDefinition(registry, "Input")?.authoring.create().component).toBe("Input");
    expect(getFieldDefinition(registry, "ObjectField")?.authoring.children).toBe("properties");
    expect(getFieldDefinition(registry, "ArrayCards")?.authoring.children).toBe("items");
    expect(projectForm(registry, schema).properties?.[draft.fields[0].fields.key!]).toBeDefined();
    expect(projectFilter(registry, schema).properties?.[draft.fields[0].fields.key!]).toBeDefined();
    expect(projectColumns(registry, schema)[0].key).toBe(draft.fields[0].fields.key);
  });

  it("builds all scenes and keeps preview on the same form projection", () => {
    const codec = new ModelCodec(registry, ids());
    const draft = codec.createModel();
    draft.name = "users";
    const schema = codec.encode(draft);

    for (const scene of ["list", "add", "edit", "detail"] as const) {
      const page = buildModelPage({ registry, schema, scene, recordId: "1" });
      expect(page.meta?.scene).toBe(scene);
      expect(page.domain).toBe("users");
    }

    const preview = buildPreviewPage(registry, schema);
    const add = buildModelPage({ registry, schema, scene: "add" });
    expect(preview.blocks[0].formSchema).toEqual(add.blocks[0].formSchema);
    expect(preview.layout.component).toBe("builder-preview");
  });

  it("defines the complete default UI layout authoring tree", () => {
    const codec = new ModelCodec(registry, ids());
    const layout = codec.createModel().layout;
    const visit = (node: typeof layout) => {
      const definition = registry.ui.resolve(node.component);
      expect(definition, node.component).toBeDefined();
      for (const child of node.children ?? []) visit(child);
      for (const child of Object.values(node.slots ?? {})) visit(child);
    };

    visit(layout);
    expect(registry.ui.resolve("layout")?.slots).toContain("rightBottom");
    expect(registry.ui.resolve("table")?.slots).toContain("toolbarRight");
    expect((registry.ui.resolve("filter") as UiComponentDefinition).authoring.parent).toBe(
      "layout",
    );
    expect((registry.ui.resolve("space") as UiComponentDefinition).authoring.parent).toBe("table");
    expect((registry.ui.resolve("detail") as UiComponentDefinition).authoring.parent).toBe(
      "space",
    );
    expect((registry.ui.resolve("table") as UiComponentDefinition).authoring.children).toBe(true);
    expect((registry.ui.resolve("table") as UiComponentDefinition).authoring.props).toEqual({
      rows: 3,
    });
    expect((registry.ui.resolve("action-add") as UiComponentDefinition).authoring.children).toBe(
      false,
    );
    expect((registry.ui.resolve("action-add") as UiComponentDefinition).authoring.props).toEqual({
      rows: 1,
    });
    expect((registry.ui.resolve("delete") as UiComponentDefinition).authoring.children).toBe(false);
  });

  it("maps every structured field authoring section back to schema", () => {
    const schema = fieldEditorSchemaOf(
      registry,
      fieldEditorValuesOf({
        type: "string",
        key: "status",
        title: "状态",
        description: "记录状态",
        component: "Select",
        decorator: "FormItem",
        decoratorProps: { tooltip: "请选择" },
        props: { placeholder: "请选择", service: "records.options" },
        required: true,
        disabled: false,
        display: "visible",
        default: "active",
        dataSource: [{ label: "启用", value: "active", color: "green" }],
        dataSourcePolicy: "clear",
        "x-validate": "@validateStatus",
        "x-reaction": { disabled: "{{ locked }}" },
        "x-effect": "@watchStatus",
        "x-format": { output: "@serializeStatus" },
        "x-table": { width: 120, visible: true, ellipsis: true, sortable: false },
        "x-database": {
          type: "text",
          nullable: false,
          index: true,
          filterable: true,
        },
      }),
    );

    expect(schema).toMatchObject({
      key: "status",
      component: "Select",
      props: { placeholder: "请选择", service: "records.options" },
      dataSource: [{ label: "启用", value: "active", color: "green" }],
      "x-reaction": { disabled: "{{ locked }}" },
      "x-table": { width: 120, visible: true },
      "x-database": { type: "text", nullable: false, index: true },
    });
  });
});

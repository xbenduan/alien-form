import { describe, expect, it } from "vitest";
import { Runtime } from "@engine";
import { registerFields } from "../../../register/global/fields";
import { createDefaultDraft, decodeModel, encodeModel } from "../builder";

describe("codec separation invariants", () => {
  it("keeps storage-only in fields and form-only in form-schema", () => {
    const runtime = new Runtime();
    registerFields(runtime);
    const draft = createDefaultDraft(runtime);
    draft.name = "demo_model";
    draft.title = "演示";

    const model = encodeModel(draft);
    const nameField = model.fields.find((f) => f.key === "name")!;
    const nameForm = model.definitions["form-schema"].properties!.name!;

    // fields[].title 来自 storage；required 由 nullable 派生到 form-schema
    expect(nameField.title).toBe("名称");
    expect(nameField.nullable).toBe(false);
    expect(nameForm.required).toBe(true);

    // form-schema 不含任何存储语义
    for (const key of ["nullable", "unique", "index", "filterable", "visible", "column"]) {
      expect(key in nameForm).toBe(false);
    }
    // fields 不含任何表现语义
    for (const key of ["component", "display", "props", "dataSource"]) {
      expect(key in nameField).toBe(false);
    }

    // round-trip 保持分离
    const back = decodeModel(model);
    const n2 = back.fields.find((f) => f.key === "name")!;
    expect(n2.storage?.title).toBe("名称");
    expect(n2.storage?.nullable).toBe(false);
    expect(n2.form.component).toBe("Input");
  });

  it("preserves full IFieldSchema surface on a form field through round-trip", () => {
    const runtime = new Runtime();
    registerFields(runtime);
    const draft = createDefaultDraft(runtime);
    draft.name = "demo_model";
    draft.title = "演示";
    // 给 name 字段写入完整 IFieldSchema 表现字段。
    const nameNode = draft.fields.find((f) => f.key === "name")!;
    nameNode.form = {
      ...nameNode.form,
      description: "登录名",
      props: { placeholder: "请输入" },
      "x-reaction": { display: "{{ $values.enabled ? 'visible' : 'hidden' }}" },
      "x-validate": [{ required: true }],
      default: "guest",
    };

    const model = encodeModel(draft);
    const nameForm = model.definitions["form-schema"].properties!.name! as Record<string, unknown>;
    expect(nameForm.description).toBe("登录名");
    expect(nameForm["x-reaction"]).toBeDefined();
    expect(nameForm["x-validate"]).toBeDefined();
    expect(nameForm.default).toBe("guest");

    const back = decodeModel(model);
    const n2 = back.fields.find((f) => f.key === "name")!;
    const f2 = n2.form as Record<string, unknown>;
    expect(f2.description).toBe("登录名");
    expect(f2["x-reaction"]).toBeDefined();
    expect(f2.default).toBe("guest");
  });
});

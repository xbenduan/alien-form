import { describe, expect, it } from "vitest";
import * as core from "../index";

describe("@alien-form/core factory exports", () => {
  it("only exposes createForm on the public runtime surface", () => {
    expect("Form" in core).toBe(false);
    expect("Field" in core).toBe(false);
    expect(typeof core.createForm).toBe("function");
  });

  it("returns plain factory objects with hidden internals", () => {
    const form = core.createForm();
    const field = form.createField("name", { type: "string", title: "Name" });

    expect(Object.getPrototypeOf(form)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(field)).toBe(Object.prototype);
    expect(Object.keys(form)).not.toContain("_emitError");
    expect(Object.keys(field)).not.toContain("_renamePath");
    expect(Object.keys(form)).toContain("createField");
    expect(Object.keys(field)).toContain("setValue");
  });
});

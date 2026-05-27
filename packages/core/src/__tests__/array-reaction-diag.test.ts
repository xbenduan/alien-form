import { describe, expect, it } from "vitest";
import { effect } from "alien-signals";
import { createForm } from "../index";
import { getFormInternals } from "../engine/form/internals";

describe("array item x-reaction diagnosis", () => {
  it("manual effect tracks array item field value", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", default: "person" },
              companyName: { type: "string" },
            },
          },
        },
      },
    });

    form.getArrayField("users")?.push();

    const typeField = form.getField("users.0.type")!;
    const companyNameField = form.getField("users.0.companyName")!;

    // Manual effect: does alien-signals track this correctly?
    const log: string[] = [];
    const dispose = effect(() => {
      const val = typeField.value;
      log.push(`type=${val}`);
    });

    expect(log).toEqual(["type=person"]);
    typeField.setValue("company");
    expect(log).toEqual(["type=person", "type=company"]);
    dispose();
  });

  it("resolveDependencies inside effect tracks dependency field value", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", default: "person" },
              companyName: { type: "string" },
            },
          },
        },
      },
    });

    form.getArrayField("users")?.push();
    const typeField = form.getField("users.0.type")!;

    // Simulate what the reaction effect does
    const log: string[] = [];
    const dispose = effect(() => {
      const internals = getFormInternals(form);
      internals.fieldRegistryVersion(); // track registry
      const field = form.getField("users.0.companyName");
      if (!field) { log.push("no-field"); return; }

      // This is what trackImplicitSelfDependency does for non-value reactions without deps
      // But our reaction HAS deps, so this won't be called

      // This is what resolveDependencies does:
      const depField = form.getField("users.0.type");
      const value = depField ? depField.value : undefined;
      log.push(`dep-type=${value}`);
    });

    console.log("Initial log:", log);
    expect(log).toEqual(["dep-type=person"]);

    typeField.setValue("company");
    console.log("After setValue log:", log);
    expect(log).toEqual(["dep-type=person", "dep-type=company"]);

    dispose();
  });

  it("the actual installRuleEffect behavior", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", default: "person" },
              companyName: {
                type: "string",
                display: "none",
                "x-reaction": {
                  display: {
                    dependencies: { type: ".type" },
                    type: "expression",
                    expression: "$deps.type === 'company' ? 'visible' : 'none'",
                  },
                },
              },
            },
          },
        },
      },
    });

    form.getArrayField("users")?.push();

    // Manually install an effect that mimics installRuleEffect
    const log: string[] = [];
    const dispose = effect(() => {
      const internals = getFormInternals(form);
      internals.fieldRegistryVersion();
      if (internals.destroyed) return;

      const field = form.getField("users.0.companyName");
      if (!field) { log.push("no-field"); return; }

      // trackImplicitSelfDependency: for non-value reactions with deps, this is skipped
      // (reaction has dependencies so rule.dependencies is truthy)

      // resolveDependencies for { type: ".type" }, selfPath="users.0.companyName"
      // resolveFieldPath(".type", "users.0.companyName") -> "users.0.type"
      const depField = form.getField("users.0.type");
      const value = depField ? depField.value : undefined;
      log.push(`resolved=${value}`);
    });

    console.log("Initial:", log);
    expect(log).toEqual(["resolved=person"]);

    form.getField("users.0.type")?.setValue("company");
    console.log("After:", log);
    expect(log).toEqual(["resolved=person", "resolved=company"]);

    dispose();
  });
});

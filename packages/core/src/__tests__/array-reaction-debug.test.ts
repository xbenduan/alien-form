import { describe, expect, it } from "vitest";
import { createForm } from "../index";
import { getFormInternals } from "../engine/form/internals";

describe("array item x-reaction with relative dependency", () => {
  it("installs reaction effects for dynamically pushed array items", () => {
    const form = createForm();
    form.setSchema({
      type: "object",
      properties: {
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                default: "person",
              },
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

    const internals = getFormInternals(form);
    const effectKeys = Array.from(internals.installedRuleEffects.keys());
    console.log("Installed effect keys:", effectKeys);

    const companyNameEffect = effectKeys.find((k) => k.includes("companyName"));
    console.log("companyName effect key:", companyNameEffect);

    const companyName = form.getField("users.0.companyName");
    console.log("companyName field exists:", !!companyName);
    console.log("companyName display BEFORE:", companyName?.display);
    console.log("companyName visible BEFORE:", companyName?.visible);

    const typeField = form.getField("users.0.type");
    console.log("type field exists:", !!typeField);
    console.log("type value:", typeField?.value);

    // Now trigger the dependency change
    typeField?.setValue("company");

    console.log("companyName display AFTER:", companyName?.display);
    console.log("companyName visible AFTER:", companyName?.visible);

    // This is the assertion that should pass but currently doesn't
    expect(companyName?.visible).toBe(true);
  });
});

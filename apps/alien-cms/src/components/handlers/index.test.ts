import { describe, expect, it } from "vitest";
import { defineHandler } from "@alien-form/shared";
import { map } from ".";

const testOnlyHandler = defineHandler(() => undefined, {
  key: "testOnlyHandler",
  label: "Test-only handler",
  description: "Must never be registered in production.",
  supportedTargets: [],
  defaultConfig: {},
  params: [],
});

export default testOnlyHandler;

describe("handler registry", () => {
  it("excludes test modules and test directories", () => {
    expect(map).not.toHaveProperty("testOnlyHandler");
    expect(map).not.toHaveProperty("testDirectoryOnlyHandler");
    expect(map).not.toHaveProperty("specOnlyHandler");
  });
});

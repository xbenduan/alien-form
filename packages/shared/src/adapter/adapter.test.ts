import { describe, expect, it } from "vitest";
import { createAdapterCatalog, createAdapterRegistry, defineAdapter } from "./adapter";
import { createHandlerCatalog, createHandlerRegistry, defineHandler } from "./handler";

function makeAdapter(key: string) {
  return defineAdapter(() => null, {
    key,
    label: key,
    description: "",
    kind: "component",
    scenes: { form: {} },
  });
}

describe("adapter registry", () => {
  it("rejects duplicate config keys", () => {
    const adapter = makeAdapter("Input");

    expect(() => createAdapterRegistry({ Input: adapter, Alias: adapter } as any)).toThrow(
      'Duplicate adapter key "Input".',
    );
  });

  it("rejects entries without adapter config", () => {
    expect(() => createAdapterRegistry({ Input: (() => null) as any })).toThrow(
      'Adapter "Input" is missing config.',
    );
  });

  it("builds catalog defaults without changing the registry", () => {
    const adapter = makeAdapter("Input");
    const registry = createAdapterRegistry({ Input: adapter });
    const catalog = createAdapterCatalog(registry);

    expect(registry.Input).toBe(adapter);
    expect(catalog).toEqual([
      expect.objectContaining({
        key: "Input",
        meta: {},
        params: [],
      }),
    ]);
  });
});

describe("handler registry", () => {
  it("supports application-defined target types", () => {
    const handler = defineHandler(() => undefined, {
      key: "loadOptions",
      label: "Load options",
      description: "",
      supportedTargets: ["choices", "suggestions"],
      defaultConfig: { cache: true },
    });

    const catalog = createHandlerCatalog(createHandlerRegistry({ loadOptions: handler }));

    expect(catalog[0]?.supportedTargets).toEqual(["choices", "suggestions"]);
    expect(catalog[0]?.defaultConfig).toEqual({ cache: true });
  });

  it("rejects entries without handler config", () => {
    expect(() => createHandlerRegistry({ loadOptions: (() => undefined) as any })).toThrow(
      'Handler "loadOptions" is missing config.',
    );
  });
});

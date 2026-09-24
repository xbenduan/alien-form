import { describe, expect, it, vi } from "vitest";
import { defineCore } from "../define-core.ts";

describe("defineCore", () => {
  it("evaluates the definition once and forwards each request input unchanged", () => {
    const input = { value: 1 };
    const create = vi.fn((received: typeof input) => ({ received }));
    const factory = vi.fn(() => ({ models: {}, create }));

    const createCore = defineCore(factory);

    expect(factory).toHaveBeenCalledOnce();
    expect(createCore(input).received).toBe(input);
    expect(create).toHaveBeenCalledWith(input, createCore.models);
  });

  it("creates a shallow-frozen runtime for each invocation", () => {
    const createCore = defineCore(() => ({
      models: {},
      create: (input: { value: number }) => ({
        input,
        state: { count: 0 },
      }),
    }));

    const first = createCore({ value: 1 });
    const second = createCore({ value: 2 });

    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.state)).toBe(false);
  });

  it("prevents replacing top-level runtime members", () => {
    const runtime = defineCore(() => ({
      models: {},
      create: () => ({ service: { enabled: true } }),
    }))({});

    expect(() => {
      Object.assign(runtime, { service: { enabled: false } });
    }).toThrow(TypeError);
    expect(runtime.service.enabled).toBe(true);
  });

  it("exposes an immutable static model registry", () => {
    const createCore = defineCore(() => ({
      models: { article: () => Promise.resolve("article") },
      create: () => ({}),
    }));

    expect(Object.isFrozen(createCore.models)).toBe(true);
    expect(() => Object.assign(createCore.models, { user: () => Promise.resolve("user") })).toThrow(
      TypeError,
    );
  });

  it("propagates factory failures", () => {
    const failure = new Error("bootstrap failed");

    expect(() =>
      defineCore(() => {
        throw failure;
      }),
    ).toThrow(failure);
  });
});

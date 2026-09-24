import { describe, expect, it, vi } from "vitest";
import { defineCore } from "../define-core.ts";

describe("defineCore", () => {
  it("defers factory execution and forwards the input unchanged", () => {
    const input = { value: 1 };
    const factory = vi.fn((received: typeof input) => ({ received }));

    const createCore = defineCore(factory);

    expect(factory).not.toHaveBeenCalled();
    expect(createCore(input).received).toBe(input);
    expect(factory).toHaveBeenCalledOnce();
    expect(factory).toHaveBeenCalledWith(input);
  });

  it("creates a shallow-frozen runtime for each invocation", () => {
    const createCore = defineCore((input: { value: number }) => ({
      input,
      state: { count: 0 },
    }));

    const first = createCore({ value: 1 });
    const second = createCore({ value: 2 });

    expect(first).not.toBe(second);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.state)).toBe(false);
  });

  it("prevents replacing top-level runtime members", () => {
    const runtime = defineCore(() => ({ service: { enabled: true } }))({});

    expect(() => {
      Object.assign(runtime, { service: { enabled: false } });
    }).toThrow(TypeError);
    expect(runtime.service.enabled).toBe(true);
  });

  it("propagates factory failures", () => {
    const failure = new Error("bootstrap failed");
    const createCore = defineCore(() => {
      throw failure;
    });

    expect(() => createCore({})).toThrow(failure);
  });
});

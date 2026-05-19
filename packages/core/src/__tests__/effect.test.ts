import { signal, effect } from "alien-signals";
import { test, expect } from "vitest";

test("alien-signals effect", () => {
  const version = signal(0);
  let renders = 0;
  effect(() => {
    version();
    renders++;
  });
  expect(renders).toBe(1);
  version(version() + 1);
  expect(renders).toBe(2);
});

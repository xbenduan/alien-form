import { signal, effect } from "alien-signals";
import { test, expect } from "vitest";

test("alien-signals effect on update", async () => {
  const version = signal(0);
  let renders = 0;
  effect(() => {
    version();
    renders++;
  });
  expect(renders).toBe(1);
  version(1);
  expect(renders).toBe(2);
});

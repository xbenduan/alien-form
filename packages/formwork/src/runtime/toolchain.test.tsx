import { afterEach, expect, it } from "vitest";
import { createSignal } from "solid-js";
import { render } from "solid-js/web";

let dispose: (() => void) | undefined;
afterEach(() => { dispose?.(); document.body.replaceChildren(); });

it("compiles Solid getters and updates the actual DOM", () => {
  const host = document.createElement("div");
  document.body.append(host);
  let update!: (value: string) => void;
  dispose = render(() => {
    const [value, setValue] = createSignal("before");
    update = setValue;
    return <span>{value()}</span>;
  }, host);
  expect(host.textContent).toBe("before");
  update("after");
  expect(host.textContent).toBe("after");
});

import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { PageRuntime } from "@engine";
import { PageProvider, usePage } from "./page-provider";

function PageConsumer({ expected }: { expected: PageRuntime }) {
  expect(usePage()).toBe(expected);
  return null;
}

describe("PageProvider", () => {
  it("keeps the page alive across the StrictMode effect probe and destroys it on unmount", async () => {
    const mount = vi.fn();
    const unmount = vi.fn();
    const destroy = vi.fn();
    const page = {
      mount,
      destroy,
      form: { unmount },
    } as unknown as PageRuntime;

    const rendered = render(
      <StrictMode>
        <PageProvider page={page}>
          <PageConsumer expected={page} />
        </PageProvider>
      </StrictMode>,
    );

    await Promise.resolve();
    expect(mount).toHaveBeenCalledTimes(2);
    expect(unmount).toHaveBeenCalledTimes(1);
    expect(destroy).not.toHaveBeenCalled();

    rendered.unmount();
    await Promise.resolve();
    expect(unmount).toHaveBeenCalledTimes(2);
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});

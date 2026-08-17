import { describe, expect, it } from "vitest";
import { routerFutureConfig } from "./index";

describe("AppRouter", () => {
  it("enables the supported React Router v7 future flags", () => {
    expect(routerFutureConfig).toEqual({
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    });
  });
});

import { describe, expect, it } from "vitest";
import { recordRoute } from "./record-route";

describe("recordRoute", () => {
  it("builds the add route without a record id", () => {
    expect(recordRoute("school-user", "add")).toBe("/records/school-user/add");
  });

  it("builds encoded edit and detail routes", () => {
    expect(recordRoute("school user", "edit", "user/1")).toBe(
      "/records/school%20user/edit?id=user%2F1",
    );
    expect(recordRoute("_sys_user", "detail", "_sys_admin")).toBe(
      "/records/_sys_user/detail?id=_sys_admin",
    );
  });

  it("rejects record routes without an id", () => {
    expect(() => recordRoute("school-user", "edit")).toThrow("Record id is required for edit");
  });
});

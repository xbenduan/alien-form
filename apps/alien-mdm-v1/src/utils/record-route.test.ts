import { describe, expect, it } from "vitest";
import { recordListRoute, recordRoute } from "./record-route";

describe("recordRoute", () => {
  it("builds the add route without a record id", () => {
    expect(recordRoute("school-user", "add")).toBe("/records/school-user/add");
    expect(recordListRoute("school user")).toBe("/records/school%20user");
  });

  it("builds encoded edit and detail routes", () => {
    expect(recordRoute("school user", "edit", "user/1")).toBe(
      "/records/school%20user/edit/user%2F1",
    );
    expect(recordRoute("_sys_user", "detail", "_sys_admin")).toBe(
      "/records/_sys_user/detail/_sys_admin",
    );
  });

  it("rejects record routes without an id", () => {
    expect(() => recordRoute("school-user", "edit")).toThrow("Record id is required for edit");
  });
});

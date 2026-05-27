import { describe, expect, it } from "vitest";
import { isEmptyValue, normalizeValidationErrors, runStaticValidate } from "../schema/validation";

describe("validation utilities", () => {
  describe("isEmptyValue", () => {
    it("treats undefined, null, empty string, empty array as empty", () => {
      expect(isEmptyValue(undefined)).toBe(true);
      expect(isEmptyValue(null)).toBe(true);
      expect(isEmptyValue("")).toBe(true);
      expect(isEmptyValue([])).toBe(true);
    });

    it("treats non-empty values as not empty", () => {
      expect(isEmptyValue(0)).toBe(false);
      expect(isEmptyValue(false)).toBe(false);
      expect(isEmptyValue("hello")).toBe(false);
      expect(isEmptyValue([1])).toBe(false);
      expect(isEmptyValue({})).toBe(false);
    });
  });

  describe("runStaticValidate", () => {
    it("validates required", () => {
      expect(runStaticValidate({ required: true }, "")).toHaveLength(1);
      expect(runStaticValidate({ required: true }, "hello")).toHaveLength(0);
    });

    it("validates minimum/maximum for numbers", () => {
      expect(runStaticValidate({ minimum: 5 }, 3)).toHaveLength(1);
      expect(runStaticValidate({ minimum: 5 }, 5)).toHaveLength(0);
      expect(runStaticValidate({ maximum: 10 }, 11)).toHaveLength(1);
      expect(runStaticValidate({ maximum: 10 }, 10)).toHaveLength(0);
    });

    it("validates exclusiveMinimum/exclusiveMaximum", () => {
      expect(runStaticValidate({ exclusiveMinimum: 5 }, 5)).toHaveLength(1);
      expect(runStaticValidate({ exclusiveMinimum: 5 }, 6)).toHaveLength(0);
      expect(runStaticValidate({ exclusiveMaximum: 10 }, 10)).toHaveLength(1);
      expect(runStaticValidate({ exclusiveMaximum: 10 }, 9)).toHaveLength(0);
    });

    it("validates multipleOf", () => {
      expect(runStaticValidate({ multipleOf: 3 }, 7)).toHaveLength(1);
      expect(runStaticValidate({ multipleOf: 3 }, 9)).toHaveLength(0);
    });

    it("validates minLength/maxLength for strings", () => {
      expect(runStaticValidate({ minLength: 3 }, "ab")).toHaveLength(1);
      expect(runStaticValidate({ minLength: 3 }, "abc")).toHaveLength(0);
      expect(runStaticValidate({ maxLength: 5 }, "toolong")).toHaveLength(1);
      expect(runStaticValidate({ maxLength: 5 }, "ok")).toHaveLength(0);
    });

    it("validates pattern", () => {
      expect(runStaticValidate({ pattern: "^\\d+$" }, "abc")).toHaveLength(1);
      expect(runStaticValidate({ pattern: "^\\d+$" }, "123")).toHaveLength(0);
    });

    it("validates minItems/maxItems for arrays", () => {
      expect(runStaticValidate({ minItems: 2 }, [1])).toHaveLength(1);
      expect(runStaticValidate({ minItems: 2 }, [1, 2])).toHaveLength(0);
      expect(runStaticValidate({ maxItems: 3 }, [1, 2, 3, 4])).toHaveLength(1);
      expect(runStaticValidate({ maxItems: 3 }, [1, 2])).toHaveLength(0);
    });

    it("validates minItems on empty arrays", () => {
      expect(runStaticValidate({ minItems: 1 }, [])).toHaveLength(1);
    });

    it("validates uniqueItems", () => {
      expect(runStaticValidate({ uniqueItems: true }, [1, 2, 1])).toHaveLength(1);
      expect(runStaticValidate({ uniqueItems: true }, [1, 2, 3])).toHaveLength(0);
    });

    it("validates const", () => {
      expect(runStaticValidate({ const: "fixed" }, "other")).toHaveLength(1);
      expect(runStaticValidate({ const: "fixed" }, "fixed")).toHaveLength(0);
    });

    it("validates format - email", () => {
      expect(runStaticValidate({ format: "email" }, "invalid")).toHaveLength(1);
      expect(runStaticValidate({ format: "email" }, "test@example.com")).toHaveLength(0);
    });

    it("validates format - url", () => {
      expect(runStaticValidate({ format: "url" }, "not-a-url")).toHaveLength(1);
      expect(runStaticValidate({ format: "url" }, "https://example.com")).toHaveLength(0);
    });

    it("validates format - phone", () => {
      expect(runStaticValidate({ format: "phone" }, "abc")).toHaveLength(1);
      expect(runStaticValidate({ format: "phone" }, "+1-555-1234")).toHaveLength(0);
    });

    it("validates format - number", () => {
      expect(runStaticValidate({ format: "number" }, "abc")).toHaveLength(1);
      expect(runStaticValidate({ format: "number" }, "3.14")).toHaveLength(0);
    });

    it("validates format - integer", () => {
      expect(runStaticValidate({ format: "integer" }, "3.14")).toHaveLength(1);
      expect(runStaticValidate({ format: "integer" }, "42")).toHaveLength(0);
    });

    it("validates format - ip", () => {
      expect(runStaticValidate({ format: "ip" }, "abc")).toHaveLength(1);
      expect(runStaticValidate({ format: "ip" }, "192.168.1.1")).toHaveLength(0);
    });

    it("uses custom message", () => {
      const errors = runStaticValidate({ minimum: 5, message: "Too small!" }, 3);
      expect(errors[0]?.message).toBe("Too small!");
    });
  });

  describe("normalizeValidationErrors", () => {
    it("returns empty for passed results", () => {
      expect(normalizeValidationErrors(undefined)).toEqual([]);
      expect(normalizeValidationErrors(null)).toEqual([]);
      expect(normalizeValidationErrors(true)).toEqual([]);
    });

    it("returns generic error for false", () => {
      expect(normalizeValidationErrors(false)).toEqual([{ message: "Invalid value", type: "x-validate" }]);
    });

    it("wraps string as error", () => {
      expect(normalizeValidationErrors("bad input")).toEqual([{ message: "bad input", type: "x-validate" }]);
    });

    it("passes through FieldError objects", () => {
      expect(normalizeValidationErrors({ message: "err", type: "custom" })).toEqual([
        { message: "err", type: "custom" },
      ]);
    });

    it("handles array of mixed results", () => {
      const result = normalizeValidationErrors([true, "error1", { message: "error2" }, null]);
      expect(result).toEqual([
        { message: "error1", type: "x-validate" },
        { message: "error2", type: "x-validate" },
      ]);
    });
  });
});

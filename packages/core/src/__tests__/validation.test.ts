import { describe, expect, it } from "vitest";
import { applyValidatorRule, isEmptyValue, normalizeValidationErrors } from "../schema/validation";

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

  describe("applyValidatorRule", () => {
    it("validates required", () => {
      expect(applyValidatorRule({ required: true }, "")).toHaveLength(1);
      expect(applyValidatorRule({ required: true }, "hello")).toHaveLength(0);
    });

    it("validates min/max for numbers", () => {
      expect(applyValidatorRule({ min: 5 }, 3)).toHaveLength(1);
      expect(applyValidatorRule({ min: 5 }, 5)).toHaveLength(0);
      expect(applyValidatorRule({ max: 10 }, 11)).toHaveLength(1);
      expect(applyValidatorRule({ max: 10 }, 10)).toHaveLength(0);
    });

    it("validates exclusiveMinimum/exclusiveMaximum", () => {
      expect(applyValidatorRule({ exclusiveMinimum: 5 }, 5)).toHaveLength(1);
      expect(applyValidatorRule({ exclusiveMinimum: 5 }, 6)).toHaveLength(0);
      expect(applyValidatorRule({ exclusiveMaximum: 10 }, 10)).toHaveLength(1);
      expect(applyValidatorRule({ exclusiveMaximum: 10 }, 9)).toHaveLength(0);
    });

    it("validates multipleOf", () => {
      expect(applyValidatorRule({ multipleOf: 3 }, 7)).toHaveLength(1);
      expect(applyValidatorRule({ multipleOf: 3 }, 9)).toHaveLength(0);
    });

    it("validates minLength/maxLength for strings", () => {
      expect(applyValidatorRule({ minLength: 3 }, "ab")).toHaveLength(1);
      expect(applyValidatorRule({ minLength: 3 }, "abc")).toHaveLength(0);
      expect(applyValidatorRule({ maxLength: 5 }, "toolong")).toHaveLength(1);
      expect(applyValidatorRule({ maxLength: 5 }, "ok")).toHaveLength(0);
    });

    it("validates pattern", () => {
      expect(applyValidatorRule({ pattern: "^\\d+$" }, "abc")).toHaveLength(1);
      expect(applyValidatorRule({ pattern: "^\\d+$" }, "123")).toHaveLength(0);
      expect(applyValidatorRule({ pattern: /^[A-Z]+$/ }, "abc")).toHaveLength(1);
      expect(applyValidatorRule({ pattern: /^[A-Z]+$/ }, "ABC")).toHaveLength(0);
    });

    it("validates minItems/maxItems for arrays", () => {
      expect(applyValidatorRule({ minItems: 2 }, [1])).toHaveLength(1);
      expect(applyValidatorRule({ minItems: 2 }, [1, 2])).toHaveLength(0);
      expect(applyValidatorRule({ maxItems: 3 }, [1, 2, 3, 4])).toHaveLength(1);
      expect(applyValidatorRule({ maxItems: 3 }, [1, 2])).toHaveLength(0);
    });

    it("validates uniqueItems", () => {
      expect(applyValidatorRule({ uniqueItems: true }, [1, 2, 1])).toHaveLength(1);
      expect(applyValidatorRule({ uniqueItems: true }, [1, 2, 3])).toHaveLength(0);
    });

    it("validates const", () => {
      expect(applyValidatorRule({ const: "fixed" }, "other")).toHaveLength(1);
      expect(applyValidatorRule({ const: "fixed" }, "fixed")).toHaveLength(0);
    });

    it("validates format - email", () => {
      expect(applyValidatorRule({ format: "email" }, "invalid")).toHaveLength(1);
      expect(applyValidatorRule({ format: "email" }, "test@example.com")).toHaveLength(0);
    });

    it("validates format - url", () => {
      expect(applyValidatorRule({ format: "url" }, "not-a-url")).toHaveLength(1);
      expect(applyValidatorRule({ format: "url" }, "https://example.com")).toHaveLength(0);
    });

    it("validates format - phone", () => {
      expect(applyValidatorRule({ format: "phone" }, "abc")).toHaveLength(1);
      expect(applyValidatorRule({ format: "phone" }, "+1-234-567-8900")).toHaveLength(0);
    });

    it("validates format - number", () => {
      expect(applyValidatorRule({ format: "number" }, "abc")).toHaveLength(1);
      expect(applyValidatorRule({ format: "number" }, "3.14")).toHaveLength(0);
    });

    it("validates format - integer", () => {
      expect(applyValidatorRule({ format: "integer" }, "3.14")).toHaveLength(1);
      expect(applyValidatorRule({ format: "integer" }, "42")).toHaveLength(0);
    });

    it("validates format - ip", () => {
      expect(applyValidatorRule({ format: "ip" }, "999.999.999.999")).toHaveLength(0); // regex doesn't validate ranges
      expect(applyValidatorRule({ format: "ip" }, "abc")).toHaveLength(1);
      expect(applyValidatorRule({ format: "ip" }, "192.168.1.1")).toHaveLength(0);
    });

    it("uses custom message", () => {
      const errors = applyValidatorRule({ min: 5, message: "Too small!" }, 3);
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

import type { FormInstance } from "@alien-form/react";
import type { MessageInstance } from "antd/es/message/interface";
import { describe, expect, it, vi } from "vitest";
import { getFormSubmitText, handleFormSubmitError, parseSubmitError, submitForm } from "./index";

function createFormMock({
  valid,
  values = {},
  errors = [],
}: {
  valid: boolean;
  values?: Record<string, unknown>;
  errors?: Array<{ message: string; type?: string }>;
}) {
  return {
    validate: vi.fn().mockResolvedValue(valid),
    values: vi.fn().mockReturnValue(values),
    errors: vi.fn().mockReturnValue(errors),
  } as unknown as FormInstance;
}

describe("form scene helpers", () => {
  it("uses mode-specific default submit text", () => {
    expect(getFormSubmitText("add")).toBe("创建记录");
    expect(getFormSubmitText("edit")).toBe("保存修改");
  });

  it("parses server field errors and normalizes required messages", () => {
    const result = parseSubmitError(
      new Error(
        'HTTP 422: {"details":[{"field":"name","message":"name is required"},{"field":"age","message":"Invalid age"}]}',
      ),
    );

    expect(result).toEqual({
      messages: ["该字段为必填项", "Invalid age"],
      fieldErrors: [
        { field: "name", message: "该字段为必填项" },
        { field: "age", message: "Invalid age" },
      ],
    });
  });

  it("returns an empty result for malformed server payloads", () => {
    expect(parseSubmitError(new Error("HTTP 500: not-json"))).toEqual({
      messages: undefined,
      fieldErrors: [],
    });
  });

  it("sets server field errors and warns through the injected message instance", () => {
    const setErrors = vi.fn();
    const form = {
      field: vi.fn().mockReturnValue({ setErrors }),
    } as unknown as FormInstance;
    const messageApi = {
      warning: vi.fn(),
    } as unknown as MessageInstance;

    handleFormSubmitError(
      form,
      new Error('HTTP 422: {"details":[{"field":"name","message":"name is required"}]}'),
      messageApi,
    );

    expect(setErrors).toHaveBeenCalledWith([{ message: "该字段为必填项", type: "server" }]);
    expect(messageApi.warning).toHaveBeenCalledWith("该字段为必填项");
  });

  it("blocks submission when validation fails", async () => {
    const form = createFormMock({
      valid: false,
      errors: [{ message: "Name is required" }],
    });
    const onSubmit = vi.fn();

    await expect(submitForm(form, onSubmit)).rejects.toMatchObject({
      message: "Validation failed",
      messages: ["Name is required"],
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits projected values after validation", async () => {
    const values = { name: "Ada" };
    const form = createFormMock({ valid: true, values });
    const onSubmit = vi.fn();

    await submitForm(form, onSubmit);

    expect(onSubmit).toHaveBeenCalledWith(values);
  });
});

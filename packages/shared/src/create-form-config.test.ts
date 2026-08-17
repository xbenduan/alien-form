import type { MessageInstance } from "antd/es/message/interface";
import { describe, expect, it, vi } from "vitest";
import { createFormConfig } from "./create-form-config";

function createMessageApi() {
  return {
    warning: vi.fn(),
  } as unknown as MessageInstance;
}

describe("createFormConfig", () => {
  it("uses the injected message instance for runtime errors", () => {
    const messageApi = createMessageApi();
    const config = createFormConfig({
      schema: { type: "object", properties: {} },
      messageApi,
    });

    config.onError?.({
      scope: "reaction",
      path: "name",
      message: "加载选项失败",
    });

    expect(messageApi.warning).toHaveBeenCalledWith("加载选项失败");
  });

  it("keeps validation errors on the form instead of showing a message", () => {
    const messageApi = createMessageApi();
    const config = createFormConfig({
      schema: { type: "object", properties: {} },
      messageApi,
    });

    config.onError?.({
      scope: "x-validate",
      path: "name",
      message: "姓名不能为空",
    });

    expect(messageApi.warning).not.toHaveBeenCalled();
  });
});

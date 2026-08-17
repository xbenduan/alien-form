import type { MessageInstance } from "antd/es/message/interface";
import { describe, expect, it, vi } from "vitest";
import { handleBatchDelete } from "./SchemaTable";

function createMessageApi() {
  return {
    info: vi.fn(),
  } as unknown as MessageInstance;
}

describe("SchemaTable batch actions", () => {
  it("shows the existing placeholder prompt through the injected message instance", () => {
    const messageApi = createMessageApi();

    handleBatchDelete(["1"], undefined, messageApi);

    expect(messageApi.info).toHaveBeenCalledWith("批量操作开发中");
  });

  it("runs the configured batch delete without showing the placeholder prompt", () => {
    const messageApi = createMessageApi();
    const onBatchDelete = vi.fn();

    handleBatchDelete(["1", "2"], onBatchDelete, messageApi);

    expect(onBatchDelete).toHaveBeenCalledWith(["1", "2"]);
    expect(messageApi.info).not.toHaveBeenCalled();
  });
});

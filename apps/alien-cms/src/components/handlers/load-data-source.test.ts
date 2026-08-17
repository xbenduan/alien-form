import { createForm, type PrimitiveFieldNode } from "@alien-form/core";
import { describe, expect, it, vi } from "vitest";
import nailBookingSchema from "../../data/provider/local/schema/nail-booking.json";
import { createLocalProviders, initProvider } from "../../data";
import type { CmsModelSchema } from "../../domains/model";
import { projectFormSchema } from "../../domains/record/projection";
import { map as handlers } from ".";

function initializeLocalData() {
  initProvider(({ seedDemo }: { seedDemo?: boolean }) => {
    const providers = createLocalProviders({ seedDemo });
    return {
      schema: providers.schemaProvider,
      record: providers.recordProvider,
      log: providers.logProvider,
    };
  });
}

function getDataSource(form: ReturnType<typeof createForm>, path: string) {
  return (form.field(path) as PrimitiveFieldNode).dataSource();
}

describe("loadDataSource handler integration", () => {
  it("loads booking service and employee options after form scene projection", async () => {
    initializeLocalData();
    const schema = projectFormSchema(nailBookingSchema as CmsModelSchema, "add");
    const form = createForm({ schema, handlers });

    expect(schema.properties?.serviceId).not.toHaveProperty("x-cms");
    expect(schema.properties?.employeeId).not.toHaveProperty("x-cms");

    form.mount();

    await vi.waitFor(() => {
      expect(getDataSource(form, "serviceId")).toEqual([
        { value: "service-4", label: "节日定制礼盒款" },
        { value: "service-3", label: "法式延长套餐" },
        { value: "service-2", label: "猫眼渐变设计" },
        { value: "service-1", label: "日常纯色护理" },
      ]);
      expect(getDataSource(form, "employeeId")).toEqual([
        { value: "employee-4", label: "Nora" },
        { value: "employee-3", label: "Kiki" },
        { value: "employee-2", label: "Momo" },
        { value: "employee-1", label: "Luna" },
      ]);
    });

    form.destroy();
  });
});

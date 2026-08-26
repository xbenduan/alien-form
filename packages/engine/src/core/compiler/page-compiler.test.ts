import { describe, expect, it, vi } from "vitest";
import { Runtime } from "../runtime/runtime";
import type { PageSchema } from "../dsl";

const schema: PageSchema = {
  id: "test",
  domain: "users",
  resources: {
    i18n: { title: { zh: "页面标题" } },
    constants: { status: "page" },
  },
  meta: { label: { plugin: "$af-i18n", key: "title" } },
  blocks: [
    {
      name: "form",
      type: "form",
      formSchema: {
        type: "object",
        title: { plugin: "$af-i18n", key: "title" } as unknown as string,
        properties: {
          status: {
            type: "string",
            default: { plugin: "$af-constant", key: "status" },
          },
        },
      },
    },
  ],
  layout: {
    component: "page",
    props: { title: { plugin: "$af-i18n", key: "title" } },
  },
};

describe("PageCompiler", () => {
  it("translates the complete page once", async () => {
    const runtime = new Runtime({ locale: "zh" });
    const translate = vi.spyOn(runtime.translator, "translate");
    await runtime.compiler.compile(schema, {
      locale: runtime.locale,
      runtime,
      domain: schema.domain,
      store: {},
    });
    expect(translate).toHaveBeenCalledTimes(1);
  });

  it("resolves page resources before domain and global registry values", async () => {
    const runtime = new Runtime({ locale: "zh" });
    runtime.constant("status", "global");
    runtime.constant("status", "domain", "users");
    runtime.constant("i18n", { title: { zh: "全局标题" } });
    runtime.constant("i18n", { title: { zh: "领域标题" } }, "users");

    const compiled = await runtime.compiler.compile(schema, {
      locale: runtime.locale,
      runtime,
      domain: schema.domain,
      store: {},
    });

    expect(compiled.layout.props?.title).toBe("页面标题");
    expect(compiled.schema.meta?.label).toBe("页面标题");
    const output = compiled.blockOutputs.form as {
      formSchema: { properties: { status: { default: unknown } } };
    };
    expect(output.formSchema.properties.status.default).toBe("page");
  });
});

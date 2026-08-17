import { describe, expect, it } from "vitest";
import type { CmsModelSchema } from "../../model";
import {
  buildDynamicDataSourceMap,
  collectDynamicDataSourceRequests,
  projectDetailSchema,
  projectFilter,
  projectFormSchema,
  projectTableColumns,
} from ".";

const schema: CmsModelSchema = {
  type: "object",
  "x-model": {
    name: "customers",
    filter: { count: 2 },
  },
  properties: {
    id: {
      type: "string",
      title: "ID",
    },
    profile: {
      type: "object",
      title: "档案",
      "x-cms": {
        table: { inline: ["city"], order: 2 },
      },
      properties: {
        city: {
          type: "string",
          title: "城市",
          component: "Select",
          dataSource: [{ label: "上海", value: "sh" }],
          "x-cms": {
            filter: {
              defaultVisible: true,
              operator: "eq",
              props: { placeholder: "选择城市" },
            },
            detail: { format: "status" },
          },
        },
        secret: {
          type: "string",
          title: "内部备注",
          "x-cms": { filter: { visible: false } },
        },
      },
    },
    contacts: {
      type: "array",
      title: "联系人",
      component: "ArrayCards",
      "x-cms": { table: { order: 1 } },
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            title: "姓名",
            "x-cms": {
              reactions: {
                dataSource: {
                  model: "users",
                  value: "id",
                  label: "name",
                },
              },
            },
          },
          status: {
            type: "string",
            title: "状态",
            "x-cms": { table: { format: "status" } },
          },
        },
      },
    },
    tags: {
      type: "array",
      title: "标签",
      component: "TagsInput",
      items: { type: "string" },
    },
    overview: {
      title: "概览",
      "x-layout": "GridLayout",
      properties: {
        nickname: {
          type: "string",
          title: "昵称",
          "x-cms": { form: { modes: ["edit"] } },
        },
      },
    },
    createdAt: {
      type: "number",
      title: "创建时间",
      "x-cms": {
        form: { modes: [] },
        detail: { format: "dateTime" },
      },
    },
  },
};

describe("record filter projection", () => {
  it("flattens object, object array and x-layout while keeping primitive arrays as leaves", () => {
    const projection = projectFilter(schema);

    expect(projection?.fields.map((field) => field.path)).toEqual([
      "profile.city",
      "contacts.name",
      "contacts.status",
      "tags",
      "overview.nickname",
    ]);
    expect(Object.keys(projection?.schema.properties ?? {})).toEqual([
      "profile__city",
      "contacts__name",
      "contacts__status",
      "tags",
      "overview__nickname",
    ]);
    expect(projection?.keyToPath.profile__city).toBe("profile.city");
  });

  it("is the only interpreter of filter metadata and system-field exclusion", () => {
    const projection = projectFilter(schema);
    const city = projection?.fields[0];

    expect(city).toMatchObject({
      component: "Select",
      operator: "eq",
      defaultVisible: true,
      props: { placeholder: "选择城市" },
    });
    expect(projection?.defaultVisibleKeys).toEqual(["profile__city"]);
    expect(projection?.fields.some((field) => field.path === "id")).toBe(false);
    expect(projection?.fields.some((field) => field.path === "createdAt")).toBe(false);
    expect(city?.field).not.toHaveProperty("x-cms");
  });
});

describe("record table projection", () => {
  it("keeps top-level fields, applies visibility/order, and projects complex summaries", () => {
    const columns = projectTableColumns(schema);
    const byKey = Object.fromEntries(columns.map((column) => [column.key, column]));

    expect(columns.findIndex((column) => column.key === "contacts")).toBeLessThan(
      columns.findIndex((column) => column.key === "profile"),
    );
    expect(byKey.id.defaultVisible).toBe(false);
    expect(byKey.id.sortable).toBe(true);
    expect(byKey.createdAt.defaultVisible).toBe(false);
    expect(byKey.tags.inline).toBeUndefined();
    expect(byKey.tags.sortable).toBe(false);
    expect(byKey.overview.type).toBeUndefined();
    expect(byKey.overview.sortable).toBe(false);
    expect(byKey.overview.inline?.map((item) => item.key)).toEqual(["nickname"]);
    expect(byKey.contacts.inline).toEqual([
      { key: "name", format: undefined, dataSource: undefined },
      { key: "status", format: "status", dataSource: undefined },
    ]);
    expect(byKey.profile.inline).toEqual([
      {
        key: "city",
        format: "status",
        dataSource: [{ label: "上海", value: "sh" }],
      },
    ]);
    expect(byKey.profile.field).not.toHaveProperty("x-cms");
    expect(byKey.profile.field.properties?.city).not.toHaveProperty("x-cms");
  });

  it("injects dynamic data sources and filters selected columns", () => {
    const columns = projectTableColumns(
      schema,
      ["contacts"],
      {
        "contacts.name": [{ label: "Alice", value: "u1" }],
      },
    );

    expect(columns).toHaveLength(1);
    expect(columns[0]?.inline?.[0]?.dataSource).toEqual([
      { label: "Alice", value: "u1" },
    ]);
  });
});

describe("record form and detail projection", () => {
  it("applies form modes recursively without leaking x-cms", () => {
    const addSchema = projectFormSchema(schema, "add");
    const editSchema = projectFormSchema(schema, "edit");

    expect(addSchema.properties?.overview.properties?.nickname.display).toBe("none");
    expect(editSchema.properties?.overview.properties?.nickname.display).toBeUndefined();
    expect(addSchema.properties?.createdAt.display).toBe("none");
    expect(addSchema.properties?.overview.properties?.nickname).not.toHaveProperty("x-cms");
  });

  it("converts detail formats to generic adapter props", () => {
    const detailSchema = projectDetailSchema(schema);

    expect(detailSchema.properties?.createdAt.props).toMatchObject({
      format: "dateTime",
    });
    expect(detailSchema.properties?.profile.properties?.city.props).toMatchObject({
      format: "status",
    });
    expect(detailSchema.properties?.createdAt).not.toHaveProperty("x-cms");
  });
});

describe("dynamic data source projection", () => {
  it("uses the shared traversal paths for object-array children", () => {
    const requests = collectDynamicDataSourceRequests(schema);
    expect(requests).toEqual([
      {
        path: "contacts.name",
        model: "users",
        valueKey: "id",
        labelKey: "name",
      },
    ]);

    expect(
      buildDynamicDataSourceMap(requests, [
        { data: [{ label: "Alice", value: "u1" }] },
      ]),
    ).toEqual({
      "contacts.name": [{ label: "Alice", value: "u1" }],
    });
  });
});

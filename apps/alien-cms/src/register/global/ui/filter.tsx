import { Card } from "antd";
import { FilterForm } from "@alien-form/shared";
import type { PageContext } from "../../../runtime";
import { pageOf } from "./types";

export function Filter({ ctx }: { ctx: PageContext }) {
  const page = pageOf(ctx);
  if (!page.compiled) return null;
  return (
    <Card styles={{ body: { padding: 16 } }}>
      <FilterForm
        filterSchema={page.compiled.filter}
        loading={page.listLoading}
        onSearch={page.setFilters}
      />
    </Card>
  );
}

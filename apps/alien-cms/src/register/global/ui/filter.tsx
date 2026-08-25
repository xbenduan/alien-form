import { Card } from "antd";
import { FilterForm } from "@alien-form/shared";
import type { PageContext } from "../../../runtime";
import { scopeOf } from "./types";

export function Filter({ ctx }: { ctx: PageContext }) {
  const scope = scopeOf(ctx);
  const compiled = ctx.compiled as { filter?: Parameters<typeof FilterForm>[0]["filterSchema"] };
  if (!compiled.filter) return null;
  return (
    <Card styles={{ body: { padding: 16 } }}>
      <FilterForm
        filterSchema={compiled.filter}
        onSearch={(values) => scope.setFilterPatch("filter", values)}
      />
    </Card>
  );
}

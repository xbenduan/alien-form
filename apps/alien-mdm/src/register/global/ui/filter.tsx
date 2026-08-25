import { Card } from "antd";
import { useBlock, type ComponentProps } from "@alien-form/engine/react";
import { FilterForm } from "../../../components/FilterForm";
import type { IFormSchema } from "@alien-form/core";

export function Filter({ node }: ComponentProps) {
  const block = useBlock(node.block ?? "main");
  const filterSchema = node.props?.filterSchema as IFormSchema | undefined;

  if (!filterSchema) return null;

  return (
    <Card styles={{ body: { padding: 16 } }}>
      <FilterForm
        filterSchema={filterSchema}
        onSearch={(values) => {
          const listBlock = block as unknown as {
            setFilterPatch: (p: Record<string, unknown>) => void;
          };
          listBlock.setFilterPatch(values);
        }}
      />
    </Card>
  );
}

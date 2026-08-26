import { Card } from "antd";
import { useListBlock, type ComponentProps } from "@alien-form/engine/react";
import { FilterForm } from "../../../components/FilterForm";
import type { IFormSchema } from "@alien-form/core";
import styles from "../ui.module.css";

export function Filter({ node }: ComponentProps) {
  const list = useListBlock(node.block ?? "main");
  const filterSchema = node.props?.filterSchema as IFormSchema | undefined;

  if (!filterSchema) return null;

  return (
    <Card className={styles.filterCard} styles={{ body: { padding: 16 } }}>
      <FilterForm
        filterSchema={filterSchema}
        loading={list.loading}
        onSearch={list.setFilters}
        onReset={() => list.setFilters({})}
      />
    </Card>
  );
}

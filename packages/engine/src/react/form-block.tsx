import { useMemo } from "react";
import { FormProvider, SchemaField } from "@alien-form/react";
import { useRuntime, usePage } from "./context";
import { FormBlockRuntime } from "../core/page/blocks/form";
export interface FormBlockRendererProps {
  blockName?: string;
}

export function FormBlockRenderer({ blockName }: FormBlockRendererProps) {
  const runtime = useRuntime();
  const page = usePage();

  const name = blockName ?? "form";
  const block = page.block(name);

  if (!(block instanceof FormBlockRuntime)) {
    throw new Error(`[alien-page] block "${name}" is not a form block`);
  }

  const components = useMemo(
    () => runtime.registry.form.components.all(page.id) as Record<string, React.ComponentType<unknown>>,
    [runtime, page.id],
  );
  const decorators = useMemo(
    () => runtime.registry.form.decorators.all(page.id) as Record<string, React.ComponentType<unknown>>,
    [runtime, page.id],
  );

  return (
    <FormProvider form={block.form} components={components} decorators={decorators}>
      <SchemaField />
    </FormProvider>
  );
}

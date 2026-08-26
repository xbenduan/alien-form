import { useMemo } from "react";
import { FormRenderer } from "@alien-form/react";
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
    () =>
      runtime.registry.form.components.all(page.domain) as Record<
        string,
        React.ComponentType<unknown>
      >,
    [runtime, page.domain],
  );
  const decorators = useMemo(
    () =>
      runtime.registry.form.decorators.all(page.domain) as Record<
        string,
        React.ComponentType<unknown>
      >,
    [runtime, page.domain],
  );

  return <FormRenderer form={block.form} components={components} decorators={decorators} />;
}

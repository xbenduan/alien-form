import { FormBlockRenderer, type ComponentProps } from "@alien-form/engine/react";

export function BuilderPreview({ node }: ComponentProps) {
  return <FormBlockRenderer blockName={node.block ?? "form"} />;
}

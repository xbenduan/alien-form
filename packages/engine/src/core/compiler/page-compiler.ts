import type { CompiledPage, PageSchema } from "../dsl";
import { SchemaTranslator } from "./translator";
import type { TranslateCtx } from "./types";

export function createCompiledPage(schema: PageSchema): CompiledPage {
  const blockOutputs: Record<string, unknown> = {};
  for (const block of schema.blocks) {
    if (block.type === "form") {
      blockOutputs[block.name] = { formSchema: block.formSchema };
    } else if (block.type === "detail") {
      blockOutputs[block.name] = { detailSchema: block.formSchema };
    } else if (block.type === "list") {
      blockOutputs[block.name] = { columns: block.columns };
    } else {
      blockOutputs[block.name] = {};
    }
  }
  return { schema, layout: schema.layout, blockOutputs };
}

export class PageCompiler {
  translator: SchemaTranslator;

  constructor(translator: SchemaTranslator) {
    this.translator = translator;
  }

  async compile(schema: PageSchema, ctx: TranslateCtx): Promise<CompiledPage> {
    const translated = await this.translator.translate(schema, {
      ...ctx,
      resources: schema.resources,
    });
    return createCompiledPage(translated);
  }
}

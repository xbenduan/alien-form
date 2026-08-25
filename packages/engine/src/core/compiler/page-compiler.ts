import type { BlockSchema, CompiledPage, PageSchema } from "../dsl";
import { SchemaTranslator } from "./translator";
import type { TranslateCtx } from "./types";

export class PageCompiler {
  translator: SchemaTranslator;

  constructor(translator: SchemaTranslator) {
    this.translator = translator;
  }

  async compile(schema: PageSchema, ctx: TranslateCtx): Promise<CompiledPage> {
    const layout = await this.translator.translate(schema.layout, ctx);

    const blockOutputs: Record<string, unknown> = {};
    for (const blockSchema of schema.blocks) {
      blockOutputs[blockSchema.name] = await this.compileBlock(blockSchema, ctx);
    }

    return { layout, blockOutputs };
  }

  private async compileBlock(block: BlockSchema, ctx: TranslateCtx): Promise<unknown> {
    if (block.type === "form" && block.formSchema) {
      return {
        formSchema: await this.translator.translate(block.formSchema, ctx),
      };
    }
    if (block.type === "list" && block.columns) {
      return {
        columns: await this.translator.translate(block.columns, ctx),
      };
    }
    if (block.type === "detail") {
      return {
        detailSchema: block.formSchema
          ? await this.translator.translate(block.formSchema, ctx)
          : undefined,
      };
    }
    return {};
  }
}

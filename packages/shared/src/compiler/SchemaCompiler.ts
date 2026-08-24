import type { IFieldSchema } from "@alien-form/react";
import {
  createEmptyDraft,
  createFieldDraft,
  createGroupDraft,
  createIdFactory,
  draftToSchema,
  schemaToDraft,
} from "./authoring";
import { defaultDescriptors } from "./descriptors";
import { builtinPlugins } from "./plugins";
import { projectColumns, projectField, projectFilter, projectForm } from "./project";
import { prefetch, resolveScene } from "./resolve";
import type {
  AlienPlugin,
  Compiled,
  CompileOptions,
  FieldDescriptor,
  FieldDraft,
  GroupDraft,
  Locale,
  ModelDraft,
  ModelFieldSchema,
  ModelSchema,
  SchemaCompilerContext,
} from "./types";

function cloneSchema(schema: ModelSchema): ModelSchema {
  return structuredClone(schema);
}

/**
 * SchemaCompiler：schema 全流程统一中心。
 *  - getSchema：拉取原始配置态 schema
 *  - compile：一次出全套 form / filter / table（+ meta），内部 resolve（插件）→ project（描述符）
 *  - toSchema / toDraft：构建器编辑态双向映射
 *  - usePlugin：链式注册插件（后注册覆盖同名）
 *
 * 生命周期：每个 domain new 一个实例，退出销毁；locale 变化重建实例。
 * 可变状态仅限：实例的插件/描述符表（静态注入）与 idFactory；跨字段共享态
 * 一律走单次 compile 的 store，不挂插件模块级，避免跨模型串数据。
 */
export class SchemaCompiler {
  private readonly service: SchemaCompilerContext["service"];
  private readonly constant: SchemaCompilerContext["constant"];
  private readonly loadSchema?: (modelCode: string) => Promise<ModelSchema>;
  private readonly plugins: AlienPlugin[];
  private readonly descriptors: FieldDescriptor[];
  private readonly idFactory: () => string;
  private readonly locale: Locale;

  constructor(ctx: SchemaCompilerContext) {
    this.service = ctx.service;
    this.constant = ctx.constant;
    this.loadSchema = ctx.loadSchema;
    this.plugins = [...builtinPlugins, ...(ctx.plugins ?? [])];
    this.descriptors = ctx.descriptors ?? defaultDescriptors;
    this.idFactory = ctx.idFactory ?? createIdFactory();
    this.locale = ctx.locale ?? "zh";
  }

  /** 注册插件（链式，后注册覆盖同名）。 */
  usePlugin(plugin: AlienPlugin): this {
    const index = this.plugins.findIndex((item) => item.name === plugin.name);
    if (index >= 0) this.plugins[index] = plugin;
    else this.plugins.push(plugin);
    return this;
  }

  /** 拉取原始配置态 schema。 */
  async getSchema(modelCode: string): Promise<ModelSchema> {
    if (!this.loadSchema) {
      throw new Error("[SchemaCompiler] loadSchema 未配置，无法 getSchema");
    }
    return this.loadSchema(modelCode);
  }

  /**
   * 编译一份 schema → 三场景产物。
   * 预取（跨场景一次）→ 每场景各基于 clone 独立 resolve + project，互不污染。
   */
  async compile(schema: ModelSchema, opts: CompileOptions = {}): Promise<Compiled> {
    const locale = opts.locale ?? this.locale;
    const resolveData = opts.resolveData ?? true;
    const store: Record<string, unknown> = {};

    await prefetch(schema, this.plugins, {
      schema,
      locale,
      resolveData,
      service: this.service,
      constant: this.constant,
      store,
    });

    const shared = {
      locale,
      resolveData,
      service: this.service,
      constant: this.constant,
      store,
    };

    const [formSchema, filterSchema, tableSchema] = await Promise.all([
      resolveScene(cloneSchema(schema), "form", schema, this.plugins, shared),
      resolveScene(cloneSchema(schema), "filter", schema, this.plugins, shared),
      resolveScene(cloneSchema(schema), "table", schema, this.plugins, shared),
    ]);

    return {
      meta: schema.meta,
      form: projectForm(formSchema, locale, this.descriptors),
      filter: projectFilter(filterSchema, locale, this.descriptors),
      columns: projectColumns(tableSchema, locale, this.descriptors),
      layout: schema["x-layout"],
    };
  }

  /** 单字段 → form 语义 + resolve（供 table 复杂字段详情弹窗渲染）。 */
  async compileField(
    field: ModelFieldSchema,
    schema: ModelSchema,
    opts: CompileOptions = {},
  ): Promise<IFieldSchema> {
    const locale = opts.locale ?? this.locale;
    const resolveData = opts.resolveData ?? true;
    const store: Record<string, unknown> = {};
    const wrapper: ModelSchema = { ...schema, properties: { __field__: field } };

    await prefetch(wrapper, this.plugins, {
      schema,
      locale,
      resolveData,
      service: this.service,
      constant: this.constant,
      store,
    });
    const resolved = await resolveScene(cloneSchema(wrapper), "form", schema, this.plugins, {
      locale,
      resolveData,
      service: this.service,
      constant: this.constant,
      store,
    });
    return projectField(resolved.properties.__field__, locale, this.descriptors);
  }

  // ─── 编辑态（构建器 draft ⇄ schema）─────────────────────────────────────

  toSchema(draft: ModelDraft): ModelSchema {
    return draftToSchema(draft);
  }

  toDraft(schema: ModelSchema): ModelDraft {
    return schemaToDraft(schema, this.idFactory);
  }

  createEmptyDraft(): ModelDraft {
    return createEmptyDraft(this.idFactory);
  }

  createFieldDraft(): FieldDraft {
    return createFieldDraft(this.idFactory);
  }

  createGroupDraft(): GroupDraft {
    return createGroupDraft(this.idFactory);
  }
}

/** 工厂函数（呼应讨论中的 Runtime({...}) 形态）。 */
export function createSchemaCompiler(ctx: SchemaCompilerContext): SchemaCompiler {
  return new SchemaCompiler(ctx);
}
